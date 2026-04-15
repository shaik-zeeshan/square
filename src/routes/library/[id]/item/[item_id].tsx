import {
  ItemFilter,
  type ItemsApiGetItemsRequest,
} from "@jellyfin/sdk/lib/generated-client";
import {
  type RouteSectionProps,
  useNavigate,
  useSearchParams,
} from "@solidjs/router";
import { Effect } from "effect";
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
import { create } from "mutative";
import {
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
import { EpisodeCard, SeriesCard } from "~/components/media-card";
import { Nav } from "~/components/Nav";
import { QueryBoundary } from "~/components/query-boundary";
import { GlassButton } from "~/components/ui";
import { InlineLoading } from "~/components/ui/loading";
import { useRuntime } from "~/effect/runtime/use-runtime";
import { AuthService } from "~/effect/services/auth";
import {
  JellyfinOperations,
  type JellyfinOperationsType,
} from "~/effect/services/jellyfin/operations";
import { JellyfinService } from "~/effect/services/jellyfin/service";
import {
  createEffectQuery,
  type ExtractQueryData,
} from "~/effect/tanstack/query";

/**
 * Build a compact TV-context label from whichever series / season / episode
 * fields are available on the item, avoiding nested ternaries.
 */
function buildTvContextLabel(item: {
  SeriesName?: string | null;
  SeasonName?: string | null;
  ParentIndexNumber?: number | null;
  IndexNumber?: number | null;
}): string {
  const parts: string[] = [];
  if (item.SeriesName) {
    parts.push(item.SeriesName);
  }
  // Season context: prefer the explicit name, fall back to the numeric index
  if (item.SeasonName) {
    parts.push(item.SeasonName);
  } else if (item.ParentIndexNumber != null) {
    parts.push(`Season ${item.ParentIndexNumber}`);
  }
  // Episode number
  if (item.IndexNumber != null) {
    parts.push(`E${item.IndexNumber}`);
  }
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
  const runtime = useRuntime();
  const jf = runtime.runSync(
    Effect.gen(function* () {
      const auth = yield* AuthService;
      const api = yield* auth.getApi();
      return { api };
    })
  );

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

  const parentLibrary = JellyfinOperations.getItem(() => params.id, {
    fields: ["ParentId"],
  });

  const itemDetails = JellyfinOperations.getItem(
    () => params.item_id,
    {
      fields: ["Overview", "Studios", "People"],
    },
    () => ({
      enabled: !!parentLibrary.data?.Id,
    })
  );

  const childrens = createEffectQuery(() => ({
    queryKey: JellyfinOperations.itemsQueryKey({
      parentId: params.item_id,
      searchTerm: `${searchTerm()}::${activeFilter()}`,
    }),
    queryFn: () =>
      Effect.gen(function* () {
        const parentId = params.item_id;
        const client = yield* JellyfinService;

        const filters: (typeof ItemFilter)[keyof typeof ItemFilter][] = [];
        const filter = activeFilter();
        if (filter === "unplayed") {
          filters.push(ItemFilter.IsUnplayed);
        } else if (filter === "played") {
          filters.push(ItemFilter.IsPlayed);
        } else if (filter === "resumable") {
          filters.push(ItemFilter.IsResumable);
        }

        const itemsParams: ItemsApiGetItemsRequest = create(
          {
            parentId,
            fields: ["Overview", "MediaStreams"],
          } as ItemsApiGetItemsRequest,
          (data) => {
            if (searchTerm()) {
              data.searchTerm = searchTerm();
              data.recursive = true;
              data.includeItemTypes = ["Season", "Episode"];
            }

            data.filters = filters.length > 0 ? filters : undefined;
          }
        );

        const items = yield* client.getItems(itemsParams);
        if (!items || items.length === 0) {
          return [];
        }

        items.forEach((item) =>
          JellyfinOperations.itemQueryDataHelpers.setData(
            { id: item.Id as string },
            item
          )
        );

        return items;
      }),
    enabled: !!itemDetails.data?.ChildCount && itemDetails.data.ChildCount > 0,
  }));

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

  const getImage = (id: string) =>
    `${jf.api.basePath}/Items/${id}/Images/Backdrop?quality=10`;

  return (
    <section class="relative flex min-h-screen flex-col">
      {/* ── Cinematic backdrop ── */}
      <div class="fixed top-0 left-0 h-screen w-full">
        <img
          alt="Backdrop"
          class="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.src = getImage(params.id);
          }}
          src={getImage(params.item_id)}
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
                    const itemType = item?.Type;
                    if (itemType === "Season" || itemType === "Episode") {
                      return (
                        item?.SeriesName || parentLibrary.data?.Name || "Parent"
                      );
                    }
                    return parentLibrary.data?.Name || "Library";
                  })(),
                  icon: <LibraryIcon class="h-4 w-4 shrink-0 opacity-70" />,
                  onClick: () => {
                    const itemType = item?.Type;

                    if (itemType === "Season" || itemType === "Episode") {
                      const seriesID = item?.SeriesId;
                      if (!seriesID) {
                        return;
                      }
                      // params.id is always the library id in this route
                      navigate(
                        `/library/${params.id}/item/${seriesID}${itemFilterSearch()}`
                      );
                    } else if (itemType === "Movie") {
                      navigate(`/library/${params.id}`);
                    } else {
                      navigate(`/library/${params.id}`);
                    }
                  },
                },
              ]}
              class="relative z-50"
              currentPage={item?.Name || "Loading..."}
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
                        {item?.Name}
                      </h1>
                    }
                    when={
                      ["Series", "Movie"].includes(item?.Type || "") &&
                      item?.Images?.Logo
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
                        alt={item?.Name ?? ""}
                        class="h-auto w-full object-contain drop-shadow-2xl"
                        src={item?.Images?.Logo as string}
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
                    <Show when={item?.CommunityRating}>
                      <div class="flex items-center gap-1.5 rounded-lg bg-blue-400/12 px-2.5 py-1 ring-1 ring-blue-400/25 ring-inset">
                        <Star class="h-3.5 w-3.5 fill-blue-400 text-blue-400" />
                        <span class="font-semibold text-blue-200 text-xs">
                          {item?.CommunityRating?.toFixed(1)}
                        </span>
                      </div>
                    </Show>

                    <Show when={item?.PremiereDate}>
                      <div class="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1 ring-1 ring-white/[0.1] ring-inset">
                        <Calendar class="h-3.5 w-3.5 text-white/45" />
                        <span class="font-medium text-white/65 text-xs">
                          {new Date(item?.PremiereDate || "").getFullYear()}
                        </span>
                      </div>
                    </Show>

                    <Show when={!item?.PremiereDate && item?.ProductionYear}>
                      <div class="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1 ring-1 ring-white/[0.1] ring-inset">
                        <Calendar class="h-3.5 w-3.5 text-white/45" />
                        <span class="font-medium text-white/65 text-xs">
                          {item?.ProductionYear}
                        </span>
                      </div>
                    </Show>

                    <Show when={item?.RunTimeTicks}>
                      <div class="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1 ring-1 ring-white/[0.1] ring-inset">
                        <Clock class="h-3.5 w-3.5 text-white/45" />
                        <span class="font-medium text-white/65 text-xs">
                          {Math.round((item?.RunTimeTicks || 0) / 600_000_000)}{" "}
                          min
                        </span>
                      </div>
                    </Show>

                    <Show when={item?.OfficialRating}>
                      <div class="rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-1">
                        <span class="font-semibold text-white/55 text-xs tracking-wider">
                          {item?.OfficialRating}
                        </span>
                      </div>
                    </Show>

                    {/* TV context */}
                    <Show
                      when={
                        item?.SeriesName ||
                        item?.SeasonName ||
                        item?.ParentIndexNumber != null ||
                        item?.IndexNumber != null
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
                    <Show when={item?.UserData?.Played}>
                      <div class="flex items-center gap-1.5 rounded-lg bg-emerald-400/12 px-2.5 py-1 ring-1 ring-emerald-400/25 ring-inset">
                        <Check class="h-3.5 w-3.5 text-emerald-400" />
                        <span class="font-semibold text-emerald-200 text-xs">
                          Watched
                        </span>
                      </div>
                    </Show>

                    <Show
                      when={
                        !item?.UserData?.Played &&
                        item?.UserData?.PlaybackPositionTicks &&
                        item.UserData.PlaybackPositionTicks > 0
                      }
                    >
                      <div class="flex items-center gap-1.5 rounded-lg bg-amber-400/12 px-2.5 py-1 ring-1 ring-amber-400/25 ring-inset">
                        <Play class="h-3.5 w-3.5 text-amber-400" />
                        <span class="font-semibold text-amber-200 text-xs">
                          {item?.UserData?.PlayedPercentage != null &&
                          item.UserData.PlayedPercentage > 0
                            ? `In Progress · ${Math.round(item.UserData.PlayedPercentage)}%`
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
                      itemId={item.Id || ""}
                      onDone={() => {
                        JellyfinOperations.itemsQueryDataHelpers.invalidateAllQueries();
                      }}
                      variant="detail"
                    />
                  </div>

                  {/* ── Genre pills ── */}
                  <Show when={item?.Genres?.length}>
                    <div
                      class="flex flex-wrap gap-1.5"
                      style={{
                        animation:
                          "fadeSlideUp 350ms 180ms cubic-bezier(0.22,1,0.36,1) both",
                      }}
                    >
                      <For each={item.Genres?.slice(0, 5)}>
                        {(genre) => (
                          <span class="rounded-full border border-white/10 bg-white/[0.06] px-3 py-0.5 font-medium text-white/60 text-xs transition-all duration-150 hover:border-blue-400/30 hover:bg-blue-400/[0.08] hover:text-white/90">
                            {genre}
                          </span>
                        )}
                      </For>
                    </div>
                  </Show>

                  {/* ── Overview ── */}
                  <Show when={item?.Overview}>
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
                        {item?.Overview}
                      </p>
                    </div>
                  </Show>

                  {/* ── Studio + Cast ── */}
                  <Show when={item?.Studios?.length || item?.People?.length}>
                    <div
                      class="grid grid-cols-1 gap-3 pt-2 md:grid-cols-2"
                      style={{
                        animation:
                          "fadeSlideUp 350ms 260ms cubic-bezier(0.22,1,0.36,1) both",
                      }}
                    >
                      <Show when={item?.Studios?.length}>
                        <div class="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-sm">
                          <h4 class="mb-2.5 font-semibold text-blue-300/50 text-xs uppercase tracking-widest">
                            Studio
                          </h4>
                          <p class="font-medium text-sm text-white/80">
                            {item?.Studios?.map((s) => s.Name).join(", ")}
                          </p>
                        </div>
                      </Show>

                      <Show when={item?.People?.slice(0, 4).length}>
                        <div class="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-sm">
                          <h4 class="mb-2.5 font-semibold text-blue-300/50 text-xs uppercase tracking-widest">
                            Cast
                          </h4>
                          <div class="space-y-1.5">
                            <For each={item.People?.slice(0, 4)}>
                              {(person) => (
                                <div class="flex items-baseline gap-2 text-sm">
                                  <span class="truncate font-medium text-white/80">
                                    {person.Name}
                                  </span>
                                  <Show when={person.Role}>
                                    <span class="truncate text-white/35 text-xs">
                                      {person.Role}
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
  parentItem: ExtractQueryData<ReturnType<JellyfinOperationsType["getItem"]>>;
  items:
    | ExtractQueryData<ReturnType<JellyfinOperationsType["getItems"]>>
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
      <Match when={!parentItem?.Type}>
        <div class="flex flex-col items-center gap-3 py-16 text-center">
          <p class="font-medium text-sm text-white/40">No content available</p>
        </div>
      </Match>

      <Match when={parentItem?.Type === "Series"}>
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
                <SeriesCard
                  item={item}
                  parentId={parentId}
                  search={getItemFilterSearch(activeFilter)}
                />
              )}
            </For>
          </div>
        </div>
      </Match>

      <Match when={parentItem?.Type === "Movie"}>
        <div class="space-y-5">
          <h2 class="font-semibold text-lg text-white/90">Watch Movie</h2>
          <EpisodeCard item={parentItem} />
        </div>
      </Match>

      <Match when={parentItem?.Type === "Season"}>
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
            <For each={items}>{(item) => <EpisodeCard item={item} />}</For>
          </div>
        </div>
      </Match>
    </Switch>
  );
}
