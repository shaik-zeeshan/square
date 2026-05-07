import { ItemFilter } from "@jellyfin/sdk/lib/generated-client";
import {
  type RouteSectionProps,
  useNavigate,
  useSearchParams,
} from "@solidjs/router";
import {
  AlertCircle,
  ArrowUp,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  Library as LibraryIcon,
  Play,
  RefreshCw,
  Star,
  Tv,
} from "lucide-solid";
import {
  createEffect,
  createSignal,
  For,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
  splitProps,
} from "solid-js";
import { ItemActions } from "~/components/ItemActions";
import { NormalizedEpisodeCard, NormalizedSeriesCard } from "~/components/media-card";
import { Nav } from "~/components/Nav";
import { QueryBoundary } from "~/components/query-boundary";
import { GlassButton } from "~/components/ui";
import { InlineLoading } from "~/components/ui/loading";
import {
  JellyfinCatalogueOperations,
  type JellyfinCatalogueOperationsType,
} from "~/effect/services/jellyfin/catalogue/operations";
import type { MediaItem } from "~/effect/services/jellyfin/catalogue/types";
import type { ExtractQueryData } from "~/effect/tanstack/query";

/**
 * Build a compact TV-context label from whichever series / season / episode
 * fields are available on the item, avoiding nested ternaries.
 */
function buildTvContextLabel(item: MediaItem): string {
  const parts: string[] = [];
  if (item.seriesName) parts.push(item.seriesName);
  if (item.seasonName) parts.push(item.seasonName);
  if (item.indexNumber != null) parts.push(`E${item.indexNumber}`);
  return parts.join(" · ");
}

const itemPageFilters = ["all", "unplayed", "played", "resumable"] as const;
type ItemPageFilter = (typeof itemPageFilters)[number];

const getItemPageFilter = (filter?: string): ItemPageFilter =>
  itemPageFilters.includes(filter as ItemPageFilter)
    ? (filter as ItemPageFilter)
    : "all";

const getItemFilterSearch = (filter: ItemPageFilter) =>
  filter === "all" ? "" : `?filter=${filter}`;

