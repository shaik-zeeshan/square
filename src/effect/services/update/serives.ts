import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { Effect, SubscriptionRef } from "effect";
import { NoUpdateFound } from "~/effect/error";
import { match } from "~/lib/utils";

export type UpdateState = {
  stage: "idle" | "started" | "downloading" | "installing" | "finished";
  percentage: number;
};

// for getting percentage of current time from duration
function getPercentage(current: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return (current / total) * 100;
}

export class UpdateSerivce extends Effect.Service<UpdateSerivce>()(
  "UpdateSerivce",
  {
    effect: Effect.gen(function* () {
      const checkForUpdate = () =>
        Effect.tryPromise({
          try: () => check(),
          catch: () => new NoUpdateFound(),
        });

      const update = (stateRef: SubscriptionRef.SubscriptionRef<UpdateState>) =>
        Effect.gen(function* () {
          const update = yield* checkForUpdate();
          const contentLength = yield* SubscriptionRef.make<number>(0);
          const downloaded = yield* SubscriptionRef.make<number>(0);
          if (!update) {
            return yield* Effect.fail(new NoUpdateFound());
          }

          yield* Effect.promise(async () => {
            await update.downloadAndInstall((event) =>
              match(event.event, {
                Started: () => {
                  Effect.runSync(
                    Effect.gen(function* () {
                      yield* SubscriptionRef.set(stateRef, {
                        stage: "started" as const,
                        percentage: 0,
                      });

                      yield* SubscriptionRef.set(
                        contentLength,
                        (event as Extract<DownloadEvent, { event: "Started" }>)
                          .data.contentLength ?? 0
                      );
                    })
                  );
                },
                Progress: () =>
                  Effect.runSync(
                    Effect.gen(function* () {
                      const data = event as Extract<
                        DownloadEvent,
                        { event: "Progress" }
                      >;

                      const totalLength =
                        yield* SubscriptionRef.get(contentLength);

                      const currentLength = yield* SubscriptionRef.updateAndGet(
                        downloaded,
                        (len) => len + data.data.chunkLength
                      );

                      yield* SubscriptionRef.set(stateRef, {
                        stage: "downloading" as const,
                        percentage: getPercentage(currentLength, totalLength),
                      });
                    })
                  ),
                Finished: () =>
                  Effect.runSync(
                    SubscriptionRef.set(stateRef, {
                      stage: "finished" as const,
                      percentage: 0,
                    })
                  ),
              })
            );
          });
        });

      const restart = () => Effect.promise(() => relaunch());

      return {
        checkForUpdate,
        update,
        restart,
      };
    }),
  }
) {}

export const UpdateSerivceLayer = UpdateSerivce.Default;
