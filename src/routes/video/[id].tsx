import { RouteSectionProps, useNavigate } from '@solidjs/router';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  ArrowLeft,
  AudioLinesIcon,
  ClosedCaptionIcon,
  Gauge,
  Pause,
  Play,
  Volume2,
  Volume1,
  VolumeX,
} from 'lucide-solid';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  splitProps,
} from 'solid-js';
import { createStore } from 'solid-js/store';
import { commands } from '~/lib/tauri';
import { useJellyfin } from '~/components/jellyfin-provider';
import { cn, createJellyFinQuery } from '~/lib/utils';
import library from '~/lib/jellyfin/library';
import { useGeneralInfo } from '~/components/current-user-provider';
import {
  GlassButton,
  GlassCard,
  GlassSlider,
  GlassVolumeSlider,
  GlassDropdown,
  GlassDropdownItem,
} from '~/components/ui';
import { getPlaystateApi } from '@jellyfin/sdk/lib/utils/api/playstate-api';
import { PlayMethod } from '@jellyfin/sdk/lib/generated-client';

type Track = {
  id: number;
  title?: string;
  type: string;
  lang?: string;
};

type OpenPanel = 'audio' | 'subtitles' | 'speed' | null;

const DEFAULT_AUDIO_LANG = ['en', 'en-US'];
const DEFAULT_SUBTITLE_LANG = ['en', 'en-US'];

const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const OpenInIINAButton = (props: {
  url: string;
  beforePlaying?: () => void;
}) => {
  const params = [
    `url=${encodeURIComponent(props.url).replace(/'/g, '%27')}`,
    `mpv_input-ipc-server=/tmp/sreal`,
  ];

  const openIninna = () => {
    if (props.beforePlaying) {
      props.beforePlaying();
    }
    let iinaurl = `iina://open?${params.join('&')}`;

    openUrl(iinaurl);
  };

  // return <a href={`iina://open?${params.join('&')}`}>open in iina</a>;
  return (
    <button on:click={openIninna} class="cursor-pointer">
      <span>
        <img src="https://raw.githubusercontent.com/iina/iina/master/iina/Assets.xcassets/AppIcon.appiconset/iina-icon-32.png" />
      </span>
    </button>
  );
};

