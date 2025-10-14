import {
  Calendar,
  Server,
  Settings as SettingsIcon,
  Shield,
  User as UserIcon,
} from "lucide-solid";
import { createSignal, Show } from "solid-js";
import { useGeneralInfo } from "~/components/current-user-provider";
import { Nav } from "~/components/Nav";
import { QueryBoundary } from "~/components/query-boundary";
import { GlassCard } from "~/components/ui";
import { user } from "~/lib/jellyfin/user";
import { useServerStore } from "~/lib/store-hooks";
import { createJellyFinQuery } from "~/lib/utils";

export default function SettingsPage() {
  const { store } = useGeneralInfo();
  const { store: serverStore } = useServerStore();
  const [activeTab, setActiveTab] = createSignal("profile");

  // Fetch user details from Jellyfin
  const userDetails = createJellyFinQuery(() => ({
    queryKey: [user.query.details.key],
    queryFn: (jf) => user.query.details(jf),
  }));

  const formatDate = (dateString?: string) => {
    if (!dateString) {
      return "N/A";
    }
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <section class="flex h-full flex-col overflow-hidden">
      {/* Navigation Bar */}
      <Nav
        breadcrumbs={[
          {
            label: "Settings",
            icon: <SettingsIcon class="h-4 w-4 flex-shrink-0 opacity-70" />,
          },
        ]}
        currentPage={activeTab() === "profile" ? "Profile" : "Server"}
        variant="light"
      />

      {/* Content Area */}
      <div class="flex-1 overflow-y-auto px-8 py-6">
        <div class="mx-auto max-w-4xl">
          {/* Tab Navigation */}
          <div class="mb-6 flex border-border border-b">
            <button
              class={`px-4 py-2 font-medium transition-colors ${
                activeTab() === "profile"
                  ? "border-foreground border-b-2 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("profile")}
            >
              Profile
            </button>
            <button
              class={`px-4 py-2 font-medium transition-colors ${
                activeTab() === "server"
                  ? "border-foreground border-b-2 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("server")}
            >
              Server
            </button>
          </div>

          {/* Tab Content */}
          <Show when={activeTab() === "profile"}>
            <QueryBoundary
              loadingFallback={
                <GlassCard class="p-8 text-center" preset="card">
                  <div class="animate-pulse">Loading profile...</div>
                </GlassCard>
              }
              query={userDetails}
            >
              {(data) => (
                <GlassCard class="p-6" preset="card">
                  <h2 class="mb-6 flex items-center gap-2 font-semibold text-xl">
                    <UserIcon class="h-5 w-5" />
                    User Profile
                  </h2>

                  <div class="space-y-6">
                    {/* User Details */}
                    <div class="grid gap-6 md:grid-cols-2">
                      <div>
                        <h3 class="mb-1 font-medium text-muted-foreground text-sm">
                          Username
                        </h3>
                        <p class="text-foreground">
                          {data?.Name || store?.user?.Name || "N/A"}
                        </p>
                      </div>

                      <div>
                        <h3 class="mb-1 flex items-center gap-1 font-medium text-muted-foreground text-sm">
                          <Shield class="h-4 w-4" />
                          Policy
                        </h3>
                        <p class="text-foreground">
                          {data?.Policy?.IsAdministrator
                            ? "Administrator"
                            : "User"}
                        </p>
                      </div>

                      <div>
                        <h3 class="mb-1 flex items-center gap-1 font-medium text-muted-foreground text-sm">
                          <Calendar class="h-4 w-4" />
                          Last Login
                        </h3>
                        <p class="text-foreground">
                          {formatDate(data?.LastLoginDate || undefined)}
                        </p>
                      </div>
                    </div>

                    {/* Additional Profile Information */}
                    <div class="border-border border-t pt-4">
                      <h3 class="mb-3 font-medium text-muted-foreground text-sm">
                        Account Information
                      </h3>
                      <div class="grid gap-4 text-sm md:grid-cols-2">
                        <div>
                          <span class="text-muted-foreground">User ID:</span>
                          <p class="mt-1 font-mono text-foreground text-xs">
                            {data?.Id || store?.user?.Id || "N/A"}
                          </p>
                        </div>
                        <div>
                          <span class="text-muted-foreground">
                            Server Version:
                          </span>
                          <p class="mt-1 text-foreground">
                            {serverStore.current?.info.systemInfo?.Version ||
                              "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              )}
            </QueryBoundary>
          </Show>

          <Show when={activeTab() === "server"}>
            <GlassCard class="p-6" preset="card">
              <h2 class="mb-6 flex items-center gap-2 font-semibold text-xl">
                <Server class="h-5 w-5" />
                Server Information
              </h2>

              <div class="space-y-6">
                <div class="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 class="mb-1 font-medium text-muted-foreground text-sm">
                      Server ID
                    </h3>
                    <p class="font-mono text-foreground text-xs">
                      {store?.user?.ServerId?.slice(0, 8) || "N/A"}...
                    </p>
                  </div>

                  <div>
                    <h3 class="mb-1 font-medium text-muted-foreground text-sm">
                      Server Name
                    </h3>
                    <p class="text-foreground">
                      {serverStore.current?.info.systemInfo?.ServerName ||
                        "N/A"}
                    </p>
                  </div>

                  <div>
                    <h3 class="mb-1 font-medium text-muted-foreground text-sm">
                      Server Response Time
                    </h3>
                    <p class="text-foreground">
                      {serverStore.current?.info.responseTime}ms
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </Show>
        </div>
      </div>
    </section>
  );
}
