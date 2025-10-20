import { getAllWindows } from "@tauri-apps/api/window";
import {
  AudioLines,
  AudioWaveform,
  BookOpen,
  Captions,
  CaptionsOff,
  Gauge,
  Pause,
  PictureInPicture,
  Play,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-solid";
import { createMemo, createSignal, For, Show } from "solid-js";
import type { Chapter, Track } from "~/components/video/types";
import { formatTime } from "~/components/video/utils";
import { commands } from "~/lib/tauri";
import { cn } from "~/lib/utils";

type VideoControlsProps = {
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
    // New buffering and loading states
    bufferedTime: number;
    bufferingPercentage: number;
    isLoading: boolean;
    isBuffering: boolean;
    isSeeking: boolean;
  };
  openPanel: () => "audio" | "subtitles" | "speed" | "chapters" | null;
  setOpenPanel: (
    panel: "audio" | "subtitles" | "speed" | "chapters" | null
  ) => void;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onVolumeChange: (value: number) => void;
  onProgressClick: (value: number) => void;
  onSetSpeed: (speed: number) => void;
  onNavigateToChapter: (chapter: Chapter) => void;
  onOpenPip: () => Promise<void>;
  audioBtnRef?: HTMLButtonElement;
  subsBtnRef?: HTMLButtonElement;
  speedBtnRef?: HTMLButtonElement;
};

