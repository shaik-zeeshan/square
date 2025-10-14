import { createContextProvider } from "@solid-primitives/context";
import type { ComponentProps } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import { user } from "~/lib/jellyfin/user";
import { type AuthStore, authStore } from "~/lib/persist-store";
import { createJellyFinQuery } from "~/lib/utils";

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
        "useGeneralInfo must be used within an GeneralInfoProvider"
      );
    })()
  );
}

const GeneralProvider = (props: Pick<ComponentProps<"div">, "children">) => {
  const { store: auth, setStore: setAuth } = authStore();

  createJellyFinQuery(() => ({
    queryKey: ["userDetails", auth.isUserLoggedIn],
    queryFn: async (jf) => {
      const data = await user.query.details(jf);
      setAuth((prev) => ({
        ...prev,
        user: data,
      }));
      return data;
    },
  }));

  return (
    <GeneralInfoProvider setStore={setAuth} store={auth}>
      {props.children}
    </GeneralInfoProvider>
  );
};

export { GeneralProvider as GeneralInfoProvider };
