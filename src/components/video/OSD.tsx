import type { JSAnimation } from "animejs";
import {
  AudioLines,
  Captions,
  Gauge,
  type LucideIcon,
  Pause,
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

  let hideTimeout!: NodeJS.Timeout;

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
      default:
        return Play;
    }
  };

  const getDisplayValue = () => {
    switch (props.state.type) {
      case "volume":
        return `${props.state.value}%`;
      case "speed":
        return `${props.state.value ?? ""}x`;
      case "seek": {
        const value =
          typeof props.state.value === "number" ? props.state.value : 0;
        const seconds = Math.abs(value);
        const sign = value > 0 ? "+" : "-";
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

  createEffect(() => {
    if (prefersReducedMotion() || !props.state.visible) {
      return;
    }

    // Use setTimeout to ensure refs are assigned
    setTimeout(() => {
      if (!(containerRef && iconRef && valueRef)) {
        return;
      }

      // Create slide in animation
      const slideInAnimation = createAnimeInstance(containerRef, {
        ...animationPresets.slideIn,
        translateY: [-30, 0],
        duration: 400,
        easing: "easeOutBack",
      });

      // Create icon bounce
      const iconAnimation = createAnimeInstance(iconRef, {
        ...animationPresets.elasticBounce,
        duration: 600,
        delay: 100,
      });

      // Create value fade in
      const valueAnimation = createAnimeInstance(valueRef, {
        ...animationPresets.fadeInScale,
        delay: 200,
        duration: 300,
      });

      setAnimationInstance([slideInAnimation, iconAnimation, valueAnimation]);

      // Auto hide after 1.5 seconds
      hideTimeout = setTimeout(() => {
        hideOSD();
      }, 1500);
    }, 0);
  });

  onCleanup(() => {
    clearTimeout(hideTimeout);
  });

  onCleanup(() => {
    const instances = animationInstance();
    if (instances) {
      instances.forEach((instance: JSAnimation) => {
        if (instance && typeof instance.pause === "function") {
          instance.pause();
        }
      });
    }
  });

  const hideOSD = () => {
    if (prefersReducedMotion()) {
      props.onHide?.();
      return;
    }

    // Create fade out animation
    const fadeOutAnimation = createAnimeInstance(containerRef, {
      opacity: [1, 0],
      scale: [1, 0.9],
      duration: 200,
      easing: "easeInQuart",
      complete: () => {
        props.onHide?.();
      },
    });

    setAnimationInstance([fadeOutAnimation]);
  };

  const Icon = getIcon();

  return (
    <Show when={props.state.visible}>
      <div
        class="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 transform"
        ref={containerRef}
      >
        <div class="flex flex-col items-center gap-3 rounded-xl border border-white/20 bg-black/80 px-6 py-4 shadow-2xl backdrop-blur-md">
          {/* Icon */}
          <div
            class="flex h-12 w-12 items-center justify-center rounded-full bg-white/10"
            ref={iconRef}
          >
            <Icon class="h-6 w-6 text-white" />
          </div>

          {/* Value display */}
          <div class="text-center" ref={valueRef}>
            <div class="font-semibold text-lg text-white">
              {getDisplayValue()}
            </div>

            {/* Volume bar for volume changes */}
            <Show when={props.state.type === "volume"}>
              <div class="mt-2 h-1 w-24 overflow-hidden rounded-full bg-white/20">
                <div
                  class="h-full bg-white/80 transition-all duration-300"
                  style={{ width: getVolumeBarWidth() }}
                />
              </div>
            </Show>

            {/* Label */}
            <Show when={props.state.label && props.state.type !== "volume"}>
              <div class="mt-1 text-sm text-white/70">{props.state.label}</div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
