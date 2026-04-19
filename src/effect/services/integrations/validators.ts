/**
 * Slice 2 — lightweight provider validation helpers.
 *
 * Each provider's health endpoint returns JSON; we extract a human-readable
 * summary and surface it in the ValidationResult.  The implementation is kept
 * generic: `validateApiKeyPlugin` can be reused for any future provider that
 * follows the same pattern (URL + API key → JSON health endpoint).
 *
 * HTTP requests are issued via an explicit Tauri Rust command (`check_integration`)
 * so they always run through Rust/reqwest and can never fall back to browser
 * fetch / CORS semantics.
 */

import { Effect } from "effect";
import { HttpError, NoPluginFound } from "~/effect/error";
import { commands } from "~/lib/tauri";
import { BUILT_IN_PLUGINS, type ValidationResult } from "./types";

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/**
 * Normalise a base URL:
 * - Strips trailing slashes
 * - Ensures a scheme is present (defaults to http)
 */
const HTTP_SCHEME_RE = /^https?:\/\//i;
const TRAILING_SLASH_RE = /\/+$/;

export const normalizeUrl = (raw: string): string => {
  let url = raw.trim();
  if (!url) {
    return url;
  }
  if (!HTTP_SCHEME_RE.test(url)) {
    url = `http://${url}`;
  }
  return url.replace(TRAILING_SLASH_RE, "");
};

// ---------------------------------------------------------------------------
// Generic HTTP health check
// ---------------------------------------------------------------------------

interface HealthCheckOptions {
  baseUrl: string;
  apiKey: string;
  /** Path relative to baseUrl, e.g. "/api/v1/settings/about" */
  healthPath: string;
  /** Extract a human-readable summary from the parsed JSON response */
  summarise: (body: unknown) => string;
}

const runHealthCheck = ({
  baseUrl,
  apiKey,
  healthPath,
  summarise,
}: HealthCheckOptions): Effect.Effect<ValidationResult, HttpError> =>
  Effect.tryPromise({
    try: async () => {
      // API key is sent via header only — never embed secrets in query strings.
      const url = new URL(healthPath, baseUrl);

      // Use the explicit Tauri Rust command so the request is always issued via
      // reqwest and can never fall back to browser fetch / CORS semantics.
      const res = await commands.checkIntegration(url.toString(), apiKey);

      if (!res.ok) {
        const err: { status: number; message: string } = {
          status: res.status,
          message: `HTTP ${res.status}: ${res.statusText}`,
        };
        throw err;
      }

      let body: unknown;
      try {
        body = JSON.parse(res.body);
      } catch {
        body = res.body;
      }
      return { body, status: res.status };
    },
    catch: (e) => {
      const err = e as { status?: number; message?: string };
      return new HttpError({
        status: err.status ?? 0,
        message: err.message ?? "Network error",
      });
    },
  }).pipe(
    Effect.map(({ body }) => {
      const normalizedUrl = normalizeUrl(baseUrl);
      return {
        success: true,
        normalizedUrl,
        message: summarise(body),
      } satisfies ValidationResult;
    })
  );

// ---------------------------------------------------------------------------
// Per-provider summarisers
// ---------------------------------------------------------------------------

const jellyseerrSummarise = (body: unknown): string => {
  const b = body as Record<string, unknown> | null;
  if (!b) {
    return "Connected";
  }
  const version = b.version as string | undefined;
  const appName = (b.applicationTitle as string | undefined) ?? "Jellyseerr";
  return version ? `${appName} v${version}` : appName;
};

const arrSummarise = (body: unknown): string => {
  // Sonarr & Radarr /api/v3/system/status returns { version, appName, ... }
  const b = body as Record<string, unknown> | null;
  if (!b) {
    return "Connected";
  }
  const version = b.version as string | undefined;
  const appName = (b.appName as string | undefined) ?? "Connected";
  return version ? `${appName} v${version}` : appName;
};

const SUMMARISERS: Record<string, (body: unknown) => string> = {
  jellyseerr: jellyseerrSummarise,
  sonarr: arrSummarise,
  radarr: arrSummarise,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate an api_key-based plugin connection.
 *
 * Looks up the plugin's healthPath from the registry so this function is
 * fully generic — just pass the pluginId, URL, and key.
 */
export const validateApiKeyPlugin = (
  pluginId: string,
  rawBaseUrl: string,
  apiKey: string
): Effect.Effect<ValidationResult, NoPluginFound> => {
  const plugin = BUILT_IN_PLUGINS.find((p) => p.pluginId === pluginId);
  if (!plugin) {
    return Effect.fail(new NoPluginFound());
  }

  const baseUrl = normalizeUrl(rawBaseUrl);
  const summarise = SUMMARISERS[pluginId] ?? (() => "Connected");

  return runHealthCheck({ baseUrl, apiKey, healthPath: plugin.healthPath, summarise }).pipe(
    Effect.catchTag("HttpError", (err) =>
      Effect.succeed<ValidationResult>({
        success: false,
        normalizedUrl: baseUrl,
        message: `Validation failed (HTTP ${err.status}): ${err.message}`,
      })
    )
  );
};
