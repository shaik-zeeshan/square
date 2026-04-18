import type { UserDto } from "@jellyfin/sdk/lib/generated-client/models";
import { createEventListener } from "@solid-primitives/event-listener";
import { makePersisted } from "@solid-primitives/storage";
import { createStore } from "solid-js/store";
import type { ExternalPlayerId } from "~/components/video/external-players";
import type { ServerConnection } from "~/types";
import { safeJsonParse } from "./utils";

export type AuthStore = {
  accessToken: string | null;
  isUserLoggedIn: boolean;
  user?: UserDto | null;
};

export const AUTH_PRESIST_KEY = "auth_store";
export const authStore = (initial?: AuthStore | undefined) => {
  const [store, setStore] = makePersisted(
    createStore<AuthStore>(
      initial ?? {
        isUserLoggedIn: false,
        accessToken: null,
        user: null,
      }
    ),
    {
      name: AUTH_PRESIST_KEY,
    }
  );

  createEventListener(window, "storage", (el) => {
    if (el.key === AUTH_PRESIST_KEY) {
      setStore(
        safeJsonParse(el.newValue, {
          isUserLoggedIn: false,
          accessToken: null,
          user: null,
        })
      );
    }
  });

  return { store, setStore };
};

export type Server = ServerConnection;

export type ServerStore = {
  servers: Server[];
  current: Server | null;
};

export const SERVERS_KEY = "servers_key";
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

  createEventListener(window, "storage", (el) => {
    if (el.key === SERVERS_KEY) {
      setStore(safeJsonParse(el.newValue, { current: null, servers: [] }));
    }
  });

  return { store, setStore };
}

export type SeriesLanguageOverride = {
  audioLanguage?: string;
  subtitleLanguage?: string;
};

export type AppPreferencesStore = {
  externalPlayer: ExternalPlayerId;
  defaultAudioLanguage: string;
  defaultSubtitleLanguage: string;
  seriesLanguageOverrides: Record<string, SeriesLanguageOverride>;
};

export const APP_PREFERENCES_KEY = "app_preferences";

const APP_PREFERENCES_DEFAULTS: AppPreferencesStore = {
  externalPlayer: "iina",
  defaultAudioLanguage: "en",
  defaultSubtitleLanguage: "en",
  seriesLanguageOverrides: {},
};

function mergeAppPreferences(
  persisted: Partial<AppPreferencesStore> | undefined | null
): AppPreferencesStore {
  return {
    ...APP_PREFERENCES_DEFAULTS,
    ...persisted,
    seriesLanguageOverrides:
      persisted?.seriesLanguageOverrides ??
      APP_PREFERENCES_DEFAULTS.seriesLanguageOverrides,
  };
}

export function appPreferencesStore(initial?: AppPreferencesStore | undefined) {
  const [store, setStore] = makePersisted(
    createStore<AppPreferencesStore>(initial ?? APP_PREFERENCES_DEFAULTS),
    {
      name: APP_PREFERENCES_KEY,
      deserialize: (raw: string) =>
        mergeAppPreferences(
          safeJsonParse<Partial<AppPreferencesStore>>(
            raw,
            APP_PREFERENCES_DEFAULTS
          )
        ),
    }
  );

  createEventListener(window, "storage", (el) => {
    if (el.key === APP_PREFERENCES_KEY) {
      setStore(mergeAppPreferences(safeJsonParse(el.newValue, null)));
    }
  });

  return { store, setStore };
}
