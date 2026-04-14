import type { RouteSectionProps } from "@solidjs/router";
import { createSignal, For, Show, splitProps } from "solid-js";
import { SeriesCard } from "~/components/media-card";
import { Nav } from "~/components/Nav";
import { QueryBoundary } from "~/components/query-boundary";
import { InlineLoading } from "~/components/ui/loading";
import { JellyfinOperations } from "~/effect/services/jellyfin/operations";
import LibraryIcon from "~icons/lucide/library";

// ── Skeleton grid for loading state ──────────────────────────────────────────
function LibraryGridSkeleton() {
  return (
    <div
      class="grid grid-cols-4 gap-4 xl:grid-cols-6 2xl:grid-cols-8"
      style={{
        animation: "fadeSlideUp 300ms cubic-bezier(0.22,1,0.36,1) both",
      }}
    >
      <For each={Array.from({ length: 16 })}>
        {() => (
          <div class="aspect-2/3 animate-pulse rounded-xl bg-white/[0.04]" />
        )}
      </For>
    </div>
  );
}

// ── Empty state (no items) ────────────────────────────────────────────────────
function LibraryEmpty(props: { searchTerm?: string }) {
  return (
    <div
      class="col-span-full flex flex-col items-center gap-4 rounded-2xl border border-white/[0.05] bg-white/[0.02] py-20 text-center"
      style={{
        animation: "fadeSlideUp 300ms cubic-bezier(0.22,1,0.36,1) both",
      }}
    >
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03]">
        <LibraryIcon class="h-6 w-6 text-white/25" />
      </div>
      <div class="space-y-1">
        <Show
          fallback={
            <>
              <p class="font-medium text-sm text-white/45">
                This library is empty
              </p>
              <p class="text-white/22 text-xs">No items have been added yet.</p>
            </>
          }
          when={props.searchTerm}
        >
          <p class="font-medium text-sm text-white/45">No results found</p>
          <p class="text-white/22 text-xs">
            Nothing matched "{props.searchTerm}"
          </p>
        </Show>
      </div>
    </div>
  );
}

// ── Search active banner ──────────────────────────────────────────────────────
function SearchActiveBanner(props: { term: string; count?: number }) {
  return (
    <div
      class="flex items-center justify-between rounded-xl border border-blue-400/15 bg-blue-400/[0.06] px-4 py-2.5"
      style={{
        animation: "fadeSlideUp 250ms cubic-bezier(0.22,1,0.36,1) both",
      }}
    >
      <div class="flex items-center gap-2.5 text-blue-200/90 text-sm">
        <span
          class="h-2 w-2 shrink-0 rounded-full bg-blue-400"
          style={{ animation: "liveDot 1.4s ease-in-out infinite" }}
        />
        <span>
          Searching for{" "}
          <strong class="font-semibold text-blue-100">"{props.term}"</strong>
        </span>
      </div>
      <Show when={props.count !== undefined}>
        <span class="rounded-md bg-blue-400/[0.10] px-2 py-0.5 font-medium text-blue-200/65 text-xs tabular-nums">
          {props.count} result{props.count !== 1 ? "s" : ""}
        </span>
      </Show>
    </div>
  );
}

export default function Page(props: RouteSectionProps) {
  const [{ params }] = splitProps(props, ["params"]);

  const [searchTerm, setSearchTerm] = createSignal("");

  const libraryDetails = JellyfinOperations.getItem(() => params.id);

  const itemsDetails = JellyfinOperations.getItems(() => ({
    parentId: params.id,
    fields: [],
    enableImages: true,
    includeItemTypes: ["Series", "Movie"],
    searchTerm: searchTerm(),
    recursive: true,
  }));

  return (
    <section class="relative flex min-h-screen flex-col">
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
      <div class="relative z-20 flex-1 px-8 py-8">
        {/* Section heading row */}
        <div class="mb-6 flex items-center justify-between">
          <div class="flex items-baseline gap-3">
            <div
              aria-hidden="true"
              class="h-5 w-0.5 shrink-0 rounded-full bg-blue-400/60"
            />
            <h2 class="font-semibold text-lg text-white/90 tracking-tight">
              <Show fallback="Browse" when={searchTerm()}>
                Results
              </Show>
            </h2>
          </div>

          {/* Item count */}
          <QueryBoundary notFoundFallback={null} query={itemsDetails}>
            {(data) => (
              <Show when={data.length > 0}>
                <span class="rounded-md bg-white/[0.06] px-2 py-0.5 font-medium text-white/28 text-xs tabular-nums">
                  {data.length} item{data.length !== 1 ? "s" : ""}
                </span>
              </Show>
            )}
          </QueryBoundary>
        </div>

        {/* Search active banner */}
        <Show when={searchTerm()}>
          <div class="mb-6">
            <SearchActiveBanner term={searchTerm()} />
          </div>
        </Show>

        {/* Grid */}
        <QueryBoundary
          loadingFallback={
            <div class="space-y-4">
              <div class="flex items-center gap-2 text-sm text-white/35">
                <InlineLoading size="sm" />
                <span>Loading content...</span>
              </div>
              <LibraryGridSkeleton />
            </div>
          }
          notFoundFallback={
            <LibraryEmpty searchTerm={searchTerm() || undefined} />
          }
          query={itemsDetails}
        >
          {(data) => (
            <Show
              fallback={<LibraryEmpty searchTerm={searchTerm() || undefined} />}
              when={data.length > 0}
            >
              <div
                class="grid grid-cols-4 gap-4 xl:grid-cols-6 2xl:grid-cols-8"
                style={{
                  animation:
                    "fadeSlideUp 300ms cubic-bezier(0.22,1,0.36,1) both",
                }}
              >
                <For each={data}>
                  {(item) => <SeriesCard item={item} parentId={params.id} />}
                </For>
              </div>
            </Show>
          )}
        </QueryBoundary>
      </div>
    </section>
  );
}
