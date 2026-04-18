import { createContextProvider } from "@solid-primitives/context";
import { appPreferencesStore, serversStore } from "./persist-store";

const [ServerStoreProvider, useServerStoreContext] = createContextProvider(() =>
  serversStore()
);

export function useServerStore() {
  return (
    useServerStoreContext() ??
    (() => {
      throw new Error(
        "useGeneralInfo must be used within an GeneralInfoProvider"
      );
    })()
  );
}

const [AppPreferencesProvider, useAppPreferencesContext] =
  createContextProvider(() => appPreferencesStore());

export function useAppPreferences() {
  return (
    useAppPreferencesContext() ??
    (() => {
      throw new Error(
        "useAppPreferences must be used within an AppPreferencesProvider"
      );
    })()
  );
}

export { ServerStoreProvider, AppPreferencesProvider };
