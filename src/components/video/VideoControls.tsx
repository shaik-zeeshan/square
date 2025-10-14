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
  BookOpen,
} from 'lucide-solid';
import { createMemo, Show, For } from 'solid-js';
import { commands } from '~/lib/tauri';
import { formatTime } from '~/components/video/utils';
import { cn } from '~/lib/utils';
import type { Track, Chapter } from '~/components/video/types';

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
    chapters: Chapter[];
  };
  openPanel: () => 'audio' | 'subtitles' | 'speed' | 'chapters' | null;
  setOpenPanel: (panel: 'audio' | 'subtitles' | 'speed' | 'chapters' | null) => void;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onVolumeChange: (value: number) => void;
  onProgressClick: (value: number) => void;
  onSetSpeed: (speed: number) => void;
  onNavigateToChapter: (chapter: Chapter) => void;
  audioBtnRef?: HTMLButtonElement;
  subsBtnRef?: HTMLButtonElement;
  speedBtnRef?: HTMLButtonElement;
}

export default function VideoControls(props: VideoControlsProps) {
  const progressPercentage = () =>
    (Number(props.state.currentTime) / props.state.duration) * 100 || 0;

  // Debug chapters
  console.log('VideoControls chapters:', props.state.chapters);

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
          <div class="h-1.5 bg-white/30 rounded-lg overflow-hidden relative">
            <div
              class="h-full bg-white/80 transition-all duration-150"
              style={{ width: `${progressPercentage()}%` }}
            />
            {/* Chapter markers */}
            <Show when={props.state.chapters.length > 0}>
              <For each={props.state.chapters}>
                {(chapter, index) => {
                  const chapterPosition = () => {
                    const startTimeSeconds = chapter.startPositionTicks / 10000000;
                    return (startTimeSeconds / props.state.duration) * 100;
                  };
                  
                  const chapterName = () => chapter.name || `Chapter ${index() + 1}`;
                  const chapterTime = () => {
                    const startTimeSeconds = chapter.startPositionTicks / 10000000;
                    return formatTime(startTimeSeconds);
                  };
                  
                  const isCurrentChapter = () => {
                    const currentTime = Number(props.state.currentTime || 0);
                    const chapterTime = chapter.startPositionTicks / 10000000;
                    const nextChapterTime = props.state.chapters[index() + 1] 
                      ? props.state.chapters[index() + 1].startPositionTicks / 10000000 
                      : props.state.duration;
                    return currentTime >= chapterTime && currentTime < nextChapterTime;
                  };
                  
                  return (
                    <div class="absolute top-0 group" style={{ left: `${chapterPosition()}%` }}>
                      {/* Chapter marker button */}
                      <button
                        class={cn(
                          "w-2 h-full transition-all duration-200 cursor-pointer rounded-sm hover:scale-y-110",
                          isCurrentChapter() 
                            ? "bg-blue-400 hover:bg-blue-300" 
                            : "bg-white/60 hover:bg-white/90"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onNavigateToChapter(chapter);
                        }}
                      />
                      
                      {/* Enhanced tooltip */}
                      <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black/90 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                        <div class="flex items-center gap-2">
                          <div class="font-medium">{chapterName()}</div>
                          <Show when={isCurrentChapter()}>
                            <div class="w-2 h-2 bg-blue-400 rounded-full"></div>
                          </Show>
                        </div>
                        <div class="text-xs text-white/70 mt-1">{chapterTime()}</div>
                        {/* Tooltip arrow */}
                        <div class="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90"></div>
                      </div>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={progressPercentage()}
            onInput={(e) => {
              e.stopPropagation();
              props.onProgressClick(Number(e.currentTarget.value));
            }}
            onClick={(e) => e.stopPropagation()}
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
            onClick={(e) => {
              e.stopPropagation();
              props.onTogglePlay();
            }}
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
              onClick={(e) => {
                e.stopPropagation();
                props.onToggleMute();
              }}
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
                onInput={(e) => {
                  e.stopPropagation();
                  props.onVolumeChange(Number(e.currentTarget.value));
                }}
                onClick={(e) => e.stopPropagation()}
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
              onClick={(e) => {
                e.stopPropagation();
                props.setOpenPanel(props.openPanel() === 'audio' ? null : 'audio');
              }}
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
              onClick={(e) => {
                e.stopPropagation();
                props.setOpenPanel(
                  props.openPanel() === 'subtitles' ? null : 'subtitles'
                );
              }}
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
            onClick={(e) => {
              e.stopPropagation();
              props.setOpenPanel(props.openPanel() === 'speed' ? null : 'speed');
            }}
          >
            <Gauge class="h-5 w-5" />
          </button>

          <Show when={props.state.chapters.length > 0}>
            <button
              class={cn(
                'p-2 text-white rounded-full transition-all',
                props.openPanel() === 'chapters' && 'bg-white/20'
              )}
              aria-expanded={props.openPanel() === 'chapters'}
              aria-label="Chapters"
              onClick={(e) => {
                e.stopPropagation();
                props.setOpenPanel(props.openPanel() === 'chapters' ? null : 'chapters');
              }}
            >
              <BookOpen class="h-5 w-5" />
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
