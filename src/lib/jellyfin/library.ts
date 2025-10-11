import { query } from '.';
import { getUserViewsApi } from '@jellyfin/sdk/lib/utils/api/user-views-api';
import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api';
import type { Api } from '@jellyfin/sdk/lib/api';
import { ImageUrlsApi } from '@jellyfin/sdk/lib/utils/api/image-urls-api';
import { getMediaInfoApi } from '@jellyfin/sdk/lib/utils/api/media-info-api';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models';
import type { ItemsApiGetItemsRequest } from '@jellyfin/sdk/lib/generated-client/api/items-api';

const mutation = {};

const getImageUrlsApi = (api: Api) => new ImageUrlsApi(api.configuration);

const getImageFromTag = (
  basePath: string,
  itemId: string,
  keyTag: string,
  value: string
) => `${basePath}/Items/${itemId}/Images/${keyTag}?tag=${value}`;

const queries = {
  getLibraries: query(async (jf: Api, id: string | undefined) => {
    let libraryViewReq = await getUserViewsApi(jf).getUserViews({
      userId: id,
    });

    let libraryReq = libraryViewReq.data;

    let newData = libraryReq.Items?.map((item) => {
      let library = item;
      if (
        !(
          library.CollectionType === 'movies' ||
          library.CollectionType === 'tvshows'
        )
      ) {
        return;
      }

      let image = getImageUrlsApi(jf).getItemImageUrlById(library?.Id || '');

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
      let itemReq = await getItemsApi(jf).getItems({
        userId,
        ids: [id],
        fields: ['ChildCount', 'Path', 'MediaStreams', ...fields],
        enableImages: true,
        enableUserData: true,
        searchTerm,
      });

      if (!itemReq.data.Items) {
        throw new Error('no items found');
      }

      let item = itemReq.data.Items![0];

      let image = getImageUrlsApi(jf).getItemBackdropImageUrls(item);
      let url = jf.basePath;

      let imageEntries: Record<string, string> = {};
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
    let mediaInfo = await getMediaInfoApi(jf).getPlaybackInfo({
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

      let item = await getItemsApi(jf).getItems({
        ...apiParams,
        fields: ['ParentId', ...fields],
        enableUserData: true,
      });

      let newItems = enableImage
        ? item.data.Items?.map((item) => {
            let image = getImageUrlsApi(jf).getItemBackdropImageUrls(item);
            let url = jf.basePath;

            let imageEntries: Record<string, string> = {};
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

  getResumeItems: query(async (jf: Api, userId: string | undefined) => {
    let item = await getItemsApi(jf).getResumeItems({
      userId,
      limit: 6,
      enableUserData: true,
      fields: ['ParentId', 'MediaSources', 'MediaStreams'],
    });

    let newItems = item.data.Items?.map((item) => {
      let image = getImageUrlsApi(jf).getItemBackdropImageUrls(item);
      let url = jf.basePath;

      let imageEntries: Record<string, string> = {};
      Object.entries(item.ImageTags ?? {}).forEach(([key, value]) => {
        imageEntries[key] = getImageFromTag(url, item.Id || '', key, value);
      });

      return { ...item, Images: imageEntries, Backdrop: image };
    });

    return newItems;
  }, 'resumeItems'),
};

export default {
  mutation,
  query: queries,
};
