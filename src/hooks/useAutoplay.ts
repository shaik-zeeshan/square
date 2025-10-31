import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { useNavigate } from "@solidjs/router";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { JellyfinOperations } from "~/effect/services/jellyfin/operations";
import type { WithImage } from "~/effect/services/jellyfin/service";
import { commands } from "~/lib/tauri";

type UseAutoplayProps = {
  currentItem: () => WithImage<BaseItemDto> | undefined;
  onLoadNewVideo: (url: string, itemId: string) => void;
  onEndOfFile?: () => Promise<void>;
  playbackState: {
    currentTime: () => string;
    duration: () => number;
  };
};

export function useAutoplay(props: UseAutoplayProps) {
  const navigate = useNavigate();

  const [showAutoplay, setShowAutoplay] = createSignal(false);
  const [isCollapsed, setIsCollapsed] = createSignal(false);
  const [isCancelled, setIsCancelled] = createSignal(false);

  let playbackTimeUnlisten: UnlistenFn | undefined;
  let endOfFileUnlisten: UnlistenFn | undefined;

  // Query for next episode
  // const nextEpisode = createJellyFinQuery(() => ({
  //   queryKey: [
  //     library.query.getNextEpisode.key,
  //     library.query.getNextEpisode.keyFor(
  //       props.currentItemId(),
  //       userStore?.user?.Id
  //     ),
  //   ],
  //   queryFn: async (jf) =>
  //     library.query.getNextEpisode(
  //       jf,
  //       props.currentItemId(),
  //       userStore?.user?.Id
  //     ),
  //   enabled:
  //     !!props.currentItemId() &&
  //     !!userStore?.user?.Id &&
  //     props.currentItemDetails?.data?.Type === "Episode",
  // }));
  //
  const nextEpisode = JellyfinOperations.getNextEpisode(
    props.currentItem() as WithImage<BaseItemDto>
  );

  // Check if we should show autoplay when query completes
  createEffect(() => {
    // If nextEpisode query just completed and we're at 80%+, show autoplay
    if (
      !nextEpisode.isLoading &&
      nextEpisode.data &&
      !showAutoplay() &&
      !isCancelled()
    ) {
      const duration = props.playbackState.duration();
      const currentTime = Number(props.playbackState.currentTime());

      if (duration > 0 && currentTime > 0) {
        const progress = (currentTime / duration) * 100;

        if (progress >= 80 && props.currentItem()?.Type === "Episode") {
          setShowAutoplay(true);
        }
      }
    }
  });

  const hideAutoplay = () => {
    setShowAutoplay(false);
    setIsCollapsed(false);
    setIsCancelled(true); // Mark as cancelled to prevent showing again
  };

  const resetAutoplay = () => {
    setShowAutoplay(false);
    setIsCollapsed(false);
    setIsCancelled(false); // Reset cancelled state for new video
  };

  const playNextEpisode = () => {
    if (!nextEpisode.data?.Id) {
      return;
    }

    try {
      // Hide autoplay overlay first
      hideAutoplay();

      // Navigate to the new episode
      navigate(`/video/${nextEpisode.data.Id}`, { replace: true });
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
      nextEpisode.data &&
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
          !nextEpisode.isLoading &&
          nextEpisode.data
        ) {
          // Pause the video and show overlay
          commands.playbackPause();
          setShowAutoplay(true);
        }

        if (
          progress >= 95 &&
          props.currentItem()?.Type === "Episode" &&
          !isCancelled()
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

      // Show autoplay overlay when 80% complete and not already shown
      // Don't show if user has already cancelled autoplay
      // Also wait for nextEpisode query to complete
      if (
        progress >= 80 &&
        !showAutoplay() &&
        !nextEpisode.isLoading &&
        nextEpisode.data &&
        props.currentItem()?.Type === "Episode" &&
        !isCancelled()
      ) {
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
    const currentID = props.currentItem()?.Id;

    if (currentID) {
      // Clean up existing listeners first
      if (playbackTimeUnlisten) {
        playbackTimeUnlisten();
      }
      if (endOfFileUnlisten) {
        endOfFileUnlisten();
      }

      // Listen for playback time updates to detect 80% completion
      playbackTimeUnlisten = await listen("playback-time", (event) => {
        handlePlaybackTime(event.payload as string);
      });
      endOfFileUnlisten = await listen("end-of-file", async (event) => {
        await props.onEndOfFile?.();
        handleEndOfFile(event.payload as number);
      });
    }
  });
  onCleanup(() => {
    if (playbackTimeUnlisten) {
      playbackTimeUnlisten();
    }
    if (endOfFileUnlisten) {
      endOfFileUnlisten();
    }
  });

  // Create a memoized nextEpisode that will be reactive
  const nextEpisodeData = createMemo(() => nextEpisode.data);

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
