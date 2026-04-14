import { useNavigate } from "@solidjs/router";
import { Show } from "solid-js";

type VideoInfoOverlayProps = {
  /** When true the cached data belongs to a previous item; hide overlay until fresh data arrives. */
  isStale?: boolean;
  itemDetails: {
    data?: {
      Name?: string | null;
      SeriesName?: string | null;
      Overview?: string | null;
      Type?: string | null;
      Id?: string | null;
      ParentId?: string | null;
      SeriesId?: string | null;
      IndexNumber?: number | null;
      ParentIndexNumber?: number | null;
    };
  };
  seriesDetails: {
    data?: {
      Id?: string | null;
      ParentId?: string | null;
    };
  };
};

export default function VideoInfoOverlay(props: VideoInfoOverlayProps) {
  const navigate = useNavigate();

  return (
    <Show when={props.itemDetails.data && !props.isStale}>
      <div class="pointer-events-none fixed inset-0">
        {/* Top gradient — deep navy cinematic fade */}
        <div class="pointer-events-none absolute top-0 right-0 left-0 bg-gradient-to-b from-[#080c16]/95 via-[#080c16]/50 to-transparent pt-0 pb-28">
          <div class="mx-auto max-w-lg px-6 pt-16 text-white">
            {/* Episode / Season meta */}
            <Show
              when={
                props.itemDetails.data?.Type === "Episode" &&
                (props.itemDetails.data?.ParentIndexNumber ||
                  props.itemDetails.data?.IndexNumber)
              }
            >
              <div class="mb-2.5 text-center font-mono text-[10px] text-blue-300/50 uppercase tracking-[0.25em]">
                <Show when={props.itemDetails.data?.ParentIndexNumber}>
                  S{props.itemDetails.data?.ParentIndexNumber}
                </Show>
                <Show
                  when={
                    props.itemDetails.data?.ParentIndexNumber &&
                    props.itemDetails.data?.IndexNumber
                  }
                >
                  &thinsp;·&thinsp;
                </Show>
                <Show when={props.itemDetails.data?.IndexNumber}>
                  E{props.itemDetails.data?.IndexNumber}
                </Show>
              </div>
            </Show>

            {/* Primary title */}
            <h1 class="mb-2.5 text-center font-semibold text-[22px] text-white leading-tight tracking-tight drop-shadow-[0_2px_16px_rgba(0,0,0,0.9)]">
              {props.itemDetails.data?.Name}
            </h1>

            {/* Series link */}
            <Show
              when={
                props.itemDetails.data?.Type === "Episode" &&
                props.itemDetails.data?.SeriesName &&
                props.itemDetails.data?.SeriesId &&
                props.seriesDetails.data?.ParentId &&
                props.seriesDetails.data?.Id ===
                  props.itemDetails.data?.SeriesId
              }
            >
              <button
                class="pointer-events-auto mx-auto mb-3 block cursor-pointer text-center text-[13px] text-blue-300/45 drop-shadow-md transition-colors duration-150 hover:text-blue-200/75"
                onClick={(e) => {
                  e.stopPropagation();
                  const libraryId = props.seriesDetails.data?.ParentId;
                  const seriesId = props.itemDetails.data?.SeriesId;
                  if (!libraryId) {
                    return;
                  }
                  if (!seriesId) {
                    return;
                  }
                  navigate(`/library/${libraryId}/item/${seriesId}`);
                }}
              >
                {props.itemDetails.data?.SeriesName}
              </button>
            </Show>

            {/* Movie "view details" */}
            <Show when={props.itemDetails.data?.Type === "Movie"}>
              <button
                class="pointer-events-auto mx-auto mb-3 block cursor-pointer text-center text-[12px] text-white/30 drop-shadow-md transition-colors duration-150 hover:text-white/60"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(
                    `/library/${props.itemDetails.data?.ParentId}/item/${props.itemDetails.data?.Id}`
                  );
                }}
              >
                View details
              </button>
            </Show>

            <Show when={props.itemDetails.data?.Overview}>
              <p class="line-clamp-2 text-center text-[12px] text-white/40 leading-relaxed drop-shadow-md">
                {props.itemDetails.data?.Overview}
              </p>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
