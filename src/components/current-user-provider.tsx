import { createContextProvider } from '@solid-primitives/context';
import { ComponentProps, createEffect } from 'solid-js';
import { SetStoreFunction } from 'solid-js/store';
import { user } from '~/lib/jellyfin/user';
import {
  authStore,
  createGeneralInfoStore,
  GeneralInfo,
  serversStore,
} from '~/lib/persist-store';
import { createJellyFinQuery, createQuery } from '~/lib/utils';

const [GeneralInfoProvider, useGeneralInfoContext] = createContextProvider(
  (props: {
    store: GeneralInfo | undefined;
    setStore: SetStoreFunction<GeneralInfo>;
  }) => {
    return { store: props.store, setStore: props.setStore };
  }
);

export function useGeneralInfo() {
  return (
    useGeneralInfoContext() ??
    (() => {
      throw new Error(
        'useGeneralInfo must be used within an GeneralInfoProvider'
      );
    })()
  );
}

const GeneralProvider = (props: Pick<ComponentProps<'div'>, 'children'>) => {
  let generalStore = createGeneralInfoStore(undefined);
  let { store: auth } = authStore();

  createJellyFinQuery(() => ({
    queryKey: ['userDetails', auth.isUserLoggedIn],
    queryFn: async (jf) => {
      let data = await user.query.details(jf);
      generalStore.setStore((prev) => ({
        ...prev,
        user: data,
      }));
      return data;
    },
  }));

  return (
    <GeneralInfoProvider
      store={generalStore.store}
      setStore={generalStore.setStore}
    >
      {props.children}
    </GeneralInfoProvider>
  );
};

export { GeneralProvider as GeneralInfoProvider };
