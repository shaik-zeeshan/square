import type { Api } from "@jellyfin/sdk";
import type { ImageType } from "@jellyfin/sdk/lib/generated-client";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models/base-item-dto";
import type { ImageRequestParameters } from "@jellyfin/sdk/lib/models/api/image-request-parameters";
import { ImageUrlsApi } from "@jellyfin/sdk/lib/utils/api/image-urls-api";
import type { Artwork, Library, MediaItem, MediaItemType, TrackSummary } from "./types";

const unique = (values: Array<string | null | undefined>) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))];

const mapMediaItemType = (type?: string): MediaItemType => {
  switch (type) {
    case "Movie":
      return "movie";
    case "Series":
      return "series";
    case "Season":
      return "season";
    case "Episode":
      return "episode";
    case "CollectionFolder":
      return "library";
    default:
      return "unknown";
  }
};

export const getBestPrimaryImageUrl = (
  api: ImageUrlsApi,
  item: BaseItemDto,
  params: ImageRequestParameters = {},
): string => {
  const id = item.Id ?? "";

  if (item.ImageTags?.Primary) {
    return api.getItemImageUrlById(id, "Primary" as ImageType, {
      ...params,
      tag: item.ImageTags.Primary,
    });
  }

  const record = item as Record<string, unknown>;
  if (record.PrimaryImageTag) {
    return api.getItemImageUrlById(id, "Primary" as ImageType, {
      ...params,
      tag: record.PrimaryImageTag as string,
    });
  }

  // Episodes should prefer their own thumbnail endpoint over series/season
  // artwork. The tagless endpoint returns the episode primary image when
  // Jellyfin has extracted one, and avoids showing parent art in the list.
  if (item.Type === "Episode") {
    return api.getItemImageUrlById(id, "Primary" as ImageType, params);
  }

  if (item.SeriesPrimaryImageTag && item.SeriesId) {
    return api.getItemImageUrlById(item.SeriesId, "Primary" as ImageType, {
      ...params,
      tag: item.SeriesPrimaryImageTag,
    });
  }

  const parentPrimaryId = record.ParentPrimaryImageItemId as string | undefined;
  const parentPrimaryTag = record.ParentPrimaryImageTag as string | undefined;
  if (parentPrimaryTag && parentPrimaryId) {
    return api.getItemImageUrlById(parentPrimaryId, "Primary" as ImageType, {
      ...params,
      tag: parentPrimaryTag,
    });
  }

  if (item.AlbumPrimaryImageTag && item.AlbumId) {
    return api.getItemImageUrlById(item.AlbumId, "Primary" as ImageType, {
      ...params,
      tag: item.AlbumPrimaryImageTag,
    });
  }

  if (item.BackdropImageTags && item.BackdropImageTags.length > 0) {
    return api.getItemImageUrlById(id, "Backdrop" as ImageType, {
      ...params,
      tag: item.BackdropImageTags[0],
    });
  }

  if (item.SeriesThumbImageTag && item.SeriesId) {
    return api.getItemImageUrlById(item.SeriesId, "Thumb" as ImageType, {
      ...params,
      tag: item.SeriesThumbImageTag,
    });
  }

  if (item.ParentThumbImageTag && item.ParentThumbItemId) {
    return api.getItemImageUrlById(item.ParentThumbItemId, "Thumb" as ImageType, {
      ...params,
      tag: item.ParentThumbImageTag,
    });
  }

  if (
    item.ParentBackdropImageTags &&
    item.ParentBackdropImageTags.length > 0 &&
    item.ParentBackdropItemId
  ) {
    return api.getItemImageUrlById(item.ParentBackdropItemId, "Backdrop" as ImageType, {
      ...params,
      tag: item.ParentBackdropImageTags[0],
    });
  }

  return api.getItemImageUrlById(id);
};

