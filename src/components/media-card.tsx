import { Check, Play } from "lucide-solid";
import {
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
  splitProps,
} from "solid-js";
import type { MediaItem } from "~/effect/services/jellyfin/catalogue/types";
import { prefersReducedMotion } from "~/lib/anime-utils";
import { getLanguageLabel } from "~/lib/playback-language-preferences";
import { ItemActions } from "./ItemActions";
import { GlassCard } from "./ui";

const MAX_LANG_CHIPS = 4;

/** Shared language-chip row used by episode card variants. */
function LanguageChips(props: {
  label: string;
  langs: (string | null | undefined)[];
  borderColor: string;
  bgColor: string;
  textColor: string;
  mutedBorder: string;
  mutedBg: string;
  mutedText: string;
}) {
  const visible = () => props.langs.slice(0, MAX_LANG_CHIPS);
  const overflow = () => Math.max(0, props.langs.length - MAX_LANG_CHIPS);
  return (
    <Show when={props.langs.length > 0}>
      <div class="flex min-w-0 items-start gap-1.5">
        <span class="shrink-0 pt-0.5 font-semibold text-xs uppercase tracking-wider opacity-40">
          {props.label}
        </span>
        <div class="flex min-w-0 flex-wrap gap-1">
          <For each={visible()}>
            {(lang) => (
              <span
                class={`whitespace-nowrap rounded-md border px-2 py-0.5 font-medium text-xs ${props.borderColor} ${props.bgColor} ${props.textColor}`}
              >
                {getLanguageLabel(lang)}
              </span>
            )}
          </For>
          <Show when={overflow() > 0}>
            <span
              class={`rounded-md border px-2 py-0.5 font-medium text-xs ${props.mutedBorder} ${props.mutedBg} ${props.mutedText}`}
            >
              +{overflow()}
            </span>
          </Show>
        </div>
      </div>
    </Show>
  );
}

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

type NormalizedSeriesCardProps = {
  item: MediaItem;
  parentId?: string;
  search?: string;
};

export function NormalizedSeriesCard(props: NormalizedSeriesCardProps) {
  const [{ item, parentId, search }] = splitProps(props, [
    "item",
    "parentId",
    "search",
  ]);
  const motion = createPosterMotion();
  const href = () => `/library/${parentId || item.parentId}/item/${item.id}${search || ""}`;

  return (
    <a
      class="group block"
      href={href()}
      onMouseLeave={motion.onLeave}
      onMouseMove={motion.onMove}
    >
      <div class="poster-card-wrapper" style={motion.cardStyle()}>
        <GlassCard
          class="h-full overflow-hidden transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-(--glass-shadow-xl)"
          preset="card"
        >
          <div class="relative aspect-2/3 overflow-hidden">
            <Show
              fallback={
                <div class="flex h-full w-full items-center justify-center bg-linear-to-br from-[var(--glass-bg-medium)] to-[var(--glass-bg-subtle)]">
                  <span class="text-4xl opacity-25">{item.name.charAt(0)}</span>
                </div>
              }
              when={item.artwork.primary}
            >
              {(image) => (
                <img
                  alt={item.name}
                  class="h-full w-full scale-110 object-cover transition-transform duration-700 ease-out group-hover:scale-100"
                  loading="lazy"
                  src={image()}
                />
              )}
            </Show>
            <div class="absolute inset-0 bg-linear-to-t from-black/85 via-black/15 to-transparent transition-all duration-300 group-hover:from-black/90 group-hover:via-black/45" />
            <div
              class="pointer-events-none absolute inset-0 z-[5] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={motion.shineStyle()}
            />
            <div class="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-400/0 to-transparent transition-all duration-300 group-hover:via-blue-400/30" />
            <div class="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div class="scale-75 transform rounded-full border border-white/20 bg-white/10 p-3.5 backdrop-blur-sm transition-all duration-300 group-hover:scale-100 group-hover:border-white/30 group-hover:bg-white/15 group-hover:shadow-[0_0_24px_rgba(100,160,255,0.12)]">
                <Play class="h-6 w-6 fill-white text-white" />
              </div>
            </div>
            <Show when={(item.userData.unplayedItemCount ?? 0) > 0}>
              <div class="absolute top-2 right-2 z-10 rounded-md border border-blue-400/25 bg-blue-400/15 px-2 py-0.5 font-bold text-blue-200 text-xs shadow-lg backdrop-blur-sm">
                {item.userData.unplayedItemCount}
              </div>
            </Show>
            <Show when={item.userData.played}>
              <div class="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md border border-white/15 bg-black/55 px-2 py-0.5 font-medium text-white/65 text-xs backdrop-blur-sm">
                <Check class="h-3 w-3 text-emerald-400" />
                <span>Watched</span>
              </div>
            </Show>
            <div class="absolute top-2 right-2 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <ItemActions item={item} itemId={item.id} variant="card" />
            </div>
            <div class="absolute right-0 bottom-0 left-0 p-3.5 transition-transform duration-300 ease-out group-hover:translate-y-[-2px]">
              <p class="line-clamp-2 font-semibold text-sm text-white drop-shadow-lg">
                {item.name}
              </p>
              <Show when={item.year}>
                <p class="mt-1 translate-y-1 text-white/50 text-xs opacity-0 drop-shadow-md transition-all delay-75 duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
                  {item.year}
                </p>
              </Show>
            </div>
          </div>
        </GlassCard>
      </div>
    </a>
  );
}

