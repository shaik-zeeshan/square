import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { Effect } from "effect";
import { createEffectQuery, createQueryKey } from "~/effect/tanstack/query";
import { JellyfinService } from "./service";

class Jellyfin {
  librariesKey = createQueryKey("getLibraries");

  getLibraries = () =>
    createEffectQuery(() => ({
      queryKey: this.librariesKey(),
      queryFn: () =>
        JellyfinService.pipe(Effect.flatMap((jf) => jf.getLibraries())),
    }));

  resumeItemsKey = createQueryKey("getResumeItems");

  getResumeItems = () =>
    createEffectQuery(() => ({
      queryKey: this.resumeItemsKey(),
      queryFn: () =>
        JellyfinService.pipe(Effect.flatMap((jf) => jf.getResumeItems())),
    }));

  nextupItemsKey = createQueryKey("getNextupItems");
  getNextupItems = () =>
    createEffectQuery(() => ({
      queryKey: this.nextupItemsKey(),
      queryFn: () =>
        JellyfinService.pipe(
          Effect.flatMap((jf) => jf.getNextupItems({ limit: 4 }))
        ),
    }));

  latestMoviesKey = createQueryKey<"getLatestMovies", { search: string }>(
    "getLatestMovies"
  );
  getLatestMovies = (
    searchTerm: string,
    libraries: BaseItemDto[] | undefined
  ) =>
    createEffectQuery(() => ({
      queryKey: this.latestMoviesKey({ search: searchTerm }),
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
                  includeItemTypes: ["Movie"],
                  limit: 7,
                  recursive: true,
                  searchTerm,
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

  latestTVShowsKey = createQueryKey<"getLatestTVShows", { search: string }>(
    "getLatestTVShows"
  );
  getLatestTVShows = (
    searchTerm: string,
    libraries: BaseItemDto[] | undefined
  ) =>
    createEffectQuery(() => ({
      queryKey: this.latestMoviesKey({ search: searchTerm }),
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
                  includeItemTypes: ["Series"],
                  limit: 7,
                  recursive: true,
                  searchTerm,
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
}

export const JellyfinOperations = new Jellyfin();
