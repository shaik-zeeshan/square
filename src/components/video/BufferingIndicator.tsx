import type { JSAnimation } from "animejs";
import { Activity, Wifi, WifiOff } from "lucide-solid";
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import {
  animateCount,
  animationPresets,
  createAnimeInstance,
  prefersReducedMotion,
} from "~/lib/anime-utils";
import type { BufferHealth, NetworkQuality } from "./types";

interface BufferingIndicatorProps {
  isBuffering: boolean;
  bufferingPercentage: number;
  showText?: boolean;
  variant?: "overlay" | "inline";
  networkQuality?: NetworkQuality;
  bufferHealth?: BufferHealth;
}

export function BufferingIndicator(props: BufferingIndicatorProps) {
  const [animationInstance, setAnimationInstance] = createSignal<JSAnimation[]>(
    []
  );
  const [displayPercentage, setDisplayPercentage] = createSignal(0);

  let containerRef!: HTMLDivElement;
  let spinnerRef!: HTMLDivElement;
  let percentageRef!: HTMLDivElement;
  let waveRef!: HTMLDivElement;
  let progressRingRef!: SVGCircleElement;

  const isOverlay = () => props.variant === "overlay";

  const getNetworkQualityIcon = () => {
    switch (props.networkQuality) {
      case "excellent":
        return Wifi;
      case "good":
        return Wifi;
      case "fair":
        return Activity;
      case "poor":
        return WifiOff;
      default:
        return WifiOff;
    }
  };

  const getBufferHealthColor = () => {
    switch (props.bufferHealth) {
      case "healthy":
        return "text-green-400";
      case "warning":
        return "text-yellow-400";
      case "critical":
        return "text-red-400";
      default:
        return "text-white/80";
    }
  };

  const getNetworkQualityColor = () => {
    switch (props.networkQuality) {
      case "excellent":
        return "text-green-400";
      case "good":
        return "text-blue-400";
      case "fair":
        return "text-yellow-400";
      case "poor":
        return "text-red-400";
      default:
        return "text-white/80";
    }
  };

  // Animate percentage changes
  createEffect(() => {
    if (prefersReducedMotion()) {
      setDisplayPercentage(props.bufferingPercentage);
      return;
    }

    const currentPercentage = displayPercentage();
    const targetPercentage = props.bufferingPercentage;

    if (Math.abs(currentPercentage - targetPercentage) > 1) {
      animateCount(percentageRef, currentPercentage, targetPercentage, 500);
      setDisplayPercentage(targetPercentage);
    }
  });

  onMount(() => {
    if (prefersReducedMotion()) {
      return;
    }

    // Create container fade in
    const containerAnimation = createAnimeInstance(containerRef, {
      ...animationPresets.fadeInScale,
      duration: 400,
    });

    // Create spinner rotation
    const spinnerAnimation = createAnimeInstance(spinnerRef, {
      rotate: 360,
      duration: 1500,
      loop: true,
      easing: "linear",
    });

    // Create wave animation
    const waveAnimation = createAnimeInstance(waveRef, {
      ...animationPresets.wave,
      loop: true,
      delay: 200,
    });

    setAnimationInstance([containerAnimation, spinnerAnimation, waveAnimation]);
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

  const NetworkIcon = getNetworkQualityIcon();

  return (
    <Show when={props.isBuffering}>
      <div
        class={`flex items-center justify-center gap-4 rounded-lg ${
          isOverlay()
            ? "absolute inset-0 z-40 bg-black/60 backdrop-blur-md"
            : "bg-black/40 px-6 py-4"
        }
        `}
        ref={containerRef}
      >
        {/* Simple spinner */}
        <div class="relative flex items-center justify-center">
          <div
            class="h-8 w-8 rounded-full border-2 border-white/30 border-t-white/80"
            ref={spinnerRef}
          />
        </div>

        <Show when={props.showText !== false}>
          <div class="flex items-center gap-2">
            <span class="font-medium text-white">Buffering</span>
          </div>
        </Show>
      </div>
    </Show>
  );
}
