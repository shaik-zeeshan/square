export type PlaybackSessionTeardownInput = {
  ownsActivePlaybackSession: boolean;
  isPipActive: boolean;
};

export type PlaybackSessionTeardownAction =
  | "mark-paused"
  | "destroy-pip-viewer"
  | "clear-mpv";

/**
 * Decide the externally visible teardown work for a Primary Playback Viewer.
 *
 * Invariants:
 * - Only the owner of the active Playback Session may tear it down.
 * - A Picture-in-Picture Viewer is dependent on the Primary Playback Viewer,
 *   so it is destroyed before mpv is cleared.
 * - Clearing mpv is required whenever the owning Primary Playback Viewer leaves,
 *   even if PiP was active.
 */
export function planPlaybackSessionTeardown(
  input: PlaybackSessionTeardownInput
): PlaybackSessionTeardownAction[] {
  if (!input.ownsActivePlaybackSession) {
    return [];
  }

  const actions: PlaybackSessionTeardownAction[] = ["mark-paused"];

  if (input.isPipActive) {
    actions.push("destroy-pip-viewer");
  }

  actions.push("clear-mpv");
  return actions;
}
