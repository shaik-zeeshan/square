# Slice 1: Jellyfin Catalogue Types and Mappers

## Goal

Create the **Jellyfin Catalogue** core type and mapping seam without migrating callers yet.

## Scope

- Add catalogue folder/files under `src/effect/services/jellyfin/catalogue/`.
- Define normalized public types for **Media Item**, **Library**, **Artwork**, **TrackSummary**, and **Playback Metadata**.
- Add pure mapper helpers from Jellyfin SDK DTOs to normalized Square-owned shapes.
- Centralize **Artwork** fallback logic currently embedded in `src/effect/services/jellyfin/service.ts` where practical, but keep old exports working.

## Out of scope

- Do not migrate routes/components.
- Do not delete `WithImage` or `src/lib/jellyfin/library.ts`.
- Do not change runtime behavior beyond adding the new seam.

## Files/seams to inspect first

- `CONTEXT.md`
- `.pi/tasks/jellyfin-catalogue/brief.md`
- `src/effect/services/jellyfin/service.ts`
- `src/effect/services/jellyfin/operations.ts`
- `src/types/index.ts`

## Implementation notes

- Prefer files like:
  - `src/effect/services/jellyfin/catalogue/types.ts`
  - `src/effect/services/jellyfin/catalogue/mapper.ts`
  - `src/effect/services/jellyfin/catalogue/index.ts`
- Public catalogue types must not expose raw `BaseItemDto` or `WithImage`.
- Mapper implementation may accept raw Jellyfin DTOs internally.
- Normalize field names to Square casing: `id`, `name`, `artwork.primary`, `userData.played`.
- Use `unknown` fallback for unsupported item types.
- Track summaries should expose unique audio/subtitle language arrays.

## Acceptance criteria

- New catalogue types and mappers compile.
- Existing app callers continue to work unchanged.
- No public new type requires callers to know `Image`, `Images`, `Backdrop`, or raw Jellyfin DTO casing.

## Verification

```bash
bun run build
```

If blocked, report the exact error and the narrowest successful check.

## Stop conditions

- Stop if preserving existing `getImages` behavior requires a broad rewrite beyond this slice.
- Stop if TypeScript cannot represent the mapper without leaking raw DTOs in public types.
