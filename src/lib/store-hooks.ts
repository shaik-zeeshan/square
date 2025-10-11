import { createContextProvider } from '@solid-primitives/context';
import { serversStore } from './persist-store';

const [ServerStoreProvider, useServerStoreContext] = createContextProvider(
  () => {
    return serversStore();
  }
);

export function useServerStore() {
  return (
    useServerStoreContext() ??
    (() => {
      throw new Error(
        'useGeneralInfo must be used within an GeneralInfoProvider'
      );
    })()
  );
}

export { ServerStoreProvider };
