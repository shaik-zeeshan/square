import { createContextProvider } from "@solid-primitives/context";
import { createEventListener } from "@solid-primitives/event-listener";
import {
  type ComponentProps,
  createUniqueId,
  type JSX,
  type JSXElement,
  mergeProps,
  splitProps,
} from "solid-js";
import { createStore } from "solid-js/store";
import { Portal, Show } from "solid-js/web";
import { cn } from "~/lib/utils";

type DropdownState = {
  id: string;
  open: boolean;
};

const [DropdownProvider, useDropdownContext] = createContextProvider(
  (props) => {
    const [state, setState] = createStore(props);

    return {
      state,
      onOpenChange: (value: boolean) => {
        setState("open", () => value);
      },
    };
  }
);

const useDropdown = () => {
  const ctx = useDropdownContext();
  if (!ctx) {
    throw new Error("useDropdown must be used inside Dropdown");
  }
  return ctx;
};

const DEFAULT_DROPDOWN = {
  open: false,
};

export const Dropdown = (
  props: Partial<DropdownState> & { children?: JSXElement }
) => {
  const id = createUniqueId();
  const defaultProps = mergeProps(DEFAULT_DROPDOWN, props);

  return (
    <DropdownProvider id={id} {...defaultProps}>
      <div class="relative" id={id}>
        {defaultProps.children}
      </div>
    </DropdownProvider>
  );
};

export const DropdownTrigger = (props: ComponentProps<"button">) => {
  let ref!: HTMLButtonElement;
  const ctx = useDropdown();

  createEventListener(
    () => ref,
    "hide",
    () => ctx?.onOpenChange(false)
  );

  return (
    <button
      class="dropdown-trigger"
      id={`btn-${ctx.state.id}`}
      onClick={() => {
        ctx?.onOpenChange(!ctx.state.open);
      }}
      ref={ref}
      style={`anchor-name:--pop-${ctx.state.id}`}
      {...props}
    />
  );
};

export const DropdownPortal = (props: ComponentProps<"div">) => {
  const ctx = useDropdown();
  const [{ children, class: classNames, style }, other] = splitProps(props, [
    "children",
    "style",
    "class",
  ]);
  let portalRef: HTMLDivElement | undefined;

  createEventListener(document, "click", (e: MouseEvent) => {
    const trigger = document.getElementById(`btn-${ctx.state.id}`);
    if (!ctx.state.open) {
      return;
    }
    if (
      portalRef &&
      !portalRef.contains(e.target as Node) &&
      trigger &&
      !trigger.contains(e.target as Node)
    ) {
      ctx.onOpenChange(!ctx.state.open);
    }
  });

  return (
    <Show when={ctx?.state.open}>
      <Portal
        mount={document.querySelector(`#${ctx?.state.id}`) as Element}
        ref={portalRef}
      >
        <div
          class={cn("max-h-96 overflow-y-auto rounded p-5", classNames)}
          style={
            {
              "position-anchor": `--pop-${ctx.state.id}`,
              position: "absolute",
              bottom: "calc(anchor(top) + 15px)",
              right: "calc(anchor(right))",
              "--item-color": "white",
              "--os-size": "11px",
              "--os-padding-perpendicular": "2px",
              "--os-padding-axis": "0px",
              ...(style as JSX.CSSProperties),
            } as JSX.CSSProperties
          }
          {...other}
        >
          {children}
        </div>
      </Portal>
    </Show>
  );
};
