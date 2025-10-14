import { Show } from 'solid-js';
import library from '~/lib/jellyfin/library';
import { cn } from '~/lib/utils';
import { GlassCard } from './ui';
import { Play, Check, Circle } from 'lucide-solid';
import { createMemo } from 'solid-js';

interface SeriesCardProps {
  item: Awaited<ReturnType<typeof library.query.getItem>>;
  parentId?: string;
}

export function SeriesCard({ item, parentId }: SeriesCardProps) {
  return (
    <a
      href={`/library/${parentId || item.ParentId}/item/${item.Id}`}
      class="block group"
    >
      <GlassCard
        preset="card"
        class="overflow-hidden h-full transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-[var(--glass-shadow-xl)]"
      >
        <div class="relative aspect-[2/3] overflow-hidden">
          {/* Image fills entire card */}
          <img
            src={
              'Primary' in item.Images
                ? item.Images.Primary
                : 'https://placehold.co/300x442?text=No+Image'
            }
            alt={item.Name ?? 'Media item'}
            class="w-full h-full object-cover scale-110 group-hover:scale-100 transition-transform duration-700 ease-out"
          />

          {/* Gradient overlay - always visible, darkens on hover */}
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:from-black/90 group-hover:via-black/50 transition-all duration-300" />

          {/* Play Icon Overlay */}
          <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div class="bg-white/20 border border-white/30 rounded-full p-4 transform scale-75 group-hover:scale-100 transition-transform duration-300">
              <Play class="w-8 h-8 text-white fill-white" />
            </div>
          </div>

          {/* Unplayed Item Count Badge */}
          <Show
            when={
              item.UserData?.UnplayedItemCount &&
              item.UserData.UnplayedItemCount > 0
            }
          >
            <div class="absolute top-3 right-3 bg-blue-500 text-white text-xs font-bold px-2.5 py-1.5 rounded-full shadow-lg z-10 border-2 border-white/30">
              {item.UserData!.UnplayedItemCount}
            </div>
          </Show>

          {/* Played Indicator */}
          <Show when={item.UserData?.Played}>
            <div class="absolute top-3 left-3 bg-green-500/90 text-white text-xs font-semibold px-2.5 py-1.5 rounded-full shadow-lg z-10 flex items-center gap-1 border border-white/20">
              <Check class="w-3 h-3" />
              <span>Watched</span>
            </div>
          </Show>

          {/* Title Info - always visible at bottom */}
          <div class="absolute bottom-0 left-0 right-0 p-4">
            <p class="text-white text-sm font-semibold line-clamp-2 drop-shadow-lg">
              {item.Name}
            </p>
            <Show when={item.ProductionYear}>
              <p class="text-white/80 text-xs mt-1 drop-shadow-md">
                {item.ProductionYear}
              </p>
            </Show>
          </div>
        </div>
      </GlassCard>
    </a>
  );
}

interface EpisodeCardProps {
  item: Awaited<ReturnType<typeof library.query.getItem>> | undefined;
}

