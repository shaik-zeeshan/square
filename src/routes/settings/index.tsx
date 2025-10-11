import { createSignal, Show } from 'solid-js';
import { useGeneralInfo } from '~/components/current-user-provider';
import { UserDropdown } from '~/components/user-dropdown';
import { GlassCard } from '~/components/ui';
import { createJellyFinQuery } from '~/lib/utils';
import { user } from '~/lib/jellyfin/user';
import { Settings as SettingsIcon, User as UserIcon, Mail, Calendar, Shield, Server } from 'lucide-solid';
import { Nav } from '~/components/Nav';
import { QueryBoundary } from '~/components/query-boundary';
import { useServerStore } from '~/lib/store-hooks';

export default function SettingsPage() {
  const { store } = useGeneralInfo();
  const { store: serverStore } = useServerStore(); 
  const [activeTab, setActiveTab] = createSignal('profile');

  // Fetch user details from Jellyfin
  const userDetails = createJellyFinQuery(() => ({
    queryKey: [user.query.details.key],
    queryFn: (jf) => user.query.details(jf),
  }));

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <section class="h-full flex flex-col overflow-hidden">
      {/* Navigation Bar */}
      <Nav
        variant="light"
        breadcrumbs={[
          {
            label: 'Settings',
            icon: <SettingsIcon class="w-4 h-4 opacity-70 flex-shrink-0" />,
          },
        ]}
        currentPage={activeTab() === 'profile' ? 'Profile' : 'Server'}
      />

      {/* Content Area */}
      <div class="flex-1 overflow-y-auto px-8 py-6">
        <div class="max-w-4xl mx-auto">
          {/* Tab Navigation */}
          <div class="flex border-b border-border mb-6">
            <button
              onClick={() => setActiveTab('profile')}
              class={`px-4 py-2 font-medium transition-colors ${
                activeTab() === 'profile'
                  ? 'text-foreground border-b-2 border-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveTab('server')}
              class={`px-4 py-2 font-medium transition-colors ${
                activeTab() === 'server'
                  ? 'text-foreground border-b-2 border-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Server
            </button>
          </div>

          {/* Tab Content */}
          <Show when={activeTab() === 'profile'}>
            <QueryBoundary
              query={userDetails}
              loadingFallback={
                <GlassCard preset="card" class="p-8 text-center">
                  <div class="animate-pulse">Loading profile...</div>
                </GlassCard>
              }
            >
              {(data) => (
                <GlassCard preset="card" class="p-6">
                  <h2 class="text-xl font-semibold mb-6 flex items-center gap-2">
                    <UserIcon class="w-5 h-5" />
                    User Profile
                  </h2>
                  
                  <div class="space-y-6">
                    {/* User Details */}
                    <div class="grid md:grid-cols-2 gap-6">
                      <div>
                        <h3 class="text-sm font-medium text-muted-foreground mb-1">Username</h3>
                        <p class="text-foreground">{data?.Name || store?.user?.Name || 'N/A'}</p>
                      </div>
                      
                      <div>
                        <h3 class="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <Shield class="w-4 h-4" />
                          Policy
                        </h3>
                        <p class="text-foreground">{data?.Policy?.IsAdministrator ? 'Administrator' : 'User'}</p>
                      </div>
                      
                      <div>
                        <h3 class="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <Calendar class="w-4 h-4" />
                          Last Login
                        </h3>
                        <p class="text-foreground">{formatDate(data?.LastLoginDate || undefined)}</p>
                      </div>
                    </div>

                    {/* Additional Profile Information */}
                    <div class="pt-4 border-t border-border">
                      <h3 class="text-sm font-medium text-muted-foreground mb-3">Account Information</h3>
                      <div class="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span class="text-muted-foreground">User ID:</span>
                          <p class="text-foreground font-mono text-xs mt-1">{data?.Id || store?.user?.Id || 'N/A'}</p>
                        </div>
                        <div>
                          <span class="text-muted-foreground">Server Version:</span>
                          <p class="text-foreground mt-1">{serverStore.current?.info.systemInfo?.Version || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              )}
            </QueryBoundary>
          </Show>

          <Show when={activeTab() === 'server'}>
            <GlassCard preset="card" class="p-6">
              <h2 class="text-xl font-semibold mb-6 flex items-center gap-2">
                <Server class="w-5 h-5" />
                Server Information
              </h2>
              
              <div class="space-y-6">
                <div class="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 class="text-sm font-medium text-muted-foreground mb-1">Server ID</h3>
                    <p class="text-foreground font-mono text-xs">{store?.user?.ServerId?.slice(0, 8) || 'N/A'}...</p>
                  </div>
                  
                  <div>
                    <h3 class="text-sm font-medium text-muted-foreground mb-1">Server Name</h3>
                    <p class="text-foreground">{serverStore.current?.info.systemInfo?.ServerName || 'N/A'}</p>
                  </div>

                  <div>
                    <h3 class="text-sm font-medium text-muted-foreground mb-1">Server Response Time</h3>
                    <p class="text-foreground">{serverStore.current?.info.responseTime}ms</p>
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