export default function Page(props: RouteSectionProps) {
  const [{ params }] = splitProps(props, ["params"]);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams<{
    filter?: string;
  }>();

  const [isOverviewExpanded, setIsOverviewExpanded] = createSignal(false);
  const [showScrollTop, setShowScrollTop] = createSignal(false);
  const [searchTerm, setSearchTerm] = createSignal("");
  const activeFilter = () => getItemPageFilter(searchParams.filter);
  const setActiveFilter = (filter: ItemPageFilter) => {
    setSearchParams(
      {
        filter: filter === "all" ? undefined : filter,
      },
      { replace: true }
    );
  };
  const itemFilterSearch = () => getItemFilterSearch(activeFilter());

  const parentLibrary = JellyfinCatalogueOperations.getItem(() => params.id, {
    fields: ["ParentId"],
  });

  const itemDetails = JellyfinCatalogueOperations.getItem(() => params.item_id, {
    fields: ["Overview", "Studios", "People", "MediaStreams"],
  });

  const childrens = JellyfinCatalogueOperations.getItems(() => {
    const filters: (typeof ItemFilter)[keyof typeof ItemFilter][] = [];
    const filter = activeFilter();
    if (filter === "unplayed") filters.push(ItemFilter.IsUnplayed);
    else if (filter === "played") filters.push(ItemFilter.IsPlayed);
    else if (filter === "resumable") filters.push(ItemFilter.IsResumable);

    return {
      parentId: params.item_id,
      fields: ["Overview", "MediaStreams"],
      searchTerm: searchTerm() || undefined,
      recursive: searchTerm() ? true : undefined,
      includeItemTypes: searchTerm() ? ["Season", "Episode"] : undefined,
      filters: filters.length > 0 ? filters : undefined,
    };
  });

  // Scroll to top handler
  let contentAreaRef!: HTMLDivElement;

  const scrollToTop = () => {
    if (contentAreaRef) {
      contentAreaRef.scrollTo({ top: 0, behavior: "smooth" });
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
      contentAreaRef.addEventListener("scroll", handleScroll);
      onCleanup(() =>
        contentAreaRef?.removeEventListener("scroll", handleScroll)
      );
    }
  });

  onMount(() => {
    document.body.style.setProperty("--item-color", "white");
  });

  onCleanup(() => {
    document.body.style.removeProperty("--item-color");
  });

  const getLibraryBackdropUrl = () => parentLibrary.data?.artwork.backdrop;

  /**
   * Pick the best backdrop URL from the enriched item data, falling back
   * to the parent library backdrop when the item has none.
   * If the chosen URL fails at runtime, we flip to the library backdrop.
   */
  const [backdropFailed, setBackdropFailed] = createSignal(false);

  // Reset backdrop failure state when navigating to a different item
  createEffect(() => {
    const _id = params.item_id; // track reactively
    setBackdropFailed(false);
  });

  const backdropUrl = () => {
    if (!backdropFailed()) {
      const enriched = itemDetails.data?.artwork.backdrop;
      if (enriched) return enriched;
    }
    return getLibraryBackdropUrl();
  };

  const handleBackdropError = (e: Event) => {
    const img = e.currentTarget as HTMLImageElement;
    // Only fallback once to avoid infinite loop when library backdrop also fails
    if (!backdropFailed() && img.src !== getLibraryBackdropUrl()) {
      setBackdropFailed(true);
    }
  };

  return (
    <section class="relative flex min-h-screen flex-col">
      {/* ── Cinematic backdrop ── */}
      <div class="fixed top-0 left-0 h-screen w-full">
        <img
          alt="Artwork"
          class="h-full w-full object-cover"
          onError={handleBackdropError}
          src={backdropUrl()}
        />
        {/* Multi-layer gradient — deep navy cinematic depth */}
        <div class="absolute inset-0 bg-gradient-to-b from-[#0a0e1a]/60 via-[#0a0e1a]/80 to-[#080c16]" />
        <div class="absolute inset-0 bg-gradient-to-r from-[#0a0e1a]/50 via-transparent to-transparent" />
        <div class="absolute inset-0 backdrop-blur-[2px]" />
      </div>

      {/* ── Error fallback ── */}
      <QueryBoundary
        errorFallback={(err, retry) => (
          <div
            class="relative z-10 flex h-screen w-full flex-col items-center justify-center gap-6"
            style={{
              animation: "fadeSlideUp 350ms cubic-bezier(0.22,1,0.36,1) both",
            }}
          >
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 ring-inset">
              <AlertCircle class="h-7 w-7 text-red-400" />
            </div>
            <div class="space-y-1 text-center">
              <p class="font-semibold text-white/80">Failed to load item</p>
              <p class="max-w-xs break-words text-red-400/70 text-sm">
                {err?.message}
              </p>
            </div>
            <button
              class="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-5 py-2.5 text-sm text-white/80 transition-all duration-150 hover:border-blue-400/40 hover:bg-blue-400/[0.08] hover:text-white active:scale-95"
              onClick={retry}
              type="button"
            >
              <RefreshCw class="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}
        loadingFallback={
          <div class="relative z-10 flex h-screen w-full items-center justify-center">
            <InlineLoading message="Loading…" size="lg" />
          </div>
        }
        query={itemDetails}
      >
        {(item) => (
          <div>
            {/* ── Navigation ── */}
            <Nav
              breadcrumbs={[
                {
                  label: (() => {
                    const itemType = item?.type;
                    if (itemType === "season" || itemType === "episode") {
                      return (
                        item?.seriesName || parentLibrary.data?.name || "Parent"
                      );
                    }
                    return parentLibrary.data?.name || "Library";
                  })(),
                  icon: <LibraryIcon class="h-4 w-4 shrink-0 opacity-70" />,
                  onClick: () => {
                    const itemType = item?.type;

                    if (itemType === "season" || itemType === "episode") {
                      const seriesID = item?.seriesId;
                      if (!seriesID) {
                        return;
                      }
                      // params.id is always the library id in this route
                      navigate(
                        `/library/${params.id}/item/${seriesID}${itemFilterSearch()}`
                      );
                    } else if (itemType === "movie") {
                      navigate(`/library/${params.id}`);
                    } else {
                      navigate(`/library/${params.id}`);
                    }
                  },
                },
              ]}
              class="relative z-50"
              currentPage={item?.name || "Loading..."}
              onSearchChange={setSearchTerm}
              searchValue={searchTerm()}
              showSearch={true}
            />

            {/* ── Main content ── */}
            <div
              class="relative z-20 flex-1 overflow-y-auto px-8 py-8 text-white"
              ref={contentAreaRef}
            >
              <div
                class="mx-auto flex h-full max-w-7xl flex-col"
                style={{
                  animation:
                    "fadeSlideUp 400ms cubic-bezier(0.22,1,0.36,1) both",
                }}
              >
                {/* ── Hero Section ── */}
                <div class="space-y-6">
                  {/* Logo or title */}
                  <Show
                    fallback={
                      <h1
                        class="font-bold text-4xl text-white tracking-tight drop-shadow-lg"
                        style={{
                          animation:
                            "fadeSlideUp 350ms 60ms cubic-bezier(0.22,1,0.36,1) both",
                        }}
                      >
                        {item?.name}
                      </h1>
                    }
                    when={
                      ["series", "movie"].includes(item?.type || "") &&
                      item?.artwork.logo
                    }
                  >
                    <div
                      class="max-w-sm"
                      style={{
                        animation:
                          "fadeSlideUp 350ms 60ms cubic-bezier(0.22,1,0.36,1) both",
                      }}
                    >
                      <img
                        alt={item?.name ?? ""}
                        class="h-auto w-full object-contain drop-shadow-2xl"
                        src={item?.artwork.logo as string}
                      />
                    </div>
                  </Show>

                  {/* ── Metadata chips ── */}
                  <div
                    class="flex flex-wrap items-center gap-2.5"
                    style={{
                      animation:
                        "fadeSlideUp 350ms 100ms cubic-bezier(0.22,1,0.36,1) both",
                    }}
                  >
                    <Show when={item?.communityRating}>
                      <div class="flex items-center gap-1.5 rounded-lg bg-blue-400/12 px-2.5 py-1 ring-1 ring-blue-400/25 ring-inset">
                        <Star class="h-3.5 w-3.5 fill-blue-400 text-blue-400" />
                        <span class="font-semibold text-blue-200 text-xs">
                          {item?.communityRating?.toFixed(1)}
                        </span>
                      </div>
                    </Show>

                    <Show when={item?.premiereDate}>
                      <div class="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1 ring-1 ring-white/[0.1] ring-inset">
                        <Calendar class="h-3.5 w-3.5 text-white/45" />
                        <span class="font-medium text-white/65 text-xs">
                          {new Date(item?.premiereDate || "").getFullYear()}
                        </span>
                      </div>
                    </Show>

                    <Show when={!item?.premiereDate && item?.year}>
                      <div class="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1 ring-1 ring-white/[0.1] ring-inset">
                        <Calendar class="h-3.5 w-3.5 text-white/45" />
                        <span class="font-medium text-white/65 text-xs">
                          {item?.year}
                        </span>
                      </div>
                    </Show>

                    <Show when={item?.runtimeTicks}>
                      <div class="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1 ring-1 ring-white/[0.1] ring-inset">
                        <Clock class="h-3.5 w-3.5 text-white/45" />
                        <span class="font-medium text-white/65 text-xs">
                          {Math.round((item?.runtimeTicks || 0) / 600_000_000)}{" "}
                          min
                        </span>
                      </div>
                    </Show>

                    <Show when={item?.officialRating}>
                      <div class="rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-1">
                        <span class="font-semibold text-white/55 text-xs tracking-wider">
                          {item?.officialRating}
                        </span>
                      </div>
                    </Show>

                    {/* TV context */}
                    <Show
                      when={
                        item?.seriesName ||
                        item?.seasonName ||
                        undefined != null ||
                        item?.indexNumber != null
                      }
                    >
                      <div class="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1 ring-1 ring-white/[0.1] ring-inset">
                        <Tv class="h-3.5 w-3.5 text-white/45" />
                        <span class="font-medium text-white/65 text-xs">
                          {buildTvContextLabel(item)}
                        </span>
                      </div>
                    </Show>

                    {/* Watch state */}
                    <Show when={item?.userData?.played}>
                      <div class="flex items-center gap-1.5 rounded-lg bg-emerald-400/12 px-2.5 py-1 ring-1 ring-emerald-400/25 ring-inset">
                        <Check class="h-3.5 w-3.5 text-emerald-400" />
                        <span class="font-semibold text-emerald-200 text-xs">
                          Watched
                        </span>
                      </div>
                    </Show>

                    <Show
                      when={
                        !item?.userData?.played &&
                        item?.userData?.playbackPositionTicks &&
                        item.userData.playbackPositionTicks > 0
                      }
                    >
                      <div class="flex items-center gap-1.5 rounded-lg bg-amber-400/12 px-2.5 py-1 ring-1 ring-amber-400/25 ring-inset">
                        <Play class="h-3.5 w-3.5 text-amber-400" />
                        <span class="font-semibold text-amber-200 text-xs">
                          {item?.userData?.playedPercentage != null &&
                          item.userData.playedPercentage > 0
                            ? `In Progress · ${Math.round(item.userData.playedPercentage)}%`
                            : "In Progress"}
                        </span>
                      </div>
                    </Show>
                  </div>

                  {/* ── Primary CTA ── */}
                  <div
                    class="flex items-center gap-3 pt-1"
                    style={{
                      animation:
                        "fadeSlideUp 350ms 140ms cubic-bezier(0.22,1,0.36,1) both",
                    }}
                  >
                    <ItemActions
                      item={item}
                      itemId={item.id || ""}
                      onDone={() => {
                        JellyfinCatalogueOperations.itemsQueryDataHelpers.invalidateAllQueries();
                      }}
                      variant="detail"
                    />
                  </div>

                  {/* ── Genre pills ── */}
                  <Show when={item?.genres?.length}>
                    <div
                      class="flex flex-wrap gap-1.5"
                      style={{
                        animation:
                          "fadeSlideUp 350ms 180ms cubic-bezier(0.22,1,0.36,1) both",
                      }}
                    >
                      <For each={item.genres?.slice(0, 5)}>
                        {(genre) => (
                          <span class="rounded-full border border-white/10 bg-white/[0.06] px-3 py-0.5 font-medium text-white/60 text-xs transition-all duration-150 hover:border-blue-400/30 hover:bg-blue-400/[0.08] hover:text-white/90">
                            {genre}
                          </span>
                        )}
                      </For>
                    </div>
                  </Show>

                  {/* ── Overview ── */}
                  <Show when={item?.overview}>
                    <div
                      class="max-w-2xl space-y-2 pt-1"
                      style={{
                        animation:
                          "fadeSlideUp 350ms 220ms cubic-bezier(0.22,1,0.36,1) both",
                      }}
                    >
                      <div class="flex items-center justify-between">
                        <h3 class="font-semibold text-blue-300/45 text-xs uppercase tracking-widest">
                          Overview
                        </h3>
                        <button
                          class="flex items-center gap-1 rounded-md px-2 py-0.5 text-white/40 text-xs transition-all duration-150 hover:bg-white/[0.06] hover:text-white/70"
                          onClick={() =>
                            setIsOverviewExpanded(!isOverviewExpanded())
                          }
                          type="button"
                        >
                          <Show
                            fallback={
                              <>
                                <span>More</span>
                                <ChevronDown class="h-3 w-3" />
                              </>
                            }
                            when={isOverviewExpanded()}
                          >
                            <span>Less</span>
                            <ChevronUp class="h-3 w-3" />
                          </Show>
                        </button>
                      </div>
                      <p
                        class={`text-sm text-white/65 leading-relaxed transition-all duration-300 ${
                          isOverviewExpanded() ? "" : "line-clamp-3"
                        }`}
                      >
                        {item?.overview}
                      </p>
                    </div>
                  </Show>

                  {/* ── Studio + Cast ── */}
                  <Show when={item?.studios?.length || item?.people?.length}>
                    <div
                      class="grid grid-cols-1 gap-3 pt-2 md:grid-cols-2"
                      style={{
                        animation:
                          "fadeSlideUp 350ms 260ms cubic-bezier(0.22,1,0.36,1) both",
                      }}
                    >
                      <Show when={item?.studios?.length}>
                        <div class="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-sm">
                          <h4 class="mb-2.5 font-semibold text-blue-300/50 text-xs uppercase tracking-widest">
                            Studio
                          </h4>
                          <p class="font-medium text-sm text-white/80">
                            {item?.studios?.join(", ")}
                          </p>
                        </div>
                      </Show>

                      <Show when={item?.people?.slice(0, 4).length}>
                        <div class="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-sm">
                          <h4 class="mb-2.5 font-semibold text-blue-300/50 text-xs uppercase tracking-widest">
                            Cast
                          </h4>
                          <div class="space-y-1.5">
                            <For each={item.people?.slice(0, 4)}>
                              {(person) => (
                                <div class="flex items-baseline gap-2 text-sm">
                                  <span class="truncate font-medium text-white/80">
                                    {person.name}
                                  </span>
                                  <Show when={person.role}>
                                    <span class="truncate text-white/35 text-xs">
                                      {person.role}
                                    </span>
                                  </Show>
                                </div>
                              )}
                            </For>
                          </div>
                        </div>
                      </Show>
                    </div>
                  </Show>
                </div>

                {/* ── Children / Content Section ── */}
                <div
                  class="mt-14 flex-1 border-blue-400/[0.08] border-t pt-8"
                  style={{
                    animation:
                      "fadeSlideUp 400ms 300ms cubic-bezier(0.22,1,0.36,1) both",
                  }}
                >
                  <QueryBoundary
                    errorFallback={(err, retry) => (
                      <div class="flex flex-col items-center gap-4 rounded-xl border border-red-500/[0.15] bg-red-500/[0.04] px-6 py-10 text-center">
                        <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500/[0.12] ring-1 ring-red-500/[0.2] ring-inset">
                          <AlertCircle class="h-5 w-5 text-red-400" />
                        </div>
                        <div class="space-y-1">
                          <p class="font-medium text-sm text-white/70">
                            Failed to load content
                          </p>
                          <p class="text-red-400/70 text-xs">{err?.message}</p>
                        </div>
                        <button
                          class="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.07] px-4 py-2 text-sm text-white/80 transition-all duration-150 hover:border-blue-400/40 hover:bg-blue-400/[0.08] hover:text-white active:scale-95"
                          onClick={retry}
                          type="button"
                        >
                          <RefreshCw class="h-3.5 w-3.5" />
                          Retry
                        </button>
                      </div>
                    )}
                    loadingFallback={
                      <div class="flex items-center justify-center py-16">
                        <InlineLoading message="Loading content…" size="md" />
                      </div>
                    }
                    notFoundFallback={
                      <ItemsRender
                        activeFilter={activeFilter()}
                        items={[]}
                        onFilterChange={setActiveFilter}
                        parentId={params.id}
                        parentItem={item}
                      />
                    }
                    notStartedFallback={
                      <ItemsRender
                        activeFilter={activeFilter()}
                        items={[]}
                        onFilterChange={setActiveFilter}
                        parentId={params.id}
                        parentItem={item}
                      />
                    }
                    query={childrens}
                  >
                    {(items) => (
                      <ItemsRender
                        activeFilter={activeFilter()}
                        items={items}
                        onFilterChange={setActiveFilter}
                        parentId={params.id}
                        parentItem={item}
                      />
                    )}
                  </QueryBoundary>
                </div>
              </div>
            </div>
          </div>
        )}
      </QueryBoundary>

      {/* ── Scroll to top ── */}
      <Show when={showScrollTop()}>
        <GlassButton
          class="fade-in slide-in-from-bottom-4 fixed right-8 bottom-8 z-50 animate-in text-white shadow-xl"
          onClick={scrollToTop}
          size="icon-lg"
        >
          <ArrowUp class="h-5 w-5" />
        </GlassButton>
      </Show>
    </section>
  );
}

interface ItemsRenderProsp {
  parentItem: ExtractQueryData<ReturnType<JellyfinCatalogueOperationsType["getItem"]>>;
  items:
    | ExtractQueryData<ReturnType<JellyfinCatalogueOperationsType["getItems"]>>
    | undefined;
  parentId: string;
  activeFilter: ItemPageFilter;
  onFilterChange: (filter: ItemPageFilter) => void;
}

const FilterButton = (props: {
  filter: ItemsRenderProsp["activeFilter"];
  label: string;
  activeFilter: ItemsRenderProsp["activeFilter"];
  onFilterChange: ItemsRenderProsp["onFilterChange"];
}) => (
  <button
    class={`rounded-full px-3 py-1 font-medium text-xs transition-all duration-150 ${
      props.activeFilter === props.filter
        ? "border border-blue-400/40 bg-blue-400/15 text-blue-200 shadow-[0_0_12px_rgba(96,165,250,0.15)]"
        : "border border-white/[0.08] bg-white/[0.05] text-white/50 hover:border-white/20 hover:bg-white/10 hover:text-white/80"
    }`}
    onClick={() => props.onFilterChange(props.filter)}
    type="button"
  >
    {props.label}
  </button>
);

function ItemsRender(props: ItemsRenderProsp) {
  const [{ parentItem, items, parentId, activeFilter, onFilterChange }] =
    splitProps(props, [
      "parentItem",
      "items",
      "parentId",
      "activeFilter",
      "onFilterChange",
    ]);

  return (
    <Switch
      fallback={
        <div class="flex flex-col items-center gap-3 py-16 text-center">
          <p class="font-medium text-sm text-white/40">Nothing to show here</p>
        </div>
      }
    >
      <Match when={!parentItem}>
        <div class="flex flex-col items-center gap-3 py-16 text-center">
          <p class="font-medium text-sm text-white/40">Item not found</p>
        </div>
      </Match>
      <Match when={!parentItem?.type}>
        <div class="flex flex-col items-center gap-3 py-16 text-center">
          <p class="font-medium text-sm text-white/40">No content available</p>
        </div>
      </Match>

      <Match when={parentItem?.type === "series"}>
        <div class="space-y-6">
          {/* Section header */}
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-baseline gap-2">
              <h2 class="font-semibold text-lg text-white/90">Seasons</h2>
              <span class="font-medium text-white/35 text-xs">
                {items?.length} {items?.length === 1 ? "Season" : "Seasons"}
              </span>
            </div>

            <div class="flex items-center gap-1.5">
              <Filter class="h-3.5 w-3.5 text-white/30" />
              <FilterButton
                activeFilter={activeFilter}
                filter="all"
                label="All"
                onFilterChange={onFilterChange}
              />
              <FilterButton
                activeFilter={activeFilter}
                filter="unplayed"
                label="Unwatched"
                onFilterChange={onFilterChange}
              />
              <FilterButton
                activeFilter={activeFilter}
                filter="played"
                label="Watched"
                onFilterChange={onFilterChange}
              />
              <FilterButton
                activeFilter={activeFilter}
                filter="resumable"
                label="In Progress"
                onFilterChange={onFilterChange}
              />
            </div>
          </div>

          {/* Empty state */}
          <Show when={!items?.length}>
            <div class="flex flex-col items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] py-16 text-center">
              <p class="font-medium text-sm text-white/40">No seasons found</p>
              <p class="text-white/25 text-xs">Try changing the filter above</p>
            </div>
          </Show>

          <div class="grid grid-cols-3 gap-6 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            <For each={items}>
              {(item) => (
                <NormalizedSeriesCard
                  item={item}
                  parentId={parentId}
                  search={getItemFilterSearch(activeFilter)}
                />
              )}
            </For>
          </div>
        </div>
      </Match>

      <Match when={parentItem?.type === "movie"}>
        <div class="space-y-5">
          <h2 class="font-semibold text-lg text-white/90">Watch Movie</h2>
          <NormalizedEpisodeCard item={parentItem} />
        </div>
      </Match>

      <Match when={parentItem?.type === "season"}>
        <div class="space-y-6">
          {/* Section header */}
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-baseline gap-2">
              <h2 class="font-semibold text-lg text-white/90">Episodes</h2>
              <span class="font-medium text-white/35 text-xs">
                {items?.length} {items?.length === 1 ? "Episode" : "Episodes"}
              </span>
            </div>

            <div class="flex items-center gap-1.5">
              <Filter class="h-3.5 w-3.5 text-white/30" />
              <FilterButton
                activeFilter={activeFilter}
                filter="all"
                label="All"
                onFilterChange={onFilterChange}
              />
              <FilterButton
                activeFilter={activeFilter}
                filter="unplayed"
                label="Unwatched"
                onFilterChange={onFilterChange}
              />
              <FilterButton
                activeFilter={activeFilter}
                filter="played"
                label="Watched"
                onFilterChange={onFilterChange}
              />
              <FilterButton
                activeFilter={activeFilter}
                filter="resumable"
                label="In Progress"
                onFilterChange={onFilterChange}
              />
            </div>
          </div>

          {/* Empty state */}
          <Show when={!items?.length}>
            <div class="flex flex-col items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] py-16 text-center">
              <p class="font-medium text-sm text-white/40">No episodes found</p>
              <p class="text-white/25 text-xs">Try changing the filter above</p>
            </div>
          </Show>

          <div class="space-y-4">
            <For each={items}>{(item) => <NormalizedEpisodeCard item={item} />}</For>
          </div>
        </div>
      </Match>
    </Switch>
  );
}
