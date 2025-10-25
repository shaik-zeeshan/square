import { createEffect, type JSX, onCleanup } from "solid-js";
import type { LiveManagedRuntime } from "../services/layer";
import { RuntimeContext } from "./runtime-context";

export const RuntimeProvider = (props: {
  children: JSX.Element;
  runtime: LiveManagedRuntime;
}) => {
  let mountRef = false;

  createEffect(() => {
    if (!mountRef) {
      mountRef = true;
      return;
    }

    onCleanup(() => {
      props.runtime.dispose();
    });
  });

  return (
    <RuntimeContext.Provider value={props.runtime}>
      {props.children}
    </RuntimeContext.Provider>
  );
};
