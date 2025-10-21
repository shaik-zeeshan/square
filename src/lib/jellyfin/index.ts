import { Jellyfin, type RecommendedServerInfo } from "@jellyfin/sdk";
import { AUTH_PRESIST_KEY, type AuthStore } from "../persist-store";
import { safeJsonParse } from "../utils";

const clientName = import.meta.env.DEV ? "square-dev" : "square";
const hostname = import.meta.env.HOSTNAME;

export const jellyfin = new Jellyfin({
  clientInfo: {
    name: clientName,
    version: "1.0.0",
  },
  deviceInfo: {
    name: hostname,
    id: crypto.randomUUID(),
  },
});

export async function createAPI(token?: string) {
  const servers =
    await jellyfin.discovery.getRecommendedServerCandidates("localhost");
  // A utility function for finding the best result is available.
  // If there is no "best" server, an error message should be displayed.
  const best = jellyfin.discovery.findBestServer(servers);

  if (!best) {
    return;
  }

  // Create an API instance
  const api = jellyfin.createApi(best.address, token);
  return api;
}

export function getServers(url: string) {
  return jellyfin.discovery.getRecommendedServerCandidates(url);
}

export function createJellyfinClient(server: RecommendedServerInfo) {
  //let token = localStorage.getItem(ACCESS_TOKEN) ?? undefined;
  const auth_store: AuthStore = safeJsonParse(
    localStorage.getItem(AUTH_PRESIST_KEY),
    { isUserLoggedIn: false, accessToken: null }
  );

  // Create an API instance
  const api = jellyfin.createApi(
    server.address,
    auth_store.accessToken ?? undefined
  );
  return api;
}

export async function createJellyfinAPI() {
  const servers =
    await jellyfin.discovery.getRecommendedServerCandidates("192.168.0.3");
  // A utility function for finding the best result is available.
  // If there is no "best" server, an error message should be displayed.
  const best = jellyfin.discovery.findBestServer(servers);

  if (!best) {
    return;
  }

  //let token = localStorage.getItem(ACCESS_TOKEN) ?? undefined;
  const auth_store: AuthStore = safeJsonParse(
    localStorage.getItem(AUTH_PRESIST_KEY),
    { isUserLoggedIn: false, accessToken: null }
  );

  // Create an API instance
  const api = jellyfin.createApi(
    best.address,
    auth_store.accessToken ?? undefined
  );
  return api;
}

const filterUndefined = (item: unknown) => item !== undefined;

// biome-ignore lint/suspicious/noExplicitAny: it's a generic function
export function query<F extends (...args: any) => any>(
  func: F,
  key: string | number
): F & {
  key: string | number;
  keyFor: (...id: (string | number | undefined)[]) => string;
} {
  // Cast to allow adding properties to the function
  const enhancedFunc = func as F & {
    key: string | number;
    keyFor: (...id: (string | number | undefined)[]) => string;
  };

  // Add properties directly to the function object
  enhancedFunc.key = key;
  enhancedFunc.keyFor = (...id: (string | number | undefined)[]) =>
    `${key}${id.filter(filterUndefined).map(String).join("/")}`;

  return enhancedFunc;
}
