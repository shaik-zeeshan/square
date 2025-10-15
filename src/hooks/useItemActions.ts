import type { Api } from "@jellyfin/sdk";
import { useQueryClient } from "@tanstack/solid-query";
import library from "~/lib/jellyfin/library";
import { useServerStore } from "~/lib/store-hooks";
import { createJellyFinMutation } from "~/lib/utils";

export function useItemActions(
  itemId: string,
  userId?: string,
  onDone?: () => void
) {
  const queryClient = useQueryClient();
  const { store } = useServerStore();

  // Mark as played mutation
  const markPlayedMutation = createJellyFinMutation(() => ({
    mutationFn: (jf: Api, _variables) => {
      if (!userId) {
        throw new Error("User ID is required");
      }
      return library.mutation.markPlayed(jf, itemId, userId);
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: [
          library.query.getItem.key,
          library.query.getItem.keyFor(itemId, userId),
          store?.current?.currentUser,
        ],
      });

      // Snapshot the previous value
      const previousItem = queryClient.getQueryData([
        library.query.getItem.key,
        library.query.getItem.keyFor(itemId, userId),
        store?.current?.currentUser,
      ]);

      // Optimistically update to the new value
      queryClient.setQueryData(
        [
          library.query.getItem.key,
          library.query.getItem.keyFor(itemId, userId),
          store?.current?.currentUser,
        ],
        (old: unknown) => {
          if (!old || typeof old !== "object") {
            return old;
          }
          const oldItem = old as Record<string, unknown>;
          return {
            ...oldItem,
            UserData: {
              ...((oldItem.UserData as Record<string, unknown>) || {}),
              Played: true,
              LastPlayedDate: new Date().toISOString(),
            },
          };
        }
      );

      // Return a context object with the snapshotted value
      return { previousItem };
    },
    onError: (_err, _variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousItem) {
        queryClient.setQueryData(
          [
            library.query.getItem.key,
            library.query.getItem.keyFor(itemId, userId),
            store?.current?.currentUser,
          ],
          context.previousItem
        );
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: [
          library.query.getItem.key,
          library.query.getItem.keyFor(itemId, userId),
          store?.current?.currentUser,
        ],
      });
      onDone?.();
    },
  }));

  // Mark as unplayed mutation
  const markUnplayedMutation = createJellyFinMutation(() => ({
    mutationFn: (jf: Api, _variables) => {
      if (!userId) {
        throw new Error("User ID is required");
      }
      return library.mutation.markUnplayed(jf, itemId, userId);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: [
          library.query.getItem.key,
          library.query.getItem.keyFor(itemId, userId),
          store?.current?.currentUser,
        ],
      });

      const previousItem = queryClient.getQueryData([
        library.query.getItem.key,
        library.query.getItem.keyFor(itemId, userId),
        store?.current?.currentUser,
      ]);

      queryClient.setQueryData(
        [
          library.query.getItem.key,
          library.query.getItem.keyFor(itemId, userId),
          store?.current?.currentUser,
        ],
        (old: unknown) => {
          if (!old || typeof old !== "object") {
            return old;
          }
          const oldItem = old as Record<string, unknown>;
          return {
            ...oldItem,
            UserData: {
              ...((oldItem.UserData as Record<string, unknown>) || {}),
              Played: false,
              PlaybackPositionTicks: 0,
            },
          };
        }
      );

      return { previousItem };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousItem) {
        queryClient.setQueryData(
          [
            library.query.getItem.key,
            library.query.getItem.keyFor(itemId, userId),
            store?.current?.currentUser,
          ],
          context.previousItem
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [
          library.query.getItem.key,
          library.query.getItem.keyFor(itemId, userId),
          store?.current?.currentUser,
        ],
      });
      onDone?.();
    },
  }));

  // Mark as favorite mutation
  const markFavoriteMutation = createJellyFinMutation(() => ({
    mutationFn: (jf: Api, _variables) => {
      if (!userId) {
        throw new Error("User ID is required");
      }
      return library.mutation.markFavorite(jf, itemId, userId);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: [
          library.query.getItem.key,
          library.query.getItem.keyFor(itemId, userId),
          store?.current?.currentUser,
        ],
      });

      const previousItem = queryClient.getQueryData([
        library.query.getItem.key,
        library.query.getItem.keyFor(itemId, userId),
        store?.current?.currentUser,
      ]);

      queryClient.setQueryData(
        [
          library.query.getItem.key,
          library.query.getItem.keyFor(itemId, userId),
          store?.current?.currentUser,
        ],
        (old: unknown) => {
          if (!old || typeof old !== "object") {
            return old;
          }
          const oldItem = old as Record<string, unknown>;
          return {
            ...oldItem,
            UserData: {
              ...((oldItem.UserData as Record<string, unknown>) || {}),
              IsFavorite: true,
            },
          };
        }
      );

      return { previousItem };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousItem) {
        queryClient.setQueryData(
          [
            library.query.getItem.key,
            library.query.getItem.keyFor(itemId, userId),
            store?.current?.currentUser,
          ],
          context.previousItem
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [
          library.query.getItem.key,
          library.query.getItem.keyFor(itemId, userId),
          store?.current?.currentUser,
        ],
      });
      onDone?.();
    },
  }));

  // Unmark favorite mutation
  const unmarkFavoriteMutation = createJellyFinMutation(() => ({
    mutationFn: (jf: Api, _variables) => {
      if (!userId) {
        throw new Error("User ID is required");
      }
      return library.mutation.unmarkFavorite(jf, itemId, userId);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: [
          library.query.getItem.key,
          library.query.getItem.keyFor(itemId, userId),
          store?.current?.currentUser,
        ],
      });

      const previousItem = queryClient.getQueryData([
        library.query.getItem.key,
        library.query.getItem.keyFor(itemId, userId),
        store?.current?.currentUser,
      ]);

      queryClient.setQueryData(
        [
          library.query.getItem.key,
          library.query.getItem.keyFor(itemId, userId),
          store?.current?.currentUser,
        ],
        (old: unknown) => {
          if (!old || typeof old !== "object") {
            return old;
          }
          const oldItem = old as Record<string, unknown>;
          return {
            ...oldItem,
            UserData: {
              ...((oldItem.UserData as Record<string, unknown>) || {}),
              IsFavorite: false,
            },
          };
        }
      );

      return { previousItem };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousItem) {
        queryClient.setQueryData(
          [
            library.query.getItem.key,
            library.query.getItem.keyFor(itemId, userId),
            store?.current?.currentUser,
          ],
          context.previousItem
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [
          library.query.getItem.key,
          library.query.getItem.keyFor(itemId, userId),
          store?.current?.currentUser,
        ],
      });
      onDone?.();
    },
  }));

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
