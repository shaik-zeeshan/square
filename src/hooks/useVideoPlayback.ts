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
import { useVideoContext } from "~/contexts/video-context";
import { useRuntime } from "~/effect/runtime/use-runtime";
import { AuthService } from "~/effect/services/auth";
import type { WithImage } from "~/effect/services/jellyfin/service";
import {
  findTrackByLanguage,
  normalizeLanguageCode,
  resolveLanguagePreferences,
  SUBTITLE_OFF,
} from "~/lib/playback-language-preferences";
import { useAppPreferences } from "~/lib/store-hooks";
import { commands, events } from "~/lib/tauri";

type ItemDetails = WithImage<BaseItemDto> | undefined;

/**
 * Returns true only when `url` is a canonical Jellyfin subtitle stream URL
 * for the given item/mediaSource, i.e. it matches:
 *   /Videos/{itemId}/{mediaSourceId}/Subtitles/{index}/Stream.{ext}
 * A loose `/Subtitles/` check could accept unrelated or filesystem-backed
 * URLs that mpv cannot fetch directly.
 */
function isCanonicalSubtitleStreamUrl(
  url: string,
  itemId: string,
  mediaSourceId: string
): boolean {
  if (!url) {
    return false;
  }
  if (!itemId) {
    return false;
  }
  if (!mediaSourceId) {
    return false;
  }
  // Escape special regex chars in the dynamic segments.
  const escId = itemId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escSrc = mediaSourceId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `/Videos/${escId}/${escSrc}/Subtitles/\\d+/Stream\\.[^/?#]+`,
    "i"
  );
  return re.test(url);
}

/**
 * Returns a copy of `url` with sensitive query parameters redacted for safe
 * diagnostic logging.  Currently redacts `api_key`; the path and all other
 * query params are preserved so logs remain useful.
 */
function redactUrlForLog(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("api_key")) {
      parsed.searchParams.set("api_key", "[REDACTED]");
    }
    return parsed.toString();
  } catch {
    // Not a valid absolute URL – return as-is (no sensitive param expected).
    return url;
  }
}

