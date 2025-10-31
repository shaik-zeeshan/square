import { Effect, Fiber, SubscriptionRef as Ref, Stream } from "effect";
import type { SubscriptionRef } from "effect/SubscriptionRef";
import { createEffect, createSignal, onCleanup } from "solid-js";

export const useEffectSubscriptionRef = <T>(
  subscriptionRefEffect: Effect.Effect<SubscriptionRef<T>>
): (() => T | undefined) => {
  const [value, setValue] = createSignal<T | undefined>(undefined);

  createEffect(() => {
    const fiber = Effect.runFork(
      Effect.gen(function* () {
        const ref = yield* subscriptionRefEffect;
        yield* Stream.runForEach(ref.changes, (v) =>
          Effect.sync(() => {
            setValue(() => v);
          })
        );
      }).pipe(Stream.runDrain)
    );

    onCleanup(() => {
      Effect.runFork(Fiber.interrupt(fiber));
    });
  });

  return value;
};

export const useSubscriptionRef = <T>(
  subscriptionRef: Effect.Effect<SubscriptionRef<T>>
): (() => T | undefined) => {
  const [value, setValue] = createSignal<T | undefined>(undefined);

  createEffect(() => {
    const fiber = Effect.runFork(
      Effect.gen(function* () {
        const ref = yield* subscriptionRef;
        // Get initial value
        const initial = yield* Ref.get(ref);
        setValue(() => initial);

        // Subscribe to changes
        yield* Stream.runForEach(ref.changes, (newValue) =>
          Effect.sync(() => setValue(() => newValue))
        );
      })
    );

    onCleanup(() => {
      Effect.runFork(Fiber.interrupt(fiber));
    });
  });

  return value;
};
