import { describe, expect, it } from "bun:test";
import { planPlaybackSessionTeardown } from "./playback-session-lifecycle";

describe("planPlaybackSessionTeardown", () => {
  it("does nothing when this viewer does not own the active Playback Session", () => {
    expect(
      planPlaybackSessionTeardown({
        ownsActivePlaybackSession: false,
        isPipActive: true,
      })
    ).toEqual([]);
  });

  it("clears mpv when the Primary Playback Viewer owns the Playback Session", () => {
    expect(
      planPlaybackSessionTeardown({
        ownsActivePlaybackSession: true,
        isPipActive: false,
      })
    ).toEqual(["mark-paused", "clear-mpv"]);
  });

  it("destroys the Picture-in-Picture Viewer before clearing mpv", () => {
    expect(
      planPlaybackSessionTeardown({
        ownsActivePlaybackSession: true,
        isPipActive: true,
      })
    ).toEqual(["mark-paused", "destroy-pip-viewer", "clear-mpv"]);
  });
});
