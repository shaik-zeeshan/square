import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import type { ItemFields } from "@jellyfin/sdk/lib/generated-client/models/item-fields";
import { Effect } from "effect";
import { Check, Play } from "lucide-solid";
import {
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
  splitProps,
} from "solid-js";
import { JellyfinOperations } from "~/effect/services/jellyfin/operations";
import {
  JellyfinService,
  type WithImage,
} from "~/effect/services/jellyfin/service";
import { createEffectQuery } from "~/effect/tanstack/query";
import { prefersReducedMotion } from "~/lib/anime-utils";
import { ItemActions } from "./ItemActions";
import { GlassCard } from "./ui";

/**
 * Reactive 3D tilt + specular-shine effect for poster cards.
 * Respects prefers-reduced-motion; degrades to static hover.
 */
function createPosterMotion() {
  const [tilt, setTilt] = createSignal({ rx: 0, ry: 0, shine: "50% 50%" });
  const reduced = prefersReducedMotion();
  let rafId: number | undefined;

  const onMove = (e: MouseEvent) => {
    if (reduced) {
      return;
    }
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width; // 0..1
    const y = (e.clientY - rect.top) / rect.height;
    // Cancel any pending raf to avoid stacking
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => {
      setTilt({
        rx: (y - 0.5) * -8, // max ±4 deg
        ry: (x - 0.5) * 8,
        shine: `${x * 100}% ${y * 100}%`,
      });
    });
  };

  const onLeave = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    setTilt({ rx: 0, ry: 0, shine: "50% 50%" });
  };

  onCleanup(() => {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
  });

  const cardStyle = () =>
    reduced
      ? {}
      : {
          transform: `perspective(800px) rotateX(${tilt().rx}deg) rotateY(${tilt().ry}deg)`,
        };

  const shineStyle = () =>
    reduced
      ? {}
      : {
          background: `radial-gradient(ellipse 60% 50% at ${tilt().shine}, rgba(255,255,255,0.12) 0%, transparent 70%)`,
        };

  return { onMove, onLeave, cardStyle, shineStyle, reduced } as const;
}

type SeriesCardProps = {
  item: WithImage<BaseItemDto>;
  parentId?: string;
  search?: string;
};

export function SeriesCard(props: SeriesCardProps) {
  const [{ item: initialItem, parentId, search }] = splitProps(props, [
    "item",
    "parentId",
    "search",
  ]);

  const item = createEffectQuery(() => ({
    queryKey: JellyfinOperations.itemQueryKey({
      id: initialItem.Id as string,
    }),
    queryFn: () =>
      JellyfinService.pipe(
        Effect.flatMap((jf) =>
          jf.getItem(initialItem?.Id as string, { fields: ["ParentId"] })
        )
      ),
    initialData: initialItem,
    staleTime: Number.POSITIVE_INFINITY,
  }));

  const motion = createPosterMotion();

  return (
    <a
      class="group block"
      href={`/library/${parentId || item.data?.ParentId}/item/${item.data?.Id}${search || ""}`}
      onMouseLeave={motion.onLeave}
      onMouseMove={motion.onMove}
    >
      <div class="poster-card-wrapper" style={motion.cardStyle()}>
        <GlassCard
          class="h-full overflow-hidden transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-(--glass-shadow-xl)"
          preset="card"
        >
          <div class="relative aspect-2/3 overflow-hidden">
            {/* Image fills entire card */}
            <img
              alt={item.data?.Name ?? "Media item"}
              class="h-full w-full scale-110 object-cover transition-transform duration-700 ease-out group-hover:scale-100"
              src={
                item.data &&
                ("Primary" in item.data.Images
                  ? (item.data?.Images.Primary as string)
                  : item.data?.Image)
              }
            />

            {/* Gradient overlay — cooler, more cinematic */}
            <div class="absolute inset-0 bg-linear-to-t from-black/85 via-black/15 to-transparent transition-all duration-300 group-hover:from-black/90 group-hover:via-black/45" />

            {/* Specular shine overlay — follows cursor */}
            <div
              class="pointer-events-none absolute inset-0 z-[5] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={motion.shineStyle()}
            />

            {/* Subtle blue edge glow on hover */}
            <div class="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-400/0 to-transparent transition-all duration-300 group-hover:via-blue-400/30" />

            {/* Play Icon Overlay — cleaner, premium */}
            <div class="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div class="scale-75 transform rounded-full border border-white/20 bg-white/10 p-3.5 backdrop-blur-sm transition-all duration-300 group-hover:scale-100 group-hover:border-white/30 group-hover:bg-white/15 group-hover:shadow-[0_0_24px_rgba(100,160,255,0.12)]">
                <Play class="h-6 w-6 fill-white text-white" />
              </div>
            </div>

            {/* Unplayed Item Count Badge */}
            <Show
              when={
                item.data?.UserData?.UnplayedItemCount &&
                item.data?.UserData?.UnplayedItemCount > 0
              }
            >
              <div class="absolute top-2 right-2 z-10 rounded-md border border-blue-400/25 bg-blue-400/15 px-2 py-0.5 font-bold text-blue-200 text-xs shadow-lg backdrop-blur-sm">
                {item.data?.UserData?.UnplayedItemCount}
              </div>
            </Show>

            {/* Played Indicator */}
            <Show when={item.data?.UserData?.Played}>
              <div class="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md border border-white/15 bg-black/55 px-2 py-0.5 font-medium text-white/65 text-xs backdrop-blur-sm">
                <Check class="h-3 w-3 text-emerald-400" />
                <span>Watched</span>
              </div>
            </Show>

            {/* Item Actions - Show on hover */}
            <Show when={item.data}>
              <div class="absolute top-2 right-2 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <ItemActions
                  item={item.data as WithImage<BaseItemDto>}
                  itemId={item.data?.Id as string}
                  variant="card"
                />
              </div>
            </Show>

            {/* Title Info - slides up on hover for depth reveal */}
            <div class="absolute right-0 bottom-0 left-0 p-3.5 transition-transform duration-300 ease-out group-hover:translate-y-[-2px]">
              <p class="line-clamp-2 font-semibold text-sm text-white drop-shadow-lg">
                {item.data?.Name}
              </p>
              <Show when={item.data?.ProductionYear}>
                <p class="mt-1 translate-y-1 text-white/50 text-xs opacity-0 drop-shadow-md transition-all delay-75 duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
                  {item.data?.ProductionYear}
                </p>
              </Show>
            </div>
          </div>
        </GlassCard>
      </div>
    </a>
  );
}