// Compact episode card for home-page rails such as Next Up.
// Intentionally distinct from the list-style season/movie detail card below.
export function MainPageEpisodeCard(props: { item: MediaItem }) {
  const item = () => props.item;

  if (item().locationType !== "FileSystem") {
    return null;
  }

  const runtimeMinutes = item().runtimeTicks
    ? Math.round((item().runtimeTicks ?? 0) / 600_000_000)
    : null;

  const formatRuntime = (minutes: number | null) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const playbackProgress = createMemo(() =>
    item().userData.playbackPositionTicks && item().runtimeTicks
      ? ((item().userData.playbackPositionTicks ?? 0) /
          (item().runtimeTicks ?? 1)) *
        100
      : 0
  );

  const isWatched = createMemo(() => item().userData.played);
  const isInProgress = createMemo(
    () => playbackProgress() > 0 && playbackProgress() < 95
  );

  const motion = createPosterMotion();

  return (
    <a
      class="group block"
      href={`/video/${item().id}`}
      onMouseLeave={motion.onLeave}
      onMouseMove={motion.onMove}
    >
      <div class="poster-card-wrapper" style={motion.cardStyle()}>
        <GlassCard
          class="h-full overflow-hidden shadow-(--glass-shadow-md) transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-(--glass-shadow-lg)"
          preset="card"
        >
          <div class="relative aspect-video overflow-hidden">
            <Show
              fallback={
                <div class="flex h-full w-full items-center justify-center bg-linear-to-br from-[var(--glass-bg-medium)] to-[var(--glass-bg-subtle)]">
                  <span class="text-4xl opacity-25">
                    {item().name.charAt(0)}
                  </span>
                </div>
              }
              when={item().artwork.primary}
            >
              {(image) => (
                <img
                  alt={item().name ?? "Episode"}
                  class="h-full w-full scale-110 object-cover transition-transform duration-700 ease-out group-hover:scale-100"
                  loading="lazy"
                  src={image()}
                />
              )}
            </Show>

            <div class="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent transition-all duration-300 group-hover:from-black/90 group-hover:via-black/50" />
            <div
              class="pointer-events-none absolute inset-0 z-[5] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={motion.shineStyle()}
            />
            <div class="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div class="scale-75 transform rounded-full border border-white/20 bg-white/10 p-3.5 backdrop-blur-sm transition-all duration-300 group-hover:scale-100 group-hover:border-white/30 group-hover:bg-white/15 group-hover:shadow-[0_0_24px_rgba(100,160,255,0.12)]">
                <Play class="h-7 w-7 fill-white text-white" />
              </div>
            </div>

            <Show when={isInProgress()}>
              <div class="absolute right-0 bottom-0 left-0 h-[3px] bg-black/40">
                <div
                  class="h-full rounded-r-full bg-blue-400 shadow-[0_0_6px_rgba(100,160,255,0.5)] transition-all duration-300"
                  style={{ width: `${playbackProgress()}%` }}
                />
              </div>
            </Show>

            <Show when={item().indexNumber}>
              <div class="absolute top-2 left-2 z-10 rounded-md border border-white/15 bg-black/55 px-2 py-0.5 font-semibold text-white/70 text-xs backdrop-blur-sm">
                E{item().indexNumber}
              </div>
            </Show>

            <Show when={isWatched()}>
              <div class="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md border border-white/15 bg-black/55 px-2 py-0.5 font-medium text-white/65 text-xs backdrop-blur-sm">
                <Check class="h-3 w-3 text-emerald-400" />
                <span>Watched</span>
              </div>
            </Show>

            <div class="absolute top-2 right-2 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <ItemActions item={item()} itemId={item().id} variant="card" />
            </div>

            <Show when={runtimeMinutes}>
              <div class="absolute right-2 bottom-2 z-10 rounded-md bg-black/65 px-2 py-0.5 font-medium text-white/75 text-xs backdrop-blur-sm">
                {formatRuntime(runtimeMinutes)}
              </div>
            </Show>

            <div class="absolute right-0 bottom-0 left-0 p-3 transition-transform duration-300 ease-out group-hover:translate-y-[-2px]">
              <h3 class="line-clamp-2 font-semibold text-sm text-white drop-shadow-lg">
                {item().name}
              </h3>
              <Show when={item().seriesName}>
                <p class="mt-1 line-clamp-1 translate-y-1 text-white/55 text-xs opacity-0 drop-shadow-md transition-all delay-75 duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
                  {item().seriesName}
                </p>
              </Show>
              <Show when={item().seasonName && item().indexNumber}>
                <p class="mt-0.5 translate-y-1 text-white/45 text-xs opacity-0 drop-shadow-md transition-all delay-100 duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
                  {item().seasonName} • Episode {item().indexNumber}
                </p>
              </Show>
            </div>
          </div>
        </GlassCard>
      </div>
    </a>
  );
}

