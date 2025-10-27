import type {
  BaseItemDto,
  ItemsApiGetItemsRequest,
} from "@jellyfin/sdk/lib/generated-client";
import type { SolidQueryOptions } from "@tanstack/solid-query";
import { Effect } from "effect";
import type { Accessor } from "solid-js";
import {
  createEffectMutation,
  createEffectQuery,
  createQueryDataHelpers,
  createQueryKey,
  type ExtractQueryData,
} from "~/effect/tanstack/query";
import { safeAssign } from "~/lib/utils";
import { JellyfinService } from "./service";

class Jellyfin {
  librariesQueryKey = createQueryKey("getLibraries");
  librariesQueryDataHelpers = createQueryDataHelpers(this.librariesQueryKey);
  getLibraries = () =>
    createEffectQuery(() => ({
      queryKey: this.librariesQueryKey(),
      queryFn: () =>
        JellyfinService.pipe(Effect.flatMap((jf) => jf.getLibraries())),
    }));

  resumeItemsQueryKey = createQueryKey("getResumeItems");
  resumeItemsQueryDataHelpers = createQueryDataHelpers(
    this.resumeItemsQueryKey
  );
  getResumeItems = () =>
    createEffectQuery(() => ({
      queryKey: this.resumeItemsQueryKey(),
      queryFn: () =>
        JellyfinService.pipe(
          Effect.flatMap((jf) => jf.getResumeItems()),
          Effect.catchTag("HttpError", (e) =>
            Effect.sync(() => {
              if (e.status === 404) {
                return Effect.succeed([]);
              }
              return Effect.fail(e);
            })
          )
        ),
    }));

  nextupItemsQueryKey = createQueryKey("getNextupItems");
  nextupItemsQueryDataHelpers = createQueryDataHelpers(
    this.resumeItemsQueryKey
  );
  getNextupItems = () =>
    createEffectQuery(() => ({
      queryKey: this.nextupItemsQueryKey(),
      queryFn: () =>
        JellyfinService.pipe(
          Effect.flatMap((jf) => jf.getNextupItems({ limit: 4 }))
        ),
    }));

  latestMoviesQueryKey = createQueryKey<"getLatestMovies", { search: string }>(
    "getLatestMovies"
  );
  latestMoviesQueryDataHelpers = createQueryDataHelpers(
    this.latestMoviesQueryKey
  );
  getLatestMovies = (
    searchTerm: () => string,
    libraries: BaseItemDto[] | undefined
  ) =>
    createEffectQuery(() => ({
      queryKey: this.latestMoviesQueryKey({ search: searchTerm() }),
      queryFn: () =>
        Effect.if(Boolean(searchTerm), {
          onTrue: () =>
            JellyfinService.pipe(
              Effect.bind("parentId", () => {
                const parentIds =
                  libraries
                    ?.filter((library) => library.CollectionType === "movies")
                    ?.map((library) => library.Id)
                    .filter((id) => id !== undefined) ?? [];

                return Effect.succeed(parentIds[0]);
              }),
              Effect.flatMap((jf) =>
                jf.getItems({
                  parentId: jf.parentId,
                  enableImages: true,
                  fields: ["ParentId"],
                  includeItemTypes: ["Movie"],
                  limit: 7,
                  recursive: true,
                  searchTerm: searchTerm(),
                })
              ),
              Effect.catchTag("HttpError", (e) => {
                if (e.status === 404) {
                  return Effect.succeed([]);
                }

                return Effect.fail(e);
              })
            ),
          onFalse: () =>
            JellyfinService.pipe(
              Effect.flatMap((jf) =>
                jf.getLatestMedia({
                  limit: 7,
                  includeItemTypes: ["Movie"],
                })
              )
            ),
        }),
      enabled: libraries?.some(
        (library) => library.CollectionType === "movies"
      ),
    }));

