import { For, Show } from 'solid-js';
import { commands } from '~/lib/tauri';
import { cn } from '~/lib/utils';
import { formatTime } from '~/components/video/utils';
import type { Track, OpenPanel, Chapter } from '~/components/video/types';

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
        ref={props.panelRef}
        class="max-h-96 bottom-full overflow-hidden  left-0 right-0 bg-black/95 backdrop-blur-md rounded-lg p-2 border border-white/20 shadow-2xl"
        onKeyDown={(e) => {
          if (e.key === 'Escape') props.setOpenPanel(null);
        }}
      >
        <Show when={props.openPanel === 'audio'}>
          <div class="flex flex-col gap-1">
            <button
              class={cn(
                'px-4 py-2 text-left text-white rounded-md hover:bg-white/20 transition-colors font-medium',
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
                    'px-4 py-2 text-left text-white rounded-md hover:bg-white/20 transition-colors font-medium',
                    props.state.audioIndex === track.id && 'bg-white/20'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    commands.playbackChangeAudio(track.id.toString());
                    props.setState('audioIndex', track.id);
                    props.setOpenPanel(null);
                  }}
                >
                  {`${track.title || ''} ${track.lang || ''}`.trim() ||
                    'Track'}
                </button>
              )}
            </For>
          </div>
        </Show>

        <Show when={props.openPanel === 'subtitles'}>
          <div class="flex flex-col gap-1 max-h-96 overflow-scroll">
            <button
              class={cn(
                'px-4 py-2 text-left text-white rounded-md hover:bg-white/20 transition-colors font-medium',
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
                    'px-4 py-2 text-left text-white rounded-md hover:bg-white/20 transition-colors font-medium',
                    props.state.subtitleIndex === track.id && 'bg-white/20'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    commands.playbackChangeSubtitle(
                      track.id.toString()
                    );
                    props.setState('subtitleIndex', track.id);
                    props.setOpenPanel(null);
                  }}
                >
                  {`${track.title || ''} ${track.lang || ''}`.trim() ||
                    'Track'}
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
                    'px-4 py-2 text-left text-white rounded-md hover:bg-white/20 transition-colors font-medium',
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
          <div class="flex flex-col gap-1 max-h-96 overflow-y-auto">
            <div class="text-xs text-white/60 px-4 py-2 border-b border-white/20">
              {props.state.chapters.length} chapters • Use , and . keys to navigate
            </div>
            <For each={props.state.chapters}>
              {(chapter, index) => {
                const startTimeSeconds = () => chapter.startPositionTicks / 10000000;
                const chapterName = () => chapter.name || `Chapter ${index() + 1}`;
                const isCurrentChapter = () => {
                  const currentTime = Number(props.state.currentTime || 0);
                  const chapterTime = startTimeSeconds();
                  const nextChapterTime = props.state.chapters[index() + 1] 
                    ? props.state.chapters[index() + 1].startPositionTicks / 10000000 
                    : props.state.duration;
                  return currentTime >= chapterTime && currentTime < nextChapterTime;
                };
                
                return (
                  <button
                    class={cn(
                      "px-4 py-3 text-left text-white rounded-md hover:bg-white/20 transition-colors w-full flex items-center gap-3",
                      isCurrentChapter() && "bg-blue-600/30 border-l-2 border-blue-400"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onNavigateToChapter(chapter);
                      props.setOpenPanel(null);
                    }}
                  >
                    <div class="flex-shrink-0 w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-xs font-bold">
                      {index() + 1}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-sm truncate">{chapterName()}</div>
                      <div class="text-xs text-white/60 mt-1">
                        {formatTime(startTimeSeconds())}
                      </div>
                    </div>
                    <Show when={isCurrentChapter()}>
                      <div class="flex-shrink-0 w-2 h-2 bg-blue-400 rounded-full"></div>
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
