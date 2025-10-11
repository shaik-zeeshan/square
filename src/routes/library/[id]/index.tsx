import { RouteSectionProps } from '@solidjs/router';
import { Library as LibraryIcon } from 'lucide-solid';
import { For, splitProps, createSignal, Show } from 'solid-js';
import { useGeneralInfo } from '~/components/current-user-provider';
import { SeriesCard } from '~/components/media-card';
import { Nav } from '~/components/Nav';
import { QueryBoundary } from '~/components/query-boundary';
import library from '~/lib/jellyfin/library';
import { itemQueryOptions } from '~/lib/tanstack/query-options';
import { createJellyFinQuery } from '~/lib/utils';

export default function Page(props: RouteSectionProps) {
  let [{ params }] = splitProps(props, ['params']);

  const { store } = useGeneralInfo();
  const [searchTerm, setSearchTerm] = createSignal('');

  let libraryDetails = createJellyFinQuery(() =>
    itemQueryOptions(params.id, store?.user?.Id)
  );

  let itemsDetails = createJellyFinQuery(() => ({
    queryKey: [
      library.query.getItems.key,
      library.query.getItems.keyFor(params.id),
      searchTerm(),
    ],
    queryFn: async (jf) =>
      library.query.getItems(jf, {
        parentId: params.id,
        userId: store?.user?.Id,
        fields: [],
        enableImage: true,
        includeItemTypes: ['Series', 'Movie'],
        searchTerm: searchTerm(),
        recursive: true,
      }),
  }));

  return (
    <section class="relative min-h-screen flex flex-col">
      {/* Background with enhanced overlay */}

      {/* Navigation Bar */}
      <Nav
        variant="light"
        class="relative z-50"
        breadcrumbs={[
          {
            label: 'Libraries',
            icon: <LibraryIcon class="w-4 h-4 opacity-70 flex-shrink-0" />,
          },
        ]}
        currentPage={libraryDetails.data?.Name || 'Loading...'}
        showSearch={true}
        searchValue={searchTerm()}
        onSearchChange={setSearchTerm}
      />

      {/* Content Area */}
      <div class="relative z-20 flex-1 overflow-y-auto px-8 py-6">
        <div class="grid 2xl:grid-cols-8 xl:grid-cols-6 grid-cols-4 gap-6">
          <QueryBoundary
            query={itemsDetails}
            loadingFallback={
              <div class="col-span-full text-center py-20">
                <div class="inline-block animate-pulse">Loading content...</div>
              </div>
            }
            notFoundFallback={
              <div class="col-span-full text-center py-20 opacity-60">
                No items found in this library
              </div>
            }
          >
            {(data) => (
              <For each={data}>
                {(item) => <SeriesCard item={item} parentId={params.id} />}
              </For>
            )}
          </QueryBoundary>
        </div>
      </div>
    </section>
  );
}
