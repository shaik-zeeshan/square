import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import type { ItemFields } from "@jellyfin/sdk/lib/generated-client/models/item-fields";
import { useQueryClient } from "@tanstack/solid-query";
import { Effect } from "effect";
import { Check, Play } from "lucide-solid";
import { createMemo, Show } from "solid-js";
import { JellyfinService } from "~/effect/services/jellyfin/service";
import { createEffectQuery } from "~/effect/tanstack/query";
import library from "~/lib/jellyfin/library";
import { useGeneralInfo } from "./current-user-provider";
import { ItemActions } from "./ItemActions";
import { GlassCard } from "./ui";

type SeriesCardProps = {
  item: BaseItemDto & { Image: string };
  parentId?: string;
};

export function SeriesCard({ item: initialItem, parentId }: SeriesCardProps) {
  const { store } = useGeneralInfo();
  const item = createEffectQuery(() => ({
    queryKey: ["getItem", { itemId: initialItem.Id }],
    queryFn: () =>
      JellyfinService.pipe(
        Effect.flatMap((jf) => jf.getItem(Number(initialItem?.Id)))
      ),
    initialData: initialItem,
    staleTime: Number.POSITIVE_INFINITY,
  }));

  return (
    <a
      class="group block"
      href={`/library/${parentId || item.data?.ParentId}/item/${item.data?.Id}`}
    >
      <GlassCard
        class="h-full overflow-hidden transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-[var(--glass-shadow-xl)]"
        preset="card"
      >
        <div class="relative aspect-[2/3] overflow-hidden">
          {/* Image fills entire card */}
          <img
            alt={item.data?.Name ?? "Media item"}
            class="h-full w-full scale-110 object-cover transition-transform duration-700 ease-out group-hover:scale-100"
            src={item.data?.Image}
          />

          {/* Gradient overlay - always visible, darkens on hover */}
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-all duration-300 group-hover:from-black/90 group-hover:via-black/50" />

          {/* Play Icon Overlay */}
          <div class="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div class="scale-75 transform rounded-full border border-white/30 bg-white/20 p-4 transition-transform duration-300 group-hover:scale-100">
              <Play class="h-8 w-8 fill-white text-white" />
            </div>
          </div>

          {/* Unplayed Item Count Badge */}
          <Show
            when={
              item.data?.UserData?.UnplayedItemCount &&
              item.data?.UserData?.UnplayedItemCount > 0
            }
          >
            <div class="absolute top-3 right-3 z-10 rounded-full border-2 border-white/30 bg-blue-500 px-2.5 py-1.5 font-bold text-white text-xs shadow-lg">
              {item.data?.UserData?.UnplayedItemCount}
            </div>
          </Show>

          {/* Played Indicator */}
          <Show when={item.data?.UserData?.Played}>
            <div class="absolute top-3 left-3 z-10 flex items-center gap-1 rounded-full border border-white/20 bg-green-500/90 px-2.5 py-1.5 font-semibold text-white text-xs shadow-lg">
              <Check class="h-3 w-3" />
              <span>Watched</span>
            </div>
          </Show>

          {/* Item Actions - Show on hover */}
          <Show when={item.data?.UserData}>
            <div class="absolute top-2 right-2 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <ItemActions
                item={
                  item.data as {
                    UserData?: { Played?: boolean; IsFavorite?: boolean };
                  }
                }
                itemId={item.data?.Id as string}
                userId={store?.user?.Id}
                variant="card"
              />
            </div>
          </Show>

          {/* Title Info - always visible at bottom */}
          <div class="absolute right-0 bottom-0 left-0 p-4">
            <p class="line-clamp-2 font-semibold text-sm text-white drop-shadow-lg">
              {item.data?.Name}
            </p>
            <Show when={item.data?.ProductionYear}>
              <p class="mt-1 text-white/80 text-xs drop-shadow-md">
                {item.data?.ProductionYear}
              </p>
            </Show>
          </div>
        </div>
      </GlassCard>
    </a>
  );
}

type EpisodeCardProps = {
  item: (BaseItemDto & { Image: string }) | undefined;
};

