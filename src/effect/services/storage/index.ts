import { Effect, pipe } from "effect";
import type { NoFieldFound } from "~/effect/error";

export interface Storage<T> {
  get: <K extends keyof T>(key: K) => Effect.Effect<T[K] | null, NoFieldFound>;
  set: <K extends keyof T>(
    key: K,
    value: T[K]
  ) => Effect.Effect<void, NoFieldFound>;
  remove: (key: keyof T) => Effect.Effect<void, NoFieldFound>;
  exists: (key: keyof T) => Effect.Effect<boolean, NoFieldFound>;
  getOrElse: <K extends keyof T>(
    key: K,
    defaultValue: T[K]
  ) => Effect.Effect<T[K], NoFieldFound>;
}

export const createStorage = <T>(prefix = ""): Storage<T> => ({
  get: <K extends keyof T>(key: K) =>
    Effect.sync(() => {
      const stored = localStorage.getItem(`${prefix}${String(key)}`);
      return stored ? JSON.parse(stored) : null;
    }),

  set: <K extends keyof T>(key: K, value: T[K]) =>
    Effect.sync(() => {
      localStorage.setItem(`${prefix}${String(key)}`, JSON.stringify(value));
    }),

  remove: (key: keyof T) =>
    Effect.sync(() => {
      localStorage.removeItem(`${prefix}${String(key)}`);
    }),

  exists: (key: keyof T) =>
    Effect.sync(() => localStorage.getItem(`${prefix}${String(key)}`) !== null),

  getOrElse: <K extends keyof T>(key: K, defaultValue: T[K]) =>
    pipe(
      Effect.sync(() => localStorage.getItem(`${prefix}${String(key)}`)),
      Effect.map((stored) =>
        stored ? (JSON.parse(stored) as T[K]) : defaultValue
      )
    ),
});
