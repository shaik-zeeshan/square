import { RouteSectionProps, useNavigate, useParams } from '@solidjs/router';
import {
  ArrowLeft,
  Eye,
  EyeOff,
} from 'lucide-solid';
import {
  createEffect,
  onCleanup,
  onMount,
  Show,
  splitProps,
} from 'solid-js';
import { commands } from '~/lib/tauri';
import { createJellyFinQuery } from '~/lib/utils';
import library from '~/lib/jellyfin/library';
import { useGeneralInfo } from '~/components/current-user-provider';
import { 
  VideoControls, 
  VideoSettingsPanels, 
  VideoInfoOverlay, 
  AutoplayOverlay,
  OpenInIINAButton 
} from '~/components/video';
import { useVideoPlayback } from '~/hooks/useVideoPlayback';
import { useVideoKeyboardShortcuts } from '~/hooks/useVideoKeyboardShortcuts';
import { useAutoplay } from '~/hooks/useAutoplay';

export default function Page(props: RouteSectionProps) {
  // let [{ params }] = splitProps(props, ['params']);
  let navigate = useNavigate();
  const routeParams = useParams();
  const { store: userStore } = useGeneralInfo();


  // Fetch item details with UserData to get playback position
  const itemDetails = createJellyFinQuery(() => ({
    queryKey: [
      library.query.getItem.key,
      library.query.getItem.keyFor(routeParams.id, userStore?.user?.Id),
    ],
    queryFn: async (jf) =>
      library.query.getItem(jf, routeParams.id, userStore?.user?.Id, [
        'Overview',
        'ParentId',
      ]),
  }));

  const parentDetails = createJellyFinQuery(() => ({
    queryKey: [
      library.query.getItem.key,
      library.query.getItem.keyFor(routeParams.id, userStore?.user?.Id),
      itemDetails.data?.ParentId,
    ],
    queryFn: async (jf) =>
      library.query.getItem(
        jf,
        itemDetails.data?.ParentId || '',
        userStore?.user?.Id,
        ['Overview', 'ParentId']
      ),

    enabled: !!itemDetails.data?.ParentId && itemDetails.data.Type !== 'Movie',
  }));

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
    loadNewVideo,
    handleControlMouseEnter,
    handleControlMouseLeave,
    navigateToChapter,
  } = useVideoPlayback(() => routeParams.id, itemDetails);

  // Use autoplay hook - don't destructure to maintain reactivity
  const autoplayHook = useAutoplay({
    currentItemId: () => routeParams.id,
    currentItemDetails: itemDetails,
    onLoadNewVideo: loadNewVideo,
    playbackState: {
      currentTime: () => state.currentTime,
      duration: () => state.duration,
    },
  });



  let audioBtnRef: HTMLButtonElement | undefined;
  let subsBtnRef: HTMLButtonElement | undefined;
  let speedBtnRef: HTMLButtonElement | undefined;
  let panelRef: HTMLDivElement | undefined;

  // Use keyboard shortcuts hook
  useVideoKeyboardShortcuts({
    state,
    openPanel,
    setOpenPanel,
    togglePlay,
    toggleMute,
    handleVolumeChange,
    showControls,
    navigateToChapter,
  });

  // Close panel when clicking outside
  createEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!panelRef) return;
      const t = e.target as Node;
      if (panelRef.contains(t)) return;
      if (audioBtnRef?.contains(t)) return;
      if (subsBtnRef?.contains(t)) return;
      if (speedBtnRef?.contains(t)) return;
      setOpenPanel(null);
    };
    document.addEventListener('mousedown', onDown);
    onCleanup(() => document.removeEventListener('mousedown', onDown));
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
    document.addEventListener('wheel', handleWheel, { passive: false });
    onCleanup(() => document.removeEventListener('wheel', handleWheel));
  });

  // Add mouse enter/leave handlers to all control elements
  onMount(() => {
    let cleanupFunctions: (() => void)[] = [];

    const addControlListeners = () => {
      // Clean up existing listeners first
      cleanupFunctions.forEach(cleanup => cleanup());
      cleanupFunctions = [];

      const controlElements = document.querySelectorAll('.control-element');
      controlElements.forEach((element) => {
        element.addEventListener('mouseenter', handleControlMouseEnter);
        element.addEventListener('mouseleave', handleControlMouseLeave);
        
        // Store cleanup function for this element
        cleanupFunctions.push(() => {
          element.removeEventListener('mouseenter', handleControlMouseEnter);
          element.removeEventListener('mouseleave', handleControlMouseLeave);
        });
      });
    };

    // Add listeners after a short delay to ensure DOM is ready
    const timeout = setTimeout(addControlListeners, 100);
    
    // Re-add listeners when controls visibility changes (DOM updates)
    createEffect(() => {
      if (state.showControls) {
        // Small delay to ensure DOM is updated
        setTimeout(addControlListeners, 50);
      }
    });
    
    onCleanup(() => {
      clearTimeout(timeout);
      cleanupFunctions.forEach(cleanup => cleanup());
    });
  });


  const handleMouseMove = (e: MouseEvent) => {
    if (!state.controlsLocked) {
      // Check if mouse is over any control element
      const target = e.target as HTMLElement;
      if (target.classList.contains('control-element') || 
          target.closest('.control-element')) {
        return; // Don't show controls when hovering over control elements
      }
      showControls();
    }
  };

  const handleWindowClick = (e: MouseEvent) => {
    // Check if clicking on any control element
    const target = e.target as HTMLElement;
    if (panelRef?.contains(target)) return;
    if (audioBtnRef?.contains(target)) return;
    if (subsBtnRef?.contains(target)) return;
    if (speedBtnRef?.contains(target)) return;
    if (target.classList.contains('control-element') || 
        target.closest('.control-element')) return;
    
    if (state.showControls) {
      // Hide controls immediately
      setState('showControls', false);
      commands.toggleTitlebarHide(true);
    } else {
      // Show controls
      showControls();
    }
  };

  return (
    <div
      class="bg-transparent dark w-full h-full flex flex-col gap-2 overflow-hidden relative"
      onMouseMove={handleMouseMove}
      onClick={handleWindowClick}
    >
      {/* Lock Button - Always Visible */}
      <button
        class="fixed top-6 right-4 p-3 text-white bg-black/60 hover:bg-black/80 rounded-full transition-all z-50 control-element"
        aria-label={
          state.controlsLocked ? 'Unlock controls' : 'Lock controls hidden'
        }
        onClick={(e) => {
          e.stopPropagation();
          toggleControlsLock();
        }}
      >
        <Show when={state.controlsLocked} fallback={<Eye class="h-5 w-5" />}>
          <EyeOff class="h-5 w-5" />
        </Show>
      </button>

      <Show when={state.showControls}>
        {/* Item Info Overlay */}
        <VideoInfoOverlay 
          itemDetails={itemDetails} 
          parentDetails={parentDetails} 
        />

        {/* Bottom Controls */}
        <div 
          class="control-element fixed bottom-0 left-0 right-0 p-4 pointer-events-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="relative w-full max-w-4xl mx-auto flex flex-col gap-3 pointer-events-auto">
            {/* Dropdown Panels */}
            <VideoSettingsPanels
              openPanel={openPanel()}
              setOpenPanel={setOpenPanel}
              state={state}
              setState={setState}
              onNavigateToChapter={navigateToChapter}
              panelRef={panelRef}
            />

            {/* Main Control Bar */}
            <VideoControls
              state={state}
              openPanel={openPanel}
              setOpenPanel={setOpenPanel}
              onTogglePlay={togglePlay}
              onToggleMute={toggleMute}
              onVolumeChange={handleVolumeChange}
              onProgressClick={handleProgressClick}
              onSetSpeed={setSpeed}
              onNavigateToChapter={navigateToChapter}
              audioBtnRef={audioBtnRef}
              subsBtnRef={subsBtnRef}
              speedBtnRef={speedBtnRef}
            />
          </div>
        </div>

        {/* Back Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            commands.playbackClear();
            navigate(-1);
          }}
          class="control-element fixed top-6 left-4 p-3 text-white rounded-full transition-all z-50"
        >
          <ArrowLeft class="h-6 w-6" />
        </button>

        {/* IINA Button */}
        <Show when={state.url.length}>
          <div 
            class="control-element fixed top-8 right-20 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <OpenInIINAButton
              url={state.url}
              beforePlaying={() => {
                commands.playbackPause();
              }}
            />
          </div>
        </Show>
      </Show>


      {/* Autoplay Overlay */}
 <div 
   class="control-element"
   onClick={(e) => e.stopPropagation()}
 >
 <AutoplayOverlay
   nextEpisode={autoplayHook().nextEpisode}
   onPlayNext={() => {
    // before playing the next episode, clear the current video
    commands.playbackPause();
    autoplayHook().playNextEpisode()
  }}
   onCancel={autoplayHook().cancelAutoplay}
   isVisible={autoplayHook().showAutoplay()}
   isCollapsed={autoplayHook().isCollapsed()}
   setIsCollapsed={autoplayHook().setIsCollapsed}
 />
 </div>
  
    </div>
  );
}
