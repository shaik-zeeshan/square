import { For, Show } from 'solid-js';
import { commands } from '~/lib/tauri';
import { cn } from '~/lib/utils';
import type { Track, OpenPanel } from '~/components/video/types';

interface VideoSettingsPanelsProps {
  openPanel: OpenPanel;
  setOpenPanel: (panel: OpenPanel) => void;
  state: {
    audioIndex: number;
    subtitleIndex: number;
    playbackSpeed: number;
    audioList: Track[];
    subtitleList: Track[];
  };
  setState: (key: string, value: any) => void;
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
              onClick={() => {
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
                  onClick={() => {
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
              onClick={() => {
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
                  onClick={() => {
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
                  onClick={() => {
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
      </div>
    </Show>
  );
}
