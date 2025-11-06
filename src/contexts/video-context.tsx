import { createContextProvider } from "@solid-primitives/context";
import {
  createStore,
  reconcile,
  type SetStoreFunction,
  unwrap,
} from "solid-js/store";
import type { Track } from "~/lib/tauri";

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
  const [store, setStore] = createStore<VideoPlayback>(defaultState);
  const channel = new BroadcastChannel(VIDEO_PLAYBACK_KEY);
  const tabId = crypto.randomUUID();

  channel.onmessage = (event: MessageEvent) => {
    if (event.data.id === tabId) {
      return;
    }

    setStore(reconcile(JSON.parse(event.data.payload)));
  };

  // @ts-expect-error: wrapper
  const updateStore: SetStoreFunction<VideoPlayback> = (
    ...args: Parameters<SetStoreFunction<VideoPlayback>>
  ) => {
    setStore.apply(this, args);
    channel.postMessage({
      type: "state-update",
      id: tabId,
      payload: JSON.stringify(unwrap(store)),
    });
  };

  return [store, updateStore] as const;
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
