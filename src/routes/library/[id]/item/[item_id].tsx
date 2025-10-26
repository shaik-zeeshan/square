import {
  ItemFilter,
  type ItemsApiGetItemsRequest,
} from "@jellyfin/sdk/lib/generated-client";
import { type RouteSectionProps, useNavigate } from "@solidjs/router";
import { Effect } from "effect";
import {
  ArrowUp,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  Library as LibraryIcon,
  Star,
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

  const [isOverviewExpanded, setIsOverviewExpanded] = createSignal(false);
  const [showScrollTop, setShowScrollTop] = createSignal(false);
  const [searchTerm, setSearchTerm] = createSignal("");
  const [activeFilter, setActiveFilter] = createSignal<
    "all" | "unplayed" | "played" | "resumable"
  >("all");

  const itemDetails = JellyfinOperations.getItem(
    () => params.item_id,
    {
      fields: ["Overview", "Studios", "People"],
    },
    () => ({
      staleTime: 0,
    })
  );

  const parentLibrary = JellyfinOperations.getItem(() => params.id, {
    fields: ["ParentId"],
  });

  const childrens = createEffectQuery(() => ({
    queryKey: JellyfinOperations.itemsQueryKey({
      parentId: params.item_id,
      searchItem: [searchTerm(), activeFilter()],
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
    enabled:
      !!parentLibrary.data?.ChildCount && parentLibrary.data.ChildCount > 0, // Will be enabled conditionally in QueryBoundary
  }));
  //

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
      <div class="fixed top-0 left-0 h-screen w-full">
        <img
          alt={"Backdrop Imaage"}
          class="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.src = getImage(params.id);
          }}
          src={getImage(params.item_id)}
        />
        <div class="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black/90" />
        <div class="absolute inset-0 backdrop-blur-sm" />
      </div>
      <QueryBoundary
        errorFallback={(err, retry) => (
          <div class="flex h-full w-full items-center justify-center">
            <div class="text-center">
              <div class="mb-4 text-red-400">
                Error loading item: {err?.message}
              </div>
              <button
                class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
                onClick={retry}
              >
                Retry
              </button>
            </div>
          </div>
        )}
        loadingFallback={
          <div class="flex h-full w-full items-center justify-center">
            <div class="text-white">Loading item details...</div>
          </div>
        }
        query={itemDetails}
      >
        {(item) => (
          <>
            {/* Background with enhanced overlay */}
            {/* <div class="fixed top-0 left-0 h-screen w-full"> */}
            {/*   <img */}
            {/*     alt={item?.Name ?? ""} */}
            {/*     class="h-full w-full object-cover" */}
            {/*     src={ */}
            {/*       ["Movie", "Series"].includes(item?.Type as string) */}
            {/*         ? item?.Image */}
            {/*         : parentLibrary.data?.Image */}
            {/*     } */}
            {/*   /> */}
            {/*   <div class="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black/90" /> */}
            {/*   <div class="absolute inset-0 backdrop-blur-sm" /> */}
            {/* </div> */}
            {/**/}
            {/* Navigation Bar */}
            <Nav
              breadcrumbs={[
                {
                  label: (() => {
                    const itemType = item?.Type;
                    // For Season, show Series name; for Episode, show Season name; otherwise show Library name
                    if (itemType === "Season" || itemType === "Episode") {
                      return (
                        item?.SeriesName || parentLibrary.data?.Name || "Parent"
                      );
                    }
                    return parentLibrary.data?.Name || "Library";
                  })(),
                  icon: (
                    <LibraryIcon class="h-4 w-4 flex-shrink-0 opacity-70" />
                  ),
                  onClick: () => {
                    const parentId = parentLibrary.data?.ParentId;
                    const itemType = item?.Type;

                    if (!parentId) {
                      return;
                    }

                    // If current item is Season or Episode, navigate to parent item page
                    // If current item is Series or Movie, navigate to library page
                    if (itemType === "Season" || itemType === "Episode") {
                      const seriesID = item?.SeriesId;
                      navigate(`/library/${parentId}/item/${seriesID}`);
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

            <div
              class="relative z-20 flex-1 px-8 py-8 text-white"
              ref={contentAreaRef}
            >
              <div class="mx-auto flex h-full max-w-7xl flex-col">
                {/* Hero Section */}
                <div class="space-y-4">
                  <Show when={["Series", "Movie"].includes(item?.Type || "")}>
                    <div class="max-w-xs">
                      <img
                        alt={item?.Name ?? ""}
                        class="h-auto w-full object-contain drop-shadow-xl"
                        src={item?.Images?.Logo as string}
                      />
                    </div>
                  </Show>

                  <Show when={!item?.Images?.Logo}>
                    <h1 class="font-bold text-2xl tracking-tight">
                      {item?.Name}
                    </h1>
                  </Show>

                  {/* Metadata Section - Compact style */}
                  <div class="flex flex-wrap items-center gap-2 text-xs">
                    <Show when={item?.CommunityRating}>
                      <div class="flex items-center gap-1 rounded-md bg-yellow-500/20 px-2 py-0.5">
                        <Star class="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        <span class="font-semibold text-yellow-400">
                          {item?.CommunityRating?.toFixed(1)}
                        </span>
                      </div>
                    </Show>

                    <Show when={item?.PremiereDate}>
                      <div class="flex items-center gap-1 opacity-70">
                        <Calendar class="h-3.5 w-3.5" />
                        <span class="font-medium">
                          {new Date(item?.PremiereDate || "").getFullYear()}
                        </span>
                      </div>
                    </Show>

                    <Show when={item?.RunTimeTicks}>
                      <div class="flex items-center gap-1 opacity-70">
                        <Clock class="h-3.5 w-3.5" />
                        <span class="font-medium">
                          {Math.round((item?.RunTimeTicks || 0) / 600_000_000)}{" "}
                          min
                        </span>
                      </div>
                    </Show>

                    <Show when={item?.OfficialRating}>
                      <div class="rounded-md border border-white/30 px-2 py-0.5">
                        <span class="font-semibold">
                          {item?.OfficialRating}
                        </span>
                      </div>
                    </Show>
                  </div>

                  {/* Item Actions */}
                  <div class="flex items-center gap-2 pt-2">
                    <ItemActions
                      item={item}
                      itemId={item.Id || ""}
                      variant="detail"
                    />
                  </div>

                  {/* Genres - Compact pills */}
                  <Show when={item?.Genres?.length}>
                    <div class="flex flex-wrap gap-1.5">
                      {item?.Genres?.slice(0, 4).map((genre) => (
                        <span class="rounded-full bg-white/10 px-2.5 py-0.5 font-medium text-xs transition-colors hover:bg-white/15">
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
                          class="flex items-center gap-1 text-sm opacity-60 transition-opacity hover:opacity-100"
                          onClick={() =>
                            setIsOverviewExpanded(!isOverviewExpanded())
                          }
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
                        class={`text-sm leading-relaxed opacity-70 transition-all duration-300 ${
                          isOverviewExpanded() ? "" : "line-clamp-3"
                        }`}
                      >
                        {item?.Overview}
                      </p>
                    </div>
                  </Show>

                  {/* Additional Info - Compact Cards */}
                  <Show when={item?.Studios?.length || item?.People?.length}>
                    <div class="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
                      <Show when={item?.Studios?.length}>
                        <div class="rounded-lg border border-white/10 bg-white/5 p-3">
                          <h4 class="mb-2 font-semibold text-xs uppercase tracking-wider opacity-50">
                            Studio
                          </h4>
                          <p class="font-medium text-sm">
                            {item?.Studios?.map((s) => s.Name).join(", ")}
                          </p>
                        </div>
                      </Show>

                      <Show when={item?.People?.slice(0, 4).length}>
                        <div class="rounded-lg border border-white/10 bg-white/5 p-3">
                          <h4 class="mb-2 font-semibold text-xs uppercase tracking-wider opacity-50">
                            Cast
                          </h4>
                          <div class="space-y-1.5">
                            {item?.People?.slice(0, 4).map((person) => (
                              <div class="flex items-baseline gap-2 text-sm">
                                <span class="truncate font-medium">
                                  {person.Name}
                                </span>
                                <Show when={person.Role}>
                                  <span class="truncate text-xs opacity-50">
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
                <div class="mt-12 flex-1 border-white/10 border-t pt-8">
                  <QueryBoundary
                    errorFallback={(err) => (
                      <div class="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                        <div class="text-red-400 text-sm">
                          Error: {err?.message}
                        </div>
                      </div>
                    )}
                    loadingFallback={
                      <InlineLoading class="grid h-full place-items-center text-white/80" />
                    }
                    notStartedFallback={
                      <ItemsRender
                        activeFilter={activeFilter()}
                        items={[]}
                        onFilterChange={setActiveFilter}
                        parentId={params.item_id}
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
                        parentId={params.item_id}
                        parentItem={item}
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
          class="fade-in slide-in-from-bottom-4 fixed right-8 bottom-8 z-50 animate-in text-white"
          onClick={scrollToTop}
          size="icon-lg"
          variant="glass"
        >
          <ArrowUp class="h-6 w-6" />
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
  activeFilter: "all" | "unplayed" | "played" | "resumable";
  onFilterChange: (filter: "all" | "unplayed" | "played" | "resumable") => void;
}

const FilterButton = (props: {
  filter: ItemsRenderProsp["activeFilter"];
  label: string;
  activeFilter: ItemsRenderProsp["activeFilter"];
  onFilterChange: ItemsRenderProsp["onFilterChange"];
}) => (
  <button
    class={`rounded-full px-3 py-1 font-medium text-xs transition-all ${
      props.activeFilter === props.filter
        ? "border border-blue-500/50 bg-blue-500/30 text-blue-300"
        : "border border-white/10 bg-white/5 hover:bg-white/10"
    }`}
    onClick={() => props.onFilterChange(props.filter)}
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
        <div class="space-y-4">
          <h2 class="font-semibold text-lg">No item</h2>
        </div>
      }
    >
      <Match when={!parentItem}>
        <div class="space-y-4">
          <h2 class="font-semibold text-lg">No item</h2>
        </div>
      </Match>
      <Match when={!parentItem?.Type}>
        <div class="space-y-4">
          <h2 class="font-semibold text-lg">No seasons</h2>
        </div>
      </Match>
      <Match when={parentItem?.Type === "Series"}>
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-baseline gap-2">
              <h2 class="font-semibold text-lg">Seasons</h2>
              <span class="font-medium text-xs opacity-50">
                {items?.length} {items?.length === 1 ? "Season" : "Seasons"}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <Filter class="h-4 w-4 opacity-50" />
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
          <div class="grid grid-cols-3 gap-6 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            <For each={items}>
              {(item) => <SeriesCard item={item} parentId={parentId} />}
            </For>
          </div>
        </div>
      </Match>

      <Match when={parentItem?.Type === "Movie"}>
        <div class="space-y-4">
          <h2 class="font-semibold text-lg">Watch Movie</h2>
          <EpisodeCard item={parentItem} />
        </div>
      </Match>

      <Match when={parentItem?.Type === "Season"}>
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-baseline gap-2">
              <h2 class="font-semibold text-lg">Episodes</h2>
              <span class="font-medium text-xs opacity-50">
                {items?.length} {items?.length === 1 ? "Episode" : "Episodes"}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <Filter class="h-4 w-4 opacity-50" />
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
          <div class="space-y-4">
            <For each={items}>{(item) => <EpisodeCard item={item} />}</For>
          </div>
        </div>
      </Match>
    </Switch>
  );
}
