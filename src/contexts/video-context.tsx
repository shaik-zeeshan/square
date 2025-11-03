import { createContextProvider } from "@solid-primitives/context";
import { createEventListener } from "@solid-primitives/event-listener";
import { makePersisted } from "@solid-primitives/storage";
import { createStore } from "solid-js/store";
import type { Track } from "~/lib/tauri";
import { safeJsonParse } from "~/lib/utils";

export type VideoPlayback = {
  pause: boolean;
  currentTime: number;
  cachedTime: number;
  duration: number;
  volume: number;
  speed: number;
  isMuted: boolean;
  isPip: boolean;
  audioTracks: Track[];
  subtitleTracks: Track[];
};

export const DEFAULT_VIDEO_PLAYBACK = () => ({
  pause: false,
  currentTime: 0,
  cachedTime: 0,
  duration: 0,
  volume: 100,
  isMuted: false,
  speed: 1.0,
  audioTracks: [],
  subtitleTracks: [],
  isPip: false,
});

const VIDEO_PLAYBACK_KEY = "video_playback_store";

const createVideoStore = (defaultState: VideoPlayback) => {
  const [store, setStore] = makePersisted(
    createStore<VideoPlayback>(defaultState),
    {
      name: VIDEO_PLAYBACK_KEY,
    }
  );

  // Sync updates across windows (e.g., main and PiP) using the storage event
  createEventListener(window, "storage", (event) => {
    if (event.key === VIDEO_PLAYBACK_KEY) {
      setStore(safeJsonParse(event.newValue, DEFAULT_VIDEO_PLAYBACK()));
    }
  });

  return [store, setStore] as const;
};

const [VideoContextProvider, useVideoInner] = createContextProvider(() =>
  createVideoStore(DEFAULT_VIDEO_PLAYBACK())
);

export const useVideoContext = () => {
  const ctx = useVideoInner();
  if (!ctx) {
    throw new Error("useVideoContext must be used inside VideoContextProvider");
  }
  return ctx;
};

export { VideoContextProvider };
