import { Effect, Fiber, Stream, SubscriptionRef } from "effect";
import {
  createEffect,
  createSignal,
  getOwner,
  onCleanup,
  runWithOwner,
} from "solid-js";
import type { RuntimeContext } from "~/effect/runtime/runtime-context";
import { useRuntime } from "~/effect/runtime/use-runtime";

export const createProcessRef = <T>(initialValue: T) => {
  const runtime = useRuntime();
  const [state, setState] = createSignal<T>(initialValue);
  const owner = getOwner();

  return {
    state,
    setState: (value: T) => setState(() => value),
    runEffectWithSync: <A, E, R extends RuntimeContext>(
      program: (
        ref: SubscriptionRef.SubscriptionRef<T>
      ) => Effect.Effect<A, E, R>
    ) => {
      runWithOwner(owner, () => {
        createEffect(() => {
          const effect = Effect.gen(function* () {
            const ref = yield* SubscriptionRef.make<T>(initialValue);

            yield* Effect.fork(
              ref.changes.pipe(
                Stream.tap((newStage) =>
                  Effect.sync(() => setState(() => newStage))
                ),
                Stream.runDrain
              )
            );

            return yield* program(ref);
          });

          const fiber = runtime.runFork(effect);
          onCleanup(() => Fiber.interrupt(fiber));
        });
      });
    },
  };
};
