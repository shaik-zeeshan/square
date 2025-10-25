import type { Api } from "@jellyfin/sdk";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { ImageUrlsApi } from "@jellyfin/sdk/lib/utils/api/image-urls-api";
import { Effect, pipe } from "effect";
import { isArray, isEmptyArray } from "effect/Array";
import { HttpError } from "./error";

const SUPPORTED_COLLECTION_TYPES = ["movies", "tvshows"];

export const getImages =
  (jf: Api) =>
  <T extends BaseItemDto | BaseItemDto[] | undefined>(
    items: T
  ): Effect.Effect<T, never> => {
    if (!items) {
      return Effect.succeed(undefined as T);
    }

    return Effect.sync(() => {
      if (isArray(items)) {
        return items.map((item) => ({
          ...item,
          Image: new ImageUrlsApi(jf.configuration).getItemImageUrlById(
            item?.Id || ""
          ),
        })) as unknown as T;
      }

      return {
        ...items,
        Image: new ImageUrlsApi(jf.configuration).getItemImageUrlById(
          items?.Id || ""
        ),
      } as unknown as T;
    });
  };

export const getLibraries = (jf: Api) =>
  Effect.Do.pipe(
    Effect.bind("response", () =>
      Effect.tryPromise({
        try: async () => {
          const { getUserViewsApi } = await import(
            "@jellyfin/sdk/lib/utils/api/user-views-api"
          );
          return await getUserViewsApi(jf).getUserViews();
        },
        catch: (e) => new HttpError({ status: 0, message: String(e) }),
      })
    ),

    Effect.bind("libraries", ({ response }) =>
      response.status !== 200
        ? Effect.fail(
            new HttpError({
              status: response.status,
              message: response.statusText,
            })
          )
        : Effect.succeed(
            response.data?.Items?.filter((item) =>
              SUPPORTED_COLLECTION_TYPES.includes(item.CollectionType ?? "")
            ) ?? []
          )
    ),
    Effect.flatMap(({ libraries }) => getImages(jf)(libraries))
  );

export const getItem = (jf: Api, itemId: number) =>
  pipe(
    // Get the libraries
    Effect.promise(async () => {
      const { getItemsApi } = await import(
        "@jellyfin/sdk/lib/utils/api/items-api"
      );

      const req = await getItemsApi(jf).getItems({
        ids: [itemId.toString()],
        fields: [
          "ChildCount",
          "Path",
          "MediaStreams",
          "Chapters",
          "MediaSources",
        ],
        enableImages: true,
        enableUserData: true,
      });

      if (req.status !== 200) {
        throw new HttpError({
          status: req.status,
          message: req.statusText,
        });
      }

      if (isEmptyArray(req.data.Items ?? [])) {
        throw new HttpError({
          status: 404,
          message: "item not found",
        });
      }

      return req.data.Items?.at(0);
    }),
    // map error
    Effect.mapError((e: Error) => {
      if (e instanceof HttpError) {
        return e;
      }
      return new HttpError({ status: 0, message: e.message });
    }),
    // get only the supported collections type
    Effect.flatMap((data) => getImages(jf)(data))
  );
