import { UserDto } from '@jellyfin/sdk/lib/generated-client/models';
import { makePersisted } from '@solid-primitives/storage';
import { createStore } from 'solid-js/store';
import { createEventListener } from '@solid-primitives/event-listener';
import { RecommendedServerInfo } from '@jellyfin/sdk';
import { safeJsonParse } from './utils';

export type GeneralInfo = {
  user?: UserDto | null;
};

export const GENERAL_INFO_KEY = 'general_info';

export const createGeneralInfoStore = (initial: GeneralInfo | undefined) => {
  const [store, setStore] = makePersisted(
    createStore<GeneralInfo>(initial ?? { user: null }),
    {
      name: GENERAL_INFO_KEY,
    }
  );

  createEventListener(window, 'storage', (el) => {
    if (el.key === GENERAL_INFO_KEY)
      setStore(safeJsonParse(el.newValue, { user: null }));
  });

  return { store, setStore };
};

export type AuthStore = {
  accessToken: string | null;
  isUserLoggedIn: boolean;
};

export const AUTH_PRESIST_KEY = 'auth_store';
export const authStore = (initial?: AuthStore | undefined) => {
  const [store, setStore] = makePersisted(
    createStore<AuthStore>(
      initial ?? {
        isUserLoggedIn: false,
        accessToken: null,
      }
    ),
    {
      name: AUTH_PRESIST_KEY,
    }
  );

  createEventListener(window, 'storage', (el) => {
    if (el.key === AUTH_PRESIST_KEY)
      setStore(
        safeJsonParse(el.newValue, { isUserLoggedIn: false, accessToken: null })
      );
  });

  return { store, setStore };
};

export type Server = {
  info: RecommendedServerInfo;
  auth: { username: string; password: string };
};

export type ServerStore = {
  servers: Server[];
  current: Server | null;
};

export const SERVERS_KEY = 'servers_key';
export function serversStore(initial?: ServerStore | undefined) {
  const [store, setStore] = makePersisted(
    createStore<ServerStore>(
      initial ?? {
        current: null,
        servers: [],
      }
    ),
    {
      name: SERVERS_KEY,
    }
  );

  createEventListener(window, 'storage', (el) => {
    if (el.key === SERVERS_KEY)
      setStore(safeJsonParse(el.newValue, { current: null, servers: [] }));
  });

  return { store, setStore };
}
