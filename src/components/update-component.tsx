import { Effect } from "effect";
import { Match, Show, Switch } from "solid-js";
import { UpdateOperations } from "~/effect/services/update/operations";
import {
  UpdateSerivce,
  type UpdateState,
} from "~/effect/services/update/serives";
import { createEffectMutation } from "~/effect/tanstack/query";
import { createProcessRef } from "~/hooks/create-process-ref";
import Update from "~icons/lucide/refresh-cw";

export const CheckForUpdate = () => {
  const { state, runEffectWithSync } = createProcessRef<UpdateState>({
    stage: "idle",
    percentage: 0,
  });

  const updateExists = UpdateOperations.checkForUpdate();

  const update = createEffectMutation(() => ({
    mutationFn: () =>
      Effect.sync(() =>
        runEffectWithSync((ref) =>
          UpdateSerivce.pipe(Effect.flatMap((up) => up.update(ref)))
        )
      ),
  }));

  const relaunch = createEffectMutation(() => ({
    mutationFn: () => UpdateSerivce.pipe(Effect.flatMap((up) => up.restart())),
  }));

  return (
    <Show when={updateExists}>
      <Switch>
        <Match when={state().stage === "idle"}>
          <button
            class="fixed right-10 bottom-5 z-50 flex cursor-pointer items-center gap-4 p-2 hover:text-muted-foreground"
            on:click={() => update.mutate()}
          >
            <div>Update Available</div>
            <Update />
          </button>
        </Match>
        <Match when={state().stage === "started"}>
          <div class="fixed right-10 bottom-5 z-50 flex cursor-pointer items-center gap-4 p-2 hover:text-muted-foreground">
            <div>Starting</div>
            <Update class="animate-spin" />
          </div>
        </Match>
        <Match when={state().stage === "downloading"}>
          <div class="fixed right-10 bottom-5 z-50 flex cursor-pointer items-center gap-4 p-2 hover:text-muted-foreground">
            <div>Downloading {state().percentage.toFixed(2)}%</div>
            <Update class="animate-spin" />
          </div>
        </Match>
        <Match when={state().stage === "finished"}>
          <button
            class="fixed right-10 bottom-5 z-50 flex cursor-pointer items-center gap-4 p-2 hover:text-muted-foreground"
            on:click={() => relaunch.mutate()}
          >
            <div>Restart</div>
            <Update />
          </button>
        </Match>
      </Switch>
    </Show>
  );
};
