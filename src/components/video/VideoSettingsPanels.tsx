import { Check } from "lucide-solid";
import { For, Show } from "solid-js";
import type { Chapter, OpenPanel, Track } from "~/components/video/types";
import { formatTime } from "~/components/video/utils";
import { commands } from "~/lib/tauri";
import { cn } from "~/lib/utils";

/** Move focus into the panel so keyboard events (including Escape) are received. */
function focusPanel(el: HTMLDivElement) {
  // Defer one microtask so the element is fully in the DOM before focusing.
  Promise.resolve().then(() => el.focus({ preventScroll: true }));
}

type VideoSettingsPanelsProps = {
  openPanel: OpenPanel;
  setOpenPanel: (panel: OpenPanel) => void;
  state: {
    audioIndex: number;
    subtitleIndex: number;
    playbackSpeed: number;
    audioList: Track[];
    subtitleList: Track[];
    chapters: Chapter[];
    duration: number;
    currentTime: string;
  };
  setState: (key: string, value: unknown) => void;
  onNavigateToChapter: (chapter: Chapter) => void;
  onSelectAudioTrack?: (track: Track) => void;
  onSelectSubtitleTrack?: (track: Track | null) => void;
  panelRef?: (el: HTMLDivElement) => void;
};

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

// Section header inside a panel
function PanelHeader(props: { children: string; sub?: string }) {
  return (
    <div class="mb-1.5 flex items-baseline gap-2 px-3 pt-2 pb-0.5">
      <span class="font-medium text-[10px] text-white/30 uppercase tracking-widest">
        {props.children}
      </span>
      <Show when={props.sub}>
        <span class="font-normal text-[10px] text-white/20 normal-case">
          {props.sub}
        </span>
      </Show>
    </div>
  );
}

