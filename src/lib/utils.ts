import {
  type QueryKey,
  type SolidQueryOptions,
  type UseQueryResult,
  useQuery,
} from "@tanstack/solid-query";
import { type ClassValue, clsx } from "clsx";
import type { Accessor } from "solid-js";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeAssign<
  T extends Record<string, unknown>,
  K extends keyof T,
>(obj: T, path: K, updates: Partial<NonNullable<T[K]>>): void {
  if (!obj[path]) {
    obj[path] = {} as NonNullable<T[K]>;
  }
  Object.assign(obj[path] as NonNullable<T[K]>, updates);
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

// export const match = <T, R>(value: T, patterns: Record<string, () => R>) =>
//   patterns[value as string] ?? undefined;

type Handler<R> = () => R;
type Matcher<T> = (value: T) => boolean;

export const match = <T extends string, R>(
  value: T,
  patterns:
    | (Record<T, Handler<R>> | Record<string, Handler<R>>)
    | Array<{
        match: Matcher<T>;
        handler: Handler<R>;
      }>
): Promise<R> | Promise<undefined> | R | undefined => {
  if (!Array.isArray(patterns)) {
    return patterns[value as string]?.();
  }

  return patterns.find((p) => p.match(value))?.handler();
};
