import { For, Show } from 'solid-js';
import type { Chapter, OpenPanel, Track } from '~/components/video/types';
import { formatTime } from '~/components/video/utils';
import { commands } from '~/lib/tauri';
import { cn } from '~/lib/utils';

interface VideoSettingsPanelsProps {
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
  setState: (key: string, value: any) => void;
  onNavigateToChapter: (chapter: Chapter) => void;
  panelRef?: HTMLDivElement;
}

export default function VideoSettingsPanels(props: VideoSettingsPanelsProps) {
  const setSpeed = (speed: number) => {
    commands.playbackSpeed(speed);
    props.setState('playbackSpeed', speed);
  };

  return (
    <Show when={props.openPanel !== null}>
      <div
        class="right-0 bottom-full left-0 max-h-96 overflow-hidden rounded-lg border border-white/20 bg-black/95 p-2 shadow-2xl backdrop-blur-md"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            props.setOpenPanel(null);
          }
        }}
        ref={props.panelRef}
      >
        <Show when={props.openPanel === 'audio'}>
          <div class="flex flex-col gap-1">
            <button
              class={cn(
                'rounded-md px-4 py-2 text-left font-medium text-white transition-colors hover:bg-white/20',
                props.state.audioIndex === 0 && 'bg-white/20'
              )}
              onClick={(e) => {
                e.stopPropagation();
                commands.playbackChangeAudio('0');
                props.setState('audioIndex', 0);
                props.setOpenPanel(null);
              }}
            >
              No Audio
            </button>
            <For each={props.state.audioList}>
              {(track) => (
                <button
                  class={cn(
                    'rounded-md px-4 py-2 text-left font-medium text-white transition-colors hover:bg-white/20',
                    props.state.audioIndex === track.id && 'bg-white/20'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    commands.playbackChangeAudio(track.id.toString());
                    props.setState('audioIndex', track.id);
                    props.setOpenPanel(null);
                  }}
                >
                  {`${track.title || ''} ${track.lang || ''}`.trim() || 'Track'}
                </button>
              )}
            </For>
          </div>
        </Show>

        <Show when={props.openPanel === 'subtitles'}>
          <div class="flex max-h-96 flex-col gap-1 overflow-scroll">
            <button
              class={cn(
                'rounded-md px-4 py-2 text-left font-medium text-white transition-colors hover:bg-white/20',
                (props.state.subtitleIndex === 0 ||
                  props.state.subtitleIndex === -1) &&
                  'bg-white/20'
              )}
              onClick={(e) => {
                e.stopPropagation();
                commands.playbackChangeSubtitle('0');
                props.setState('subtitleIndex', 0);
                props.setOpenPanel(null);
              }}
            >
              Off
            </button>
            <For each={props.state.subtitleList}>
              {(track) => (
                <button
                  class={cn(
                    'rounded-md px-4 py-2 text-left font-medium text-white transition-colors hover:bg-white/20',
                    props.state.subtitleIndex === track.id && 'bg-white/20'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    commands.playbackChangeSubtitle(track.id.toString());
                    props.setState('subtitleIndex', track.id);
                    props.setOpenPanel(null);
                  }}
                >
                  {`${track.title || ''} ${track.lang || ''}`.trim() || 'Track'}
                </button>
              )}
            </For>
          </div>
        </Show>

        <Show when={props.openPanel === 'speed'}>
          <div class="flex flex-col gap-1">
            <For each={[0.5, 1, 1.5, 2]}>
              {(speed) => (
                <button
                  class={cn(
                    'rounded-md px-4 py-2 text-left font-medium text-white transition-colors hover:bg-white/20',
                    props.state.playbackSpeed === speed && 'bg-white/20'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSpeed(speed);
                    props.setOpenPanel(null);
                  }}
                >
                  {speed}x
                </button>
              )}
            </For>
          </div>
        </Show>

        <Show when={props.openPanel === 'chapters'}>
          <div class="flex max-h-96 flex-col gap-1 overflow-y-auto">
            <div class="border-white/20 border-b px-4 py-2 text-white/60 text-xs">
              {props.state.chapters.length} chapters • Use , and . keys to
              navigate
            </div>
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
                      'flex w-full items-center gap-3 rounded-md px-4 py-3 text-left text-white transition-colors hover:bg-white/20',
                      isCurrentChapter() &&
                        'border-blue-400 border-l-2 bg-blue-600/30'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onNavigateToChapter(chapter);
                      props.setOpenPanel(null);
                    }}
                  >
                    <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/10 font-bold text-xs">
                      {index() + 1}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="truncate font-medium text-sm">
                        {chapterName()}
                      </div>
                      <div class="mt-1 text-white/60 text-xs">
                        {formatTime(startTimeSeconds())}
                      </div>
                    </div>
                    <Show when={isCurrentChapter()}>
                      <div class="h-2 w-2 flex-shrink-0 rounded-full bg-blue-400" />
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