export default function VideoSettingsPanels(props: VideoSettingsPanelsProps) {
  const setSpeed = (speed: number) => {
    commands.playbackSpeed(speed);
    props.setState("playbackSpeed", speed);
  };

  return (
    <Show when={props.openPanel !== null}>
      {/* Panel wrapper — slides up above controls */}
      <div
        aria-label={`${props.openPanel} settings`}
        class="panel-reveal max-h-[320px] overflow-hidden rounded-2xl border border-white/[0.09] bg-black/88 p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.06)] outline-none backdrop-blur-[28px]"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            props.setOpenPanel(null);
          }
        }}
        ref={(el) => {
          // Forward element to parent ref callback then focus for keyboard access.
          props.panelRef?.(el);
          focusPanel(el);
        }}
        role="dialog"
        tabindex="-1"
      >
        {/* ── Audio panel ── */}
        <Show when={props.openPanel === "audio"}>
          <div class="flex flex-col gap-0.5">
            <PanelHeader>Audio Track</PanelHeader>
            <button
              class={cn(
                "group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-all duration-100",
                props.state.audioIndex === 0
                  ? "bg-amber-400/[0.1] font-medium text-white"
                  : "font-normal text-white/65 hover:bg-white/[0.06] hover:text-white"
              )}
              onClick={(e) => {
                e.stopPropagation();
                if (props.onSelectAudioTrack) {
                  // Use "No Audio" as a special track with id 0
                  commands.playbackChangeAudio("0");
                  props.setState("audioIndex", 0);
                } else {
                  commands.playbackChangeAudio("0");
                  props.setState("audioIndex", 0);
                }
                props.setOpenPanel(null);
              }}
            >
              <span class="flex h-4 w-4 shrink-0 items-center justify-center">
                <Show when={props.state.audioIndex === 0}>
                  <Check class="h-3.5 w-3.5 text-amber-400" />
                </Show>
              </span>
              No Audio
            </button>
            <For each={props.state.audioList}>
              {(track) => (
                <button
                  class={cn(
                    "group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-all duration-100",
                    props.state.audioIndex === track.id
                      ? "bg-amber-400/[0.1] font-medium text-white"
                      : "font-normal text-white/65 hover:bg-white/[0.06] hover:text-white"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (props.onSelectAudioTrack) {
                      props.onSelectAudioTrack(track);
                    } else {
                      commands.playbackChangeAudio(track.id.toString());
                      props.setState("audioIndex", track.id);
                    }
                    props.setOpenPanel(null);
                  }}
                >
                  <span class="flex h-4 w-4 shrink-0 items-center justify-center">
                    <Show when={props.state.audioIndex === track.id}>
                      <Check class="h-3.5 w-3.5 text-amber-400" />
                    </Show>
                  </span>
                  {`${track.title || ""} ${track.lang || ""}`.trim() || "Track"}
                </button>
              )}
            </For>
          </div>
        </Show>

        {/* ── Subtitles panel ── */}
        <Show when={props.openPanel === "subtitles"}>
          <div class="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
            <PanelHeader>Subtitles</PanelHeader>
            <button
              class={cn(
                "group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-all duration-100",
                props.state.subtitleIndex === 0 ||
                  props.state.subtitleIndex === -1
                  ? "bg-amber-400/[0.1] font-medium text-white"
                  : "font-normal text-white/65 hover:bg-white/[0.06] hover:text-white"
              )}
              onClick={(e) => {
                e.stopPropagation();
                if (props.onSelectSubtitleTrack) {
                  props.onSelectSubtitleTrack(null);
                } else {
                  commands.playbackChangeSubtitle("0");
                  props.setState("subtitleIndex", 0);
                }
                props.setOpenPanel(null);
              }}
            >
              <span class="flex h-4 w-4 shrink-0 items-center justify-center">
                <Show
                  when={
                    props.state.subtitleIndex === 0 ||
                    props.state.subtitleIndex === -1
                  }
                >
                  <Check class="h-3.5 w-3.5 text-amber-400" />
                </Show>
              </span>
              Off
            </button>
            <For each={props.state.subtitleList}>
              {(track) => (
                <button
                  class={cn(
                    "group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-all duration-100",
                    props.state.subtitleIndex === track.id
                      ? "bg-amber-400/[0.1] font-medium text-white"
                      : "font-normal text-white/65 hover:bg-white/[0.06] hover:text-white"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (props.onSelectSubtitleTrack) {
                      props.onSelectSubtitleTrack(track);
                    } else {
                      commands.playbackChangeSubtitle(track.id.toString());
                      props.setState("subtitleIndex", track.id);
                    }
                    props.setOpenPanel(null);
                  }}
                >
                  <span class="flex h-4 w-4 shrink-0 items-center justify-center">
                    <Show when={props.state.subtitleIndex === track.id}>
                      <Check class="h-3.5 w-3.5 text-amber-400" />
                    </Show>
                  </span>
                  {`${track.title || ""} ${track.lang || ""}`.trim() || "Track"}
                </button>
              )}
            </For>
          </div>
        </Show>

        {/* ── Speed panel ── */}
        <Show when={props.openPanel === "speed"}>
          <div class="flex flex-col gap-1">
            <PanelHeader>Playback Speed</PanelHeader>
            <div class="grid grid-cols-4 gap-1 px-1 pb-1.5">
              <For each={SPEED_OPTIONS}>
                {(speed) => (
                  <button
                    class={cn(
                      "rounded-xl px-3 py-2 font-mono text-sm tabular-nums transition-all duration-100 active:scale-[0.94]",
                      props.state.playbackSpeed === speed
                        ? "bg-amber-400/[0.14] font-semibold text-amber-300 ring-1 ring-amber-400/[0.18] ring-inset"
                        : "font-normal text-white/60 hover:bg-white/[0.07] hover:text-white"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSpeed(speed);
                      props.setOpenPanel(null);
                    }}
                  >
                    {speed}×
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* ── Chapters panel ── */}
        <Show when={props.openPanel === "chapters"}>
          <div class="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
            <PanelHeader
              sub={"· , . keys to navigate"}
            >{`${props.state.chapters.length} Chapter${props.state.chapters.length !== 1 ? "s" : ""}`}</PanelHeader>
            <For each={props.state.chapters}>
              {(chapter, index) => {
                const startTimeSeconds = () =>
                  chapter.startPositionTicks / 10_000_000;
                const chapterName = () =>
                  chapter.name || `Chapter ${index() + 1}`;
                const isCurrentChapter = () => {
                  const currentTime = Number(props.state.currentTime || 0);
                  const chapterTime = startTimeSeconds();
                  const nextChapterTime = props.state.chapters[index() + 1]
                    ? props.state.chapters[index() + 1].startPositionTicks /
                      10_000_000
                    : props.state.duration;
                  return (
                    currentTime >= chapterTime && currentTime < nextChapterTime
                  );
                };

                return (
                  <button
                    class={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-white transition-all duration-100 active:scale-[0.98]",
                      isCurrentChapter()
                        ? "bg-amber-400/[0.09] ring-1 ring-amber-400/[0.1] ring-inset"
                        : "hover:bg-white/[0.06]"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onNavigateToChapter(chapter);
                      props.setOpenPanel(null);
                    }}
                  >
                    {/* Chapter index badge */}
                    <div
                      class={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] tabular-nums",
                        isCurrentChapter()
                          ? "bg-amber-400/[0.18] font-semibold text-amber-300"
                          : "bg-white/[0.07] font-medium text-white/45"
                      )}
                    >
                      {index() + 1}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div
                        class={cn(
                          "truncate text-sm",
                          isCurrentChapter()
                            ? "font-medium text-white"
                            : "font-normal text-white/70"
                        )}
                      >
                        {chapterName()}
                      </div>
                      <div class="mt-0.5 font-mono text-[11px] text-white/30 tabular-nums">
                        {formatTime(startTimeSeconds())}
                      </div>
                    </div>
                    <Show when={isCurrentChapter()}>
                      <div
                        class="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
                        style={{
                          animation: "liveDot 1.4s ease-in-out infinite",
                        }}
                      />
                    </Show>
                  </button>
                );
              }}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  );
}
