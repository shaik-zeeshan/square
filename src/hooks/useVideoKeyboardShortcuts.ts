import { createEventListener } from '@solid-primitives/event-listener';
import { useNavigate } from '@solidjs/router';
import { commands } from '~/lib/tauri';

interface UseVideoKeyboardShortcutsProps {
  state: {
    playing: boolean;
    volume: number;
    showControls: boolean;
    chapters: any[];
    currentTime: string;
    duration: number;
  };
  openPanel: () => 'audio' | 'subtitles' | 'speed' | 'chapters' | null;
  setOpenPanel: (
    panel: 'audio' | 'subtitles' | 'speed' | 'chapters' | null
  ) => void;
  togglePlay: () => void;
  toggleMute: () => void;
  handleVolumeChange: (value: number) => void;
  showControls: () => void;
  navigateToChapter: (chapter: any) => void;
}

export function useVideoKeyboardShortcuts(
  props: UseVideoKeyboardShortcutsProps
) {
  const navigate = useNavigate();

  // Use SolidJS event listener primitive attached to window
  createEventListener(window, 'keydown', (e: KeyboardEvent) => {
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

      case 'KeyC':
        e.preventDefault();
        if (props.state.chapters.length > 0) {
          props.setOpenPanel(
            props.openPanel() === 'chapters' ? null : 'chapters'
          );
          props.showControls();
        }
        break;

      case 'Comma':
        e.preventDefault();
        if (props.state.chapters.length > 0) {
          // Previous chapter
          const currentTimeSeconds = Number(props.state.currentTime);
          const previousChapter = props.state.chapters
            .slice()
            .reverse()
            .find((chapter) => {
              const chapterTime = chapter.startPositionTicks / 10_000_000;
              return chapterTime < currentTimeSeconds - 2; // 2 second buffer
            });

          if (previousChapter) {
            props.navigateToChapter(previousChapter);
            props.showControls();
          }
        }
        break;

      case 'Period':
        e.preventDefault();
        if (props.state.chapters.length > 0) {
          // Next chapter
          const currentTimeSeconds = Number(props.state.currentTime);
          const nextChapter = props.state.chapters.find((chapter) => {
            const chapterTime = chapter.startPositionTicks / 10_000_000;
            return chapterTime > currentTimeSeconds + 2; // 2 second buffer
          });

          if (nextChapter) {
            props.navigateToChapter(nextChapter);
            props.showControls();
          }
        }
        break;
    }
  });
}
