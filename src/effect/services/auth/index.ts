import type { Api, RecommendedServerInfo } from "@jellyfin/sdk";
import type { UserDto } from "@jellyfin/sdk/lib/generated-client";
import { appDataDir } from "@tauri-apps/api/path";
import { Stronghold } from "@tauri-apps/plugin-stronghold";
import { Effect, Ref } from "effect";
import { commands } from "~/lib/tauri";
import {
  AuthError,
  NoPasswordFound,
  NoServerFound,
  NoTokenFound,
  NoUserFound,
} from "../../error";
import {
  JellyfinClientService,
  JellyfinClientServiceLayer,
} from "../jellyfin/client";
import { AuthStorageService, AuthStorageServiceLayer } from "../storage/auth";

/*
 *
 *
 *
 * Stronghold Helpers
 *
 *
 *
 */

function createKey(serverAddress: string, username: string): string {
  return `${serverAddress}:${username}`;
}

const initStrongHold = () =>
  Effect.promise(async () => {
    const vaultPath = `${await appDataDir()}/vault.hold`;

    const vaultPassword = await commands.getVaultPassword();

    const stronghold = await Stronghold.load(vaultPath, vaultPassword);

    try {
      return [
        stronghold,
        await stronghold.loadClient("square_credentials"),
      ] as const;
    } catch {
      return [
        stronghold,
        await stronghold.createClient("square_credentials"),
      ] as const;
    }
  });
const getPassword = (server: RecommendedServerInfo, user: string) =>
  Effect.gen(function* () {
    const [_, client] = yield* initStrongHold();

    const userKey = createKey(server.systemInfo?.Id as string, user);

    const store = client.getStore();

    const data = yield* Effect.tryPromise({
      try: () => store.get(userKey),
      catch: () => new NoPasswordFound(),
    });

    if (!data) {
      return yield* new NoPasswordFound();
    }

    const password = new TextDecoder().decode(new Uint8Array(data));

    return password;
  });

const setPassword = (
  server: RecommendedServerInfo,
  user: string,
  password: string
) =>
  Effect.gen(function* () {
    const [stronghold, client] = yield* initStrongHold();

    const userKey = createKey(server.systemInfo?.Id as string, user);

    const store = client.getStore();
    const encodePassword = Array.from(new TextEncoder().encode(password));

    return yield* Effect.tryPromise({
      try: async () => {
        await store.remove(userKey);
        await store.insert(userKey, encodePassword);

        await stronghold.save();
      },
      catch: (_e) => new AuthError({ message: "Not Able to Save Password" }),
    });
  });

/*
 *
 *
 *
 * Auth Service
 *
 *
 *
 */

export class AuthService extends Effect.Service<AuthService>()("AuthService", {
  dependencies: [AuthStorageServiceLayer, JellyfinClientServiceLayer],
  effect: Effect.gen(function* () {
    const authStorage = yield* AuthStorageService;
    const jfclient = yield* JellyfinClientService;
    const apiRef = yield* Ref.make<Api | null>(null);
    const userRef = yield* Ref.make<UserDto | null>(null);

    /*
     *
     *
     * Methods
     *
     *
     */

    const getUser = () =>
      authStorage.get("user").pipe(
        Effect.mapError(() => new NoUserFound()),
        Effect.flatMap((data) =>
          data === null ? Effect.fail(new NoUserFound()) : Effect.succeed(data)
        ),
        Effect.tap((data) => Ref.set(userRef, data))
      );
    const getAccessToken = () =>
      authStorage.get("accessToken").pipe(
        Effect.mapError(() => new NoTokenFound()),
        Effect.flatMap((data) =>
          data === null ? Effect.fail(new NoTokenFound()) : Effect.succeed(data)
        )
      );

    const getServer = () =>
      authStorage.get("server").pipe(
        Effect.mapError(() => new NoServerFound()),
        Effect.flatMap((data) =>
          data === null
            ? Effect.fail(new NoServerFound())
            : Effect.succeed(data)
        )
      );

    const getApi = () =>
      Effect.gen(function* () {
        // Check if we already have a cached API
        const cachedApi = yield* Ref.get(apiRef);

        if (cachedApi) {
          return cachedApi;
        }

        // Get server info
        const server = yield* authStorage.get("server").pipe(
          Effect.mapError(() => new NoServerFound()),
          Effect.flatMap((data) =>
            data === null
              ? Effect.fail(new NoServerFound())
              : Effect.succeed(data)
          )
        );

        // Get access token
        const token = yield* authStorage.get("accessToken").pipe(
          Effect.mapError(() => new NoTokenFound()),
          Effect.flatMap((data) =>
            data === null
              ? Effect.fail(new NoTokenFound())
              : Effect.succeed(data)
          )
        );

        // Create new API instance
        const api = yield* jfclient.getApi(server, token);

        // Only cache the API if we have a valid token
        if (token) {
          yield* Ref.set(apiRef, api);
        }

        return api;
      });

    const login = (
      server: RecommendedServerInfo,
      username: string,
      password: string
    ) =>
      Effect.gen(function* () {
        const api = yield* jfclient.getApi(server);

        const data = yield* Effect.tryPromise({
          try: () => api.authenticateUserByName(username, password),
          catch: (e) => new AuthError({ message: (e as Error).message }),
        }).pipe(
          Effect.flatMap((data) =>
            data.status !== 200
              ? Effect.fail(new AuthError({ message: data.statusText }))
              : Effect.succeed(data)
          )
        );

        // yield* jfclient.addUser(server, username);

        yield* authStorage.set("accessToken", data.data.AccessToken ?? "");
        yield* authStorage.set("user", data.data.User ?? null);
        yield* authStorage.set("server", server);

        yield* Effect.runFork(getApi());
        yield* Effect.runFork(getUser());
      });

    const logout = () =>
      Effect.gen(function* () {
        // Clear cached API on logout
        yield* Ref.set(apiRef, null);
        yield* Ref.set(userRef, null);

        yield* authStorage.remove("accessToken");
        yield* authStorage.remove("user");
        yield* authStorage.remove("server");
      });

    return {
      getPassword,
      setPassword,
      getUser,
      getAccessToken,
      getServer,
      getApi,
      login,
      logout,
    };
  }),
}) {}

export const AuthServiceLayer = AuthService.Default;
