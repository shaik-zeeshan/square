import { useContext } from "solid-js";
import type { LiveManagedRuntime } from "../services/layer";
import { RuntimeContext } from "./runtime-context";

export const useRuntime = (): LiveManagedRuntime => {
  const runtime = useContext(RuntimeContext);
  if (!runtime) {
    throw new Error("useRuntime must be used within a RuntimeProvider");
  }
  return runtime;
};
