import { RouteSectionProps, useNavigate } from '@solidjs/router';
import {
  ArrowLeft,
  Eye,
  EyeOff,
} from 'lucide-solid';
import {
  createEffect,
  onCleanup,
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
  OpenInIINAButton 
} from '~/components/video';
import { useVideoPlayback } from '~/hooks/useVideoPlayback';
import { useVideoKeyboardShortcuts } from '~/hooks/useVideoKeyboardShortcuts';

export default function Page(props: RouteSectionProps) {
  let [{ params }] = splitProps(props, ['params']);
  let navigate = useNavigate();
  const { store: userStore } = useGeneralInfo();

  // Fetch item details with UserData to get playback position
  const itemDetails = createJellyFinQuery(() => ({
    queryKey: [
      library.query.getItem.key,
      library.query.getItem.keyFor(params.id, userStore?.user?.Id),
    ],
    queryFn: async (jf) =>
      library.query.getItem(jf, params.id, userStore?.user?.Id, [
        'Overview',
        'ParentId',
      ]),
  }));

  const parentDetails = createJellyFinQuery(() => ({
    queryKey: [
      library.query.getItem.key,
      library.query.getItem.keyFor(params.id, userStore?.user?.Id),
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
  } = useVideoPlayback(params.id, itemDetails);

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

  const handleMouseMove = () => {
    if (!state.controlsLocked) {
      showControls();
    }
  };

  const handleWindowClick = () => {
    if (state.controlsLocked) return;
    
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
        class="fixed top-6 right-4 p-3 text-white bg-black/60 hover:bg-black/80 rounded-full transition-all z-50"
        aria-label={
          state.controlsLocked ? 'Unlock controls' : 'Lock controls hidden'
        }
        onClick={toggleControlsLock}
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
        <div class="control-element fixed bottom-0 left-0 right-0 p-4 pointer-events-none">
          <div class="relative w-full max-w-4xl mx-auto flex flex-col gap-3 pointer-events-auto">
            {/* Dropdown Panels */}
            <VideoSettingsPanels
              openPanel={openPanel()}
              setOpenPanel={setOpenPanel}
              state={state}
              setState={setState}
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
          <div class="control-element fixed top-8 right-20 z-50">
            <OpenInIINAButton
              url={state.url}
              beforePlaying={() => {
                commands.playbackPause();
              }}
            />
          </div>
        </Show>
      </Show>
    </div>
  );
}
