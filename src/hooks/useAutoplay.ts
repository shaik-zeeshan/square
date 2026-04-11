import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { useNavigate } from "@solidjs/router";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { Effect } from "effect";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { useRuntime } from "~/effect/runtime/use-runtime";
import { AuthService } from "~/effect/services/auth";
import type { WithImage } from "~/effect/services/jellyfin/service";
import { JellyfinService } from "~/effect/services/jellyfin/service";
import { commands, events } from "~/lib/tauri";

type UseAutoplayProps = {
  currentItem: () => WithImage<BaseItemDto> | undefined;
  onLoadNewVideo: (url: string, itemId: string) => void;
  onEndOfFile?: () => Promise<void>;
  playbackState: {
    currentTime: () => string;
    duration: () => number;
    paused: () => boolean;
  };
};

export function useAutoplay(props: UseAutoplayProps) {
  const navigate = useNavigate();
  const runtime = useRuntime();

  const [showAutoplay, setShowAutoplay] = createSignal(false);
  const [isCollapsed, setIsCollapsed] = createSignal(false);
  const [isCancelled, setIsCancelled] = createSignal(false);
  const [didPauseForAutoplay, setDidPauseForAutoplay] = createSignal(false);
  const [nextEpisode, setNextEpisode] = createSignal<
    WithImage<BaseItemDto> | undefined
  >(undefined);
  const [isNextEpisodeLoading, setIsNextEpisodeLoading] = createSignal(false);

  let playbackTimeUnlisten: UnlistenFn | undefined;
  let endOfFileUnlisten: UnlistenFn | undefined;
  let listenerSetupVersion = 0;

  let fetchVersion = 0;
  createEffect(() => {
    const currentItem = props.currentItem();
    const currentId = currentItem?.Id;
    const version = ++fetchVersion;

    if (!currentId || currentItem?.Type !== "Episode") {
      setNextEpisode(undefined);
      setIsNextEpisodeLoading(false);
      return;
    }

    setIsNextEpisodeLoading(true);

    runtime
      .runPromise(
        Effect.gen(function* () {
          yield* AuthService;
          return yield* JellyfinService.pipe(
            Effect.flatMap((jf) => jf.getNextEpisode(currentItem))
          );
        })
      )
      .then((item) => {
        if (version !== fetchVersion) {
          return;
        }
        setNextEpisode(item);
      })
      .catch(() => {
        if (version !== fetchVersion) {
          return;
        }
        setNextEpisode(undefined);
      })
      .finally(() => {
        if (version !== fetchVersion) {
          return;
        }
        setIsNextEpisodeLoading(false);
      });
  });

  // Check if we should show autoplay when query completes
  createEffect(() => {
    // If nextEpisode query just completed and we're at 80%+, show autoplay
    if (
      !isNextEpisodeLoading() &&
      nextEpisode() &&
      !showAutoplay() &&
      !isCancelled()
    ) {
      const duration = props.playbackState.duration();
      const currentTime = Number(props.playbackState.currentTime());

      if (duration > 0 && currentTime > 0) {
        const progress = (currentTime / duration) * 100;

        if (progress >= 80 && props.currentItem()?.Type === "Episode") {
          // Keep behavior consistent with threshold-triggered path.
          const wasPlaying = !props.playbackState.paused();
          if (wasPlaying) {
            commands.playbackPause();
          }
          setDidPauseForAutoplay(wasPlaying);
          setShowAutoplay(true);
        }
      }
    }
  });

  const hideAutoplay = () => {
    setShowAutoplay(false);
    setIsCollapsed(false);
    setIsCancelled(true); // Mark as cancelled to prevent showing again
    // Resume playback only if the prompt itself paused playback.
    if (didPauseForAutoplay()) {
      commands.playbackPlay();
    }
    setDidPauseForAutoplay(false);
  };

  // Used by Play Now path: dismiss the overlay without resuming the old item.
  const dismissAutoplayForNavigation = () => {
    setShowAutoplay(false);
    setIsCollapsed(false);
    setIsCancelled(true);
    setDidPauseForAutoplay(false);
    // Do NOT call commands.playbackPlay() – we are navigating away immediately.
  };

  const resetAutoplay = () => {
    setShowAutoplay(false);
    setIsCollapsed(false);
    setIsCancelled(false); // Reset cancelled state for new video
    setDidPauseForAutoplay(false);
  };

  const playNextEpisode = () => {
    const next = nextEpisode();
    if (!next?.Id) {
      return;
    }

    try {
      // Dismiss overlay without resuming the old item before navigation.
      dismissAutoplayForNavigation();

      // Navigate to the new episode
      navigate(`/video/${next.Id}`, { replace: true });
    } catch {
      setShowAutoplay(false);
    }
  };

  const handleEndOfFile = (reason: number) => {
    // Only show autoplay for natural end of file (reason 0 = MPV_END_FILE_REASON_EOF)
    // and only for episodes that have a next episode
    // Also check if we're at least 80% through the video
    // Don't show if user has already cancelled autoplay
    if (
      reason === 0 &&
      nextEpisode() &&
      props.currentItem()?.Type === "Episode" &&
      !isCancelled()
    ) {
      const duration = props.playbackState.duration();
      const currentTime = Number(props.playbackState.currentTime());

      if (duration > 0 && currentTime > 0) {
        const progress = (currentTime / duration) * 100;

        // Only show autoplay if we're at least 80% through the video
        // Also wait for nextEpisode query to complete
        if (
          progress >= 80 &&
          !showAutoplay() &&
          !isNextEpisodeLoading() &&
          nextEpisode()
        ) {
          // Pause the video and show overlay
          const wasPlaying = !props.playbackState.paused();
          if (wasPlaying) {
            commands.playbackPause();
          }
          setDidPauseForAutoplay(wasPlaying);
          setShowAutoplay(true);
        }

        // Only auto-advance at >=95% if the overlay was never shown (i.e. the
        // user has not had a chance to interact with it).  When showAutoplay()
        // is true the overlay is already visible and the user should be able to
        // cancel or confirm; we leave navigation entirely to their action.
        if (
          progress >= 95 &&
          props.currentItem()?.Type === "Episode" &&
          !isCancelled() &&
          !showAutoplay()
        ) {
          playNextEpisode();
        }
      }
    }
  };

  const handlePlaybackTime = (time: string) => {
    // Check if we're at 80% of the video duration
    const duration = props.playbackState.duration();
    const currentTime = Number(time);

    if (duration > 0 && currentTime > 0) {
      const progress = (currentTime / duration) * 100;

      // Hide the overlay (without marking as cancelled) when the user scrubs
      // back below the 80% threshold — lets the overlay re-appear naturally if
      // they seek forward again without having explicitly dismissed it.
      if (progress < 80 && showAutoplay()) {
        setShowAutoplay(false);
        setIsCollapsed(false);
        // Resume playback only if the overlay had paused playback.
        if (didPauseForAutoplay()) {
          commands.playbackPlay();
        }
        setDidPauseForAutoplay(false);
        return;
      }

      // Show autoplay overlay when 80% complete and not already shown
      // Don't show if user has already cancelled autoplay
      // Also wait for nextEpisode query to complete
      if (
        progress >= 80 &&
        !showAutoplay() &&
        !isNextEpisodeLoading() &&
        nextEpisode() &&
        props.currentItem()?.Type === "Episode" &&
        !isCancelled()
      ) {
        const wasPlaying = !props.playbackState.paused();
        if (wasPlaying) {
          commands.playbackPause();
        }
        setDidPauseForAutoplay(wasPlaying);
        setShowAutoplay(true);
      }
    }
  };

  // Reset autoplay state when current item changes
  let lastItemId = "";
  createEffect(() => {
    const currentId = props.currentItem()?.Id;
    if (currentId && currentId !== lastItemId) {
      resetAutoplay();
      lastItemId = currentId;
    }
  });

  createEffect(async () => {
    const setupVersion = ++listenerSetupVersion;
    const currentID = props.currentItem()?.Id;

    // Always clean up existing listeners, even when current item is temporarily undefined.
    if (playbackTimeUnlisten) {
      playbackTimeUnlisten();
      playbackTimeUnlisten = undefined;
    }
    if (endOfFileUnlisten) {
      endOfFileUnlisten();
      endOfFileUnlisten = undefined;
    }

    if (currentID) {
      // Listen for playback time updates to detect 80% completion
      const playbackTimeListener = await events.playBackTimeChange.listen(
        (event) => {
          handlePlaybackTime(event.payload.position);
        }
      );
      if (setupVersion !== listenerSetupVersion) {
        playbackTimeListener();
        return;
      }
      playbackTimeUnlisten = playbackTimeListener;

      // EOFEventChange payload is null; treat every natural EOF as reason 0
      const endOfFileListener = await events.eofEventChange.listen(async () => {
        try {
          await props.onEndOfFile?.();
        } catch {
          // onEndOfFile rejection must not block autoplay/next-episode handling
        }
        handleEndOfFile(0);
      });
      if (setupVersion !== listenerSetupVersion) {
        endOfFileListener();
        return;
      }
      endOfFileUnlisten = endOfFileListener;
    }
  });
  onCleanup(() => {
    listenerSetupVersion++;
    if (playbackTimeUnlisten) {
      playbackTimeUnlisten();
      playbackTimeUnlisten = undefined;
    }
    if (endOfFileUnlisten) {
      endOfFileUnlisten();
      endOfFileUnlisten = undefined;
    }
  });

  // Create a memoized nextEpisode that will be reactive
  const nextEpisodeData = createMemo(() => nextEpisode());

  // Create a memoized return object to ensure reactivity
  const returnValue = createMemo(() => ({
    showAutoplay,
    isCollapsed,
    setIsCollapsed,
    nextEpisode: nextEpisodeData(),
    playNextEpisode,
    cancelAutoplay: hideAutoplay,
  }));

  return returnValue;
}
