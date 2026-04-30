/**
 * Capability adapter registry with live HTTP implementations.
 *
 * Adapters are the only place that knows provider HTTP details.
 * Service code resolves an adapter by pluginId and calls the
 * normalised `search` / `dispatch` methods — it never branches on
 * raw HTTP paths itself.
 *
 * HTTP requests are routed through the native Tauri commands so they
 * bypass browser CORS:
 *   - GET  → `check_integration`
 *   - POST → `invoke_integration`
 */

import { commands } from "~/lib/tauri";
import type {
  CapabilityActionResult,
  CapabilityAdapter,
  PluginActiveRequest,
  PluginDownloadProgress,
  PluginMediaStatus,
  PluginSearchResult,
  ProviderOption,
  TvSeason,
} from "./types";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function tauriGet(url: string, apiKey: string): Promise<unknown> {
  const res = await commands.checkIntegration(url, apiKey);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  try {
    return JSON.parse(res.body);
  } catch {
    return res.body;
  }
}

async function tauriPost(
  url: string,
  apiKey: string,
  body: unknown
): Promise<unknown> {
  const res = await commands.invokeIntegration(
    url,
    "POST",
    apiKey,
    JSON.stringify(body)
  );
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  try {
    return JSON.parse(res.body);
  } catch {
    return res.body;
  }
}

const JELLYSEERR_IMAGE_BASE = "https://image.tmdb.org/t/p/w185";
const TIME_LEFT_DAYS_RE = /^(\d+)\.(.*)$/;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          !!entry && typeof entry === "object" && !Array.isArray(entry)
      )
    : [];
}

function parseYearFromDate(value: unknown): number | undefined {
  if (typeof value !== "string" || value.length < 4) {
    return;
  }

  const year = Number.parseInt(value.slice(0, 4), 10);
  if (Number.isFinite(year)) {
    return year;
  }
}

function toPosterUrl(path: unknown): string | undefined {
  if (typeof path !== "string" || !path) {
    return;
  }

  return path.startsWith("http://") || path.startsWith("https://")
    ? path
    : `${JELLYSEERR_IMAGE_BASE}${path}`;
}

function getJellyseerrEffectiveMediaStatusCode(opts: {
  media?: Record<string, unknown>;
  request?: Record<string, unknown>;
}): number | undefined {
  const statusKey = opts.request?.is4k ? "status4k" : "status";
  const mediaStatus = Number(opts.media?.[statusKey]);

  return Number.isFinite(mediaStatus) ? mediaStatus : undefined;
}

function hasJellyseerrActiveDownloadQueue(opts: {
  media?: Record<string, unknown>;
  request?: Record<string, unknown>;
}): boolean {
  const queueKey = opts.request?.is4k ? "downloadStatus4k" : "downloadStatus";
  const queue = opts.media?.[queueKey];

  return Array.isArray(queue) && queue.length > 0;
}

/**
 * Derive a compact aggregate download progress from a Jellyseerr media's
 * `downloadStatus` / `downloadStatus4k` queue.  Each entry typically exposes
 * `size` and `sizeLeft` (bytes) — we sum across items so multi-file requests
 * (e.g. season packs) collapse to a single representative percentage.
 *
 * Returns `undefined` when the queue is empty or carries no size data, so the
 * UI can omit the progress affordance instead of rendering a zero-width bar.
 */
