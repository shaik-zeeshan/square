import type { Api } from "@jellyfin/sdk";
import type {
  ImageType,
  ItemFields,
  ItemsApiGetItemsRequest,
  ItemsApiGetResumeItemsRequest,
  TvShowsApiGetNextUpRequest,
  UserLibraryApiGetLatestMediaRequest,
} from "@jellyfin/sdk/lib/generated-client";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models/base-item-dto";
import { ImageUrlsApi } from "@jellyfin/sdk/lib/utils/api/image-urls-api";
import { Effect } from "effect";
import { isArray, isEmptyArray } from "effect/Array";
import { HttpError, MutationError } from "../../error";
import { AuthService, AuthServiceLayer } from "../auth";

/*
 *
 *
 *
 *  Helpers
 *
 *
 *
 */

function arrayToObjectWithDuplicates<K extends PropertyKey, V>(
  entries: readonly (readonly [K, V])[]
): Record<K, V | V[]> {
  return entries.reduce(
    (acc, [key, value]) => {
      const existing = acc[key];

      if (existing !== undefined) {
        acc[key] = Array.isArray(existing)
          ? [...existing, value]
          : [existing, value];
      } else {
        acc[key] = value;
      }

      return acc;
    },
    {} as Record<K, V | V[]>
  );
}

// const getImageFromTag = (
//   basePath: string,
//   itemId: string,
//   keyTag: string,
//   value: string
// ) => `${basePath}/Items/${itemId}/Images/${keyTag}?tag=${value}`;

const getImageByKey = (jf: Api, item: BaseItemDto, keyTag: ImageType) =>
  new ImageUrlsApi(jf.configuration).getItemImageUrl(item, keyTag, {
    quality: 75,
  });

const getImagesFromTags = (
  tags: BaseItemDto["ImageTags"],
  jf: Api,
  item: BaseItemDto
) => {
  if (!tags) {
    return {};
  }
  const images = Object.entries(tags).map(
    ([k, _v]) => [k, getImageByKey(jf, item, k as ImageType)] as const
  );

  return arrayToObjectWithDuplicates(images);
};

export type WithImage<T> = T extends Array<infer U>
  ? Array<U & { Image: string; Images: ReturnType<typeof getImagesFromTags> }>
  : T extends undefined
    ? undefined
    : T & { Image: string; Images: ReturnType<typeof getImagesFromTags> };

export const getImages =
  (jf: Api) =>
  <T extends BaseItemDto | BaseItemDto[] | undefined>(
    items: T
  ): Effect.Effect<WithImage<T>, never, never> => {
    if (!items) {
      return Effect.succeed(undefined as WithImage<T>);
    }

    return Effect.sync(() => {
      if (isArray(items)) {
        return items.map((item) => {
          const imageTags = getImagesFromTags(
            item.ImageTags,
            // jf.basePath,
            jf,
            // item.Id as string
            item
          );

          return {
            ...item,
            Image: new ImageUrlsApi(jf.configuration).getItemImageUrlById(
              item?.Id || ""
            ),
            Images: Object.assign(imageTags, {
              Backdrop: new ImageUrlsApi(
                jf.configuration
              ).getItemBackdropImageUrls(item),
            }),
          };
        }) as unknown as WithImage<T>;
      }

      const imageTags = getImagesFromTags(
        items.ImageTags,
        jf,
        // jf.basePath,
        // items.Id as string
        items
      );

      return {
        ...items,
        Image: new ImageUrlsApi(jf.configuration).getItemImageUrlById(
          items?.Id || "",
          undefined,
          { quality: 40 }
        ),
        Images: Object.assign(imageTags, {
          Backdrop: new ImageUrlsApi(jf.configuration).getItemBackdropImageUrls(
            items
          ),
        }),
      } as unknown as WithImage<T>;
    });
  };

const SUPPORTED_COLLECTION_TYPES = ["movies", "tvshows"] as const;