export default function Page(props: RouteSectionProps) {
  let [{ params }] = splitProps(props, ['params']);
  let navigate = useNavigate();
  let jf = useJellyfin();
  const { store: userStore } = useGeneralInfo();

  // Fetch item details with UserData to get playback position
  const itemDetails = createJellyFinQuery(() => ({
    queryKey: [
      library.query.getItem.key,
      library.query.getItem.keyFor(params.id, userStore?.user?.Id),
    ],
    queryFn: async (jf) =>
      library.query.getItem(jf, params.id, userStore?.user?.Id, []),
  }));

  let [state, setState] = createStore({
    audioIndex: -1,
    subtitleIndex: -1,
    currentTime: '',
    playing: true,
    volume: 100,
    isMuted: false,
    playbackSpeed: 1,
    audioList: [] as Track[],
    subtitleList: [] as Track[],
    duration: 0,
    showControls: true,
    url: '',
  });

  const [openPanel, setOpenPanel] = createSignal<OpenPanel>(null);
  const [hideControlsTimeout, setHideControlsTimeout] =
    createSignal<NodeJS.Timeout>();

  let audioBtnRef: HTMLButtonElement | undefined;
  let subsBtnRef: HTMLButtonElement | undefined;
  let speedBtnRef: HTMLButtonElement | undefined;
  let panelRef: HTMLDivElement | undefined;
  let unlistenFuncs: UnlistenFn[] = [];

  // Jellyfin playback reporting
  const playSessionId = crypto.randomUUID();
  let lastProgressReportTime = 0;

  onCleanup(async () => {
    unlistenFuncs.forEach((unlisten) => {
      unlisten();
    });
    clearTimeout(hideControlsTimeout());

    // Report playback stopped to Jellyfin
    if (jf.api) {
      try {
        const playstateApi = getPlaystateApi(jf.api);
        await playstateApi.reportPlaybackStopped({
          playbackStopInfo: {
            ItemId: params.id,
            PlaySessionId: playSessionId,
            PositionTicks: Math.floor(Number(state.currentTime) * 10000000),
          },
        });
      } catch (error) {
        console.error('Failed to report playback stopped:', error);
      }
    }

    commands.toggleTitlebarHide(false);
    commands.playbackClear();
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

  const showControls = async () => {
    setState('showControls', true);
    commands.toggleTitlebarHide(false);

    const existing = hideControlsTimeout();
    if (existing) clearTimeout(existing);

    const timeout = setTimeout(() => {
      commands.toggleTitlebarHide(true);
      setState('showControls', false);
    }, 3000);
    setHideControlsTimeout(timeout);
  };

  const handleMouseMove = () => {
    showControls();
  };

  const togglePlay = () => {
    if (state.playing) {
      commands.playbackPause();
    } else {
      commands.playbackPlay();
    }
  };

  const toggleMute = () => {
    if (state.isMuted) {
      const lastVolume = state.volume || 100;
      commands.playbackVolume(lastVolume);
      setState('volume', lastVolume);
      setState('isMuted', false);
    } else {
      commands.playbackVolume(0);
      setState('isMuted', true);
    }
  };

  const handleVolumeChange = (value: number) => {
    const newVolume = Math.round(value);
    commands.playbackVolume(newVolume);
    setState('volume', newVolume);
    setState('isMuted', newVolume === 0);
  };

  const setSpeed = (speed: number) => {
    commands.playbackSpeed(speed);
    setState('playbackSpeed', speed);
  };

  // Keyboard shortcuts
  createEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).tagName === 'INPUT' ||
        (e.target as HTMLElement).tagName === 'TEXTAREA'
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          togglePlay();
          break;

        case 'ArrowLeft':
        case 'KeyJ':
          e.preventDefault();
          commands.playbackSeek(-10);
          break;

        case 'ArrowRight':
        case 'KeyL':
          e.preventDefault();
          commands.playbackSeek(10);
          break;

        case 'ArrowUp':
          e.preventDefault();
          commands.playbackSeek(60);
          break;

        case 'ArrowDown':
          e.preventDefault();
          commands.playbackSeek(-60);
          break;

        case 'KeyM':
          e.preventDefault();
          toggleMute();
          showControls();
          break;

        case 'Equal':
        case 'NumpadAdd':
          e.preventDefault();
          handleVolumeChange(Math.min(200, state.volume + 5));
          showControls();
          break;

        case 'Minus':
        case 'NumpadSubtract':
          e.preventDefault();
          handleVolumeChange(Math.max(0, state.volume - 5));
          showControls();
          break;

        case 'KeyF':
          e.preventDefault();
          commands.toggleFullscreen();
          break;

        case 'Escape':
          e.preventDefault();
          if (openPanel()) {
            setOpenPanel(null);
          } else {
            commands.playbackPause();
            navigate(-1);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
      document.removeEventListener('keydown', handleKeyDown);
    });
  });

  onMount(async () => {
    let token = jf.api?.accessToken;
    let basePath = jf.api?.basePath;

    if (!token || !jf.api) {
      return;
    }

    let url = `${basePath}/Videos/${params.id}/Stream?api_key=${token}&container=mp4&static=true`;
    setState('url', url);

    commands.playbackLoad(url);

    // Report playback start to Jellyfin
  });

  createEffect(async () => {
    const playbackTime = await listen('playback-time', async (event) => {
      setState('currentTime', event.payload as string);

      // Report progress to Jellyfin every 3 seconds
      const now = Date.now();
      if (now - lastProgressReportTime >= 3000 && jf.api) {
        lastProgressReportTime = now;
        try {
          const playstateApi = getPlaystateApi(jf.api);
          await playstateApi.reportPlaybackProgress({
            playbackProgressInfo: {
              ItemId: params.id,
              PlaySessionId: playSessionId,
              PositionTicks: Math.floor(Number(state.currentTime) * 10000000),
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
        } catch (error) {
          console.error('Failed to report playback progress:', error);
        }
      }
    });

    unlistenFuncs.push(playbackTime);

    const pause = await listen('pause', (event) => {
      setState('playing', !(event.payload as boolean));
    });

    unlistenFuncs.push(pause);

    const audioList = await listen('audio-list', (event) => {
      setState('audioList', event.payload as Track[]);
      if (state.audioIndex >= -1) return;
      let defaultAudio = (event.payload as Track[]).find((track) =>
        DEFAULT_AUDIO_LANG.includes(track.lang ?? '')
      );
      if (defaultAudio) {
        commands.playbackChangeAudio(defaultAudio.id.toString());
        setState('audioIndex', defaultAudio.id as number);
      } else if (state.audioList.length > 0) {
        commands.playbackChangeAudio(state.audioList[0].id.toString());
        setState('audioIndex', state.audioList[0].id);
      }
    });

    unlistenFuncs.push(audioList);

    const subtitleList = await listen('subtitle-list', (event) => {
      setState('subtitleList', event.payload as Track[]);
      if (state.subtitleIndex >= -1) return;
      let defaultSubtitle = (event.payload as Track[]).find((track) =>
        DEFAULT_SUBTITLE_LANG.includes(track.lang ?? '')
      );
      if (defaultSubtitle) {
        commands.playbackChangeSubtitle(defaultSubtitle.id.toString());
        setState('subtitleIndex', defaultSubtitle.id);
      }
    });

    unlistenFuncs.push(subtitleList);

    const duration = await listen('duration', async (event) => {
      setState('duration', Number(event.payload as string));

      // Resume from saved position if available
      const savedPosition = itemDetails.data?.UserData?.PlaybackPositionTicks;
      if (savedPosition && savedPosition > 0) {
        // Convert ticks to seconds (1 tick = 0.0000001 seconds)
        const savedSeconds = savedPosition / 10000000;
        // Only resume if not near the end (more than 5% remaining)
        const duration = Number(event.payload as string);
        if (savedSeconds < duration * 0.95) {
          commands.playbackSeek(savedSeconds);
          setState('currentTime', savedSeconds.toString());
        }
      }

      try {
        if (!jf.api) return;
        const playstateApi = getPlaystateApi(jf.api);
        await playstateApi.reportPlaybackStart({
          playbackStartInfo: {
            ItemId: params.id,
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
      } catch (error) {
        console.error('Failed to report playback start:', error);
      }
    });

    unlistenFuncs.push(duration);

    const aid = await listen('aid', (event) => {
      setState('audioIndex', Number(event.payload as string));
    });

    unlistenFuncs.push(aid);

    const sid = await listen('sid', (event) => {
      setState('subtitleIndex', Number(event.payload as string));
    });

    unlistenFuncs.push(sid);

    const speed = await listen('speed', (event) => {
      setState('playbackSpeed', Number(event.payload as string));
    });

    unlistenFuncs.push(speed);
  });

  const progressPercentage = () =>
    (Number(state.currentTime) / state.duration) * 100 || 0;

  const handleProgressClick = (value: number) => {
    if (state.duration === 0) return;
    const newTime = (value / 100) * state.duration;
    let relativeTime = newTime - Number(state.currentTime);
    commands.playbackSeek(relativeTime);
    setState('currentTime', newTime.toString());
  };

  const getVolumeIcon = () => {
    if (state.isMuted || state.volume === 0) {
      return VolumeX;
    } else if (state.volume > 50) {
      return Volume2;
    } else {
      return Volume1;
    }
  };

  const currentAudioTrack = createMemo(() => {
    const track = state.audioList.find((t) => t.id === state.audioIndex);
    if (!track) return 'Default';
    return `${track.title || ''} ${track.lang || ''}`.trim() || 'Default';
  });

  const currentSubtitleTrack = createMemo(() => {
    if (state.subtitleIndex === 0 || state.subtitleIndex === -1) return 'Off';
    const track = state.subtitleList.find((t) => t.id === state.subtitleIndex);
    if (!track) return 'Off';
    return `${track.title || ''} ${track.lang || ''}`.trim() || 'On';
  });

  const currentSpeed = createMemo(() => {
    return `${state.playbackSpeed}x`;
  });

  return (
    <div
      class="bg-transparent dark w-full h-full flex flex-col gap-2 overflow-hidden relative"
      onMouseMove={handleMouseMove}
    >
      <Show when={state.showControls}>
        {/* Bottom Controls */}
        <div class="control-element fixed bottom-0 left-0 right-0 p-4">
          <div class="relative w-full max-w-4xl mx-auto">
            {/* Dropdown Panels */}
            <GlassDropdown
              open={openPanel() !== null}
              position="top"
              ref={panelRef}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpenPanel(null);
              }}
            >
              <Show when={openPanel() === 'audio'}>
                <div class="flex flex-col gap-1">
                  <GlassDropdownItem
                    selected={state.audioIndex === 0}
                    onClick={() => {
                      commands.playbackChangeAudio('0');
                      setState('audioIndex', 0);
                      setOpenPanel(null);
                    }}
                  >
                    No Audio
                  </GlassDropdownItem>
                  <For each={state.audioList}>
                    {(track) => (
                      <GlassDropdownItem
                        selected={state.audioIndex === track.id}
                        onClick={() => {
                          commands.playbackChangeAudio(track.id.toString());
                          setState('audioIndex', track.id);
                          setOpenPanel(null);
                        }}
                      >
                        {`${track.title || ''} ${track.lang || ''}`.trim() ||
                          'Track'}
                      </GlassDropdownItem>
                    )}
                  </For>
                </div>
              </Show>

              <Show when={openPanel() === 'subtitles'}>
                <div class="flex flex-col gap-1">
                  <GlassDropdownItem
                    selected={
                      state.subtitleIndex === 0 || state.subtitleIndex === -1
                    }
                    onClick={() => {
                      commands.playbackChangeSubtitle('0');
                      setState('subtitleIndex', 0);
                      setOpenPanel(null);
                    }}
                  >
                    Off
                  </GlassDropdownItem>
                  <For each={state.subtitleList}>
                    {(track) => (
                      <GlassDropdownItem
                        selected={state.subtitleIndex === track.id}
                        onClick={() => {
                          commands.playbackChangeSubtitle(track.id.toString());
                          setState('subtitleIndex', track.id);
                          setOpenPanel(null);
                        }}
                      >
                        {`${track.title || ''} ${track.lang || ''}`.trim() ||
                          'Track'}
                      </GlassDropdownItem>
                    )}
                  </For>
                </div>
              </Show>

              <Show when={openPanel() === 'speed'}>
                <div class="flex flex-col gap-1">
                  <For each={[0.5, 1, 1.5, 2]}>
                    {(speed) => (
                      <GlassDropdownItem
                        selected={state.playbackSpeed === speed}
                        onClick={() => {
                          setSpeed(speed);
                          setOpenPanel(null);
                        }}
                      >
                        {speed}x
                      </GlassDropdownItem>
                    )}
                  </For>
                </div>
              </Show>
            </GlassDropdown>

            {/* Main Control Bar */}
            <GlassCard preset="panel" class="p-4">
              {/* Progress Bar */}
              <div class="flex items-center gap-2 mb-2">
                <span class="text-white text-xs sm:text-sm min-w-[45px]">
                  {formatTime(Number(state.currentTime))}
                </span>
                <GlassSlider
                  value={progressPercentage()}
                  onChange={handleProgressClick}
                  class="flex-1"
                />
                <span class="text-white text-xs sm:text-sm min-w-[45px]">
                  {formatTime(state.duration)}
                </span>
              </div>

              {/* Controls */}
              <div class="flex flex-col gap-3 sm:gap-2 md:flex-row md:items-center md:justify-between">
                {/* Left Controls */}
                <div class="flex items-center gap-3 sm:gap-4">
                  <GlassButton
                    variant="ghost"
                    size="icon"
                    onClick={togglePlay}
                    class="text-white"
                  >
                    <Show
                      when={state.playing}
                      fallback={<Play class="h-5 w-5" />}
                    >
                      <Pause class="h-5 w-5" />
                    </Show>
                  </GlassButton>

                  <div class="flex items-center gap-x-1">
                    <GlassButton
                      variant="ghost"
                      size="icon"
                      onClick={toggleMute}
                      class="text-white"
                    >
                      {(() => {
                        const VolumeIcon = getVolumeIcon();
                        return <VolumeIcon class="h-5 w-5" />;
                      })()}
                    </GlassButton>

                    <div class="w-20 sm:w-28">
                      <GlassVolumeSlider
                        value={state.volume}
                        onChange={handleVolumeChange}
                        maxVolume={200}
                      />
                    </div>
                  </div>
                </div>

                {/* Right Controls */}
                <div class="flex flex-wrap items-center gap-2 justify-end">
                  <Show when={state.audioList.length > 0}>
                    <GlassButton
                      ref={audioBtnRef}
                      variant="ghost"
                      size="icon"
                      class={cn(
                        'text-white',
                        openPanel() === 'audio' && 'bg-[var(--glass-bg-medium)]'
                      )}
                      aria-expanded={openPanel() === 'audio'}
                      aria-label={`Audio: ${currentAudioTrack()}`}
                      onClick={() =>
                        setOpenPanel((p) => (p === 'audio' ? null : 'audio'))
                      }
                    >
                      <AudioLinesIcon class="h-5 w-5" />
                    </GlassButton>
                  </Show>

                  <Show when={state.subtitleList.length > 0}>
                    <GlassButton
                      ref={subsBtnRef}
                      variant="ghost"
                      size="icon"
                      class={cn(
                        'text-white',
                        openPanel() === 'subtitles' &&
                          'bg-[var(--glass-bg-medium)]'
                      )}
                      aria-expanded={openPanel() === 'subtitles'}
                      aria-label={`Subtitles: ${currentSubtitleTrack()}`}
                      onClick={() =>
                        setOpenPanel((p) =>
                          p === 'subtitles' ? null : 'subtitles'
                        )
                      }
                    >
                      <ClosedCaptionIcon class="h-5 w-5" />
                    </GlassButton>
                  </Show>

                  <GlassButton
                    ref={speedBtnRef}
                    variant="ghost"
                    size="icon"
                    class={cn(
                      'text-white',
                      openPanel() === 'speed' && 'bg-[var(--glass-bg-medium)]'
                    )}
                    aria-expanded={openPanel() === 'speed'}
                    aria-label={`Speed: ${currentSpeed()}`}
                    onClick={() =>
                      setOpenPanel((p) => (p === 'speed' ? null : 'speed'))
                    }
                  >
                    <Gauge class="h-5 w-5" />
                  </GlassButton>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Back Button */}
        <GlassButton
          variant="glass-subtle"
          size="icon-lg"
          onClick={() => {
            commands.playbackClear();
            navigate(-1);
          }}
          class="control-element fixed top-10 left-10 text-white z-50"
        >
          <ArrowLeft class="h-6 w-6" />
        </GlassButton>

        {/* IINA Button */}
        <Show when={state.url.length}>
          <div class="control-element fixed top-10 right-10 z-50">
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
