import type { Api } from "@jellyfin/sdk";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getAllWindows, getCurrentWindow } from "@tauri-apps/api/window";
import { Effect, pipe } from "effect";
import { createEffect, on, onCleanup } from "solid-js";
import { produce } from "solid-js/store";
import {
  DEFAULT_VIDEO_PLAYBACK,
  useVideoContext,
} from "~/contexts/video-context";
import { useRuntime } from "~/effect/runtime/use-runtime";
import { AuthService } from "~/effect/services/auth";
import { JellyfinOperations } from "~/effect/services/jellyfin/operations";
import { JellyfinService } from "~/effect/services/jellyfin/service";
import { createEffectQuery } from "~/effect/tanstack/query";
import { commands, events } from "~/lib/tauri";

export const createTauriListener = <K extends keyof typeof events>(
  event: K,
  handler: (
    payload: Parameters<Parameters<(typeof events)[K]["listen"]>[0]>[0]
  ) => void
) => {
  let unlisten: UnlistenFn | null = null;

  createEffect(async () => {
    unlisten = await events[event].listen(handler);
  });
  onCleanup(() => unlisten?.());
};

// for getting percentage of current time from duration
function getPercentage(current: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return (current / total) * 100;
}

const getJellyfinStreamUrl = (jf: Api, id: string) =>
  `${jf.basePath}/Videos/${id}/Stream?api_key=${jf.accessToken}&container=mp4&static=true`;

const convertPlaybackTicksToSeconds = (tick: number) => tick / 10_000_000;

export const useVideo = (id: string) => {
  const runtime = useRuntime();

  const [state, setState] = useVideoContext();

  const jf = runtime.runSync(
    Effect.gen(function* () {
      const auth = yield* AuthService;
      const api = yield* auth.getApi();

      return { api };
    })
  );

  const item = createEffectQuery(() => ({
    queryKey: JellyfinOperations.itemQueryKey({ id }),
    queryFn: () =>
      JellyfinService.pipe(
        Effect.flatMap((jf) =>
          jf.getItem(id, {
            enableImages: true,
            enableUserData: true,
          })
        ),
        Effect.tap(() => Effect.logInfo("fetched item, now start the video")),

        Effect.tap((data) =>
          Effect.promise(async () => {
            // here we will load the video
            await events.requestFileLoad.emit({
              url: getJellyfinStreamUrl(jf.api, data.Id as string),
              start_time: convertPlaybackTicksToSeconds(
                data.UserData?.PlaybackPositionTicks ?? 0
              ),
            });

            await events.requestPlayBackState.emit({ pause: false });
          })
        )
      ),
    refetchOnWindowFocus: false,
  }));

  const nextItem = createEffectQuery(() => ({
    queryKey: ["getNextEpisode", { id: item?.data?.Id }],
    queryFn: () =>
      pipe(
        Effect.fromNullable(item.data),
        Effect.flatMap((i) =>
          JellyfinService.pipe(Effect.flatMap((jf) => jf.getNextEpisode(i)))
        )
      ),

    // enabled: when the user reaches last 15% of video
    enabled: () => getPercentage(state.currentTime, state.duration) > 80,
  }));

  /*
   *
   *
   *
   *
   *  Tauri Listener
   *
   *
   *
   *
   */
  createTauriListener("fileLoadedChange", ({ payload }) => {
    setState(
      produce((state) => {
        state.duration = payload.duration;
        state.currentTime = payload.current_time;
      })
    );
    setState("duration", () => payload.duration);
    setState("currentTime", () => payload.current_time);
  });

  createTauriListener("playBackStateChange", ({ payload }) => {
    // change playback state
    setState("pause", () => payload.pause);
  });

  createTauriListener("playBackTimeChange", ({ payload }) => {
    // change playback state
    setState("currentTime", () => Number(payload.position) ?? 0);
    // TODO: need to report progress to jellyfin
  });

  createTauriListener("speedEventChange", ({ payload }) => {
    // change playback state
    setState("speed", () => Number(payload.speed) ?? 0);
  });

  createTauriListener("volumeEventChange", ({ payload }) => {
    // change playback state
    setState(
      produce((st) => {
        if (st.isMuted && payload.percentage === 0) {
          return;
        }

        if (st.isMuted) {
          st.isMuted = false;
        }

        st.volume = Number(payload.percentage) ?? 0;
      })
    );
  });

  createTauriListener("audioTrackChange", ({ payload }) => {
    setState("audioTracks", () => payload.tracks);
  });

  createTauriListener("subtitleTrackChange", ({ payload }) => {
    setState("subtitleTracks", () => payload.tracks);
  });

  createTauriListener("pauseForCacheChange", ({ payload: _ }) => {
    // for checking
  });

  createTauriListener("bufferingStateChange", ({ payload: _ }) => {
    // for bufferState
  });

  createTauriListener("cacheTimeChange", ({ payload }) => {
    // for checking
    setState("cachedTime", () => payload.time);
  });

  /*
   *
   *
   *
   *
   *  State Monitor
   *
   *
   *
   *
   */
  createEffect(
    on(
      () => state.pause,
      async (pause) => events.requestPlayBackState.emit({ pause }),
      { defer: true }
    )
  );

  createEffect(
    on(
      () => state.speed,
      async (speed) => await events.requestSpeedEvent.emit({ speed }),
      { defer: true }
    )
  );

  createEffect(
    on(
      () => state.isMuted,
      async (muted) => {
        if (muted) {
          await events.requestVolumeEvent.emit({ percentage: 0 });
        }
      },
      { defer: true }
    )
  );

  createEffect(
    on(
      () => state.volume,
      async (volume) => {
        await events.requestVolumeEvent.emit({ percentage: volume });
      },
      { defer: true }
    )
  );

  /*
   *
   *
   *
   *
   * PIP Window
   *
   *
   *
   */

  const showPipWindow = async () => {
    await commands.showPipWindow();

    setState("isPip", () => true);
  };

  const hidePipWindow = async () => {
    await commands.hidePipWindow();

    setState("isPip", () => false);
  };

  const isPipShowing = async () => {
    const windows = await getAllWindows();
    const pip_window = windows.find((win) => win.label === "pip");

    return Boolean(pip_window?.isVisible());
  };

  /*
   *
   *
   *
   * Cleanup
   *
   *
   *
   */

  onCleanup(async () => {
    // Clear State
    setState(() => DEFAULT_VIDEO_PLAYBACK());
    // clean up state
    await events.requestPlayBackState.emit({ pause: true });
    await events.requestClearEvent.emit();

    // fullscreen
    const window = getCurrentWindow();
    if (await window.isFullscreen()) {
      commands.toggleFullscreen();
    }

    // commands pip window
    await commands.hidePipWindow();
  });

  return {
    state,
    setState,
    item: () => item.data,
    nextItem: () => nextItem.data,
    showPipWindow,
    hidePipWindow,
    isPipShowing,
  };
};
