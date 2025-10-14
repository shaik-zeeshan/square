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

export type OpenPanel = 'audio' | 'subtitles' | 'speed' | 'chapters' | null;

export const DEFAULT_AUDIO_LANG = ['en', 'en-US'];
export const DEFAULT_SUBTITLE_LANG = ['en', 'en-US'];
