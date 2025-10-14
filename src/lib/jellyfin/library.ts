import type { Api } from '@jellyfin/sdk/lib/api';
import type {
  ItemsApiGetItemsRequest,
  ItemsApiGetResumeItemsRequest,
} from '@jellyfin/sdk/lib/generated-client/api/items-api';
import type { TvShowsApiGetNextUpRequest } from '@jellyfin/sdk/lib/generated-client/api/tv-shows-api';
import type { UserLibraryApiGetLatestMediaRequest } from '@jellyfin/sdk/lib/generated-client/api/user-library-api';
import type { ItemFields } from '@jellyfin/sdk/lib/generated-client/models';
import { ImageUrlsApi } from '@jellyfin/sdk/lib/utils/api/image-urls-api';
import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api';
import { getMediaInfoApi } from '@jellyfin/sdk/lib/utils/api/media-info-api';
import { query } from '.';

const mutation = {};

const getImageUrlsApi = (api: Api) => new ImageUrlsApi(api.configuration);

const getImageFromTag = (
  basePath: string,
  itemId: string,
  keyTag: string,
  value: string
) => `${basePath}/Items/${itemId}/Images/${keyTag}?tag=${value}`;

const queries = {
  getLibraries: query(async (jf: Api, _id: string | undefined) => {
    const { getUserViewsApi } = await import(
      '@jellyfin/sdk/lib/utils/api/user-views-api'
    );

    const libraryViewReq = await getUserViewsApi(jf).getUserViews();

    const libraryReq = libraryViewReq.data;

    const newData = libraryReq.Items?.map((item) => {
      const library = item;
      if (
        !(
          library.CollectionType === 'movies' ||
          library.CollectionType === 'tvshows'
        )
      ) {
        return;
      }

      const image = getImageUrlsApi(jf).getItemImageUrlById(library?.Id || '');

      return { ...library, Image: image };
    }).filter((item) => item !== undefined);

    if (libraryViewReq.status !== 200) {
      throw new Error(libraryViewReq.statusText);
    }

    return newData;
  }, 'allLibraries'),

  getItem: query(
    async (
      jf: Api,
      id: string,
      userId?: string,
      fields: ItemFields[] = [],
      searchTerm?: string
    ) => {
      const itemReq = await getItemsApi(jf).getItems({
        userId,
        ids: [id],
        fields: [
          'ChildCount',
          'Path',
          'MediaStreams',
          'Chapters',
          'MediaSources',
          ...fields,
        ],
        enableImages: true,
        enableUserData: true,
        searchTerm,
      });

      if (!itemReq.data.Items) {
        throw new Error('no items found');
      }

      const item = itemReq.data.Items?.[0];

      const image = getImageUrlsApi(jf).getItemBackdropImageUrls(item);
      const url = jf.basePath;

      const imageEntries: Record<string, string> = {};
      Object.entries(item.ImageTags ?? {}).forEach(([key, value]) => {
        imageEntries[key] = getImageFromTag(url, id, key, value);
      });

      return {
        ...item,
        Images: imageEntries,
        Backdrop: image,
      };
    },
    'item'
  ),

  getPlayBackInfo: query(async (jf: Api, id: string, userId?: string) => {
    const mediaInfo = await getMediaInfoApi(jf).getPlaybackInfo({
      itemId: id,
      userId,
    });

    return mediaInfo.data;
  }, 'playbackInfo'),

  getItems: query(
    async (
      jf: Api,
      params: ItemsApiGetItemsRequest & { enableImage?: boolean }
    ) => {
      const { enableImage = false, fields = [], ...apiParams } = params;

      const item = await getItemsApi(jf).getItems({
        ...apiParams,
        fields: ['ParentId', ...fields],
        enableUserData: true,
      });

      const newItems = enableImage
        ? item.data.Items?.map((item) => {
            const image = getImageUrlsApi(jf).getItemBackdropImageUrls(item);
            const url = jf.basePath;

            const imageEntries: Record<string, string> = {};
            Object.entries(item.ImageTags ?? {}).forEach(([key, value]) => {
              imageEntries[key] = getImageFromTag(
                url,
                item.Id || '',
                key,
                value
              );
            });

            return { ...item, Images: imageEntries, Backdrop: image };
          })
        : item.data.Items?.map((item) => ({
            ...item,
            Images: {},
            Backdrop: [],
          }));

      return newItems;
    },
    'itemsOfLibrary'
  ),

  getResumeItems: query(
    async (
      jf: Api,
      userId: string | undefined,
      options?: ItemsApiGetResumeItemsRequest
    ) => {
      const item = await getItemsApi(jf).getResumeItems({
        userId,
        enableUserData: true,
        limit: 6,
        ...options,
        fields: ['ParentId', 'MediaSources', 'MediaStreams'].concat(
          options?.fields ?? []
        ) as ItemFields[],
      });

      const newItems = item.data.Items?.map((item) => {
        const image = getImageUrlsApi(jf).getItemBackdropImageUrls(item);
        const url = jf.basePath;

        const imageEntries: Record<string, string> = {};
        Object.entries(item.ImageTags ?? {}).forEach(([key, value]) => {
          imageEntries[key] = getImageFromTag(url, item.Id || '', key, value);
        });

        return { ...item, Images: imageEntries, Backdrop: image };
      });

      return newItems;
    },
    'resumeItems'
  ),

  getNextupItems: query(
    async (
      jf: Api,
      userId: string | undefined,
      options?: TvShowsApiGetNextUpRequest
    ) => {
      const { getTvShowsApi } = await import(
        '@jellyfin/sdk/lib/utils/api/tv-shows-api'
      );

      const items = await getTvShowsApi(jf).getNextUp({
        userId,
        enableUserData: true,
        limit: 6,
        ...options,
        fields: ['ParentId', 'MediaSources', 'MediaStreams'].concat(
          options?.fields ?? []
        ) as ItemFields[],
      });

      const newItems = items.data.Items?.map((item) => {
        const image = getImageUrlsApi(jf).getItemBackdropImageUrls(item);
        const url = jf.basePath;
        const imageEntries: Record<string, string> = {};
        Object.entries(item.ImageTags ?? {}).forEach(([key, value]) => {
          imageEntries[key] = getImageFromTag(url, item.Id || '', key, value);
        });
        return { ...item, Images: imageEntries, Backdrop: image };
      });

      return newItems;
    },
    'nextupItems'
  ),
  getLatestItems: query(
    async (
      jf: Api,
      userId: string | undefined,
      options?: UserLibraryApiGetLatestMediaRequest
    ) => {
      const { getUserLibraryApi } = await import(
        '@jellyfin/sdk/lib/utils/api/user-library-api'
      );

      const items = await getUserLibraryApi(jf).getLatestMedia({
        userId,
        enableUserData: true,
        limit: 6,
        ...options,
        fields: ['ParentId'].concat(options?.fields ?? []) as ItemFields[],
      });

      const newItems = items.data.map((item) => {
        const image = getImageUrlsApi(jf).getItemBackdropImageUrls(item);
        const url = jf.basePath;
        const imageEntries: Record<string, string> = {};
        Object.entries(item.ImageTags ?? {}).forEach(([key, value]) => {
          imageEntries[key] = getImageFromTag(url, item.Id || '', key, value);
        });
        return { ...item, Images: imageEntries, Backdrop: image };
      });

      return newItems;
    },
    'latestItems'
  ),

  getNextEpisode: query(
    async (jf: Api, currentEpisodeId: string, userId?: string) => {
      // First get the current episode details
      const currentEpisode = await getItemsApi(jf).getItems({
        userId,
        ids: [currentEpisodeId],
        fields: ['ParentId'],
        enableUserData: true,
      });

      if (!currentEpisode.data.Items?.[0]) {
        return null;
      }

      const episode = currentEpisode.data.Items[0];
      const seasonId = episode.ParentId;
      const _seriesId = episode.SeriesId || '';
      const currentIndex = episode.IndexNumber || 0;

      if (!seasonId) {
        return null;
      }

      // Get all episodes in the same season
      const seasonEpisodes = await getItemsApi(jf).getItems({
        userId,
        parentId: seasonId,
        fields: ['MediaStreams', 'ParentId'],
        enableUserData: true,
        startIndex: currentIndex + 1,
        limit: 1,
        includeItemTypes: ['Episode'],
        sortBy: ['IndexNumber'],
        sortOrder: ['Ascending'],
        enableImages: true,
      });

      if (!seasonEpisodes.data.Items) {
        return null;
      }

      // Find the next episode by index number
      const nextEpisode = seasonEpisodes.data.Items[0];

      if (nextEpisode) {
        const imageEntries: Record<string, string> = {};
        Object.entries(nextEpisode.ImageTags ?? {}).forEach(([key, value]) => {
          imageEntries[key] = getImageFromTag(
            jf.basePath,
            nextEpisode.Id || '',
            key,
            value
          );
        });
        const image = getImageUrlsApi(jf).getItemBackdropImageUrls(nextEpisode);

        return {
          ...nextEpisode,
          Images: imageEntries,
          Backdrop: image,
        };
      }

      return null;
    },
    'nextEpisode'
  ),
};

export default {
  mutation,
  query: queries,
};
