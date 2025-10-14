import { createContextProvider } from '@solid-primitives/context';
import { ComponentProps } from 'solid-js';
import { SetStoreFunction } from 'solid-js/store';
import { user } from '~/lib/jellyfin/user';
import {
  authStore,
  AuthStore,
} from '~/lib/persist-store';
import { createJellyFinQuery } from '~/lib/utils';

const [GeneralInfoProvider, useGeneralInfoContext] = createContextProvider(
  (props: {
    store: AuthStore | undefined;
    setStore: SetStoreFunction<AuthStore>;
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
  let { store: auth, setStore: setAuth } = authStore();

  createJellyFinQuery(() => ({
    queryKey: ['userDetails', auth.isUserLoggedIn],
    queryFn: async (jf) => {
      let data = await user.query.details(jf);
      setAuth((prev) => ({
        ...prev,
        user: data,
      }));
      return data;
    },
  }));

  return (
    <GeneralInfoProvider
      store={auth}
      setStore={setAuth}
    >
      {props.children}
    </GeneralInfoProvider>
  );
};

export { GeneralProvider as GeneralInfoProvider };