function deriveJellyseerrProgress(opts: {
  media?: Record<string, unknown>;
  request?: Record<string, unknown>;
}): PluginDownloadProgress | undefined {
  const queueKey = opts.request?.is4k ? "downloadStatus4k" : "downloadStatus";
  const queue = asArrayOfRecords(opts.media?.[queueKey]);

  if (queue.length === 0) {
    return;
  }

  let totalSize = 0;
  let totalLeft = 0;
  let maxTimeLeftSeconds = -1;
  for (const item of queue) {
    const size = Number(item.size);
    const left = Number(item.sizeLeft);
    if (Number.isFinite(size) && size > 0 && Number.isFinite(left)) {
      totalSize += size;
      totalLeft += Math.max(0, Math.min(size, left));
    }
    const seconds = parseTimeLeftSeconds(item.timeLeft);
    if (seconds !== undefined && seconds > maxTimeLeftSeconds) {
      maxTimeLeftSeconds = seconds;
    }
  }

  if (totalSize <= 0) {
    return;
  }

  const rawPercent = ((totalSize - totalLeft) / totalSize) * 100;
  const percent = Math.max(0, Math.min(100, Math.round(rawPercent)));
  const timeLeft =
    maxTimeLeftSeconds >= 0 ? formatCompactDuration(maxTimeLeftSeconds) : undefined;

  return { percent, itemCount: queue.length, timeLeft };
}

/**
 * Parse a Sonarr/Radarr-style `timeLeft` string into total seconds.
 * Accepts formats like `HH:MM:SS`, `D.HH:MM:SS` or `MM:SS`.  Returns
 * `undefined` for missing/unparseable input so callers can omit the
 * affordance instead of rendering a misleading value.
 */
function parseTimeLeftSeconds(value: unknown): number | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return;
  }
  // Optional leading "D." for days (Sonarr/Radarr surface this for long ETAs).
  let rest = value;
  let days = 0;
  const dayMatch = rest.match(TIME_LEFT_DAYS_RE);
  if (dayMatch) {
    days = Number.parseInt(dayMatch[1], 10);
    rest = dayMatch[2];
  }
  const parts = rest.split(":").map((p) => Number.parseInt(p, 10));
  if (parts.some((n) => !Number.isFinite(n))) {
    return;
  }
  let h = 0;
  let m = 0;
  let s = 0;
  if (parts.length === 3) {
    [h, m, s] = parts;
  } else if (parts.length === 2) {
    [m, s] = parts;
  } else {
    return;
  }
  return days * 86_400 + h * 3600 + m * 60 + s;
}

/** Format a duration in seconds to a compact UI label (e.g. "12m", "1h 5m"). */
function formatCompactDuration(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return "<1m";
  }
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

function normalizeJellyseerrStatus(opts: {
  media?: Record<string, unknown>;
  request?: Record<string, unknown>;
}): PluginMediaStatus | undefined {
  const mediaStatus = Number(opts.media?.status);

  switch (mediaStatus) {
    case 5:
      return { kind: "available", label: "Available" };
    case 4:
      return { kind: "partial", label: "Partially Available" };
    case 3:
      return { kind: "processing", label: "Processing" };
    case 2:
      return { kind: "pending", label: "Pending" };
    default:
      break;
  }

  const requestStatuses = [
    opts.request?.status,
    ...asArrayOfRecords(opts.media?.requests).map((request) => request.status),
  ].map((status) => Number(status));

  if (requestStatuses.includes(1)) {
    return { kind: "pending", label: "Pending" };
  }

  if (requestStatuses.includes(2)) {
    return { kind: "requested", label: "Requested" };
  }

  if (requestStatuses.includes(5)) {
    return { kind: "available", label: "Available" };
  }
}

// ---------------------------------------------------------------------------
// Jellyseerr adapter
// ---------------------------------------------------------------------------