export const getBestLogoImageUrl = (
  api: ImageUrlsApi,
  item: BaseItemDto,
  params: ImageRequestParameters = {},
): string | undefined => {
  const id = item.Id ?? "";

  if (item.ImageTags?.Logo) {
    return api.getItemImageUrlById(id, "Logo" as ImageType, {
      ...params,
      tag: item.ImageTags.Logo,
    });
  }

  if (item.ParentLogoImageTag && item.ParentLogoItemId) {
    return api.getItemImageUrlById(item.ParentLogoItemId, "Logo" as ImageType, {
      ...params,
      tag: item.ParentLogoImageTag,
    });
  }
};

export const mapArtwork = (
  jf: Api,
  item: BaseItemDto,
  params: ImageRequestParameters = {},
): Artwork => {
  const api = new ImageUrlsApi(jf.configuration);
  return {
    primary: getBestPrimaryImageUrl(api, item, params),
    backdrop: api.getItemBackdropImageUrls(item)[0],
    logo: getBestLogoImageUrl(api, item, params),
  };
};

export const mapTrackSummary = (item: BaseItemDto): TrackSummary => {
  const streams = item.MediaStreams ?? [];
  return {
    audioLanguages: unique(
      streams.filter((stream) => stream.Type === "Audio").map((stream) => stream.Language),
    ),
    subtitleLanguages: unique(
      streams.filter((stream) => stream.Type === "Subtitle").map((stream) => stream.Language),
    ),
  };
};

const mapEnrichedArtwork = (item: BaseItemDto): Artwork => {
  const record = item as Record<string, unknown>;
  const images = record.Images as Record<string, unknown> | undefined;
  const backdrop = images?.Backdrop;

  return {
    primary: record.Image as string | undefined,
    backdrop: Array.isArray(backdrop) ? backdrop[0] : (backdrop as string | undefined),
    logo: images?.Logo as string | undefined,
  };
};

export const mapMediaItem = (item: BaseItemDto, jf?: Api): MediaItem => ({
  id: item.Id ?? "",
  name: item.Name ?? "",
  type: mapMediaItemType(item.Type),
  jellyfinType: item.Type,
  overview: item.Overview,
  year: item.ProductionYear,
  premiereDate: item.PremiereDate,
  runtimeTicks: item.RunTimeTicks,
  communityRating: item.CommunityRating,
  officialRating: item.OfficialRating,
  genres: item.Genres ?? [],
  parentId: item.ParentId,
  seriesId: item.SeriesId,
  seriesName: item.SeriesName,
  seasonName: item.SeasonName,
  indexNumber: item.IndexNumber,
  parentIndexNumber: item.ParentIndexNumber,
  childCount: item.ChildCount,
  locationType: item.LocationType,
  studios: item.Studios?.map((studio) => studio.Name).filter((name): name is string => Boolean(name)) ?? [],
  people:
    item.People?.map((person) => ({
      name: person.Name ?? "",
      role: person.Role,
      type: person.Type,
      imageUrl: person.PrimaryImageTag && person.Id && jf
        ? new ImageUrlsApi(jf.configuration).getItemImageUrlById(person.Id, "Primary" as ImageType, {
            tag: person.PrimaryImageTag,
          })
        : undefined,
    })).filter((person) => Boolean(person.name)) ?? [],
  trackSummary: mapTrackSummary(item),
  userData: {
    played: item.UserData?.Played ?? false,
    favorite: item.UserData?.IsFavorite ?? false,
    playbackPositionTicks: item.UserData?.PlaybackPositionTicks,
    playedPercentage: item.UserData?.PlayedPercentage,
    unplayedItemCount: item.UserData?.UnplayedItemCount,
  },
  artwork: jf ? mapArtwork(jf, item) : mapEnrichedArtwork(item),
});

export const mapLibrary = (item: BaseItemDto, jf?: Api): Library => ({
  id: item.Id ?? "",
  name: item.Name ?? "",
  collectionType: item.CollectionType,
  itemCount: item.ChildCount,
  artwork: jf ? mapArtwork(jf, item) : mapEnrichedArtwork(item),
});
