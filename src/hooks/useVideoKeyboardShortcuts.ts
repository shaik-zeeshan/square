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
  /** Reactive accessor — returns true while the keyboard-help overlay is open */
  isHelpOpen: () => boolean;
  showOSD: (
    type: OSDType,
    value: string | number | null,
    label?: string
  ) => void;
  handleOpenPip: () => Promise<void>;
  selectAudioTrack?: (track: Track) => Promise<void>;
  selectSubtitleTrack?: (track: Track | null) => Promise<void>;
};

export function useVideoKeyboardShortcuts(
  props: UseVideoKeyboardShortcutsProps
) {
  const navigate = useNavigate();

  // Use SolidJS event listener primitive attached to window
  createEventListener(window, "keydown", async (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;

    // Never intercept events from standard text inputs
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      return;
    }

    // While the keyboard-help overlay is open it manages its own focus and
    // fires stopPropagation, so this listener should never receive events from
    // inside the overlay.  As a belt-and-suspenders guard, skip all global
    // shortcuts when the help panel is open so we cannot double-fire actions
    // (e.g. toggling play via Space while the overlay is displayed).
    if (props.isHelpOpen()) {
      return;
    }

    // Never intercept any shortcut when a focusable player control (button,
    // slider, range input) has focus.  These elements handle their own
    // keyboard interaction; firing global shortcuts on top causes duplicate
    // actions (e.g. Space toggling play twice, arrow keys seeking twice).
    const isFocusablePlayerControl =
      target.tagName === "BUTTON" ||
      target.tagName === "SELECT" ||
      target.getAttribute("role") === "slider" ||
      target.closest('[role="slider"]') !== null ||
      (target.tagName === "INPUT" && target.getAttribute("type") === "range");

    if (isFocusablePlayerControl) {
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
        break;

      case "KeyL":
        e.preventDefault();
        commands.playbackSeek(10);
        props.showOSD("seek", 10);
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

      case "KeyP":
        e.preventDefault();
        await props.handleOpenPip();
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
          if (props.selectAudioTrack) {
            await props.selectAudioTrack(nextAudioTrack);
          } else {
            await commands.playbackChangeAudio(nextAudioTrack.id.toString());
          }
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
          // Build a virtual list: [Off (id=0), ...subtitleList]
          // "Off" is represented by subtitleIndex === 0 or -1
          const isOff = currentIndex === 0 || currentIndex === -1;
          const currentSubtitleTrackIndx = isOff
            ? -1
            : props.state.subtitleList.findIndex(
                (track) => track.id === currentIndex
              );

          // Cycle: Off(-1) → track[0] → track[1] → … → last → Off
          if (
            currentSubtitleTrackIndx ===
            props.state.subtitleList.length - 1
          ) {
            // Was last track → go to Off
            if (props.selectSubtitleTrack) {
              await props.selectSubtitleTrack(null);
            } else {
              await commands.playbackChangeSubtitle("0");
            }
            props.showOSD("subtitle", "Off");
          } else {
            // Was Off(-1) or mid-list → advance to next track
            const nextIndex = currentSubtitleTrackIndx + 1;
            const nextSubtitleTrack = props.state.subtitleList[nextIndex];
            if (props.selectSubtitleTrack) {
              await props.selectSubtitleTrack(nextSubtitleTrack);
            } else {
              await commands.playbackChangeSubtitle(
                nextSubtitleTrack.id.toString()
              );
            }
            props.showOSD(
              "subtitle",
              nextSubtitleTrack?.title ||
                nextSubtitleTrack?.lang ||
                `Track ${nextIndex + 1}`
            );
          }
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
