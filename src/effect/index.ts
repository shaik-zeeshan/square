import type { Api } from "@jellyfin/sdk";
import { ImageUrlsApi } from "@jellyfin/sdk/lib/utils/api/image-urls-api";
import { Effect, pipe } from "effect";
import { HttpError } from "./error";

const SUPPORTED_COLLECTION_TYPES = ["movies", "tvshows"];

export const getLibraries = (jf: Api) =>
  pipe(
    // Get the libraries
    Effect.promise(async () => {
      const { getUserViewsApi } = await import(
        "@jellyfin/sdk/lib/utils/api/user-views-api"
      );

      const libraryViewReq = await getUserViewsApi(jf).getUserViews();

      if (libraryViewReq.status !== 200) {
        throw new HttpError({
          status: libraryViewReq.status,
          message: libraryViewReq.statusText,
        });
      }

      return libraryViewReq.data;
    }),
    // map error
    Effect.mapError((e: Error) => {
      if (e instanceof HttpError) {
        return e;
      }
      return new HttpError({ status: 0, message: e.message });
    }),
    // get only the supported collections type
    Effect.map((data) =>
      data?.Items?.filter((item) =>
        SUPPORTED_COLLECTION_TYPES.includes(item.CollectionType ?? "")
      )
    ),
    // get images
    Effect.map((data) =>
      data?.map((item) => {
        const image = new ImageUrlsApi(jf.configuration).getItemImageUrlById(
          item?.Id || ""
        );

        return { ...item, Image: image };
      })
    )
  );