  latestTVShowsQueryKey = createQueryKey<
    "getLatestTVShows",
    { search: string }
  >("getLatestTVShows");
  latestTVShowsQueryDataHelpers = createQueryDataHelpers(
    this.latestTVShowsQueryKey
  );
  getLatestTVShows = (
    searchTerm: () => string,
    libraries: BaseItemDto[] | undefined
  ) =>
    createEffectQuery(() => ({
      queryKey: this.latestTVShowsQueryKey({ search: searchTerm() }),
      queryFn: () =>
        Effect.if(Boolean(searchTerm), {
          onTrue: () =>
            JellyfinService.pipe(
              Effect.bind("parentId", () => {
                const parentIds =
                  libraries
                    ?.filter((library) => library.CollectionType === "tvshows")
                    ?.map((library) => library.Id)
                    .filter((id) => id !== undefined) ?? [];

                return Effect.succeed(parentIds[0]);
              }),
              Effect.flatMap((jf) =>
                jf.getItems({
                  parentId: jf.parentId,
                  enableImages: true,
                  fields: ["ParentId"],
                  includeItemTypes: ["Series"],
                  limit: 7,
                  recursive: true,
                  searchTerm: searchTerm(),
                })
              ),
              Effect.catchTag("HttpError", (e) => {
                if (e.status === 404) {
                  return Effect.succeed([]);
                }

                return Effect.fail(e);
              })
            ),
          onFalse: () =>
            JellyfinService.pipe(
              Effect.flatMap((jf) =>
                jf.getLatestMedia({
                  limit: 7,
                  includeItemTypes: ["Series"],
                })
              )
            ),
        }),
      enabled: libraries?.some(
        (library) => library.CollectionType === "tvshows"
      ),
    }));

  itemQueryKey = createQueryKey<"getItem", { id: string }>("getItem");

  itemQueryDataHelpers = createQueryDataHelpers<
    ExtractQueryData<ReturnType<typeof this.getItem>>,
    { id: string }
  >(this.itemQueryKey);

  getItem = (
    id: () => string,
    params?: ItemsApiGetItemsRequest,
    queryOptions?: Accessor<
      Omit<
        SolidQueryOptions<
          Effect.Effect.Success<ReturnType<JellyfinService["getItem"]>>, // TQueryFnData
          Effect.Effect.Error<ReturnType<JellyfinService["getItem"]>>, // TError
          Effect.Effect.Success<ReturnType<JellyfinService["getItem"]>>, // TQueryFnData
          ReturnType<typeof this.itemQueryKey> // TQueryKey
        >,
        "queryFn" | "queryKey"
      >
    >
  ) =>
    createEffectQuery(() => ({
      queryKey: this.itemQueryKey({ id: id() }),
      queryFn: () =>
        JellyfinService.pipe(
          Effect.flatMap((jf) =>
            jf.getItem(id(), {
              enableImages: true,
              ...params,
            })
          )
        ),
      ...(queryOptions ? queryOptions() : {}),
    }));

  itemsQueryKey = createQueryKey<
    "getItems",
    { parentId?: string; ids?: string[]; searchItem?: string[] }
  >("getItems");
  itemsQueryDataHelpers = createQueryDataHelpers(this.itemsQueryKey);
  getItems = (params?: ItemsApiGetItemsRequest) =>
    createEffectQuery(() => ({
      queryKey: this.itemsQueryKey({
        parentId: params?.parentId,
        ids: params?.ids,
      }),
      queryFn: () =>
        JellyfinService.pipe(
          Effect.flatMap((jf) =>
            jf.getItems({
              enableImages: true,
              ...params,
            })
          )
        ),
    }));

