import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { type RouteSectionProps, useNavigate } from "@solidjs/router";
import { AlertTriangle, ArrowLeft, Eye, EyeOff, RefreshCw } from "lucide-solid";
import { createEffect, onCleanup, Show, splitProps } from "solid-js";
import {
  AutoplayOverlay,
  BufferingIndicator,
  KeyboardShortcutsHelp,
  LoadingSpinner,
  OpenInIINAButton,
  OSD,
  VideoControls,
  VideoInfoOverlay,
  VideoSettingsPanels,
} from "~/components/video";
import { useVideoContext } from "~/contexts/video-context";
import { JellyfinOperations } from "~/effect/services/jellyfin/operations";
import type { WithImage } from "~/effect/services/jellyfin/service";
import { useAutoplay } from "~/hooks/useAutoplay";
import { useVideoKeyboardShortcuts } from "~/hooks/useVideoKeyboardShortcuts";
import { useVideoPlayback } from "~/hooks/useVideoPlayback";
import { commands } from "~/lib/tauri";

export default function Page(props: RouteSectionProps) {
  const [{ params: routeParams }] = splitProps(props, ["params"]);
  const navigate = useNavigate();

  const itemDetails = JellyfinOperations.getItem(
    () => routeParams.id,
    {
      fields: ["Overview", "ParentId"],
    },
    () => ({
      enabled: !!routeParams.id,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })
  );

  const seriesDetails = JellyfinOperations.getItem(
    () => itemDetails.data?.SeriesId as string,
    {
      fields: ["ParentId"],
    },
    () => ({
      enabled:
        !!itemDetails.data?.SeriesId && itemDetails.data?.Type === "Episode",
      refetchOnWindowFocus: false,
    })
  );

  // Use the custom hook for playback state management
  const {
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
    handleControlMouseEnter,
    handleControlMouseLeave,
    handleControlInteractionStart,
    navigateToChapter,
    showOSD,
    hideOSD,
    toggleHelp,
    retryPlayback,
    onEndOfFile,
    resetTransientUiState,
  } = useVideoPlayback(
    () => routeParams.id,
    () => itemDetails.data
  );

  const [videoContext] = useVideoContext();

  const exitPlayer = () => {
    resetTransientUiState();
    if (!videoContext.isPip) {
      commands.playbackClear();
    }
    navigate(-1);
  };

  onCleanup(() => {
    resetTransientUiState();
  });

  // Use autoplay hook - don't destructure to maintain reactivity
  const autoplayHook = useAutoplay({
    currentItem: () => itemDetails.data,
    onEndOfFile,
    playbackState: {
      currentTime: () => state.currentTime,
      duration: () => state.duration,
      paused: () => !state.playing,
    },
  });

  let audioBtnRef!: HTMLButtonElement;
  let subsBtnRef!: HTMLButtonElement;
  let speedBtnRef!: HTMLButtonElement;
  let panelRef!: HTMLDivElement;
  const setPanelRef = (el: HTMLDivElement) => {
    panelRef = el;
  };

  // Use keyboard shortcuts hook
  useVideoKeyboardShortcuts({
    state,
    openPanel,
    setOpenPanel,
    togglePlay,
    toggleMute,
    handleVolumeChange,
    setSpeed,
    showControls,
    navigateToChapter,
    toggleHelp,
    isHelpOpen: () => state.showHelp,
    showOSD,
    handleOpenPip,
  });

  // Close panel when clicking outside
  createEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!panelRef) {
        return;
      }
      const t = e.target as Node;
      if (panelRef.contains(t)) {
        return;
      }
      if (audioBtnRef?.contains(t)) {
        return;
      }
      if (subsBtnRef?.contains(t)) {
        return;
      }
      if (speedBtnRef?.contains(t)) {
        return;
      }
      setOpenPanel(null);
    };
    document.addEventListener("mousedown", onDown);
    onCleanup(() => document.removeEventListener("mousedown", onDown));
  });

  // Ctrl+scroll for volume control
  createEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -5 : 5;
        const newVolume = Math.max(0, Math.min(200, state.volume + delta));
        handleVolumeChange(newVolume);
        showControls();
      }
    };
    document.addEventListener("wheel", handleWheel, { passive: false });
    onCleanup(() => document.removeEventListener("wheel", handleWheel));
  });

  const isInsideControlSurface = (target: EventTarget | null) => {
    if (!(target instanceof Element)) {
      return false;
    }

    return (
      panelRef?.contains(target) ||
      audioBtnRef?.contains(target) ||
      subsBtnRef?.contains(target) ||
      speedBtnRef?.contains(target) ||
      target.classList.contains("control-element") ||
      !!target.closest(".control-element")
    );
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (state.controlsLocked) {
      return;
    }

    if (isInsideControlSurface(e.target)) {
      handleControlMouseEnter();
      return;
    }

    handleControlMouseLeave();
    showControls();
  };

  const handlePointerDown = (e: PointerEvent) => {
    if (isInsideControlSurface(e.target)) {
      handleControlInteractionStart();
    }
  };

  const handleWindowClick = (e: MouseEvent) => {
    const target = e.target;
    // Ignore clicks inside any control surface
    if (isInsideControlSurface(target)) {
      return;
    }

    if (state.showControls) {
      setState("showControls", false);
      commands.toggleTitlebarHide(true);
    } else {
      showControls();
    }
  };

  return (
    <div
      class="dark relative flex h-full w-full flex-col gap-2 overflow-hidden bg-transparent"
      onClick={handleWindowClick}
      onMouseMove={handleMouseMove}
      onPointerDown={handlePointerDown}
      role="button"
    >
      {/* ── Initial Loading Overlay ── */}
      <Show when={state.isLoading}>
        <div class="absolute inset-0 z-50 flex items-center justify-center bg-[#080c16]/95 backdrop-blur-[2px]">
          <div class="flex flex-col items-center gap-5">
            <LoadingSpinner
              loadingStage={state.loadingStage}
              progress={state.bufferingPercentage}
              size="lg"
              text="Loading video…"
            />
            <Show when={state.bufferingPercentage > 0}>
              {/* Blue progress bar */}
              <div class="h-[2px] w-44 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  class="h-full rounded-full bg-blue-400/70 transition-[width] duration-500"
                  style={{ width: `${state.bufferingPercentage}%` }}
                />
              </div>
              <span class="font-mono text-[11px] text-white/30 tabular-nums">
                {Math.round(state.bufferingPercentage)}%
              </span>
            </Show>
          </div>
        </div>
      </Show>

      {/* ── Buffering Overlay — only when not initial loading ── */}
      <Show
        when={state.isBuffering && !state.isLoading && !state.playbackError}
      >
        <BufferingIndicator
          bufferHealth={state.bufferHealth}
          bufferingPercentage={state.bufferingPercentage}
          isBuffering={state.isBuffering}
          networkQuality={state.networkQuality}
          showText
          variant="overlay"
        />
      </Show>

      {/* ── Playback Error Overlay ── */}
      <Show when={state.playbackError}>
        <div class="absolute inset-0 z-50 flex items-center justify-center bg-[#080c16]/85 backdrop-blur-sm">
          <div class="flex max-w-sm flex-col items-center gap-5 rounded-2xl border border-white/[0.08] bg-[#0d1220]/95 px-8 py-7 shadow-[0_24px_64px_rgba(0,0,0,0.8)]">
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/[0.12] ring-1 ring-red-500/25">
              <AlertTriangle class="h-6 w-6 text-red-400" />
            </div>
            <div class="text-center">
              <p class="font-semibold text-base text-white tracking-tight">
                Playback failed
              </p>
              <p class="mt-1.5 line-clamp-3 text-[13px] text-white/50 leading-relaxed">
                {state.playbackError}
              </p>
            </div>
            <div class="flex w-full gap-2.5">
              <button
                class="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 font-semibold text-black text-sm transition-opacity duration-150 hover:opacity-90 active:scale-[0.97]"
                onClick={(e) => {
                  e.stopPropagation();
                  retryPlayback();
                }}
              >
                <RefreshCw class="h-3.5 w-3.5" />
                Retry
              </button>
              <button
                class="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.05] px-4 py-2.5 font-medium text-sm text-white/65 transition-colors duration-150 hover:bg-white/[0.1] hover:text-white active:scale-[0.97]"
                onClick={(e) => {
                  e.stopPropagation();
                  exitPlayer();
                }}
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* ── Lock Button — always visible ── */}
      <button
        aria-label={
          state.controlsLocked ? "Unlock controls" : "Lock controls hidden"
        }
        class="control-element fixed top-6 right-4 z-50 rounded-full bg-[#0d1220]/70 p-2.5 text-white/70 shadow-[0_4px_16px_rgba(0,0,0,0.4)] ring-1 ring-white/[0.06] ring-inset transition-all duration-150 hover:bg-[#0d1220]/90 hover:text-white"
        onClick={(e) => {
          e.stopPropagation();
          toggleControlsLock();
        }}
      >
        <Show
          fallback={<Eye class="h-[18px] w-[18px]" />}
          when={state.controlsLocked}
        >
          <EyeOff class="h-[18px] w-[18px]" />
        </Show>
      </button>

      <Show when={state.showControls}>
        {/* ── Item Info Overlay ── */}
        <VideoInfoOverlay
          isStale={itemDetails.data?.Id !== routeParams.id}
          itemDetails={itemDetails}
          seriesDetails={seriesDetails}
        />

        {/* ── Bottom Controls ── */}
        <div
          class="control-element pointer-events-none fixed right-0 bottom-0 left-0 p-4"
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={(e) => {
            e.stopPropagation();
            handleControlMouseEnter();
          }}
          onMouseLeave={(e) => {
            e.stopPropagation();
            handleControlMouseLeave();
          }}
          role="group"
        >
          {/* Soft vignette gradient behind controls — deep navy */}
          <div class="pointer-events-none absolute right-0 bottom-0 left-0 h-60 bg-gradient-to-t from-[#080c16]/90 via-[#080c16]/30 to-transparent" />

          <div class="pointer-events-auto relative mx-auto flex w-full max-w-4xl flex-col gap-2.5">
            {/* Dropdown Panels */}
            <VideoSettingsPanels
              onNavigateToChapter={navigateToChapter}
              openPanel={openPanel()}
              panelRef={setPanelRef}
              setOpenPanel={setOpenPanel}
              setState={setState}
              state={state}
            />

            {/* Main Control Bar */}
            <VideoControls
              audioBtnRef={audioBtnRef}
              isPip={videoContext.isPip}
              onNavigateToChapter={navigateToChapter}
              onOpenPip={handleOpenPip}
              onProgressClick={handleProgressClick}
              onSetSpeed={setSpeed}
              onToggleMute={toggleMute}
              onTogglePlay={togglePlay}
              onVolumeChange={handleVolumeChange}
              openPanel={openPanel}
              setOpenPanel={setOpenPanel}
              speedBtnRef={speedBtnRef}
              state={state}
              subsBtnRef={subsBtnRef}
            />
          </div>
        </div>

        {/* ── Back Button ── */}
        <button
          class="control-element fixed top-6 left-4 z-50 rounded-full bg-[#0d1220]/70 p-2.5 text-white/70 shadow-[0_4px_16px_rgba(0,0,0,0.4)] ring-1 ring-white/[0.06] ring-inset transition-all duration-150 hover:bg-[#0d1220]/90 hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            exitPlayer();
          }}
        >
          <ArrowLeft class="h-[18px] w-[18px]" />
        </button>

        {/* ── IINA Button ── */}
        <Show when={state.url.length}>
          <div class="control-element fixed top-8 right-20 z-50">
            <OpenInIINAButton
              beforePlaying={() => {
                commands.playbackPause();
              }}
              url={state.url}
            />
          </div>
        </Show>
      </Show>

      {/* ── Autoplay Overlay ── */}
      <Show when={autoplayHook().nextEpisode}>
        <div class="control-element">
          <AutoplayOverlay
            isCollapsed={autoplayHook().isCollapsed()}
            isVisible={autoplayHook().showAutoplay()}
            nextEpisode={autoplayHook().nextEpisode as WithImage<BaseItemDto>}
            onCancel={autoplayHook().cancelAutoplay}
            onPlayNext={() => {
              autoplayHook().playNextEpisode();
            }}
            setIsCollapsed={autoplayHook().setIsCollapsed}
          />
        </div>
      </Show>

      {/* ── OSD (On-Screen Display) ── */}
      <OSD onHide={hideOSD} state={state.osd} />

      {/* ── Keyboard Shortcuts Help ── */}
      <KeyboardShortcutsHelp onClose={toggleHelp} visible={state.showHelp} />
    </div>
  );
}
