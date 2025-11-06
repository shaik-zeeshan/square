import { createEventListener } from "@solid-primitives/event-listener";
import { useNavigate } from "@solidjs/router";
import type { SetStoreFunction } from "solid-js/store";
import { useVideoContext, type VideoPlayback } from "~/contexts/video-context";
import { events } from "~/lib/tauri";
import { match } from "~/lib/utils";

type PlayerType = "mpv" | "vlc";

type ActionType =
  | "togglePause"
  | "quit"
  | "toggleFullscreen"
  | "toggleMute"
  | "toggleSubtitles"
  | "cycleSubtitle"
  | "nextSubtitle"
  | "cycleAudio"
  | "nextFrame"
  | "prevFrame"
  | "adjustSpeed"
  | "stop"
  | "adjustVolume"
  | "seek";

type Command = {
  action: ActionType;
  params?: Record<string, unknown>;
};

type KeyBindings = Record<string, Command>;

const PLAYER_BINDINGS: Record<PlayerType, KeyBindings> = {
  mpv: {
    " ": { action: "togglePause" },
    q: { action: "quit" },
    f: { action: "toggleFullscreen" },
    m: { action: "toggleMute" },
    ArrowRight: { action: "seek", params: { by: 10 } },
    ArrowLeft: { action: "seek", params: { by: -10 } },
    "+": { action: "adjustVolume", params: { by: 10 } },
    "-": { action: "adjustVolume", params: { by: -10 } },
    v: { action: "toggleSubtitles" },
    j: { action: "nextSubtitle" },
    ".": { action: "nextFrame" },
    ",": { action: "prevFrame" },
    "[": { action: "adjustSpeed", params: { factor: 0.9 } },
    "]": { action: "adjustSpeed", params: { factor: 1.1 } },
  },
  vlc: {
    " ": { action: "togglePause" },
    s: { action: "stop" },
    f: { action: "toggleFullscreen" },
    ArrowRight: { action: "seek", params: { by: 10 } },
    ArrowLeft: { action: "seek", params: { by: -10 } },
    "+": { action: "adjustVolume", params: { by: 10 } },
    "-": { action: "adjustVolume", params: { by: -10 } },
    m: { action: "toggleMute" },
    v: { action: "cycleSubtitle" },
    a: { action: "cycleAudio" },
    "[": { action: "adjustSpeed", params: { factor: 0.9 } },
    "]": { action: "adjustSpeed", params: { factor: 1.1 } },
  },
};

const executeCommand = async (
  command: Command,
  state: VideoPlayback,
  setState: SetStoreFunction<VideoPlayback>,
  params?: Record<string, unknown>
) => {
  await match(command.action, {
    // Playback State
    togglePause: () => setState("pause", (value) => !value),
    adjustSpeed: () => setState("speed", (v) => v * Number(params?.factor)),

    // volume
    toggleMute: () => setState("isMuted", (value) => !value),
    adjustVolume: () =>
      setState("volume", (value) => {
        const newVol = value + Number(params?.by);
        const clampedValue = Math.floor(Math.min(Math.max(newVol, 0), 100));
        return clampedValue;
      }),

    // Seek
    seek: async () => {
      const newCur = state.currentTime + Number(params?.by);

      if (newCur >= state.duration) {
        return;
      }

      await events.requestSeekEvent.emit({
        position: Number(params?.by),
        absolute: false,
      });
      setState("currentTime", () => newCur);
    },
  });
};

export const useVideoShortcuts = (player: PlayerType) => {
  const [state, setState] = useVideoContext();
  const navigate = useNavigate();
  const bindings = PLAYER_BINDINGS[player];

  createEventListener(window, "keydown", async (e) => {
    e.preventDefault();

    const command = bindings[e.key];
    if (command) {
      match(command.action, {
        quit: () => navigate(-1),
      });

      await executeCommand(command, state, setState, command.params);
    }
  });
};
