import { debounce } from "@solid-primitives/scheduled";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  on,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import { Portal } from "solid-js/web";
import { ItemActions } from "~/components/ItemActions";
import { MainPageEpisodeCard, SeriesCard } from "~/components/media-card";
import { Nav } from "~/components/Nav";
import { QueryBoundary } from "~/components/query-boundary";

import { InlineLoading } from "~/components/ui/loading";
import { useCurrentUserQuery } from "~/effect/services/auth/operations";
import {
  useActionIntegrationMutation,
  useIntegrationConnectionsQuery,
  useProviderOptionsQuery,
  useSearchIntegrationMutation,
  useTvSeasonsQuery,
} from "~/effect/services/integrations/operations";
import type {
  CapabilityActionPayload,
  PluginCapability,
  PluginSearchResult,
} from "~/effect/services/integrations/types";
import { BUILT_IN_PLUGINS } from "~/effect/services/integrations/types";
import { JellyfinOperations } from "~/effect/services/jellyfin/operations";
import HouseIcon from "~icons/lucide/house";

// ── Section heading — streaming rail label with curated feel ──────────────────
function SectionHeading(props: {
  label: string;
  searchLabel?: string;
  isSearch?: boolean;
  count?: number;
}) {
  return (
    <div
      class="mb-6 flex items-baseline gap-3"
      style={{
        animation: "fadeSlideUp 300ms cubic-bezier(0.22,1,0.36,1) both",
      }}
    >
      <h2 class="font-semibold text-[17px] text-white/90 tracking-tight">
        {props.isSearch ? (props.searchLabel ?? props.label) : props.label}
      </h2>
      <Show when={props.count !== undefined && props.count > 0}>
        <span class="ml-0.5 rounded-md bg-white/[0.06] px-1.5 py-0.5 font-medium text-white/25 text-xs tabular-nums">
          {props.count}
        </span>
      </Show>
      {/* Explore link style — subtle right arrow feel */}
      <div aria-hidden="true" class="flex-1" />
    </div>
  );
}

// ── Section skeleton shimmer ───────────────────────────────────────────────────
function SectionSkeleton(props: {
  count?: number;
  aspect?: string;
  variant?: "video" | "poster" | "library";
}) {
  const count = props.count ?? 5;
  const aspect = props.aspect ?? "aspect-2/3";
  const gridClass = () => {
    switch (props.variant) {
      case "video":
        return "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
      case "library":
        return "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6";
      default:
        return "grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7";
    }
  };
  return (
    <div class={gridClass()}>
      <For each={Array.from({ length: count })}>
        {() => (
          <div
            class={`${aspect} animate-pulse rounded-xl bg-white/[0.04]`}
            style={{ animation: "pulse 1.8s ease-in-out infinite" }}
          />
        )}
      </For>
    </div>
  );
}

// ── Section loading state ────────────────────────────────────────────────────
const LoadingSection = (props: {
  name: string;
  aspect?: string;
  count?: number;
  variant?: "video" | "poster" | "library";
}) => (
  <div
    class="space-y-4"
    style={{ animation: "fadeSlideUp 300ms cubic-bezier(0.22,1,0.36,1) both" }}
  >
    <div class="flex items-center gap-3">
      <div class="h-4 w-32 animate-pulse rounded-md bg-white/[0.06]" />
      <InlineLoading class="ml-1 opacity-50" size="sm" />
    </div>
    <SectionSkeleton
      aspect={props.aspect}
      count={props.count ?? 5}
      variant={props.variant}
    />
  </div>
);

// ── Inline empty-state for a section ────────────────────────────────────────
function SectionEmpty(props: { label: string }) {
  return (
    <div
      class="flex flex-col items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] py-10 text-center"
      style={{
        animation: "fadeSlideUp 300ms cubic-bezier(0.22,1,0.36,1) both",
      }}
    >
      <p class="text-sm text-white/35">No {props.label} found</p>
    </div>
  );
}

// ── Helpers reused from settings ──────────────────────────────────────────────

const CAPABILITY_LABELS: Record<PluginCapability, string> = {
  search: "Search",
  request: "Request",
  add_movie: "Add Movie",
  add_series: "Add Series",
};

function actionCapabilities(
  pluginId: string
): Exclude<PluginCapability, "search">[] {
  const plugin = BUILT_IN_PLUGINS.find((p) => p.pluginId === pluginId);
  if (!plugin) {
    return [];
  }
  return plugin.capabilities.filter(
    (c): c is Exclude<PluginCapability, "search"> => c !== "search"
  );
}

function pluginHasSearch(pluginId: string): boolean {
  const plugin = BUILT_IN_PLUGINS.find((p) => p.pluginId === pluginId);
  return plugin?.capabilities.includes("search") ?? false;
}

function safeParseInt(val: string | undefined): number | null {
  if (!val) {
    return null;
  }
  const n = Number.parseInt(val, 10);
  return Number.isFinite(n) ? n : null;
}

// ── Plugin search section for global search ──────────────────────────────────

interface PendingAction {
  capability: Exclude<PluginCapability, "search">;
  result: PluginSearchResult;
}

