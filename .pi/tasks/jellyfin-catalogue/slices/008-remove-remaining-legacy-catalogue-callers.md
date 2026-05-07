# Slice 8: Remove Remaining Legacy Catalogue Callers

## Goal

Finish migrating remaining live callers off `WithImage`, old enriched `Image` / `Images` / `Backdrop` fields, and old `JellyfinOperations` catalogue methods so obsolete catalogue compatibility can be deleted.

## Scope

- Inspect all remaining matches from:
  - `rg "WithImage|BaseItemDto|\.Image\b|\.Images\b|\.Backdrop\b|JellyfinOperations" src`
- Migrate remaining app callers to `JellyfinCatalogueOperations` and normalized `MediaItem` / `Library` / `PlaybackMetadata` where they are catalogue-related.
- Update or remove legacy variants in `src/components/media-card.tsx` and `src/components/ItemActions.tsx` if no longer needed.
- Remove `WithImage`, `getImages`, and old image-enrichment helpers from `src/effect/services/jellyfin/service.ts` when no longer used.
- Remove obsolete catalogue methods from `src/effect/services/jellyfin/operations.ts` when no longer used, or leave only non-catalogue compatibility if required by live callers.

## Out of scope

- Do not refactor auth/server discovery.
- Do not change UI layout beyond preserving current behavior after normalized migration.
- Do not delete compatibility that still has live callers outside catalogue scope; report any blockers instead.

## Files/seams to inspect first

- `CONTEXT.md`
- `.pi/tasks/jellyfin-catalogue/brief.md`
- `src/effect/services/jellyfin/catalogue/operations.ts`
- `src/effect/services/jellyfin/catalogue/service.ts`
- `src/effect/services/jellyfin/service.ts`
- `src/effect/services/jellyfin/operations.ts`
- `src/components/media-card.tsx`
- `src/components/ItemActions.tsx`
- `src/hooks/useItemActions.ts`
- Remaining `rg` matches for legacy catalogue fields/types.

## Implementation notes

- Prefer deleting legacy component variants only when no imports remain.
- Keep normalized public interface free of raw Jellyfin DTOs.
- Mapper internals may inspect old enriched compatibility fields only if the old service still feeds the catalogue during transition.
- Run searches before and after edits and include remaining matches in the summary.

## Acceptance criteria

- No app caller imports or references `WithImage`.
- No app caller reads old enriched fields `.Image`, `.Images`, or `.Backdrop`.
- `src/lib/jellyfin/library.ts` remains deleted and no imports reference it.
- `bun run build` passes.
- Any remaining legacy matches are confined to internal compatibility code with a clear reason, or removed entirely.

## Verification

```bash
rg "WithImage|~/lib/jellyfin/library|\.Image\b|\.Images\b|\.Backdrop\b" src
rg "JellyfinOperations" src
bun run build
```

## Stop conditions

- Stop if removing old `JellyfinOperations` requires a broad unrelated rewrite.
- Stop if a remaining caller requires raw Jellyfin data not represented in catalogue types; add the missing normalized field only if it is app data, otherwise report the blocker.