export function EpisodeCard({ item: initialItem }: EpisodeCardProps) {
  const { store } = useGeneralInfo();

  const item = createEffectQuery(() => ({
    queryKey: ["getItem", { itemId: initialItem?.Id }],
    queryFn: () =>
      JellyfinService.pipe(
        Effect.flatMap((jf) =>
          jf.getItem(Number(initialItem?.Id), {
            fields: [
              "ParentId",
              "Overview",
              "MediaStreams",
              ...((initialItem?.Type === "Movie"
                ? ["Studios", "People"]
                : []) as ItemFields[]),
            ],
          })
        )
      ),
    initialData: initialItem,
    enabled: initialItem?.Type === "Episode",
    staleTime: Number.POSITIVE_INFINITY,
  }));

  if (item.data?.LocationType !== "FileSystem") {
    return;
  }

  const audioLangs = createMemo(() =>
    Array.from(
      new Set(
        item.data?.MediaStreams?.filter(
          (stream) => stream.Type === "Audio"
        ).map((stream) => stream.Language)
      )
    )
  );

  const subtitleLangs = createMemo(() =>
    Array.from(
      new Set(
        item.data?.MediaStreams?.filter(
          (stream) => stream.Type === "Subtitle"
        ).map((stream) => stream.Language)
      )
    )
  );

  const runtimeMinutes = item.data?.RunTimeTicks
    ? Math.round(item.data?.RunTimeTicks / 600_000_000)
    : null;

  // Format runtime as hours and minutes if >= 60 minutes
  const formatRuntime = (minutes: number | null) => {
    if (!minutes) {
      return null;
    }
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Calculate playback progress percentage
  const playbackProgress = () =>
    item.data?.UserData?.PlaybackPositionTicks && item.data?.RunTimeTicks
      ? (item.data?.UserData.PlaybackPositionTicks / item.data?.RunTimeTicks) *
        100
      : 0;

  const isWatched = () => item.data?.UserData?.Played;
  const isInProgress = () => playbackProgress() > 0 && playbackProgress() < 95;

  return (
    <a
      aria-disabled={item.data?.LocationType !== "FileSystem"}
      aria-label={`Play ${item.data?.Name ?? "Episode"}${runtimeMinutes ? ` (${formatRuntime(runtimeMinutes)})` : ""}`}
      class="group block"
      href={
        item.data?.LocationType === "FileSystem"
          ? `/video/${item.data?.Id}`
          : ""
      }
      role={item.data?.LocationType === "FileSystem" ? "link" : "button"}
      tabIndex={item.data?.LocationType === "FileSystem" ? 0 : -1}
    >
      <div class="flex gap-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 transition-all duration-300 hover:border-white/20 hover:bg-white/10">
        {/* Episode Number Badge */}
        <Show when={item.data?.IndexNumber}>
          <div class="relative flex w-12 flex-shrink-0 items-center justify-center">
            <div class="font-bold text-4xl opacity-30 transition-opacity group-hover:opacity-50">
              {item.data?.IndexNumber}
            </div>
          </div>
        </Show>

        {/* Thumbnail */}
        <div class="relative aspect-video w-64 flex-shrink-0 overflow-hidden rounded-xl">
          <img
            alt={item.data?.Name ?? "Episode"}
            class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            src={item.data?.Image}
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {/* Play button overlay */}
          <div class="absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div class="rounded-full border border-white/30 bg-white/20 p-3">
              <Play class="h-6 w-6 fill-white text-white" />
            </div>
          </div>

          {/* Progress bar */}
          <Show when={isInProgress()}>
            <div class="absolute right-0 bottom-0 left-0 z-10 h-1 bg-white/20">
              <div
                class="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${playbackProgress()}%` }}
              />
            </div>
          </Show>

          {/* Item Actions - Show on hover */}
          <div class="absolute top-2 right-2 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <ItemActions
              item={item.data}
              itemId={item.data?.Id as string}
              userId={store?.user?.Id}
              variant="card"
            />
          </div>

          {/* Runtime badge */}
          <Show when={runtimeMinutes}>
            <div class="absolute right-2 bottom-2 z-10 rounded-md bg-black/80 px-2 py-0.5 font-medium text-white text-xs backdrop-blur-sm">
              {formatRuntime(runtimeMinutes)}
            </div>
          </Show>

          {/* Watched overlay */}
          <Show when={isWatched()}>
            <div class="absolute top-2 right-2 z-10 rounded-full border border-white/30 bg-green-500/90 p-1">
              <Check class="h-3.5 w-3.5 text-white" />
            </div>
          </Show>
        </div>

        {/* Episode Info */}
        <div class="flex min-w-0 flex-1 flex-col justify-center gap-2 overflow-hidden">
          <div class="min-w-0">
            <Show when={item.data?.Type === "Episode"}>
              <span class="mb-0.5 block truncate font-semibold text-xs uppercase tracking-wide opacity-60">
                {item.data?.SeasonName}
              </span>
            </Show>
            <h3 class="line-clamp-1 font-bold text-lg transition-colors group-hover:text-white">
              {item.data?.Name}
            </h3>
          </div>

          <p class="line-clamp-3 text-sm leading-relaxed opacity-70">
            {item.data?.Overview}
          </p>

          {/* Audio & Subtitle Badges */}
          <div class="mt-0.5 flex flex-wrap items-start gap-2">
            <Show when={audioLangs?.length}>
              <div class="flex min-w-0 items-start gap-1.5">
                <span class="flex-shrink-0 pt-0.5 font-semibold text-xs uppercase tracking-wider opacity-50">
                  Audio
                </span>
                <div class="flex min-w-0 flex-wrap gap-1">
                  {audioLangs()
                    .slice(0, 4)
                    .map((lang: string | null | undefined) => (
                      <span class="whitespace-nowrap rounded-md border border-blue-500/30 bg-blue-500/20 px-2 py-0.5 font-medium text-blue-300 text-xs">
                        {lang?.toUpperCase() || "Unknown"}
                      </span>
                    ))}
                  <Show when={audioLangs().length > 4}>
                    <span class="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 font-medium text-blue-400 text-xs">
                      +{audioLangs().length - 4}
                    </span>
                  </Show>
                </div>
              </div>
            </Show>

            <Show when={subtitleLangs?.length}>
              <div class="flex min-w-0 items-start gap-1.5">
                <span class="flex-shrink-0 pt-0.5 font-semibold text-xs uppercase tracking-wider opacity-50">
                  Subs
                </span>
                <div class="flex min-w-0 flex-wrap gap-1">
                  {subtitleLangs()
                    .slice(0, 4)
                    .map((lang: string | null | undefined) => (
                      <span class="whitespace-nowrap rounded-md border border-purple-500/30 bg-purple-500/20 px-2 py-0.5 font-medium text-purple-300 text-xs">
                        {lang?.toUpperCase() || "Unknown"}
                      </span>
                    ))}
                  <Show when={subtitleLangs().length > 4}>
                    <span class="rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 font-medium text-purple-400 text-xs">
                      +{subtitleLangs().length - 4}
                    </span>
                  </Show>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </a>
  );
}

// New compact episode card for main page
export function MainPageEpisodeCard({ item: initialItem }: EpisodeCardProps) {
  const { store } = useGeneralInfo();
  const queryClient = useQueryClient();

  const item = createEffectQuery(() => ({
    queryKey: ["getItem", { itemId: initialItem?.Id }],
    queryFn: () =>
      JellyfinService.pipe(
        Effect.flatMap((jf) => jf.getItem(Number(initialItem?.Id)))
      ),
    initialData: initialItem,
    staleTime: Number.POSITIVE_INFINITY,
  }));

  if (!item.data || item.data.LocationType !== "FileSystem") {
    return null;
  }

  const runtimeMinutes = item.data.RunTimeTicks
    ? Math.round(item.data.RunTimeTicks / 600_000_000)
    : null;

  // Format runtime as hours and minutes if >= 60 minutes
  const formatRuntime = (minutes: number | null) => {
    if (!minutes) {
      return null;
    }
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Calculate playback progress percentage
  const playbackProgress = () =>
    item.data.UserData?.PlaybackPositionTicks && item.data.RunTimeTicks
      ? (item.data.UserData.PlaybackPositionTicks / item.data.RunTimeTicks) *
        100
      : 0;

  const isWatched = () => item.data.UserData?.Played;
  const isInProgress = () => playbackProgress() > 0 && playbackProgress() < 95;

  return (
    <a class="group block" href={`/video/${item.data.Id}`}>
      <GlassCard
        class="h-full overflow-hidden shadow-[var(--glass-shadow-md)] transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-[var(--glass-shadow-lg)]"
        preset="card"
      >
        <div class="relative aspect-[16/9] overflow-hidden">
          {/* Episode Image */}
          <Show
            fallback={
              <div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--glass-bg-medium)] to-[var(--glass-bg-subtle)]">
                <span class="text-4xl opacity-30">
                  {item.data.Name?.charAt(0)}
                </span>
              </div>
            }
            when={item.data.Image}
          >
            <img
              alt={item.data.Name ?? "Episode"}
              class="h-full w-full scale-110 object-cover transition-transform duration-700 ease-out group-hover:scale-100"
              src={item.data.Image}
            />
          </Show>

          {/* Gradient overlay */}
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-all duration-300 group-hover:from-black/90 group-hover:via-black/50" />

          {/* Play Icon Overlay */}
          <div class="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div class="scale-75 transform rounded-full border border-white/30 bg-white/20 p-4 transition-transform duration-300 group-hover:scale-100">
              <Play class="h-8 w-8 fill-white text-white" />
            </div>
          </div>

          {/* Progress bar */}
          <Show when={isInProgress()}>
            <div class="absolute right-0 bottom-0 left-0 h-1 bg-black/50">
              <div
                class="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${playbackProgress()}%` }}
              />
            </div>
          </Show>

          {/* Episode number badge */}
          <Show when={item.data.IndexNumber}>
            <div class="absolute top-3 left-3 z-10 rounded-full border border-white/30 bg-blue-500/90 px-2.5 py-1 font-bold text-sm text-white shadow-lg">
              E{item.data.IndexNumber}
            </div>
          </Show>

          {/* Watched indicator */}
          <Show when={isWatched()}>
            <div class="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full border border-white/20 bg-green-500/90 px-2.5 py-1.5 font-semibold text-white text-xs shadow-lg">
              <Check class="h-3 w-3" />
              <span>Watched</span>
            </div>
          </Show>

          {/* Item Actions - Show on hover */}
          <div class="absolute top-2 right-2 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <ItemActions
              item={item.data}
              itemId={item.data.Id as string}
              onDone={() => {
                queryClient.invalidateQueries({
                  queryKey: [library.query.getNextupItems.key],
                });
              }}
              userId={store?.user?.Id}
              variant="card"
            />
          </div>

          {/* Runtime badge */}
          <Show when={runtimeMinutes}>
            <div class="absolute right-2 bottom-2 z-10 rounded-md bg-black/80 px-2 py-0.5 font-medium text-white text-xs backdrop-blur-sm">
              {formatRuntime(runtimeMinutes)}
            </div>
          </Show>

          {/* Episode Info */}
          <div class="absolute right-0 bottom-0 left-0 p-3">
            <h3 class="line-clamp-2 font-semibold text-sm text-white drop-shadow-lg">
              {item.data.Name}
            </h3>
            <Show when={item.data.SeriesName}>
              <p class="mt-1 line-clamp-1 text-white/80 text-xs drop-shadow-md">
                {item.data.SeriesName}
              </p>
            </Show>
            <Show when={item.data.SeasonName && item.data.IndexNumber}>
              <p class="mt-0.5 text-white/70 text-xs drop-shadow-md">
                {item.data.SeasonName} • Episode {item.data.IndexNumber}
              </p>
            </Show>
          </div>
        </div>
      </GlassCard>
    </a>
  );
}
