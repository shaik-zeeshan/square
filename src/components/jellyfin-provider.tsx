import { Api } from '@jellyfin/sdk/lib/api';
import { useQueryClient } from '@tanstack/solid-query';
import {
  ComponentProps,
  createContext,
  createEffect,
  on,
  onCleanup,
  useContext,
} from 'solid-js';
import { createStore } from 'solid-js/store';
import { createJellyfinClient } from '~/lib/jellyfin';
import { AUTH_PRESIST_KEY, GENERAL_INFO_KEY } from '~/lib/persist-store';
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
  let [jf, setJf] = createStore<JellyFinContext>({});
  let controller = new AbortController();
  let { store } = useServerStore();
  let queryclient = useQueryClient();

  createEffect(() => {
    if (!store.current?.info) return;

    let jf = createJellyfinClient(store.current?.info);
    if (!jf) return;

    setJf({ api: jf });
    queryclient.invalidateQueries();
  });

  createEffect(() => {
    if (!jf.api?.accessToken) {
      localStorage.removeItem(GENERAL_INFO_KEY);
    }
  });

  createEffect(() => {
    window.addEventListener(
      'storage',
      async (e) => {
        if (e.key === AUTH_PRESIST_KEY) {
          if (!store.current?.info) return;

          let newJf = createJellyfinClient(store.current?.info);
          if (!newJf) return;

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
