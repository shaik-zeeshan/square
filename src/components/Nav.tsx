import { createEventListener } from "@solid-primitives/event-listener";
import { useNavigate } from "@solidjs/router";
import { ChevronRight, Home, Search, X } from "lucide-solid";
import { createEffect, createSignal, type JSX, Show } from "solid-js";
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
  /** Color variant for the nav */
  variant?: "light" | "dark";
};

export function Nav(props: NavProps) {
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = createSignal(false);

  let searchInputRef!: HTMLInputElement;

  // Auto-focus search input when opened
  createEffect(() => {
    if (isSearchOpen() && searchInputRef) {
      searchInputRef.focus();
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

  // Add Ctrl+K keyboard shortcut to open search
  createEventListener(
    document,
    "keydown",
    (e) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      // Check for Ctrl+K (or Cmd+K on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        handleSearchOpen();
      }
      // Close search with Escape
      if (e.key === "Escape" && isSearchOpen()) {
        e.preventDefault();
        handleSearchClose();
      }
    },
    { passive: false }
  );

  // Determine text color based on variant
  const variant = props.variant ?? "dark";
  const textColorClass = variant === "light" ? "text-black" : "text-white";
  const hoverBgClass =
    variant === "light" ? "hover:bg-black/5" : "hover:bg-white/10";
  const searchBgClass =
    variant === "light"
      ? "bg-black/10 border-black/20"
      : "bg-white/10 border-white/20";
  const searchTextClass =
    variant === "light"
      ? "placeholder:text-black/40"
      : "placeholder:text-white/40";
  const dividerClass = variant === "light" ? "bg-black/20" : "bg-white/20";

  return (
    <nav
      class={`relative z-50 flex-shrink-0 px-6 py-4 ${textColorClass} ${props.class ?? ""}`}
    >
      <div class="flex items-center justify-between gap-4">
        {/* Left Side - Breadcrumb Navigation */}
        <div class="flex min-w-0 items-center gap-3">
          <button
            aria-label="Go home"
            class={`rounded-md p-2 ${hoverBgClass} flex-shrink-0 transition-colors`}
            onClick={() => navigate("/")}
            title="Home"
            type="button"
          >
            <Home class="h-5 w-5" />
          </button>

          <div class={`h-6 w-px ${dividerClass} flex-shrink-0`} />

          <div class="flex min-w-0 items-center gap-2 overflow-hidden text-sm">
            <Show when={props.breadcrumbs && props.breadcrumbs.length > 0}>
              {props.breadcrumbs?.map((breadcrumb, index) => (
                <>
                  <Show when={breadcrumb.icon}>{breadcrumb.icon}</Show>
                  <Show
                    fallback={
                      <span class="truncate opacity-70">
                        {breadcrumb.label}
                      </span>
                    }
                    when={breadcrumb.onClick}
                  >
                    <button
                      aria-label={`Navigate to ${breadcrumb.label}`}
                      class="truncate opacity-70 transition-opacity hover:opacity-100"
                      onClick={breadcrumb.onClick}
                      type="button"
                    >
                      {breadcrumb.label}
                    </button>
                  </Show>
                  <Show
                    when={
                      index < (props.breadcrumbs?.length ?? 0) - 1 ||
                      props.currentPage
                    }
                  >
                    <ChevronRight class="h-4 w-4 flex-shrink-0 opacity-50" />
                  </Show>
                </>
              ))}
            </Show>

            <Show when={props.currentPage}>
              <span class="truncate font-semibold">{props.currentPage}</span>
            </Show>
          </div>
        </div>

        {/* Right Side - Actions & Search */}
        <div class="flex flex-shrink-0 items-center gap-2">
          <Show when={props.showSearch}>
            <Show
              fallback={
                <button
                  aria-label="Search"
                  class={`rounded-md p-2 ${hoverBgClass} transition-colors`}
                  onClick={handleSearchOpen}
                  title="Search (Ctrl+K)"
                  type="button"
                >
                  <Search class="h-5 w-5" />
                </button>
              }
              when={isSearchOpen()}
            >
              <div
                class={`flex items-center gap-2 ${searchBgClass} rounded-lg border px-3 py-1.5 backdrop-blur-sm`}
              >
                <Search class="h-4 w-4 flex-shrink-0 opacity-60" />
                <input
                  class={`w-48 bg-transparent text-sm outline-none ${searchTextClass}`}
                  onInput={(e) => props.onSearchChange?.(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      handleSearchClose();
                    }
                  }}
                  placeholder="Search..."
                  ref={searchInputRef}
                  type="text"
                  value={props.searchValue ?? ""}
                />
                <button
                  aria-label="Close search"
                  class={`rounded p-1 ${hoverBgClass} transition-colors`}
                  onClick={handleSearchClose}
                  type="button"
                >
                  <X class="h-4 w-4" />
                </button>
              </div>
            </Show>
          </Show>

          {props.actions}

          <UserDropdown variant={variant} />
        </div>
      </div>
    </nav>
  );
}
