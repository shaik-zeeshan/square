import { Effect } from "effect";
import {
  createEffectMutation,
  createEffectQuery,
  createQueryDataHelpers,
  createQueryKey,
} from "~/effect/tanstack/query";
import { showErrorToast, showSuccessToast } from "~/lib/toast";
import { IntegrationService } from "./service";
import type {
  CapabilityActionPayload,
  IntegrationConnection,
  IntegrationPlugin,
  ProviderOption,
  ProviderOptionType,
  ProviderOptions,
  TvSeason,
} from "./types";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const integrationPluginsKey = createQueryKey("integrationPlugins");
export const integrationPluginsHelpers = createQueryDataHelpers<
  readonly IntegrationPlugin[]
>(integrationPluginsKey);

export const integrationConnectionsKey = createQueryKey(
  "integrationConnections"
);
export const integrationConnectionsHelpers = createQueryDataHelpers<
  IntegrationConnection[]
>(integrationConnectionsKey);

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const useIntegrationPluginsQuery = () =>
  createEffectQuery(() => ({
    queryKey: integrationPluginsKey(),
    queryFn: () =>
      IntegrationService.pipe(Effect.flatMap((svc) => svc.listPlugins())),
  }));

export const useIntegrationConnectionsQuery = () =>
  createEffectQuery(() => ({
    queryKey: integrationConnectionsKey(),
    queryFn: () =>
      IntegrationService.pipe(Effect.flatMap((svc) => svc.listConnections())),
  }));

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Validate and save a new integration connection using the canonical
 * `IntegrationService.createConnection` method with `validate: true`.
 * This eliminates duplicated client-side validation logic.
 */
export const useCreateConnectionMutation = () =>
  createEffectMutation(() => ({
    mutationKey: ["createConnection"],
    mutationFn: (variables: {
      connection: IntegrationConnection;
      apiKey: string;
    }) =>
      IntegrationService.pipe(
        Effect.flatMap((svc) =>
          svc.createConnection(variables.connection, variables.apiKey, {
            validate: true,
          })
        ),
        Effect.flatMap((result) => {
          const vr = result.validationResult;
          if (vr && !vr.success) {
            return Effect.fail(new Error(vr.message));
          }
          return Effect.succeed(result);
        }),
        Effect.tap(() =>
          Effect.promise(() =>
            integrationConnectionsHelpers.invalidateAllQueries()
          )
        ),
        Effect.tap((result) =>
          Effect.sync(() =>
            showSuccessToast(`Connected to ${result.connection.displayName}`)
          )
        ),
        Effect.catchAll((e) => {
          const msg =
            e instanceof Error ? e.message : "Failed to save connection";
          showErrorToast(msg);
          return Effect.fail(e);
        })
      ),
  }));

export const useRemoveConnectionMutation = () =>
  createEffectMutation(() => ({
    mutationKey: ["removeConnection"],
    mutationFn: (variables: { connectionId: string }) =>
      IntegrationService.pipe(
        Effect.flatMap((svc) => svc.removeConnection(variables.connectionId)),
        Effect.tap(() =>
          Effect.promise(() =>
            integrationConnectionsHelpers.invalidateAllQueries()
          )
        ),
        Effect.tap(() =>
          Effect.sync(() => showSuccessToast("Integration removed"))
        ),
        Effect.catchAll((e) => {
          showErrorToast("Failed to remove connection");
          return Effect.fail(e);
        })
      ),
  }));

// ---------------------------------------------------------------------------
// Capability operations (Slice C)
// ---------------------------------------------------------------------------

export const useSearchIntegrationMutation = () =>
  createEffectMutation(() => ({
    mutationKey: ["integrationSearch"],
    mutationFn: (variables: { connectionId: string; query: string }) =>
      IntegrationService.pipe(
        Effect.flatMap((svc) =>
          svc.dispatchSearch(variables.connectionId, variables.query)
        ),
        Effect.catchAll((e) => {
          const msg = e instanceof Error ? e.message : "Search failed";
          showErrorToast(msg);
          return Effect.fail(e);
        })
      ),
  }));

