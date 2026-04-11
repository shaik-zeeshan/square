import type { JSAnimation } from "animejs";
import {
  AudioLines,
  Captions,
  Gauge,
  type LucideIcon,
  Pause,
  PictureInPicture2,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-solid";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import {
  animationPresets,
  createAnimeInstance,
  prefersReducedMotion,
} from "~/lib/anime-utils";
import type { OSDState } from "./types";

interface OSDProps {
  state: OSDState;
  onHide?: () => void;
}

export function OSD(props: OSDProps) {
  const [animationInstance, setAnimationInstance] = createSignal<JSAnimation[]>(
    []
  );

  let containerRef!: HTMLDivElement;
  let iconRef!: HTMLDivElement;
  let valueRef!: HTMLDivElement;

  let hideTimeout: ReturnType<typeof setTimeout> | undefined;
  let deferTimeout: ReturnType<typeof setTimeout> | undefined;

  const getIcon = (): LucideIcon => {
    switch (props.state.type) {
      case "volume":
        return props.state.value === 0 ? VolumeX : Volume2;
      case "speed":
        return Gauge;
      case "seek": {
        const value =
          typeof props.state.value === "number" ? props.state.value : 0;
        return value > 0 ? SkipForward : SkipBack;
      }
      case "audio":
        return AudioLines;
      case "subtitle":
        return Captions;
      case "play":
        return Play;
      case "pause":
        return Pause;
      case "mute":
        return VolumeX;
      case "unmute":
        return Volume2;
      case "pip":
        return PictureInPicture2;
      default:
        return Play;
    }
  };

  const getDisplayValue = () => {
    switch (props.state.type) {
      case "volume":
        return `${props.state.value}%`;
      case "speed":
        return `${props.state.value ?? ""}×`;
      case "seek": {
        const value =
          typeof props.state.value === "number" ? props.state.value : 0;
        const seconds = Math.abs(value);
        const sign = value > 0 ? "+" : "−";
        return `${sign}${seconds}s`;
      }
      case "audio":
      case "subtitle":
        return props.state.value || "Off";
      case "play":
      case "pause":
      case "mute":
      case "unmute":
        return props.state.label || "";
      case "pip":
        return props.state.label || "Picture in Picture";
      default:
        return props.state.value?.toString() || "";
    }
  };

  const getVolumeBarWidth = () => {
    if (props.state.type === "volume") {
      const value =
        typeof props.state.value === "number" ? props.state.value : 0;
      return `${Math.min(100, Math.max(0, value))}%`;
    }
    return "0%";
  };

  const hasTextValue = () => {
    const t = props.state.type;
    return t !== "play" && t !== "pause";
  };

  // Is this a "seek" type — shows directional indicator
  const isSeek = () => props.state.type === "seek";

  // Accent tinting for specific types
  const iconBgClass = () => {
    if (props.state.type === "seek") {
      return "bg-amber-400/[0.12] ring-amber-400/[0.14]";
    }
    if (props.state.type === "play") {
      return "bg-green-400/[0.1] ring-green-400/[0.12]";
    }
    if (props.state.type === "mute") {
      return "bg-red-400/[0.1] ring-red-400/[0.12]";
    }
    return "bg-white/[0.1] ring-white/[0.08]";
  };

  const iconColorClass = () => {
    if (props.state.type === "seek") {
      return "text-amber-300";
    }
    if (props.state.type === "play") {
      return "text-green-300";
    }
    if (props.state.type === "mute") {
      return "text-red-300";
    }
    return "text-white";
  };

  const seekSign = () => {
    if (props.state.type !== "seek") {
      return null;
    }
    const value = typeof props.state.value === "number" ? props.state.value : 0;
    return value > 0 ? "+" : "−";
  };

  createEffect(() => {
    // Track all meaningful OSD state fields
    const _track = `${props.state.type}|${props.state.value}|${props.state.label}`;

    if (prefersReducedMotion() || !props.state.visible) {
      return;
    }

    clearTimeout(hideTimeout);
    hideTimeout = undefined;
    clearTimeout(deferTimeout);

    deferTimeout = setTimeout(() => {
      deferTimeout = undefined;

      if (!(containerRef && iconRef && valueRef)) {
        return;
      }

      const slideIn = createAnimeInstance(containerRef, {
        ...animationPresets.slideIn,
        translateY: [-14, 0],
        scale: [0.84, 1],
        opacity: [0, 1],
        duration: 260,
        easing: "easeOutCubic",
      });

      const iconBounce = createAnimeInstance(iconRef, {
        ...animationPresets.elasticBounce,
        duration: 420,
        delay: 40,
      });

      const valueFade = createAnimeInstance(valueRef, {
        ...animationPresets.fadeInScale,
        translateY: [5, 0],
        opacity: [0, 1],
        delay: 60,
        duration: 220,
        easing: "easeOutCubic",
      });

      setAnimationInstance([slideIn, iconBounce, valueFade]);

      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        hideOSD();
      }, 1400);
    }, 0);
  });

  onCleanup(() => {
    clearTimeout(hideTimeout);
    clearTimeout(deferTimeout);
  });

  onCleanup(() => {
    for (const instance of animationInstance()) {
      if (instance && typeof instance.pause === "function") {
        instance.pause();
      }
    }
  });

  const hideOSD = () => {
    if (prefersReducedMotion()) {
      props.onHide?.();
      return;
    }

    const fadeOut = createAnimeInstance(containerRef, {
      opacity: [1, 0],
      scale: [1, 0.86],
      translateY: [0, -6],
      duration: 180,
      easing: "easeInCubic",
      complete: () => {
        props.onHide?.();
      },
    });

    setAnimationInstance([fadeOut]);
  };

  const Icon = getIcon();

  return (
    <Show when={props.state.visible}>
      <div
        class="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50"
        ref={containerRef}
      >
        {/* Cinematic pill OSD */}
        <div class="flex min-w-[96px] flex-col items-center gap-3 rounded-[20px] border border-white/[0.09] bg-black/86 px-6 py-5 shadow-[0_20px_64px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-[32px]">
          {/* Icon */}
          <div
            class={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset ${iconBgClass()}`}
            ref={iconRef}
          >
            <Icon class={`h-5 w-5 ${iconColorClass()}`} />
          </div>

          {/* Value + optional sub-content */}
          <div class="flex flex-col items-center gap-1.5" ref={valueRef}>
            <Show when={hasTextValue()}>
              <div
                class={`font-mono font-semibold text-[15px] tabular-nums tracking-tight ${
                  isSeek() ? "text-amber-300" : "text-white"
                }`}
              >
                <Show when={isSeek()}>
                  <span class="mr-0.5 text-[13px] text-amber-400/60">
                    {seekSign()}
                  </span>
                </Show>
                {isSeek()
                  ? `${Math.abs(typeof props.state.value === "number" ? props.state.value : 0)}s`
                  : getDisplayValue()}
              </div>
            </Show>

            {/* Volume bar */}
            <Show when={props.state.type === "volume"}>
              <div class="mt-1 h-[3px] w-[72px] overflow-hidden rounded-full bg-white/[0.12]">
                <div
                  class="h-full rounded-full bg-white/85 transition-[width] duration-200"
                  style={{ width: getVolumeBarWidth() }}
                />
              </div>
            </Show>

            {/* Label for audio/subtitle/speed */}
            <Show
              when={
                props.state.label &&
                props.state.type !== "volume" &&
                props.state.type !== "seek" &&
                props.state.type !== "play" &&
                props.state.type !== "pause" &&
                props.state.type !== "pip"
              }
            >
              <div class="max-w-[140px] truncate text-[11px] text-white/45">
                {props.state.label}
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
