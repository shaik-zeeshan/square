import type { RecommendedServerInfo } from "@jellyfin/sdk";
import type { Api } from "@jellyfin/sdk/lib/api";
import { getUserApi } from "@jellyfin/sdk/lib/utils/api/user-api";
import {
  AUTH_PRESIST_KEY,
  type AuthStore,
  SERVERS_KEY,
  type ServerStore,
} from "../persist-store";
import { safeJsonParse } from "../utils";
import { createJellyfinClient, query } from ".";

const _getAuthStore = () => {
  const auth_store = localStorage.getItem(AUTH_PRESIST_KEY);

  return safeJsonParse(auth_store, {
    isUserLoggedIn: false,
    accessToken: null,
    user: null,
  });
};

export const setAuthStore = (value: AuthStore | {}, replace = false) => {
  const auth_store = localStorage.getItem(AUTH_PRESIST_KEY);
  const new_value = JSON.stringify({
    ...(replace
      ? {}
      : safeJsonParse(auth_store, {
          isUserLoggedIn: false,
          accessToken: null,
          user: null,
        })),
    ...value,
  });

  localStorage.setItem(AUTH_PRESIST_KEY, new_value);

  const storageEvent = new StorageEvent("storage", {
    key: AUTH_PRESIST_KEY,
    oldValue: auth_store,
    newValue: new_value,
  });

  window.dispatchEvent(storageEvent);
};

export const setServerStore = (value: ServerStore | {}, replace = false) => {
  const serverStore = localStorage.getItem(SERVERS_KEY);
  const newValue = JSON.stringify({
    ...(replace
      ? {}
      : safeJsonParse(serverStore, { current: null, servers: [] })),
    ...value,
  });

  localStorage.setItem(SERVERS_KEY, newValue);

  const storageEvent = new StorageEvent("storage", {
    key: SERVERS_KEY,
    oldValue: serverStore,
    newValue,
  });

  window.dispatchEvent(storageEvent);
};

const mutation = {
  login: async (
    username: string,
    password: string,
    server: RecommendedServerInfo
  ) => {
    const jf = createJellyfinClient(server);
    if (!jf) {
      throw new Error("JellyFin not Found");
    }

    const loginReq = await jf.authenticateUserByName(username, password);

    if (loginReq.status !== 200) {
      throw new Error(loginReq.statusText);
    }

    const token = loginReq.data.AccessToken;

    if (!token) {
      throw new Error("token not found");
    }

    setAuthStore({ accessToken: token, isUserLoggedIn: true });

    return token;
  },
  logout: async () => {
    setAuthStore(
      { isUserLoggedIn: false, accessToken: null, user: null },
      true
    );
    setServerStore({ current: null });
  },
};

const queries = {
  details: query(async (jf: Api) => {
    const userReq = await getUserApi(jf).getCurrentUser();

    if (userReq.status !== 200) {
      throw new Error(userReq.statusText);
    }

    return userReq.data;
  }, "user"),
};

export const user = {
  mutation,
  query: queries,
};
