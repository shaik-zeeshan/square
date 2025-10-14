import { Api } from "@jellyfin/sdk/lib/api";
import {
  QueryKey,
  useQuery,
  UseQueryResult,
  SolidQueryOptions,
  QueryFunctionContext,
} from "@tanstack/solid-query";
import { Accessor } from "solid-js";
import { useJellyfin } from "~/components/jellyfin-provider";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useServerStore } from "./store-hooks";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeJsonParse<T>(
  json: string | null | undefined,
  fallback: T,
): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export function createQuery<
  A,
  E extends Error,
  QueryKeyType extends QueryKey = QueryKey,
>(
  opts: Accessor<
    SolidQueryOptions<A, E, A, QueryKeyType> & {
      initialData?: undefined;
      onError?: (error: Error) => void;
    }
  >,
): UseQueryResult<A, E> {
  return useQuery<A, E, A, QueryKeyType>(opts);
}

export function createJellyFinQuery<
  A,
  E extends Error,
  QueryKeyType extends QueryKey = QueryKey,
>(
  opts: Accessor<
    Omit<
      SolidQueryOptions<A, E, A, QueryKeyType> & {
        initialData?: undefined;
        onError?: (error: Error) => void;
      },
      "queryFn"
    > & {
      queryFn: (
        jellyfin: Api,
        context?: QueryFunctionContext<QueryKeyType>,
      ) => A | Promise<A>;
    }
  >,
): UseQueryResult<A, E> {
  const jf = useJellyfin();
  let { store } = useServerStore();

  return useQuery<A, E, A, QueryKeyType>(() => ({
    ...opts(),
    queryKey: [
      ...opts().queryKey,
      store.current?.info.systemInfo?.ServerName,
    ] as unknown as QueryKeyType & {},
    enabled: !!jf.api?.accessToken && opts().enabled,
    queryFn: async (context) => {
      if (!jf.api) {
        throw new Error("Jellyfin API not found");
      }
      let data = await opts().queryFn(jf.api, context);
      return data;
    },
    deferStream:true,
  }));
}

export function queryJellfinOptions<
  A,
  E extends Error,
  QueryKeyType extends QueryKey = QueryKey,
  Options = ReturnType<
    Accessor<
      Omit<
        SolidQueryOptions<A, E, A, QueryKeyType> & {
          initialData?: undefined;
          onError?: (error: Error) => void;
        },
        "queryFn"
      > & {
        queryFn: (
          jellyfin: Api,
          context?: QueryFunctionContext<QueryKeyType>,
        ) => A | Promise<A>;
      }
    >
  >,
>(opts: Options): Options {
  return opts;
}
