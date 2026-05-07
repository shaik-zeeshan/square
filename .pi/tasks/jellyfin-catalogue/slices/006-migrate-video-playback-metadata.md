# Slice 6: Migrate Video and Autoplay to Playback Metadata

## Goal

Migrate video route, autoplay, and playback hook inputs away from raw Jellyfin DTOs toward normalized **Media Item** and **Playback Metadata**.

## Scope

- Migrate `src/routes/video/[id]/index.tsx` item lookup to catalogue query adapter.
- Migrate `src/hooks/useAutoplay.ts` to normalized **Media Item** for current/next episode data.
- Migrate `src/components/video/AutoplayOverlay.tsx` and `src/components/video/VideoInfoOverlay.tsx` props as needed.
- Start using `PlaybackMetadata` where playback currently needs chapters/media streams/media sources, but do not deeply refactor mpv session logic.
- Remove `BaseItemDto`/`WithImage` imports from migrated video/autoplay files.

## Out of scope

- Do not perform the separate mpv playback session deepening.
- Do not rewrite subtitle injection or playstate reporting beyond the minimum needed to consume normalized data.
- Do not delete old Jellyfin modules.

## Files/seams to inspect first

- `CONTEXT.md`
- `.pi/tasks/jellyfin-catalogue/brief.md`
- `src/effect/services/jellyfin/catalogue/operations.ts`
- `src/routes/video/[id]/index.tsx`
- `src/hooks/useVideoPlayback.ts`
- `src/hooks/useAutoplay.ts`
- `src/components/video/AutoplayOverlay.tsx`
- `src/components/video/VideoInfoOverlay.tsx`

## Implementation notes

- Keep playback behavior stable.
- If `useVideoPlayback` still needs raw-ish media source internals, keep them inside `PlaybackMetadata` module types rather than exposing `BaseItemDto` to callers.
- Preserve language preference behavior and per-series override logic.
- Preserve autoplay next episode navigation.

## Acceptance criteria

- Video route/autoplay path no longer imports `BaseItemDto`/`WithImage`.
- Video info/autoplay overlays use normalized fields.
- Playback still receives enough **Playback Metadata** to load video, chapters, and subtitle/audio information.
- App typechecks/builds.

## Verification

```bash
bun run build
```

Manual check if possible: play an episode, verify title overlay, autoplay overlay, chapters, audio/subtitle selection, and subtitle injection still work.

## Stop conditions

- Stop if preserving subtitle injection requires a larger playback-session refactor.
- Stop if normalized `PlaybackMetadata` is missing necessary data and ask before leaking raw DTOs.
