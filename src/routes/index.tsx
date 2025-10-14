import { For, Show, Switch, Match } from 'solid-js';
import { createSignal, createEffect, createMemo } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { HouseIcon } from 'lucide-solid';
import { useGeneralInfo } from '~/components/current-user-provider';
import { Nav } from '~/components/Nav';
import { QueryBoundary } from '~/components/query-boundary';
import library from '~/lib/jellyfin/library';
import { authStore } from '~/lib/persist-store';
import { createJellyFinQuery } from '~/lib/utils';
import { GlassCard } from '~/components/ui';
import { InlineLoading } from '~/components/ui/loading';
import { MainPageEpisodeCard, SeriesCard } from '~/components/media-card';

const LoadingSection = (props: { name: string }) => {
  return (
    <div class="col-span-full grid place-items-center py-8">
      <div class="animate-pulse space-x-4 inline-flex w-max"><InlineLoading /><div class='text-foreground/80'>Loading {props.name}...</div></div>
    </div>
  );
};

export default function Home() {
  const navigate = useNavigate();
  const { store } = useGeneralInfo();
  const { store: auth } = authStore();
  const [searchTerm, setSearchTerm] = createSignal('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = createSignal('');
  
  // Debounce search term to prevent excessive re-renders
  createEffect(() => {
    const term = searchTerm();
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(term);
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timeoutId);
  });

  // Redirect to auth if not logged in
  createEffect(() => {
    if (!auth.isUserLoggedIn) {
      navigate('/auth/onboarding');
    }
  });

  const libraries = createJellyFinQuery(() => ({
    queryKey: [library.query.getLibraries.key, auth.isUserLoggedIn],
    queryFn: (jf) => library.query.getLibraries(jf, store?.user?.Id),
    enabled: auth.isUserLoggedIn,
  }));

  const resumeItems = createJellyFinQuery(() => ({
    queryKey: [library.query.getResumeItems.key, auth.isUserLoggedIn, debouncedSearchTerm()],
    queryFn: (jf) => library.query.getResumeItems(jf, store?.user?.Id, {searchTerm: debouncedSearchTerm()}),
    enabled: auth.isUserLoggedIn,
  }));

  const nextupItems = createJellyFinQuery(() => ({
    queryKey: [library.query.getNextupItems.key, auth.isUserLoggedIn],
      queryFn: (jf) => library.query.getNextupItems(jf, store?.user?.Id,{limit:3}),
      enabled: auth.isUserLoggedIn,
  }));

  const latestMovies = createJellyFinQuery(() => ({
    queryKey: [library.query.getLatestItems.key,'latestMovies', auth.isUserLoggedIn, debouncedSearchTerm(), libraries.data?.length],
    queryFn: async (jf) => { 
      if(debouncedSearchTerm()) {
        let parentIds = libraries.data?.filter((library) => library.CollectionType === 'movies')?.map((library) => library.Id).filter((id) => id !== undefined);
   
        let items = await library.query.getItems(jf, {
          parentId: parentIds?.[0],
          userId: store?.user?.Id,
          enableImage: true,
          includeItemTypes: ['Movie'],
          limit: 7,
          recursive: true,
          searchTerm: debouncedSearchTerm(),
        });
        return items;
      }

      return library.query.getLatestItems(jf, store?.user?.Id,{limit:7, includeItemTypes:['Movie']});
    },
    enabled: auth.isUserLoggedIn && libraries.data?.some((library) => library.CollectionType === 'movies'),
  }));

  const latestTVShows = createJellyFinQuery(() => ({
    queryKey: [library.query.getLatestItems.key,'latestTVShows', auth.isUserLoggedIn, debouncedSearchTerm(), libraries.data?.length],
    queryFn: async (jf) => {

      if(debouncedSearchTerm()) {
        let parentIds = libraries.data?.filter((library) => library.CollectionType === 'tvshows')?.map((library) => library.Id).filter((id) => id !== undefined);
        let items = await library.query.getItems(jf, {
          parentId: parentIds?.[0],
          userId: store?.user?.Id,
          enableImage: true,
          includeItemTypes: ['Series'],
          limit: 7,
          recursive: true,
          searchTerm: debouncedSearchTerm(),
        });
        return items;
      }

      return library.query.getLatestItems(jf, store?.user?.Id,{limit:7, includeItemTypes:['Series']});
    },
    enabled: auth.isUserLoggedIn && libraries.data?.some((library) => library.CollectionType === 'tvshows'),
  }));

  return (
    <section class="w-full h-full">
      <Show when={auth.isUserLoggedIn}>
          <section class="relative flex flex-col p-0">
            {/* Navigation Bar */}
            <Nav
              variant="light"
              class="relative z-50"
              breadcrumbs={[
                {
                  label: 'Home',
                  icon: <HouseIcon class="w-4 h-4 opacity-70 flex-shrink-0" />,
                },
              ]}
              currentPage="Dashboard"
              showSearch={true}
              searchValue={searchTerm()}
              onSearchChange={setSearchTerm}
            />

            {/* Content Area */}
            <div class="relative z-20 flex-1 px-8 py-6 flex flex-col gap-6">
              {/* Libraries Section */}
               <Show when={!searchTerm()}> 

               <QueryBoundary
                  query={libraries}
                  loadingFallback={
                    <div>
                      <h2 class="text-2xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
                        Your Libraries
                      </h2>
                      <LoadingSection name="libraries" />
                    </div>
                  }
                  notFoundFallback={
                    <div class="col-span-full text-center py-20 opacity-60">
                      No libraries found
                    </div>
                  }
                >
                  {(data) => (
                    <Switch>
                      <Match when={data.length === 0}>
                        <div class="col-span-full text-center py-20 opacity-60">
                          No libraries found
                        </div>
                      </Match>

                      <Match when={data.length > 0}>
                        <div>
                          <h2 class="text-2xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
                            Your Libraries
                          </h2>
                          <div class="grid 2xl:grid-cols-6 xl:grid-cols-5 lg:grid-cols-4 md:grid-cols-3 grid-cols-2 gap-6">
                            <For each={data}>
                              {(item) => (
                                <a
                                  class="group block"
                                  href={`/library/${item.Id}`}
                                >
                                  <GlassCard
                                    preset="card"
                                    class="overflow-hidden h-full transition-all duration-300 group-hover:scale-[1.02] shadow-[var(--glass-shadow-md)] group-hover:shadow-[var(--glass-shadow-lg)]"
                                  >
                                    <div class="relative aspect-square overflow-hidden">
                                      {/* Image fills entire card */}
                                      <Show
                                        when={item.Image}
                                        fallback={
                                          <div class="w-full h-full bg-gradient-to-br from-[var(--glass-bg-medium)] to-[var(--glass-bg-subtle)] flex items-center justify-center">
                                            <span class="text-6xl opacity-30">
                                              {item.Name?.charAt(0)}
                                            </span>
                                          </div>
                                        }
                                      >
                                        <img
                                          src={item.Image}
                                          alt={item.Name ?? 'Library'}
                                          class="w-full h-full object-cover scale-110 group-hover:scale-100 transition-transform duration-700 ease-out"
                                        />
                                      </Show>

                                      {/* Gradient overlay - always visible, darkens on hover */}
                                      <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:from-black/90 group-hover:via-black/50 transition-all duration-300" />

                                      {/* Title Info - always visible at bottom */}
                                      <div class="absolute bottom-0 left-0 right-0 p-4">
                                        <h3 class="text-white text-lg font-semibold line-clamp-2 drop-shadow-lg">
                                          {item.Name}
                                        </h3>
                                        <Show when={item.CollectionType}>
                                          <p class="text-white/80 text-sm mt-1 drop-shadow-md capitalize">
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
                  query={resumeItems}
                  loadingFallback={
                    <div>
                      <h2 class="text-2xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
                        Continue Watching
                      </h2>
                      <LoadingSection name="history" />
                    </div>
                  }
                  notFoundFallback={
                    <div class="col-span-full text-center py-20 opacity-60">
                      No resume items found
                    </div>
                  }
                >
                  {(data) => (
                    <Switch>
                      {/* <Match when={data.length === 0}>
                        <div class="col-span-full text-center py-20 opacity-60">
                          No resume items found
                        </div>
                      </Match> */}

                      <Match when={data.length > 0}>
                        <div>
                          <h2 class="text-2xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
                            Continue Watching
                          </h2>
                          <div class="grid 2xl:grid-cols-8 xl:grid-cols-6 lg:grid-cols-5 md:grid-cols-4 grid-cols-3 gap-6">
                            <For each={data}>
                              {(item) => {
                                const progressPercentage =
                                  item.UserData?.PlayedPercentage || 0;
                                const isMovie = item.Type === 'Movie';
                                const isEpisode = item.Type === 'Episode';

                                return (
                                  <a class="group block" href={`/video/${item.Id}`}>
                                    <GlassCard
                                      preset="card"
                                      class="overflow-hidden transition-all duration-300 group-hover:scale-[1.02] shadow-[var(--glass-shadow-md)] group-hover:shadow-[var(--glass-shadow-lg)]"
                                    >
                                      <div class="relative aspect-[16/9] overflow-hidden">
                                        {/* Image */}
                                        <Show
                                          when={
                                            item.Images?.Primary ||
                                            item.Backdrop?.[0]
                                          }
                                          fallback={
                                            <div class="w-full h-full bg-gradient-to-br from-[var(--glass-bg-medium)] to-[var(--glass-bg-subtle)] flex items-center justify-center">
                                              <span class="text-4xl opacity-30">
                                                {item.Name?.charAt(0)}
                                              </span>
                                            </div>
                                          }
                                        >
                                          <img
                                            src={
                                              item.Images?.Primary ||
                                              item.Backdrop?.[0]
                                            }
                                            alt={item.Name ?? 'Item'}
                                            class="w-full h-full object-cover scale-110 group-hover:scale-100 transition-transform duration-700 ease-out"
                                          />
                                        </Show>

                                        {/* Gradient overlay */}
                                        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:from-black/90 group-hover:via-black/50 transition-all duration-300" />

                                        {/* Progress bar */}
                                        <Show
                                          when={
                                            progressPercentage > 0 &&
                                            progressPercentage < 100
                                          }
                                        >
                                          <div class="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                                            <div
                                              class="h-full bg-blue-500 transition-all duration-300"
                                              style={`width: ${progressPercentage}%`}
                                            />
                                          </div>
                                        </Show>

                                        {/* Title Info */}
                                        <div class="absolute bottom-0 left-0 right-0 p-3">
                                          <h3 class="text-white text-sm font-semibold line-clamp-2 drop-shadow-lg">
                                            {item.Name}
                                          </h3>
                                          <Show when={isEpisode && item.SeriesName}>
                                            <p class="text-white/80 text-xs mt-1 drop-shadow-md">
                                              {item.SeriesName} - S
                                              {item.ParentIndexNumber}E
                                              {item.IndexNumber}
                                            </p>
                                          </Show>
                                          <Show
                                            when={isMovie && item.ProductionYear}
                                          >
                                            <p class="text-white/80 text-xs mt-1 drop-shadow-md">
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
                query={nextupItems}
                loadingFallback={
                  <div>
                    <h2 class="text-2xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
                      Next Up
                    </h2>
                    <LoadingSection name="next up" />
                  </div>
                }
                notFoundFallback={<div class="col-span-full text-center py-20 opacity-60">No next up items found</div>}
              >
                {(data) => (
                  <Show when={data.length > 0}>
                    <div>
                    <h2 class="text-2xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
                      Next Up
                    </h2>
                    <div class="grid xl:grid-cols-4 grid-cols-2 gap-6">
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
                query={latestMovies}
                loadingFallback={
                  <div>
                    <h2 class="text-2xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
                      {searchTerm() ? 'Movies' : 'Latest Movies'}
                    </h2>
                    <LoadingSection name="latest movies" />
                  </div>
                }
                notFoundFallback={<div class="col-span-full text-center py-20 opacity-60">No {searchTerm() ? 'Movies' : 'Latest Movies'} found</div>}
              >
                {(data) => (
                <Show when={data.length > 0}>
                    <div>
                    <h2 class="text-2xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
                      {searchTerm() ? 'Movies' : 'Latest Movies'}
                    </h2>
                    <div class="grid xl:grid-cols-7 lg:grid-cols-5 md:grid-cols-4 grid-cols-3 gap-6">
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
                query={latestTVShows}
                loadingFallback={
                  <div>
                    <h2 class="text-2xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
                      {searchTerm() ? 'TV Shows' : 'Latest TV Shows'}
                    </h2>
                    <LoadingSection name="latest tv shows" />
                  </div>
                }
                notFoundFallback={<div class="col-span-full text-center py-20 opacity-60">No {searchTerm() ? 'TV Shows' : 'Latest TV Shows'} found</div>}
              >
                {(data) => (
                  <Show when={data.length > 0}>
                    <div>
                    <h2 class="text-2xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
                      {searchTerm() ? 'TV Shows' : 'Latest TV Shows'}
                    </h2>
                    <div class="grid xl:grid-cols-7 lg:grid-cols-5 md:grid-cols-4 grid-cols-3 gap-6">
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
