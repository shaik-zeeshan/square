import { Store } from "@tauri-apps/plugin-store";
import { Effect } from "effect";
import {
  CapabilityNotSupported,
  IntegrationOperationError,
  IntegrationSecretError,
  NoAdapterFound,
  NoConnectionFound,
  NoPluginFound,
} from "~/effect/error";
import {
  IntegrationConnectionStorageService,
  IntegrationConnectionStorageServiceLayer,
} from "../storage/integrations";
import { getAdapter } from "./adapters";
import {
  BUILT_IN_PLUGINS,
  type CapabilityActionPayload,
  type CapabilityActionResult,
  type IntegrationConnection,
  type IntegrationPlugin,
  type PluginSearchResult,
  type ProviderOption,
  type ProviderOptionType,
  type ProviderOptions,
  type TvSeason,
  type ValidationResult,
} from "./types";
import { validateApiKeyPlugin } from "./validators";

// ---------------------------------------------------------------------------
// File-backed store helpers (integration API key namespace)
// ---------------------------------------------------------------------------

const INTEGRATION_SECRETS_STORE = "integration_secrets";

let _secretsStore: Promise<Store> | undefined;
const getSecretsStore = (): Promise<Store> => {
  if (!_secretsStore) {
    _secretsStore = Store.load(INTEGRATION_SECRETS_STORE);
  }
  return _secretsStore;
};

export const getSecret = (connectionId: string) =>
  Effect.tryPromise({
    try: async () => {
      const store = await getSecretsStore();
      return (await store.get<string>(connectionId)) ?? null;
    },
    catch: () =>
      new IntegrationSecretError({ message: "Failed to read secret" }),
  });

export const setSecret = (connectionId: string, secret: string) =>
  Effect.tryPromise({
    try: async () => {
      const store = await getSecretsStore();
      await store.set(connectionId, secret);
      await store.save();
    },
    catch: () =>
      new IntegrationSecretError({ message: "Failed to save secret" }),
  });

