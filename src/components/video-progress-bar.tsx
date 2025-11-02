import { createEventListener } from "@solid-primitives/event-listener";
import { useParams } from "@solidjs/router";
import {
  animate,
  createDraggable,
  createScope,
  type Draggable,
  type Scope,
} from "animejs";
import { Duration } from "effect";
import { createEffect, For, on, onCleanup, onMount, Show } from "solid-js";
import { useVideo } from "~/hooks/useVideo";
import { events } from "~/lib/tauri";
import AudioLines from "~icons/lucide/audio-lines";
import Pause from "~icons/lucide/pause";
import Play from "~icons/lucide/play";
import Subtitles from "~icons/lucide/subtitles";
import { Dropdown, DropdownPortal, DropdownTrigger } from "./ui/dropdown";

const ANIMATION_DURATION = Duration.toMillis("200 millis");
const SHOW_CONTROLS_DURATION = Duration.toMillis("2 seconds");

// currentTime → pixel position
function timeToPixel(time: number, duration: number, barWidth: number) {
  return (time / duration) * barWidth;
}

// pixel position → currentTime
function pixelToTime(pixel: number, duration: number, barWidth: number) {
  return (pixel / barWidth) * duration;
}

function formatTime(seconds: number) {
  const date = new Date(seconds * 1000);
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const secs = date.getUTCSeconds();

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export const VideoProgressBar = () => {
  const params = useParams();
  let containerRef!: HTMLDivElement;
  let drag!: Draggable;

  let controlsEl!: HTMLDivElement;
  let controlsAnimation!: Scope;

  const video = useVideo(params.id);
  createEffect(
    on(
      () => video.state.currentTime,
      (value) => {
        if (!drag) {
          return;
        }

        const pixel = timeToPixel(
          value,
          video.state.duration,
          containerRef.offsetWidth
        );

        drag.setX(Number.isNaN(pixel) ? 0 : pixel);
      },
      { defer: true }
    )
  );

  createEffect(() => {
    controlsAnimation = createScope({ root: containerRef }).add((self) => {
      self?.add("showControls", () => {
        animate(controlsEl, {
          bottom: 0,
          y: 0,
          transformOrigin: "50% 100%", // origin at bottom
          duration: ANIMATION_DURATION,
        });
      });

      self?.add("hideControls", () => {
        animate(controlsEl, {
          y: 100,
          transformOrigin: "50% 100%", // origin at bottom
          duration: ANIMATION_DURATION,
        });
      });

      self?.add("barOnEnter", () => {
        animate(containerRef, {
          scaleY: 1.5,
          ease: "outBounce",
          duration: ANIMATION_DURATION,
        });
      });

      self?.add("barOnLeave", () => {
        animate(containerRef, {
          scaleY: 1.0,
          ease: "outBounce",
          duration: ANIMATION_DURATION,
        });
      });
    });
    onCleanup(() => {
      controlsAnimation.revert();
    });
  });

  const showControls = () => {
    if (!controlsAnimation) {
      return;
    }
    controlsAnimation.methods.showControls();
  };

  const hideControls = () => {
    if (!controlsAnimation) {
      return;
    }
    if (controlsAnimation?.methods?.hideControls) {
      controlsAnimation?.methods?.hideControls();
    }

    const triggerBtn = document.querySelectorAll(".dropdown-trigger");

    triggerBtn.forEach((btn) => {
      btn.dispatchEvent(new CustomEvent("hide"));
    });
  };

  createEffect(
    on(
      () => video.state.pause,
      (state) => {
        if (!controlsAnimation) {
          return;
        }

        if (state) {
          showControls();
          return;
        }
        showControls();

        const timeout = setTimeout(() => {
          hideControls();
        }, SHOW_CONTROLS_DURATION);

        onCleanup(() => clearTimeout(timeout));
      }
    )
  );

  onMount(() => {
    showControls();

    const timeout = setTimeout(() => {
      hideControls();
    }, SHOW_CONTROLS_DURATION);

    onCleanup(() => {
      clearTimeout(timeout);
    });
  });

  let hideTimeout!: ReturnType<typeof setTimeout>;

  const clearHideTimeout = () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }
  };

  createEventListener(window, "mousemove", (e) => {
    const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);

    if (controlsEl.contains(elementAtPoint)) {
      showControls();
      clearHideTimeout();
      return;
    }

    if (video.state.pause) {
      showControls();
      clearHideTimeout();
      return;
    }

    showControls();

    clearHideTimeout();

    hideTimeout = setTimeout(() => {
      hideControls();
    }, SHOW_CONTROLS_DURATION);
  });

  onCleanup(() => {
    clearHideTimeout();
  });

  return (
    <div
      class="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-20% from-black/50 via-60% via-black/40 to-transparent text-white"
      ref={controlsEl}
    >
      <div class="relative mx-5 flex h-full flex-col justify-end gap-4 py-3">
        <div class="flex h-full w-full justify-between px-5">
          <div>{formatTime(video.state.currentTime)}</div>
          <div>{formatTime(video.state.duration)}</div>
        </div>
        <div
          class="relative h-2 rounded-4xl bg-gray-500/50"
          onClick={async (e) => {
            const containerRect = e.currentTarget.getBoundingClientRect();
            const offsetX = e.clientX - containerRect.left;

            const newTime = pixelToTime(
              offsetX,
              video.state.duration,
              e.currentTarget.offsetWidth
            );

            await events.requestSeekEvent.emit({
              position: newTime,
              absolute: true,
            });

            if (video.state.pause) {
              video.setState("currentTime", () => newTime);
            }

            drag.setX(e.offsetX);
          }}
          onMouseEnter={() => controlsAnimation.methods.barOnEnter()}
          onMouseLeave={() => controlsAnimation.methods.barOnLeave()}
          ref={containerRef}
          role="progressbar"
        >
          <div class="relative h-full w-full overflow-hidden rounded-4xl">
            <div
              class="absolute z-10 h-full w-full bg-orange-400"
              style={{
                width: `${timeToPixel(
                  video.state.currentTime,
                  video.state.duration,
                  containerRef.offsetWidth
                )}px`,
              }}
            />
            <div
              class="h-full w-full bg-white/40"
              style={{
                width: `${timeToPixel(
                  video.state.cachedTime,
                  video.state.duration,
                  containerRef.offsetWidth
                )}px`,
              }}
            />
          </div>
          <button
            class="-translate-y-1/2 absolute inset-0 top-1/2 h-5 w-2 cursor-pointer rounded-3xl bg-white"
            ref={(ref) => {
              drag = createDraggable(ref, {
                y: false,
                container: containerRef,
                containerFriction: 1,
                releaseContainerFriction: 1,
                releaseEase: "linear",
                velocityMultiplier: 0,
                onDrag: async (value) => {
                  // update the player
                  const newTime = pixelToTime(
                    value.x,
                    video.state.duration,
                    value.$container.offsetWidth
                  );

                  video.setState("currentTime", () => newTime);

                  await events.requestSeekEvent.emit({
                    position: newTime,
                    absolute: true,
                  });
                },
              });
            }}
          />
        </div>
        <div class="flex items-center justify-between px-5 text-white">
          <div class="left">
            <button onClick={() => video.setState("pause", (value) => !value)}>
              <Show when={video.state.pause}>
                <Play />
              </Show>
              <Show when={!video.state.pause}>
                <Pause />
              </Show>
            </button>
          </div>
          <div class="right flex items-center gap-10">
            <Show when={video.state.audioTracks.length}>
              <Dropdown>
                <DropdownTrigger>
                  <AudioLines />
                </DropdownTrigger>
                <DropdownPortal class="w-max rounded bg-neutral-500 p-5">
                  <div class="flex flex-col gap-2">
                    <For each={video.state.audioTracks}>
                      {(track) => (
                        <button
                          class="rounded p-2 hover:bg-white/15"
                          onClick={() => {
                            events.requestAudioEvent.emit({
                              index: track.id.toString(),
                            });
                          }}
                        >
                          {track.title || track.lang}
                        </button>
                      )}
                    </For>
                  </div>
                </DropdownPortal>
              </Dropdown>
            </Show>
            <Show when={video.state.subtitleTracks.length}>
              <Dropdown>
                <DropdownTrigger>
                  <Subtitles />
                </DropdownTrigger>
                <DropdownPortal class="max-h-96 w-56 overflow-y-auto rounded bg-neutral-500 p-5">
                  <div class="flex flex-col gap-2">
                    <For each={video.state.subtitleTracks}>
                      {(track) => (
                        <button
                          class="rounded p-2 hover:bg-white/15"
                          onClick={() => {
                            events.requestSubtitleEvent.emit({
                              index: track.id.toString(),
                            });
                          }}
                        >
                          {track.title || track.lang}
                        </button>
                      )}
                    </For>
                  </div>
                </DropdownPortal>
              </Dropdown>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
};
