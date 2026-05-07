import { JellyfinCatalogueOperations } from "~/effect/services/jellyfin/catalogue/operations";

export function useItemActions(
  itemId: string,
  onDone?: () => Promise<void> | void
) {
  const markPlayedMutation = JellyfinCatalogueOperations.markItemPlayed(
    itemId,
    onDone
  );
  const markUnplayedMutation = JellyfinCatalogueOperations.markItemUnPlayed(
    itemId,
    onDone
  );
  const markFavoriteMutation = JellyfinCatalogueOperations.markItemFavorite(
    itemId,
    onDone
  );
  const unmarkFavoriteMutation = JellyfinCatalogueOperations.markItemUnFavorite(
    itemId,
    onDone
  );

  return {
    markPlayed: markPlayedMutation.mutate,
    markUnplayed: markUnplayedMutation.mutate,
    markFavorite: markFavoriteMutation.mutate,
    unmarkFavorite: unmarkFavoriteMutation.mutate,
    isMarkingPlayed: markPlayedMutation.isPending,
    isMarkingUnplayed: markUnplayedMutation.isPending,
    isMarkingFavorite: markFavoriteMutation.isPending,
    isUnmarkingFavorite: unmarkFavoriteMutation.isPending,
  };
}
