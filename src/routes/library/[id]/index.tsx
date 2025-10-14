import type { RouteSectionProps } from '@solidjs/router';
import { Library as LibraryIcon } from 'lucide-solid';
import { createSignal, For, splitProps } from 'solid-js';
import { useGeneralInfo } from '~/components/current-user-provider';
import { SeriesCard } from '~/components/media-card';
import { Nav } from '~/components/Nav';
import { QueryBoundary } from '~/components/query-boundary';
import library from '~/lib/jellyfin/library';
import { itemQueryOptions } from '~/lib/tanstack/query-options';
import { createJellyFinQuery } from '~/lib/utils';

export default function Page(props: RouteSectionProps) {
  const [{ params }] = splitProps(props, ['params']);

  const { store } = useGeneralInfo();
  const [searchTerm, setSearchTerm] = createSignal('');

  const libraryDetails = createJellyFinQuery(() =>
    itemQueryOptions(params.id, store?.user?.Id)
  );

  const itemsDetails = createJellyFinQuery(() => ({
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
    <section class="relative flex min-h-screen flex-col">
      {/* Background with enhanced overlay */}

      {/* Navigation Bar */}
      <QueryBoundary
        loadingFallback={
          <Nav
            breadcrumbs={[
              {
                label: 'Libraries',
                icon: <LibraryIcon class="h-4 w-4 flex-shrink-0 opacity-70" />,
              },
            ]}
            class="relative z-50"
            currentPage="Loading..."
            onSearchChange={setSearchTerm}
            searchValue={searchTerm()}
            showSearch={true}
            variant="light"
          />
        }
        query={libraryDetails}
      >
        {(library) => (
          <Nav
            breadcrumbs={[
              {
                label: 'Libraries',
                icon: <LibraryIcon class="h-4 w-4 flex-shrink-0 opacity-70" />,
              },
            ]}
            class="relative z-50"
            currentPage={library?.Name || 'Library'}
            onSearchChange={setSearchTerm}
            searchValue={searchTerm()}
            showSearch={true}
            variant="light"
          />
        )}
      </QueryBoundary>

      {/* Content Area */}
      <div class="relative z-20 flex-1 overflow-y-auto px-8 py-6">
        <div class="grid grid-cols-4 gap-6 xl:grid-cols-6 2xl:grid-cols-8">
          <QueryBoundary
            loadingFallback={
              <div class="col-span-full py-20 text-center">
                <div class="inline-block animate-pulse">Loading content...</div>
              </div>
            }
            notFoundFallback={
              <div class="col-span-full py-20 text-center opacity-60">
                No items found in this library
              </div>
            }
            query={itemsDetails}
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
