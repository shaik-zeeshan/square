import type { Api } from "@jellyfin/sdk/lib/api";
import type {
  BaseItemDto,
  UserDto,
} from "@jellyfin/sdk/lib/generated-client/models";
import type { RecommendedServerInfo } from "@jellyfin/sdk/lib/models/recommended-server-info";

type ImageBlurHashes = BaseItemDto["ImageBlurHashes"];

// Enhanced Auth Types
export interface AuthCredentials {
  username: string;
  password: string;
  server: RecommendedServerInfo;
}

export interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  user: UserDto | null;
  server: RecommendedServerInfo | null;
  isLoading: boolean;
  error: string | null;
}

// Server Management Types
export interface SavedUser {
  username: string;
  savedAt: number;
}

export interface ServerConnection {
  info: RecommendedServerInfo;
  users: SavedUser[]; // List of saved usernames for this server
  lastConnected?: Date;
  isOnline?: boolean;
  currentUser?: string;
  // Currently active username
}

export interface ServerStore {
  servers: ServerConnection[];
  current: ServerConnection | null;
  recentlyUsed: string[]; // server addresses
}

// Legacy types for backward compatibility during migration
export interface LegacyServerConnection {
  info: RecommendedServerInfo;
  auth: AuthCredentials;
  lastConnected?: Date;
  isOnline?: boolean;
}

// Media Library Types
export interface MediaLibrary {
  Id: string;
  Name: string;
  CollectionType?: string;
  ImageTags?: Record<string, string>;
  Image?: string;
  BackdropImageTags?: string[];
  BackdropImage?: string;
  PrimaryImageAspectRatio?: number;
}

export interface MediaItem extends BaseItemDto {
  // Enhanced with computed properties
  DisplayTitle?: string;
  EpisodeTitle?: string;
  SeasonNumber?: number;
  EpisodeNumber?: number;
  SeriesName?: string;
}

export interface ResumeItem extends MediaItem {
  UserData: {
    PlayedPercentage?: number;
    PlaybackPositionTicks?: number;
    LastPlayedDate?: string;
  };
}

// UI State Types
export interface OnboardingState {
  step: "search-server" | "select-server" | "login";
  isProcessing: boolean;
  error: string | null;
  discoveredServers: RecommendedServerInfo[];
  selectedServer?: RecommendedServerInfo;
}

export interface FormFieldState<T = string> {
  value: T;
  error: string | null;
  touched: boolean;
  dirty: boolean;
}

export interface LoginFormData {
  username: FormFieldState;
  password: FormFieldState;
}

export interface ServerSearchData {
  url: FormFieldState<string>;
  isSearching: boolean;
  searchAttempted: boolean;
  discoveredServers: RecommendedServerInfo[];
}

// Query Options Types
export interface JellyfinQueryOptions<TData, TError = Error> {
  queryKey: readonly unknown[];
  queryFn: (api: Api) => Promise<TData>;
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
  refetchOnWindowFocus?: boolean;
  retry?: number | boolean;
  onError?: (error: TError) => void;
}

// Error Handling Types
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  context?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
  errorInfo: Record<string, unknown> | null;
}

// Performance Types
export interface ImageLoadState {
  status: "loading" | "loaded" | "error";
  blurhash?: string;
  src?: string;
}

export interface VirtualScrollItem {
  index: number;
  data: unknown;
  height?: number;
  offset: number;
}

// Settings Types
export interface AppSettings {
  general: {
    theme: "light" | "dark" | "auto";
    language: string;
    autoConnect: boolean;
  };
  playback: {
    defaultVolume: number;
    defaultSpeed: number;
    subtitles: {
      enabled: boolean;
      language: string;
      size: number;
    };
    audio: {
      language: string;
    };
  };
  ui: {
    libraryView: "grid" | "list";
    itemsPerRow: number;
    showProgress: boolean;
    autoRefresh: boolean;
  };
}

// Validation Types
export interface ValidationRule<T = string> {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: T) => string | null;
}

export type FormValidator<T extends Record<string, unknown>> = {
  [K in keyof T]: ValidationRule<T[K]>;
};

// Event Types
export interface PlaybackEvent {
  type:
    | "play"
    | "pause"
    | "seek"
    | "volume"
    | "speed"
    | "load"
    | "subtitle"
    | "audio"
    | "resize"
    | "clear";
  data?: unknown;
}

export interface StorageEvent<T = unknown> {
  key: string;
  oldValue: T | null;
  newValue: T | null;
  timestamp: Date;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface PaginatedResponse<T = unknown> {
  Items: T[];
  TotalRecordCount: number;
  StartIndex: number;
  Limit?: number;
}

// Re-export commonly used Jellyfin types for convenience
export type { BaseItemPerson } from "@jellyfin/sdk/lib/generated-client/models";
export type { ImageBlurHashes };
