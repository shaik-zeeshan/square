# Slice 4: Migrate Home Media Rails and Cards

## Goal

Migrate the home **Media Rails** path and shared media cards to normalized **Jellyfin Catalogue** types.

## Scope

- Migrate `src/routes/index.tsx` home Jellyfin data usage to new catalogue query adapter.
- Migrate relevant parts of `src/components/media-card.tsx` to consume normalized `MediaItem`/`Library` where used by home rails.
- Migrate `src/components/ItemActions.tsx` and/or `src/hooks/useItemActions.ts` to catalogue mutations if needed for home cards.
- Replace caller knowledge of `Image`, `Images`, `Backdrop`, `Id`, `Name`, `UserData.Played` in migrated paths with normalized fields.

## Out of scope

- Do not migrate library detail pages unless required for shared component compilation.
- Do not migrate video playback pages.
- Do not delete old Jellyfin modules.

## Files/seams to inspect first

- `CONTEXT.md`
- `.pi/tasks/jellyfin-catalogue/brief.md`
- `src/effect/services/jellyfin/catalogue/operations.ts`
- `src/routes/index.tsx`
- `src/components/media-card.tsx`
- `src/components/ItemActions.tsx`
- `src/hooks/useItemActions.ts`

## Implementation notes

- Keep this slice focused on the home path. If shared components are too coupled to old types, introduce compatibility props or split normalized variants rather than migrating every caller.
- Use `artwork.primary` / `artwork.backdrop` / `artwork.logo`.
- Use `userData.played`, `userData.playbackPositionTicks`, etc.
- Preserve route URLs (`/video/:id`, `/library/:id`, item detail links).

## Acceptance criteria

- Home page uses **Jellyfin Catalogue** query adapter for libraries and media rails.
- Home path no longer imports `BaseItemDto` or `WithImage`.
- Home path no longer reads `Image`, `Images`, or `Backdrop`.
- App typechecks/builds.

## Verification

```bash
bun run build
```

Manual check if possible: launch app and verify home libraries/resume/next-up/latest rails still render images and actions.

## Stop conditions

- Stop if migrating shared `media-card.tsx` would force library/video pages into this slice. Prefer a small adapter or new normalized card path and report follow-up.