function PluginSearchSection(props: { searchTerm: string }) {
  const connections = useIntegrationConnectionsQuery();
  const [selectedConnId, setSelectedConnId] = createSignal<string>("");
  const [searchResults, setSearchResults] = createSignal<PluginSearchResult[]>(
    []
  );
  const [pendingAction, setPendingAction] = createSignal<PendingAction | null>(
    null
  );
  const [actionFields, setActionFields] = createSignal<Record<string, string>>(
    {}
  );

  const searchMutation = useSearchIntegrationMutation();
  const actionMutation = useActionIntegrationMutation();
  const searchEpoch = { current: 0 };

  const searchableConns = () =>
    (connections.data ?? []).filter((c) => pluginHasSearch(c.pluginId));

  // Reconcile selected connection when available connections change
  createEffect(() => {
    const conns = searchableConns();
    const current = selectedConnId();
    if (conns.length === 0) {
      setSelectedConnId("");
      setSearchResults([]);
      return;
    }
    // If no selection or selected connection was removed, pick first available
    if (!(current && conns.some((c) => c.connectionId === current))) {
      setSelectedConnId(conns[0].connectionId);
      setSearchResults([]);
      setPendingAction(null);
    }
  });

  const selectedConn = () =>
    searchableConns().find((c) => c.connectionId === selectedConnId());

  // Auto-search when term or connection changes (with stale-response guard)
  createEffect(
    on(
      () => [props.searchTerm, selectedConnId()] as const,
      ([term, connId]) => {
        const trimmed = term.trim();
        searchEpoch.current += 1;
        const thisEpoch = searchEpoch.current;
        if (!trimmed) {
          setSearchResults([]);
          return;
        }
        if (!connId) {
          setSearchResults([]);
          return;
        }
        searchMutation.mutate(
          { connectionId: connId, query: trimmed },
          {
            onSuccess: (data) => {
              if (thisEpoch === searchEpoch.current) {
                setSearchResults(data);
              }
            },
            onError: () => {
              if (thisEpoch === searchEpoch.current) {
                setSearchResults([]);
              }
            },
          }
        );
      }
    )
  );

  // Provider options for action forms
  const needsProviderLookup = () => {
    const conn = selectedConn();
    return conn?.pluginId === "sonarr" || conn?.pluginId === "radarr";
  };
  const lookupConnId = () =>
    needsProviderLookup() ? selectedConnId() || undefined : undefined;
  const qualityProfiles = useProviderOptionsQuery(
    lookupConnId,
    "qualityProfiles"
  );
  const rootFolders = useProviderOptionsQuery(lookupConnId, "rootFolders");

  const openActionForm = (
    capability: Exclude<PluginCapability, "search">,
    result: PluginSearchResult
  ) => {
    setPendingAction({ capability, result });
    const raw = result.raw ?? {};
    const prefilled: Record<string, string> = {};

    if (capability === "request") {
      prefilled.mediaType =
        result.mediaType === "series" || result.mediaType === "tv"
          ? "tv"
          : "movie";
      prefilled.mediaId = result.id;
    } else if (capability === "add_series") {
      prefilled.tvdbId = String(raw.tvdbId ?? result.id);
      prefilled.title = result.title;
      prefilled.rootFolderPath = "";
      prefilled.qualityProfileId = "";
    } else if (capability === "add_movie") {
      prefilled.tmdbId = String(raw.tmdbId ?? result.id);
      prefilled.title = result.title;
      prefilled.rootFolderPath = "";
      prefilled.qualityProfileId = "";
    }
    setActionFields(prefilled);
  };

  const setField = (key: string, value: string) =>
    setActionFields((prev) => ({ ...prev, [key]: value }));

  const submitAction = () => {
    const action = pendingAction();
    const connId = selectedConnId();
    if (!action) {
      return;
    }
    if (!connId) {
      return;
    }

    const fields = actionFields();
    let payload: CapabilityActionPayload;

    if (action.capability === "request") {
      const mediaId = safeParseInt(fields.mediaId);
      if (mediaId === null) {
        return;
      }
      payload = {
        capability: "request",
        params: {
          mediaType: (fields.mediaType as "movie" | "tv") || "movie",
          mediaId,
          ...(fields.seasons?.trim()
            ? {
                seasons: fields.seasons
                  .split(",")
                  .map((s) => Number(s.trim()))
                  .filter((n) => !Number.isNaN(n) && Number.isFinite(n)),
              }
            : {}),
        },
      };
    } else if (action.capability === "add_series") {
      const tvdbId = safeParseInt(fields.tvdbId);
      const qualityProfileId = safeParseInt(fields.qualityProfileId);
      if (tvdbId === null || qualityProfileId === null) {
        return;
      }
      payload = {
        capability: "add_series",
        params: {
          tvdbId,
          title: fields.title || action.result.title,
          qualityProfileId,
          rootFolderPath: fields.rootFolderPath,
        },
      };
    } else {
      const tmdbId = safeParseInt(fields.tmdbId);
      const qualityProfileId = safeParseInt(fields.qualityProfileId);
      if (tmdbId === null || qualityProfileId === null) {
        return;
      }
      payload = {
        capability: "add_movie",
        params: {
          tmdbId,
          title: fields.title || action.result.title,
          qualityProfileId,
          rootFolderPath: fields.rootFolderPath,
        },
      };
    }

    actionMutation.mutate(
      { connectionId: connId, payload },
      { onSuccess: () => setPendingAction(null) }
    );
  };

  const actionFormValid = () => {
    const action = pendingAction();
    if (!action) {
      return false;
    }
    const f = actionFields();
    if (action.capability === "request") {
      return safeParseInt(f.mediaId) !== null && !!f.mediaType;
    }
    if (action.capability === "add_series") {
      return (
        safeParseInt(f.tvdbId) !== null &&
        !!f.rootFolderPath &&
        safeParseInt(f.qualityProfileId) !== null
      );
    }
    return (
      safeParseInt(f.tmdbId) !== null &&
      !!f.rootFolderPath &&
      safeParseInt(f.qualityProfileId) !== null
    );
  };

  return (
    <Show when={searchableConns().length > 0}>
      <div
        style={{
          animation: "fadeSlideUp 350ms cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        {/* Header row with connection selector */}
        <div class="mb-4 flex items-center gap-3">
          <SectionHeading
            count={searchResults().length}
            isSearch
            label="Integrations"
            searchLabel={`${selectedConn()?.displayName ?? "Integration"} Results`}
          />
          <Show when={searchableConns().length > 1}>
            <div class="relative ml-auto shrink-0">
              <select
                class="appearance-none rounded-lg border border-white/[0.1] bg-white/[0.06] py-1.5 pr-7 pl-3 text-white/70 text-xs outline-none transition-colors hover:border-white/[0.15] focus:border-blue-400/40"
                onChange={(e) => {
                  setSelectedConnId(e.currentTarget.value);
                  setSearchResults([]);
                  setPendingAction(null);
                }}
                value={selectedConnId()}
              >
                <For each={searchableConns()}>
                  {(conn) => (
                    <option
                      class="bg-[#1a1a2e] text-white"
                      value={conn.connectionId}
                    >
                      {conn.displayName}
                    </option>
                  )}
                </For>
              </select>
              <svg
                aria-hidden="true"
                class="-translate-y-1/2 pointer-events-none absolute top-1/2 right-2 h-3 w-3 text-white/30"
                fill="none"
                role="img"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <title>Expand</title>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </Show>
        </div>

        {/* Loading state */}
        <Show when={searchMutation.isPending}>
          <div class="flex items-center gap-2 py-6 text-sm text-white/30">
            <InlineLoading size="sm" />
            <span>Searching {selectedConn()?.displayName}…</span>
          </div>
        </Show>

        {/* Results */}
        <Show when={!searchMutation.isPending && searchResults().length > 0}>
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
            <For each={searchResults()}>
              {(result) => (
                <div class="group relative">
                  {/* Poster card */}
                  <div class="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] shadow-[0_2px_12px_rgba(0,0,0,0.3)] transition-all duration-300 group-hover:border-white/[0.12] group-hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                    <div class="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-blue-400/0 to-transparent transition-all duration-300 group-hover:via-blue-400/40" />
                    <div class="aspect-2/3 overflow-hidden">
                      <Show
                        fallback={
                          <div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-950/20 to-slate-950/30">
                            <span class="font-bold text-3xl text-white/15">
                              {result.title.charAt(0)}
                            </span>
                          </div>
                        }
                        when={result.posterUrl}
                      >
                        {(url) => (
                          <img
                            alt={result.title}
                            class="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                            loading="lazy"
                            src={url()}
                          />
                        )}
                      </Show>
                    </div>

                    {/* Gradient overlay */}
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                    {/* Plugin badge */}
                    <div class="absolute top-2 left-2 z-10 rounded border border-white/10 bg-black/50 px-1.5 py-0.5 font-semibold text-[9px] text-white/55 uppercase tracking-wider backdrop-blur-sm">
                      {selectedConn()?.pluginId}
                    </div>

                    {/* Action buttons overlay — appear on hover */}
                    <div class="absolute right-1.5 bottom-12 left-1.5 z-20 flex flex-wrap justify-end gap-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <For
                        each={actionCapabilities(
                          selectedConn()?.pluginId ?? ""
                        )}
                      >
                        {(cap) => (
                          <button
                            class="cursor-pointer rounded-md border border-white/10 bg-black/60 px-2 py-1 font-medium text-[10px] text-white/70 uppercase tracking-wide backdrop-blur-sm transition-all hover:border-blue-400/30 hover:bg-blue-500/20 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={actionMutation.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              openActionForm(cap, result);
                            }}
                            type="button"
                          >
                            {CAPABILITY_LABELS[cap]}
                          </button>
                        )}
                      </For>
                    </div>

                    {/* Title area */}
                    <div class="absolute right-0 bottom-0 left-0 p-2.5">
                      <h3 class="line-clamp-2 font-semibold text-white text-xs leading-tight drop-shadow-lg">
                        {result.title}
                      </h3>
                      <Show when={result.year}>
                        <span class="text-[10px] text-white/40">
                          {result.year}
                        </span>
                      </Show>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* Empty state */}
        <Show
          when={
            !searchMutation.isPending &&
            searchResults().length === 0 &&
            searchMutation.isSuccess
          }
        >
          <SectionEmpty
            label={`${selectedConn()?.displayName ?? "integration"} results`}
          />
        </Show>

        {/* Action form modal */}
        <Show when={pendingAction()}>
          {(action) => {
            // --- Escape-to-close ---
            const onKeyDown = (e: KeyboardEvent) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setPendingAction(null);
              }
            };

            // --- Body scroll lock ---
            const origOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";

            // --- Focus into modal on mount ---
            let panelRef: HTMLDivElement | undefined;
            queueMicrotask(() => {
              panelRef?.focus();
            });

            onCleanup(() => {
              document.body.style.overflow = origOverflow;
              document.removeEventListener("keydown", onKeyDown);
            });
            document.addEventListener("keydown", onKeyDown);

            // --- TV seasons query for Jellyseerr ---
            const isJellyseerrTv = createMemo(
              () =>
                action().capability === "request" &&
                actionFields().mediaType === "tv" &&
                selectedConn()?.pluginId === "jellyseerr"
            );
            const tvMediaId = createMemo(() => {
              if (!isJellyseerrTv()) return undefined;
              const n = safeParseInt(actionFields().mediaId);
              return n ?? undefined;
            });
            const tvSeasons = useTvSeasonsQuery(
              () => (isJellyseerrTv() ? selectedConnId() : undefined),
              tvMediaId
            );
            const [selectedSeasons, setSelectedSeasons] = createSignal<
              Set<number>
            >(new Set());

            const toggleSeason = (seasonNum: number) => {
              setSelectedSeasons((prev) => {
                const next = new Set(prev);
                if (next.has(seasonNum)) {
                  next.delete(seasonNum);
                } else {
                  next.add(seasonNum);
                }
                return next;
              });
              // Sync to actionFields for submitAction
              const selected = [...selectedSeasons()];
              if (selectedSeasons().has(seasonNum)) {
                selected.push(seasonNum);
              }
              setField(
                "seasons",
                [...selectedSeasons()].sort((a, b) => a - b).join(",")
              );
            };

            // Sync selectedSeasons signal to the seasons field after toggle
            createEffect(() => {
              const sel = selectedSeasons();
              setField("seasons", [...sel].sort((a, b) => a - b).join(","));
            });

            return (
              <Portal>
              <div
                class="fixed inset-0 z-50 flex items-center justify-center"
                role="dialog"
                aria-modal="true"
                style={{
                  animation: "fadeIn 150ms ease-out both",
                }}
              >
                {/* Backdrop */}
                <button
                  aria-label="Close modal"
                  class="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={() => setPendingAction(null)}
                  type="button"
                />
                {/* Modal panel */}
                <div
                  ref={panelRef}
                  tabIndex={-1}
                  class="relative z-10 mx-4 w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#141420] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.7)] outline-none"
                  style={{
                    animation:
                      "fadeSlideUp 250ms cubic-bezier(0.22,1,0.36,1) both",
                  }}
                >
                  <div class="mb-4 flex items-center justify-between">
                    <div>
                      <h4 class="font-semibold text-sm text-white/90">
                        {CAPABILITY_LABELS[action().capability]} —{" "}
                        {action().result.title}
                      </h4>
                      <p class="mt-0.5 text-white/35 text-xs">
                        Fill required fields before submitting
                      </p>
                    </div>
                    <button
                      class="cursor-pointer rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/60"
                      onClick={() => setPendingAction(null)}
                      type="button"
                    >
                      <svg
                        class="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        viewBox="0 0 24 24"
                      >
                        <title>Close</title>
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div class="space-y-3">
                    {/* Jellyseerr request fields */}
                    <Show when={action().capability === "request"}>
                      <div class="grid grid-cols-2 gap-3">
                        <label class="block">
                          <span class="mb-1 block text-white/40 text-xs">
                            Media Type
                          </span>
                          <select
                            class="w-full appearance-none rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none"
                            onChange={(e) =>
                              setField("mediaType", e.currentTarget.value)
                            }
                            value={actionFields().mediaType ?? "movie"}
                          >
                            <option class="bg-[#1a1a2e]" value="movie">
                              Movie
                            </option>
                            <option class="bg-[#1a1a2e]" value="tv">
                              TV Show
                            </option>
                          </select>
                        </label>
                        <label class="block">
                          <span class="mb-1 block text-white/40 text-xs">
                            Media ID (TMDB)
                          </span>
                          <input
                            class="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/20"
                            onInput={(e) =>
                              setField("mediaId", e.currentTarget.value)
                            }
                            placeholder="e.g. 12345"
                            type="text"
                            value={actionFields().mediaId ?? ""}
                          />
                        </label>
                      </div>
                      <Show when={actionFields().mediaType === "tv"}>
                        {/* API-driven season selection for Jellyseerr */}
                        <Show
                          when={
                            isJellyseerrTv() &&
                            (tvSeasons.data?.length ?? 0) > 0
                          }
                          fallback={
                            <Show when={!isJellyseerrTv()}>
                              <label class="block">
                                <span class="mb-1 block text-white/40 text-xs">
                                  Seasons (comma-separated, optional)
                                </span>
                                <input
                                  class="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/20"
                                  onInput={(e) =>
                                    setField("seasons", e.currentTarget.value)
                                  }
                                  placeholder="e.g. 1,2,3"
                                  type="text"
                                  value={actionFields().seasons ?? ""}
                                />
                              </label>
                            </Show>
                          }
                        >
                          <div>
                            <span class="mb-1.5 block text-white/40 text-xs">
                              Seasons (optional)
                            </span>
                            <Show when={tvSeasons.isPending}>
                              <div class="flex items-center gap-2 py-2 text-xs text-white/30">
                                <InlineLoading size="sm" />
                                <span>Loading seasons…</span>
                              </div>
                            </Show>
                            <div class="flex flex-wrap gap-2">
                              <For each={tvSeasons.data}>
                                {(season) => {
                                  const isSelected = () =>
                                    selectedSeasons().has(season.seasonNumber);
                                  return (
                                    <button
                                      type="button"
                                      class={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                                        isSelected()
                                          ? "border-blue-400/40 bg-blue-500/20 text-blue-300"
                                          : "border-white/[0.1] bg-white/[0.04] text-white/50 hover:border-white/[0.15] hover:bg-white/[0.08] hover:text-white/70"
                                      }`}
                                      onClick={() =>
                                        toggleSeason(season.seasonNumber)
                                      }
                                    >
                                      {season.name}
                                      <Show when={season.episodeCount}>
                                        <span class="ml-1 text-[10px] opacity-60">
                                          ({season.episodeCount} ep)
                                        </span>
                                      </Show>
                                    </button>
                                  );
                                }}
                              </For>
                            </div>
                          </div>
                        </Show>
                      </Show>
                    </Show>

                  {/* Sonarr add series fields */}
                  <Show when={action().capability === "add_series"}>
                    <div class="grid grid-cols-2 gap-3">
                      <label class="block">
                        <span class="mb-1 block text-white/40 text-xs">
                          TVDB ID
                        </span>
                        <input
                          class="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/20"
                          onInput={(e) =>
                            setField("tvdbId", e.currentTarget.value)
                          }
                          placeholder="Auto-filled"
                          type="text"
                          value={actionFields().tvdbId ?? ""}
                        />
                      </label>
                      <label class="block">
                        <span class="mb-1 block text-white/40 text-xs">
                          Title
                        </span>
                        <input
                          class="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/20"
                          onInput={(e) =>
                            setField("title", e.currentTarget.value)
                          }
                          type="text"
                          value={actionFields().title ?? ""}
                        />
                      </label>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <label class="block">
                        <span class="mb-1 block text-white/40 text-xs">
                          Root Folder
                        </span>
                        <Show
                          fallback={
                            <input
                              class="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/20"
                              onInput={(e) =>
                                setField("rootFolderPath", e.currentTarget.value)
                              }
                              placeholder="/tv"
                              type="text"
                              value={actionFields().rootFolderPath ?? ""}
                            />
                          }
                          when={(rootFolders.data?.length ?? 0) > 0}
                        >
                          <select
                            class="w-full appearance-none rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none"
                            onChange={(e) =>
                              setField("rootFolderPath", e.currentTarget.value)
                            }
                            value={actionFields().rootFolderPath ?? ""}
                          >
                            <option class="bg-[#1a1a2e]" value="">
                              — Select —
                            </option>
                            <For each={rootFolders.data}>
                              {(opt) => (
                                <option class="bg-[#1a1a2e]" value={opt.name}>
                                  {opt.name}
                                </option>
                              )}
                            </For>
                          </select>
                        </Show>
                      </label>
                      <label class="block">
                        <span class="mb-1 block text-white/40 text-xs">
                          Quality Profile
                        </span>
                        <Show
                          fallback={
                            <input
                              class="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/20"
                              onInput={(e) =>
                                setField(
                                  "qualityProfileId",
                                  e.currentTarget.value
                                )
                              }
                              placeholder="e.g. 1"
                              type="number"
                              value={actionFields().qualityProfileId ?? ""}
                            />
                          }
                          when={(qualityProfiles.data?.length ?? 0) > 0}
                        >
                          <select
                            class="w-full appearance-none rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none"
                            onChange={(e) =>
                              setField("qualityProfileId", e.currentTarget.value)
                            }
                            value={actionFields().qualityProfileId ?? ""}
                          >
                            <option class="bg-[#1a1a2e]" value="">
                              — Select —
                            </option>
                            <For each={qualityProfiles.data}>
                              {(opt) => (
                                <option
                                  class="bg-[#1a1a2e]"
                                  value={String(opt.id)}
                                >
                                  {opt.name}
                                </option>
                              )}
                            </For>
                          </select>
                        </Show>
                      </label>
                    </div>
                  </Show>

                  {/* Radarr add movie fields */}
                  <Show when={action().capability === "add_movie"}>
                    <div class="grid grid-cols-2 gap-3">
                      <label class="block">
                        <span class="mb-1 block text-white/40 text-xs">
                          TMDB ID
                        </span>
                        <input
                          class="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/20"
                          onInput={(e) =>
                            setField("tmdbId", e.currentTarget.value)
                          }
                          placeholder="Auto-filled"
                          type="text"
                          value={actionFields().tmdbId ?? ""}
                        />
                      </label>
                      <label class="block">
                        <span class="mb-1 block text-white/40 text-xs">
                          Title
                        </span>
                        <input
                          class="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/20"
                          onInput={(e) =>
                            setField("title", e.currentTarget.value)
                          }
                          type="text"
                          value={actionFields().title ?? ""}
                        />
                      </label>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <label class="block">
                        <span class="mb-1 block text-white/40 text-xs">
                          Root Folder
                        </span>
                        <Show
                          fallback={
                            <input
                              class="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/20"
                              onInput={(e) =>
                                setField("rootFolderPath", e.currentTarget.value)
                              }
                              placeholder="/movies"
                              type="text"
                              value={actionFields().rootFolderPath ?? ""}
                            />
                          }
                          when={(rootFolders.data?.length ?? 0) > 0}
                        >
                          <select
                            class="w-full appearance-none rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none"
                            onChange={(e) =>
                              setField("rootFolderPath", e.currentTarget.value)
                            }
                            value={actionFields().rootFolderPath ?? ""}
                          >
                            <option class="bg-[#1a1a2e]" value="">
                              — Select —
                            </option>
                            <For each={rootFolders.data}>
                              {(opt) => (
                                <option class="bg-[#1a1a2e]" value={opt.name}>
                                  {opt.name}
                                </option>
                              )}
                            </For>
                          </select>
                        </Show>
                      </label>
                      <label class="block">
                        <span class="mb-1 block text-white/40 text-xs">
                          Quality Profile
                        </span>
                        <Show
                          fallback={
                            <input
                              class="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/20"
                              onInput={(e) =>
                                setField(
                                  "qualityProfileId",
                                  e.currentTarget.value
                                )
                              }
                              placeholder="e.g. 1"
                              type="number"
                              value={actionFields().qualityProfileId ?? ""}
                            />
                          }
                          when={(qualityProfiles.data?.length ?? 0) > 0}
                        >
                          <select
                            class="w-full appearance-none rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2 text-sm text-white/80 outline-none"
                            onChange={(e) =>
                              setField("qualityProfileId", e.currentTarget.value)
                            }
                            value={actionFields().qualityProfileId ?? ""}
                          >
                            <option class="bg-[#1a1a2e]" value="">
                              — Select —
                            </option>
                            <For each={qualityProfiles.data}>
                              {(opt) => (
                                <option
                                  class="bg-[#1a1a2e]"
                                  value={String(opt.id)}
                                >
                                  {opt.name}
                                </option>
                              )}
                            </For>
                          </select>
                        </Show>
                      </label>
                    </div>
                  </Show>

                  <button
                    class="mt-1 w-full cursor-pointer rounded-lg bg-blue-500/20 px-4 py-2.5 font-medium text-blue-300 text-sm transition-all hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!actionFormValid() || actionMutation.isPending}
                    onClick={submitAction}
                    type="button"
                  >
                    {actionMutation.isPending
                      ? "Submitting…"
                      : `Submit ${CAPABILITY_LABELS[action().capability]}`}
                  </button>
                </div>
              </div>
            </div>
              </Portal>
            );
          }}
        </Show>
      </div>
    </Show>
  );
}

// ── Search active banner ─────────────────────────────────────────────────────
function SearchActiveBanner(props: { term: string }) {
  return (
    <div
      class="flex items-center gap-2.5 rounded-xl border border-blue-400/15 bg-blue-400/[0.06] px-4 py-3 text-blue-200/90 text-sm"
      style={{
        animation: "fadeSlideUp 250ms cubic-bezier(0.22,1,0.36,1) both",
      }}
    >
      {/* Pulsing dot */}
      <span
        class="h-2 w-2 shrink-0 rounded-full bg-blue-400"
        style={{ animation: "liveDot 1.4s ease-in-out infinite" }}
      />
      <span>
        Showing results for{" "}
        <strong class="font-semibold text-blue-100">"{props.term}"</strong>
      </span>
    </div>
  );
}

// ── Featured Hero — full-bleed banner from top edge, dissolves at ~40% vh ────
function FeaturedHero(props: {
  item: {
    Id?: string | null;
    Name?: string | null;
    Overview?: string | null;
    Image?: string;
    ProductionYear?: number | null;
    SeriesName?: string | null;
    Type?: string | null;
    ParentIndexNumber?: number | null;
    IndexNumber?: number | null;
    SeasonName?: string | null;
    UserData?: {
      Played?: boolean | null;
      IsFavorite?: boolean | null;
      PlayedPercentage?: number | null;
      PlaybackPositionTicks?: number | null;
    };
  };
}) {
  const episodeLabel = () => {
    if (props.item.Type !== "Episode") {
      return null;
    }
    const s = props.item.ParentIndexNumber;
    const e = props.item.IndexNumber;
    if (s != null && e != null) {
      return `S${s} E${e}`;
    }
    if (e != null) {
      return `E${e}`;
    }
    return null;
  };

  return (
    <div
      class="hero-banner-fullbleed"
      style={{
        animation: "heroReveal 700ms cubic-bezier(0.22,1,0.36,1) both",
      }}
    >
      {/* Hero backdrop — occupies top of viewport, dissolves at mid */}
      <div class="relative h-[75vh] max-h-[720px] min-h-[420px] w-full overflow-hidden">
        <Show
          fallback={
            <div class="h-full w-full bg-gradient-to-br from-blue-950/40 to-slate-950/60" />
          }
          when={props.item.Image}
        >
          <img
            alt={props.item.Name ?? "Featured"}
            class="h-full w-full object-cover object-[center_20%] transition-transform duration-[1.2s] ease-out"
            src={props.item.Image}
            style={{ animation: "heroZoom 20s ease-in-out alternate infinite" }}
          />
        </Show>

        {/* Dissolve mask — heavy bottom fade starts at ~40% and fully opaque by bottom */}
        <div
          class="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, transparent 15%, var(--app-bg) 85%, var(--app-bg) 100%)",
            mask: "linear-gradient(to bottom, transparent 0%, transparent 10%, black 90%)",
            "-webkit-mask":
              "linear-gradient(to bottom, transparent 0%, transparent 10%, black 90%)",
          }}
        />
        {/* Cinematic bottom dissolve — smooth edge */}
        <div class="absolute inset-0 bg-gradient-to-t from-[var(--app-bg)] via-[var(--app-bg)]/60 to-transparent" />
        {/* Side fade for left readability */}
        <div class="absolute inset-0 bg-gradient-to-r from-[var(--app-bg)]/80 via-[var(--app-bg)]/15 to-transparent" />
        {/* Subtle vignette for cinematic framing */}
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,transparent_50%,var(--app-bg)_100%)] opacity-50" />

        {/* Content overlay — positioned in the lower-middle dissolve zone */}
        <div class="absolute right-0 bottom-0 left-0 px-8 pb-12 sm:px-10 sm:pb-16 lg:px-12">
          <div class="max-w-lg space-y-4">
            {/* Type badge with subtle glow */}
            <Show when={props.item.Type}>
              <span
                class="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.06] px-2.5 py-1 font-semibold text-[10px] text-white/55 uppercase tracking-widest backdrop-blur-sm"
                style={{
                  animation:
                    "fadeSlideUp 500ms cubic-bezier(0.22,1,0.36,1) 200ms both",
                }}
              >
                <span class="h-1.5 w-1.5 rounded-full bg-blue-400/70" />
                {props.item.Type === "Episode"
                  ? "Continue Watching"
                  : "Featured"}
              </span>
            </Show>

            {/* Series name for episodes */}
            <Show when={props.item.SeriesName}>
              <p
                class="font-medium text-blue-300/60 text-sm uppercase tracking-widest"
                style={{
                  animation:
                    "fadeSlideUp 500ms cubic-bezier(0.22,1,0.36,1) 250ms both",
                }}
              >
                {props.item.SeriesName}
              </p>
            </Show>

            {/* Title — larger, bolder billboard type */}
            <h1
              class="font-bold text-3xl text-white tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] sm:text-4xl lg:text-5xl"
              style={{
                animation:
                  "fadeSlideUp 600ms cubic-bezier(0.22,1,0.36,1) 300ms both",
              }}
            >
              {props.item.Name}
            </h1>

            {/* Meta row */}
            <div
              class="flex items-center gap-3"
              style={{
                animation:
                  "fadeSlideUp 500ms cubic-bezier(0.22,1,0.36,1) 400ms both",
              }}
            >
              <Show when={episodeLabel()}>
                <span class="rounded border border-white/[0.08] bg-white/[0.06] px-2 py-0.5 font-semibold text-[10px] text-white/55 uppercase tracking-wider">
                  {episodeLabel()}
                </span>
              </Show>
              <Show when={props.item.ProductionYear}>
                <span class="rounded border border-white/[0.08] px-2 py-0.5 text-white/45 text-xs tabular-nums">
                  {props.item.ProductionYear}
                </span>
              </Show>
              <Show when={props.item.SeasonName}>
                <span class="text-white/35 text-xs">
                  {props.item.SeasonName}
                </span>
              </Show>
            </div>

            {/* Overview — better readability */}
            <Show when={props.item.Overview}>
              <p
                class="line-clamp-2 max-w-md text-[13px] text-white/40 leading-relaxed sm:text-sm"
                style={{
                  animation:
                    "fadeSlideUp 500ms cubic-bezier(0.22,1,0.36,1) 450ms both",
                }}
              >
                {props.item.Overview}
              </p>
            </Show>

            {/* CTA buttons — primary play + item actions */}
            <div
              class="flex items-center gap-3 pt-1"
              style={{
                animation:
                  "fadeSlideUp 500ms cubic-bezier(0.22,1,0.36,1) 500ms both",
              }}
            >
              <a
                class="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-slate-950 text-sm shadow-[0_4px_24px_rgba(255,255,255,0.1)] transition-all duration-200 hover:bg-white/90 hover:shadow-[0_4px_32px_rgba(255,255,255,0.18)] active:scale-[0.97]"
                href={`/video/${props.item.Id}`}
              >
                <svg class="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <title>Play</title>
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>Play Now</span>
              </a>
              <ItemActions
                class="hero-item-actions [&_button]:border [&_button]:border-white/[0.12] [&_button]:bg-white/[0.08] [&_button]:backdrop-blur-sm [&_button]:hover:border-white/[0.2] [&_button]:hover:bg-white/[0.15]"
                item={props.item as Parameters<typeof ItemActions>[0]["item"]}
                itemId={props.item.Id as string}
                variant="detail"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [searchDraft, setSearchDraft] = createSignal("");
  const [searchTerm, setSearchTerm] = createSignal("");

  const user = useCurrentUserQuery();

  const debouncedSetSearchTerm = debounce(
    (value: string) => setSearchTerm(value),
    300
  );

  const handleSearchChange = (value: string) => {
    setSearchDraft(value);
    if (value === "") {
      // Clear immediately for Escape / clear-button responsiveness
      debouncedSetSearchTerm.clear();
      setSearchTerm("");
    } else {
      debouncedSetSearchTerm(value);
    }
  };

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

  const hasHero = () => {
    if (searchTerm()) {
      return false;
    }
    const data = resumeItems.data;
    return data && data.length > 0;
  };

  // Restore focus to the search input after the hero→search-results layout
  // transition.  When the debounced `searchTerm` first becomes non-empty the
  // hero unmounts and the Nav switches from absolute to relative positioning,
  // which causes the browser to drop focus from the input.
  createEffect(
    on(
      () => searchTerm(),
      (term) => {
        if (term) {
          // The DOM reflow happens synchronously after this reactive update.
          // Use rAF so the focus call lands after the browser has reflowed.
          requestAnimationFrame(() => {
            const input = document.querySelector<HTMLInputElement>(
              "[data-search-input]"
            );
            if (input && document.activeElement !== input) {
              input.focus();
            }
          });
        }
      }
    )
  );

  return (
    <section class="h-full w-full">
      <Show when={user.data?.Id}>
        <section class="relative flex flex-col">
          {/* ── Featured Hero — full-bleed from top, nav overlays it ── */}
          <Show when={!searchTerm()}>
            <QueryBoundary
              loadingFallback={null}
              notFoundFallback={null}
              query={resumeItems}
            >
              {(resumeData) => (
                <Show when={resumeData.length > 0}>
                  <FeaturedHero item={resumeData[0]} />
                </Show>
              )}
            </QueryBoundary>
          </Show>

          {/* Navigation Bar — overlays the hero when present, normal flow otherwise */}
          <Nav
            breadcrumbs={[
              {
                label: "Home",
                icon: <HouseIcon class="h-4 w-4 shrink-0 opacity-70" />,
              },
            ]}
            class={hasHero() ? "hero-nav-overlay" : "relative mt-0"}
            onSearchChange={handleSearchChange}
            searchValue={searchDraft()}
            showSearch={true}
            variant="light"
          />

          {/* Content Area — cinematic rail layout with generous spacing */}
          <div class="relative z-20 flex flex-1 flex-col gap-12 px-8 py-8 sm:gap-14 sm:px-10 lg:px-12">
            {/* ── Search active state banner ── */}
            <Show when={searchTerm()}>
              <SearchActiveBanner term={searchTerm()} />
            </Show>

            {/* ── Libraries Section (hidden while searching) ── */}
            <Show when={!searchTerm()}>
              <QueryBoundary
                loadingFallback={
                  <div class="space-y-4">
                    <div class="flex items-center gap-3">
                      <div class="h-4 w-28 animate-pulse rounded-md bg-white/[0.06]" />
                      <InlineLoading class="ml-1 opacity-50" size="sm" />
                    </div>
                    <div class="grid h-36 grid-cols-2 gap-4 sm:h-44 sm:grid-cols-3 lg:h-52 lg:grid-cols-4 xl:grid-cols-6">
                      <For each={Array.from({ length: 4 })}>
                        {() => (
                          <div class="animate-pulse rounded-xl bg-white/[0.04]" />
                        )}
                      </For>
                    </div>
                  </div>
                }
                notFoundFallback={<SectionEmpty label="libraries" />}
                query={libraries}
              >
                {(data) => (
                  <Switch>
                    <Match when={data.length === 0}>
                      <SectionEmpty label="libraries" />
                    </Match>

                    <Match when={data.length > 0}>
                      <div
                        style={{
                          animation:
                            "fadeSlideUp 350ms cubic-bezier(0.22,1,0.36,1) both",
                        }}
                      >
                        <SectionHeading label="Your Libraries" />
                        <div
                          class="grid h-44 gap-4 lg:h-48"
                          style={{
                            "grid-template-columns": `repeat(${Math.min(data.length, 6)}, minmax(0, 1fr))`,
                          }}
                        >
                          <For each={data}>
                            {(item) => (
                              <a
                                class="group block h-full w-full"
                                href={`/library/${item.Id}`}
                              >
                                <div class="relative h-full w-full overflow-hidden rounded-xl border border-white/[0.06] shadow-[0_2px_16px_rgba(0,0,0,0.4)] transition-all duration-300 group-hover:scale-[1.02] group-hover:border-white/[0.12] group-hover:shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
                                  {/* Image */}
                                  <Show
                                    fallback={
                                      <div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-950/30 to-slate-950/40">
                                        <span class="font-bold text-5xl text-white/15">
                                          {item.Name?.charAt(0)}
                                        </span>
                                      </div>
                                    }
                                    when={item.Image}
                                  >
                                    <img
                                      alt={item.Name ?? "Library"}
                                      class="absolute inset-0 h-full w-full scale-[1.08] object-cover transition-transform duration-700 ease-out group-hover:scale-100"
                                      src={item.Image}
                                    />
                                  </Show>

                                  {/* Gradient overlay */}
                                  <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent transition-all duration-300 group-hover:from-black/90 group-hover:via-black/40" />

                                  {/* Blue top edge on hover */}
                                  <div class="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/0 to-transparent transition-all duration-300 group-hover:via-blue-400/40" />

                                  {/* Title */}
                                  <div class="absolute right-0 bottom-0 left-0 p-3.5">
                                    <h3 class="line-clamp-2 font-semibold text-sm text-white drop-shadow-lg">
                                      {item.Name}
                                    </h3>
                                    <Show when={item.CollectionType}>
                                      <p class="mt-0.5 text-white/45 text-xs capitalize tracking-wide">
                                        {item.CollectionType}
                                      </p>
                                    </Show>
                                  </div>
                                </div>
                              </a>
                            )}
                          </For>
                        </div>
                      </div>
                    </Match>
                  </Switch>
                )}
              </QueryBoundary>

              {/* ── Continue Watching ── */}
              <QueryBoundary
                loadingFallback={
                  <LoadingSection
                    aspect="aspect-video"
                    count={4}
                    name="continue watching"
                    variant="video"
                  />
                }
                notFoundFallback={null}
                query={resumeItems}
              >
                {(data) => (
                  <Show when={data.length > 0}>
                    <div
                      style={{
                        animation:
                          "fadeSlideUp 380ms cubic-bezier(0.22,1,0.36,1) both",
                      }}
                    >
                      <SectionHeading
                        count={data.length}
                        label="Continue Watching"
                      />
                      {/* Responsive grid */}
                      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        <For each={data.slice(0, 4)}>
                          {(item) => {
                            const progressPercentage =
                              item.UserData?.PlayedPercentage || 0;
                            const isEpisode = item.Type === "Episode";
                            const isMovie = item.Type === "Movie";

                            const remainingMinutes = (() => {
                              const totalTicks = item.RunTimeTicks ?? 0;
                              const pos =
                                item.UserData?.PlaybackPositionTicks ?? 0;
                              if (totalTicks === 0 || pos === 0) {
                                return null;
                              }
                              const remainingTicks = totalTicks - pos;
                              const mins = Math.round(
                                remainingTicks / 600_000_000
                              );
                              if (mins <= 0) {
                                return null;
                              }
                              if (mins < 60) {
                                return `${mins}m left`;
                              }
                              const h = Math.floor(mins / 60);
                              const m = mins % 60;
                              return m > 0 ? `${h}h ${m}m left` : `${h}h left`;
                            })();

                            const episodeLabel = (() => {
                              if (!isEpisode) {
                                return null;
                              }
                              const s = item.ParentIndexNumber;
                              const e = item.IndexNumber;
                              if (s != null && e != null) {
                                return `S${s} E${e}`;
                              }
                              if (e != null) {
                                return `E${e}`;
                              }
                              return null;
                            })();

                            return (
                              <a class="group block" href={`/video/${item.Id}`}>
                                <div class="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] shadow-[0_2px_12px_rgba(0,0,0,0.3)] transition-all duration-300 group-hover:scale-[1.02] group-hover:border-white/[0.12] group-hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                                  {/* Blue top-edge accent on hover */}
                                  <div class="pointer-events-none absolute inset-x-0 top-0 z-30 h-px bg-gradient-to-r from-transparent via-blue-400/0 to-transparent transition-all duration-300 group-hover:via-blue-400/40" />

                                  <div
                                    class="relative overflow-hidden rounded-t-xl"
                                    style="aspect-ratio: 16/8"
                                  >
                                    <Show
                                      fallback={
                                        <div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-950/20 to-slate-950/30">
                                          <span class="font-bold text-3xl text-white/15">
                                            {item.Name?.charAt(0)}
                                          </span>
                                        </div>
                                      }
                                      when={item.Image}
                                    >
                                      <img
                                        alt={item.Name ?? "Item"}
                                        class="h-full w-full scale-[1.06] object-cover transition-transform duration-700 ease-out group-hover:scale-100"
                                        loading="lazy"
                                        src={item.Image}
                                      />
                                    </Show>

                                    {/* Cinematic gradient */}
                                    <div class="absolute inset-0 bg-gradient-to-t from-black/88 via-black/20 to-transparent" />

                                    {/* Play button — appears on hover */}
                                    <div class="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                      <div class="scale-75 rounded-full border border-white/20 bg-white/10 p-3 shadow-[0_0_24px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all duration-300 group-hover:scale-100 group-hover:border-white/30 group-hover:bg-white/15 group-hover:shadow-[0_0_32px_rgba(100,160,255,0.12)]">
                                        <svg
                                          class="h-5 w-5 fill-white transition-colors duration-300"
                                          viewBox="0 0 24 24"
                                        >
                                          <title>Play</title>
                                          <path d="M8 5v14l11-7z" />
                                        </svg>
                                      </div>
                                    </div>

                                    {/* "Resume" chip */}
                                    <div class="absolute top-2 left-2 z-10 flex items-center gap-1 rounded border border-white/10 bg-white/[0.08] px-1.5 py-0.5 backdrop-blur-sm">
                                      <svg
                                        aria-hidden="true"
                                        class="h-2 w-2 shrink-0 text-blue-400"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path d="M8 5v14l11-7z" />
                                      </svg>
                                      <span class="font-semibold text-[9px] text-white/60 uppercase tracking-widest">
                                        Resume
                                      </span>
                                    </div>

                                    {/* Episode label */}
                                    <Show when={episodeLabel}>
                                      <div class="absolute top-2 right-2 z-10 rounded border border-white/10 bg-black/50 px-1.5 py-0.5 font-semibold text-[9px] text-white/55 uppercase tracking-wider backdrop-blur-sm">
                                        {episodeLabel}
                                      </div>
                                    </Show>

                                    {/* Item Actions */}
                                    <div class="absolute top-1.5 right-1.5 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                      <ItemActions
                                        item={item}
                                        itemId={item.Id as string}
                                        variant="card"
                                      />
                                    </div>

                                    {/* Metadata footer */}
                                    <div class="absolute right-0 bottom-0 left-0 px-2.5 pt-4 pb-2.5">
                                      <Show when={isEpisode && item.SeriesName}>
                                        <p class="mb-px line-clamp-1 font-semibold text-[10px] text-white/40 uppercase tracking-wide drop-shadow-lg">
                                          {item.SeriesName}
                                        </p>
                                      </Show>
                                      <h3 class="line-clamp-1 font-bold text-white text-xs drop-shadow-lg">
                                        {item.Name}
                                      </h3>
                                      <div class="mt-0.5 flex items-center gap-1.5">
                                        <Show
                                          when={isMovie && item.ProductionYear}
                                        >
                                          <span class="text-[10px] text-white/35 drop-shadow-md">
                                            {item.ProductionYear}
                                          </span>
                                        </Show>
                                        <Show
                                          when={
                                            isEpisode &&
                                            item.SeasonName &&
                                            !episodeLabel
                                          }
                                        >
                                          <span class="text-[10px] text-white/35 drop-shadow-md">
                                            {item.SeasonName}
                                          </span>
                                        </Show>
                                        <Show when={remainingMinutes}>
                                          <span class="ml-auto rounded-sm bg-black/40 px-1 py-px font-medium text-[9px] text-white/40 tabular-nums backdrop-blur-sm">
                                            {remainingMinutes}
                                          </span>
                                        </Show>
                                      </div>
                                    </div>

                                    {/* Progress bar — thin, glowing blue */}
                                    <Show
                                      when={
                                        progressPercentage > 0 &&
                                        progressPercentage < 100
                                      }
                                    >
                                      <div class="absolute right-0 bottom-0 left-0 h-[3px] bg-white/[0.06]">
                                        <div
                                          class="h-full rounded-r-full bg-blue-400 shadow-[0_0_6px_rgba(100,160,255,0.5)] transition-all duration-500"
                                          style={`width: ${progressPercentage}%`}
                                        />
                                      </div>
                                    </Show>
                                  </div>
                                </div>
                              </a>
                            );
                          }}
                        </For>
                      </div>
                    </div>
                  </Show>
                )}
              </QueryBoundary>

              {/* ── Next Up ── */}
              <QueryBoundary
                loadingFallback={
                  <LoadingSection
                    aspect="aspect-video"
                    count={4}
                    name="next up"
                    variant="video"
                  />
                }
                notFoundFallback={null}
                query={nextupItems}
              >
                {(data) => (
                  <Show when={data.length > 0}>
                    <div
                      style={{
                        animation:
                          "fadeSlideUp 410ms cubic-bezier(0.22,1,0.36,1) both",
                      }}
                    >
                      <SectionHeading count={data.length} label="Next Up" />
                      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        <For each={data}>
                          {(item) => <MainPageEpisodeCard item={item} />}
                        </For>
                      </div>
                    </div>
                  </Show>
                )}
              </QueryBoundary>
            </Show>

            {/* ── Latest / Search Movies ── */}
            <QueryBoundary
              loadingFallback={
                <LoadingSection
                  aspect="aspect-2/3"
                  count={7}
                  name={searchTerm() ? "movies" : "latest movies"}
                  variant="poster"
                />
              }
              notFoundFallback={
                searchTerm() ? (
                  <div
                    class="space-y-3"
                    style={{
                      animation:
                        "fadeSlideUp 300ms cubic-bezier(0.22,1,0.36,1) both",
                    }}
                  >
                    <SectionHeading isSearch label="Movies" />
                    <div class="flex flex-col items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] py-10 text-center">
                      <p class="text-sm text-white/35">
                        No movies match "{searchTerm()}"
                      </p>
                    </div>
                  </div>
                ) : null
              }
              query={latestMovies}
            >
              {(data) => (
                <Show when={data.length > 0}>
                  <div
                    style={{
                      animation:
                        "fadeSlideUp 440ms cubic-bezier(0.22,1,0.36,1) both",
                    }}
                  >
                    <SectionHeading
                      count={data.length}
                      isSearch={!!searchTerm()}
                      label="Latest Movies"
                      searchLabel="Movies"
                    />
                    <div class="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
                      <For each={data}>
                        {(item) => <SeriesCard item={item} />}
                      </For>
                    </div>
                  </div>
                </Show>
              )}
            </QueryBoundary>

            {/* ── Latest / Search TV Shows ── */}
            <QueryBoundary
              loadingFallback={
                <LoadingSection
                  aspect="aspect-2/3"
                  count={7}
                  name={searchTerm() ? "tv shows" : "latest tv shows"}
                  variant="poster"
                />
              }
              notFoundFallback={
                searchTerm() ? (
                  <div
                    class="space-y-3"
                    style={{
                      animation:
                        "fadeSlideUp 300ms cubic-bezier(0.22,1,0.36,1) both",
                    }}
                  >
                    <SectionHeading isSearch label="TV Shows" />
                    <div class="flex flex-col items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] py-10 text-center">
                      <p class="text-sm text-white/35">
                        No TV shows match "{searchTerm()}"
                      </p>
                    </div>
                  </div>
                ) : null
              }
              query={latestTVShows}
            >
              {(data) => (
                <Show when={data.length > 0}>
                  <div
                    style={{
                      animation:
                        "fadeSlideUp 470ms cubic-bezier(0.22,1,0.36,1) both",
                    }}
                  >
                    <SectionHeading
                      count={data.length}
                      isSearch={!!searchTerm()}
                      label="Latest TV Shows"
                      searchLabel="TV Shows"
                    />
                    <div class="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
                      <For each={data}>
                        {(item) => <SeriesCard item={item} />}
                      </For>
                    </div>
                  </div>
                </Show>
              )}
            </QueryBoundary>

            {/* ── Plugin / Integration Search Results ── */}
            <Show when={searchTerm()}>
              <PluginSearchSection searchTerm={searchTerm()} />
            </Show>
          </div>
        </section>
      </Show>
    </section>
  );
}
