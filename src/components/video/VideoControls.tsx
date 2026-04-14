import {
  AudioLines,
  AudioWaveform,
  BookOpen,
  Captions,
  CaptionsOff,
  Fullscreen,
  Gauge,
  Pause,
  PictureInPicture2,
  Play,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
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
    bufferedTime: number;
    bufferingPercentage: number;
    isLoading: boolean;
    isBuffering: boolean;
    isSeeking: boolean;
    playbackError: string | null;
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
  isPip?: boolean;
  onSkipBack?: () => void;
  onSkipForward?: () => void;
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

  const clampedBufferedPercentage = () =>
    Math.max(0, Math.min(100, bufferedPercentage()));

  const displayPosition = () =>
    isDragging()
      ? (dragPosition() ?? progressPercentage())
      : progressPercentage();

  const getChapterAtPosition = (position: number) => {
    if (!props.state.chapters.length || props.state.duration <= 0) {
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

  const getPercentageFromClientX = (clientX: number) => {
    if (!progressRef) {
      return 0;
    }
    const rect = progressRef.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(100, (x / rect.width) * 100));
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

  const commitDrag = (clientX?: number) => {
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

  const cancelDrag = () => {
    if (!isDragging()) {
      return;
    }
    setIsDragging(false);
    setDragPosition(null);
  };

  createEffect(() => {
    if (!isDragging()) {
      return;
    }
    const onMove = (e: PointerEvent) => {
      updateDrag(e.clientX);
    };
    const onUp = (e: PointerEvent) => {
      commitDrag(e.clientX);
    };
    const onCancel = () => {
      cancelDrag();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("pointercancel", onCancel, { once: true });
    window.addEventListener("blur", onCancel, { once: true });
    onCleanup(() => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("blur", onCancel);
    });
  });

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

  const showThumb = () =>
    isHovering() ||
    isDragging() ||
    props.state.isBuffering ||
    props.state.isSeeking;

  const thumbPosition = () => {
    if (isDragging()) {
      return dragPosition() ?? progressPercentage();
    }
    if (isHovering() && hoverPosition() !== null) {
      return hoverPosition() ?? progressPercentage();
    }
    return progressPercentage();
  };

  const scrubberActive = () => isHovering() || isDragging();

  const handleSkipBack = () => {
    if (props.onSkipBack) {
      props.onSkipBack();
    } else {
      commands.playbackSeek(-10);
    }
  };

  const handleSkipForward = () => {
    if (props.onSkipForward) {
      props.onSkipForward();
    } else {
      commands.playbackSeek(10);
    }
  };

  const volumeDisplay = () =>
    props.state.isMuted
      ? "0%"
      : `${Math.round((props.state.volume / 200) * 100)}%`;

  const thumbSizeClass = () => {
    if (isDragging()) {
      return "h-5 w-5 bg-blue-300 shadow-[0_0_0_4px_rgba(96,165,250,0.25),0_0_20px_rgba(96,165,250,0.5)]";
    }
    if (props.state.isSeeking) {
      return "h-[15px] w-[15px] bg-blue-300 shadow-[0_0_0_3px_rgba(96,165,250,0.2),0_0_14px_rgba(96,165,250,0.4)]";
    }
    if (props.state.isBuffering) {
      return "h-3 w-3 animate-pulse bg-white/50 shadow-[0_0_0_3px_rgba(255,255,255,0.08)]";
    }
    return "h-[13px] w-[13px] bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.12),0_2px_10px_rgba(0,0,0,0.5)]";
  };

  const subtitlesBtnClass = () => {
    if (props.openPanel() === "subtitles") {
      return "bg-blue-400/[0.14] text-blue-300 ring-1 ring-inset ring-blue-400/[0.2]";
    }
    if (props.state.subtitleIndex > 0) {
      return "text-white/70 hover:bg-white/[0.08] hover:text-white/90";
    }
    return "text-white/45 hover:bg-white/[0.08] hover:text-white/90";
  };

  const speedBtnClass = () => {
    if (props.openPanel() === "speed") {
      return "bg-blue-400/[0.14] text-blue-300 ring-1 ring-inset ring-blue-400/[0.2]";
    }
    if (props.state.playbackSpeed !== 1) {
      return "text-white/70 hover:bg-white/[0.08] hover:text-white/90";
    }
    return "text-white/45 hover:bg-white/[0.08] hover:text-white/90";
  };

  return (
    <div class="controls-bar-enter rounded-2xl border border-white/[0.09] bg-[#0d1220]/85 shadow-[0_20px_60px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-[28px]">
      {/* ── Progress region ── */}
      <div class="px-4 pt-4 pb-1">
        {/* Scrubber */}
        <div
          aria-label="Video progress"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={displayPosition()}
          aria-valuetext={`${formatTime(Number(props.state.currentTime))} of ${formatTime(props.state.duration)}`}
          class="group relative flex cursor-pointer flex-col justify-center py-2.5"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              const step = e.key === "ArrowLeft" ? -1 : 1;
              props.onProgressClick(
                Math.max(0, Math.min(100, displayPosition() + step))
              );
              return;
            }
            if (e.key === "Home" || e.key === "End") {
              e.preventDefault();
              props.onProgressClick(e.key === "Home" ? 0 : 100);
            }
          }}
          onMouseEnter={() => {
            setIsHovering(true);
          }}
          onMouseLeave={() => {
            setIsHovering(false);
            setHoverPosition(null);
          }}
          onMouseMove={(e) => {
            const rect = (
              e.currentTarget as HTMLElement
            ).getBoundingClientRect();
            setHoverPosition(
              Math.max(
                0,
                Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)
              )
            );
          }}
          onPointerCancel={() => {
            cancelDrag();
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            beginDrag(e.clientX);
          }}
          onPointerMove={(e) => {
            updateDrag(e.clientX);
          }}
          onPointerUp={(e) => {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            commitDrag(e.clientX);
          }}
          role="slider"
          tabindex={0}
        >
          {/* Track */}
          <div
            class={cn(
              "relative overflow-visible rounded-full bg-white/[0.08] transition-all duration-200 ease-out",
              scrubberActive() ? "h-[6px]" : "h-[3px]",
              props.state.isSeeking && "h-[6px]"
            )}
            ref={(el) => {
              progressRef = el;
            }}
          >
            {/* Chapter segment backgrounds */}
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
                      props.state.duration > 0
                        ? Math.max(
                            0,
                            ((endSec - startSec) / props.state.duration) * 100
                          )
                        : 0;
                    const isCurrent = () => {
                      const current = Number(props.state.currentTime || 0);
                      return current >= startSec && current < endSec;
                    };
                    return (
                      <div
                        class={cn(
                          "h-full",
                          isCurrent() ? "bg-blue-400/[0.07]" : ""
                        )}
                        style={{ width: `${widthPct()}%` }}
                      >
                        <Show when={index() > 0}>
                          <div class="h-full w-px bg-white/[0.12]" />
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>

            <div class="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
              {/* Buffered range */}
              <div
                class="absolute top-0 left-0 h-full rounded-full bg-white/[0.16] transition-[width] duration-700 ease-out"
                style={{ width: `${clampedBufferedPercentage()}%` }}
              />

              {/* Buffering shimmer */}
              <Show when={props.state.isBuffering}>
                <div
                  class="absolute top-0 h-full w-16 rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  style={{
                    left: `${Math.max(0, Math.min(100, clampedBufferedPercentage() - 8))}%`,
                    animation: "shimmer 1.6s ease-in-out infinite",
                  }}
                />
              </Show>

              {/* Loading pulse overlay */}
              <Show when={props.state.isLoading}>
                <div class="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
              </Show>
            </div>

            {/* Played range — cool blue accent */}
            <div
              class={cn(
                "relative h-full rounded-full transition-none",
                props.state.isSeeking ? "bg-blue-300/80" : "bg-blue-400"
              )}
              style={{ width: `${displayPosition()}%` }}
            >
              {/* Blue glow at head */}
              <Show when={scrubberActive() && displayPosition() > 0}>
                <div
                  class="-translate-y-1/2 absolute top-1/2 right-0 h-[120%] w-6 rounded-full bg-blue-400/40 blur-sm"
                  style={{ animation: "amberPulse 1.8s ease-in-out infinite" }}
                />
              </Show>
            </div>

            {/* Chapter markers */}
            <Show when={props.state.chapters.length > 0}>
              <For each={props.state.chapters}>
                {(chapter, index) => {
                  const chapterPos = () =>
                    props.state.duration > 0
                      ? (chapter.startPositionTicks /
                          10_000_000 /
                          props.state.duration) *
                        100
                      : 0;
                  const chapterName = () =>
                    chapter.name || `Chapter ${index() + 1}`;
                  const chapterTimeFmt = () =>
                    formatTime(chapter.startPositionTicks / 10_000_000);
                  const isCurrentChapter = () => {
                    const ct = Number(props.state.currentTime || 0);
                    const start = chapter.startPositionTicks / 10_000_000;
                    const end = props.state.chapters[index() + 1]
                      ? props.state.chapters[index() + 1].startPositionTicks /
                        10_000_000
                      : props.state.duration;
                    return ct >= start && ct < end;
                  };
                  return (
                    <div
                      class="group/chapter absolute top-0 h-full"
                      style={{ left: `${chapterPos()}%` }}
                    >
                      <button
                        aria-label={`Go to ${chapterName()} at ${chapterTimeFmt()}`}
                        class={cn(
                          "h-full w-[2px] cursor-pointer rounded-full transition-all duration-150 hover:w-[3px] hover:scale-y-[2.2]",
                          isCurrentChapter()
                            ? "bg-blue-300"
                            : "bg-white/25 hover:bg-white/55"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onNavigateToChapter(chapter);
                        }}
                      />
                      {/* Chapter tooltip */}
                      <div class="-translate-x-1/2 pointer-events-none absolute bottom-full left-1/2 z-20 mb-5 rounded-xl border border-white/[0.1] bg-[#0d1220]/95 px-3 py-2.5 text-white text-xs opacity-0 shadow-[0_12px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl transition-opacity duration-150 group-hover/chapter:opacity-100">
                        <div class="flex items-center gap-2">
                          <span class="font-semibold tracking-tight">
                            {chapterName()}
                          </span>
                          <Show when={isCurrentChapter()}>
                            <span
                              class="h-1.5 w-1.5 rounded-full bg-blue-400"
                              style={{
                                animation: "liveDot 1.4s ease-in-out infinite",
                              }}
                            />
                          </Show>
                        </div>
                        <div class="mt-0.5 font-mono text-[11px] text-white/40">
                          {chapterTimeFmt()}
                        </div>
                        <div class="-translate-x-1/2 absolute top-full left-1/2 h-0 w-0 border-transparent border-t-4 border-t-[#0d1220]/95 border-r-4 border-l-4" />
                      </div>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>

          {/* Scrubber thumb — floats above track */}
          <Show when={showThumb()}>
            <div
              class={cn(
                "-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 rounded-full transition-all duration-[160ms]",
                thumbSizeClass()
              )}
              style={{ left: `${thumbPosition()}%` }}
            />
          </Show>

          {/* Drag time badge */}
          <Show when={isDragging()}>
            <div
              class="-translate-x-1/2 pointer-events-none absolute bottom-full z-10 mb-5 rounded-lg border border-blue-400/20 bg-[#0d1220]/95 px-2.5 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
              style={{
                left: `${dragPosition() ?? progressPercentage()}%`,
              }}
            >
              <div class="font-bold font-mono text-blue-200 text-sm tabular-nums tracking-tight">
                {props.state.duration > 0
                  ? formatTime(
                      ((dragPosition() ?? 0) / 100) * props.state.duration
                    )
                  : "--:--"}
              </div>
              {(() => {
                const chapterInfo = getChapterAtPosition(dragPosition() ?? 0);
                return (
                  <Show when={chapterInfo}>
                    <div class="mt-0.5 text-[10px] text-white/45 tracking-tight">
                      {chapterInfo?.chapter.name ||
                        `Chapter ${(chapterInfo?.index ?? 0) + 1}`}
                    </div>
                  </Show>
                );
              })()}
              <div class="-translate-x-1/2 absolute top-full left-1/2 h-0 w-0 border-transparent border-t-4 border-t-[#0d1220]/95 border-r-4 border-l-4" />
            </div>
          </Show>

          {/* Hover time tooltip */}
          <Show
            when={isHovering() && hoverPosition() !== null && !isDragging()}
          >
            {(() => {
              const chapterInfo = getChapterAtPosition(hoverPosition() ?? 0);
              return (
                <div
                  class="-translate-x-1/2 pointer-events-none absolute bottom-full z-10 mb-5 rounded-xl border border-white/[0.08] bg-[#0d1220]/95 px-3 py-2 text-white text-xs shadow-[0_8px_32px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
                  style={{
                    left: `${hoverPosition()}%`,
                  }}
                >
                  <div class="font-mono font-semibold tabular-nums tracking-tight">
                    {props.state.duration > 0
                      ? formatTime(
                          ((hoverPosition() ?? 0) / 100) * props.state.duration
                        )
                      : "--:--"}
                  </div>
                  <Show when={chapterInfo}>
                    <div class="mt-0.5 text-[11px] text-white/40">
                      {chapterInfo?.chapter.name ||
                        `Chapter ${(chapterInfo?.index ?? 0) + 1}`}
                    </div>
                  </Show>
                  <div class="-translate-x-1/2 absolute top-full left-1/2 h-0 w-0 border-transparent border-t-4 border-t-[#0d1220]/95 border-r-4 border-l-4" />
                </div>
              );
            })()}
          </Show>
        </div>

        {/* Time row */}
        <div class="flex items-center justify-between px-0.5 pb-1">
          <span class="font-medium font-mono text-[11px] text-white/55 tabular-nums tracking-tight">
            {formatTime(Number(props.state.currentTime))}
          </span>
          <Show when={props.state.isBuffering || props.state.isSeeking}>
            <span class="animate-pulse font-mono text-[10px] text-blue-400/70 tabular-nums">
              {props.state.isSeeking ? "seeking…" : "buffering…"}
            </span>
          </Show>
          <span class="font-medium font-mono text-[11px] text-white/30 tabular-nums tracking-tight">
            {formatTime(props.state.duration)}
          </span>
        </div>
      </div>

      {/* ── Controls Row ── */}
      <div class="flex items-center justify-between gap-2 px-3 pt-0.5 pb-3">
        {/* Left: Play/Pause · Skip · Volume */}
        <div class="flex items-center gap-0.5">
          {/* Skip Back */}
          <button
            aria-label="Skip back 10 seconds"
            class="group relative flex h-9 w-9 items-center justify-center rounded-xl text-white/50 transition-all duration-150 hover:bg-white/[0.08] hover:text-white/90 active:scale-[0.88] active:bg-white/[0.12]"
            onClick={(e) => {
              e.stopPropagation();
              handleSkipBack();
            }}
            title="Skip back 10s (J / ←)"
          >
            <SkipBack class="h-[16px] w-[16px]" />
            <span class="-bottom-0 pointer-events-none absolute font-bold font-mono text-[7px] text-white/30 leading-none transition-colors duration-150 group-hover:text-white/60">
              10
            </span>
          </button>

          {/* Play/Pause — primary */}
          <button
            aria-label={props.state.playing ? "Pause" : "Play"}
            class={cn(
              "mx-1 flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ring-inset transition-all duration-150 active:scale-[0.90]",
              props.state.playing
                ? "bg-white/[0.13] text-white ring-white/[0.15] hover:bg-white/[0.2] hover:ring-white/[0.22]"
                : "bg-blue-400/[0.12] text-blue-200 ring-blue-400/[0.18] hover:bg-blue-400/[0.2] hover:ring-blue-400/[0.25]"
            )}
            onClick={(e) => {
              e.stopPropagation();
              props.onTogglePlay();
            }}
          >
            <Show
              fallback={
                <Play class="h-4 w-4 translate-x-[1px]" fill="currentColor" />
              }
              when={props.state.playing}
            >
              <Pause class="h-4 w-4" fill="currentColor" />
            </Show>
          </button>

          {/* Skip Forward */}
          <button
            aria-label="Skip forward 10 seconds"
            class="group relative flex h-9 w-9 items-center justify-center rounded-xl text-white/50 transition-all duration-150 hover:bg-white/[0.08] hover:text-white/90 active:scale-[0.88] active:bg-white/[0.12]"
            onClick={(e) => {
              e.stopPropagation();
              handleSkipForward();
            }}
            title="Skip forward 10s (L / →)"
          >
            <SkipForward class="h-[16px] w-[16px]" />
            <span class="-bottom-0 pointer-events-none absolute font-bold font-mono text-[7px] text-white/30 leading-none transition-colors duration-150 group-hover:text-white/60">
              10
            </span>
          </button>

          {/* Volume cluster */}
          <div class="ml-2.5 flex items-center gap-2">
            <button
              aria-label={props.state.isMuted ? "Unmute" : "Mute"}
              class="flex h-8 w-8 items-center justify-center rounded-xl text-white/50 transition-all duration-150 hover:bg-white/[0.08] hover:text-white/90 active:scale-[0.88]"
              onClick={(e) => {
                e.stopPropagation();
                props.onToggleMute();
              }}
            >
              {(() => {
                const VolumeIcon = getVolumeIcon();
                return <VolumeIcon class="h-4 w-4" />;
              })()}
            </button>

            {/* Volume slider */}
            <div class="group/vol relative flex w-[88px] items-center sm:w-24">
              <div class="pointer-events-none relative h-[3px] w-full overflow-hidden rounded-full bg-white/[0.12] transition-all duration-150 group-hover/vol:h-[5px]">
                <div
                  class="h-full rounded-full bg-white/70 transition-[width] duration-75"
                  style={{ width: `${(props.state.volume / 200) * 100}%` }}
                />
              </div>
              <input
                aria-label="Volume"
                class="vol-slider absolute inset-0 h-full w-full cursor-pointer opacity-0"
                max="200"
                min="0"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onInput={(e) => {
                  e.stopPropagation();
                  props.onVolumeChange(Number(e.currentTarget.value));
                }}
                type="range"
                value={props.state.volume}
              />
            </div>

            <span class="hidden min-w-[30px] text-right font-mono text-[10px] text-white/25 tabular-nums sm:block">
              {volumeDisplay()}
            </span>
          </div>
        </div>

        {/* Right: Feature buttons + PiP + Fullscreen */}
        <div class="flex items-center gap-0.5">
          <Show when={props.state.audioList.length > 0}>
            <button
              aria-expanded={props.openPanel() === "audio"}
              aria-label={`Audio track: ${currentAudioTrack()}`}
              class={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-150 active:scale-[0.88]",
                props.openPanel() === "audio"
                  ? "bg-blue-400/[0.14] text-blue-300 ring-1 ring-blue-400/[0.2] ring-inset"
                  : "text-white/45 hover:bg-white/[0.08] hover:text-white/90"
              )}
              onClick={(e) => {
                e.stopPropagation();
                props.setOpenPanel(
                  props.openPanel() === "audio" ? null : "audio"
                );
              }}
              ref={props.audioBtnRef}
              title={`Audio: ${currentAudioTrack()}`}
            >
              <Show
                fallback={<AudioLines class="h-[15px] w-[15px]" />}
                when={
                  props.state.audioIndex !== -1 && props.state.audioIndex !== 0
                }
              >
                <AudioWaveform class="h-[15px] w-[15px]" />
              </Show>
            </button>
          </Show>

          <Show when={props.state.subtitleList.length > 0}>
            <button
              aria-expanded={props.openPanel() === "subtitles"}
              aria-label={`Subtitles: ${currentSubtitleTrack()}`}
              class={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-150 active:scale-[0.88]",
                subtitlesBtnClass()
              )}
              onClick={(e) => {
                e.stopPropagation();
                props.setOpenPanel(
                  props.openPanel() === "subtitles" ? null : "subtitles"
                );
              }}
              ref={props.subsBtnRef}
              title={`Subtitles: ${currentSubtitleTrack()}`}
            >
              <Show
                fallback={<CaptionsOff class="h-[15px] w-[15px]" />}
                when={props.state.subtitleIndex > 0}
              >
                <Captions class="h-[15px] w-[15px]" />
              </Show>
            </button>
          </Show>

          {/* Speed */}
          <button
            aria-expanded={props.openPanel() === "speed"}
            aria-label={`Playback speed: ${currentSpeed()}`}
            class={cn(
              "relative flex h-8 min-w-[2rem] items-center justify-center rounded-xl px-2 transition-all duration-150 active:scale-[0.88]",
              speedBtnClass()
            )}
            onClick={(e) => {
              e.stopPropagation();
              props.setOpenPanel(
                props.openPanel() === "speed" ? null : "speed"
              );
            }}
            ref={props.speedBtnRef}
            title={`Speed: ${currentSpeed()}`}
          >
            <Show
              fallback={<Gauge class="h-[15px] w-[15px]" />}
              when={props.state.playbackSpeed !== 1}
            >
              <span class="font-bold font-mono text-[11px] tabular-nums tracking-tight">
                {currentSpeed()}
              </span>
            </Show>
          </button>

          <Show when={props.state.chapters.length > 0}>
            <button
              aria-expanded={props.openPanel() === "chapters"}
              aria-label="Chapters"
              class={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-150 active:scale-[0.88]",
                props.openPanel() === "chapters"
                  ? "bg-blue-400/[0.14] text-blue-300 ring-1 ring-blue-400/[0.2] ring-inset"
                  : "text-white/45 hover:bg-white/[0.08] hover:text-white/90"
              )}
              onClick={(e) => {
                e.stopPropagation();
                props.setOpenPanel(
                  props.openPanel() === "chapters" ? null : "chapters"
                );
              }}
              title="Chapters (C)"
            >
              <BookOpen class="h-[15px] w-[15px]" />
            </button>
          </Show>

          {/* Divider */}
          <div class="mx-2 h-4 w-px bg-white/[0.09]" />

          {/* PiP — manual only */}
          <button
            aria-label={
              props.isPip
                ? "Close Picture in Picture"
                : "Open Picture in Picture"
            }
            aria-pressed={props.isPip ?? false}
            class={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-150 active:scale-[0.88]",
              props.isPip
                ? "bg-blue-400/[0.14] text-blue-300 ring-1 ring-blue-400/[0.2] ring-inset"
                : "text-white/45 hover:bg-white/[0.08] hover:text-white/90"
            )}
            onClick={async (e) => {
              e.stopPropagation();
              await props.onOpenPip();
            }}
            title={
              props.isPip
                ? "Close Picture in Picture (P)"
                : "Picture in Picture (P)"
            }
          >
            <PictureInPicture2 class="h-[15px] w-[15px]" />
          </button>

          {/* Fullscreen */}
          <button
            aria-label="Toggle fullscreen"
            class="flex h-8 w-8 items-center justify-center rounded-xl text-white/45 transition-all duration-150 hover:bg-white/[0.08] hover:text-white/90 active:scale-[0.88]"
            onClick={(e) => {
              e.stopPropagation();
              commands.toggleFullscreen();
            }}
            title="Fullscreen (F)"
          >
            <Fullscreen class="h-[15px] w-[15px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
