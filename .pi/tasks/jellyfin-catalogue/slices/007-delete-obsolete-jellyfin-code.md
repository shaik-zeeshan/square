# Slice 7: Delete Obsolete Jellyfin Code

## Goal

Remove old Jellyfin catalogue/image enrichment code after callers have migrated to the deepened **Jellyfin Catalogue** seam.

## Scope

- Remove unused `WithImage` type and old image enrichment helpers if no longer imported.
- Remove `src/lib/jellyfin/library.ts` if no imports remain.
- Remove old `JellyfinOperations` methods or keep only compatibility shims that still have real callers.
- Clean up imports and obsolete types in `src/types/index.ts` if safe.

## Out of scope

- Do not delete code still used by auth/server discovery unless it is truly catalogue-specific and unused.
- Do not refactor unrelated Jellyfin client/auth modules.

## Files/seams to inspect first

- `CONTEXT.md`
- `.pi/tasks/jellyfin-catalogue/brief.md`
- `src/effect/services/jellyfin/service.ts`
- `src/effect/services/jellyfin/operations.ts`
- `src/lib/jellyfin/library.ts`
- `src/lib/jellyfin/index.ts`
- `src/types/index.ts`
- Run `rg "WithImage|BaseItemDto|~/lib/jellyfin/library|Image:|Images:|Backdrop" src` before editing.

## Implementation notes

- This slice must run only after migration slices have completed.
- Be conservative: delete only code with no callers.
- Keep non-catalogue Jellyfin client/server discovery code if still used.

## Acceptance criteria

- No app caller imports `WithImage`.
- No app caller uses old `Image`/`Images`/`Backdrop` enriched fields.
- `src/lib/jellyfin/library.ts` is deleted if unused.
- Build/typecheck passes.

## Verification

```bash
rg "WithImage|~/lib/jellyfin/library|\.Image\b|\.Images\b|\.Backdrop\b" src
bun run build
```

Report any remaining matches and whether they are legitimate non-catalogue usages.

## Stop conditions

- Stop if old modules still have live callers from slices not completed.
- Stop if deleting code changes auth/server discovery behavior.
