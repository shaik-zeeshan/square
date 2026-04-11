import type { JSAnimation } from "animejs";
import { onCleanup, onMount, Show } from "solid-js";
import { createAnimeInstance, prefersReducedMotion } from "~/lib/anime-utils";
import type { BufferHealth, NetworkQuality } from "./types";

interface BufferingIndicatorProps {
  isBuffering: boolean;
  bufferingPercentage: number;
  showText?: boolean;
  variant?: "overlay" | "inline";
  networkQuality?: NetworkQuality;
  bufferHealth?: BufferHealth;
}

// Quality label + color helpers
const qualityLabel = (q?: NetworkQuality) => {
  switch (q) {
    case "excellent":
      return "Excellent";
    case "good":
      return "Good";
    case "fair":
      return "Fair";
    case "poor":
      return "Poor";
    default:
      return null;
  }
};

const healthColor = (h?: BufferHealth) => {
  switch (h) {
    case "healthy":
      return "text-emerald-400";
    case "warning":
      return "text-amber-400";
    case "critical":
      return "text-red-400";
    default:
      return "text-white/40";
  }
};

export function BufferingIndicator(props: BufferingIndicatorProps) {
  let containerRef!: HTMLDivElement;
  let outerRingRef!: HTMLDivElement;
  let innerRingRef!: HTMLDivElement;

  let fadeAnim: JSAnimation | null = null;
  let outerSpinAnim: JSAnimation | null = null;
  let innerSpinAnim: JSAnimation | null = null;

  const isOverlay = () => props.variant === "overlay";

  onMount(() => {
    if (prefersReducedMotion()) {
      return;
    }

    fadeAnim = createAnimeInstance(containerRef, {
      opacity: [0, 1],
      scale: [0.9, 1],
      duration: 320,
      easing: "easeOutCubic",
    });

    // Outer ring — steady clockwise, slightly slower for elegance
    outerSpinAnim = createAnimeInstance(outerRingRef, {
      rotate: 360,
      duration: 1600,
      loop: true,
      easing: "linear",
    });

    // Inner ring — counter-clockwise, faster
    innerSpinAnim = createAnimeInstance(innerRingRef, {
      rotate: -360,
      duration: 980,
      loop: true,
      easing: "linear",
    });
  });

  onCleanup(() => {
    fadeAnim?.pause?.();
    outerSpinAnim?.pause?.();
    innerSpinAnim?.pause?.();
  });

  const ql = () => qualityLabel(props.networkQuality);

  return (
    <Show when={props.isBuffering}>
      <div
        class={
          isOverlay()
            ? "absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[3px]"
            : "flex items-center gap-3.5 rounded-2xl border border-white/[0.08] bg-black/80 px-5 py-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
        }
        ref={containerRef}
      >
        {/* Dual-ring spinner */}
        <div class="relative flex h-11 w-11 items-center justify-center">
          {/* Outer ring — amber accent on active arc */}
          <div
            class="absolute inset-0 rounded-full border-[1.5px] border-white/[0.07] border-t-amber-400/70"
            ref={outerRingRef}
          />
          {/* Inner ring */}
          <div
            class="absolute inset-[6px] rounded-full border-[1.5px] border-white/[0.05] border-b-white/35"
            ref={innerRingRef}
          />
          {/* Center dot — amber when has percentage */}
          <div
            class={`h-[5px] w-[5px] rounded-full transition-colors duration-500 ${
              props.bufferingPercentage > 0 ? "bg-amber-400/60" : "bg-white/30"
            }`}
          />
        </div>

        <Show when={props.showText !== false}>
          <div class="flex flex-col gap-0.5">
            <span class="font-medium text-sm text-white/90 tracking-tight">
              Buffering
            </span>
            <div class="flex items-center gap-1.5">
              <Show when={props.bufferingPercentage > 0}>
                <span class="font-mono text-[11px] text-white/40 tabular-nums">
                  {Math.round(props.bufferingPercentage)}%
                </span>
              </Show>
              <Show when={ql()}>
                <span
                  class={`font-medium text-[10px] ${healthColor(props.bufferHealth)}`}
                >
                  {ql()}
                </span>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}
