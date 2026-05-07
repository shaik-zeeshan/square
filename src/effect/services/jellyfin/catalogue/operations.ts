import type {
  ItemsApiGetItemsRequest,
  MediaInfoApiGetPlaybackInfoRequest,
} from "@jellyfin/sdk/lib/generated-client";
import type { SolidQueryOptions } from "@tanstack/solid-query";
import { Effect, pipe } from "effect";
import type { Accessor } from "solid-js";
import {
  createEffectMutation,
  createEffectQuery,
  createQueryDataHelpers,
  createQueryKey,
  type ExtractQueryData,
} from "~/effect/tanstack/query";
import { safeAssign } from "~/lib/utils";
import { JellyfinCatalogueService } from "./service";
import type { Library, MediaItem, PlaybackMetadata } from "./types";

const LIBRARIES_TIMEOUT = "10 seconds";

type ItemQueryOptions = Accessor<
  Omit<
    SolidQueryOptions<
      MediaItem,
      unknown,
      MediaItem,
      ReturnType<typeof JellyfinCatalogueOperations.itemQueryKey>
    >,
    "queryFn" | "queryKey"
  >
>;

type PlaybackMetadataQueryOptions = Accessor<
  Omit<
    SolidQueryOptions<
      PlaybackMetadata,
      unknown,
      PlaybackMetadata,
      ReturnType<typeof JellyfinCatalogueOperations.playbackMetadataQueryKey>
    >,
    "queryFn" | "queryKey"
  >
>;

class JellyfinCatalogue {
  librariesQueryKey = createQueryKey("catalogueLibraries");
  librariesQueryDataHelpers = createQueryDataHelpers<Library[]>(
    this.librariesQueryKey
  );
  getLibraries = () =>
    createEffectQuery(() => ({
      queryKey: this.librariesQueryKey(),
      queryFn: () =>
        JellyfinCatalogueService.pipe(
          Effect.flatMap((catalogue) => catalogue.libraries()),
          Effect.timeout(LIBRARIES_TIMEOUT)
        ),
    }));

  resumeRailQueryKey = createQueryKey("catalogueResumeRail");
  resumeRailQueryDataHelpers = createQueryDataHelpers<MediaItem[]>(
    this.resumeRailQueryKey
  );
  getResumeRail = () =>
    createEffectQuery(() => ({
      queryKey: this.resumeRailQueryKey(),
      queryFn: () =>
        JellyfinCatalogueService.pipe(
          Effect.flatMap((catalogue) => catalogue.resumeRail())
        ),
    }));

  nextUpRailQueryKey = createQueryKey("catalogueNextUpRail");
  nextUpRailQueryDataHelpers = createQueryDataHelpers<MediaItem[]>(
    this.nextUpRailQueryKey
  );
  getNextUpRail = () =>
    createEffectQuery(() => ({
      queryKey: this.nextUpRailQueryKey(),
      queryFn: () =>
        JellyfinCatalogueService.pipe(
          Effect.flatMap((catalogue) => catalogue.nextUpRail({ limit: 4 }))
        ),
    }));

  latestMoviesQueryKey = createQueryKey<
    "catalogueLatestMovies",
    { search: string }
  >("catalogueLatestMovies");
  latestMoviesQueryDataHelpers = createQueryDataHelpers<
    MediaItem[],
    { search: string }
  >(this.latestMoviesQueryKey);
  getLatestMovies = (searchTerm: () => string, libraries?: Library[]) =>
    createEffectQuery(() => {
      const search = searchTerm();
      const movieLibraryId = libraries?.find(
        (library) => library.collectionType === "movies"
      )?.id;

      return {
        queryKey: this.latestMoviesQueryKey({ search }),
        queryFn: () =>
          JellyfinCatalogueService.pipe(
            Effect.flatMap((catalogue) =>
              search
                ? catalogue.items({
                    parentId: movieLibraryId,
                    enableImages: true,
                    fields: ["ParentId"],
                    includeItemTypes: ["Movie"],
                    limit: 7,
                    recursive: true,
                    searchTerm: search,
                  })
                : catalogue.latestMovieRail({ limit: 7 })
            )
          ),
        enabled: libraries?.some(
          (library) => library.collectionType === "movies"
        ),
      };
    });

