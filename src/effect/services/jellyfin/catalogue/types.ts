export type MediaItemType =
  | "movie"
  | "series"
  | "season"
  | "episode"
  | "library"
  | "unknown";

export type Artwork = {
  primary?: string;
  backdrop?: string;
  logo?: string;
};

export type TrackSummary = {
  audioLanguages: string[];
  subtitleLanguages: string[];
};

export type MediaPerson = {
  name: string;
  role?: string;
  type?: string;
  imageUrl?: string;
};

export type MediaItem = {
  id: string;
  name: string;
  type: MediaItemType;
  jellyfinType?: string;
  overview?: string;
  year?: number;
  premiereDate?: string;
  runtimeTicks?: number;
  communityRating?: number;
  officialRating?: string;
  genres: string[];
  parentId?: string;
  seriesId?: string;
  seriesName?: string;
  seasonName?: string;
  indexNumber?: number;
  parentIndexNumber?: number;
  childCount?: number;
  locationType?: string;
  studios: string[];
  people: MediaPerson[];
  trackSummary: TrackSummary;
  userData: {
    played: boolean;
    favorite: boolean;
    playbackPositionTicks?: number;
    playedPercentage?: number;
    unplayedItemCount?: number;
  };
  artwork: Artwork;
};

export type Library = {
  id: string;
  name: string;
  collectionType?: string;
  itemCount?: number;
  artwork: Artwork;
};

export type PlaybackChapter = {
  name?: string;
  startPositionTicks?: number;
};

export type PlaybackStream = {
  index?: number;
  type?: string;
  codec?: string;
  language?: string;
  title?: string;
  displayTitle?: string;
  isExternal?: boolean;
  deliveryUrl?: string;
};

export type PlaybackSource = {
  id?: string;
  liveStreamId?: string;
  path?: string;
  container?: string;
  bitrate?: number;
  runtimeTicks?: number;
  streams: PlaybackStream[];
};

export type PlaybackMetadata = {
  itemId: string;
  sources: PlaybackSource[];
  chapters: PlaybackChapter[];
  trackSummary: TrackSummary;
};
