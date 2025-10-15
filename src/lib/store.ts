import { useQuery } from "@tanstack/solid-query";
import { Store } from "@tauri-apps/plugin-store";
import { onCleanup } from "solid-js";

import type { GeneralSettings } from "~/lib/tauri";

let _store: Promise<Store> | undefined;
const store = () => {
  if (!_store) {
    _store = Store.load("store");
  }

  return _store;
};

function declareStore<T extends object>(name: string) {
  const getAll = () => store().then((s) => s.get<T>(name));
  const listen = (fn: (data?: T | undefined) => void) =>
    store().then((s) => s.onKeyChange<T>(name, fn));

  return {
    get: async (key: keyof T) => {
      const values = (await getAll()) || {};
      return (values as T)[key];
    },
    getAll,
    listen,
    set: async <Key extends keyof T>(key: Key, value: T[Key]) => {
      const s = await store();
      if (value === undefined) {
        const current = (await s.get<T>(name)) || {};
        const { [key]: _, ...rest } = current;
        if (Object.keys(rest).length === 0) {
          s.delete(name);
        } else {
          await s.set(name, rest);
        }
      } else {
        const current = (await s.get<T>(name)) || {};
        await s.set(name, {
          ...current,
          [key]: value,
        });
      }
      await s.save();
    },
    setAll: async (value?: Partial<T>) => {
      const s = await store();
      if (value === undefined) {
        s.delete(name);
      } else {
        const current = (await s.get<T>(name)) || {};
        await s.set(name, {
          ...current,
          ...value,
        });
      }
      await s.save();
    },
    createQuery: () => {
      const query = useQuery(() => ({
        queryKey: ["store", name],
        queryFn: async () => (await getAll()) ?? null,
      }));

      const cleanup = listen(() => {
        query.refetch();
      });
      onCleanup(() => cleanup.then((c) => c()));

      return query;
    },
  };
}

export const secureSettings = declareStore<GeneralSettings>("generalSettings");
