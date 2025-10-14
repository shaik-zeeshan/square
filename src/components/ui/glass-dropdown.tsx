import { type ComponentProps, type JSX, Show, splitProps } from "solid-js";
import { getGlassClasses, glassAnimations } from "~/lib/glass-utils";
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
          "absolute right-0 left-0 z-50 p-2",
          getGlassClasses("dropdown"),
          glassAnimations.fadeIn,
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
      aria-selected={local.selected}
      class={cn(
        "w-full cursor-pointer rounded-md px-3 py-2 text-left text-white/90 transition-all duration-[var(--glass-transition-fast)] hover:bg-[#111111d1] hover:text-white focus:bg-[#111111d1] focus:outline-none",
        local.selected && "bg-[#111111d1] text-white",
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
