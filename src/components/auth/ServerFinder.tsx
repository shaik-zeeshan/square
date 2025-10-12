import { Show } from 'solid-js';
import { Search, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from 'lucide-solid';
import { RecommendedServerInfo } from '@jellyfin/sdk';
import { GlassButton, GlassCard } from '~/components/ui';
import { Input } from '~/components/input';
import { useServerDiscovery } from '~/hooks/useServerDiscovery';

interface ServerFinderProps {
  onServerSelected: (server: RecommendedServerInfo) => void;
  onBack?: () => void;
}

export function ServerFinder(props: ServerFinderProps) {
  const {
    urlField,
    urlError,
    isLoading,
    discoveredServers,
    hasServers,
    searchError,
    showNoResults,
    handleUrlChange,
    handleUrlBlur,
    handleSearch,
    handleKeyPress,
    handleServerSelect,
    handleBack,
  } = useServerDiscovery({
    onServerSelected: props.onServerSelected,
    onBack: props.onBack,
  });

  return (
    <div class="w-full space-y-6">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 mb-4">
          <Search class="w-8 h-8 text-purple-400" />
        </div>
        <h2 class="text-3xl font-bold mb-2">Find Server</h2>
        <p class="text-sm opacity-60">Enter your Jellyfin server address</p>
      </div>

      <GlassCard preset="card" class="p-6 space-y-4">
        <div class="space-y-2">
          <label for="server-url" class="text-sm font-medium opacity-80">
            Server Address
          </label>
          <div class="w-full flex gap-2">
            <div class="flex-1">
              <Input
                id="server-url"
                placeholder="https://jellyfin.example.com"
                value={urlField().value}
                onInput={(e) => handleUrlChange(e.currentTarget.value)}
                onBlur={handleUrlBlur}
                onKeyPress={handleKeyPress}
                class="w-full"
                disabled={isLoading()}
                aria-invalid={!!urlError()}
                aria-describedby={urlError() ? 'url-error' : undefined}
              />
              <Show when={urlError()}>
                <p
                  id="url-error"
                  class="text-xs text-red-400 mt-1.5 flex items-center gap-1"
                >
                  <AlertCircle class="w-3 h-3" />
                  {urlError()}
                </p>
              </Show>
            </div>
            <GlassButton
              variant="glass"
              size="icon"
              onClick={handleSearch}
              disabled={!urlField().value.trim() || isLoading()}
              aria-label="Search for servers"
            >
              <Show
                when={isLoading()}
                fallback={<Search class="w-5 h-5" />}
              >
                <Loader2 class="w-5 h-5 animate-spin" />
              </Show>
            </GlassButton>
          </div>
        </div>

        {/* Search Results */}
        <Show when={searchError()}>
          <div class="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
            <div class="flex items-start gap-3">
              <AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p class="text-sm text-red-300 font-medium">Search Failed</p>
                <p class="text-xs text-red-400 mt-1">
                  {searchError()?.message ||
                    'Could not connect to server. Please check the address and try again.'}
                </p>
              </div>
            </div>
          </div>
        </Show>

        <Show when={hasServers()}>
          <div class="mt-4">
            <div class="flex items-center gap-2 mb-3">
              <CheckCircle2 class="w-4 h-4 text-green-400" />
              <p class="text-sm font-medium text-green-400">
                Found {discoveredServers().length} server
                {discoveredServers().length !== 1 ? 's' : ''}
              </p>
            </div>
            <div class="space-y-2">
              <DiscoveredServerList
                servers={discoveredServers()}
                onServerSelect={handleServerSelect}
              />
            </div>
          </div>
        </Show>

        <Show when={showNoResults()}>
          <div class="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <div class="flex items-start gap-3">
              <AlertCircle class="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p class="text-sm text-yellow-300 font-medium">
                  No Servers Found
                </p>
                <p class="text-xs text-yellow-400 mt-1">
                  No Jellyfin servers were detected at this address.
                </p>
              </div>
            </div>
          </div>
        </Show>
      </GlassCard>

      <Show when={props.onBack}>
        <GlassButton
          variant="glass-subtle"
          class="w-full"
          onClick={handleBack}
          disabled={isLoading()}
        >
          <ArrowLeft class="w-4 h-4 mr-2" />
          Back to Server List
        </GlassButton>
      </Show>
    </div>
  );
}

interface DiscoveredServerListProps {
  servers: RecommendedServerInfo[];
  onServerSelect: (server: RecommendedServerInfo) => void;
}

function DiscoveredServerList(props: DiscoveredServerListProps) {
  return (
    <>
      {props.servers.map((server) => (
        <DiscoveredServerCard
          key={server.address}
          server={server}
          onSelect={() => props.onServerSelect(server)}
        />
      ))}
    </>
  );
}

interface DiscoveredServerCardProps {
  server: RecommendedServerInfo;
  onSelect: () => void;
}

function DiscoveredServerCard(props: DiscoveredServerCardProps) {
  return (
    <GlassCard
      role="button"
      tabindex={0}
      class="cursor-pointer p-4 hover:bg-[var(--glass-bg-medium)] transition-all"
      onClick={props.onSelect}
      onKeyPress={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onSelect();
        }
      }}
      aria-label={`Connect to ${props.server.systemInfo?.ServerName}`}
    >
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-green-500/20 to-blue-500/20 flex items-center justify-center">
          <Search class="w-5 h-5 text-green-400" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-base truncate">
            {props.server.systemInfo?.ServerName || 'Discovered Server'}
          </div>
          <div class="text-xs opacity-60 truncate mt-0.5">
            {props.server.address}
          </div>
          <Show when={props.server.systemInfo?.Version}>
            <div class="text-xs opacity-40 mt-1">
              v{props.server.systemInfo?.Version}
            </div>
          </Show>
        </div>
      </div>
    </GlassCard>
  );
}