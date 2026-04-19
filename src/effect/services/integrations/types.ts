/**
 * Core types for the external integrations plugin system.
 * Slice 2: extended with connection fields, validation metadata, and results.
 * Slice A: extended with capability metadata, shared result/payload types, and
 *          adapter contract for capability-driven operations.
 */

// ---------------------------------------------------------------------------
// Auth kinds
// ---------------------------------------------------------------------------

export type AuthKind = "api_key" | "basic" | "bearer" | "none";

export interface AuthMeta {
  kind: AuthKind;
  /** For basic auth: username (password stored in Stronghold) */
  username?: string;
}

// ---------------------------------------------------------------------------
// Connection field descriptors
// ---------------------------------------------------------------------------

export type FieldKind = "url" | "text" | "secret";

export interface ConnectionField {
  /** Stable key, also used as the storage/form field name */
  readonly key: string;
  /** Human-readable label */
  readonly label: string;
  readonly kind: FieldKind;
  readonly required: boolean;
  readonly placeholder?: string;
}

// ---------------------------------------------------------------------------
// Validation result — suitable for UI consumption
// ---------------------------------------------------------------------------

export interface ValidationResult {
  success: boolean;
  /** Normalised base URL (trailing slash stripped, scheme ensured) */
  normalizedUrl?: string;
  /** Short human-readable summary, e.g. service version or error reason */
  message: string;
  /** Additional key/value info surfaced from the health endpoint */
  info?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

/**
 * Stable string literals that identify what an integration can do.
 * UI and service code dispatch against these rather than branching on pluginId.
 */
export type PluginCapability =
  | "search"       // search across content (movies, series, etc.)
  | "request"      // submit a media request (Jellyseerr-style)
  | "add_movie"    // add a movie to a library (Radarr-style)
  | "add_series";  // add a series to a library (Sonarr-style)

// ---------------------------------------------------------------------------
// Normalised shared payload / result types
// ---------------------------------------------------------------------------

/** A single item returned by a capability=search dispatch */
export interface PluginSearchResult {
  /** Provider-native ID (e.g. tmdbId, tvdbId, or internal id string) */
  id: string;
  /** "movie" | "series" | "anime" | other provider-specific category */
  mediaType: string;
  title: string;
  year?: number;
  overview?: string;
  /** Absolute or relative poster URL as returned by the provider */
  posterUrl?: string;
  /** Provider-specific extra fields kept for pass-through to adapters */
  raw?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Typed params for each non-search capability
// ---------------------------------------------------------------------------

/** Params for Jellyseerr `request` capability */
export interface JellyseerrRequestParams {
  mediaType: "movie" | "tv";
  mediaId: number;
  seasons?: number[];
}

/** Params for Sonarr `add_series` capability */
export interface SonarrAddSeriesParams {
  tvdbId: number;
  title: string;
  qualityProfileId: number;
  rootFolderPath: string;
  monitored?: boolean;
  seasons?: { seasonNumber: number; monitored: boolean }[];
}

/** Params for Radarr `add_movie` capability */
export interface RadarrAddMovieParams {
  tmdbId: number;
  title: string;
  qualityProfileId: number;
  rootFolderPath: string;
  monitored?: boolean;
}

/**
 * Discriminated union covering all non-search capability payloads.
 * Each variant carries a strongly-typed `params` object matched to the
 * capability, so adapters no longer need to cast `Record<string, unknown>`.
 */
export type CapabilityActionPayload =
  | { capability: "request"; params: JellyseerrRequestParams }
  | { capability: "add_series"; params: SonarrAddSeriesParams }
  | { capability: "add_movie"; params: RadarrAddMovieParams };

// ---------------------------------------------------------------------------
// Provider option lookups (quality profiles, root folders, etc.)
// ---------------------------------------------------------------------------

/** A selectable option returned by a provider lookup (e.g. quality profile) */
export interface ProviderOption {
  id: number;
  name: string;
}

export type ProviderOptionType = "qualityProfiles" | "rootFolders";

/**
 * Aggregate options returned by `IntegrationService.fetchProviderOptions`.
 * Both collections are fetched in parallel and surfaced together so the UI
 * can populate quality-profile and root-folder dropdowns in a single query.
 */
export interface ProviderOptions {
  qualityProfiles: ProviderOption[];
  rootFolders: ProviderOption[];
}

// ---------------------------------------------------------------------------
// TV season lookup (Jellyseerr-specific)
// ---------------------------------------------------------------------------

/** A single TV season returned by a provider TV-details lookup */
export interface TvSeason {
  /** Season number (0 = specials) */
  seasonNumber: number;
  /** Human-readable label, e.g. "Season 1" or "Specials" */
  name: string;
  /** Episode count if available */
  episodeCount?: number;
  /** Air date of the season premiere if available */
  airDate?: string;
}

/** Normalised result returned by any non-search capability dispatch */
export interface CapabilityActionResult {
  success: boolean;
  /** Human-readable summary surfaced to the caller / UI */
  message: string;
  /** Provider-native response body, kept for pass-through */
  raw?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Adapter contract
// ---------------------------------------------------------------------------

/**
 * Pluggable adapter interface.  Each provider that supports capabilities
 * implements this interface.  Service code never imports HTTP details directly.
 *
 * Both methods are optional: an adapter only needs to implement the
 * capabilities it declares in its plugin descriptor.
 */
export interface CapabilityAdapter {
  /** Execute a search query, returning normalised results */
  search?(opts: {
    connectionId: string;
    baseUrl: string;
    apiKey: string;
    query: string;
    mediaType?: string;
  }): Promise<PluginSearchResult[]>;

