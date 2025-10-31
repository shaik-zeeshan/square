import { JellyfinOperations } from "~/effect/services/jellyfin/operations";

export function useItemActions(
  itemId: string,
  onDone?: () => Promise<void> | void
) {
  const markPlayedMutation = JellyfinOperations.markItemPlayed(itemId, onDone);
  const markUnplayedMutation = JellyfinOperations.markItemUnPlayed(
    itemId,
    onDone
  );
  const markFavoriteMutation = JellyfinOperations.markItemFavorite(
    itemId,
    onDone
  );
  const unmarkFavoriteMutation = JellyfinOperations.markItemUnFavorite(
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
