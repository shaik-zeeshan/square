import type { JSAnimation } from "animejs";
import { CableIcon, Download, Loader2, Wifi } from "lucide-solid";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import {
  animationPresets,
  createAnimeInstance,
  prefersReducedMotion,
} from "~/lib/anime-utils";
import type { LoadingStage } from "./types";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  show?: boolean;
  loadingStage?: LoadingStage;
  progress?: number;
}

export function LoadingSpinner(props: LoadingSpinnerProps) {
  const [animationInstance, setAnimationInstance] = createSignal<JSAnimation[]>(
    []
  );

  let spinnerRef!: HTMLDivElement;
  let outerRingRef!: HTMLDivElement;
  let centerDotRef!: HTMLDivElement;
  let textRef!: HTMLDivElement;

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const getLoadingText = () => {
    if (props.text) {
      return props.text;
    }

    switch (props.loadingStage) {
      case "connecting":
        return "Connecting";
      case "metadata":
        return "Loading";
      case "buffering":
        return "Buffering";
      case "ready":
        return "Ready";
      default:
        return "Loading";
    }
  };

  const getLoadingIcon = () => {
    switch (props.loadingStage) {
      case "connecting":
        return CableIcon;
      case "metadata":
        return Download;
      case "buffering":
        return Wifi;
      default:
        return Loader2;
    }
  };

  onMount(() => {
    if (prefersReducedMotion()) {
      return;
    }

    // Create main spinner animation
    const spinnerAnimation = createAnimeInstance(spinnerRef, {
      ...animationPresets.fadeInScale,
      duration: 600,
    });

    // Create outer ring rotation
    const ringAnimation = createAnimeInstance(outerRingRef, {
      rotate: 360,
      duration: 2000,
      loop: true,
      easing: "linear",
    });

    // Create center dot pulse
    const dotAnimation = createAnimeInstance(centerDotRef, {
      ...animationPresets.pulse,
      duration: 1200,
    });

    // Create text fade in with delay
    const textAnimation = createAnimeInstance(textRef, {
      ...animationPresets.slideIn,
      delay: 200,
    });

    setAnimationInstance([
      spinnerAnimation,
      ringAnimation,
      dotAnimation,
      textAnimation,
    ]);
  });

  onCleanup(() => {
    const instances = animationInstance();
    if (instances && Array.isArray(instances)) {
      instances.forEach((instance: unknown) => {
        if (
          instance &&
          typeof instance === "object" &&
          instance !== null &&
          "pause" in instance &&
          typeof instance.pause === "function"
        ) {
          instance.pause();
        }
      });
    }
  });

  const LoadingIcon = getLoadingIcon();

  return (
    <Show when={props.show !== false}>
      <div class="flex flex-col items-center justify-center gap-4">
        {/* Main spinner container */}
        <div class="relative flex items-center justify-center" ref={spinnerRef}>
          {/* Outer rotating ring */}
          <div
            class={`${sizeClasses[props.size || "md"]} rounded-full border-2 border-white/20 border-t-white/80`}
            ref={outerRingRef}
          />

          {/* Center dot */}
          <div
            class="absolute h-2 w-2 rounded-full bg-white/90"
            ref={centerDotRef}
          />

          {/* Loading stage icon */}
          <Show when={props.loadingStage && props.loadingStage !== "ready"}>
            <div class="-bottom-1 -right-1 absolute rounded-full bg-black/60 p-1">
              <LoadingIcon class="h-3 w-3 text-white" />
            </div>
          </Show>
        </div>

        {/* Loading text */}
        <Show when={getLoadingText()}>
          <div
            class={`${textSizes[props.size || "md"]} text-center font-medium text-white/80`}
            ref={textRef}
          >
            {getLoadingText()}
          </div>
        </Show>
      </div>
    </Show>
  );
}
