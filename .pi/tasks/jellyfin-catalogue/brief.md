# Jellyfin Catalogue Deepening Brief

## Problem

Square callers currently depend on raw Jellyfin DTO casing, duplicated image enrichment, and mixed media shapes (`Image`, `Images`, `Backdrop`, `BaseItemDto`). This spreads Jellyfin quirks across routes/components and makes catalogue behavior hard to test.

## Domain language

Use `CONTEXT.md` vocabulary:

- **Jellyfin Catalogue** — Square-owned view of Jellyfin libraries, media items, media rails, and display-ready artwork.
- **Media Item** — Square-owned media data shape, not raw `BaseItemDto`.
- **Library** — Jellyfin collection of media items.
- **Media Rail** — home-screen groups such as resume, next up, latest media.
- **Artwork** — display-ready image URLs: primary, backdrop, logo.
- **Playback Metadata** — stream/source/chapter/track-summary data needed to start playback or inspect audio/subtitle languages.

## Architectural intent

Deepen the **Jellyfin Catalogue** module. The public interface should hide raw Jellyfin SDK DTOs, image tag fallback rules, empty-result quirks, and item-action mutation details. Solid query hooks are a thin adapter over the core catalogue module, not the core module itself.

## Decisions

- Single item lookup fails not-found.
- Lists and **Media Rails** return `[]`.
- One app-level **Media Item** shape; do not expose raw `BaseItemDto` or `WithImage` from the new interface.
- **Media Item** uses normalized Square casing (`id`, `name`, `artwork.primary`, `userData.played`).
- **Library** remains separate from **Media Item**.
- No raw DTO escape hatch in public catalogue types.
- **Playback Metadata** is separate from general **Media Item**.
- Detail/season UI needs audio/subtitle language summaries, not full raw streams.
- Played/unplayed/favorite mutations move behind the **Jellyfin Catalogue** seam.
- Migrate by strangler: add new module and migrate callers incrementally; delete old code only after callers are migrated.

## Proposed normalized shapes

Exact fields may be adjusted to fit TypeScript/Jellyfin SDK reality, but keep the public interface normalized and Square-owned.

```ts
type MediaItemType =
  | "movie"
  | "series"
  | "season"
  | "episode"
  | "library"
  | "unknown";

type Artwork = {
  primary?: string;
  backdrop?: string;
  logo?: string;
};

type TrackSummary = {
  audioLanguages: string[];
  subtitleLanguages: string[];
};

type MediaItem = {
  id: string;
  name: string;
  type: MediaItemType;
  jellyfinType?: string;
  overview?: string;
  year?: number;
  premiereDate?: string;
  runtimeTicks?: number;
  communityRating?: number;
  officialRating?: string;
  genres: string[];
  parentId?: string;
  seriesId?: string;
  seriesName?: string;
  seasonName?: string;
  indexNumber?: number;
  childCount?: number;
  locationType?: string;
  studios: string[];
  people: Array<{ name: string; role?: string; type?: string; imageUrl?: string }>;
  trackSummary: TrackSummary;
  userData: {
    played: boolean;
    favorite: boolean;
    playbackPositionTicks?: number;
    playedPercentage?: number;
    unplayedItemCount?: number;
  };
  artwork: Artwork;
};
```

## Existing areas

- Current Jellyfin service/query modules:
  - `src/effect/services/jellyfin/service.ts`
  - `src/effect/services/jellyfin/operations.ts`
- Duplicate/older Jellyfin code:
  - `src/lib/jellyfin/library.ts`
  - `src/lib/jellyfin/index.ts`
- Major current callers:
  - `src/routes/index.tsx`
  - `src/components/media-card.tsx`
  - `src/components/ItemActions.tsx`
  - `src/routes/library/[id]/index.tsx`
  - `src/routes/library/[id]/item/[item_id].tsx`
  - `src/routes/video/[id]/index.tsx`
  - `src/hooks/useAutoplay.ts`
  - `src/hooks/useVideoPlayback.ts`

## Acceptance criteria

- New **Jellyfin Catalogue** core module exists with normalized public types.
- New query/mutation adapter exists over the core module.
- Migrated callers no longer import `BaseItemDto`, `WithImage`, or use `Image`/`Images`/`Backdrop`.
- Lists/rails return `[]` when Jellyfin returns empty/missing list data.
- Single item lookup still fails not-found.
- Artwork fallback behavior is preserved or improved while hidden behind `artwork`.
- App typechecks after each slice.

## Verification

Preferred commands:

```bash
bun run build
```

If build is too slow or blocked, run the narrowest available type/lint command and report the blocker. Inspect `package.json` before inventing commands.

## Non-goals

- Do not deepen the mpv playback session in this task.
- Do not redesign UI layout.
- Do not consolidate auth/server discovery.
- Do not remove old Jellyfin modules until all migrated callers are off them.
