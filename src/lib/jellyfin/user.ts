import { createJellyfinClient, query } from '.';
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';
import {
  AUTH_PRESIST_KEY,
  AuthStore,
  GENERAL_INFO_KEY,
  GeneralInfo,
  SERVERS_KEY,
  ServerStore,
} from '../persist-store';
import { Api } from '@jellyfin/sdk/lib/api';
import { safeJsonParse } from '../utils';
import { RecommendedServerInfo } from '@jellyfin/sdk';

const getAuthStore = () => {
  let auth_store = localStorage.getItem(AUTH_PRESIST_KEY);

  return safeJsonParse(auth_store, {
    isUserLoggedIn: false,
    accessToken: null,
  });
};

export const setAuthStore = (
  value: AuthStore | {},
  replace: boolean = false
) => {
  let auth_store = localStorage.getItem(AUTH_PRESIST_KEY);
  let new_value = JSON.stringify({
    ...(!replace
      ? safeJsonParse(auth_store, { isUserLoggedIn: false, accessToken: null })
      : {}),
    ...value,
  });

  localStorage.setItem(AUTH_PRESIST_KEY, new_value);

  let storageEvent = new StorageEvent('storage', {
    key: AUTH_PRESIST_KEY,
    oldValue: auth_store,
    newValue: new_value,
  });

  window.dispatchEvent(storageEvent);
};

export const setGeneralStore = (
  value: GeneralInfo | {},
  replace: boolean = false
) => {
  let generalInfo = localStorage.getItem(GENERAL_INFO_KEY);
  let newValue = JSON.stringify({
    ...(!replace ? safeJsonParse(generalInfo, { user: null }) : {}),
    ...value,
  });

  localStorage.setItem(GENERAL_INFO_KEY, newValue);

  let storageEvent = new StorageEvent('storage', {
    key: GENERAL_INFO_KEY,
    oldValue: generalInfo,
    newValue: newValue,
  });

  window.dispatchEvent(storageEvent);
};

export const setServerStore = (
  value: ServerStore | {},
  replace: boolean = false
) => {
  let serverStore = localStorage.getItem(SERVERS_KEY);
  let newValue = JSON.stringify({
    ...(!replace
      ? safeJsonParse(serverStore, { current: null, servers: [] })
      : {}),
    ...value,
  });

  localStorage.setItem(SERVERS_KEY, newValue);

  let storageEvent = new StorageEvent('storage', {
    key: SERVERS_KEY,
    oldValue: serverStore,
    newValue: newValue,
  });

  window.dispatchEvent(storageEvent);
};

const mutation = {
  login: async (
    username: string,
    password: string,
    server: RecommendedServerInfo
  ) => {
    let jf = createJellyfinClient(server);
    if (!jf) {
      throw new Error('JellyFin not Found');
    }

    let loginReq = await jf.authenticateUserByName(username, password);

    if (loginReq.status !== 200) {
      throw new Error(loginReq.statusText);
    }

    let token = loginReq.data.AccessToken;

    if (!token) {
      throw new Error('token not found');
    }

    setAuthStore({ accessToken: token, isUserLoggedIn: true });

    return token;
  },
  logout: async () => {
    setAuthStore({ isUserLoggedIn: false, accessToken: null }, true);
    setServerStore({ current: null });
    setGeneralStore({ user: null });
  },
};

const queries = {
  details: query(async (jf: Api) => {
    let userReq = await getUserApi(jf).getCurrentUser();

    if (userReq.status !== 200) {
      throw new Error(userReq.statusText);
    }

    return userReq.data;
  }, 'user'),
};

export const user = {
  mutation,
  query: queries,
};
