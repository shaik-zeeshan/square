import {
  type ComponentProps,
  createEffect,
  createSignal,
  type JSXElement,
  on,
  Show,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { useVideoContext } from "~/contexts/video-context";
import Pause from "~icons/lucide/pause";
import Play from "~icons/lucide/play";

export type OSD = {
  property: string | null;
  message: string | null;
  icon: ((props: ComponentProps<"svg">) => JSXElement) | null;
};

const DEFAULT_OSD: () => OSD = () => ({
  property: null,
  message: null,
  icon: null,
});

export const ShowOSD = () => {
  const [state] = useVideoContext();

  const [currentOSD, setOSD] = createStore<OSD>(DEFAULT_OSD());
  const [show, setShow] = createSignal(false);

  let hideTimeout: NodeJS.Timeout | null;
  createEffect(
    on(
      show,
      (value) => {
        if (!value) {
          return;
        }

        hideTimeout = setTimeout(() => {
          setShow(false);
        }, 1000);
      },
      {
        defer: true,
      }
    )
  );

  createEffect(
    on(
      () => state.pause,
      (pause) => {
        setOSD(
          produce((state) => {
            state.message = pause ? "Video Paused" : "Video Playing";
            state.property = "pause";
            state.icon = pause ? Pause : Play;
          })
        );

        setShow(true);
      },
      {
        defer: true,
      }
    )
  );

  return (
    <Show when={show()}>
      <div class="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 rounded bg-black/60 p-10 text-white/80">
        <div class="flex flex-col items-center justify-center gap-y-4">
          <Show when={currentOSD.icon}>
            {currentOSD.icon?.({
              class: "w-5 h-5",
            })}
          </Show>
          {currentOSD.message || "hello"}
        </div>
      </div>
    </Show>
  );
};
