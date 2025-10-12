import {
  Pause,
  Play,
  Volume2,
  Volume1,
  VolumeX,
  AudioLines,
  AudioWaveform,
  Captions,
  CaptionsOff,
  Gauge,
} from 'lucide-solid';
import { createMemo, Show } from 'solid-js';
import { commands } from '~/lib/tauri';
import { formatTime } from '~/components/video/utils';
import { cn } from '~/lib/utils';
import type { Track } from '~/components/video/types';

interface VideoControlsProps {
  state: {
    playing: boolean;
    currentTime: string;
    duration: number;
    volume: number;
    isMuted: boolean;
    audioIndex: number;
    subtitleIndex: number;
    playbackSpeed: number;
    audioList: Track[];
    subtitleList: Track[];
  };
  openPanel: () => 'audio' | 'subtitles' | 'speed' | null;
  setOpenPanel: (panel: 'audio' | 'subtitles' | 'speed' | null) => void;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onVolumeChange: (value: number) => void;
  onProgressClick: (value: number) => void;
  onSetSpeed: (speed: number) => void;
  audioBtnRef?: HTMLButtonElement;
  subsBtnRef?: HTMLButtonElement;
  speedBtnRef?: HTMLButtonElement;
}

export default function VideoControls(props: VideoControlsProps) {
  const progressPercentage = () =>
    (Number(props.state.currentTime) / props.state.duration) * 100 || 0;

  const getVolumeIcon = () => {
    if (props.state.isMuted || props.state.volume === 0) {
      return VolumeX;
    } else if (props.state.volume > 50) {
      return Volume2;
    } else {
      return Volume1;
    }
  };

  const currentAudioTrack = createMemo(() => {
    const track = props.state.audioList.find((t) => t.id === props.state.audioIndex);
    if (!track) return 'Default';
    return `${track.title || ''} ${track.lang || ''}`.trim() || 'Default';
  });

  const currentSubtitleTrack = createMemo(() => {
    if (props.state.subtitleIndex === 0 || props.state.subtitleIndex === -1) return 'Off';
    const track = props.state.subtitleList.find((t) => t.id === props.state.subtitleIndex);
    if (!track) return 'Off';
    return `${track.title || ''} ${track.lang || ''}`.trim() || 'On';
  });

  const currentSpeed = createMemo(() => {
    return `${props.state.playbackSpeed}x`;
  });

  return (
    <div class="bg-black/90 backdrop-blur-md rounded-xl p-4 border border-white/20 shadow-2xl">
      {/* Progress Bar */}
      <div class="flex items-center gap-3 mb-3">
        <span class="text-white font-medium text-xs sm:text-sm min-w-[50px]">
          {formatTime(Number(props.state.currentTime))}
        </span>
        <div class="flex-1 relative">
          <div class="h-1.5 bg-white/30 rounded-lg overflow-hidden">
            <div
              class="h-full bg-white/80 transition-all duration-150"
              style={{ width: `${progressPercentage()}%` }}
            />
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={progressPercentage()}
            onInput={(e) =>
              props.onProgressClick(Number(e.currentTarget.value))
            }
            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
        <span class="text-white font-medium text-xs sm:text-sm min-w-[50px] text-right">
          {formatTime(props.state.duration)}
        </span>
      </div>

      {/* Controls */}
      <div class="flex flex-col gap-3 sm:gap-2 md:flex-row md:items-center md:justify-between">
        {/* Left Controls */}
        <div class="flex items-center gap-3 sm:gap-4">
          <button
            onClick={props.onTogglePlay}
            class="p-2.5 text-white rounded-full transition-all hover:scale-105"
          >
            <Show
              when={props.state.playing}
              fallback={<Play class="h-6 w-6" />}
            >
              <Pause class="h-6 w-6" />
            </Show>
          </button>

          <div class="flex items-center gap-x-2">
            <button
              onClick={props.onToggleMute}
              class="p-2 text-white rounded-full transition-all"
            >
              {(() => {
                const VolumeIcon = getVolumeIcon();
                return <VolumeIcon class="h-5 w-5" />;
              })()}
            </button>

            <div class="w-24 sm:w-32 relative">
              <div class="h-1.5 bg-white/30 rounded-lg overflow-hidden">
                <div
                  class="h-full bg-white/80 transition-all duration-150"
                  style={{ width: `${(props.state.volume / 200) * 100}%` }}
                />
              </div>
              <input
                type="range"
                min="0"
                max="200"
                value={props.state.volume}
                onInput={(e) =>
                  props.onVolumeChange(Number(e.currentTarget.value))
                }
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right Controls */}
        <div class="flex flex-wrap items-center gap-2 justify-end">
          <Show when={props.state.audioList.length > 0}>
            <button
              ref={props.audioBtnRef}
              class={cn(
                'p-2 text-white rounded-full transition-all',
                props.openPanel() === 'audio' && 'bg-white/20'
              )}
              aria-expanded={props.openPanel() === 'audio'}
              aria-label={`Audio: ${currentAudioTrack()}`}
              onClick={() =>
                props.setOpenPanel(props.openPanel() === 'audio' ? null : 'audio')
              }
            >
              <Show
                when={props.state.audioIndex !== -1 && props.state.audioIndex !== 0}
                fallback={<AudioLines class="h-5 w-5" />}
              >
                <AudioWaveform class="h-5 w-5" />
              </Show>
            </button>
          </Show>

          <Show when={props.state.subtitleList.length > 0}>
            <button
              ref={props.subsBtnRef}
              class={cn(
                'p-2 text-white rounded-full transition-all',
                props.openPanel() === 'subtitles' && 'bg-white/20'
              )}
              aria-expanded={props.openPanel() === 'subtitles'}
              aria-label={`Subtitles: ${currentSubtitleTrack()}`}
              onClick={() =>
                props.setOpenPanel(
                  props.openPanel() === 'subtitles' ? null : 'subtitles'
                )
              }
            >
              <Show
                when={props.state.subtitleIndex > 0}
                fallback={<CaptionsOff class="h-5 w-5" />}
              >
                <Captions class="h-5 w-5" />
              </Show>
            </button>
          </Show>

          <button
            ref={props.speedBtnRef}
            class={cn(
              'p-2 text-white rounded-full transition-all',
              props.openPanel() === 'speed' && 'bg-white/20'
            )}
            aria-expanded={props.openPanel() === 'speed'}
            aria-label={`Speed: ${currentSpeed()}`}
            onClick={() =>
              props.setOpenPanel(props.openPanel() === 'speed' ? null : 'speed')
            }
          >
            <Gauge class="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