  /** Execute a non-search capability action */
  dispatch?(opts: {
    connectionId: string;
    baseUrl: string;
    apiKey: string;
    payload: CapabilityActionPayload;
  }): Promise<CapabilityActionResult>;

  /** Fetch selectable options (quality profiles, root folders) from the provider */
  lookupOptions?(opts: {
    baseUrl: string;
    apiKey: string;
    optionType: ProviderOptionType;
  }): Promise<ProviderOption[]>;

  /**
   * Fetch the list of seasons for a TV series from the provider.
   * Only Jellyseerr-style providers that expose TV-detail endpoints need to
   * implement this.  `mediaId` is the provider-native series id (e.g. tmdbId).
   */
  fetchTvSeasons?(opts: {
    baseUrl: string;
    apiKey: string;
    mediaId: number;
  }): Promise<TvSeason[]>;
}

// ---------------------------------------------------------------------------
// Plugin descriptor (statically registered)
// ---------------------------------------------------------------------------

export interface IntegrationPlugin {
  /** Unique, stable identifier e.g. "jellyseerr" */
  readonly pluginId: string;
  /** Human-readable label */
  readonly displayName: string;
  /** Supported auth kinds */
  readonly supportedAuthKinds: readonly AuthKind[];
  /** Ordered list of fields the UI should render for connection setup */
  readonly connectionFields: readonly ConnectionField[];
  /**
   * Path appended to baseUrl for health/validation.
   * The API key is passed via the `X-Api-Key` request header only — never
   * embedded in query parameters.
   */
  readonly healthPath: string;
  /**
   * Capabilities this plugin exposes.  UI and service code dispatch against
   * these rather than branching on pluginId or raw HTTP details.
   */
  readonly capabilities: readonly PluginCapability[];
}

// ---------------------------------------------------------------------------
// Saved connection (persisted metadata, no secrets)
// ---------------------------------------------------------------------------

export interface IntegrationConnection {
  /** Unique per-connection UUID */
  connectionId: string;
  pluginId: string;
  displayName: string;
  baseUrl: string;
  authMeta: AuthMeta;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
  /** Optional summary from the last validation attempt */
  lastValidationSummary?: string | null;
}

// ---------------------------------------------------------------------------
// Built-in plugin registry entries
// ---------------------------------------------------------------------------

/** Shared fields present on every api_key-based integration */
const API_KEY_FIELDS: readonly ConnectionField[] = [
  {
    key: "baseUrl",
    label: "Server URL",
    kind: "url",
    required: true,
    placeholder: "http://localhost:8096",
  },
  {
    key: "apiKey",
    label: "API Key",
    kind: "secret",
    required: true,
    placeholder: "Paste your API key",
  },
];

export const BUILT_IN_PLUGINS: readonly IntegrationPlugin[] = [
  {
    pluginId: "jellyseerr",
    displayName: "Jellyseerr",
    supportedAuthKinds: ["api_key"],
    connectionFields: API_KEY_FIELDS,
    healthPath: "/api/v1/settings/about",
    capabilities: ["search", "request"],
  },
  {
    pluginId: "sonarr",
    displayName: "Sonarr",
    supportedAuthKinds: ["api_key"],
    connectionFields: API_KEY_FIELDS,
    healthPath: "/api/v3/system/status",
    capabilities: ["search", "add_series"],
  },
  {
    pluginId: "radarr",
    displayName: "Radarr",
    supportedAuthKinds: ["api_key"],
    connectionFields: API_KEY_FIELDS,
    healthPath: "/api/v3/system/status",
    capabilities: ["search", "add_movie"],
  },
] as const;
