import { Jellyfin, type RecommendedServerInfo } from "@jellyfin/sdk";
import { Effect } from "effect";
import { NoServerFound } from "../../error";
import {
  ServerStorageService,
  ServerStorageServiceLayer,
} from "../storage/server";

const clientName = import.meta.env.DEV ? "square-dev" : "square";
const hostname = import.meta.env.HOSTNAME || "device";

/*
 *
 *
 *
 * Jellyfin Client Service
 *
 *
 *
 */

export class JellyfinClientService extends Effect.Service<JellyfinClientService>()(
  "JellyfinClientService",
  {
    dependencies: [ServerStorageServiceLayer],
    effect: Effect.gen(function* () {
      const serverStore = yield* ServerStorageService;

      const jellyfin = new Jellyfin({
        clientInfo: {
          name: clientName,
          version: "1.0.0",
        },
        deviceInfo: {
          name: hostname,
          id: crypto.randomUUID(),
        },
      });

      /*
       *
       * API
       *
       *
       */

      const getApi = (server: RecommendedServerInfo, token?: string) =>
        Effect.sync(() => {
          const api = jellyfin.createApi(server.address, token);
          return api;
        });

      /*
       *
       * Servers
       *
       *
       */

      const searchServers = (url: string) =>
        Effect.gen(function* () {
          const servers = yield* Effect.tryPromise({
            try: () => jellyfin.discovery.getRecommendedServerCandidates(url),
            catch: () => new NoServerFound(),
          });
          return servers;
        });

      const getServers = () =>
        serverStore
          .get("list")
          .pipe(
            Effect.flatMap((data) =>
              data === null ? Effect.succeed([]) : Effect.succeed(data)
            )
          );

      const addServer = (server: RecommendedServerInfo) =>
        Effect.gen(function* () {
          const servers = yield* getServers();

          yield* serverStore.set("list", servers.concat(server));
        });

      const removeServer = (server: RecommendedServerInfo) =>
        Effect.gen(function* () {
          const servers = yield* getServers();
          const usersList = yield* serverStore
            .get("users")
            .pipe(
              Effect.flatMap((data) =>
                data === null
                  ? Effect.succeed({} as Record<string, string[]>)
                  : Effect.succeed(data)
              )
            );

          delete usersList[server.systemInfo?.Id as string];

          yield* serverStore.set(
            "list",
            servers.filter(
              (ser) => ser.systemInfo?.Id !== server.systemInfo?.Id
            )
          );

          yield* serverStore.set("users", usersList);
        });

      /*
       *
       * Users
       *
       *
       */

      const getUsers = (server: RecommendedServerInfo) =>
        serverStore.get("users").pipe(
          Effect.flatMap((data) => {
            const innerData = data ?? {};
            const key = Object.keys(innerData).find(
              (id) => server.systemInfo?.Id === id
            );

            if (!key) {
              return Effect.succeed([]);
            }

            return Effect.succeed(innerData[key]);
          })
        );

      const addUser = (server: RecommendedServerInfo, user: string) =>
        Effect.gen(function* () {
          const presentUsers = yield* getUsers(server);

          const usersList = yield* serverStore
            .get("users")
            .pipe(
              Effect.flatMap((data) =>
                data === null
                  ? Effect.succeed({} as Record<string, string[]>)
                  : Effect.succeed(data)
              )
            );

          usersList[server.systemInfo?.Id as string] = Array.from(
            new Set([...presentUsers, user])
          );
          yield* serverStore.set("users", usersList);
        });

      const removeUser = (server: RecommendedServerInfo, user: string) =>
        Effect.gen(function* () {
          const presentUsers = yield* getUsers(server);

          const usersList = yield* serverStore
            .get("users")
            .pipe(
              Effect.flatMap((data) =>
                data === null
                  ? Effect.succeed({} as Record<string, string[]>)
                  : Effect.succeed(data)
              )
            );

          usersList[server.systemInfo?.Id as string] = presentUsers.filter(
            (u) => u !== user
          );
          yield* serverStore.set("users", usersList);
        });

      /*
       *
       * Returns
       *
       */

      return {
        client: jellyfin,
        getApi,

        searchServers,
        getServers,
        addServer,
        removeServer,

        getUsers,
        addUser,
        removeUser,
      };
    }),
  }
) {}

export const JellyfinClientServiceLayer = JellyfinClientService.Default;