  latestTVShowsQueryKey = createQueryKey<
    "catalogueLatestTVShows",
    { search: string }
  >("catalogueLatestTVShows");
  latestTVShowsQueryDataHelpers = createQueryDataHelpers<
    MediaItem[],
    { search: string }
  >(this.latestTVShowsQueryKey);
  getLatestTVShows = (searchTerm: () => string, libraries?: Library[]) =>
    createEffectQuery(() => {
      const search = searchTerm();
      const tvLibraryId = libraries?.find(
        (library) => library.collectionType === "tvshows"
      )?.id;

      return {
        queryKey: this.latestTVShowsQueryKey({ search }),
        queryFn: () =>
          JellyfinCatalogueService.pipe(
            Effect.flatMap((catalogue) =>
              search
                ? catalogue.items({
                    parentId: tvLibraryId,
                    enableImages: true,
                    fields: ["ParentId"],
                    includeItemTypes: ["Series"],
                    limit: 7,
                    recursive: true,
                    searchTerm: search,
                  })
                : catalogue.latestTvRail({ limit: 7 })
            )
          ),
        enabled: libraries?.some(
          (library) => library.collectionType === "tvshows"
        ),
      };
    });

  itemQueryKey = createQueryKey<"catalogueItem", { id: string }>(
    "catalogueItem"
  );
  itemQueryDataHelpers = createQueryDataHelpers<
    ExtractQueryData<ReturnType<typeof this.getItem>>,
    { id: string }
  >(this.itemQueryKey);
  getItem = (
    id: () => string,
    params?: ItemsApiGetItemsRequest,
    queryOptions?: ItemQueryOptions
  ) =>
    createEffectQuery(() => ({
      queryKey: this.itemQueryKey({ id: id() }),
      queryFn: () =>
        JellyfinCatalogueService.pipe(
          Effect.flatMap((catalogue) =>
            catalogue.itemById(id(), { enableImages: true, ...params })
          )
        ),
      ...(queryOptions ? queryOptions() : {}),
    }));

  itemsQueryKey = createQueryKey<
    "catalogueItems",
    { parentId?: string; ids?: string[]; searchTerm?: string }
  >("catalogueItems");
  itemsQueryDataHelpers = createQueryDataHelpers<
    MediaItem[],
    { parentId?: string; ids?: string[]; searchTerm?: string }
  >(this.itemsQueryKey);
  getItems = (
    params?:
      | ItemsApiGetItemsRequest
      | Accessor<ItemsApiGetItemsRequest | undefined>
  ) =>
    createEffectQuery(() => {
      const request = typeof params === "function" ? params() : params;

      return {
        queryKey: this.itemsQueryKey({
          parentId: request?.parentId,
          ids: request?.ids,
          searchTerm: request?.searchTerm,
        }),
        queryFn: () =>
          JellyfinCatalogueService.pipe(
            Effect.flatMap((catalogue) =>
              catalogue.items({ enableImages: true, ...request })
            )
          ),
      };
    });

  getNextEpisode = (item: () => MediaItem | undefined) =>
    createEffectQuery(() => ({
      queryKey: ["catalogueNextEpisode", { id: item()?.id }] as const,
      queryFn: () =>
        pipe(
          Effect.fromNullable(item()),
          Effect.flatMap((mediaItem) =>
            JellyfinCatalogueService.pipe(
              Effect.flatMap((catalogue) => catalogue.nextEpisode(mediaItem))
            )
          )
        ),
      enabled: () => Boolean(item()?.id),
    }));

  playbackMetadataQueryKey = createQueryKey<
    "cataloguePlaybackMetadata",
    { id: string }
  >("cataloguePlaybackMetadata");
  playbackMetadataDataHelpers = createQueryDataHelpers<
    PlaybackMetadata,
    { id: string }
  >(this.playbackMetadataQueryKey);
  getPlaybackMetadata = (
    id: () => string,
    params?: MediaInfoApiGetPlaybackInfoRequest,
    queryOptions?: PlaybackMetadataQueryOptions
  ) =>
    createEffectQuery(() => ({
      queryKey: this.playbackMetadataQueryKey({ id: id() }),
      queryFn: () =>
        JellyfinCatalogueService.pipe(
          Effect.flatMap((catalogue) => catalogue.playbackMetadata(id(), params))
        ),
      ...(queryOptions ? queryOptions() : {}),
    }));