const jellyseerrAdapter: CapabilityAdapter = {
  async search({ baseUrl, apiKey, query }) {
    // page=1 is the leanest request the endpoint supports — Jellyseerr's
    // /api/v1/search accepts `page` for pagination but has no `limit` param.
    // Requesting page 1 keeps the response to a single page (~20 items);
    // the service layer slices the result down to 10.
    const url = new URL("/api/v1/search", baseUrl);
    url.search = `?query=${encodeURIComponent(query)}&page=1&language=en`;

    const body = (await tauriGet(url.toString(), apiKey)) as {
      results?: Record<string, unknown>[];
    };

    return (body?.results ?? []).map(
      (r): PluginSearchResult => ({
        id: String(r.id ?? ""),
        mediaType: (r.mediaType as string) ?? "unknown",
        title: ((r.name ?? r.title) as string) ?? "Unknown",
        year: (() => {
          if (r.firstAirDate) {
            return Number.parseInt(String(r.firstAirDate).slice(0, 4), 10);
          }
          if (r.releaseDate) {
            return Number.parseInt(String(r.releaseDate).slice(0, 4), 10);
          }
        })(),
        overview: (r.overview as string) ?? undefined,
        posterUrl: toPosterUrl(r.posterPath),
        status: normalizeJellyseerrStatus({ media: asRecord(r.mediaInfo) }),
        raw: r as Record<string, unknown>,
      })
    );
  },

  async dispatch({
    baseUrl,
    apiKey,
    payload,
  }): Promise<CapabilityActionResult> {
    if (payload.capability === "request") {
      const p = payload.params;
      const url = new URL("/api/v1/request", baseUrl).toString();
      let seasons: number[] | "all" | undefined;
      if (p.mediaType === "tv") {
        if (Array.isArray(p.seasons)) {
          seasons = p.seasons.length > 0 ? p.seasons : "all";
        } else {
          seasons = p.seasons ?? "all";
        }
      }
      const result = await tauriPost(url, apiKey, {
        mediaType: p.mediaType,
        mediaId: p.mediaId,
        ...(seasons ? { seasons } : {}),
      });
      const r = result as Record<string, unknown>;
      return {
        success: true,
        message: `Request submitted (id: ${r.id ?? "?"})`,
        raw: r,
      };
    }
    return {
      success: false,
      message: `Unknown capability: ${(payload as { capability: string }).capability}`,
    };
  },

  async fetchTvSeasons({ baseUrl, apiKey, mediaId }): Promise<TvSeason[]> {
    const url = new URL(`/api/v1/tv/${mediaId}`, baseUrl).toString();
    const body = (await tauriGet(url, apiKey)) as {
      seasons?: Record<string, unknown>[];
    };

    return (body?.seasons ?? []).map(
      (s): TvSeason => ({
        seasonNumber: Number(s.seasonNumber ?? s.season_number ?? 0),
        name:
          (s.name as string) ||
          (Number(s.seasonNumber ?? s.season_number) === 0
            ? "Specials"
            : `Season ${s.seasonNumber ?? s.season_number}`),
        episodeCount: (() => {
          if (s.episodeCount != null) {
            return Number(s.episodeCount);
          }
          if (s.episode_count != null) {
            return Number(s.episode_count);
          }
        })(),
        airDate: (s.airDate ?? s.air_date) as string | undefined,
      })
    );
  },

  async fetchActiveRequests({
    baseUrl,
    apiKey,
  }): Promise<PluginActiveRequest[]> {
    const meUrl = new URL("/api/v1/auth/me", baseUrl).toString();
    const me = asRecord(await tauriGet(meUrl, apiKey));
    const userId = Number(me?.id);

    if (!Number.isFinite(userId)) {
      return [];
    }

    const take = 20;
    const allRequests: Record<string, unknown>[] = [];

    for (let skip = 0; ; skip += take) {
      const requestsUrl = new URL("/api/v1/request", baseUrl);
      requestsUrl.search = `?requestedBy=${userId}&take=${take}&skip=${skip}&sort=modified&sortDirection=desc`;

      const body = asRecord(await tauriGet(requestsUrl.toString(), apiKey));
      const pageResults = asArrayOfRecords(body?.results);

      allRequests.push(...pageResults);

      if (pageResults.length < take) {
        break;
      }
    }

    const results = allRequests.filter((request) => {
      const media = asRecord(request.media);
      return hasJellyseerrActiveDownloadQueue({ media, request });
    });

    // Jellyseerr's request payload only carries IDs on `media` (tmdbId,
    // tvdbId, mediaType, status) — title/poster/overview/year live on
    // the TMDB-backed metadata endpoints.  Enrich each request with a
    // single targeted lookup so cards show useful data instead of
    // falling back to "Unknown".
    const enriched = await Promise.all(
      results.map(async (request) => {
        const media = asRecord(request.media);
        const mediaType = String(request.type ?? media?.mediaType ?? "unknown");
        const tmdbId = media?.tmdbId ?? request.mediaId ?? media?.id;
        const lookupType =
          mediaType === "tv" || mediaType === "series" ? "tv" : "movie";

        let meta: Record<string, unknown> | undefined;
        if (tmdbId != null && (lookupType === "tv" || lookupType === "movie")) {
          try {
            const metaUrl = new URL(
              `/api/v1/${lookupType}/${tmdbId}`,
              baseUrl
            ).toString();
            meta = asRecord(await tauriGet(metaUrl, apiKey));
          } catch {
            meta = undefined;
          }
        }

        // Title fallback chain — prefer TMDB metadata, then any title-like
        // fields surfaced on the request/media row, before giving up.
        const title =
          (meta?.name as string | undefined) ||
          (meta?.title as string | undefined) ||
          (meta?.originalName as string | undefined) ||
          (meta?.originalTitle as string | undefined) ||
          (media?.title as string | undefined) ||
          (media?.name as string | undefined) ||
          (request.subject as string | undefined) ||
          "Untitled request";

        const posterPath =
          meta?.posterPath ?? media?.posterPath ?? meta?.poster_path;

        const year =
          parseYearFromDate(meta?.firstAirDate ?? meta?.releaseDate) ??
          parseYearFromDate(media?.firstAirDate ?? media?.releaseDate);

        const progress = deriveJellyseerrProgress({ media, request });

        return {
          id: String(request.id ?? ""),
          mediaId: String(tmdbId ?? ""),
          mediaType,
          title,
          year,
          overview:
            (meta?.overview as string | undefined) ??
            (media?.overview as string | undefined),
          posterUrl: toPosterUrl(posterPath),
          requestedAt: (request.createdAt as string) ?? undefined,
          status: {
            kind: "processing",
            label: "Processing",
          },
          progress,
          raw: request,
        } satisfies PluginActiveRequest;
      })
    );

    return enriched;
  },
};

