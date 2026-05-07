import { useNavigate } from "@solidjs/router";
import { Show } from "solid-js";
import type { MediaItem } from "~/effect/services/jellyfin/catalogue/types";

type VideoInfoOverlayProps = {
  /** When true the cached data belongs to a previous item; hide overlay until fresh data arrives. */
  isStale?: boolean;
  itemDetails: {
    data?: MediaItem;
  };
  seriesDetails: {
    data?: MediaItem;
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
                props.itemDetails.data?.type === "episode" &&
                (props.itemDetails.data?.parentIndexNumber ||
                  props.itemDetails.data?.indexNumber)
              }
            >
              <div class="mb-2.5 text-center font-mono text-[10px] text-blue-300/50 uppercase tracking-[0.25em]">
                <Show when={props.itemDetails.data?.parentIndexNumber}>
                  S{props.itemDetails.data?.parentIndexNumber}
                </Show>
                <Show
                  when={
                    props.itemDetails.data?.parentIndexNumber &&
                    props.itemDetails.data?.indexNumber
                  }
                >
                  &thinsp;·&thinsp;
                </Show>
                <Show when={props.itemDetails.data?.indexNumber}>
                  E{props.itemDetails.data?.indexNumber}
                </Show>
              </div>
            </Show>

            {/* Primary title */}
            <h1 class="mb-2.5 text-center font-semibold text-[22px] text-white leading-tight tracking-tight drop-shadow-[0_2px_16px_rgba(0,0,0,0.9)]">
              {props.itemDetails.data?.name}
            </h1>

            {/* Series link */}
            <Show
              when={
                props.itemDetails.data?.type === "episode" &&
                props.itemDetails.data?.seriesName &&
                props.itemDetails.data?.seriesId &&
                props.seriesDetails.data?.parentId &&
                props.seriesDetails.data?.id ===
                  props.itemDetails.data?.seriesId
              }
            >
              <button
                class="pointer-events-auto mx-auto mb-3 block cursor-pointer text-center text-[13px] text-blue-300/45 drop-shadow-md transition-colors duration-150 hover:text-blue-200/75"
                onClick={(e) => {
                  e.stopPropagation();
                  const libraryId = props.seriesDetails.data?.parentId;
                  const seriesId = props.itemDetails.data?.seriesId;
                  if (!libraryId) {
                    return;
                  }
                  if (!seriesId) {
                    return;
                  }
                  navigate(`/library/${libraryId}/item/${seriesId}`);
                }}
              >
                {props.itemDetails.data?.seriesName}
              </button>
            </Show>

            {/* Movie "view details" */}
            <Show when={props.itemDetails.data?.type === "movie"}>
              <button
                class="pointer-events-auto mx-auto mb-3 block cursor-pointer text-center text-[12px] text-white/30 drop-shadow-md transition-colors duration-150 hover:text-white/60"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(
                    `/library/${props.itemDetails.data?.parentId}/item/${props.itemDetails.data?.id}`
                  );
                }}
              >
                View details
              </button>
            </Show>

            <Show when={props.itemDetails.data?.overview}>
              <p class="line-clamp-2 text-center text-[12px] text-white/40 leading-relaxed drop-shadow-md">
                {props.itemDetails.data?.overview}
              </p>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