  markItemPlayed = (id: string, onDone?: () => Promise<void> | void) =>
    createEffectMutation(() => ({
      mutationKey: ["catalogueMarkItemPlayed"],
      mutationFn: () =>
        Effect.gen(
          function* (this: JellyfinCatalogue) {
            this.itemQueryDataHelpers.cancelQuery({ id });
            const service = yield* JellyfinCatalogueService;
            const prevData = this.itemQueryDataHelpers.getData({ id });

            this.itemQueryDataHelpers.setData({ id }, (data) => {
              safeAssign(data, "userData", { played: true });
            });

            yield* service.markItemPlayed(id).pipe(
              Effect.catchTag("MutationError", (error) => {
                if (prevData) {
                  this.itemQueryDataHelpers.setData({ id }, prevData);
                }
                return Effect.fail(error);
              })
            );

            yield* Effect.promise(async () => {
              await this.itemQueryDataHelpers.invalidateQuery({ id });
              await onDone?.();
            });
          }.bind(this)
        ),
    }));

  markItemUnPlayed = (id: string, onDone?: () => Promise<void> | void) =>
    createEffectMutation(() => ({
      mutationKey: ["catalogueMarkItemUnPlayed"],
      mutationFn: () =>
        Effect.gen(
          function* (this: JellyfinCatalogue) {
            this.itemQueryDataHelpers.cancelQuery({ id });
            const service = yield* JellyfinCatalogueService;
            const prevData = this.itemQueryDataHelpers.getData({ id });

            this.itemQueryDataHelpers.setData({ id }, (data) => {
              safeAssign(data, "userData", {
                played: false,
                playbackPositionTicks: 0,
              });
            });

            yield* service.markItemUnPlayed(id).pipe(
              Effect.catchTag("MutationError", (error) => {
                if (prevData) {
                  this.itemQueryDataHelpers.setData({ id }, prevData);
                }
                return Effect.fail(error);
              })
            );

            yield* Effect.promise(async () => {
              await this.itemQueryDataHelpers.invalidateQuery({ id });
              await onDone?.();
            });
          }.bind(this)
        ),
    }));

  markItemFavorite = (id: string, onDone?: () => Promise<void> | void) =>
    createEffectMutation(() => ({
      mutationKey: ["catalogueMarkItemFavorite"],
      mutationFn: () =>
        Effect.gen(
          function* (this: JellyfinCatalogue) {
            this.itemQueryDataHelpers.cancelQuery({ id });
            const service = yield* JellyfinCatalogueService;
            const prevData = this.itemQueryDataHelpers.getData({ id });

            this.itemQueryDataHelpers.setData({ id }, (data) => {
              safeAssign(data, "userData", { favorite: true });
            });

            yield* service.markItemFavorite(id).pipe(
              Effect.catchTag("MutationError", (error) => {
                if (prevData) {
                  this.itemQueryDataHelpers.setData({ id }, prevData);
                }
                return Effect.fail(error);
              })
            );

            yield* Effect.promise(async () => {
              await this.itemQueryDataHelpers.invalidateQuery({ id });
              await onDone?.();
            });
          }.bind(this)
        ),
    }));

  markItemUnFavorite = (id: string, onDone?: () => Promise<void> | void) =>
    createEffectMutation(() => ({
      mutationKey: ["catalogueMarkItemUnFavorite"],
      mutationFn: () =>
        Effect.gen(
          function* (this: JellyfinCatalogue) {
            this.itemQueryDataHelpers.cancelQuery({ id });
            const service = yield* JellyfinCatalogueService;
            const prevData = this.itemQueryDataHelpers.getData({ id });

            this.itemQueryDataHelpers.setData({ id }, (data) => {
              safeAssign(data, "userData", { favorite: false });
            });

            yield* service.markItemUnFavorite(id).pipe(
              Effect.catchTag("MutationError", (error) => {
                if (prevData) {
                  this.itemQueryDataHelpers.setData({ id }, prevData);
                }
                return Effect.fail(error);
              })
            );

            yield* Effect.promise(async () => {
              await this.itemQueryDataHelpers.invalidateQuery({ id });
              await onDone?.();
            });
          }.bind(this)
        ),
    }));
}

export type JellyfinCatalogueOperationsType = JellyfinCatalogue;

export const JellyfinCatalogueOperations = new JellyfinCatalogue();
