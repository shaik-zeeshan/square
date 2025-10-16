export type Track = {
  id: number;
  title?: string;
  type: string;
  lang?: string;
};

export type Chapter = {
  startPositionTicks: number;
  name?: string | null;
  imagePath?: string | null;
  imageDateModified?: string;
  imageTag?: string | null;
};

export type OpenPanel = "audio" | "subtitles" | "speed" | "chapters" | null;

export type LoadingStage = "connecting" | "metadata" | "buffering" | "ready";

export type OSDType =
  | "volume"
  | "speed"
  | "seek"
  | "audio"
  | "subtitle"
  | "play"
  | "pause"
  | "mute"
  | "unmute";

export type OSDState = {
  visible: boolean;
  type: OSDType;
  value: string | number | null;
  icon: string;
  label?: string;
};

export type NetworkQuality = "excellent" | "good" | "fair" | "poor";

export type BufferHealth = "healthy" | "warning" | "critical";

export const DEFAULT_AUDIO_LANG = ["en", "en-US"];
export const DEFAULT_SUBTITLE_LANG = ["en", "en-US"];