// Helper function to filter supported libraries
const filterSupportedLibraries = (items?: BaseItemDto[]) =>
  Effect.succeed(
    items?.filter(
      (item) =>
        item.CollectionType &&
        // biome-ignore lint/suspicious/noExplicitAny: filtering
        SUPPORTED_COLLECTION_TYPES.includes(item.CollectionType as any)
    ) ?? []
  );

/*
 *
 *
 *
 *  Jellyfin Service
 *
 *
 *
 */

export class JellyfinService extends Effect.Service<JellyfinService>()(
  "JellyfinService",
  {
    dependencies: [AuthServiceLayer],
    effect: Effect.gen(function* () {
      const auth = yield* AuthService;

      /*
       *
       *
       *  Libraries Methods
       *
       *
       */

      // Helper function to fetch user views from the API
      const fetchUserViews = (jf: Api) =>
        Effect.tryPromise({
          try: async () => {
            const { getUserViewsApi } = await import(
              "@jellyfin/sdk/lib/utils/api/user-views-api"
            );
            return await getUserViewsApi(jf).getUserViews();
          },
          catch: (e) => new HttpError({ status: 0, message: String(e) }),
        });

      const getLibraries = () =>
        Effect.gen(function* () {
          const jf = yield* auth.getApi();

          // Step 1: Fetch user views from API
          const response = yield* fetchUserViews(jf).pipe(
            Effect.flatMap((data) =>
              data.status !== 200
                ? Effect.fail(
                    new HttpError({
                      status: data.status,
                      message: data.statusText,
                    })
                  )
                : Effect.succeed(data)
            )
          );

          // Step 2: Validate the HTTP response
          // const validResponse = yield* validateResponse(response);

          // Step 3: Filter libraries to only include supported collection types
          const filteredLibraries = yield* filterSupportedLibraries(
            response.data?.Items
          );

          // Step 4: Add image URLs to each library
          const librariesWithImages = yield* getImages(jf)(filteredLibraries);

          return librariesWithImages;
        });

      /*
       *
       *
       *  Items Helpers
       *
       *
       */
      const fetchItems = (jf: Api, params: ItemsApiGetItemsRequest) =>
        Effect.tryPromise({
          try: async () => {
            const { getItemsApi } = await import(
              "@jellyfin/sdk/lib/utils/api/items-api"
            );
            return await getItemsApi(jf).getItems(params);
          },
          catch: (e) => new HttpError({ status: 0, message: String(e) }),
        });

      const fetchResumeItems = (
        jf: Api,
        params: ItemsApiGetResumeItemsRequest
      ) =>
        Effect.tryPromise({
          try: async () => {
            const { getItemsApi } = await import(
              "@jellyfin/sdk/lib/utils/api/items-api"
            );
            return await getItemsApi(jf).getResumeItems(params);
          },
          catch: (e) => new HttpError({ status: 0, message: String(e) }),
        });

      const fetchNextupItems = (jf: Api, params: TvShowsApiGetNextUpRequest) =>
        Effect.tryPromise({
          try: async () => {
            const { getTvShowsApi } = await import(
              "@jellyfin/sdk/lib/utils/api/tv-shows-api"
            );
            return await getTvShowsApi(jf).getNextUp(params);
          },
          catch: (e) => new HttpError({ status: 0, message: String(e) }),
        });

      const fetchLatestItems = (
        jf: Api,
        params: UserLibraryApiGetLatestMediaRequest
      ) =>
        Effect.tryPromise({
          try: async () => {
            const { getUserLibraryApi } = await import(
              "@jellyfin/sdk/lib/utils/api/user-library-api"
            );
            return await getUserLibraryApi(jf).getLatestMedia(params);
          },
          catch: (e) => new HttpError({ status: 0, message: String(e) }),
        });
      /*
       *
       *
       *  Items Methods
       *
       *
       */
      const getItem = (id: string, params?: ItemsApiGetItemsRequest) =>
        Effect.gen(function* () {
          const jf = yield* auth.getApi();
          const user = yield* auth.getUser();

          const res = yield* fetchItems(jf, {
            userId: user.Id,
            ids: [id],
            enableImages: true,
            enableUserData: true,
            ...params,
            fields: [
              "ParentId",
              "ChildCount",
              "Path",
              "MediaStreams",
              "Chapters",
              "MediaSources",
              ...(params?.fields ? [...params.fields] : []),
            ],
          }).pipe(
            Effect.flatMap((data) =>
              data.status !== 200
                ? Effect.fail(
                    new HttpError({
                      status: data.status,
                      message: data.statusText,
                    })
                  )
                : Effect.succeed(data)
            )
          );

          if (
            (res.data.Items && isEmptyArray(res.data.Items)) ||
            res.data.Items === undefined
          ) {
            return yield* Effect.fail(
              new HttpError({
                status: 404,
                message: "no item found",
              })
            );
          }

          const item = res.data.Items[0];

          return yield* getImages(jf)(item);
        });

      const getItems = (params?: ItemsApiGetItemsRequest) =>
        Effect.gen(function* () {
          const jf = yield* auth.getApi();
          const user = yield* auth.getUser();

          const res = yield* fetchItems(jf, {
            userId: user.Id,
            ...params,
          }).pipe(
            Effect.flatMap((data) =>
              data.status !== 200
                ? Effect.fail(
                    new HttpError({
                      status: data.status,
                      message: data.statusText,
                    })
                  )
                : Effect.succeed(data)
            )
          );

          if (
            (res.data.Items && isEmptyArray(res.data.Items)) ||
            res.data.Items === undefined
          ) {
            return yield* Effect.fail(
              new HttpError({
                status: 404,
                message: "no item found",
              })
            );
          }

          const items = res.data.Items;

          return yield* getImages(jf)(items);
        });

      const getResumeItems = (params?: ItemsApiGetResumeItemsRequest) =>
        Effect.gen(function* () {
          const jf = yield* auth.getApi();
          const user = yield* auth.getUser();

          const res = yield* fetchResumeItems(jf, {
            userId: user.Id,
            enableUserData: true,
            limit: 6,
            ...params,
            fields: ["ParentId", "MediaSources", "MediaStreams"].concat(
              params?.fields ?? []
            ) as ItemFields[],
          }).pipe(
            Effect.flatMap((data) =>
              data.status !== 200
                ? Effect.fail(
                    new HttpError({
                      status: data.status,
                      message: data.statusText,
                    })
                  )
                : Effect.succeed(data)
            )
          );

          if (
            (res.data.Items && isEmptyArray(res.data.Items)) ||
            res.data.Items === undefined
          ) {
            return yield* Effect.fail(
              new HttpError({
                status: 404,
                message: "no item found",
              })
            );
          }

          const items = res.data.Items;

          return yield* getImages(jf)(items);
        });

      const getNextupItems = (params?: ItemsApiGetResumeItemsRequest) =>
        Effect.gen(function* () {
          const jf = yield* auth.getApi();
          const user = yield* auth.getUser();

          const res = yield* fetchNextupItems(jf, {
            userId: user.Id,
            enableUserData: true,
            limit: 6,
            ...params,
            fields: ["ParentId", "MediaSources", "MediaStreams"].concat(
              params?.fields ?? []
            ) as ItemFields[],
          }).pipe(
            Effect.flatMap((data) =>
              data.status !== 200
                ? Effect.fail(
                    new HttpError({
                      status: data.status,
                      message: data.statusText,
                    })
                  )
                : Effect.succeed(data)
            )
          );

          if (
            (res.data.Items && isEmptyArray(res.data.Items)) ||
            res.data.Items === undefined
          ) {
            return yield* Effect.fail(
              new HttpError({
                status: 404,
                message: "no item found",
              })
            );
          }

          const items = res.data.Items;

          return yield* getImages(jf)(items);
        });

      const getLatestMedia = (params?: UserLibraryApiGetLatestMediaRequest) =>
        Effect.gen(function* () {
          const jf = yield* auth.getApi();
          const user = yield* auth.getUser();

          const res = yield* fetchLatestItems(jf, {
            userId: user.Id,
            enableUserData: true,
            limit: 6,
            ...params,
            fields: ["ParentId"].concat(params?.fields ?? []) as ItemFields[],
          }).pipe(
            Effect.flatMap((data) =>
              data.status !== 200
                ? Effect.fail(
                    new HttpError({
                      status: data.status,
                      message: data.statusText,
                    })
                  )
                : Effect.succeed(data)
            )
          );

          if ((res.data && isEmptyArray(res.data)) || res.data === undefined) {
            return yield* Effect.fail(
              new HttpError({
                status: 404,
                message: "no item found",
              })
            );
          }

          const items = res.data;

          return yield* getImages(jf)(items);
        });

      /*
       *
       *
       *
       *
       *
       * Mutations
       *
       *
       *
       *
       *
       */
      // Effect.tryPromise({
      //           try: async () => {
      //             const { getPlaystateApi } = await import(
      //               "@jellyfin/sdk/lib/utils/api/playstate-api"
      //             );
      //             await getPlaystateApi(jf).markPlayedItem({ userId, itemId });
      //           },
      //           catch: (e: Error) =>
      //             new HttpError({ status: 401, message: e.message }),
      //         })
      const markItemPlayed = (id: string) =>
        Effect.gen(function* () {
          const jf = yield* auth.getApi();
          const user = yield* auth.getUser();
          yield* Effect.tryPromise({
            try: async (signal) => {
              const { getPlaystateApi } = await import(
                "@jellyfin/sdk/lib/utils/api/playstate-api"
              );
              await getPlaystateApi(jf).markPlayedItem(
                {
                  userId: user.Id,
                  itemId: id,
                },
                { signal }
              );
            },
            catch: (e) =>
              new MutationError({
                mutation: "MarkPlayedItem",
                message: (e as Error).message,
              }),
          });
        });

      const markItemUnPlayed = (id: string) =>
        Effect.gen(function* () {
          const jf = yield* auth.getApi();
          const user = yield* auth.getUser();
          yield* Effect.tryPromise({
            try: async (signal) => {
              const { getPlaystateApi } = await import(
                "@jellyfin/sdk/lib/utils/api/playstate-api"
              );
              await getPlaystateApi(jf).markUnplayedItem(
                {
                  userId: user.Id,
                  itemId: id,
                },
                { signal }
              );
            },
            catch: (e) =>
              new MutationError({
                mutation: "MarkUnPlayedItem",
                message: (e as Error).message,
              }),
          });
        });

      const markItemFavorite = (id: string) =>
        Effect.gen(function* () {
          const jf = yield* auth.getApi();
          const user = yield* auth.getUser();
          yield* Effect.tryPromise({
            try: async (signal) => {
              const { getUserLibraryApi } = await import(
                "@jellyfin/sdk/lib/utils/api/user-library-api"
              );
              await getUserLibraryApi(jf).markFavoriteItem(
                {
                  userId: user.Id,
                  itemId: id,
                },
                { signal }
              );
            },
            catch: (e) =>
              new MutationError({
                mutation: "MarkItemFavorite",
                message: (e as Error).message,
              }),
          });
        });

      const markItemUnFavorite = (id: string) =>
        Effect.gen(function* () {
          const jf = yield* auth.getApi();
          const user = yield* auth.getUser();
          yield* Effect.tryPromise({
            try: async (signal) => {
              const { getUserLibraryApi } = await import(
                "@jellyfin/sdk/lib/utils/api/user-library-api"
              );
              await getUserLibraryApi(jf).unmarkFavoriteItem(
                {
                  userId: user.Id,
                  itemId: id,
                },
                { signal }
              );
            },
            catch: (e) =>
              new MutationError({
                mutation: "MarkItemUnFavorite",
                message: (e as Error).message,
              }),
          });
        });

      return {
        getLibraries,
        getItem,
        getItems,
        getResumeItems,
        getNextupItems,
        getLatestMedia,

        /*
         *
         * Mutations
         *
         */

        markItemPlayed,
        markItemUnPlayed,
        markItemFavorite,
        markItemUnFavorite,
      };
    }),
  }
) {}

export const JellyfinServiceLayer = JellyfinService.Default;
