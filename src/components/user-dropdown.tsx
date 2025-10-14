import { useNavigate } from "@solidjs/router";
import { useMutation } from "@tanstack/solid-query";
import { LogOut, Settings, User } from "lucide-solid";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { user } from "~/lib/jellyfin/user";
import { useGeneralInfo } from "./current-user-provider";

interface UserDropdownProps {
  /** Color variant for the button */
  variant?: "light" | "dark";
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
      navigate("/");
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

    document.addEventListener("click", handleClickOutside);
    onCleanup(() => document.removeEventListener("click", handleClickOutside));
  });

  const handleLogout = () => {
    logout.mutate();
    setIsUserDropdownOpen(false);
  };

  // Determine styles based on variant
  const variant = props.variant ?? "dark";
  const hoverBgClass =
    variant === "light" ? "hover:bg-black/5" : "hover:bg-white/10";
  const activeBgClass = variant === "light" ? "bg-black/5" : "bg-white/10";

  return (
    <div class={` ${props.class ?? ""}`} ref={userDropdownRef}>
      <div class="relative">
        <button
          aria-label="User profile"
          class={`rounded-md p-2 ${hoverBgClass} transition-colors ${isUserDropdownOpen() ? activeBgClass : ""}`}
          onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen())}
          title="Profile"
        >
          <User class="h-5 w-5" />
        </button>

        <Show when={isUserDropdownOpen()}>
          <div class="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-[var(--glass-shadow-lg)] backdrop-blur-sm">
            {/* User Info Section */}
            <div class="border-border border-b px-4 py-3">
              <Show
                fallback={
                  <div class="font-medium text-foreground text-sm">
                    Guest User
                  </div>
                }
                when={generalInfo.store?.user}
              >
                <div class="font-medium text-foreground text-sm">
                  {generalInfo.store?.user?.Name}
                </div>
                <Show when={generalInfo.store?.user?.ServerId}>
                  <div class="mt-1 text-muted-foreground text-xs">
                    Server: {generalInfo.store?.user?.ServerId?.slice(0, 8)}...
                  </div>
                </Show>
              </Show>
            </div>

            {/* Menu Items */}
            <div class="py-1">
              <button
                class="flex w-full items-center gap-3 px-4 py-2.5 text-foreground text-sm transition-colors hover:bg-accent"
                onClick={() => {
                  setIsUserDropdownOpen(false);
                  navigate("/settings");
                }}
              >
                <Settings class="h-4 w-4" />
                <span>Settings</span>
              </button>

              <button
                class="flex w-full items-center gap-3 px-4 py-2.5 text-destructive-foreground text-sm transition-colors hover:bg-accent"
                onClick={handleLogout}
              >
                <LogOut class="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
