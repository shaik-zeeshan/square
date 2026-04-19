import { createEventListener } from "@solid-primitives/event-listener";
import { useNavigate } from "@solidjs/router";
import { createEffect, createSignal, For, type JSX, Show } from "solid-js";
import { cn } from "~/lib/utils";
import ChevronRight from "~icons/lucide/chevron-right";
import House from "~icons/lucide/house";
import Search from "~icons/lucide/search";
import X from "~icons/lucide/x";
import { UserDropdown } from "./user-dropdown";

type NavProps = {
  /** Breadcrumb items to display */
  breadcrumbs?: Array<{
    label: string;
    onClick?: () => void;
    icon?: JSX.Element;
  }>;
  /** Current page title (shown as the last breadcrumb) */
  currentPage?: string;
  /** Show search functionality */
  showSearch?: boolean;
  /** Search value */
  searchValue?: string;
  /** Search callback */
  onSearchChange?: (value: string) => void;
  /** Additional actions to render on the right side */
  actions?: JSX.Element;
  /** Custom class for the nav container */
  class?: string;
  /**
   * Color variant — kept for backward-compat; both render on the dark shell.
   * "light" is treated as "dark" now — all routes use the cinematic surface.
   */
  variant?: "light" | "dark";
};

export function Nav(props: NavProps) {
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = createSignal(false);

  let searchInputRef!: HTMLInputElement;

  // Auto-focus search input when opened
  createEffect(() => {
    if (isSearchOpen() && searchInputRef) {
      // Small delay to let the CSS transition start, then focus
      requestAnimationFrame(() => searchInputRef.focus());
    }
  });

  const handleSearchClose = () => {
    setIsSearchOpen(false);
    props.onSearchChange?.("");
  };

  const handleSearchOpen = () => {
    if (props.showSearch) {
      setIsSearchOpen(true);
    }
  };

  // Keyboard shortcuts: Cmd/Ctrl+K, "/" to open, Escape to close (clears text first)
  createEventListener(
    document,
    "keydown",
    (e) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (isSearchOpen()) {
          handleSearchClose();
        } else {
          handleSearchOpen();
        }
        return;
      }

      // "/" opens search when not already in an input
      if (e.key === "/" && !isInput && !isSearchOpen()) {
        e.preventDefault();
        handleSearchOpen();
        return;
      }

      if (e.key === "Escape" && isSearchOpen()) {
        e.preventDefault();
        // If there's text, clear it first; if already empty, close
        if (props.searchValue) {
          props.onSearchChange?.("");
        } else {
          handleSearchClose();
        }
      }
    },
    { passive: false }
  );

  return (
    <nav
      class={cn(
        // Floating streaming nav — inset from edges, rounded, translucent
        "relative z-50 mx-5 mt-2 h-[48px] shrink-0 rounded-2xl px-5",
        // Translucent tonal surface — not a hard band
        "border border-white/[0.08]",
        "bg-[rgba(8,14,30,0.55)] shadow-[0_2px_24px_rgba(0,0,0,0.35)]",
        "backdrop-blur-xl backdrop-saturate-150",
        props.class
      )}
    >
      {/* Subtle inner highlight — premium depth cue */}
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
      />

      <div class="flex h-full items-center justify-between gap-2 sm:gap-4">
        {/* ── Left: home icon + breadcrumbs ── */}
        <div class="flex min-w-0 flex-1 items-center gap-2.5">
          <button
            aria-label="Go home"
            class={cn(
              "shrink-0 rounded-lg p-1.5 text-white/45",
              "transition-all duration-200",
              "hover:bg-white/[0.08] hover:text-white/90",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 focus-visible:outline-offset-2",
              "active:scale-95"
            )}
            onClick={() => navigate("/")}
            title="Home"
            type="button"
          >
            <House class="h-4 w-4" />
          </button>

          {/* Vertical divider */}
          <div aria-hidden="true" class="h-3.5 w-px shrink-0 bg-white/[0.10]" />

          {/* Breadcrumb trail */}
          <div class="flex min-w-0 items-center gap-1.5 overflow-hidden">
            <Show when={props.breadcrumbs && props.breadcrumbs.length > 0}>
              <For each={props.breadcrumbs}>
                {(breadcrumb, index) => (
                  <>
                    <Show when={breadcrumb.icon}>
                      <span class="text-white/40 [&_svg]:h-3.5 [&_svg]:w-3.5">
                        {breadcrumb.icon}
                      </span>
                    </Show>
                    <Show
                      fallback={
                        <span class="truncate text-[13px] text-white/40 tracking-normal">
                          {breadcrumb.label}
                        </span>
                      }
                      when={breadcrumb.onClick}
                    >
                      <button
                        aria-label={`Navigate to ${breadcrumb.label}`}
                        class={cn(
                          "truncate text-[13px] text-white/40 tracking-normal",
                          "transition-colors duration-200 hover:text-white/70",
                          "focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
                        )}
                        onClick={breadcrumb.onClick}
                        type="button"
                      >
                        {breadcrumb.label}
                      </button>
                    </Show>
                    <Show
                      when={
                        index() < (props.breadcrumbs?.length ?? 0) - 1 ||
                        props.currentPage
                      }
                    >
                      <ChevronRight class="h-3 w-3 shrink-0 text-white/20" />
                    </Show>
                  </>
                )}
              </For>
            </Show>

            <Show when={props.currentPage}>
              <span class="truncate font-medium text-[13px] text-white/90 tracking-tight">
                {props.currentPage}
              </span>
            </Show>
          </div>
        </div>

        {/* ── Right: search + actions + user ── */}
        <div class="flex h-full min-w-0 shrink items-center gap-1.5">
          <Show when={props.showSearch}>
            {/* 
              Search container — uses CSS grid with a transitioning column 
              so the expansion/collapse is smooth without layout jumps.
            */}
            <div
              class={cn(
                "relative flex items-center overflow-hidden rounded-xl [&_*]:outline-none [&_*]:ring-0",
                "border transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                isSearchOpen()
                  ? "min-w-[240px] border-white/[0.12] bg-white/[0.07] sm:min-w-[300px]"
                  : "min-w-[160px] border-white/[0.06] bg-white/[0.04] hover:border-white/[0.12] hover:bg-white/[0.07] sm:min-w-[200px]"
              )}
            >
              {/* Clickable trigger area — always present, but invisible when search is open */}
              <Show when={!isSearchOpen()}>
                <button
                  aria-label="Search (⌘K or /)"
                  class={cn(
                    "flex w-full items-center gap-2.5 px-3.5 py-2",
                    "text-[13px] text-white/30",
                    "transition-all duration-200",
                    "hover:text-white/55",
                    "focus-visible:outline-none",
                    "active:scale-[0.98]"
                  )}
                  onClick={handleSearchOpen}
                  title="Search (⌘K or /)"
                  type="button"
                >
                  <Search class="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span class="flex-1 text-left">Search...</span>
                  <div class="hidden items-center gap-1 sm:flex">
                    <kbd class="rounded-md border border-white/[0.08] bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-white/20 leading-none">
                      /
                    </kbd>
                  </div>
                </button>
              </Show>

              {/* Expanded search input */}
              <Show when={isSearchOpen()}>
                <div
                  class="flex w-full items-center gap-2.5 px-3.5"
                  style={{
                    animation:
                      "searchExpand 250ms cubic-bezier(0.22,1,0.36,1) both",
                  }}
                >
                  <Search
                    class={cn(
                      "h-3.5 w-3.5 shrink-0 transition-colors duration-200",
                      props.searchValue ? "text-blue-400/70" : "text-white/35"
                    )}
                  />
                  <input
                    aria-label="Search"
                    class={cn(
                      "h-9 w-full bg-transparent text-[13px] text-white outline-none ring-0 focus:outline-none focus-visible:outline-none",
                      "placeholder:text-white/25",
                      "caret-blue-400"
                    )}
                    data-search-input
                    onInput={(e) =>
                      props.onSearchChange?.(e.currentTarget.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        if (props.searchValue) {
                          props.onSearchChange?.("");
                        } else {
                          handleSearchClose();
                        }
                      }
                    }}
                    placeholder="Search movies, shows..."
                    ref={searchInputRef}
                    type="text"
                    value={props.searchValue ?? ""}
                  />
                  {/* Clear text button — only when there's text */}
                  <Show when={props.searchValue}>
                    <button
                      aria-label="Clear search"
                      class={cn(
                        "rounded-md p-1 text-white/30",
                        "transition-all duration-150",
                        "hover:bg-white/[0.08] hover:text-white/60",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400",
                        "active:scale-90"
                      )}
                      onClick={() => {
                        props.onSearchChange?.("");
                        searchInputRef?.focus();
                      }}
                      type="button"
                    >
                      <X class="h-3.5 w-3.5" />
                    </button>
                  </Show>
                  {/* Close search button */}
                  <button
                    aria-label="Close search"
                    class={cn(
                      "rounded-md px-1.5 py-1 font-mono text-[10px] text-white/20",
                      "border border-white/[0.06] bg-white/[0.03]",
                      "transition-all duration-150",
                      "hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white/40",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
                    )}
                    onClick={handleSearchClose}
                    type="button"
                  >
                    esc
                  </button>
                </div>
              </Show>
            </div>
          </Show>

          {props.actions}

          {/* Separator before user avatar */}
          <div aria-hidden="true" class="mx-1 h-3.5 w-px bg-white/[0.07]" />

          <UserDropdown variant="dark" />
        </div>
      </div>
    </nav>
  );
}
