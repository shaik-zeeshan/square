# Slice 5: Migrate Library and Item Detail Pages

## Goal

Migrate library browsing and item detail pages to normalized **Jellyfin Catalogue** types.

## Scope

- Migrate `src/routes/library/[id]/index.tsx` to catalogue query adapter.
- Migrate `src/routes/library/[id]/item/[item_id].tsx` to catalogue query adapter.
- Migrate child item/episode card usage as needed.
- Replace caller knowledge of raw Jellyfin DTO casing and old image fields in these pages.
- Use `trackSummary.audioLanguages` and `trackSummary.subtitleLanguages` for audio/subtitle chips.

## Out of scope

- Do not migrate video playback internals.
- Do not delete old Jellyfin modules.
- Do not redesign layout.

## Files/seams to inspect first

- `CONTEXT.md`
- `.pi/tasks/jellyfin-catalogue/brief.md`
- `src/effect/services/jellyfin/catalogue/operations.ts`
- `src/routes/library/[id]/index.tsx`
- `src/routes/library/[id]/item/[item_id].tsx`
- `src/components/media-card.tsx`
- `src/components/ItemActions.tsx`

## Implementation notes

- Preserve current item detail behavior: hero artwork, logo, metadata badges, genres, overview, studios/people, played/favorite actions, child season/episode lists.
- Use normalized fields: `item.name`, `item.type`, `item.artwork.backdrop`, `item.userData.played`.
- Use **Library** shape separately from **Media Item**.
- If a page needs a field missing from `MediaItem`, add it to the catalogue mapper only if it is app data, not as a raw DTO escape hatch.

## Acceptance criteria

- Library index and item detail pages compile using catalogue types.
- These pages no longer import `BaseItemDto`/`WithImage`.
- These pages no longer read `Image`/`Images`/`Backdrop`.
- Audio/subtitle chips use normalized track summary.

## Verification

```bash
bun run build
```

Manual check if possible: browse a library, open a series/movie/season, verify artwork and episode language chips render.

## Stop conditions

- Stop if page behavior depends on raw DTO fields not covered by the agreed `MediaItem`; add a note and ask before expanding scope substantially.
