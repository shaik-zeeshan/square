import { JellyfinOperations } from "~/effect/services/jellyfin/operations";

export function useItemActions(itemId: string) {
  const markPlayedMutation = JellyfinOperations.markItemPlayed(itemId);
  const markUnplayedMutation = JellyfinOperations.markItemUnPlayed(itemId);
  const markFavoriteMutation = JellyfinOperations.markItemFavorite(itemId);
  const unmarkFavoriteMutation = JellyfinOperations.markItemUnFavorite(itemId);

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
