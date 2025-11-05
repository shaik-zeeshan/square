import { For, type JSXElement } from "solid-js";
import {
  Dropdown,
  DropdownPortal,
  DropdownTrigger,
} from "~/components/ui/dropdown";

export function Select<T>(props: {
  list: T[];
  itemRender: (item: T) => JSXElement;
  trigger: JSXElement;
}) {
  return (
    <Dropdown>
      <DropdownTrigger class="border-none bg-transparent dark:bg-transparent">
        {props.trigger}
      </DropdownTrigger>
      <DropdownPortal class="max-h-96 w-56 overflow-y-auto rounded bg-neutral-500 p-5">
        <div class="flex flex-col gap-2">
          <For each={props.list}>{(item) => props.itemRender(item)}</For>
        </div>
      </DropdownPortal>
    </Dropdown>
  );
}