  /*
   *
   *
   * Mutations
   *
   *
   */
  markItemPlayed = (id: string, onDone?: () => Promise<void> | void) =>
    createEffectMutation(() => ({
      mutationKey: ["markItemPlayed"],
      mutationFn: () =>
        Effect.gen(
          function* (this: Jellyfin) {
            this.itemQueryDataHelpers.cancelQuery({ id });

            const service = yield* JellyfinService;
            const prevData = this.itemQueryDataHelpers.getData({ id });

            // Optimistic update
            this.itemQueryDataHelpers.setData({ id }, (data) => {
              safeAssign(data, "UserData", {
                Played: true,
                LastPlayedDate: new Date().toISOString(),
              });
            });

            yield* service.markItemPlayed(id).pipe(
              Effect.catchTag("MutationError", (e) => {
                if (!prevData) {
                  return Effect.fail(e);
                }
                this.itemQueryDataHelpers.setData({ id }, prevData);
                return Effect.fail(e);
              })
            );

            yield* Effect.promise(async () => {
              await this.itemQueryDataHelpers.invalidateQuery({ id });

              if (onDone) {
                await onDone();
              }
            });
          }.bind(this)
        ),
    }));

  markItemUnPlayed = (id: string, onDone?: () => Promise<void> | void) =>
    createEffectMutation(() => ({
      mutationKey: ["markItemUnPlayed"],
      mutationFn: () =>
        Effect.gen(
          function* (this: Jellyfin) {
            this.itemQueryDataHelpers.cancelQuery({ id });

            const service = yield* JellyfinService;
            const prevData = this.itemQueryDataHelpers.getData({ id });

            // Optimistic update
            this.itemQueryDataHelpers.setData({ id }, (data) => {
              safeAssign(data, "UserData", {
                Played: false,
                PlaybackPositionTicks: 0,
              });
            });

            yield* service.markItemUnPlayed(id).pipe(
              Effect.catchTag("MutationError", (e) => {
                if (!prevData) {
                  return Effect.fail(e);
                }
                this.itemQueryDataHelpers.setData({ id }, prevData);
                return Effect.fail(e);
              })
            );

            yield* Effect.promise(async () => {
              await this.itemQueryDataHelpers.invalidateQuery({ id });
              if (onDone) {
                await onDone();
              }
            });
          }.bind(this)
        ),
    }));

  markItemFavorite = (id: string, onDone?: () => Promise<void> | void) =>
    createEffectMutation(() => ({
      mutationKey: ["markItemFavorite"],
      mutationFn: () =>
        Effect.gen(
          function* (this: Jellyfin) {
            this.itemQueryDataHelpers.cancelQuery({ id });

            const service = yield* JellyfinService;
            const prevData = this.itemQueryDataHelpers.getData({ id });

            // Optimistic update
            this.itemQueryDataHelpers.setData({ id }, (data) => {
              safeAssign(data, "UserData", { IsFavorite: true });
            });

            yield* service.markItemFavorite(id).pipe(
              Effect.catchTag("MutationError", (e) => {
                if (!prevData) {
                  return Effect.fail(e);
                }
                this.itemQueryDataHelpers.setData({ id }, prevData);
                return Effect.fail(e);
              })
            );

            yield* Effect.promise(async () => {
              await this.itemQueryDataHelpers.invalidateQuery({ id });
              if (onDone) {
                await onDone();
              }
            });
          }.bind(this)
        ),
    }));

  markItemUnFavorite = (id: string, onDone?: () => Promise<void> | void) =>
    createEffectMutation(() => ({
      mutationKey: ["markItemUnFavorite"],
      mutationFn: () =>
        Effect.gen(
          function* (this: Jellyfin) {
            this.itemQueryDataHelpers.cancelQuery({ id });

            const service = yield* JellyfinService;
            const prevData = this.itemQueryDataHelpers.getData({ id });

            // Optimistic update
            this.itemQueryDataHelpers.setData({ id }, (data) => {
              safeAssign(data, "UserData", { IsFavorite: false });
            });

            yield* service.markItemUnFavorite(id).pipe(
              Effect.catchTag("MutationError", (e) => {
                if (!prevData) {
                  return Effect.fail(e);
                }
                this.itemQueryDataHelpers.setData({ id }, prevData);
                return Effect.fail(e);
              })
            );

            yield* Effect.promise(async () => {
              await this.itemQueryDataHelpers.invalidateQuery({ id });
              if (onDone) {
                await onDone();
              }
            });
          }.bind(this)
        ),
    }));
}

export type JellyfinOperationsType = Jellyfin;

export const JellyfinOperations = new Jellyfin();