export default function VideoControls(props: VideoControlsProps) {
  const [hoverPosition, setHoverPosition] = createSignal<number | null>(null);
  const [isHovering, setIsHovering] = createSignal(false);
  const [isDragging, setIsDragging] = createSignal(false);
  const [dragPosition, setDragPosition] = createSignal<number | null>(null);
  let progressRef: HTMLDivElement | undefined;

  const progressPercentage = () =>
    (Number(props.state.currentTime) / props.state.duration) * 100 || 0;

  const bufferedPercentage = () => {
    if (props.state.duration === 0) {
      return 0;
    }
    return (props.state.bufferedTime / props.state.duration) * 100 || 0;
  };

  const handleMouseMove = (e: MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    const clamped = Math.max(0, Math.min(100, percentage));
    if (isDragging()) {
      setDragPosition(clamped);
    } else {
      setHoverPosition(clamped);
    }
  };

  const getChapterAtPosition = (position: number) => {
    if (!props.state.chapters.length) {
      return null;
    }

    const timeAtPosition = (position / 100) * props.state.duration;

    for (let i = 0; i < props.state.chapters.length; i++) {
      const chapter = props.state.chapters[i];
      const chapterTime = chapter.startPositionTicks / 10_000_000;
      const nextChapterTime = props.state.chapters[i + 1]
        ? props.state.chapters[i + 1].startPositionTicks / 10_000_000
        : props.state.duration;

      if (timeAtPosition >= chapterTime && timeAtPosition < nextChapterTime) {
        return { chapter, index: i };
      }
    }
    return null;
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setHoverPosition(null);
  };

  const getPercentageFromClientX = (clientX: number) => {
    if (!progressRef) {
      return 0;
    }
    const rect = progressRef.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    return Math.max(0, Math.min(100, percentage));
  };

  const beginDrag = (clientX: number) => {
    setIsDragging(true);
    setDragPosition(getPercentageFromClientX(clientX));
  };

  const updateDrag = (clientX: number) => {
    if (!isDragging()) {
      return;
    }
    setDragPosition(getPercentageFromClientX(clientX));
  };

  const endDrag = (clientX?: number) => {
    if (!isDragging()) {
      return;
    }
    const pct =
      clientX !== undefined
        ? getPercentageFromClientX(clientX)
        : (dragPosition() ?? progressPercentage());
    props.onProgressClick(pct);
    setIsDragging(false);
    setDragPosition(null);
  };

  const getProgressIndicatorClass = () => {
    if (props.state.isBuffering) {
      return "scale-110 bg-white/80";
    }
    if (props.state.isSeeking) {
      return "scale-105 bg-white";
    }
    return "scale-0 bg-white group-hover:scale-100";
  };

  const getVolumeIcon = () => {
    if (props.state.isMuted || props.state.volume === 0) {
      return VolumeX;
    }
    if (props.state.volume > 50) {
      return Volume2;
    }
    return Volume1;
  };

  const currentAudioTrack = createMemo(() => {
    const track = props.state.audioList.find(
      (t) => t.id === props.state.audioIndex
    );
    if (!track) {
      return "Default";
    }
    return `${track.title || ""} ${track.lang || ""}`.trim() || "Default";
  });

  const currentSubtitleTrack = createMemo(() => {
    if (props.state.subtitleIndex === 0 || props.state.subtitleIndex === -1) {
      return "Off";
    }
    const track = props.state.subtitleList.find(
      (t) => t.id === props.state.subtitleIndex
    );
    if (!track) {
      return "Off";
    }
    return `${track.title || ""} ${track.lang || ""}`.trim() || "On";
  });

  const currentSpeed = createMemo(() => `${props.state.playbackSpeed}x`);

  return (
    <div class="rounded-xl border border-white/20 bg-black/90 p-4 shadow-2xl backdrop-blur-md">
      {/* Enhanced Progress Bar */}
      <div class="mb-3 flex items-center gap-3">
        <span class="min-w-[50px] font-medium text-white text-xs sm:text-sm">
          {formatTime(Number(props.state.currentTime))}
        </span>
        <div
          aria-label="Video progress bar"
          aria-roledescription="Video progress bar"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={
            isDragging() ? (dragPosition() ?? 0) : progressPercentage()
          }
          aria-valuetext={`${formatTime(Number(props.state.currentTime))} of ${formatTime(props.state.duration)}`}
          class="group relative flex-1"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              const current = isDragging()
                ? (dragPosition() ?? 0)
                : progressPercentage();
              const step = e.key === "ArrowLeft" ? -1 : 1;
              const newValue = Math.max(0, Math.min(100, current + step));
              props.onProgressClick(newValue);
            }
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseMove={handleMouseMove}
          role="slider"
          tabindex={0}
        >
          <div
            aria-label="Video progress bar"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={
              isDragging() ? (dragPosition() ?? 0) : progressPercentage()
            }
            aria-valuetext={`${formatTime(Number(props.state.currentTime))} of ${formatTime(props.state.duration)}`}
            class="relative h-2 overflow-hidden rounded-full bg-white/20 shadow-inner"
            onKeyDown={(e) => {
              // keyboard support
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                const current = isDragging()
                  ? (dragPosition() ?? 0)
                  : progressPercentage();
                const step = e.key === "ArrowLeft" ? -1 : 1;
                const newValue = Math.max(0, Math.min(100, current + step));
                props.onProgressClick(newValue);
              }
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              beginDrag(e.clientX);
            }}
            onMouseLeave={() => endDrag()}
            onMouseMove={(e) => updateDrag(e.clientX)}
            onMouseUp={(e) => {
              e.preventDefault();
              endDrag(e.clientX);
            }}
            onTouchEnd={(e) => endDrag(e.changedTouches[0]?.clientX)}
            onTouchMove={(e) => updateDrag(e.touches[0].clientX)}
            onTouchStart={(e) => beginDrag(e.touches[0].clientX)}
            ref={(el) => {
              progressRef = el;
            }}
            role="slider"
            tabindex={0}
          >
            {/* Background gradient */}
            <div class="absolute inset-0 bg-gradient-to-r from-white/10 via-white/20 to-white/10" />

            {/* Chapter segments background */}
            <Show when={props.state.chapters.length > 0}>
              <div class="absolute inset-0 flex">
                <For each={props.state.chapters}>
                  {(chapter, index) => {
                    const startSec = chapter.startPositionTicks / 10_000_000;
                    const endSec = props.state.chapters[index() + 1]
                      ? props.state.chapters[index() + 1].startPositionTicks /
                        10_000_000
                      : props.state.duration;
                    const widthPct = () =>
                      Math.max(
                        0,
                        ((endSec - startSec) / props.state.duration) * 100
                      );

                    const isCurrent = () => {
                      const current = Number(props.state.currentTime || 0);
                      return current >= startSec && current < endSec;
                    };

                    return (
                      <div
                        class={cn(
                          "h-full",
                          isCurrent() ? "bg-blue-400/30" : "bg-gray-400/20"
                        )}
                        style={{ width: `${widthPct()}%` }}
                      >
                        {/* optional subtle separator */}
                        <Show when={index() > 0}>
                          <div class="h-full w-px bg-gray-300/40" />
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>

            {/* Buffered range */}
            <div
              class="absolute top-0 left-0 h-full bg-white/40"
              style={{ width: `${bufferedPercentage()}%` }}
            />

            {/* Current progress */}
            <div
              class="relative h-full bg-white/80"
              style={{ width: `${progressPercentage()}%` }}
            />

            {/* Enhanced shimmer effect for buffering */}
            <Show when={props.state.isBuffering}>
              <div
                class="absolute top-0 h-full w-12 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                style={{
                  left: `${bufferedPercentage()}%`,
                  animation: "shimmer 1.5s ease-in-out infinite",
                }}
              />
            </Show>

            {/* Loading state indicator */}
            <Show when={props.state.isLoading}>
              <div class="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </Show>

            {/* Hover preview indicator */}
            <Show when={isHovering() && hoverPosition() !== null}>
              <div
                class="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 h-6 w-6 rounded-full border-2 border-blue-400 bg-blue-400/20 shadow-lg"
                style={{
                  left: `${hoverPosition()}%`,
                  "box-shadow": "0 0 12px rgba(59, 130, 246, 0.5)",
                }}
              />
            </Show>

            {/* Enhanced progress indicator */}
            <Show when={props.state.isBuffering || props.state.isSeeking}>
              <div
                class={cn(
                  "-translate-x-1/2 -translate-y-1/2 absolute top-1/2 h-5 w-5 rounded-full border-2 border-white shadow-xl transition-all duration-200",
                  getProgressIndicatorClass()
                )}
                style={{
                  left: `${props.state.isSeeking ? progressPercentage() : progressPercentage()}%`,
                  animation: props.state.isBuffering
                    ? "pulse 1.5s ease-in-out infinite"
                    : "none",
                  "box-shadow": props.state.isBuffering
                    ? "0 0 12px rgba(255, 255, 255, 0.8)"
                    : "0 0 8px rgba(255, 255, 255, 0.6)",
                }}
              />
            </Show>
            {/* Enhanced Chapter markers */}
            <Show when={props.state.chapters.length > 0}>
              <For each={props.state.chapters}>
                {(chapter, index) => {
                  const chapterPosition = () => {
                    const startTimeSeconds =
                      chapter.startPositionTicks / 10_000_000;
                    return (startTimeSeconds / props.state.duration) * 100;
                  };

                  const chapterName = () =>
                    chapter.name || `Chapter ${index() + 1}`;
                  const chapterTime = () => {
                    const startTimeSeconds =
                      chapter.startPositionTicks / 10_000_000;
                    return formatTime(startTimeSeconds);
                  };

                  const isCurrentChapter = () => {
                    const currentTime = Number(props.state.currentTime || 0);
                    const chapterTime = chapter.startPositionTicks / 10_000_000;
                    const nextChapterTime = props.state.chapters[index() + 1]
                      ? props.state.chapters[index() + 1].startPositionTicks /
                        10_000_000
                      : props.state.duration;
                    return (
                      currentTime >= chapterTime &&
                      currentTime < nextChapterTime
                    );
                  };

                  return (
                    <div
                      class="group absolute top-0"
                      style={{ left: `${chapterPosition()}%` }}
                    >
                      {/* Enhanced chapter marker button */}
                      <button
                        aria-label={`Go to ${chapterName()} at ${chapterTime()}`}
                        class={cn(
                          "h-full w-2 cursor-pointer rounded-sm transition-all duration-200 hover:scale-y-110",
                          isCurrentChapter()
                            ? "bg-white shadow-lg shadow-white/50 hover:bg-white/90"
                            : "bg-white/60 shadow-md hover:bg-white/90"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onNavigateToChapter(chapter);
                        }}
                      />

                      {/* Enhanced tooltip with detailed chapter information */}
                      <div class="-translate-x-1/2 group-hover:-translate-y-1 pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 transform rounded-xl bg-black/95 px-4 py-3 text-sm text-white opacity-0 shadow-2xl backdrop-blur-sm transition-all duration-200 group-hover:opacity-100">
                        <div class="flex items-center gap-2">
                          <div class="font-semibold">{chapterName()}</div>
                          <Show when={isCurrentChapter()}>
                            <div class="h-2 w-2 animate-pulse rounded-full bg-white" />
                          </Show>
                        </div>
                        <div class="mt-1 font-medium text-white/80 text-xs">
                          {chapterTime()}
                        </div>
                        <Show when={chapter.imagePath}>
                          <div class="mt-2 text-white/60 text-xs">
                            📸 Chapter thumbnail available
                          </div>
                        </Show>
                        <div class="mt-1 text-white/60 text-xs">
                          Chapter {index() + 1} of {props.state.chapters.length}
                        </div>
                        {/* Enhanced tooltip arrow */}
                        <div class="-translate-x-1/2 absolute top-full left-1/2 h-0 w-0 transform border-transparent border-t-4 border-t-black/95 border-r-4 border-l-4" />
                      </div>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>

          {/* Enhanced time preview tooltip on hover */}
          <Show when={isHovering() && hoverPosition() !== null}>
            {(() => {
              const chapterInfo = getChapterAtPosition(hoverPosition() ?? 0);
              return (
                <div
                  class="pointer-events-none absolute bottom-full z-10 mb-2 transform rounded-lg bg-black/95 px-3 py-2 text-sm text-white shadow-xl backdrop-blur-sm transition-all duration-200"
                  style={{
                    left: `${hoverPosition()}%`,
                    transform: "translateX(-50%) translateY(-4px)",
                  }}
                >
                  <div class="font-semibold">
                    {formatTime(
                      ((hoverPosition() ?? 0) / 100) * props.state.duration
                    )}
                  </div>
                  <div class="text-white/70 text-xs">
                    {Math.round(hoverPosition() ?? 0)}%
                  </div>
                  <Show when={chapterInfo}>
                    <div class="mt-1 border-white/20 border-t pt-1">
                      <div class="font-medium text-white/90 text-xs">
                        {chapterInfo?.chapter.name ||
                          `Chapter ${(chapterInfo?.index ?? 0) + 1}`}
                      </div>
                      <div class="text-white/60 text-xs">
                        Chapter {(chapterInfo?.index ?? 0) + 1} of{" "}
                        {props.state.chapters.length}
                      </div>
                    </div>
                  </Show>
                  {/* Tooltip arrow */}
                  <div class="-translate-x-1/2 absolute top-full left-1/2 h-0 w-0 transform border-transparent border-t-4 border-t-black/95 border-r-4 border-l-4" />
                </div>
              );
            })()}
          </Show>
        </div>
        <span class="min-w-[50px] text-right font-medium text-white text-xs sm:text-sm">
          {formatTime(props.state.duration)}
        </span>
      </div>

      {/* Controls */}
      <div class="flex flex-col gap-3 sm:gap-2 md:flex-row md:items-center md:justify-between">
        {/* Left Controls */}
        <div class="flex items-center gap-3 sm:gap-4">
          <button
            class="rounded-full p-2.5 text-white transition-all hover:scale-105"
            onClick={(e) => {
              e.stopPropagation();
              props.onTogglePlay();
            }}
          >
            <Show
              fallback={<Play class="h-6 w-6" />}
              when={props.state.playing}
            >
              <Pause class="h-6 w-6" />
            </Show>
          </button>

          <div class="flex items-center gap-x-2">
            <button
              class="rounded-full p-2 text-white transition-all"
              onClick={(e) => {
                e.stopPropagation();
                props.onToggleMute();
              }}
            >
              {(() => {
                const VolumeIcon = getVolumeIcon();
                return <VolumeIcon class="h-5 w-5" />;
              })()}
            </button>

            <div class="relative w-24 sm:w-32">
              <div class="h-1.5 overflow-hidden rounded-lg bg-white/30">
                <div
                  class="h-full bg-white/80 transition-all duration-150"
                  style={{ width: `${(props.state.volume / 200) * 100}%` }}
                />
              </div>
              <input
                class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                max="200"
                min="0"
                onClick={(e) => e.stopPropagation()}
                onInput={(e) => {
                  e.stopPropagation();
                  props.onVolumeChange(Number(e.currentTarget.value));
                }}
                type="range"
                value={props.state.volume}
              />
            </div>
          </div>
        </div>

        {/* Right Controls */}
        <div class="flex flex-wrap items-center justify-end gap-2">
          <Show when={props.state.audioList.length > 0}>
            <button
              aria-expanded={props.openPanel() === "audio"}
              aria-label={`Audio: ${currentAudioTrack()}`}
              class={cn(
                "rounded-full p-2 text-white transition-all",
                props.openPanel() === "audio" && "bg-white/20"
              )}
              onClick={(e) => {
                e.stopPropagation();
                props.setOpenPanel(
                  props.openPanel() === "audio" ? null : "audio"
                );
              }}
              ref={props.audioBtnRef}
            >
              <Show
                fallback={<AudioLines class="h-5 w-5" />}
                when={
                  props.state.audioIndex !== -1 && props.state.audioIndex !== 0
                }
              >
                <AudioWaveform class="h-5 w-5" />
              </Show>
            </button>
          </Show>

          <Show when={props.state.subtitleList.length > 0}>
            <button
              aria-expanded={props.openPanel() === "subtitles"}
              aria-label={`Subtitles: ${currentSubtitleTrack()}`}
              class={cn(
                "rounded-full p-2 text-white transition-all",
                props.openPanel() === "subtitles" && "bg-white/20"
              )}
              onClick={(e) => {
                e.stopPropagation();
                props.setOpenPanel(
                  props.openPanel() === "subtitles" ? null : "subtitles"
                );
              }}
              ref={props.subsBtnRef}
            >
              <Show
                fallback={<CaptionsOff class="h-5 w-5" />}
                when={props.state.subtitleIndex > 0}
              >
                <Captions class="h-5 w-5" />
              </Show>
            </button>
          </Show>

          <button
            aria-expanded={props.openPanel() === "speed"}
            aria-label={`Speed: ${currentSpeed()}`}
            class={cn(
              "rounded-full p-2 text-white transition-all",
              props.openPanel() === "speed" && "bg-white/20"
            )}
            onClick={(e) => {
              e.stopPropagation();
              props.setOpenPanel(
                props.openPanel() === "speed" ? null : "speed"
              );
            }}
            ref={props.speedBtnRef}
          >
            <Gauge class="h-5 w-5" />
          </button>

          <Show when={props.state.chapters.length > 0}>
            <button
              aria-expanded={props.openPanel() === "chapters"}
              aria-label="Chapters"
              class={cn(
                "rounded-full p-2 text-white transition-all",
                props.openPanel() === "chapters" && "bg-white/20"
              )}
              onClick={(e) => {
                e.stopPropagation();
                props.setOpenPanel(
                  props.openPanel() === "chapters" ? null : "chapters"
                );
              }}
            >
              <BookOpen class="h-5 w-5" />
            </button>
          </Show>

          <button
            aria-label="Picture in Picture"
            class="rounded-full p-2 text-white transition-all hover:bg-white/20"
            onClick={async (e) => {
              e.stopPropagation();
              const windows = await getAllWindows();
              const pipWindow = windows.find(
                (window) => window.label === "pip"
              );
              if (await pipWindow?.isVisible()) {
                await commands.hidePipWindow();
              } else {
                await props.onOpenPip();
              }
            }}
            title="Open Picture in Picture"
          >
            <PictureInPicture class="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
