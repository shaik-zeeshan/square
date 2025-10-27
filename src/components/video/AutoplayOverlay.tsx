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
          <div
            class="w-80 max-w-sm rounded-xl border border-white/20 bg-black/90 shadow-2xl backdrop-blur-md transition-all duration-300"
            classList={{
              "p-2": props.isCollapsed,
              "p-4": !props.isCollapsed,
            }}
          >
            {/* Header */}
            <div
              class="flex items-center justify-between"
              classList={{ "mb-3": !props.isCollapsed }}
            >
              <div class="flex items-center gap-2">
                <SkipForward class="h-4 w-4 text-blue-400" />
                <h3 class="font-semibold text-sm text-white">Next Episode</h3>
              </div>
              <div class="flex items-center gap-1">
                <button
                  class="p-1 text-white/60 transition-colors hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.setIsCollapsed(!props.isCollapsed);
                  }}
                >
                  <Show
                    fallback={<ChevronDown class="h-4 w-4" />}
                    when={props.isCollapsed}
                  >
                    <ChevronUp class="h-4 w-4" />
                  </Show>
                </button>
                <button
                  class="p-1 text-white/60 transition-colors hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancel();
                  }}
                >
                  <X class="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Episode Info and Actions - Only show when not collapsed */}
            <Show when={!props.isCollapsed}>
              <div class="mb-3">
                <h4 class="mb-1 line-clamp-1 font-bold text-base text-white">
                  {props.nextEpisode?.Name}
                </h4>
                <Show when={props.nextEpisode?.SeriesName}>
                  <p class="mb-1 text-white/70 text-xs">
                    {props.nextEpisode?.SeriesName} • Episode{" "}
                    {props.nextEpisode?.IndexNumber}
                  </p>
                </Show>
                <Show when={props.nextEpisode?.Overview}>
                  <p class="line-clamp-2 text-white/60 text-xs leading-relaxed">
                    {props.nextEpisode?.Overview}
                  </p>
                </Show>
              </div>

              {/* Action Buttons */}
              <div class="flex gap-2">
                <button
                  class="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayNow();
                  }}
                >
                  <Play class="h-3 w-3" />
                  Play Now
                </button>
                <button
                  class="rounded-lg border border-white/20 px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/40 hover:text-white"
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
