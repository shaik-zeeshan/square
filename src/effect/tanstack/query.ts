import {
  type InitialDataFunction,
  type MutationFunction,
  QueryClient,
  type QueryFunction,
  type QueryFunctionContext,
  type SolidMutationOptions,
  type SolidQueryOptions,
  type skipToken,
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
} from "@tanstack/solid-query";
import { Effect } from "effect";
import { create, type Draft } from "mutative";
import type { Accessor } from "solid-js";
import { useRuntime } from "~/effect/runtime/use-runtime";
import type { RuntimeContext } from "../runtime/runtime-context";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

/*
 *
 *
 *
 *
 * Query Helpers
 *
 *
 *
 *
 */

/**
 * @internal
 */
const createRunner = () => {
  const runtime = useRuntime();
  return <A, E, R extends RuntimeContext>(span: string) =>
    (effect: Effect.Effect<A, E, R>): Promise<A> =>
      effect.pipe(
        Effect.withSpan(span),
        Effect.tapErrorCause(Effect.logError),
        runtime.runPromise
      );
};

export type ExtractQueryData<T> = T extends UseQueryResult<infer D, unknown>
  ? D
  : never;

type QueryKey = readonly [string, Record<string, unknown>?];
type DeepMutable<T> = {
  -readonly [P in keyof T]: T[P] extends object ? DeepMutable<T[P]> : T[P];
};

type DeepRemoveUndefined<T> = T extends Record<string, unknown>
  ? {
      [K in keyof T]: T[K] extends undefined
        ? never
        : T[K] extends Record<string, unknown>
          ? DeepRemoveUndefined<T[K]>
          : T[K] extends (infer U)[]
            ? DeepRemoveUndefined<U>[]
            : Exclude<T[K], undefined>;
    }
  : Exclude<T, undefined>;

// Remove keys that have never type
type OmitNever<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K];
};

export type DeepClean<T> = OmitNever<DeepRemoveUndefined<T>>;

export type QueryDataUpdater<TData> = (
  draft: Draft<DeepMutable<TData>>
) => void;

type QueryKeyType<
  TKey extends string,
  TVariables = void,
> = TVariables extends void ? readonly [TKey] : readonly [TKey, TVariables];

/**
 * Creates a type-safe query key factory that can be used with or without variables
 * @template TKey The string literal type for the query key
 * @template TVariables Optional variables type. If not provided, the factory will not accept variables
 * @param key The query key string
 * @returns A function that creates a query key tuple
 *
 * @example Without variables:
 * ```typescript
 * const userKey = createQueryKey("user");
 * const key = userKey(); // returns ["user"]
 * ```
 *
 * @example With variables:
 * ```typescript
 * type UserVars = { id: string };
 * const userKey = createQueryKey<"user", UserVars>("user");
 * const key = userKey({ id: "123" }); // returns ["user", { id: "123" }]
 * ```
 */
export function createQueryKey<TKey extends string, TVariables = void>(
  key: TKey
) {
  return ((variables?: TVariables) =>
    variables === undefined
      ? ([key] as const)
      : ([key, variables] as const)) as TVariables extends void
    ? () => QueryKeyType<TKey>
    : (variables: TVariables) => QueryKeyType<TKey, TVariables>;
}

type QueryDataHelpers<TData, TVariables> = {
  cancelQuery: (variables: TVariables) => void;
  removeQuery: (variables: TVariables) => void;
  removeAllQueries: (variables?: TVariables) => void;
  getData: (variables: TVariables) => TData | undefined;
  setData: (
    variables: TVariables,
    updater: QueryDataUpdater<TData> | TData
  ) => TData | undefined;
  invalidateQuery: (variables: TVariables) => Promise<void>;
  invalidateAllQueries: (variables?: TVariables) => Promise<void>;
  refetchQuery: (variables: TVariables) => Promise<void>;
  refetchAllQueries: () => Promise<void>;
};
/**
 * Creates a set of helpers to manage query data in the cache
 * @template TData The type of data stored in the query
 * @template TVariables Automatically inferred from the queryKey function parameter
 * @param queryKey A function that creates a query key tuple from variables
 * @returns An object with methods to remove, update, invalidate, and invalidate all query data
 *
 * @example Without variables:
 * ```typescript
 * const userKey = createQueryKey("user");
 * type User = { name: string };
 *
 * // Types are inferred from userKey
 * const helpers = createQueryDataHelpers<User>(userKey);
 * helpers.setData(undefined, (draft) => {
 *   draft.name = "New Name";
 * });
 * ```
 *
 * @example With variables and explicit types:
 * ```typescript
 * type UserVars = { id: string };
 * type User = { id: string; name: string };
 *
 * const userKey = createQueryKey<"user", UserVars>("user");
 * const helpers = createQueryDataHelpers<User, UserVars>(userKey);
 *
 * helpers.setData({ id: "123" }, (draft) => {
 *   draft.name = "New Name";
 * });
 *
 * // Other helper methods
 * await helpers.invalidateQuery({ id: "123" });
 * await helpers.refetchQuery({ id: "123" });
 * helpers.removeQuery({ id: "123" });
 * ```
 */
