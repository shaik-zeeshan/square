import type { Api } from '@jellyfin/sdk/lib/api';
import { useQueryClient } from '@tanstack/solid-query';
import {
  type ComponentProps,
  createContext,
  createEffect,
  onCleanup,
  onMount,
  useContext,
} from 'solid-js';
import { createStore } from 'solid-js/store';
import { createJellyfinClient } from '~/lib/jellyfin';
import { strongholdService } from '~/lib/jellyfin/stronghold';
import { AUTH_PRESIST_KEY } from '~/lib/persist-store';
import { useServerStore } from '~/lib/store-hooks';

type JellyFinContext = {
  api?: Api;
};

const JellyfinContext = createContext<JellyFinContext>({});

export function useJellyfin() {
  return (
    useContext(JellyfinContext) ??
    (() => {
      throw new Error('useJellyFin must be used within an JellyFinProvider');
    })()
  );
}

export const JellyFinProvider = (
  props: Pick<ComponentProps<'div'>, 'children'>
) => {
  const [jf, setJf] = createStore<JellyFinContext>({});
  const controller = new AbortController();
  const { store } = useServerStore();
  const queryclient = useQueryClient();

  // Pre-initialize Stronghold on app startup for better performance
  onMount(() => {
    strongholdService.preInitialize().catch((_error) => {});
  });

  createEffect(() => {
    if (!store.current?.info) {
      return;
    }

    const jf = createJellyfinClient(store.current?.info);
    if (!jf) {
      return;
    }

    setJf({ api: jf });
    queryclient.invalidateQueries();
  });

  createEffect(() => {
    if (!jf.api?.accessToken) {
      // Clear user data from auth store when access token is removed
      const authStore = localStorage.getItem(AUTH_PRESIST_KEY);
      if (authStore) {
        const authData = JSON.parse(authStore);
        if (authData.user) {
          const updatedAuth = { ...authData, user: null };
          localStorage.setItem(AUTH_PRESIST_KEY, JSON.stringify(updatedAuth));
        }
      }
    }
  });

  createEffect(() => {
    window.addEventListener(
      'storage',
      async (e) => {
        if (e.key === AUTH_PRESIST_KEY) {
          if (!store.current?.info) {
            return;
          }

          const newJf = createJellyfinClient(store.current?.info);
          if (!newJf) {
            return;
          }

          setJf({ api: newJf });
        }
      },
      {
        signal: controller.signal,
      }
    );
  });

  onCleanup(() => {
    controller.abort();
  });

  return (
    <JellyfinContext.Provider value={jf}>
      {props.children}
    </JellyfinContext.Provider>
  );
};
