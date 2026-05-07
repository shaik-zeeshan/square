# Slice 3: Jellyfin Catalogue Query Adapter

## Goal

Add Solid query/mutation hooks as a thin adapter over the core **Jellyfin Catalogue** module.

## Scope

- Add `operations.ts` or equivalent under `src/effect/services/jellyfin/catalogue/`.
- Provide query keys, query data helpers, and hooks/methods for current caller needs.
- Mirror existing `JellyfinOperations` ergonomics where useful, but return normalized catalogue types.
- Provide mutations for played/unplayed/favorite behind the **Jellyfin Catalogue** seam.

## Out of scope

- Do not migrate broad caller paths yet.
- Do not delete `src/effect/services/jellyfin/operations.ts`.

## Files/seams to inspect first

- `CONTEXT.md`
- `.pi/tasks/jellyfin-catalogue/brief.md`
- `src/effect/services/jellyfin/catalogue/service.ts`
- `src/effect/services/jellyfin/operations.ts`
- `src/effect/tanstack/query.ts`
- `src/hooks/useItemActions.ts`

## Implementation notes

- Keep hooks thin: queryFn should delegate to catalogue service/core methods.
- Preserve optimistic mutation behavior from existing item actions where practical.
- Use normalized variables and query keys (`id`, `parentId`, etc.) rather than Jellyfin casing.
- Do not leak `BaseItemDto` or `WithImage` from hook return types.

## Acceptance criteria

- New query adapter compiles.
- Hooks/mutations return normalized catalogue types.
- Existing app callers continue to work unchanged.
- A future caller can import catalogue hooks without importing raw Jellyfin types.

## Verification

```bash
bun run build
```

If blocked, report the exact error and the narrowest successful check.

## Stop conditions

- Stop if existing query helper typing prevents a thin adapter without large changes to `src/effect/tanstack/query.ts`.
- Stop if optimistic update requires caller migration; leave optimistic behavior for migration slices if needed.