export function createQueryDataHelpers<TData, TVariables = void>(
  queryKey: (variables: TVariables) => readonly [string, ...unknown[]]
): QueryDataHelpers<TData, TVariables> {
  const [namespaceKey] = queryKey(undefined as TVariables);

  return {
    cancelQuery: (variables: TVariables) => {
      queryClient.cancelQueries({ queryKey: queryKey(variables) });
    },
    removeQuery: (variables: TVariables) => {
      queryClient.removeQueries({ queryKey: queryKey(variables) });
    },
    removeAllQueries: (variables) => {
      const queryKey: QueryKey = [namespaceKey];
      if (variables) {
        queryKey.concat(variables);
      }
      queryClient.removeQueries({ queryKey, exact: false });
    },
    getData: (variables: TVariables) =>
      queryClient.getQueryData(queryKey(variables)),
    setData: (
      variables: TVariables,
      updater: QueryDataUpdater<TData> | TData
    ) =>
      queryClient.setQueryData<TData>(queryKey(variables), (oldData) => {
        if (oldData === undefined) {
          return oldData;
        }
        if (typeof updater !== "function") {
          return updater;
        }
        return create(oldData as TData, (data) => {
          (updater as QueryDataUpdater<TData>)(data);
        });
      }),
    invalidateQuery: (variables: TVariables) =>
      queryClient.invalidateQueries({ queryKey: queryKey(variables) }),
    invalidateAllQueries: (variables) => {
      const queryKey: QueryKey = [namespaceKey];
      if (variables) {
        queryKey.concat(variables);
      }
      return queryClient.invalidateQueries({ queryKey, exact: false });
    },
    refetchQuery: (variables: TVariables) =>
      queryClient.refetchQueries({ queryKey: queryKey(variables) }),
    refetchAllQueries: () =>
      queryClient.refetchQueries({ queryKey: [namespaceKey], exact: false }),
  };
}

/*
 *
 *
 *
 *
 * Effect Query Hooks
 *
 *
 *
 *
 */

type EffectQueryFn<
  A,
  E,
  R extends RuntimeContext,
  QueryKeyType extends QueryKey = QueryKey,
> = (context?: QueryFunctionContext<QueryKeyType>) => Effect.Effect<A, E, R>;

export function createEffectQuery<
  A,
  E,
  R extends RuntimeContext,
  QueryKeyType extends QueryKey = QueryKey,
>(
  opts: Accessor<
    Omit<
      SolidQueryOptions<A, E, A, QueryKeyType> & {
        initialData?: A | InitialDataFunction<A>;
        onError?: (error: Error) => void;
      },
      "queryFn"
    > & {
      queryFn: EffectQueryFn<A, E, R, QueryKeyType> | typeof skipToken;
    }
  >
): UseQueryResult<A, E> {
  const effectRunner = createRunner();
  // const runtime = useRuntime();
  const [spanName] = opts().queryKey;

  const queryFn: QueryFunction<A, QueryKeyType> = (context) => {
    const effect = (opts().queryFn as EffectQueryFn<A, E, R, QueryKeyType>)(
      context
    );
    return effect.pipe(effectRunner(spanName as string));
  };

  return useQuery<A, E, A, QueryKeyType>(() => ({
    // enabled: () =>
    //   runtime.runSync(
    //     AuthService.pipe(
    //       Effect.flatMap((auth) => auth.getUser()),
    //       Effect.isSuccess
    //     )
    //   ),
    ...opts(),
    initialData: (opts().initialData ?? undefined) as A | (() => A),
    queryFn,
  }));
}

/*
 *
 *
 *
 *
 * Effect Mutation Hooks
 *
 *
 *
 *
 */

export function createEffectMutation<
  A,
  E,
  R extends RuntimeContext,
  MutationContext = unknown,
  MutationVariables = void,
>(
  opts: Accessor<
    Omit<
      SolidMutationOptions<A, E, MutationVariables, MutationContext>,
      "mutationFn"
    > & {
      mutationFn: (variables: MutationVariables) => Effect.Effect<A, E, R>;
    }
  >
): UseMutationResult<A, E, MutationVariables, MutationContext> {
  const effectRunner = createRunner();
  const spanName = opts().mutationKey?.[0] || "effectMutation";

  const mutationFn: MutationFunction<A, MutationVariables> = (context) => {
    const effect = opts().mutationFn(context);
    return effect.pipe(effectRunner(spanName as string));
  };

  return useMutation<A, E, MutationVariables, MutationContext>(() => ({
    ...opts(),
    mutationFn,
  }));
}
