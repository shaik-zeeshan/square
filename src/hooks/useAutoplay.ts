import { useNavigate } from "@solidjs/router";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { JellyfinCatalogueOperations } from "~/effect/services/jellyfin/catalogue/operations";
import type { MediaItem } from "~/effect/services/jellyfin/catalogue/types";
import { commands, events } from "~/lib/tauri";

type UseAutoplayProps = {
  currentItem: () => MediaItem | undefined;
  onEndOfFile?: () => Promise<void>;
  playbackState: {
    currentTime: () => string;
    duration: () => number;
    paused: () => boolean;
  };
};

export function useAutoplay(props: UseAutoplayProps) {
  const navigate = useNavigate();

  const [showAutoplay, setShowAutoplay] = createSignal(false);
  const [isCollapsed, setIsCollapsed] = createSignal(false);
  const [isCancelled, setIsCancelled] = createSignal(false);
  const [didPauseForAutoplay, setDidPauseForAutoplay] = createSignal(false);
  const nextEpisodeQuery = JellyfinCatalogueOperations.getNextEpisode(props.currentItem);

  let playbackTimePollInterval: ReturnType<typeof setInterval> | undefined;
  let endOfFileUnlisten: UnlistenFn | undefined;
  let listenerSetupVersion = 0;


  // Check if we should show autoplay when query completes
  createEffect(() => {
    // If nextEpisode query just completed and we're at 80%+, show autoplay
    if (
      !nextEpisodeQuery.isLoading &&
      nextEpisodeQuery.data &&
      !showAutoplay() &&
      !isCancelled()
    ) {
      const duration = props.playbackState.duration();
      const currentTime = Number(props.playbackState.currentTime());

      if (duration > 0 && currentTime > 0) {
        const progress = (currentTime / duration) * 100;

        if (progress >= 80 && props.currentItem()?.type === "episode") {
          // Show overlay without interrupting playback.
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

  const resetAutoplay = () => {
    setShowAutoplay(false);
    setIsCollapsed(false);
    setIsCancelled(false); // Reset cancelled state for new video
    setDidPauseForAutoplay(false);
  };

  const playNextEpisode = () => {
    const next = nextEpisodeQuery.data;
    if (!next?.id) {
      return;
    }

    try {
      // Eagerly reset all autoplay state (including isCancelled) so the new
      // episode starts with a clean slate.  The item-change effect would
      // eventually do this once refreshed metadata arrives, but resetting now
      // closes the transient window where the new episode could inherit
      // isCancelled=true from the outgoing episode.
      // NOTE: we do NOT call commands.playbackPlay() — we are navigating away.
      resetAutoplay();

      // Navigate to the new episode
      navigate(`/video/${next.id}`, { replace: true });
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
      nextEpisodeQuery.data &&
      props.currentItem()?.type === "episode" &&
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
          !nextEpisodeQuery.isLoading &&
          nextEpisodeQuery.data
        ) {
          // Show overlay without pausing playback.
          setShowAutoplay(true);
        }

        // Only auto-advance at >=95% if the overlay was never shown (i.e. the
        // user has not had a chance to interact with it).  When showAutoplay()
        // is true the overlay is already visible and the user should be able to
        // cancel or confirm; we leave navigation entirely to their action.
        if (
          progress >= 95 &&
          props.currentItem()?.type === "episode" &&
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
        !nextEpisodeQuery.isLoading &&
        nextEpisodeQuery.data &&
        props.currentItem()?.type === "episode" &&
        !isCancelled()
      ) {
        // Show overlay without pausing playback.
        setShowAutoplay(true);
      }
    }
  };

  // Reset autoplay state when current item changes
  let lastItemId = "";
  createEffect(() => {
    const currentId = props.currentItem()?.id;
    if (currentId && currentId !== lastItemId) {
      resetAutoplay();
      lastItemId = currentId;
    }
  });

  createEffect(async () => {
    const setupVersion = ++listenerSetupVersion;
    const currentID = props.currentItem()?.id;

    // Always clean up existing listeners, even when current item is temporarily undefined.
    if (playbackTimePollInterval) {
      clearInterval(playbackTimePollInterval);
      playbackTimePollInterval = undefined;
    }
    if (endOfFileUnlisten) {
      endOfFileUnlisten();
      endOfFileUnlisten = undefined;
    }

    if (currentID) {
      // Poll playback time at a coarse interval (~1s) instead of reacting to
      // every high-frequency playBackTimeChange event.  The autoplay threshold
      // is 80% so sub-second precision is unnecessary.
      playbackTimePollInterval = setInterval(() => {
        handlePlaybackTime(props.playbackState.currentTime());
      }, 1000);

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
    if (playbackTimePollInterval) {
      clearInterval(playbackTimePollInterval);
      playbackTimePollInterval = undefined;
    }
    if (endOfFileUnlisten) {
      endOfFileUnlisten();
      endOfFileUnlisten = undefined;
    }
  });

  // Create a memoized nextEpisode that will be reactive
  const nextEpisodeData = createMemo(() => nextEpisodeQuery.data);

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
