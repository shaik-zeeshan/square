import type { RouteSectionProps } from "@solidjs/router";
import { createSignal, For, splitProps } from "solid-js";
import { SeriesCard } from "~/components/media-card";
import { Nav } from "~/components/Nav";
import { QueryBoundary } from "~/components/query-boundary";
import { JellyfinOperations } from "~/effect/services/jellyfin/operations";
import LibraryIcon from "~icons/lucide/library";

export default function Page(props: RouteSectionProps) {
  const [{ params }] = splitProps(props, ["params"]);

  const [searchTerm, setSearchTerm] = createSignal("");

  const libraryDetails = JellyfinOperations.getItem(() => params.id);

  const itemsDetails = JellyfinOperations.getItems({
    parentId: params.id,
    fields: [],
    enableImages: true,
    includeItemTypes: ["Series", "Movie"],
    searchTerm: searchTerm(),
    recursive: true,
  });

  return (
    <section class="relative flex min-h-screen flex-col">
      {/* Background with enhanced overlay */}

      {/* Navigation Bar */}
      <QueryBoundary
        loadingFallback={
          <Nav
            breadcrumbs={[
              {
                label: "Libraries",
                icon: <LibraryIcon class="h-4 w-4 shrink-0 opacity-70" />,
              },
            ]}
            class="relative z-50"
            currentPage={"Loading..."}
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
                label: "Libraries",
                icon: <LibraryIcon class="h-4 w-4 shrink-0 opacity-70" />,
              },
            ]}
            class="relative z-50"
            currentPage={library?.Name || "Library"}
            onSearchChange={setSearchTerm}
            searchValue={searchTerm()}
            showSearch={true}
            variant="light"
          />
        )}
      </QueryBoundary>

      {/* Content Area */}
      <div class="relative z-20 flex-1 px-8 py-6">
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
