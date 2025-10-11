import { useNavigate } from '@solidjs/router';
import { Home, Search, ChevronRight, X } from 'lucide-solid';
import { Show, createSignal, createEffect, type JSX } from 'solid-js';
import { UserDropdown } from './user-dropdown';

interface NavProps {
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
  variant?: 'light' | 'dark';
}

export function Nav(props: NavProps) {
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = createSignal(false);

  let searchInputRef: HTMLInputElement | undefined;

  // Auto-focus search input when opened
  createEffect(() => {
    if (isSearchOpen() && searchInputRef) {
      searchInputRef.focus();
    }
  });

  const handleSearchClose = () => {
    setIsSearchOpen(false);
    props.onSearchChange?.('');
  };

  // Determine text color based on variant
  const variant = props.variant ?? 'dark';
  const textColorClass = variant === 'light' ? 'text-black' : 'text-white';
  const hoverBgClass =
    variant === 'light' ? 'hover:bg-black/5' : 'hover:bg-white/10';
  const searchBgClass =
    variant === 'light'
      ? 'bg-black/10 border-black/20'
      : 'bg-white/10 border-white/20';
  const searchTextClass =
    variant === 'light'
      ? 'placeholder:text-black/40'
      : 'placeholder:text-white/40';
  const dividerClass = variant === 'light' ? 'bg-black/20' : 'bg-white/20';

  return (
    <nav
      class={`relative z-50 flex-shrink-0 px-6 py-4 ${textColorClass} ${props.class ?? ''}`}
    >
      <div class="flex items-center justify-between gap-4">
        {/* Left Side - Breadcrumb Navigation */}
        <div class="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/')}
            class={`p-2 rounded-md ${hoverBgClass} transition-colors flex-shrink-0`}
            aria-label="Go home"
            title="Home"
          >
            <Home class="w-5 h-5" />
          </button>

          <div class={`h-6 w-px ${dividerClass} flex-shrink-0`} />

          <div class="flex items-center gap-2 text-sm min-w-0 overflow-hidden">
            <Show when={props.breadcrumbs && props.breadcrumbs.length > 0}>
              {props.breadcrumbs?.map((breadcrumb, index) => (
                <>
                  <Show when={breadcrumb.icon}>{breadcrumb.icon}</Show>
                  <Show
                    when={breadcrumb.onClick}
                    fallback={
                      <span class="opacity-70 truncate">
                        {breadcrumb.label}
                      </span>
                    }
                  >
                    <button
                      onClick={breadcrumb.onClick}
                      class="opacity-70 hover:opacity-100 transition-opacity truncate"
                      aria-label={`Navigate to ${breadcrumb.label}`}
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
                    <ChevronRight class="w-4 h-4 opacity-50 flex-shrink-0" />
                  </Show>
                </>
              ))}
            </Show>

            <Show when={props.currentPage}>
              <span class="font-semibold truncate">{props.currentPage}</span>
            </Show>
          </div>
        </div>

        {/* Right Side - Actions & Search */}
        <div class="flex items-center gap-2 flex-shrink-0">
          <Show when={props.showSearch}>
            <Show
              when={isSearchOpen()}
              fallback={
                <button
                  onClick={() => setIsSearchOpen(true)}
                  class={`p-2 rounded-md ${hoverBgClass} transition-colors`}
                  aria-label="Search"
                  title="Search"
                >
                  <Search class="w-5 h-5" />
                </button>
              }
            >
              <div
                class={`flex items-center gap-2 ${searchBgClass} rounded-lg px-3 py-1.5 backdrop-blur-sm border`}
              >
                <Search class="w-4 h-4 opacity-60 flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={props.searchValue ?? ''}
                  onInput={(e) => props.onSearchChange?.(e.currentTarget.value)}
                  placeholder="Search..."
                  class={`bg-transparent outline-none text-sm w-48 ${searchTextClass}`}
                />
                <button
                  onClick={handleSearchClose}
                  class={`p-1 rounded ${hoverBgClass} transition-colors`}
                  aria-label="Close search"
                >
                  <X class="w-4 h-4" />
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