// ---------------------------------------------------------------------------
// Sonarr adapter
// ---------------------------------------------------------------------------

const sonarrAdapter: CapabilityAdapter = {
  async search({ baseUrl, apiKey, query }) {
    // /api/v3/series/lookup does not support request-level limiting or
    // pagination; the full result set is returned by Sonarr.  The service
    // layer caps the results to 10 after the response is received.
    const url = new URL("/api/v3/series/lookup", baseUrl);
    url.search = `?term=${encodeURIComponent(query)}`;

    const body = await tauriGet(url.toString(), apiKey);
    const arr: Record<string, unknown>[] = Array.isArray(body) ? body : [];

    return arr.map(
      (r): PluginSearchResult => ({
        id: String(r.tvdbId ?? r.id ?? ""),
        mediaType: "series",
        title: (r.title as string) ?? "Unknown",
        year: r.year ? Number(r.year) : undefined,
        overview: (r.overview as string) ?? undefined,
        posterUrl: (
          (r.images as Record<string, unknown>[] | undefined) ?? []
        ).find((i) => i.coverType === "poster")?.remoteUrl as
          | string
          | undefined,
        raw: r,
      })
    );
  },

  async dispatch({
    baseUrl,
    apiKey,
    payload,
  }): Promise<CapabilityActionResult> {
    if (payload.capability === "add_series") {
      const p = payload.params;
      const url = new URL("/api/v3/series", baseUrl).toString();
      const result = await tauriPost(url, apiKey, {
        tvdbId: p.tvdbId,
        title: p.title,
        qualityProfileId: p.qualityProfileId,
        rootFolderPath: p.rootFolderPath,
        monitored: p.monitored ?? true,
        addOptions: { searchForMissingEpisodes: true },
        seasons: p.seasons ?? [],
      });
      const r = result as Record<string, unknown>;
      return {
        success: true,
        message: `Series added (id: ${r.id ?? "?"})`,
        raw: r,
      };
    }
    return {
      success: false,
      message: `Unknown capability: ${(payload as { capability: string }).capability}`,
    };
  },

  async lookupOptions({
    baseUrl,
    apiKey,
    optionType,
  }): Promise<ProviderOption[]> {
    const path =
      optionType === "qualityProfiles"
        ? "/api/v3/qualityprofile"
        : "/api/v3/rootfolder";
    const url = new URL(path, baseUrl).toString();
    const body = await tauriGet(url, apiKey);
    const arr: Record<string, unknown>[] = Array.isArray(body) ? body : [];
    return arr.map((r) => ({
      id: Number(r.id),
      name:
        optionType === "rootFolders"
          ? String(r.path ?? r.name ?? "Unknown")
          : String(r.name ?? "Unknown"),
    }));
  },
};

