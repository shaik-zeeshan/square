import type { Api } from "@jellyfin/sdk/lib/api";
import {
  type InitialDataFunction,
  type QueryFunctionContext,
  type QueryKey,
  type SolidMutationOptions,
  type SolidQueryOptions,
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
} from "@tanstack/solid-query";
import { type ClassValue, clsx } from "clsx";
import type { Accessor } from "solid-js";
import { twMerge } from "tailwind-merge";
import { useJellyfin } from "~/components/jellyfin-provider";
import { useServerStore } from "./store-hooks";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeJsonParse<T>(
  json: string | null | undefined,
  fallback: T
): T {
  if (!json) {
    return fallback;
  }
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
  >
): UseQueryResult<A, E> {
  return useQuery<A, E, A, QueryKeyType>(opts);
}

export function createJellyFinQuery<
  E extends Error,
  QueryKeyType extends QueryKey = QueryKey,
  A = unknown,
>(
  opts: Accessor<
    Omit<
      SolidQueryOptions<A, E, A, QueryKeyType> & {
        initialData?: A | InitialDataFunction<A>;
        onError?: (error: Error) => void;
      },
      "queryFn"
    > & {
      queryFn: (
        jellyfin: Api,
        context?: QueryFunctionContext<QueryKeyType>
      ) => A | Promise<A>;
    }
  >
): UseQueryResult<A, E> {
  const jf = useJellyfin();
  const { store } = useServerStore();

  return useQuery<A, E, A, QueryKeyType>(() => ({
    ...opts(),
    initialData: (opts().initialData ?? undefined) as A | (() => A),
    queryKey: [
      ...opts().queryKey,
      store.current?.currentUser,
    ] as unknown as QueryKeyType & {},
    enabled: !!jf.api?.accessToken && opts().enabled,
    queryFn: async (context) => {
      if (!jf.api) {
        throw new Error("Jellyfin API not found");
      }
      const data = await opts().queryFn(jf.api, context);
      return data;
    },
    deferStream: true,
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
          context?: QueryFunctionContext<QueryKeyType>
        ) => A | Promise<A>;
      }
    >
  >,
>(opts: Options): Options {
  return opts;
}

// export function createMutation<
//   A,
//   E extends Error,
//   MutationKeyType extends MutationKey = MutationKey,
// >(
//   opts: Accessor<
//     SolidMutationOptions<A, E, A, MutationKeyType> & {
//       initialData?: undefined;
//       onError?: (error: Error) => void;
//     }
//   >
// ): UseMutationResult<A, E, A, MutationKeyType> {
//   return useMutation<A, E, A, MutationKeyType>(opts);
// }

export function createJellyFinMutation<
  A,
  E extends Error,
  MutationContext = unknown,
  MutationVariables = void,
>(
  opts: Accessor<
    Omit<
      SolidMutationOptions<A, E, MutationVariables, MutationContext>,
      "mutationFn"
    > & {
      mutationFn: (
        jellyfin: Api,
        variables: MutationVariables
      ) => A | Promise<A>;
    }
  >
): UseMutationResult<A, E, MutationVariables, MutationContext> {
  const jf = useJellyfin();
  return useMutation<A, E, MutationVariables, MutationContext>(() => ({
    ...opts(),
    mutationFn: async (...args: [MutationVariables]) => {
      if (!jf.api) {
        throw new Error("Jellyfin API not found");
      }
      return await opts().mutationFn(jf.api, ...args);
    },
  }));
}
