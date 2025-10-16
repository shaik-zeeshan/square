import { createEventListener } from "@solid-primitives/event-listener";
import { useNavigate } from "@solidjs/router";
import type { Chapter, OSDType, Track } from "~/components/video/types";
import { commands } from "~/lib/tauri";

type UseVideoKeyboardShortcutsProps = {
  state: {
    playing: boolean;
    volume: number;
    showControls: boolean;
    chapters: Chapter[];
    currentTime: string;
    duration: number;
    playbackSpeed: number;
    audioList: Track[];
    subtitleList: Track[];
    audioIndex: number;
    subtitleIndex: number;
  };
  openPanel: () => "audio" | "subtitles" | "speed" | "chapters" | null;
  setOpenPanel: (
    panel: "audio" | "subtitles" | "speed" | "chapters" | null
  ) => void;
  togglePlay: () => void;
  toggleMute: () => void;
  handleVolumeChange: (value: number) => void;
  setSpeed: (speed: number) => void;
  showControls: () => void;
  navigateToChapter: (chapter: Chapter) => void;
  toggleHelp: () => void;
  showOSD: (
    type: OSDType,
    value: string | number | null,
    label?: string
  ) => void;
};

export function useVideoKeyboardShortcuts(
  props: UseVideoKeyboardShortcutsProps
) {
  const navigate = useNavigate();

  // Use SolidJS event listener primitive attached to window
  // biome-ignore lint/nursery/noMisusedPromises: event handler is async
  createEventListener(window, "keydown", async (e: KeyboardEvent) => {
    if (
      (e.target as HTMLElement).tagName === "INPUT" ||
      (e.target as HTMLElement).tagName === "TEXTAREA"
    ) {
      return;
    }

    switch (e.code) {
      case "Space":
      case "KeyK":
        e.preventDefault();
        props.togglePlay();
        break;

      case "ArrowLeft":
        e.preventDefault();
        if (e.shiftKey) {
          // Frame step -1s
          commands.playbackSeek(-1);
          props.showOSD("seek", -1);
        } else {
          // Seek -10s
          commands.playbackSeek(-10);
          props.showOSD("seek", -10);
        }
        props.showControls();
        break;

      case "KeyJ":
        e.preventDefault();
        commands.playbackSeek(-10);
        props.showOSD("seek", -10);
        props.showControls();
        break;

      case "ArrowRight":
        e.preventDefault();
        if (e.shiftKey) {
          // Frame step +1s
          commands.playbackSeek(1);
          props.showOSD("seek", 1);
        } else {
          // Seek +10s
          commands.playbackSeek(10);
          props.showOSD("seek", 10);
        }
        props.showControls();
        break;

      case "KeyL":
        e.preventDefault();
        commands.playbackSeek(10);
        props.showOSD("seek", 10);
        props.showControls();
        break;

      case "ArrowUp":
        e.preventDefault();
        commands.playbackSeek(60);
        props.showOSD("seek", 60);
        props.showControls();
        break;

      case "ArrowDown":
        e.preventDefault();
        commands.playbackSeek(-60);
        props.showOSD("seek", -60);
        props.showControls();
        break;

      case "KeyM":
        e.preventDefault();
        props.toggleMute();
        props.showControls();
        break;

      case "Equal":
      case "NumpadAdd":
        e.preventDefault();
        props.handleVolumeChange(Math.min(200, props.state.volume + 5));
        props.showControls();
        break;

      case "Minus":
      case "NumpadSubtract":
        e.preventDefault();
        props.handleVolumeChange(Math.max(0, props.state.volume - 5));
        props.showControls();
        break;

      case "KeyF":
        e.preventDefault();
        commands.toggleFullscreen();
        break;

      case "Escape":
        e.preventDefault();
        if (props.openPanel()) {
          props.setOpenPanel(null);
        } else {
          commands.playbackPause();
          navigate(-1);
        }
        break;

      case "KeyC":
        e.preventDefault();
        if (props.state.chapters.length > 0) {
          props.setOpenPanel(
            props.openPanel() === "chapters" ? null : "chapters"
          );
          props.showControls();
        }
        break;

      case "Comma":
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

      case "Period":
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

      // Speed controls
      case "BracketLeft": {
        e.preventDefault();
        const newSpeedDown = Math.max(0.25, props.state.playbackSpeed - 0.25);
        props.setSpeed(newSpeedDown);
        props.showControls();
        break;
      }

      case "BracketRight": {
        e.preventDefault();
        const newSpeedUp = Math.min(3, props.state.playbackSpeed + 0.25);
        props.setSpeed(newSpeedUp);
        props.showControls();
        break;
      }

      case "Backslash":
        e.preventDefault();
        props.setSpeed(1);
        props.showControls();
        break;

      // Audio and subtitle cycling
      case "KeyA":
        e.preventDefault();
        if (props.state.audioList.length > 0) {
          const currentIndex = props.state.audioIndex;
          const currentAudioTrackIndx = props.state.audioList.findIndex(
            (track) => track.id === currentIndex
          );
          const nextIndex =
            currentAudioTrackIndx === -1
              ? 0
              : (currentAudioTrackIndx + 1) % props.state.audioList.length;
          const nextAudioTrack = props.state.audioList[nextIndex];
          await commands.playbackChangeAudio(nextAudioTrack.id.toString());
          props.showOSD(
            "audio",
            nextAudioTrack?.title ||
              nextAudioTrack?.lang ||
              `Track ${nextIndex + 1}`
          );
          props.showControls();
        }
        break;

      case "KeyS":
        e.preventDefault();
        if (props.state.subtitleList.length > 0) {
          const currentIndex = props.state.subtitleIndex;
          const currentSubtitleTrackIndx = props.state.subtitleList.findIndex(
            (track) => track.id === currentIndex
          );

          const nextIndex =
            currentSubtitleTrackIndx === -1
              ? 0
              : (currentSubtitleTrackIndx + 1) %
                (props.state.subtitleList.length - 1);
          const nextSubtitleTrack = props.state.subtitleList[nextIndex];
          await commands.playbackChangeSubtitle(
            nextSubtitleTrack.id.toString()
          );
          props.showOSD(
            "subtitle",
            nextSubtitleTrack?.title ||
              nextSubtitleTrack?.lang ||
              (nextIndex === 0 ? "Off" : `Track ${nextIndex}`)
          );
          props.showControls();
        }
        break;

      // Help overlay
      case "KeyI":
      case "Slash":
        e.preventDefault();
        props.toggleHelp();
        break;

      // Jump to position (0-9)
      case "Digit0":
      case "Digit1":
      case "Digit2":
      case "Digit3":
      case "Digit4":
      case "Digit5":
      case "Digit6":
      case "Digit7":
      case "Digit8":
      case "Digit9": {
        e.preventDefault();
        const digit = Number.parseInt(e.code.replace("Digit", ""), 10);
        const jumpPercentage = digit * 10;
        const jumpTime = (jumpPercentage / 100) * props.state.duration;
        commands.playbackSeek(jumpTime - Number(props.state.currentTime));
        props.showOSD("seek", jumpPercentage, `${jumpPercentage}%`);
        props.showControls();
        break;
      }

      // Home and End
      case "Home": {
        e.preventDefault();
        commands.playbackSeek(-Number(props.state.currentTime));
        props.showOSD("seek", 0, "Start");
        props.showControls();
        break;
      }

      case "End": {
        e.preventDefault();
        const endTime = props.state.duration - Number(props.state.currentTime);
        commands.playbackSeek(endTime);
        props.showOSD("seek", 100, "End");
        props.showControls();
        break;
      }

      default:
        break;
    }
  });
}
