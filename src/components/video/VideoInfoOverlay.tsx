import { useNavigate } from "@solidjs/router";
import { Show } from "solid-js";

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
      <div class="pointer-events-none fixed top-0 right-0 bottom-0 left-0">
        <div class="pointer-events-none absolute top-0 right-0 left-0 bg-gradient-to-b from-black/90 via-black/50 to-transparent p-8">
          <div class="mx-auto max-w-2xl pt-10 text-white">
            <h1 class="mb-3 text-center font-bold text-3xl drop-shadow-lg">
              {props.itemDetails.data?.Name}
            </h1>
            <Show
              when={
                props.itemDetails.data?.SeriesName ||
                props.itemDetails.data?.Name
              }
            >
              <button
                class="pointer-events-auto mx-auto mb-3 block cursor-pointer text-center font-medium text-foreground/60 text-xl drop-shadow-lg transition-colors hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  const isMovie = props.itemDetails.data?.Type === "Movie";
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
            <Show
              when={
                props.itemDetails.data?.Type === "Episode" &&
                (props.itemDetails.data?.ParentIndexNumber ||
                  props.itemDetails.data?.IndexNumber)
              }
            >
              <div class="mb-3 text-center text-lg text-white/80 drop-shadow-lg">
                <Show when={props.itemDetails.data?.ParentIndexNumber}>
                  Season {props.itemDetails.data?.ParentIndexNumber}
                </Show>
                <Show
                  when={
                    props.itemDetails.data?.ParentIndexNumber &&
                    props.itemDetails.data?.IndexNumber
                  }
                >
                  {" • "}
                </Show>
                <Show when={props.itemDetails.data?.IndexNumber}>
                  Episode {props.itemDetails.data?.IndexNumber}
                </Show>
              </div>
            </Show>
            <Show when={props.itemDetails.data?.Overview}>
              <p class="line-clamp-3 text-center text-sm text-white/70 leading-relaxed drop-shadow-md">
                {props.itemDetails.data?.Overview}
              </p>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
