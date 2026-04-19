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
        posterUrl: r.posterPath
          ? `https://image.tmdb.org/t/p/w185${r.posterPath}`
          : undefined,
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
      const result = await tauriPost(url, apiKey, {
        mediaType: p.mediaType,
        mediaId: p.mediaId,
        ...(p.seasons ? { seasons: p.seasons } : {}),
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
          if (s.episodeCount != null) { return Number(s.episodeCount); }
          if (s.episode_count != null) { return Number(s.episode_count); }
        })(),
        airDate: (s.airDate ?? s.air_date) as string | undefined,
      })
    );
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

  async lookupOptions({ baseUrl, apiKey, optionType }): Promise<ProviderOption[]> {
    const path = optionType === "qualityProfiles"
      ? "/api/v3/qualityprofile"
      : "/api/v3/rootfolder";
    const url = new URL(path, baseUrl).toString();
    const body = await tauriGet(url, apiKey);
    const arr: Record<string, unknown>[] = Array.isArray(body) ? body : [];
    return arr.map((r) => ({
      id: Number(r.id),
      name: optionType === "rootFolders"
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

  async lookupOptions({ baseUrl, apiKey, optionType }): Promise<ProviderOption[]> {
    const path = optionType === "qualityProfiles"
      ? "/api/v3/qualityprofile"
      : "/api/v3/rootfolder";
    const url = new URL(path, baseUrl).toString();
    const body = await tauriGet(url, apiKey);
    const arr: Record<string, unknown>[] = Array.isArray(body) ? body : [];
    return arr.map((r) => ({
      id: Number(r.id),
      name: optionType === "rootFolders"
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
