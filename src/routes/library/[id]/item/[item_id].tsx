import { RouteSectionProps, useNavigate } from '@solidjs/router';
import {
  ChevronDown,
  ChevronUp,
  ArrowUp,
  Star,
  Calendar,
  Clock,
  Library as LibraryIcon,
  Filter,
} from 'lucide-solid';
import {
  For,
  Match,
  Show,
  splitProps,
  Switch,
  createSignal,
  onMount,
  onCleanup,
} from 'solid-js';
import { useGeneralInfo } from '~/components/current-user-provider';
import { EpisodeCard, SeriesCard } from '~/components/media-card';
import { QueryBoundary } from '~/components/query-boundary';
import { Nav } from '~/components/Nav';
import library from '~/lib/jellyfin/library';
import { createJellyFinQuery } from '~/lib/utils';
import { GlassButton } from '~/components/ui';
import { ItemFilter } from '@jellyfin/sdk/lib/generated-client';

export default function Page(props: RouteSectionProps) {
  let [{ params }] = splitProps(props, ['params']);
  const navigate = useNavigate();

  const { store } = useGeneralInfo();
  const [isOverviewExpanded, setIsOverviewExpanded] = createSignal(false);
  const [showScrollTop, setShowScrollTop] = createSignal(false);
  const [searchTerm, setSearchTerm] = createSignal('');
  const [activeFilter, setActiveFilter] = createSignal<
    'all' | 'unplayed' | 'played' | 'resumable'
  >('all');

  const itemDetails = createJellyFinQuery(() => ({
    queryKey: [
      library.query.getItem.key,
      library.query.getItem.keyFor(params.item_id, store?.user?.Id),
    ],
    queryFn: async (jf) =>
      library.query.getItem(jf, params.item_id, store?.user?.Id, [
        'Overview',
        'Studios',
        'People',
      ]),
  }));

  const parentLibrary = createJellyFinQuery(() => ({
    queryKey: [
      library.query.getItem.key,
      library.query.getItem.keyFor(params.id, store?.user?.Id),
    ],
    queryFn: async (jf) =>
      library.query.getItem(jf, params.id, store?.user?.Id, ['ParentId']),
  }));

  const childrens = createJellyFinQuery(() => ({
    queryKey: [
      library.query.getItems.key,
      library.query.getItems.keyFor(params.item_id, store?.user?.Id),
      searchTerm(),
      activeFilter(),
    ],
    queryFn: async (jf) => {
      let parentId = params.item_id;

      // Note: We can't safely access itemDetails.data here since we're outside QueryBoundary
      // This query will be enabled/disabled based on itemDetails data in the QueryBoundary

      // Map filter state to Jellyfin filters
      const filters: Array<(typeof ItemFilter)[keyof typeof ItemFilter]> = [];
      const filter = activeFilter();
      if (filter === 'unplayed') filters.push(ItemFilter.IsUnplayed);
      else if (filter === 'played') filters.push(ItemFilter.IsPlayed);
      else if (filter === 'resumable') filters.push(ItemFilter.IsResumable);

      let seasons = await library.query.getItems(jf, {
        parentId: parentId,
        userId: store?.user?.Id,
        fields: ['Overview', 'MediaStreams'],
        enableImage: true,
        ...(searchTerm() && {
          searchTerm: searchTerm(),
          recursive: true,
          includeItemTypes: ['Season', 'Episode'],
        }),
        filters: filters.length > 0 ? filters : undefined,
      });

      if (!seasons || seasons.length === 0) return [];

      return seasons;
    },
    enabled:
      !!parentLibrary.data?.ChildCount && parentLibrary.data.ChildCount > 0, // Will be enabled conditionally in QueryBoundary
  }));

  // Scroll to top handler
  let contentAreaRef: HTMLDivElement | undefined;

  const scrollToTop = () => {
    if (contentAreaRef) {
      contentAreaRef.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Show/hide scroll to top button
  onMount(() => {
    const handleScroll = () => {
      if (contentAreaRef) {
        setShowScrollTop(contentAreaRef.scrollTop > 400);
      }
    };

    if (contentAreaRef) {
      contentAreaRef.addEventListener('scroll', handleScroll);
      onCleanup(() =>
        contentAreaRef?.removeEventListener('scroll', handleScroll)
      );
    }
  });

  return (
    <section class="relative min-h-screen flex flex-col">
      <QueryBoundary
        query={itemDetails}
        loadingFallback={
          <div class="w-full h-full flex items-center justify-center">
            <div class="text-white">Loading item details...</div>
          </div>
        }
        errorFallback={(err, retry) => (
          <div class="w-full h-full flex items-center justify-center">
            <div class="text-center">
              <div class="text-red-400 mb-4">
                Error loading item: {err?.message}
              </div>
              <button
                onClick={retry}
                class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      >
        {(item) => (
          <>
            {/* Background with enhanced overlay */}
            <div class="fixed top-0 left-0 w-full h-screen">
              <img
                src={item?.Backdrop?.[0]}
                alt={item?.Name ?? ''}
                class="w-full h-full object-cover"
              />
              <div class="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black/90" />
              <div class="absolute inset-0 backdrop-blur-sm" />
            </div>

            {/* Navigation Bar */}
            <Nav
              class="relative z-50"
              breadcrumbs={[
                {
                  label: (() => {
                    const itemType = item?.Type;
                    // For Season, show Series name; for Episode, show Season name; otherwise show Library name
                    if (itemType === 'Season' || itemType === 'Episode') {
                      return (
                        item?.SeriesName || parentLibrary.data?.Name || 'Parent'
                      );
                    }
                    return parentLibrary.data?.Name || 'Library';
                  })(),
                  icon: (
                    <LibraryIcon class="w-4 h-4 opacity-70 flex-shrink-0" />
                  ),
                  onClick: () => {
                    const parentId = parentLibrary.data?.ParentId;
                    const itemType = item?.Type;

                    if (!parentId) return;

                    // If current item is Season or Episode, navigate to parent item page
                    // If current item is Series or Movie, navigate to library page
                    if (itemType === 'Season' || itemType === 'Episode') {
                      let seriesID = item?.SeriesId;
                      navigate(`/library/${parentId}/item/${seriesID}`);
                    } else {
                      navigate(`/library/${params.id}`);
                    }
                  },
                },
              ]}
              currentPage={item?.Name || 'Loading...'}
              showSearch={true}
              searchValue={searchTerm()}
              onSearchChange={setSearchTerm}
            />

            <div
              ref={contentAreaRef}
              class="relative z-20 text-white px-8 py-8 flex-1 overflow-y-auto"
            >
              <div class="flex flex-col max-w-7xl mx-auto">
                {/* Hero Section */}
                <div class="space-y-4">
                  <Show when={['Series', 'Movie'].includes(item?.Type || '')}>
                    <div class="max-w-xs">
                      <img
                        src={item?.Images?.Logo}
                        alt={item?.Name ?? ''}
                        class="w-full h-auto object-contain drop-shadow-xl"
                      />
                    </div>
                  </Show>

                  <Show when={!item?.Images?.Logo}>
                    <h1 class="text-2xl font-bold tracking-tight">
                      {item?.Name}
                    </h1>
                  </Show>

                  {/* Metadata Section - Compact style */}
                  <div class="flex flex-wrap items-center gap-2 text-xs">
                    <Show when={item?.CommunityRating}>
                      <div class="flex items-center gap-1 bg-yellow-500/20 px-2 py-0.5 rounded-md">
                        <Star class="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                        <span class="font-semibold text-yellow-400">
                          {item?.CommunityRating?.toFixed(1)}
                        </span>
                      </div>
                    </Show>

                    <Show when={item?.PremiereDate}>
                      <div class="flex items-center gap-1 opacity-70">
                        <Calendar class="w-3.5 h-3.5" />
                        <span class="font-medium">
                          {new Date(item?.PremiereDate!).getFullYear()}
                        </span>
                      </div>
                    </Show>

                    <Show when={item?.RunTimeTicks}>
                      <div class="flex items-center gap-1 opacity-70">
                        <Clock class="w-3.5 h-3.5" />
                        <span class="font-medium">
                          {Math.round((item?.RunTimeTicks || 0) / 600000000)}{' '}
                          min
                        </span>
                      </div>
                    </Show>

                    <Show when={item?.OfficialRating}>
                      <div class="px-2 py-0.5 rounded-md border border-white/30">
                        <span class="font-semibold">
                          {item?.OfficialRating}
                        </span>
                      </div>
                    </Show>
                  </div>

                  {/* Genres - Compact pills */}
                  <Show when={item?.Genres?.length}>
                    <div class="flex flex-wrap gap-1.5">
                      {item?.Genres?.slice(0, 4).map((genre) => (
                        <span class="px-2.5 py-0.5 rounded-full bg-white/10 text-xs font-medium hover:bg-white/15 transition-colors">
                          {genre}
                        </span>
                      ))}
                    </div>
                  </Show>

                  {/* Synopsis Section - Refined */}
                  <Show when={item?.Overview}>
                    <div class="space-y-2 pt-2">
                      <div class="flex items-center justify-between">
                        <h3 class="font-semibold opacity-70">Overview</h3>
                        <button
                          onClick={() =>
                            setIsOverviewExpanded(!isOverviewExpanded())
                          }
                          class="flex text-sm items-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <Show
                            when={isOverviewExpanded()}
                            fallback={
                              <>
                                <span>More</span>
                                <ChevronDown class="w-3 h-3" />
                              </>
                            }
                          >
                            <span>Less</span>
                            <ChevronUp class="w-3 h-3" />
                          </Show>
                        </button>
                      </div>
                      <p
                        class={`text-sm leading-relaxed opacity-70 transition-all duration-300 ${
                          isOverviewExpanded() ? '' : 'line-clamp-3'
                        }`}
                      >
                        {item?.Overview}
                      </p>
                    </div>
                  </Show>

                  {/* Additional Info - Compact Cards */}
                  <Show when={item?.Studios?.length || item?.People?.length}>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <Show when={item?.Studios?.length}>
                        <div class="p-3 rounded-lg bg-white/5 border border-white/10">
                          <h4 class="text-xs font-semibold opacity-50 mb-2 uppercase tracking-wider">
                            Studio
                          </h4>
                          <p class="text-sm font-medium">
                            {item?.Studios?.map((s) => s.Name).join(', ')}
                          </p>
                        </div>
                      </Show>

                      <Show when={item?.People?.slice(0, 4).length}>
                        <div class="p-3 rounded-lg bg-white/5 border border-white/10">
                          <h4 class="text-xs font-semibold opacity-50 mb-2 uppercase tracking-wider">
                            Cast
                          </h4>
                          <div class="space-y-1.5">
                            {item?.People?.slice(0, 4).map((person) => (
                              <div class="flex items-baseline gap-2 text-sm">
                                <span class="font-medium truncate">
                                  {person.Name}
                                </span>
                                <Show when={person.Role}>
                                  <span class="text-xs opacity-50 truncate">
                                    {person.Role}
                                  </span>
                                </Show>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Show>
                    </div>
                  </Show>
                </div>

                {/* Content Section */}
                <div class="mt-12 pt-8 border-t border-white/10">
                  <QueryBoundary
                    query={childrens}
                    errorFallback={(err) => (
                      <div class="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                        <div class="text-red-400 text-sm">
                          Error: {err?.message}
                        </div>
                      </div>
                    )}
                    notStartedFallback={
                      <ItemsRender
                        parentItem={item}
                        items={[]}
                        parentId={params.item_id}
                        activeFilter={activeFilter()}
                        onFilterChange={setActiveFilter}
                      />
                    }
                  >
                    {(items) => (
                      <ItemsRender
                        parentItem={item}
                        items={items}
                        parentId={params.item_id}
                        activeFilter={activeFilter()}
                        onFilterChange={setActiveFilter}
                      />
                    )}
                  </QueryBoundary>
                </div>
              </div>
            </div>
          </>
        )}
      </QueryBoundary>

      {/* Scroll to Top Button */}
      <Show when={showScrollTop()}>
        <GlassButton
          variant="glass"
          size="icon-lg"
          onClick={scrollToTop}
          class="fixed bottom-8 right-8 z-50 text-white animate-in fade-in slide-in-from-bottom-4"
        >
          <ArrowUp class="w-6 h-6" />
        </GlassButton>
      </Show>
    </section>
  );
}

interface ItemsRenderProsp {
  parentItem: Awaited<ReturnType<typeof library.query.getItem>> | undefined;
  items: Awaited<ReturnType<typeof library.query.getItems>> | undefined;
  parentId: string;
  activeFilter: 'all' | 'unplayed' | 'played' | 'resumable';
  onFilterChange: (filter: 'all' | 'unplayed' | 'played' | 'resumable') => void;
}

function ItemsRender({
  parentItem,
  items,
  parentId,
  activeFilter,
  onFilterChange,
}: ItemsRenderProsp) {
  const FilterButton = (props: {
    filter: typeof activeFilter;
    label: string;
  }) => (
    <button
      onClick={() => onFilterChange(props.filter)}
      class={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
        activeFilter === props.filter
          ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
          : 'bg-white/5 border border-white/10 hover:bg-white/10'
      }`}
    >
      {props.label}
    </button>
  );

  return (
    <Switch>
      <Match when={!parentItem?.Type}>
        <></>
      </Match>
      <Match when={parentItem?.Type === 'Series'}>
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-baseline gap-2">
              <h2 class="text-lg font-semibold">Seasons</h2>
              <span class="text-xs opacity-50 font-medium">
                {items?.length} {items?.length === 1 ? 'Season' : 'Seasons'}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <Filter class="w-4 h-4 opacity-50" />
              <FilterButton filter="all" label="All" />
              <FilterButton filter="unplayed" label="Unwatched" />
              <FilterButton filter="played" label="Watched" />
              <FilterButton filter="resumable" label="In Progress" />
            </div>
          </div>
          <div class="grid 2xl:grid-cols-6 xl:grid-cols-5 lg:grid-cols-4 grid-cols-3 gap-6">
            <For each={items}>
              {(item) => <SeriesCard item={item} parentId={parentId} />}
            </For>
          </div>
        </div>
      </Match>

      <Match when={parentItem?.Type === 'Movie'}>
        <div class="space-y-4">
          <h2 class="text-lg font-semibold">Watch Movie</h2>
          <EpisodeCard item={parentItem} />
        </div>
      </Match>

      <Match when={parentItem?.Type === 'Season'}>
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-baseline gap-2">
              <h2 class="text-lg font-semibold">Episodes</h2>
              <span class="text-xs opacity-50 font-medium">
                {items?.length} {items?.length === 1 ? 'Episode' : 'Episodes'}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <Filter class="w-4 h-4 opacity-50" />
              <FilterButton filter="all" label="All" />
              <FilterButton filter="unplayed" label="Unwatched" />
              <FilterButton filter="played" label="Watched" />
              <FilterButton filter="resumable" label="In Progress" />
            </div>
          </div>
          <div class="space-y-4">
            <For each={items}>{(item) => <EpisodeCard item={item} />}</For>
          </div>
        </div>
      </Match>
    </Switch>
  );
}