export function EpisodeCard({ item }: EpisodeCardProps) {
  if (item?.LocationType !== 'FileSystem') {
    return;
  }

  const audioLangs = createMemo(() =>
    Array.from(
      new Set(
        item?.MediaStreams?.filter((stream) => stream.Type === 'Audio').map(
          (stream) => stream.Language
        )
      )
    )
  );

  const subtitleLangs = createMemo(() =>
    Array.from(
      new Set(
        item?.MediaStreams?.filter((stream) => stream.Type === 'Subtitle').map(
          (stream) => stream.Language
        )
      )
    )
  );

  const runtimeMinutes = item.RunTimeTicks
    ? Math.round(item.RunTimeTicks / 600000000)
    : null;

  // Format runtime as hours and minutes if >= 60 minutes
  const formatRuntime = (minutes: number | null) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Calculate playback progress percentage
  const playbackProgress =
    item.UserData?.PlaybackPositionTicks && item.RunTimeTicks
      ? (item.UserData.PlaybackPositionTicks / item.RunTimeTicks) * 100
      : 0;

  const isWatched = item.UserData?.Played;
  const isInProgress = playbackProgress > 0 && playbackProgress < 95;

  return (
    <a
      href={item.LocationType === 'FileSystem' ? `/video/${item.Id}` : ''}
      class="block group"
      aria-disabled={item.LocationType !== 'FileSystem'}
      aria-label={`Play ${item.Name ?? 'Episode'}${runtimeMinutes ? ` (${formatRuntime(runtimeMinutes)})` : ''}`}
      role={item.LocationType === 'FileSystem' ? 'link' : 'button'}
      tabIndex={item.LocationType === 'FileSystem' ? 0 : -1}
    >
      <div class="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 overflow-hidden">
        {/* Episode Number Badge */}
        <Show when={item.IndexNumber}>
          <div class="flex-shrink-0 w-12 flex items-center justify-center relative">
            <div class="text-4xl font-bold opacity-30 group-hover:opacity-50 transition-opacity">
              {item.IndexNumber}
            </div>
          </div>
        </Show>

        {/* Thumbnail */}
        <div class="w-64 flex-shrink-0 rounded-xl overflow-hidden relative aspect-video">
          <img
            src={item.Images['Primary']}
            alt={item.Name ?? 'Episode'}
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Play button overlay */}
          <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
            <div class="bg-white/20 border border-white/30 rounded-full p-3">
              <Play class="w-6 h-6 text-white fill-white" />
            </div>
          </div>

          {/* Progress bar */}
          <Show when={isInProgress}>
            <div class="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-10">
              <div
                class="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${playbackProgress}%` }}
              />
            </div>
          </Show>

          {/* Runtime badge */}
          <Show when={runtimeMinutes}>
            <div class="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded-md text-xs font-medium text-white z-10">
              {formatRuntime(runtimeMinutes)}
            </div>
          </Show>

          {/* Watched overlay */}
          <Show when={isWatched}>
            <div class="absolute top-2 right-2 bg-green-500/90 rounded-full p-1 z-10 border border-white/30">
              <Check class="w-3.5 h-3.5 text-white" />
            </div>
          </Show>
        </div>

        {/* Episode Info */}
        <div class="flex-1 flex flex-col justify-center gap-2 min-w-0 overflow-hidden">
          <div class="min-w-0">
            <Show when={item.Type === 'Episode'}>
              <span class="block text-xs opacity-60 font-semibold uppercase tracking-wide mb-0.5 truncate">
                {item.SeasonName}
              </span>
            </Show>
            <h3 class="text-lg font-bold group-hover:text-white transition-colors line-clamp-1">
              {item.Name}
            </h3>
          </div>

          <p class="text-sm opacity-70 line-clamp-3 leading-relaxed">
            {item.Overview}
          </p>

          {/* Audio & Subtitle Badges */}
          <div class="flex flex-wrap items-start gap-2 mt-0.5">
            <Show when={audioLangs?.length}>
              <div class="flex items-start gap-1.5 min-w-0">
                <span class="text-xs font-semibold opacity-50 uppercase tracking-wider flex-shrink-0 pt-0.5">
                  Audio
                </span>
                <div class="flex flex-wrap gap-1 min-w-0">
                  {audioLangs()
                    .slice(0, 4)
                    .map((lang: string | null | undefined) => (
                      <span class="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-xs font-medium border border-blue-500/30 whitespace-nowrap">
                        {lang?.toUpperCase() || 'Unknown'}
                      </span>
                    ))}
                  <Show when={audioLangs().length > 4}>
                    <span class="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">
                      +{audioLangs().length - 4}
                    </span>
                  </Show>
                </div>
              </div>
            </Show>

            <Show when={subtitleLangs?.length}>
              <div class="flex items-start gap-1.5 min-w-0">
                <span class="text-xs font-semibold opacity-50 uppercase tracking-wider flex-shrink-0 pt-0.5">
                  Subs
                </span>
                <div class="flex flex-wrap gap-1 min-w-0">
                  {subtitleLangs()
                    .slice(0, 4)
                    .map((lang: string | null | undefined) => (
                      <span class="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-xs font-medium border border-purple-500/30 whitespace-nowrap">
                        {lang?.toUpperCase() || 'Unknown'}
                      </span>
                    ))}
                  <Show when={subtitleLangs().length > 4}>
                    <span class="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 text-xs font-medium border border-purple-500/20">
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
export function MainPageEpisodeCard({ item }: EpisodeCardProps) {
  if (!item || item.LocationType !== 'FileSystem') {
    return null;
  }

  const runtimeMinutes = item.RunTimeTicks
    ? Math.round(item.RunTimeTicks / 600000000)
    : null;

  // Format runtime as hours and minutes if >= 60 minutes
  const formatRuntime = (minutes: number | null) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Calculate playback progress percentage
  const playbackProgress =
    item.UserData?.PlaybackPositionTicks && item.RunTimeTicks
      ? (item.UserData.PlaybackPositionTicks / item.RunTimeTicks) * 100
      : 0;

  const isWatched = item.UserData?.Played;
  const isInProgress = playbackProgress > 0 && playbackProgress < 95;

  return (
    <a
      href={`/video/${item.Id}`}
      class="group block"
    >
      <GlassCard
        preset="card"
        class="overflow-hidden h-full transition-all duration-300 group-hover:scale-[1.02] shadow-[var(--glass-shadow-md)] group-hover:shadow-[var(--glass-shadow-lg)]"
      >
        <div class="relative aspect-[16/9] overflow-hidden">
          {/* Episode Image */}
          <Show
            when={item.Images?.Primary}
            fallback={
              <div class="w-full h-full bg-gradient-to-br from-[var(--glass-bg-medium)] to-[var(--glass-bg-subtle)] flex items-center justify-center">
                <span class="text-4xl opacity-30">
                  {item.Name?.charAt(0)}
                </span>
              </div>
            }
          >
            <img
              src={item.Images.Primary}
              alt={item.Name ?? 'Episode'}
              class="w-full h-full object-cover scale-110 group-hover:scale-100 transition-transform duration-700 ease-out"
            />
          </Show>

          {/* Gradient overlay */}
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:from-black/90 group-hover:via-black/50 transition-all duration-300" />

          {/* Play Icon Overlay */}
          <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div class="bg-white/20 border border-white/30 rounded-full p-4 transform scale-75 group-hover:scale-100 transition-transform duration-300">
              <Play class="w-8 h-8 text-white fill-white" />
            </div>
          </div>

          {/* Progress bar */}
          <Show when={isInProgress}>
            <div class="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
              <div
                class="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${playbackProgress}%` }}
              />
            </div>
          </Show>

          {/* Episode number badge */}
          <Show when={item.IndexNumber}>
            <div class="absolute top-3 left-3 bg-blue-500/90 text-white text-sm font-bold px-2.5 py-1 rounded-full shadow-lg z-10 border border-white/30">
              E{item.IndexNumber}
            </div>
          </Show>

          {/* Watched indicator */}
          <Show when={isWatched}>
            <div class="absolute top-3 right-3 bg-green-500/90 text-white text-xs font-semibold px-2.5 py-1.5 rounded-full shadow-lg z-10 flex items-center gap-1 border border-white/20">
              <Check class="w-3 h-3" />
              <span>Watched</span>
            </div>
          </Show>

          {/* Runtime badge */}
          <Show when={runtimeMinutes}>
            <div class="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded-md text-xs font-medium text-white z-10">
              {formatRuntime(runtimeMinutes)}
            </div>
          </Show>

          {/* Episode Info */}
          <div class="absolute bottom-0 left-0 right-0 p-3">
            <h3 class="text-white text-sm font-semibold line-clamp-2 drop-shadow-lg">
              {item.Name}
            </h3>
            <Show when={item.SeriesName}>
              <p class="text-white/80 text-xs mt-1 drop-shadow-md line-clamp-1">
                {item.SeriesName}
              </p>
            </Show>
            <Show when={item.SeasonName && item.IndexNumber}>
              <p class="text-white/70 text-xs mt-0.5 drop-shadow-md">
                {item.SeasonName} • Episode {item.IndexNumber}
              </p>
            </Show>
          </div>
        </div>
      </GlassCard>
    </a>
  );
}
