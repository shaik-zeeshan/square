import { debounce } from "@solid-primitives/scheduled";
import { createSignal, For, Match, Show, Switch } from "solid-js";
import { ItemActions } from "~/components/ItemActions";
import { MainPageEpisodeCard, SeriesCard } from "~/components/media-card";
import { Nav } from "~/components/Nav";
import { QueryBoundary } from "~/components/query-boundary";
import { GlassCard } from "~/components/ui";
import { InlineLoading } from "~/components/ui/loading";
import { useAuth } from "~/effect/services/hooks/use-auth";
import { JellyfinOperations } from "~/effect/services/jellyfin/operations";
import HouseIcon from "~icons/lucide/house";

const LoadingSection = (props: { name: string }) => (
  <div class="col-span-full grid place-items-center py-8">
    <div class="inline-flex w-max animate-pulse space-x-4">
      <InlineLoading />
      <div class="text-foreground/80">Loading {props.name}...</div>
    </div>
  </div>
);

export default function Home() {
  const { getCurrentUser } = useAuth();
  const [searchTerm, setSearchTerm] = createSignal("");

  const user = getCurrentUser();

  const debouncedSearchCallback = debounce(
    (value: string) => setSearchTerm(value),
    300
  );

  const libraries = JellyfinOperations.getLibraries();

  const resumeItems = JellyfinOperations.getResumeItems();

  const nextupItems = JellyfinOperations.getNextupItems();

  const latestMovies = JellyfinOperations.getLatestMovies(
    () => searchTerm(),
    libraries.data
  );

  const latestTVShows = JellyfinOperations.getLatestTVShows(
    () => searchTerm(),
    libraries.data
  );

  return (
    <section class="h-full w-full">
      <Show when={user.data?.Id}>
        <section class="relative flex flex-col p-0">
          {/* Navigation Bar */}
          <Nav
            breadcrumbs={[
              {
                label: "Home",
                icon: <HouseIcon class="h-4 w-4 shrink-0 opacity-70" />,
              },
            ]}
            class="relative z-50"
            currentPage="Dashboard"
            onSearchChange={debouncedSearchCallback}
            searchValue={searchTerm()}
            showSearch={true}
            variant="light"
          />

          {/* Content Area */}
          <div class="relative z-20 flex flex-1 flex-col gap-6 px-8 py-6">
            {/* Libraries Section */}
            <Show when={!searchTerm()}>
              <QueryBoundary
                loadingFallback={
                  <div>
                    <h2 class="mb-8 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text font-bold text-2xl text-transparent">
                      Your Libraries
                    </h2>
                    <LoadingSection name="libraries" />
                  </div>
                }
                notFoundFallback={
                  <div class="col-span-full py-20 text-center opacity-60">
                    No libraries found
                  </div>
                }
                query={libraries}
              >
                {(data) => (
                  <Switch>
                    <Match when={data.length === 0}>
                      <div class="col-span-full py-20 text-center opacity-60">
                        No libraries found
                      </div>
                    </Match>

                    <Match when={data.length > 0}>
                      <div>
                        <h2 class="mb-8 bg-linear-to-r from-foreground to-foreground/60 bg-clip-text font-bold text-2xl text-transparent">
                          Your Libraries
                        </h2>
                        <div
                          class="grid h-96 grid-cols-4 gap-6"
                          style={
                            {
                              // "grid-template-columns": `repeat(${data.length}, minmax(0, 1fr))`,
                            }
                          }
                        >
                          <For each={data}>
                            {(item) => (
                              <a
                                class="group block h-full w-full"
                                href={`/library/${item.Id}`}
                              >
                                <GlassCard
                                  class="h-full w-full overflow-hidden shadow-[var(--glass-shadow-md)] transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-[var(--glass-shadow-lg)]"
                                  preset="card"
                                >
                                  <div class="relative h-full w-full overflow-hidden">
                                    {/* Image fills entire card */}
                                    <Show
                                      fallback={
                                        <div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--glass-bg-medium)] to-[var(--glass-bg-subtle)]">
                                          <span class="text-6xl opacity-30">
                                            {item.Name?.charAt(0)}
                                          </span>
                                        </div>
                                      }
                                      when={item.Image}
                                    >
                                      <img
                                        alt={item.Name ?? "Library"}
                                        class="absolute inset-0 h-full w-full scale-110 object-cover transition-transform duration-700 ease-out group-hover:scale-100"
                                        src={item.Image}
                                      />
                                    </Show>

                                    {/* Gradient overlay - always visible, darkens on hover */}
                                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-all duration-300 group-hover:from-black/90 group-hover:via-black/50" />

                                    {/* Title Info - always visible at bottom */}
                                    <div class="absolute right-0 bottom-0 left-0 p-4">
                                      <h3 class="line-clamp-2 font-semibold text-lg text-white drop-shadow-lg">
                                        {item.Name}
                                      </h3>
                                      <Show when={item.CollectionType}>
                                        <p class="mt-1 text-sm text-white/80 capitalize drop-shadow-md">
                                          {item.CollectionType}
                                        </p>
                                      </Show>
                                    </div>
                                  </div>
                                </GlassCard>
                              </a>
                            )}
                          </For>
                        </div>
                      </div>
                    </Match>
                  </Switch>
                )}
              </QueryBoundary>

              {/* Continue Watching Section */}
              <QueryBoundary
                loadingFallback={
                  <div>
                    <h2 class="mb-8 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text font-bold text-2xl text-transparent">
                      Continue Watching
                    </h2>
                    <LoadingSection name="history" />
                  </div>
                }
                notFoundFallback={
                  <div class="col-span-full py-20 text-center opacity-60">
                    No resume items found
                  </div>
                }
                query={resumeItems}
              >
                {(data) => (
                  <Switch>
                    <Match when={data.length > 0}>
                      <div>
                        <h2 class="mb-8 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text font-bold text-2xl text-transparent">
                          Continue Watching
                        </h2>
                        <div class="grid grid-cols-2 gap-6 md:grid-cols-3">
                          <For each={data}>
                            {(item) => {
                              const progressPercentage =
                                item.UserData?.PlayedPercentage || 0;
                              const isMovie = item.Type === "Movie";
                              const isEpisode = item.Type === "Episode";

                              return (
                                <a
                                  class="group block"
                                  href={`/video/${item.Id}/new`}
                                >
                                  <GlassCard
                                    class="overflow-hidden shadow-[var(--glass-shadow-md)] transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-[var(--glass-shadow-lg)]"
                                    preset="card"
                                  >
                                    <div class="relative aspect-[16/9] overflow-hidden">
                                      {/* Image */}
                                      <Show
                                        fallback={
                                          <div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--glass-bg-medium)] to-[var(--glass-bg-subtle)]">
                                            <span class="text-4xl opacity-30">
                                              {item.Name?.charAt(0)}
                                            </span>
                                          </div>
                                        }
                                        when={item.Image}
                                      >
                                        <img
                                          alt={item.Name ?? "Item"}
                                          class="h-full w-full scale-110 object-cover transition-transform duration-700 ease-out group-hover:scale-100"
                                          src={item.Image}
                                        />
                                      </Show>

                                      {/* Gradient overlay */}
                                      <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-all duration-300 group-hover:from-black/90 group-hover:via-black/50" />

                                      {/* Progress bar */}
                                      <Show
                                        when={
                                          progressPercentage > 0 &&
                                          progressPercentage < 100
                                        }
                                      >
                                        <div class="absolute right-0 bottom-0 left-0 h-1 bg-black/50">
                                          <div
                                            class="h-full bg-blue-500 transition-all duration-300"
                                            style={`width: ${progressPercentage}%`}
                                          />
                                        </div>
                                      </Show>

                                      {/* Item Actions - Show on hover */}
                                      <Show when={item.Id}>
                                        {(itemId) => (
                                          <div class="absolute top-2 right-2 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                            <ItemActions
                                              item={item}
                                              itemId={itemId()}
                                              onDone={() =>
                                                JellyfinOperations.resumeItemsQueryDataHelpers.invalidateQuery()
                                              }
                                              variant="card"
                                            />
                                          </div>
                                        )}
                                      </Show>

                                      {/* Title Info */}
                                      <div class="absolute right-0 bottom-0 left-0 p-3">
                                        <h3 class="line-clamp-2 font-semibold text-sm text-white drop-shadow-lg">
                                          {item.Name}
                                        </h3>
                                        <Show
                                          when={isEpisode && item.SeriesName}
                                        >
                                          <p class="mt-1 text-white/80 text-xs drop-shadow-md">
                                            {item.SeriesName} - S
                                            {item.ParentIndexNumber}E
                                            {item.IndexNumber}
                                          </p>
                                        </Show>
                                        <Show
                                          when={isMovie && item.ProductionYear}
                                        >
                                          <p class="mt-1 text-white/80 text-xs drop-shadow-md">
                                            {item.ProductionYear}
                                          </p>
                                        </Show>
                                      </div>
                                    </div>
                                  </GlassCard>
                                </a>
                              );
                            }}
                          </For>
                        </div>
                      </div>
                    </Match>
                  </Switch>
                )}
              </QueryBoundary>

              {/* Next Up Section */}
              <QueryBoundary
                loadingFallback={
                  <div>
                    <h2 class="mb-8 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text font-bold text-2xl text-transparent">
                      Next Up
                    </h2>
                    <LoadingSection name="next up" />
                  </div>
                }
                notFoundFallback={
                  <div class="col-span-full py-20 text-center opacity-60">
                    No next up items found
                  </div>
                }
                query={nextupItems}
              >
                {(data) => (
                  <Show when={data.length > 0}>
                    <div>
                      <h2 class="mb-8 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text font-bold text-2xl text-transparent">
                        Next Up
                      </h2>
                      <div class="grid grid-cols-2 gap-6 xl:grid-cols-4">
                        <For each={data}>
                          {(item) => <MainPageEpisodeCard item={item} />}
                        </For>
                      </div>
                    </div>
                  </Show>
                )}
              </QueryBoundary>
            </Show>

            {/* Latest Movies Section */}
            <QueryBoundary
              loadingFallback={
                <div>
                  <h2 class="mb-8 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text font-bold text-2xl text-transparent">
                    {searchTerm() ? "Movies" : "Latest Movies"}
                  </h2>
                  <LoadingSection name="latest movies" />
                </div>
              }
              notFoundFallback={
                <div class="col-span-full py-20 text-center opacity-60">
                  No {searchTerm() ? "Movies" : "Latest Movies"} found
                </div>
              }
              query={latestMovies}
            >
              {(data) => (
                <Show when={data.length > 0}>
                  <div>
                    <h2 class="mb-8 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text font-bold text-2xl text-transparent">
                      {searchTerm() ? "Movies" : "Latest Movies"}
                    </h2>
                    <div class="grid grid-cols-3 gap-6 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
                      <For each={data}>
                        {(item) => <SeriesCard item={item} />}
                      </For>
                    </div>
                  </div>
                </Show>
              )}
            </QueryBoundary>

            {/* Latest TV Shows Section */}
            <QueryBoundary
              loadingFallback={
                <div>
                  <h2 class="mb-8 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text font-bold text-2xl text-transparent">
                    {searchTerm() ? "TV Shows" : "Latest TV Shows"}
                  </h2>
                  <LoadingSection name="latest tv shows" />
                </div>
              }
              notFoundFallback={
                <div class="col-span-full py-20 text-center opacity-60">
                  No {searchTerm() ? "TV Shows" : "Latest TV Shows"} found
                </div>
              }
              query={latestTVShows}
            >
              {(data) => (
                <Show when={data.length > 0}>
                  <div>
                    <h2 class="mb-8 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text font-bold text-2xl text-transparent">
                      {searchTerm() ? "TV Shows" : "Latest TV Shows"}
                    </h2>
                    <div class="grid grid-cols-3 gap-6 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
                      <For each={data}>
                        {(item) => <SeriesCard item={item} />}
                      </For>
                    </div>
                  </div>
                </Show>
              )}
            </QueryBoundary>
          </div>
        </section>
      </Show>
    </section>
  );
}
