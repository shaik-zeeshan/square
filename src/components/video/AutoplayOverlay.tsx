import { Show } from 'solid-js';
import { Play, X, SkipForward, ChevronDown, ChevronUp } from 'lucide-solid';

interface AutoplayOverlayProps {
  nextEpisode: any | null;
  onPlayNext: () => void;
  onCancel: () => void;
  isVisible: boolean;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export default function AutoplayOverlay(props: AutoplayOverlayProps) {

  const handlePlayNow = () => {
    props.onPlayNext();
  };

  const handleCancel = () => {
    props.onCancel();
  };


  return (
    <Show when={props.isVisible && props.nextEpisode}>
      <div class="fixed inset-0 pointer-events-none z-50">
        <div class="absolute bottom-4 right-4 pointer-events-auto">
          <div 
            class="bg-black/90 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl max-w-sm w-80 transition-all duration-300"
            classList={{
              'p-2': props.isCollapsed,
              'p-4': !props.isCollapsed,
            }}
          >
          {/* Header */}
          <div class="flex items-center justify-between" classList={{ 'mb-3': !props.isCollapsed }}>
            <div class="flex items-center gap-2">
              <SkipForward class="h-4 w-4 text-blue-400" />
              <h3 class="text-sm font-semibold text-white">Next Episode</h3>
            </div>
            <div class="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  props.setIsCollapsed(!props.isCollapsed);
                }}
                class="p-1 text-white/60 hover:text-white transition-colors"
              >
                <Show when={props.isCollapsed} fallback={<ChevronDown class="h-4 w-4" />}>
                  <ChevronUp class="h-4 w-4" />
                </Show>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel();
                }}
                class="p-1 text-white/60 hover:text-white transition-colors"
              >
                <X class="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Episode Info and Actions - Only show when not collapsed */}
          <Show when={!props.isCollapsed}>
            <div class="mb-3">
              <h4 class="text-base font-bold text-white mb-1 line-clamp-1">
                {props.nextEpisode?.Name}
              </h4>
              <Show when={props.nextEpisode?.SeriesName}>
                <p class="text-xs text-white/70 mb-1">
                  {props.nextEpisode?.SeriesName} • Episode {props.nextEpisode?.IndexNumber}
                </p>
              </Show>
              <Show when={props.nextEpisode?.Overview}>
                <p class="text-xs text-white/60 line-clamp-2 leading-relaxed">
                  {props.nextEpisode?.Overview}
                </p>
              </Show>
            </div>

            {/* Action Buttons */}
            <div class="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayNow();
                }}
                class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-1 text-sm"
              >
                <Play class="h-3 w-3" />
                Play Now
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel();
                }}
                class="px-3 py-2 text-white/70 hover:text-white border border-white/20 hover:border-white/40 rounded-lg transition-colors text-sm"
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
