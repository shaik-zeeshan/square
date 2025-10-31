import { createContextProvider } from "@solid-primitives/context";
import { createStore } from "solid-js/store";
import type { Track } from "~/lib/tauri";

export type VideoPlayback = {
  pause: boolean;
  currentTime: number;
  cachedTime: number;
  duration: number;
  volume: number;
  speed: number;
  isMuted: boolean;
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
});

const createVideoStore = () =>
  createStore<VideoPlayback>(DEFAULT_VIDEO_PLAYBACK());

const [VideoContextProvider, useVideoInner] = createContextProvider(() =>
  createVideoStore()
);

export const useVideoContext = () => {
  const ctx = useVideoInner();
  if (!ctx) {
    throw new Error("useVideoContext must be used inside VideoContextProvider");
  }
  return ctx;
};

export { VideoContextProvider };
