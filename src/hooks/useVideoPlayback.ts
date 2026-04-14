import {
  type BaseItemDto,
  PlayMethod,
} from "@jellyfin/sdk/lib/generated-client";
import { getPlaystateApi } from "@jellyfin/sdk/lib/utils/api/playstate-api";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getAllWindows, getCurrentWindow } from "@tauri-apps/api/window";
import { Effect } from "effect";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { createStore } from "solid-js/store";
import type {
  BufferHealth,
  Chapter,
  LoadingStage,
  NetworkQuality,
  OpenPanel,
  OSDState,
  Track,
} from "~/components/video/types";
import {
  DEFAULT_AUDIO_LANG,
  DEFAULT_SUBTITLE_LANG,
} from "~/components/video/types";
import { useVideoContext } from "~/contexts/video-context";
import { useRuntime } from "~/effect/runtime/use-runtime";
import { AuthService } from "~/effect/services/auth";
import type { WithImage } from "~/effect/services/jellyfin/service";
import { commands, events } from "~/lib/tauri";

type ItemDetails = WithImage<BaseItemDto> | undefined;

export function useVideoPlayback(
  itemId: () => string,
  itemDetails: () => ItemDetails
) {
  const runtime = useRuntime();
  const jf = runtime.runSync(
    Effect.gen(function* () {
      const auth = yield* AuthService;
      const api = yield* auth.getApi();
      return { api };
    })
  );

  const [videoContext, setVideoState] = useVideoContext();
  const playbackSessionId = crypto.randomUUID();
  setVideoState("activePlaybackSessionId", playbackSessionId);

  const [state, setState] = createStore({
    audioIndex: -1,
    subtitleIndex: -1,
    currentTime: "",
    playing: true,
    volume: 100,
    isMuted: false,
    playbackSpeed: 1,
    audioList: [] as Track[],
    subtitleList: [] as Track[],
    chapters: [] as Chapter[],
    duration: 0,
    showControls: true,
    controlsLocked: false,
    url: "",
    currentItemId: itemId(),
    isHoveringControls: false,
    isInteractingControls: false,
    // New buffering and loading states
    bufferedTime: 0,
    bufferingPercentage: 0,
    isLoading: true,
    isBuffering: false,
    isSeeking: false,
    playbackError: null as string | null,
    // OSD and help states
    osd: {
      visible: false,
      type: "play" as const,
      value: null,
      icon: "Play",
      label: "",
    } as OSDState,
    showHelp: false,
    loadingStage: "connecting" as LoadingStage,
    networkQuality: "good" as NetworkQuality,
    bufferHealth: "healthy" as BufferHealth,
  });

  const [openPanel, setOpenPanel] = createSignal<OpenPanel>(null);
  const [hideControlsTimeout, setHideControlsTimeout] =
    createSignal<NodeJS.Timeout>();

  let unlistenFuncs: UnlistenFn[] = [];
  let listenerSetupVersion = 0;
  let seekGuardTimeout: NodeJS.Timeout | undefined;
  let bufferingResetTimeout: NodeJS.Timeout | undefined;
  let localSeekTarget: number | null = null;
  let localSeekGuardUntil = 0;
  let hasClearedPlayback = false;

  const removeControlInteractionListeners = () => {
    window.removeEventListener("pointerup", handleControlInteractionEnd);
    window.removeEventListener("pointercancel", handleControlInteractionEnd);
  };

  const SEEK_GUARD_MS = 900;
  const SEEK_CONFIRM_TOLERANCE_SECONDS = 1.5;

  // Jellyfin playback reporting
  const playSessionId = crypto.randomUUID();
  let lastProgressReportTime = 0;

  const shouldPreventControlsAutoHide = () =>
    state.controlsLocked ||
    state.isHoveringControls ||
    state.isInteractingControls;

  const clearHideControlsTimeout = () => {
    const existing = hideControlsTimeout();
    if (existing) {
      clearTimeout(existing);
      setHideControlsTimeout(undefined);
    }
  };

  const scheduleHideControls = () => {
    clearHideControlsTimeout();

    if (shouldPreventControlsAutoHide()) {
      return;
    }

    const timeout = setTimeout(() => {
      if (shouldPreventControlsAutoHide()) {
        return;
      }

      setState("showControls", false);
      commands.toggleTitlebarHide(true);
      setHideControlsTimeout(undefined);
    }, 1000);

    setHideControlsTimeout(timeout);
  };

  const showControls = () => {
    if (state.controlsLocked) {
      return;
    }
    setState("showControls", true);
    commands.toggleTitlebarHide(false);
    scheduleHideControls();
  };

  const toggleControlsLock = () => {
    const nextLocked = !state.controlsLocked;
    setState("controlsLocked", nextLocked);

    if (nextLocked) {
      // When locking, hide controls immediately
      setState("showControls", false);
      commands.toggleTitlebarHide(true);
      clearHideControlsTimeout();
    } else {
      // When unlocking, show controls immediately
      setState("showControls", true);
      commands.toggleTitlebarHide(false);
      scheduleHideControls();
    }
  };

  const showOSD = (
    type: OSDState["type"],
    value: string | number | null,
    label?: string
  ) => {
    setState("osd", {
      visible: true,
      type,
      value,
      icon: type,
      label: label || "",
    });
  };

  const hideOSD = () => {
    setState("osd", "visible", false);
  };

  const toggleHelp = () => {
    setState("showHelp", !state.showHelp);
  };

  const updateLoadingStage = (stage: LoadingStage) => {
    setState("loadingStage", stage);
  };

  const updateNetworkQuality = (quality: NetworkQuality) => {
    setState("networkQuality", quality);
  };

  const updateBufferHealth = (health: BufferHealth) => {
    setState("bufferHealth", health);
  };

  const setBufferingState = (next: boolean, debounceMs = 250) => {
    if (next) {
      clearTimeout(bufferingResetTimeout);
      if (!state.isBuffering) {
        setState("isBuffering", true);
      }
      return;
    }

    clearTimeout(bufferingResetTimeout);
    bufferingResetTimeout = setTimeout(() => {
      if (state.isBuffering) {
        setState("isBuffering", false);
      }
    }, debounceMs);
  };

  const beginAbsoluteSeek = (targetSeconds: number) => {
    const safeTarget = Math.max(
      0,
      Math.min(
        targetSeconds,
        state.duration > 0 ? state.duration : Number.POSITIVE_INFINITY
      )
    );

    localSeekTarget = safeTarget;
    localSeekGuardUntil = Date.now() + SEEK_GUARD_MS;

    clearTimeout(seekGuardTimeout);
    seekGuardTimeout = setTimeout(() => {
      localSeekTarget = null;
      localSeekGuardUntil = 0;
      setState("isSeeking", false);
    }, SEEK_GUARD_MS + 300);

    setState("isSeeking", true);
    showControls();
    commands.playbackAbsoluteSeek(safeTarget);
  };

  const clearPlaybackError = () => {
    setState("playbackError", null);
  };

  const clearPlaybackIfActiveSession = async () => {
    if (hasClearedPlayback) {
      return;
    }

    const activePlaybackSessionId = videoContext.activePlaybackSessionId;
    if (
      activePlaybackSessionId &&
      activePlaybackSessionId !== playbackSessionId
    ) {
      return;
    }

    hasClearedPlayback = true;
    if (activePlaybackSessionId === playbackSessionId) {
      setVideoState("activePlaybackSessionId", null);
    }
    await commands.playbackClear();
  };

  const retryPlayback = async () => {
    if (!state.url) {
      return;
    }

    clearPlaybackError();
    setState("isLoading", true);
    setBufferingState(false, 0);

    await commands.playbackLoad(state.url);
    await commands.playbackPlay();
  };

  const togglePlay = () => {
    if (state.playing) {
      commands.playbackPause();
      showOSD("pause", null, "Paused");
    } else {
      commands.playbackPlay();
      showOSD("play", null, "Playing");
    }
  };

  const toggleMute = () => {
    if (state.isMuted) {
      const lastVolume = state.volume || 100;
      commands.playbackVolume(lastVolume);
      setState("volume", lastVolume);
      setState("isMuted", false);
      showOSD("unmute", lastVolume, "Unmuted");
    } else {
      commands.playbackVolume(0);
      setState("isMuted", true);
      showOSD("mute", 0, "Muted");
    }
  };

  const handleVolumeChange = (value: number) => {
    const newVolume = Math.round(value);
    commands.playbackVolume(newVolume);
    setState("volume", newVolume);
    setState("isMuted", newVolume === 0);
    showOSD("volume", newVolume);
  };

  const setSpeed = (speed: number) => {
    commands.playbackSpeed(speed);
    setState("playbackSpeed", speed);
    showOSD("speed", speed);
  };

  const navigateToChapter = (chapter: Chapter) => {
    // Convert ticks to seconds (1 tick = 100 nanoseconds = 0.0000001 seconds)
    const startTimeSeconds = chapter.startPositionTicks / 10_000_000;
    beginAbsoluteSeek(startTimeSeconds);
  };

  const handleProgressClick = (value: number) => {
    if (state.duration === 0) {
      return;
    }
    const newTime = (value / 100) * state.duration;
    beginAbsoluteSeek(newTime);
  };

  const syncPipVisibility = async () => {
    const windows = await getAllWindows();
    const pipWindow = windows.find((w) => w.label === "pip");
    const isVisible = (await pipWindow?.isVisible()) ?? false;
    setVideoState("isPip", isVisible);
    return isVisible;
  };

  const getPipToggleLabel = (wasVisible: boolean, isVisible: boolean) => {
    if (wasVisible) {
      return isVisible
        ? "Picture in Picture failed to close"
        : "Picture in Picture closed";
    }

    return isVisible
      ? "Picture in Picture opened"
      : "Picture in Picture failed to open";
  };

  const handleOpenPip = async () => {
    let wasVisible = false;
    let isOpeningPip = false;

    try {
      wasVisible = await syncPipVisibility();

      if (wasVisible) {
        await commands.hidePipWindow();
        const isStillVisible = await syncPipVisibility();
        showOSD(
          "pip",
          null,
          isStillVisible
            ? "Picture in Picture failed to close"
            : "Picture in Picture closed"
        );
        return;
      }

      isOpeningPip = true;
      setVideoState("isPipTransitioning", true);
      await commands.showPipWindow();
      const isVisible = await syncPipVisibility();
      showOSD(
        "pip",
        null,
        isVisible
          ? "Picture in Picture opened"
          : "Picture in Picture failed to open"
      );
    } catch (_error) {
      const isVisible = await syncPipVisibility();
      showOSD("pip", null, getPipToggleLabel(wasVisible, isVisible));
    } finally {
      if (isOpeningPip) {
        setVideoState("isPipTransitioning", false);
      }
    }
  };

  const loadNewVideo = (url: string, newItemId: string) => {
    setState("url", url);
    setState("currentItemId", newItemId);
    setState("currentTime", "0");
    setState("duration", 0);
    setState("playing", true);
    // Reset buffering and loading states for new video
    setState("bufferedTime", 0);
    setState("bufferingPercentage", 0);
    setState("isLoading", true);
    setState("isBuffering", false);
    setState("isSeeking", false);
    setState("playbackError", null);
    commands.playbackLoad(url);
  };

  const handleControlMouseEnter = () => {
    setState("isHoveringControls", true);
    clearHideControlsTimeout();
  };

  const handleControlMouseLeave = () => {
    setState("isHoveringControls", false);
    scheduleHideControls();
  };

  const handleControlInteractionEnd = () => {
    removeControlInteractionListeners();
    setState("isInteractingControls", false);
    scheduleHideControls();
  };

  const handleControlInteractionStart = () => {
    removeControlInteractionListeners();
    setState("isInteractingControls", true);
    setState("showControls", true);
    commands.toggleTitlebarHide(false);
    clearHideControlsTimeout();

    window.addEventListener("pointerup", handleControlInteractionEnd);
    window.addEventListener("pointercancel", handleControlInteractionEnd);
  };

  const resetTransientUiState = () => {
    clearHideControlsTimeout();
    if (openPanel()) {
      setOpenPanel(null);
    }
    setState("showControls", true);
    setState("controlsLocked", false);
    setState("isHoveringControls", false);
    setState("isInteractingControls", false);
    setState("showHelp", false);
    setState("osd", "visible", false);
    setState("isBuffering", false);
    setState("isSeeking", false);
    setState("playbackError", null);
    commands.toggleTitlebarHide(false);
    removeControlInteractionListeners();
  };

  let loadVersion = 0;
  createEffect(async () => {
    const currentItemId = itemId();
    const token = jf.api?.accessToken;
    const basePath = jf.api?.basePath;

    if (!(token && jf.api && currentItemId)) {
      return;
    }

    // Prevent reloading if we're already playing the same item
    if (state.currentItemId === currentItemId && state.url) {
      return;
    }

    const thisLoad = ++loadVersion;
    const url = `${basePath}/Videos/${currentItemId}/Stream?api_key=${token}&container=mp4&static=true`;
    setState("url", url);
    setState("currentItemId", currentItemId);
    setState("currentTime", "0");
    setState("duration", 0);
    setState("playbackError", null);

    // Stale-guard helper: returns true when a newer effect run has started,
    // meaning this run must stop issuing player commands immediately.
    const isStale = () => thisLoad !== loadVersion;

    // Each step checks staleness *before* sending a command so that a
    // superseded run never issues playbackClear / playbackLoad / playbackPlay
    // after a newer run has already taken ownership of the player.
    if (isStale()) {
      return;
    }
    await commands.playbackClear();

    if (isStale()) {
      return;
    }
    await commands.playbackLoad(url);

    if (isStale()) {
      return;
    }
    await commands.playbackPlay();

    if (isStale()) {
      return;
    }
    setVideoState("pause", false);
  });

  createEffect(() => {
    syncPipVisibility().catch(() => {
      // Do nothing
    });
  });

  createEffect(() => {
    let chapters: Chapter[] = [];

    // Check for chapters in different possible fields
    if (itemDetails()?.Chapters && Array.isArray(itemDetails()?.Chapters)) {
      chapters =
        (itemDetails()?.Chapters?.map((chapter) => ({
          startPositionTicks: chapter?.StartPositionTicks || 0,
          name: chapter?.Name || null,
          imagePath: chapter?.ImagePath || null,
          imageDateModified: chapter?.ImageDateModified || null,
          imageTag: chapter?.ImageTag || null,
        })) as Chapter[]) ?? [];
    }
    setState("chapters", chapters);
  });

  createEffect(async () => {
    const setupVersion = ++listenerSetupVersion;
    const nextUnlistenFuncs: UnlistenFn[] = [];
    const registerListener = async (
      listenerPromise: Promise<UnlistenFn>
    ): Promise<boolean> => {
      const unlisten = await listenerPromise;
      if (setupVersion !== listenerSetupVersion) {
        unlisten();
        return false;
      }
      nextUnlistenFuncs.push(unlisten);
      return true;
    };

    const currentItemId = itemId();
    // Clean up existing listeners when itemId changes
    unlistenFuncs.forEach((unlisten) => {
      unlisten();
    });
    unlistenFuncs = [];

    if (
      !(await registerListener(
        events.fileLoadedChange.listen(async ({ payload }) => {
          // Reset loading state when file is loaded
          setState("isLoading", false);
          setBufferingState(false, 0);
          clearPlaybackError();
          commands.playbackPlay();
          setVideoState("pause", false);

          const currentTime = payload.current_time;
          const duration = payload.duration;
          setState("duration", duration);

          if (Number(state.currentTime) > 0) {
            beginAbsoluteSeek(Number(state.currentTime));
          } else {
            const userProgress = itemDetails()?.UserData?.PlaybackPositionTicks
              ? (itemDetails()?.UserData?.PlaybackPositionTicks as number) /
                10_000_000
              : 0;

            if (userProgress > 0 && userProgress !== Number(currentTime)) {
              beginAbsoluteSeek(userProgress);
            }
          }

          try {
            if (!jf.api) {
              return;
            }
            const playstateApi = getPlaystateApi(jf.api);
            await playstateApi.reportPlaybackStart({
              playbackStartInfo: {
                ItemId: currentItemId,
                PlaySessionId: playSessionId,
                CanSeek: true,
                IsPaused: false,
                IsMuted: state.isMuted,
                VolumeLevel: Math.min(state.volume, 100), // Clamp to 100 for Jellyfin
                PlayMethod: PlayMethod.DirectStream,
                AudioStreamIndex:
                  state.audioIndex >= 0 ? state.audioIndex : undefined,
                SubtitleStreamIndex:
                  state.subtitleIndex > 0 ? state.subtitleIndex : undefined,
              },
            });

            // Initialize last progress report time
            lastProgressReportTime = Date.now();
          } catch (_error) {
            // Do nothing
          }
        })
      ))
    ) {
      return;
    }

    if (
      !(await registerListener(
        events.playBackTimeChange.listen(async ({ payload }) => {
          const newTime = payload.position;
          const parsedTime = Number(newTime);

          if (Number.isNaN(parsedTime)) {
            return;
          }

          const now = Date.now();
          if (
            localSeekTarget !== null &&
            now <= localSeekGuardUntil &&
            Math.abs(parsedTime - localSeekTarget) >
              SEEK_CONFIRM_TOLERANCE_SECONDS
          ) {
            return;
          }

          if (localSeekTarget !== null) {
            const matchedSeek =
              Math.abs(parsedTime - localSeekTarget) <=
              SEEK_CONFIRM_TOLERANCE_SECONDS;
            const seekGuardExpired = now > localSeekGuardUntil;
            if (matchedSeek || seekGuardExpired) {
              localSeekTarget = null;
              localSeekGuardUntil = 0;
            }
          }

          // Batch state updates for better performance
          setState({
            currentTime: newTime,
            isLoading: false,
            isSeeking: false,
          });

          if (state.playing) {
            setBufferingState(false);
          }

          // Report progress to Jellyfin every 3 seconds
          if (now - lastProgressReportTime >= 3000 && jf.api) {
            lastProgressReportTime = now;
            try {
              const playstateApi = getPlaystateApi(jf.api);
              await playstateApi.reportPlaybackProgress({
                playbackProgressInfo: {
                  ItemId: currentItemId,
                  PlaySessionId: playSessionId,
                  PositionTicks: Math.floor(Number(newTime) * 10_000_000),
                  IsPaused: !state.playing,
                  IsMuted: state.isMuted,
                  VolumeLevel: Math.min(state.volume, 100),
                  CanSeek: true,
                  PlayMethod: PlayMethod.DirectStream,
                  AudioStreamIndex:
                    state.audioIndex >= 0 ? state.audioIndex : undefined,
                  SubtitleStreamIndex:
                    state.subtitleIndex > 0 ? state.subtitleIndex : undefined,
                },
              });
            } catch (_error) {
              // Do nothing
            }
          }
        })
      ))
    ) {
      return;
    }

    if (
      !(await registerListener(
        events.playBackStateChange.listen(({ payload }) => {
          const isPaused = payload.pause;
          setState("playing", !isPaused);
          setVideoState("pause", isPaused);
          if (!isPaused) {
            setBufferingState(false);
          }
        })
      ))
    ) {
      return;
    }

    if (
      !(await registerListener(
        events.audioTrackChange.listen(async ({ payload }) => {
          setState("audioList", payload.tracks as Track[]);
          if (state.audioIndex > -1) {
            return;
          }
          const defaultAudio = (payload.tracks as Track[]).find((track) =>
            DEFAULT_AUDIO_LANG.includes(track.lang ?? "")
          );
          if (defaultAudio) {
            await commands.playbackChangeAudio(defaultAudio.id.toString());
            setState("audioIndex", defaultAudio.id as number);
          } else if ((payload.tracks as Track[]).length > 0) {
            await commands.playbackChangeAudio(
              state.audioList[0].id.toString()
            );
            setState("audioIndex", state.audioList[0].id);
          }
        })
      ))
    ) {
      return;
    }

    if (
      !(await registerListener(
        events.subtitleTrackChange.listen(async ({ payload }) => {
          setState("subtitleList", payload.tracks as Track[]);
          if (state.subtitleIndex > -1) {
            return;
          }
          const defaultSubtitle = (payload.tracks as Track[]).find((track) =>
            DEFAULT_SUBTITLE_LANG.includes(track.lang ?? "")
          );
          if (defaultSubtitle) {
            await commands.playbackChangeSubtitle(
              defaultSubtitle.id.toString()
            );
            setState("subtitleIndex", defaultSubtitle.id);
          } else if ((payload.tracks as Track[]).length > 0) {
            await commands.playbackChangeSubtitle(
              state.subtitleList[0].id.toString()
            );
            setState("subtitleIndex", state.subtitleList[0].id);
          }
        })
      ))
    ) {
      return;
    }

    if (
      !(await registerListener(
        events.audioChangeEvent.listen(({ payload }) => {
          setState("audioIndex", Number(payload.index));
        })
      ))
    ) {
      return;
    }

    if (
      !(await registerListener(
        events.subtitleChangeEvent.listen(({ payload }) => {
          setState("subtitleIndex", Number(payload.index));
        })
      ))
    ) {
      return;
    }

    if (
      !(await registerListener(
        events.speedEventChange.listen(({ payload }) => {
          setState("playbackSpeed", Number(payload.speed));
        })
      ))
    ) {
      return;
    }

    // Cache and buffering event listeners with debouncing
    let cacheUpdateTimeout: NodeJS.Timeout;
    if (
      !(await registerListener(
        events.cacheTimeChange.listen(({ payload }) => {
          const currentTime = Number(state.currentTime);
          const bufferedDuration = Number(payload.time);

          // Debounce cache updates to prevent excessive re-renders
          clearTimeout(cacheUpdateTimeout);
          cacheUpdateTimeout = setTimeout(() => {
            setState(
              "bufferedTime",
              Math.max(0, currentTime + bufferedDuration)
            );

            // Update loading state based on buffer
            if (state.isLoading && bufferedDuration > 0) {
              setState("isLoading", false);
            }
          }, 100);
        })
      ))
    ) {
      return;
    }

    if (
      !(await registerListener(
        events.bufferingStateChange.listen(({ payload }) => {
          const percentage = Number(payload.buffered);
          const clampedPercentage = Math.max(0, Math.min(100, percentage));
          const previousPercentage = state.bufferingPercentage;

          // Only update if percentage changed significantly to reduce re-renders
          if (Math.abs(clampedPercentage - previousPercentage) > 1) {
            setState("bufferingPercentage", clampedPercentage);
          }

          const transitionedToEmptyBuffer =
            clampedPercentage === 0 && previousPercentage > 0;

          const shouldShowBuffering =
            (clampedPercentage > 0 && clampedPercentage < 100
              ? true
              : transitionedToEmptyBuffer) &&
            state.playing &&
            !state.isLoading &&
            !state.isSeeking;

          setBufferingState(shouldShowBuffering);
        })
      ))
    ) {
      return;
    }

    if (
      !(await registerListener(
        events.pauseForCacheChange.listen(({ payload }) => {
          const isPaused = payload.pause;

          setBufferingState(isPaused);

          // Show controls when paused for cache
          if (isPaused) {
            setState("isLoading", false);
            showControls();
          }
        })
      ))
    ) {
      return;
    }

    if (
      !(await registerListener(
        events.errorEventChange.listen(({ payload }) => {
          let message = "Playback failed";
          if (typeof payload?.message === "string") {
            message = String(payload.message);
          }

          setState("playbackError", message);
          setState("isLoading", false);
          setBufferingState(false, 0);
          showControls();
        })
      ))
    ) {
      return;
    }

    if (setupVersion === listenerSetupVersion) {
      unlistenFuncs = nextUnlistenFuncs;
    }
  });

  const offFullscreenIfOnWhenCleanup = async () => {
    const window = getCurrentWindow();
    if (await window.isFullscreen()) {
      commands.toggleFullscreen();
    }
  };

  onCleanup(async () => {
    listenerSetupVersion++;
    const itemId = state.currentItemId;
    const currentTime = state.currentTime;
    const ownsActivePlaybackSession =
      videoContext.activePlaybackSessionId === playbackSessionId;
    const isPipActive = await syncPipVisibility().catch(() => false);

    if (!isPipActive && ownsActivePlaybackSession) {
      setVideoState("pause", true);
    }

    resetTransientUiState();
    offFullscreenIfOnWhenCleanup();
    if (!isPipActive) {
      await clearPlaybackIfActiveSession();
    }
    unlistenFuncs.forEach((unlisten) => {
      unlisten();
    });
    clearHideControlsTimeout();
    clearTimeout(seekGuardTimeout);
    clearTimeout(bufferingResetTimeout);
    removeControlInteractionListeners();

    // Report playback stopped to Jellyfin
    if (jf.api) {
      try {
        const playstateApi = getPlaystateApi(jf.api);
        await playstateApi.reportPlaybackStopped({
          playbackStopInfo: {
            ItemId: itemId,
            PlaySessionId: playSessionId,
            PositionTicks: Math.floor(Number(currentTime) * 10_000_000),
          },
        });
      } catch (_error) {
        // Do nothing
      }
    }
  });

  const onEndOfFile = async () => {
    if (!jf.api) {
      return;
    }

    const playstateApi = getPlaystateApi(jf.api);
    await playstateApi.reportPlaybackStopped({
      playbackStopInfo: {
        ItemId: itemId(),
        PlaySessionId: playSessionId,
        PositionTicks: Math.floor(Number(state.currentTime) * 10_000_000),
      },
    });
  };

  return {
    state,
    setState,
    openPanel,
    setOpenPanel,
    showControls,
    toggleControlsLock,
    togglePlay,
    toggleMute,
    handleVolumeChange,
    setSpeed,
    handleProgressClick,
    handleOpenPip,
    loadNewVideo,
    handleControlMouseEnter,
    handleControlMouseLeave,
    handleControlInteractionStart,
    navigateToChapter,
    // OSD and help functions
    showOSD,
    hideOSD,
    toggleHelp,
    updateLoadingStage,
    updateNetworkQuality,
    updateBufferHealth,
    resetTransientUiState,
    clearPlaybackError,
    retryPlayback,
    onEndOfFile,
  };
}
