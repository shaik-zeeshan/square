import { createEffect, onCleanup } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { commands } from '~/lib/tauri';

interface UseVideoKeyboardShortcutsProps {
  state: {
    playing: boolean;
    volume: number;
    showControls: boolean;
  };
  openPanel: () => 'audio' | 'subtitles' | 'speed' | null;
  setOpenPanel: (panel: 'audio' | 'subtitles' | 'speed' | null) => void;
  togglePlay: () => void;
  toggleMute: () => void;
  handleVolumeChange: (value: number) => void;
  showControls: () => void;
}

export function useVideoKeyboardShortcuts(props: UseVideoKeyboardShortcutsProps) {
  const navigate = useNavigate();

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
          props.togglePlay();
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
          props.toggleMute();
          props.showControls();
          break;

        case 'Equal':
        case 'NumpadAdd':
          e.preventDefault();
          props.handleVolumeChange(Math.min(200, props.state.volume + 5));
          props.showControls();
          break;

        case 'Minus':
        case 'NumpadSubtract':
          e.preventDefault();
          props.handleVolumeChange(Math.max(0, props.state.volume - 5));
          props.showControls();
          break;

        case 'KeyF':
          e.preventDefault();
          commands.toggleFullscreen();
          break;

        case 'Escape':
          e.preventDefault();
          if (props.openPanel()) {
            props.setOpenPanel(null);
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
}
