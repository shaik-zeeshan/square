# Slice 2: Jellyfin Catalogue Core Service

## Goal

Add a core **Jellyfin Catalogue** service that wraps Jellyfin SDK calls and returns normalized **Media Item**, **Library**, **Media Rail**, and **Playback Metadata** shapes.

## Scope

- Add core catalogue service module under `src/effect/services/jellyfin/catalogue/`.
- Reuse existing auth/client dependencies from `JellyfinService` where possible.
- Implement core methods needed by current callers:
  - libraries
  - item by id
  - items by params
  - resume rail
  - next-up rail
  - latest movie rail
  - latest TV rail
  - next episode
  - playback metadata
  - played/unplayed/favorite mutations
- Preserve semantics:
  - single item missing => not-found failure
  - lists/rails empty/missing => `[]`

## Out of scope

- Do not migrate UI callers yet.
- Do not delete existing `JellyfinService` methods.
- Do not redesign query keys yet.

## Files/seams to inspect first

- `CONTEXT.md`
- `.pi/tasks/jellyfin-catalogue/brief.md`
- `src/effect/services/jellyfin/catalogue/types.ts`
- `src/effect/services/jellyfin/catalogue/mapper.ts`
- `src/effect/services/jellyfin/service.ts`
- `src/effect/services/auth/index.ts`
- `src/effect/error.ts`

## Implementation notes

- Keep the core catalogue service independent from Solid query hooks.
- It may be an Effect service or plain functions layered on existing `JellyfinService`; choose the smallest change that preserves locality.
- Hide raw Jellyfin request/response quirks inside the implementation.
- Return normalized `Library` and `MediaItem` only.
- `PlaybackMetadata` can initially contain internal SDK-ish structures only if not exposed as raw DTO types; prefer normalized track/source/chapter shapes where feasible.

## Acceptance criteria

- Catalogue service methods compile and can be imported independently.
- Empty lists/rails return `[]`.
- Single item not-found still fails.
- Item action mutations exist behind catalogue service.
- Existing app behavior remains unchanged because callers are not migrated yet.

## Verification

```bash
bun run build
```

If blocked, report the exact error and the narrowest successful check.

## Stop conditions

- Stop if adding the service requires changing app-wide runtime layer setup in a risky way.
- Stop if mutation cache behavior cannot be preserved without the query adapter slice.
