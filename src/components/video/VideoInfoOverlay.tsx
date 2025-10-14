import { Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';

interface VideoInfoOverlayProps {
  itemDetails: {
    data?: {
      Name?: string | null;
      SeriesName?: string | null;
      Overview?: string | null;
      Type?: string | null;
      Id?: string | null;
      ParentId?: string | null;
      IndexNumber?: number | null;
      ParentIndexNumber?: number | null;
    };
  };
  parentDetails: {
    data?: {
      ParentId?: string | null;
    };
  };
}

export default function VideoInfoOverlay(props: VideoInfoOverlayProps) {
  const navigate = useNavigate();

  return (
    <Show when={props.itemDetails.data}>
      <div class="fixed top-0 left-0 right-0 bottom-0 pointer-events-none">
        <div class="absolute top-0 left-0 right-0 p-8 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-none">
          <div class="text-white pt-10 max-w-2xl mx-auto">
            <h1 class="text-3xl font-bold mb-3 drop-shadow-lg text-center">
              {props.itemDetails.data?.Name}
            </h1>
            <Show
              when={
                props.itemDetails.data?.SeriesName ||
                props.itemDetails.data?.Name
              }
            >
              <button
                class="text-xl text-foreground/60 hover:text-white transition-colors mb-3 cursor-pointer block font-medium drop-shadow-lg text-center mx-auto pointer-events-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  const isMovie = props.itemDetails.data?.Type === 'Movie';
                  if (isMovie) {
                    // Navigate to movie's library page
                    navigate(
                      `/library/${props.itemDetails.data?.ParentId}/item/${props.itemDetails.data?.Id}`
                    );
                  } else {
                    // Navigate to series page for episodes
                    navigate(
                      `/library/${props.parentDetails.data?.ParentId}/item/${props.itemDetails.data?.ParentId}`
                    );
                  }
                }}
              >
                {props.itemDetails.data?.SeriesName ||
                  props.itemDetails.data?.Name}
              </button>
            </Show>
            
            {/* Season and Episode Info for Episodes */}
            <Show when={props.itemDetails.data?.Type === 'Episode' && (props.itemDetails.data?.ParentIndexNumber || props.itemDetails.data?.IndexNumber)}>
              <div class="text-lg text-white/80 mb-3 text-center drop-shadow-lg">
                <Show when={props.itemDetails.data?.ParentIndexNumber}>
                  Season {props.itemDetails.data?.ParentIndexNumber}
                </Show>
                <Show when={props.itemDetails.data?.ParentIndexNumber && props.itemDetails.data?.IndexNumber}>
                  {' • '}
                </Show>
                <Show when={props.itemDetails.data?.IndexNumber}>
                  Episode {props.itemDetails.data?.IndexNumber}
                </Show>
              </div>
            </Show>
            <Show when={props.itemDetails.data?.Overview}>
              <p class="text-sm text-white/70 line-clamp-3 drop-shadow-md leading-relaxed text-center">
                {props.itemDetails.data?.Overview}
              </p>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
