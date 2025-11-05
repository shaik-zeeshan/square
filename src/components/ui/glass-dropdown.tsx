import { type ComponentProps, type JSX, Show, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export interface GlassDropdownProps extends ComponentProps<"div"> {
  open?: boolean;
  position?: "top" | "bottom" | "left" | "right";
  children: JSX.Element;
}

export function GlassDropdown(props: GlassDropdownProps) {
  const [local, others] = splitProps(props, [
    "class",
    "open",
    "position",
    "children",
  ]);

  const positionClasses = () => {
    switch (local.position) {
      case "top":
        return "bottom-full mb-2";
      case "bottom":
        return "top-full mt-2";
      case "left":
        return "right-full mr-2";
      case "right":
        return "left-full ml-2";
      default:
        return "bottom-full mb-2";
    }
  };

  return (
    <Show when={local.open}>
      <div
        class={cn(
          "fade-in absolute right-0 left-0 z-50 animate-in rounded-lg border border-gray-200 bg-white p-2 shadow-lg duration-200 dark:border-gray-700 dark:bg-gray-800",
          positionClasses(),
          local.class
        )}
        role="menu"
        {...others}
      >
        <div class="max-h-56 overflow-auto px-1 py-1">{local.children}</div>
      </div>
    </Show>
  );
}

export interface GlassDropdownItemProps extends ComponentProps<"button"> {
  selected?: boolean;
}

export function GlassDropdownItem(props: GlassDropdownItemProps) {
  const [local, others] = splitProps(props, ["class", "selected", "children"]);

  return (
    <button
      aria-current={local.selected ? "true" : "false"}
      class={cn(
        "w-full cursor-pointer rounded-md px-3 py-2 text-left transition-all duration-200 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none dark:focus:bg-gray-700 dark:hover:bg-gray-700",
        local.selected && "bg-gray-100 dark:bg-gray-700",
        local.class
      )}
      role="menuitem"
      type="button"
      {...others}
    >
      {local.children}
    </button>
  );
}