export function useVideoPlayback(
  itemId: () => string,
  itemDetails: () => ItemDetails
) {
  const runtime = useRuntime();
  const jf = runtime.runSync(
    Effect.gen(function* () {
      const auth = yield* AuthService;
      const api = yield* auth.getApi();
      const user = yield* auth.getUser();
      return { api, userId: user.Id };
    })
  );

  const { store: appPrefs, setStore: setAppPrefs } = useAppPreferences();

  /**
   * Returns the SeriesId when the current item is an episode, else undefined.
   * Only returns a value when `itemDetails()` actually corresponds to the
   * active playback item, preventing stale metadata during fast transitions.
   */
  const getSeriesId = (): string | undefined => {
    const details = itemDetails();
    if (!details?.Id || details.Id !== state.currentItemId) {
      return;
    }
    if (details.Type === "Episode" && details.SeriesId) {
      return details.SeriesId;
    }
  };

  /** Persist a per-series language override (episodes only).
   *  If metadata isn't current yet, queue the save for later. */
  const saveSeriesOverride = (
    field: "audioLanguage" | "subtitleLanguage",
    value: string
  ) => {
    if (!isMetadataCurrent()) {
      // Queue the save – it will be flushed when metadata arrives
      pendingSeriesSaves.push({
        field,
        value,
        forItemId: state.currentItemId,
      });
      return;
    }
    const seriesId = getSeriesId();
    if (!seriesId) {
      return;
    }
    const existing = appPrefs.seriesLanguageOverrides[seriesId] ?? {};
    setAppPrefs("seriesLanguageOverrides", seriesId, {
      ...existing,
      [field]: value,
    });
  };

  /**
   * Centralized manual audio-track selection.
   * Used by both panel click-handlers and keyboard shortcuts.
   */
  const selectAudioTrack = async (track: Track) => {
    audioIsManual = true;
    await commands.playbackChangeAudio(track.id.toString());
    setState("audioIndex", track.id);
    // Persist per-series override when the track has a language code
    const lang = normalizeLanguageCode(track.lang);
    if (lang) {
      saveSeriesOverride("audioLanguage", lang);
    }
  };

  /**
   * Centralized manual subtitle-track selection.
   * Pass null (or a track with id 0) to turn subtitles off.
   */
  const selectSubtitleTrack = async (track: Track | null) => {
    if (!track || track.id === 0) {
      subtitleIsManual = true;
      await commands.playbackChangeSubtitle("0");
      setState("subtitleIndex", 0);
      saveSeriesOverride("subtitleLanguage", SUBTITLE_OFF);
      return;
    }
    subtitleIsManual = true;
    await commands.playbackChangeSubtitle(track.id.toString());
    setState("subtitleIndex", track.id);
    const lang = normalizeLanguageCode(track.lang);
    if (lang) {
      saveSeriesOverride("subtitleLanguage", lang);
    }
  };

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
  let lastConfirmedPlaybackProgressAt = 0;
  let pausedForCache = false;
  let lastWrittenTime = 0; // last parsedTime written to store
  const TIME_WRITE_THRESHOLD = 0.25; // seconds – coalesce smaller deltas

  const removeControlInteractionListeners = () => {
    window.removeEventListener("pointerup", handleControlInteractionEnd);
    window.removeEventListener("pointercancel", handleControlInteractionEnd);
  };

  const SEEK_GUARD_MS = 900;
  const SEEK_CONFIRM_TOLERANCE_SECONDS = 1.5;
  const BUFFERING_PROGRESS_GRACE_MS = 1500;

  // Jellyfin playback reporting
  const playSessionId = crypto.randomUUID();
  let lastProgressReportTime = 0;

  const shouldPreventControlsAutoHide = () =>
    state.controlsLocked ||
    state.isHoveringControls ||
    state.isInteractingControls;

  const hasRecentPlaybackProgress = () =>
    Date.now() - lastConfirmedPlaybackProgressAt < BUFFERING_PROGRESS_GRACE_MS;

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
    lastConfirmedPlaybackProgressAt = 0;
    pausedForCache = false;
    setState("url", url);
    setState("currentItemId", newItemId);
    setState("currentTime", "0");
    setState("duration", 0);
    setState("playing", true);
    // Reset track indices so language-preference resolution runs fresh for the new item
    setState("audioIndex", -1);
    setState("subtitleIndex", -1);
    // Clear stale track lists from the previous item
    setState("audioList", []);
    setState("subtitleList", []);
    resetLanguageResolutionState();
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

  // --- Per-item language-resolution state ---
  // Whether the current audio/subtitle selection was made manually by the user
  // (as opposed to automatic startup resolution).
  let audioIsManual = false;
  let subtitleIsManual = false;
  // Whether automatic startup resolution has been finalized with current metadata
  // (i.e. itemDetails().Id === state.currentItemId).
  let audioStartupFinalized = false;
  let subtitleStartupFinalized = false;
  // Whether external subtitle injection has already been performed for this item.
  let externalSubtitlesLoaded = false;
  // Whether mpv has fired FileLoaded for the current item (guards against pre-load injection).
  // biome-ignore lint/style/useConst: mutated by FileLoaded handler and reset on item change
  let fileLoadedForCurrentItem = false;
  // Queued manual per-series saves to flush once metadata is ready.
  // Each entry records the field, value, and the itemId it was intended for.
  let pendingSeriesSaves: Array<{
    field: "audioLanguage" | "subtitleLanguage";
    value: string;
    forItemId: string;
  }> = [];

  /** Returns true when itemDetails() is loaded and matches the active item. */
  const isMetadataCurrent = (): boolean => {
    const details = itemDetails();
    return !!details?.Id && details.Id === state.currentItemId;
  };

  /** Flush any queued manual per-series saves whose itemId still matches. */
  const flushPendingSeriesSaves = () => {
    const toFlush = pendingSeriesSaves;
    pendingSeriesSaves = [];
    const seriesId = getSeriesId();
    if (!seriesId) {
      return;
    }
    for (const entry of toFlush) {
      if (entry.forItemId !== state.currentItemId) {
        continue;
      }
      const existing = appPrefs.seriesLanguageOverrides[seriesId] ?? {};
      setAppPrefs("seriesLanguageOverrides", seriesId, {
        ...existing,
        [entry.field]: entry.value,
      });
    }
  };

  /** Reset all per-item language resolution flags (call on item change). */
  const resetLanguageResolutionState = () => {
    audioIsManual = false;
    subtitleIsManual = false;
    audioStartupFinalized = false;
    subtitleStartupFinalized = false;
    externalSubtitlesLoaded = false;
    fileLoadedForCurrentItem = false;
    pendingSeriesSaves = [];
  };

  // Persisted per-session media source anchors – set during playback startup
  // and reused for subtitle injection and playback reporting.
  let activeMediaSourceId: string | undefined;
  let activeLiveStreamId: string | undefined;

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

    // Reset media-source anchors for this new item before fetching.
    activeMediaSourceId = undefined;
    activeLiveStreamId = undefined;

    lastConfirmedPlaybackProgressAt = 0;
    pausedForCache = false;
    setState("currentItemId", currentItemId);
    setState("currentTime", "0");
    setState("duration", 0);
    setState("playbackError", null);
    // Reset track indices so language-preference resolution runs fresh for the new item
    setState("audioIndex", -1);
    setState("subtitleIndex", -1);
    // Clear stale track lists from the previous item
    setState("audioList", []);
    setState("subtitleList", []);
    resetLanguageResolutionState();

    // Stale-guard helper: returns true when a newer effect run has started,
    // meaning this run must stop issuing player commands immediately.
    const isStale = () => thisLoad !== loadVersion;

    // Fetch playback info to obtain the chosen MediaSourceId (and LiveStreamId)
    // so the video stream URL and subtitle injection both reference the same source.
    let mediaSourceId: string | undefined;
    let liveStreamId: string | undefined;
    try {
      const { getMediaInfoApi } = await import(
        "@jellyfin/sdk/lib/utils/api/media-info-api"
      );
      const res = await getMediaInfoApi(jf.api).getPlaybackInfo({
        itemId: currentItemId,
        userId: jf.userId ?? undefined,
      });
      if (!isStale()) {
        const source = res.data?.MediaSources?.[0];
        mediaSourceId = source?.Id ?? undefined;
        liveStreamId = source?.LiveStreamId ?? undefined;
        activeMediaSourceId = mediaSourceId;
        activeLiveStreamId = liveStreamId;
      }
    } catch (_e) {
      // Playback-info unavailable; fall back to URL without media-source params.
    }

    if (isStale()) {
      return;
    }

    const msParam = mediaSourceId
      ? `&MediaSourceId=${encodeURIComponent(mediaSourceId)}`
      : "";
    const lsParam =
      liveStreamId && mediaSourceId
        ? `&LiveStreamId=${encodeURIComponent(liveStreamId)}`
        : "";
    const url = `${basePath}/Videos/${currentItemId}/Stream?api_key=${token}&container=mp4&static=true${msParam}${lsParam}`;

    setState("url", url);

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

  // Re-resolve language preferences and flush queued saves once metadata arrives.
  // This handles the case where track events fired before itemDetails() was current.

  /**
   * Inject external subtitle streams into mpv for the given item details.
   * Called once per playback startup, gated by both `externalSubtitlesLoaded` and
   * `fileLoadedForCurrentItem` so it never fires before mpv has actually loaded the file.
   * The item details object is passed explicitly so the function is not reactive.
   */
  const doInjectExternalSubtitles = async (
    details: NonNullable<ItemDetails>
  ): Promise<void> => {
    if (externalSubtitlesLoaded) {
      return;
    }
    externalSubtitlesLoaded = true;
    const injectionItemId = details.Id;
    if (!jf.api) {
      return;
    }
    if (!jf.userId) {
      return;
    }
    if (!injectionItemId) {
      return;
    }
    try {
      const { getMediaInfoApi } = await import(
        "@jellyfin/sdk/lib/utils/api/media-info-api"
      );
      const res = await getMediaInfoApi(jf.api).getPlaybackInfo({
        itemId: injectionItemId,
        userId: jf.userId,
      });
      // Abort if the active item changed while the request was in-flight.
      if (state.currentItemId !== injectionItemId) {
        return;
      }
      // Prefer the media source whose Id matches the one chosen during
      // playback startup (activeMediaSourceId).  Fall back to index 0 only
      // when no anchor is available so that the previous behaviour is
      // preserved for edge cases where playback-info was unavailable.
      const sources = res.data?.MediaSources ?? [];
      const activeSource =
        (activeMediaSourceId
          ? sources.find((s) => s.Id === activeMediaSourceId)
          : undefined) ?? sources[0];
      const basePath = jf.api.basePath ?? "";
      const token = jf.api.accessToken ?? "";
      const subtitleSourceId =
        activeSource?.Id ?? activeMediaSourceId ?? "";
      for (const stream of activeSource?.MediaStreams ?? []) {
        if (stream.Type !== "Subtitle" || !stream.IsExternal) {
          continue;
        }
        // Use DeliveryUrl only when it is a canonical Jellyfin subtitle
        // stream URL for the active item/mediaSource.  Loose checks (e.g.
        // just looking for "/Subtitles/" anywhere) could accept
        // filesystem-backed or unrelated URLs that mpv cannot fetch.
        const deliveryUrl = (stream as { DeliveryUrl?: string }).DeliveryUrl;
        const useDeliveryUrl =
          typeof deliveryUrl === "string" &&
          isCanonicalSubtitleStreamUrl(
            deliveryUrl,
            details.Id ?? "",
            subtitleSourceId
          );
        let url: string;
        if (useDeliveryUrl && typeof deliveryUrl === "string") {
          url = deliveryUrl.startsWith("/")
            ? `${basePath}${deliveryUrl}`
            : deliveryUrl;
        } else {
          if (stream.Index == null || !subtitleSourceId || !details.Id) {
            continue;
          }
          const SUBTITLE_CODEC_TO_EXT: Record<string, string> = {
            subrip: "srt",
            webvtt: "vtt",
            srt: "srt",
            vtt: "vtt",
            ass: "ass",
            ssa: "ssa",
            pgs: "sup",
            dvd_subtitle: "sub",
            hdmv_pgs_subtitle: "sup",
          };
          const codec = stream.Codec ?? "srt";
          const format = SUBTITLE_CODEC_TO_EXT[codec.toLowerCase()] ?? codec;
          url = `${basePath}/Videos/${details.Id}/${subtitleSourceId}/Subtitles/${stream.Index}/Stream.${format}?api_key=${token}`;
        }
        // Re-check staleness before each individual sub-add command.
        if (state.currentItemId !== injectionItemId) {
          break;
        }

        // Build a human-friendly track title for the subtitle dropdown.
        // Prefer DisplayTitle (e.g. "English (SRT)"), fall back to Language, then Title.
        const subtitleTitle: string | undefined =
          (stream as { DisplayTitle?: string }).DisplayTitle ||
          stream.Language ||
          stream.Title ||
          undefined;
        const subtitleLang: string | undefined =
          stream.Language || undefined;

        // --- Diagnostics: log context for every attempted subtitle load ---
        const diagCodec = stream.Codec ?? "unknown";
        const subtitleIndex = stream.Index ?? -1;
        const urlSource = useDeliveryUrl ? "DeliveryUrl" : "constructed";
        // biome-ignore lint/suspicious/noConsole: subtitle diagnostics
        console.debug(
          "[subtitle-inject] itemId=%s mediaSourceId=%s index=%d codec=%s source=%s title=%s lang=%s url=%s",
          injectionItemId,
          subtitleSourceId,
          subtitleIndex,
          diagCodec,
          urlSource,
          subtitleTitle ?? "(none)",
          subtitleLang ?? "(none)",
          redactUrlForLog(url)
        );

        // Lightweight app-side reachability check (HEAD, fallback GET).
        // Diagnostics only – a failing check does NOT prevent the load.
        // A 5-second timeout prevents a slow/hanging URL from delaying
        // the subsequent playbackLoadSubtitle call beyond a short bound.
        try {
          const validationAbort = new AbortController();
          const validationTimeout = setTimeout(
            () => validationAbort.abort(),
            5000
          );
          let validationRes: Response;
          try {
            validationRes = await fetch(url, {
              method: "HEAD",
              // Credentials are embedded in the URL via api_key; no cookies needed.
              credentials: "omit",
              signal: validationAbort.signal,
            });
            // Some servers don't support HEAD; retry with GET + short range.
            if (
              validationRes.status === 405 ||
              validationRes.status === 501
            ) {
              validationRes = await fetch(url, {
                method: "GET",
                headers: { Range: "bytes=0-0" },
                credentials: "omit",
                signal: validationAbort.signal,
              });
            }
          } finally {
            clearTimeout(validationTimeout);
          }
          if (!validationRes.ok && validationRes.status !== 206) {
            // biome-ignore lint/suspicious/noConsole: subtitle diagnostics
            console.warn(
              "[subtitle-inject] Validation failed: itemId=%s index=%d status=%d url=%s",
              injectionItemId,
              subtitleIndex,
              validationRes.status,
              redactUrlForLog(url)
            );
          }
        } catch (validationErr) {
          // biome-ignore lint/suspicious/noConsole: subtitle diagnostics
          console.warn(
            "[subtitle-inject] Validation error: itemId=%s index=%d err=%s url=%s",
            injectionItemId,
            subtitleIndex,
            validationErr instanceof Error
              ? validationErr.message
              : String(validationErr),
            redactUrlForLog(url)
          );
        }

        try {
          await commands.playbackLoadSubtitle(url, subtitleTitle, subtitleLang);
        } catch (_e) {
          // Skip – mpv may reject unsupported formats or stale URLs.
        }
      }
    } catch (_e) {
      // Playback info fetch failed; external subtitles unavailable.
    }
  };

  createEffect(async () => {
    const details = itemDetails();
    if (!details?.Id || details.Id !== state.currentItemId) {
      return;
    }

    // Flush any queued manual per-series saves now that we know the series.
    flushPendingSeriesSaves();

    // Re-resolve audio startup if it wasn't finalized with current metadata
    // and the user hasn't manually changed it.
    if (
      !(audioStartupFinalized || audioIsManual) &&
      state.audioList.length > 0
    ) {
      const resolved = resolveLanguagePreferences(appPrefs, getSeriesId());
      const preferred = findTrackByLanguage(
        state.audioList,
        resolved.audioLanguage
      );
      if (preferred) {
        await commands.playbackChangeAudio(preferred.id.toString());
        setState("audioIndex", preferred.id as number);
      }
      audioStartupFinalized = true;
    }

    // Re-resolve subtitle startup if it wasn't finalized with current metadata
    // and the user hasn't manually changed it.
    if (
      !(subtitleStartupFinalized || subtitleIsManual) &&
      state.subtitleList.length > 0
    ) {
      const resolved = resolveLanguagePreferences(appPrefs, getSeriesId());
      if (resolved.subtitleLanguage === SUBTITLE_OFF) {
        await commands.playbackChangeSubtitle("0");
        setState("subtitleIndex", 0);
      } else {
        const preferred = findTrackByLanguage(
          state.subtitleList,
          resolved.subtitleLanguage
        );
        if (preferred) {
          await commands.playbackChangeSubtitle(preferred.id.toString());
          setState("subtitleIndex", preferred.id);
        }
      }
      subtitleStartupFinalized = true;
    }

    // Inject external subtitle tracks into mpv once per item startup, but only
    // after mpv has confirmed the file is loaded (fileLoadedForCurrentItem).
    // This avoids a startup race where sub-add is issued before mpv is ready.
    if (!externalSubtitlesLoaded && fileLoadedForCurrentItem) {
      await doInjectExternalSubtitles(details);
    }
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

          // Mark that mpv has loaded the file for the current item.
          // This unblocks external subtitle injection which must not happen
          // before the file is ready (race condition otherwise).
          fileLoadedForCurrentItem = true;
          // If item metadata is already available, inject external subtitles now.
          // Otherwise the createEffect watching itemDetails() will trigger once
          // metadata arrives and fileLoadedForCurrentItem is already true.
          const loadedDetails = itemDetails();
          if (
            loadedDetails?.Id &&
            loadedDetails.Id === state.currentItemId &&
            !externalSubtitlesLoaded
          ) {
            // Fire-and-forget; errors are caught inside doInjectExternalSubtitles.
            doInjectExternalSubtitles(loadedDetails).catch((_e) => {
              // Subtitle injection errors are non-fatal.
            });
          }

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
                MediaSourceId: activeMediaSourceId,
                LiveStreamId: activeLiveStreamId,
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

          const previousTime = Number(state.currentTime);
          const hasPlaybackProgress =
            Number.isNaN(previousTime) ||
            Math.abs(parsedTime - previousTime) > 0.01;

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

          if (hasPlaybackProgress) {
            lastConfirmedPlaybackProgressAt = now;
          }

          // Only write currentTime to store when the delta is meaningful
          // to reduce reactive re-renders on high-frequency events.
          const timeDelta = Math.abs(parsedTime - lastWrittenTime);
          const seekJustConfirmed = localSeekTarget === null && state.isSeeking;
          if (
            timeDelta >= TIME_WRITE_THRESHOLD ||
            seekJustConfirmed ||
            state.isLoading
          ) {
            lastWrittenTime = parsedTime;
            setState({
              currentTime: newTime,
              isLoading: false,
              isSeeking: false,
            });
          } else {
            // Still clear transient flags even when skipping time write
            if (state.isLoading) {
              setState("isLoading", false);
            }
            if (state.isSeeking) {
              setState("isSeeking", false);
            }
          }

          if (state.playing && hasPlaybackProgress) {
            pausedForCache = false;
            setBufferingState(false, 0);
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
                  MediaSourceId: activeMediaSourceId,
                  LiveStreamId: activeLiveStreamId,
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
          const tracks = payload.tracks as Track[];
          setState("audioList", tracks);
          if (audioIsManual) {
            return;
          }
          // Resolve preferred language: per-series > global > fallback
          // If metadata isn't current yet, getSeriesId() returns undefined
          // so we get global defaults; we'll re-resolve once metadata arrives.
          const metadataReady = isMetadataCurrent();
          const resolved = resolveLanguagePreferences(appPrefs, getSeriesId());
          const preferred = findTrackByLanguage(tracks, resolved.audioLanguage);
          if (preferred) {
            await commands.playbackChangeAudio(preferred.id.toString());
            setState("audioIndex", preferred.id as number);
          } else if (tracks.length > 0) {
            await commands.playbackChangeAudio(tracks[0].id.toString());
            setState("audioIndex", tracks[0].id);
          }
          audioStartupFinalized = metadataReady;
        })
      ))
    ) {
      return;
    }

    if (
      !(await registerListener(
        events.subtitleTrackChange.listen(async ({ payload }) => {
          const tracks = payload.tracks as Track[];
          setState("subtitleList", tracks);
          if (subtitleIsManual) {
            return;
          }
          // Resolve preferred language: per-series > global > fallback
          const metadataReady = isMetadataCurrent();
          const resolved = resolveLanguagePreferences(appPrefs, getSeriesId());
          // If preference is SUBTITLE_OFF, leave subtitles off
          if (resolved.subtitleLanguage === SUBTITLE_OFF) {
            await commands.playbackChangeSubtitle("0");
            setState("subtitleIndex", 0);
            subtitleStartupFinalized = metadataReady;
            return;
          }
          const preferred = findTrackByLanguage(
            tracks,
            resolved.subtitleLanguage
          );
          if (preferred) {
            await commands.playbackChangeSubtitle(preferred.id.toString());
            setState("subtitleIndex", preferred.id);
          }
          subtitleStartupFinalized = metadataReady;
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
          const hasActivePlaybackProgress = hasRecentPlaybackProgress();

          const shouldShowBuffering =
            ((clampedPercentage > 0 && clampedPercentage < 100
              ? true
              : transitionedToEmptyBuffer) &&
              !hasActivePlaybackProgress) ||
            pausedForCache;

          setBufferingState(
            shouldShowBuffering &&
              state.playing &&
              !state.isLoading &&
              !state.isSeeking
          );
        })
      ))
    ) {
      return;
    }

    if (
      !(await registerListener(
        events.pauseForCacheChange.listen(({ payload }) => {
          const isPaused = payload.pause;
          pausedForCache = isPaused;

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
            MediaSourceId: activeMediaSourceId,
            LiveStreamId: activeLiveStreamId,
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
        MediaSourceId: activeMediaSourceId,
        LiveStreamId: activeLiveStreamId,
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
    // Centralized track selection (manual)
    selectAudioTrack,
    selectSubtitleTrack,
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