export const useActionIntegrationMutation = () =>
  createEffectMutation(() => ({
    mutationKey: ["integrationAction"],
    mutationFn: (variables: {
      connectionId: string;
      payload: CapabilityActionPayload;
    }) =>
      IntegrationService.pipe(
        Effect.flatMap((svc) =>
          svc.dispatchAction(variables.connectionId, variables.payload)
        ),
        Effect.tap((result) =>
          Effect.sync(() => {
            if (result.success) {
              showSuccessToast(result.message);
            } else {
              showErrorToast(result.message);
            }
          })
        ),
        Effect.catchAll((e) => {
          const msg = e instanceof Error ? e.message : "Action failed";
          showErrorToast(msg);
          return Effect.fail(e);
        })
      ),
  }));

// ---------------------------------------------------------------------------
// Provider option lookups (quality profiles, root folders)
// ---------------------------------------------------------------------------

export const providerOptionsKey = createQueryKey<
  "providerOptions",
  { connectionId: string; optionType: ProviderOptionType }
>("providerOptions");

export const useProviderOptionsQuery = (
  connectionId: () => string | undefined,
  optionType: ProviderOptionType
) =>
  createEffectQuery(() => ({
    queryKey: providerOptionsKey({
      connectionId: connectionId() ?? "",
      optionType,
    }),
    queryFn: () => {
      const connId = connectionId();
      if (!connId) {
        return Effect.succeed([] as ProviderOption[]);
      }
      return IntegrationService.pipe(
        Effect.flatMap((svc) => svc.lookupOptions(connId, optionType)),
        Effect.catchAll(() => Effect.succeed([] as ProviderOption[]))
      );
    },
    enabled: !!connectionId(),
  }));

export const providerOptionsAllKey = createQueryKey<
  "providerOptionsAll",
  { connectionId: string }
>("providerOptionsAll");

/**
 * Fetch both quality profiles and root folders in a single query.
 * Returns `ProviderOptions` — suitable for Sonarr/Radarr add-item forms.
 */
export const useFetchProviderOptionsQuery = (
  connectionId: () => string | undefined
) =>
  createEffectQuery(() => ({
    queryKey: providerOptionsAllKey({ connectionId: connectionId() ?? "" }),
    queryFn: () => {
      const connId = connectionId();
      if (!connId) {
        return Effect.succeed<ProviderOptions>({
          qualityProfiles: [],
          rootFolders: [],
        });
      }
      return IntegrationService.pipe(
        Effect.flatMap((svc) => svc.fetchProviderOptions(connId)),
        Effect.catchAll(() =>
          Effect.succeed<ProviderOptions>({
            qualityProfiles: [],
            rootFolders: [],
          })
        )
      );
    },
    enabled: !!connectionId(),
  }));

// ---------------------------------------------------------------------------
// TV season lookup (Jellyseerr)
// ---------------------------------------------------------------------------

export const tvSeasonsKey = createQueryKey<
  "tvSeasons",
  { connectionId: string; mediaId: number }
>("tvSeasons");

/**
 * Fetch the season list for a TV series from a Jellyseerr connection.
 * The query is disabled until both `connectionId` and `mediaId` are provided.
 */
export const useTvSeasonsQuery = (
  connectionId: () => string | undefined,
  mediaId: () => number | undefined
) =>
  createEffectQuery(() => ({
    queryKey: tvSeasonsKey({
      connectionId: connectionId() ?? "",
      mediaId: mediaId() ?? 0,
    }),
    queryFn: () => {
      const connId = connectionId();
      const mid = mediaId();
      if (!connId || mid == null) {
        return Effect.succeed([] as TvSeason[]);
      }
      return IntegrationService.pipe(
        Effect.flatMap((svc) => svc.fetchTvSeasons(connId, mid)),
        Effect.catchAll(() => Effect.succeed([] as TvSeason[]))
      );
    },
    enabled: !!(connectionId() && mediaId() != null),
  }));