// ---------------------------------------------------------------------------
// Radarr adapter
// ---------------------------------------------------------------------------

const radarrAdapter: CapabilityAdapter = {
  async search({ baseUrl, apiKey, query }) {
    // /api/v3/movie/lookup does not support request-level limiting or
    // pagination; the full result set is returned by Radarr.  The service
    // layer caps the results to 10 after the response is received.
    const url = new URL("/api/v3/movie/lookup", baseUrl);
    url.search = `?term=${encodeURIComponent(query)}`;

    const body = await tauriGet(url.toString(), apiKey);
    const arr: Record<string, unknown>[] = Array.isArray(body) ? body : [];

    return arr.map(
      (r): PluginSearchResult => ({
        id: String(r.tmdbId ?? r.id ?? ""),
        mediaType: "movie",
        title: (r.title as string) ?? "Unknown",
        year: r.year ? Number(r.year) : undefined,
        overview: (r.overview as string) ?? undefined,
        posterUrl: (
          (r.images as Record<string, unknown>[] | undefined) ?? []
        ).find((i) => i.coverType === "poster")?.remoteUrl as
          | string
          | undefined,
        raw: r,
      })
    );
  },

  async dispatch({
    baseUrl,
    apiKey,
    payload,
  }): Promise<CapabilityActionResult> {
    if (payload.capability === "add_movie") {
      const p = payload.params;
      const url = new URL("/api/v3/movie", baseUrl).toString();
      const result = await tauriPost(url, apiKey, {
        tmdbId: p.tmdbId,
        title: p.title,
        qualityProfileId: p.qualityProfileId,
        rootFolderPath: p.rootFolderPath,
        monitored: p.monitored ?? true,
        addOptions: { searchForMovie: true },
      });
      const r = result as Record<string, unknown>;
      return {
        success: true,
        message: `Movie added (id: ${r.id ?? "?"})`,
        raw: r,
      };
    }
    return {
      success: false,
      message: `Unknown capability: ${(payload as { capability: string }).capability}`,
    };
  },

  async lookupOptions({
    baseUrl,
    apiKey,
    optionType,
  }): Promise<ProviderOption[]> {
    const path =
      optionType === "qualityProfiles"
        ? "/api/v3/qualityprofile"
        : "/api/v3/rootfolder";
    const url = new URL(path, baseUrl).toString();
    const body = await tauriGet(url, apiKey);
    const arr: Record<string, unknown>[] = Array.isArray(body) ? body : [];
    return arr.map((r) => ({
      id: Number(r.id),
      name:
        optionType === "rootFolders"
          ? String(r.path ?? r.name ?? "Unknown")
          : String(r.name ?? "Unknown"),
    }));
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const ADAPTER_REGISTRY: Record<string, CapabilityAdapter> = {
  jellyseerr: jellyseerrAdapter,
  sonarr: sonarrAdapter,
  radarr: radarrAdapter,
};

/**
 * Resolve the adapter for a given pluginId.
 * Returns `undefined` when no adapter is registered (unknown plugin).
 */
export const getAdapter = (pluginId: string): CapabilityAdapter | undefined =>
  ADAPTER_REGISTRY[pluginId];
