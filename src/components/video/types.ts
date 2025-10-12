export type Track = {
  id: number;
  title?: string;
  type: string;
  lang?: string;
};

export type OpenPanel = 'audio' | 'subtitles' | 'speed' | null;

export const DEFAULT_AUDIO_LANG = ['en', 'en-US'];
export const DEFAULT_SUBTITLE_LANG = ['en', 'en-US'];
