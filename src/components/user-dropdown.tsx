import { useNavigate } from '@solidjs/router';
import { User, Settings, LogOut } from 'lucide-solid';
import { Show, createSignal, createEffect, onCleanup, onMount } from 'solid-js';
import { useGeneralInfo } from './current-user-provider';
import { useMutation } from '@tanstack/solid-query';
import { user } from '~/lib/jellyfin/user';

interface UserDropdownProps {
  /** Color variant for the button */
  variant?: 'light' | 'dark';
  /** Additional class for the container */
  class?: string;
}

export function UserDropdown(props: UserDropdownProps) {
  const navigate = useNavigate();
  const generalInfo = useGeneralInfo();
  const [isUserDropdownOpen, setIsUserDropdownOpen] = createSignal(false);
  let userDropdownRef: HTMLDivElement | undefined;

  const logout = useMutation(() => ({
    mutationFn: async () => {
      return await user.mutation.logout();
    },
    onSuccess: () => {
      navigate('/');
    },
  }));

  // Handle click outside dropdown
  createEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isUserDropdownOpen() &&
        userDropdownRef &&
        !userDropdownRef.contains(e.target as Node)
      ) {
        setIsUserDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    onCleanup(() => document.removeEventListener('click', handleClickOutside));
  });

  const handleLogout = () => {
    logout.mutate();
    setIsUserDropdownOpen(false);
  };

  // Determine styles based on variant
  const variant = props.variant ?? 'dark';
  const hoverBgClass =
    variant === 'light' ? 'hover:bg-black/5' : 'hover:bg-white/10';
  const activeBgClass = variant === 'light' ? 'bg-black/5' : 'bg-white/10';

  return (
    <div class={` ${props.class ?? ''}`} ref={userDropdownRef}>
      <div class="relative">
        <button
          onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen())}
          class={`p-2 rounded-md ${hoverBgClass} transition-colors ${isUserDropdownOpen() ? activeBgClass : ''}`}
          aria-label="User profile"
          title="Profile"
        >
          <User class="w-5 h-5" />
        </button>

        <Show when={isUserDropdownOpen()}>
          <div class="absolute right-0 mt-2 w-64 bg-popover rounded-lg shadow-[var(--glass-shadow-lg)] border border-border overflow-hidden z-50 backdrop-blur-sm">
            {/* User Info Section */}
            <div class="px-4 py-3 border-b border-border">
              <Show
                when={generalInfo.store?.user}
                fallback={
                  <div class="text-sm text-foreground font-medium">
                    Guest User
                  </div>
                }
              >
                <div class="text-sm text-foreground font-medium">
                  {generalInfo.store?.user?.Name}
                </div>
                <Show when={generalInfo.store?.user?.ServerId}>
                  <div class="text-xs text-muted-foreground mt-1">
                    Server: {generalInfo.store?.user?.ServerId?.slice(0, 8)}...
                  </div>
                </Show>
              </Show>
            </div>

            {/* Menu Items */}
            <div class="py-1">
              <button
                onClick={() => {
                  setIsUserDropdownOpen(false);
                  navigate('/settings');
                }}
                class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
              >
                <Settings class="w-4 h-4" />
                <span>Settings</span>
              </button>

              <button
                onClick={handleLogout}
                class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive-foreground hover:bg-accent transition-colors"
              >
                <LogOut class="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
