import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client";
import { Check, Heart, X } from "lucide-solid";
import { type ComponentProps, Show, splitProps } from "solid-js";
import type { WithImage } from "~/effect/services/jellyfin/service";
import { useItemActions } from "~/hooks/useItemActions";
import { cn } from "~/lib/utils";

type ItemActionsProps = {
  item: WithImage<BaseItemDto>;
  itemId: string;
  variant: "card" | "detail"; // card = icon-only, detail = with tooltips
  class?: string;
} & ComponentProps<"div">;

export function ItemActions(props: ItemActionsProps) {
  const [local, others] = splitProps(props, [
    "item",
    "itemId",
    "variant",
    "class",
  ]);

  const actions = useItemActions(local.itemId);

  const isPlayed = () => local.item.UserData?.Played ?? false;
  const isFavorite = () => local.item.UserData?.IsFavorite ?? false;

  const handleMarkPlayed = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPlayed()) {
      actions.markUnplayed();
    } else {
      actions.markPlayed();
    }
  };

  const handleToggleFavorite = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    if (isFavorite()) {
      actions.unmarkFavorite();
    } else {
      actions.markFavorite();
    }
  };

  return (
    <div class={cn("flex gap-2", local.class)} {...others}>
      {/* Played/Unplayed toggle */}
      <button
        class="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-all hover:scale-110 hover:bg-black/70"
        onClick={handleMarkPlayed}
        title={
          local.variant === "detail"
            ? // biome-ignore lint/style/noNestedTernary: false positive
              isPlayed()
              ? "Mark as unplayed"
              : "Mark as played"
            : undefined
        }
      >
        <Show fallback={<Check class="h-4 w-4" />} when={isPlayed()}>
          <X class="h-4 w-4" />
        </Show>
      </button>

      {/* Favorite toggle */}
      <button
        class={cn(
          "flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-all hover:scale-110 hover:bg-black/70",
          isFavorite() && "text-red-500"
        )}
        onClick={handleToggleFavorite}
        title={
          local.variant === "detail"
            ? // biome-ignore lint/style/noNestedTernary: false positive
              isFavorite()
              ? "Remove from favorites"
              : "Add to favorites"
            : undefined
        }
      >
        <Heart
          class={cn(
            "h-4 w-4 transition-colors",
            isFavorite() ? "fill-current" : "fill-none"
          )}
        />
      </button>
    </div>
  );
}
