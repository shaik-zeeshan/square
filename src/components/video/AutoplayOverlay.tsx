import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { ChevronDown, ChevronUp, Play, SkipForward, X } from "lucide-solid";
import { Show } from "solid-js";
import type { WithImage } from "~/effect/services/jellyfin/service";

type AutoplayOverlayProps = {
  nextEpisode: WithImage<BaseItemDto>;
  onPlayNext: () => void;
  onCancel: () => void;
  isVisible: boolean;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
};

export default function AutoplayOverlay(props: AutoplayOverlayProps) {
  const handlePlayNow = () => {
    props.onPlayNext();
  };

  const handleCancel = () => {
    props.onCancel();
  };

  return (
    <Show when={props.isVisible && props.nextEpisode}>
      <div class="pointer-events-none fixed inset-0 z-50">
        <div class="pointer-events-auto absolute right-4 bottom-4">
          {/* Card — matches the controls-bar visual language */}
          <div
            class="w-80 max-w-sm rounded-2xl border border-white/[0.09] bg-black/80 shadow-[0_20px_60px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-[28px] transition-all duration-300"
            classList={{
              "p-2.5": props.isCollapsed,
              "p-4": !props.isCollapsed,
            }}
          >
            {/* Header */}
            <div
              class="flex items-center justify-between"
              classList={{ "mb-3": !props.isCollapsed }}
            >
              <div class="flex items-center gap-2">
                {/* Amber-tinted icon badge — mirrors the play-button ring style */}
                <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-400/[0.12] ring-1 ring-amber-400/[0.18] ring-inset">
                  <SkipForward class="h-3 w-3 text-amber-300" />
                </div>
                <h3 class="font-semibold text-sm text-white tracking-tight">
                  Next Episode
                </h3>
              </div>

              <div class="flex items-center gap-0.5">
                {/* Collapse toggle */}
                <button
                  aria-label={
                    props.isCollapsed
                      ? "Expand autoplay card"
                      : "Collapse autoplay card"
                  }
                  class="flex h-7 w-7 items-center justify-center rounded-xl text-white/45 transition-all duration-150 hover:bg-white/[0.08] hover:text-white/90 active:scale-[0.88]"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.setIsCollapsed(!props.isCollapsed);
                  }}
                >
                  <Show
                    fallback={<ChevronDown class="h-3.5 w-3.5" />}
                    when={props.isCollapsed}
                  >
                    <ChevronUp class="h-3.5 w-3.5" />
                  </Show>
                </button>

                {/* Dismiss */}
                <button
                  aria-label="Dismiss next-episode prompt"
                  class="flex h-7 w-7 items-center justify-center rounded-xl text-white/45 transition-all duration-150 hover:bg-white/[0.08] hover:text-white/90 active:scale-[0.88]"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancel();
                  }}
                >
                  <X class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Episode info + actions — only when expanded */}
            <Show when={!props.isCollapsed}>
              <div class="mb-3">
                <h4 class="mb-1 line-clamp-1 font-semibold text-sm text-white tracking-tight">
                  {props.nextEpisode?.Name}
                </h4>
                <Show when={props.nextEpisode?.SeriesName}>
                  <p class="mb-1 font-mono text-[11px] text-white/40 tabular-nums tracking-tight">
                    {props.nextEpisode?.SeriesName}
                    <Show when={props.nextEpisode?.IndexNumber}>
                      {" "}
                      · Ep {props.nextEpisode?.IndexNumber}
                    </Show>
                  </p>
                </Show>
                <Show when={props.nextEpisode?.Overview}>
                  <p class="line-clamp-2 text-[12px] text-white/50 leading-relaxed">
                    {props.nextEpisode?.Overview}
                  </p>
                </Show>
              </div>

              {/* ── Action Buttons — mirror play-button & secondary-button styles ── */}
              <div class="flex gap-2">
                {/* Primary — amber accent, mirrors the paused play-button */}
                <button
                  class="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-400/[0.12] px-3 py-2 font-semibold text-amber-300 text-sm ring-1 ring-amber-400/[0.18] ring-inset transition-all duration-150 hover:bg-amber-400/[0.2] hover:ring-amber-400/[0.25] active:scale-[0.96]"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayNow();
                  }}
                >
                  <Play class="h-3 w-3" fill="currentColor" />
                  Play Now
                </button>

                {/* Secondary — matches ghost/tertiary button style in controls */}
                <button
                  class="rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-sm text-white/55 transition-all duration-150 hover:bg-white/[0.08] hover:text-white/80 active:scale-[0.96]"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancel();
                  }}
                >
                  Cancel
                </button>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
