import type {
  ItemsApiGetItemsRequest,
  ItemsApiGetResumeItemsRequest,
  MediaInfoApiGetPlaybackInfoRequest,
  UserLibraryApiGetLatestMediaRequest,
} from "@jellyfin/sdk/lib/generated-client";
import { Effect } from "effect";
import { HttpError, NoEpisodeFound } from "../../../error";
import { JellyfinService, JellyfinServiceLayer } from "../service";
import { mapLibrary, mapMediaItem, mapTrackSummary } from "./mapper";
import type { Library, MediaItem, PlaybackMetadata, PlaybackSource, PlaybackStream } from "./types";

const isNotFound = (error: unknown) =>
  error instanceof HttpError && error.status === 404;

const emptyOnNotFound = <A, E, R>(effect: Effect.Effect<A[], E, R>) =>
  effect.pipe(
    Effect.catchIf(isNotFound, () => Effect.succeed([] as A[])),
  );

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const mapPlaybackStream = (stream: unknown): PlaybackStream => {
  const record = asRecord(stream);
  return {
    index: record.Index as number | undefined,
    type: record.Type as string | undefined,
    codec: record.Codec as string | undefined,
    language: record.Language as string | undefined,
    title: record.Title as string | undefined,
    displayTitle: record.DisplayTitle as string | undefined,
    isExternal: record.IsExternal as boolean | undefined,
    deliveryUrl: record.DeliveryUrl as string | undefined,
  };
};

const mapPlaybackSource = (source: unknown): PlaybackSource => {
  const record = asRecord(source);
  return {
    id: record.Id as string | undefined,
    liveStreamId: record.LiveStreamId as string | undefined,
    path: record.Path as string | undefined,
    container: record.Container as string | undefined,
    bitrate: record.Bitrate as number | undefined,
    runtimeTicks: record.RunTimeTicks as number | undefined,
    streams: asArray(record.MediaStreams).map(mapPlaybackStream),
  };
};

const mapPlaybackMetadata = (itemId: string, playbackInfo: unknown): PlaybackMetadata => {
  const record = asRecord(playbackInfo);
  const sources = asArray(record.MediaSources);
  const streams = sources.flatMap((source) => asArray(asRecord(source).MediaStreams));

  return {
    itemId,
    sources: sources.map(mapPlaybackSource),
    chapters: asArray(record.Chapters).map((chapter) => {
      const chapterRecord = asRecord(chapter);
      return {
        name: chapterRecord.Name as string | undefined,
        startPositionTicks: chapterRecord.StartPositionTicks as number | undefined,
      };
    }),
    trackSummary: mapTrackSummary({ MediaStreams: streams } as never),
  };
};

export class JellyfinCatalogueService extends Effect.Service<JellyfinCatalogueService>()(
  "JellyfinCatalogueService",
  {
    dependencies: [JellyfinServiceLayer],
    effect: Effect.gen(function* () {
      const jellyfin = yield* JellyfinService;

      const libraries = (): Effect.Effect<Library[], unknown> =>
        emptyOnNotFound(
          jellyfin.getLibraries().pipe(
            Effect.map((items) => items.map((item) => mapLibrary(item))),
          ),
        );

      const itemById = (id: string, params?: ItemsApiGetItemsRequest) =>
        jellyfin.getItem(id, params).pipe(Effect.map((item) => mapMediaItem(item)));

      const items = (params?: ItemsApiGetItemsRequest): Effect.Effect<MediaItem[], unknown> =>
        emptyOnNotFound(
          jellyfin.getItems(params).pipe(
            Effect.map((results) => results.map((item) => mapMediaItem(item))),
          ),
        );

      const resumeRail = (params?: ItemsApiGetResumeItemsRequest): Effect.Effect<MediaItem[], unknown> =>
        emptyOnNotFound(
          jellyfin.getResumeItems(params).pipe(
            Effect.map((results) => results.map((item) => mapMediaItem(item))),
          ),
        );

      const nextUpRail = (params?: ItemsApiGetResumeItemsRequest): Effect.Effect<MediaItem[], unknown> =>
        emptyOnNotFound(
          jellyfin.getNextupItems(params).pipe(
            Effect.map((results) => results.map((item) => mapMediaItem(item))),
          ),
        );

      const latestMovieRail = (params?: UserLibraryApiGetLatestMediaRequest): Effect.Effect<MediaItem[], unknown> =>
        emptyOnNotFound(
          jellyfin.getLatestMedia({ ...params, includeItemTypes: ["Movie"] }).pipe(
            Effect.map((results) => results.map((item) => mapMediaItem(item))),
          ),
        );

      const latestTvRail = (params?: UserLibraryApiGetLatestMediaRequest): Effect.Effect<MediaItem[], unknown> =>
        emptyOnNotFound(
          jellyfin.getLatestMedia({ ...params, includeItemTypes: ["Series"] }).pipe(
            Effect.map((results) => results.map((item) => mapMediaItem(item))),
          ),
        );

      const nextEpisode = (item: MediaItem) =>
        Effect.gen(function* () {
          if (!item.indexNumber) {
            return yield* new NoEpisodeFound();
          }

          const episodes = yield* items({
            parentId: item.parentId,
            fields: ["ParentId", "MediaStreams"],
            enableUserData: true,
            includeItemTypes: ["Episode"],
            sortBy: ["IndexNumber"],
            sortOrder: ["Ascending"],
            enableImages: true,
          });

          const next = episodes.reduce<MediaItem | undefined>((best, candidate) => {
            if (typeof candidate.indexNumber !== "number" || candidate.indexNumber <= item.indexNumber!) {
              return best;
            }
            if (!best || typeof best.indexNumber !== "number" || candidate.indexNumber < best.indexNumber) {
              return candidate;
            }
            return best;
          }, undefined);

          if (!next) {
            return yield* new NoEpisodeFound();
          }

          return next;
        });

      const playbackMetadata = (id: string, params?: MediaInfoApiGetPlaybackInfoRequest) =>
        jellyfin.getPlaybackState(id, params).pipe(
          Effect.map((playbackInfo) => mapPlaybackMetadata(id, playbackInfo)),
        );

      return {
        libraries,
        itemById,
        items,
        resumeRail,
        nextUpRail,
        latestMovieRail,
        latestTvRail,
        nextEpisode,
        playbackMetadata,
        markItemPlayed: jellyfin.markItemPlayed,
        markItemUnPlayed: jellyfin.markItemUnPlayed,
        markItemFavorite: jellyfin.markItemFavorite,
        markItemUnFavorite: jellyfin.markItemUnFavorite,
      };
    }),
  },
) {}

export const JellyfinCatalogueServiceLayer = JellyfinCatalogueService.Default;