type EpisodeCardProps = {
  item: WithImage<BaseItemDto> | undefined;
};

export function EpisodeCard(props: EpisodeCardProps) {
  const [{ item: initialItem }] = splitProps(props, ["item"]);

  const item = createEffectQuery(() => ({
    queryKey: JellyfinOperations.itemQueryKey({
      id: initialItem?.Id as string,
    }),
    queryFn: () =>
      JellyfinService.pipe(
        Effect.flatMap((jf) =>
          jf.getItem(initialItem?.Id as string, {
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

  const playbackProgress = createMemo(() =>
    item.data?.UserData?.PlaybackPositionTicks && item.data?.RunTimeTicks
      ? (item.data?.UserData.PlaybackPositionTicks / item.data?.RunTimeTicks) *
        100
      : 0
  );

  const isWatched = createMemo(() => item.data?.UserData?.Played);
  const isInProgress = createMemo(
    () => playbackProgress() > 0 && playbackProgress() < 95
  );

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
      <div class="flex gap-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 transition-all duration-300 hover:border-white/[0.14] hover:bg-white/[0.06]">
        {/* Episode Number Badge */}
        <Show when={item.data?.IndexNumber}>
          <div class="relative flex w-12 shrink-0 items-center justify-center">
            <div class="font-bold text-4xl opacity-25 transition-opacity group-hover:opacity-45">
              {item.data?.IndexNumber}
            </div>
          </div>
        </Show>

        {/* Thumbnail */}
        <div class="relative aspect-video w-64 shrink-0 overflow-hidden rounded-xl">
          <img
            alt={item.data?.Name ?? "Episode"}
            class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            src={item.data?.Image}
          />
          <div class="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {/* Play button overlay */}
          <div class="absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div class="rounded-full border border-white/25 bg-white/10 p-3 backdrop-blur-sm">
              <Play class="h-6 w-6 fill-white text-white" />
            </div>
          </div>

          {/* Progress bar */}
          <Show when={isInProgress()}>
            <div class="absolute right-0 bottom-0 left-0 z-10 h-[3px] bg-black/40">
              <div
                class="h-full rounded-r-full bg-blue-400 shadow-[0_0_6px_rgba(100,160,255,0.5)] transition-all duration-300"
                style={{ width: `${playbackProgress()}%` }}
              />
            </div>
          </Show>

          {/* Item Actions - Show on hover */}
          <div class="absolute top-2 right-2 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <ItemActions
              item={item.data as WithImage<BaseItemDto>}
              itemId={item.data?.Id as string}
              variant="card"
            />
          </div>

          {/* Runtime badge */}
          <Show when={runtimeMinutes}>
            <div class="absolute right-2 bottom-2 z-10 rounded-md bg-black/65 px-1.5 py-0.5 font-medium text-white/75 text-xs backdrop-blur-sm">
              {formatRuntime(runtimeMinutes)}
            </div>
          </Show>

          {/* Watched overlay */}
          <Show when={isWatched()}>
            <div class="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md border border-white/15 bg-black/55 px-2 py-0.5 font-medium text-white/65 text-xs backdrop-blur-sm">
              <Check class="h-3 w-3 text-emerald-400" />
            </div>
          </Show>
        </div>

        {/* Episode Info */}
        <div class="flex min-w-0 flex-1 flex-col justify-center gap-2 overflow-hidden">
          <div class="min-w-0">
            <Show when={item.data?.Type === "Episode"}>
              <span class="mb-0.5 block truncate font-semibold text-xs uppercase tracking-wide opacity-50">
                {item.data?.SeasonName}
              </span>
            </Show>
            <h3 class="line-clamp-1 font-bold text-lg transition-colors group-hover:text-white">
              {item.data?.Name}
            </h3>
          </div>

          <p class="line-clamp-3 text-sm leading-relaxed opacity-60">
            {item.data?.Overview}
          </p>

          {/* Audio & Subtitle Badges */}
          <div class="mt-0.5 flex flex-wrap items-start gap-2">
            <Show when={audioLangs?.length}>
              <div class="flex min-w-0 items-start gap-1.5">
                <span class="shrink-0 pt-0.5 font-semibold text-xs uppercase tracking-wider opacity-40">
                  Audio
                </span>
                <div class="flex min-w-0 flex-wrap gap-1">
                  <For each={audioLangs()}>
                    {(lang) => (
                      <span class="whitespace-nowrap rounded-md border border-blue-500/25 bg-blue-500/15 px-2 py-0.5 font-medium text-blue-300 text-xs">
                        {lang?.toUpperCase() || "Unknown"}
                      </span>
                    )}
                  </For>
                  <Show when={audioLangs().length > 4}>
                    <span class="rounded-md border border-blue-500/15 bg-blue-500/10 px-2 py-0.5 font-medium text-blue-400 text-xs">
                      +{audioLangs().length - 4}
                    </span>
                  </Show>
                </div>
              </div>
            </Show>

            <Show when={subtitleLangs?.length}>
              <div class="flex min-w-0 items-start gap-1.5">
                <span class="shrink-0 pt-0.5 font-semibold text-xs uppercase tracking-wider opacity-40">
                  Subs
                </span>
                <div class="flex min-w-0 flex-wrap gap-1">
                  <For each={subtitleLangs()}>
                    {(lang) => (
                      <span class="whitespace-nowrap rounded-md border border-purple-500/25 bg-purple-500/15 px-2 py-0.5 font-medium text-purple-300 text-xs">
                        {lang?.toUpperCase() || "Unknown"}
                      </span>
                    )}
                  </For>
                  <Show when={subtitleLangs().length > 4}>
                    <span class="rounded-md border border-purple-500/15 bg-purple-500/10 px-2 py-0.5 font-medium text-purple-400 text-xs">
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
export function MainPageEpisodeCard(props: EpisodeCardProps) {
  const [{ item: initialItem }] = splitProps(props, ["item"]);

  const item = createEffectQuery(() => ({
    queryKey: ["getItem", { itemId: initialItem?.Id }],
    queryFn: () =>
      JellyfinService.pipe(
        Effect.flatMap((jf) => jf.getItem(initialItem?.Id as string))
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

  const playbackProgress = createMemo(() =>
    item.data.UserData?.PlaybackPositionTicks && item.data.RunTimeTicks
      ? (item.data.UserData.PlaybackPositionTicks / item.data.RunTimeTicks) *
        100
      : 0
  );

  const isWatched = createMemo(() => item.data.UserData?.Played);
  const isInProgress = createMemo(
    () => playbackProgress() > 0 && playbackProgress() < 95
  );

  const motion = createPosterMotion();

  return (
    <a
      class="group block"
      href={`/video/${item.data.Id}`}
      onMouseLeave={motion.onLeave}
      onMouseMove={motion.onMove}
    >
      <div class="poster-card-wrapper" style={motion.cardStyle()}>
        <GlassCard
          class="h-full overflow-hidden shadow-(--glass-shadow-md) transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-(--glass-shadow-lg)"
          preset="card"
        >
          <div class="relative aspect-video overflow-hidden">
            {/* Episode Image */}
            <Show
              fallback={
                <div class="flex h-full w-full items-center justify-center bg-linear-to-br from-[var(--glass-bg-medium)] to-[var(--glass-bg-subtle)]">
                  <span class="text-4xl opacity-25">
                    {item.data.Name?.charAt(0)}
                  </span>
                </div>
              }
              when={item.data.Image}
            >
              <img
                alt={item.data.Name ?? "Episode"}
                class="h-full w-full scale-110 object-cover transition-transform duration-700 ease-out group-hover:scale-100"
                loading="lazy"
                src={item.data.Image}
              />
            </Show>

            {/* Gradient overlay */}
            <div class="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent transition-all duration-300 group-hover:from-black/90 group-hover:via-black/50" />

            {/* Specular shine overlay — follows cursor */}
            <div
              class="pointer-events-none absolute inset-0 z-[5] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={motion.shineStyle()}
            />

            {/* Play Icon Overlay — refined */}
            <div class="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div class="scale-75 transform rounded-full border border-white/20 bg-white/10 p-3.5 backdrop-blur-sm transition-all duration-300 group-hover:scale-100 group-hover:border-white/30 group-hover:bg-white/15 group-hover:shadow-[0_0_24px_rgba(100,160,255,0.12)]">
                <Play class="h-7 w-7 fill-white text-white" />
              </div>
            </div>

            {/* Progress bar */}
            <Show when={isInProgress()}>
              <div class="absolute right-0 bottom-0 left-0 h-[3px] bg-black/40">
                <div
                  class="h-full rounded-r-full bg-blue-400 shadow-[0_0_6px_rgba(100,160,255,0.5)] transition-all duration-300"
                  style={{ width: `${playbackProgress()}%` }}
                />
              </div>
            </Show>

            {/* Episode number badge */}
            <Show when={item.data.IndexNumber}>
              <div class="absolute top-2 left-2 z-10 rounded-md border border-white/15 bg-black/55 px-2 py-0.5 font-semibold text-white/70 text-xs backdrop-blur-sm">
                E{item.data.IndexNumber}
              </div>
            </Show>

            {/* Watched indicator */}
            <Show when={isWatched()}>
              <div class="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md border border-white/15 bg-black/55 px-2 py-0.5 font-medium text-white/65 text-xs backdrop-blur-sm">
                <Check class="h-3 w-3 text-emerald-400" />
                <span>Watched</span>
              </div>
            </Show>

            {/* Item Actions - Show on hover */}
            <div class="absolute top-2 right-2 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <ItemActions
                item={item.data as WithImage<BaseItemDto>}
                itemId={item.data.Id as string}
                variant="card"
              />
            </div>

            {/* Runtime badge */}
            <Show when={runtimeMinutes}>
              <div class="absolute right-2 bottom-2 z-10 rounded-md bg-black/65 px-2 py-0.5 font-medium text-white/75 text-xs backdrop-blur-sm">
                {formatRuntime(runtimeMinutes)}
              </div>
            </Show>

            {/* Episode Info — metadata slides up on hover */}
            <div class="absolute right-0 bottom-0 left-0 p-3 transition-transform duration-300 ease-out group-hover:translate-y-[-2px]">
              <h3 class="line-clamp-2 font-semibold text-sm text-white drop-shadow-lg">
                {item.data.Name}
              </h3>
              <Show when={item.data.SeriesName}>
                <p class="mt-1 line-clamp-1 translate-y-1 text-white/55 text-xs opacity-0 drop-shadow-md transition-all delay-75 duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
                  {item.data.SeriesName}
                </p>
              </Show>
              <Show when={item.data.SeasonName && item.data.IndexNumber}>
                <p class="mt-0.5 translate-y-1 text-white/45 text-xs opacity-0 drop-shadow-md transition-all delay-100 duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
                  {item.data.SeasonName} • Episode {item.data.IndexNumber}
                </p>
              </Show>
            </div>
          </div>
        </GlassCard>
      </div>
    </a>
  );
}
