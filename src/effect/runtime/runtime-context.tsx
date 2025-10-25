import type { ManagedRuntime } from "effect";
import { createContext } from "solid-js";
import type { LiveManagedRuntime } from "../services/layer";

export type RuntimeContext =
  ManagedRuntime.ManagedRuntime.Context<LiveManagedRuntime>;
export const RuntimeContext = createContext<LiveManagedRuntime | null>(null);