export const removeSecret = (connectionId: string) =>
  Effect.gen(function* () {
    const existing = yield* Effect.tryPromise({
      try: async () => {
        const store = await getSecretsStore();
        return (await store.get<string>(connectionId)) ?? null;
      },
      catch: () =>
        new IntegrationSecretError({
          message: "Failed to read secret",
          kind: "storage-failure",
        }),
    });

    if (!existing) {
      // Secret was never written or was already removed — treat as benign.
      return yield* Effect.fail(
        new IntegrationSecretError({
          message: "Secret not found",
          kind: "not-found",
        })
      );
    }

    yield* Effect.tryPromise({
      try: async () => {
        const store = await getSecretsStore();
        await store.delete(connectionId);
        await store.save();
      },
      catch: () =>
        new IntegrationSecretError({
          message: "Failed to remove secret",
          kind: "storage-failure",
        }),
    });
  });

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class IntegrationService extends Effect.Service<IntegrationService>()(
  "IntegrationService",
  {
    dependencies: [IntegrationConnectionStorageServiceLayer],
    effect: Effect.gen(function* () {
      const storage = yield* IntegrationConnectionStorageService;

      // ------------------------------------------------------------------
      // Plugin registry
      // ------------------------------------------------------------------

      const listPlugins = (): Effect.Effect<readonly IntegrationPlugin[]> =>
        Effect.succeed(BUILT_IN_PLUGINS);

      const getPlugin = (
        pluginId: string
      ): Effect.Effect<IntegrationPlugin, NoPluginFound> => {
        const plugin = BUILT_IN_PLUGINS.find((p) => p.pluginId === pluginId);
        return plugin
          ? Effect.succeed(plugin)
          : Effect.fail(new NoPluginFound());
      };

      // ------------------------------------------------------------------
      // Index helpers
      // ------------------------------------------------------------------

      const readIndex = () =>
        storage.getOrElse("_index", [] as string[]).pipe(
          Effect.map((v) => v as string[]),
          Effect.orDie
        );

      const writeIndex = (ids: string[]) =>
        storage.set("_index", ids as unknown as string[]).pipe(Effect.orDie);

      // ------------------------------------------------------------------
      // Connection CRUD
      // ------------------------------------------------------------------

      const listConnections = (): Effect.Effect<IntegrationConnection[]> =>
        Effect.gen(function* () {
          const ids = yield* readIndex();
          const results: IntegrationConnection[] = [];

          for (const id of ids) {
            const conn = yield* storage.get(id as keyof typeof storage).pipe(
              Effect.map((v) => v as unknown as IntegrationConnection | null),
              Effect.orElse(() => Effect.succeed(null))
            );
            if (conn) {
              results.push(conn);
            }
          }

          return results;
        });

      const saveConnection = (
        connection: IntegrationConnection
      ): Effect.Effect<void> =>
        Effect.gen(function* () {
          const ids = yield* readIndex();
          const next = ids.includes(connection.connectionId)
            ? ids
            : [...ids, connection.connectionId];

          yield* storage
            .set(
              connection.connectionId as keyof typeof storage,
              connection as unknown as string[]
            )
            .pipe(Effect.orDie);
          yield* writeIndex(next);
        });

      const removeConnection = (
        connectionId: string
      ): Effect.Effect<void, IntegrationSecretError> =>
        Effect.gen(function* () {
          // Remove the secret first.  If this fails we abort before touching
          // metadata so the connection record remains discoverable and the
          // caller can retry.  A pre-existing absent secret is not an error.
          yield* removeSecret(connectionId).pipe(
            Effect.catchAll((err) => {
              // Only ignore the benign case where the secret was never written
              // or was already absent.  Real storage failures must propagate so
              // we abort before touching metadata and avoid orphaned secrets.
              if (
                err._tag === "IntegrationSecretError" &&
                err.kind === "not-found"
              ) {
                return Effect.succeed(undefined);
              }
              return Effect.fail(err);
            })
          );

          const ids = yield* readIndex();
          const next = ids.filter((id) => id !== connectionId);

          yield* storage
            .remove(connectionId as keyof typeof storage)
            .pipe(Effect.orDie);
          yield* writeIndex(next);
        });

      const getConnection = (
        connectionId: string
      ): Effect.Effect<IntegrationConnection, NoConnectionFound> =>
        storage.get(connectionId as keyof typeof storage).pipe(
          Effect.map((v) => v as unknown as IntegrationConnection | null),
          Effect.flatMap((v) =>
            v ? Effect.succeed(v) : Effect.fail(new NoConnectionFound())
          ),
          Effect.mapError(() => new NoConnectionFound())
        );

      // ------------------------------------------------------------------
      // Validation
      // ------------------------------------------------------------------

      /**
       * Validate a connection's credentials against the provider's health
        * endpoint without persisting anything.  Retrieves the stored API key
        * from local file-backed storage automatically.
       */
      const validateConnection = (
        connectionId: string
      ): Effect.Effect<
        ValidationResult,
        NoConnectionFound | IntegrationSecretError | NoPluginFound
      > =>
        Effect.gen(function* () {
          const conn = yield* getConnection(connectionId);
          const apiKey = yield* getSecret(connectionId);

          if (!apiKey) {
            return yield* Effect.fail(
              new IntegrationSecretError({
                message: "No API key stored for this connection",
              })
            );
          }

          return yield* validateApiKeyPlugin(
            conn.pluginId,
            conn.baseUrl,
            apiKey
          );
        });

      /**
       * Create a new connection, optionally validate it first, then persist.
       * Pass `validate: true` to run the health check before saving.
       *
       * Persistence is best-effort atomic: metadata is written first, then the
       * secret.  If the secret write fails the metadata write is rolled back so
       * callers never see a connection record with no corresponding secret.
       */
      const createConnection = (
        connectionInput: IntegrationConnection,
        apiKey: string,
        opts: { validate: boolean } = { validate: false }
      ): Effect.Effect<
        {
          connection: IntegrationConnection;
          validationResult?: ValidationResult;
        },
        IntegrationSecretError | NoPluginFound
      > =>
        Effect.gen(function* () {
          let validationResult: ValidationResult | undefined;
          let connection = connectionInput;

          if (opts.validate) {
            // validateApiKeyPlugin absorbs HttpError into a failed ValidationResult
            validationResult = yield* validateApiKeyPlugin(
              connection.pluginId,
              connection.baseUrl,
              apiKey
            );

            // Do NOT persist if validation failed.
            if (!validationResult.success) {
              return { connection, validationResult };
            }

            // Persist normalised URL if available
            if (validationResult.normalizedUrl) {
              connection = {
                ...connection,
                baseUrl: validationResult.normalizedUrl,
              };
            }
          }

          // Stamp the validation summary onto the record before writing.
          if (validationResult) {
            connection = {
              ...connection,
              lastValidationSummary: validationResult.message ?? null,
            };
          }

          // Write metadata first.
          yield* saveConnection(connection);

          // Attempt secret write; on failure roll back the metadata record.
          yield* setSecret(connection.connectionId, apiKey).pipe(
            Effect.catchAll((secretErr) =>
              Effect.gen(function* () {
                // Best-effort rollback — ignore secondary failures.
                yield* removeConnection(connection.connectionId).pipe(
                  Effect.ignore
                );
                return yield* Effect.fail(secretErr);
              })
            )
          );

          return { connection, validationResult };
        });

      // ------------------------------------------------------------------
      // Capability dispatch
      // ------------------------------------------------------------------

      /**
       * Execute a `search` capability against a saved connection.
        * Resolves the adapter for the connection's plugin, fetches the stored
        * API key from local file-backed storage, and delegates to the adapter's `search` method.
       */
      const dispatchSearch = (
        connectionId: string,
        query: string,
        mediaType?: string
      ): Effect.Effect<
        PluginSearchResult[],
        | NoConnectionFound
        | NoPluginFound
        | NoAdapterFound
        | CapabilityNotSupported
        | IntegrationSecretError
        | IntegrationOperationError
      > =>
        Effect.gen(function* () {
          const conn = yield* getConnection(connectionId);
          const plugin = yield* getPlugin(conn.pluginId);

          if (!plugin.capabilities.includes("search")) {
            return yield* Effect.fail(new CapabilityNotSupported());
          }

          const adapter = getAdapter(conn.pluginId);
          if (!adapter?.search) {
            return yield* Effect.fail(new NoAdapterFound());
          }

          const apiKey = yield* getSecret(connectionId);
          if (!apiKey) {
            return yield* Effect.fail(
              new IntegrationSecretError({
                message: "No API key stored for this connection",
              })
            );
          }

          const results = yield* Effect.tryPromise({
            try: () =>
              // biome-ignore lint/style/noNonNullAssertion: checked above
              adapter.search!({
                connectionId,
                baseUrl: conn.baseUrl,
                apiKey,
                query,
                mediaType,
              }),
            catch: (e) =>
              new IntegrationOperationError({
                message: e instanceof Error ? e.message : "Search failed",
              }),
          });

          return results.slice(0, 10);
        });

      /**
       * Execute a non-search capability action against a saved connection.
       * Resolves the adapter and delegates to its `dispatch` method.
       */
      const dispatchAction = (
        connectionId: string,
        payload: CapabilityActionPayload
      ): Effect.Effect<
        CapabilityActionResult,
        | NoConnectionFound
        | NoPluginFound
        | NoAdapterFound
        | CapabilityNotSupported
        | IntegrationSecretError
        | IntegrationOperationError
      > =>
        Effect.gen(function* () {
          const conn = yield* getConnection(connectionId);
          const plugin = yield* getPlugin(conn.pluginId);

          if (!plugin.capabilities.includes(payload.capability)) {
            return yield* Effect.fail(new CapabilityNotSupported());
          }

          const adapter = getAdapter(conn.pluginId);
          if (!adapter?.dispatch) {
            return yield* Effect.fail(new NoAdapterFound());
          }

          const apiKey = yield* getSecret(connectionId);
          if (!apiKey) {
            return yield* Effect.fail(
              new IntegrationSecretError({
                message: "No API key stored for this connection",
              })
            );
          }

          return yield* Effect.tryPromise({
            try: () =>
              // biome-ignore lint/style/noNonNullAssertion: checked above
              adapter.dispatch!({
                connectionId,
                baseUrl: conn.baseUrl,
                apiKey,
                payload,
              }),
            catch: (e) =>
              new IntegrationOperationError({
                message: e instanceof Error ? e.message : "Action failed",
              }),
          });
        });

      // ------------------------------------------------------------------
      // Provider option lookups
      // ------------------------------------------------------------------

      const lookupOptions = (
        connectionId: string,
        optionType: ProviderOptionType
      ): Effect.Effect<
        ProviderOption[],
        | NoConnectionFound
        | NoAdapterFound
        | IntegrationSecretError
        | IntegrationOperationError
      > =>
        Effect.gen(function* () {
          const conn = yield* getConnection(connectionId);
          const adapter = getAdapter(conn.pluginId);
          if (!adapter?.lookupOptions) {
            return yield* Effect.fail(new NoAdapterFound());
          }

          const apiKey = yield* getSecret(connectionId);
          if (!apiKey) {
            return yield* Effect.fail(
              new IntegrationSecretError({
                message: "No API key stored for this connection",
              })
            );
          }

          return yield* Effect.tryPromise({
            try: () =>
              // biome-ignore lint/style/noNonNullAssertion: checked above
              adapter.lookupOptions!({
                baseUrl: conn.baseUrl,
                apiKey,
                optionType,
              }),
            catch: (e) =>
              new IntegrationOperationError({
                message: e instanceof Error ? e.message : "Lookup failed",
              }),
          });
        });

      /**
       * Fetch both quality profiles and root folders in parallel and return
       * them as a single `ProviderOptions` object.  Intended for Sonarr/Radarr
       * add-item forms that need both lists before the user submits.
       */
      const fetchProviderOptions = (
        connectionId: string
      ): Effect.Effect<
        ProviderOptions,
        | NoConnectionFound
        | NoAdapterFound
        | IntegrationSecretError
        | IntegrationOperationError
      > =>
        Effect.all(
          {
            qualityProfiles: lookupOptions(connectionId, "qualityProfiles"),
            rootFolders: lookupOptions(connectionId, "rootFolders"),
          },
          { concurrency: "unbounded" }
        );

      // ------------------------------------------------------------------
      // TV season lookup (Jellyseerr)
      // ------------------------------------------------------------------

      /**
       * Fetch the season list for a TV series from a Jellyseerr connection.
       * `mediaId` must be the TMDB series id (as returned in `PluginSearchResult.id`).
       */
      const fetchTvSeasons = (
        connectionId: string,
        mediaId: number
      ): Effect.Effect<
        TvSeason[],
        | NoConnectionFound
        | NoAdapterFound
        | IntegrationSecretError
        | IntegrationOperationError
      > =>
        Effect.gen(function* () {
          const conn = yield* getConnection(connectionId);
          const adapter = getAdapter(conn.pluginId);
          if (!adapter?.fetchTvSeasons) {
            return yield* Effect.fail(new NoAdapterFound());
          }

          const apiKey = yield* getSecret(connectionId);
          if (!apiKey) {
            return yield* Effect.fail(
              new IntegrationSecretError({
                message: "No API key stored for this connection",
              })
            );
          }

          return yield* Effect.tryPromise({
            try: () =>
              // biome-ignore lint/style/noNonNullAssertion: checked above
              adapter.fetchTvSeasons!({
                baseUrl: conn.baseUrl,
                apiKey,
                mediaId,
              }),
            catch: (e) =>
              new IntegrationOperationError({
                message:
                  e instanceof Error ? e.message : "TV season lookup failed",
              }),
          });
        });

      // ------------------------------------------------------------------

      return {
        listPlugins,
        getPlugin,
        listConnections,
        saveConnection,
        removeConnection,
        getConnection,
        getSecret,
        setSecret,
        removeSecret,
        validateConnection,
        createConnection,
        dispatchSearch,
        dispatchAction,
        lookupOptions,
        fetchProviderOptions,
        fetchTvSeasons,
      };
    }),
  }
) {}

export const IntegrationServiceLayer = IntegrationService.Default;