// List-style episode/movie card for season and movie detail pages.
export function NormalizedEpisodeCard(props: { item: MediaItem }) {
  const item = () => props.item;

  if (item().locationType !== "FileSystem") {
    return null;
  }

  const runtimeMinutes = item().runtimeTicks
    ? Math.round((item().runtimeTicks ?? 0) / 600_000_000)
    : null;

  const formatRuntime = (minutes: number | null) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const playbackProgress = createMemo(() =>
    item().userData.playbackPositionTicks && item().runtimeTicks
      ? ((item().userData.playbackPositionTicks ?? 0) / (item().runtimeTicks ?? 1)) * 100
      : 0
  );
  const isWatched = createMemo(() => item().userData.played);
  const isInProgress = createMemo(
    () => playbackProgress() > 0 && playbackProgress() < 95
  );

  return (
    <a
      aria-label={`Play ${item().name}${runtimeMinutes ? ` (${formatRuntime(runtimeMinutes)})` : ""}`}
      class="group block"
      href={`/video/${item().id}`}
      role="link"
      tabIndex={0}
    >
      <div class="flex gap-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 transition-all duration-300 hover:border-white/[0.14] hover:bg-white/[0.06]">
        <Show when={item().indexNumber}>
          <div class="relative flex w-12 shrink-0 items-center justify-center">
            <div class="font-bold text-4xl opacity-25 transition-opacity group-hover:opacity-45">
              {item().indexNumber}
            </div>
          </div>
        </Show>

        <div class="relative aspect-video w-64 shrink-0 overflow-hidden rounded-xl">
          <Show
            fallback={
              <div class="flex h-full w-full items-center justify-center bg-linear-to-br from-[var(--glass-bg-medium)] to-[var(--glass-bg-subtle)]">
                <span class="text-4xl opacity-25">{item().name.charAt(0)}</span>
              </div>
            }
            when={item().artwork.primary}
          >
            {(image) => (
              <img
                alt={item().name}
                class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                src={image()}
              />
            )}
          </Show>
          <div class="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          <div class="absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div class="rounded-full border border-white/25 bg-white/10 p-3 backdrop-blur-sm">
              <Play class="h-6 w-6 fill-white text-white" />
            </div>
          </div>

          <Show when={isInProgress()}>
            <div class="absolute right-0 bottom-0 left-0 z-10 h-[3px] bg-black/40">
              <div
                class="h-full rounded-r-full bg-blue-400 shadow-[0_0_6px_rgba(100,160,255,0.5)] transition-all duration-300"
                style={{ width: `${playbackProgress()}%` }}
              />
            </div>
          </Show>

          <div class="absolute top-2 right-2 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <ItemActions item={item()} itemId={item().id} variant="card" />
          </div>

          <Show when={runtimeMinutes}>
            <div class="absolute right-2 bottom-2 z-10 rounded-md bg-black/65 px-1.5 py-0.5 font-medium text-white/75 text-xs backdrop-blur-sm">
              {formatRuntime(runtimeMinutes)}
            </div>
          </Show>

          <Show when={isWatched()}>
            <div class="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md border border-white/15 bg-black/55 px-2 py-0.5 font-medium text-white/65 text-xs backdrop-blur-sm">
              <Check class="h-3 w-3 text-emerald-400" />
            </div>
          </Show>
        </div>

        <div class="flex min-w-0 flex-1 flex-col justify-center gap-2 overflow-hidden">
          <div class="min-w-0">
            <Show when={item().type === "episode"}>
              <span class="mb-0.5 block truncate font-semibold text-xs uppercase tracking-wide opacity-50">
                {item().seasonName}
              </span>
            </Show>
            <h3 class="line-clamp-1 font-bold text-lg transition-colors group-hover:text-white">
              {item().name}
            </h3>
          </div>

          <p class="line-clamp-3 text-sm leading-relaxed opacity-60">
            {item().overview}
          </p>

          <div class="mt-0.5 flex flex-wrap items-start gap-2">
            <LanguageChips
              bgColor="bg-blue-500/15"
              borderColor="border-blue-500/25"
              label="Audio"
              langs={item().trackSummary.audioLanguages}
              mutedBg="bg-blue-500/10"
              mutedBorder="border-blue-500/15"
              mutedText="text-blue-400"
              textColor="text-blue-300"
            />
            <LanguageChips
              bgColor="bg-purple-500/15"
              borderColor="border-purple-500/25"
              label="Subs"
              langs={item().trackSummary.subtitleLanguages}
              mutedBg="bg-purple-500/10"
              mutedBorder="border-purple-500/15"
              mutedText="text-purple-400"
              textColor="text-purple-300"
            />
          </div>
        </div>
      </div>
    </a>
  );
}

