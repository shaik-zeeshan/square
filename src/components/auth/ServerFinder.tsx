import { Show, createMemo, createEffect, createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Search, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from 'lucide-solid';
import { RecommendedServerInfo } from '@jellyfin/sdk';
import { Input } from '~/components/input';
import { useServerDiscovery } from '~/hooks/useServerDiscovery';
import { commonRules, createFormField, updateFormField, touchFormField } from '~/lib/validation';

interface ServerFinderProps {
  onServerSelected: (server: RecommendedServerInfo) => void;
  onBack?: () => void;
}

export function ServerFinder(props: ServerFinderProps) {
  // Use a store for form data like LoginForm does
  const [formData, setFormData] = createStore<{
    url: { value: string; error: string | null; touched: boolean; dirty: boolean };
  }>({
    url: createFormField('', commonRules.serverUrl),
  });

  const {
    urlValue,
    urlError,
    isLoading,
    discoveredServers,
    hasServers,
    searchError,
    showNoResults,
    handleUrlChange: hookHandleUrlChange,
    handleUrlBlur: hookHandleUrlBlur,
    handleSearch: hookHandleSearch,
    handleKeyPress: hookHandleKeyPress,
    handleServerSelect,
    handleBack,
  } = useServerDiscovery({
    onServerSelected: props.onServerSelected,
    onBack: props.onBack,
  });

  // Form handlers - only update store, sync with hook on blur/search
  const handleUrlChange = (value: string) => {
    const field = updateFormField(formData.url, value, commonRules.serverUrl, 'server-url');
    setFormData('url', field);
    // Don't update hook on every keystroke to prevent focus loss
  };

  const handleUrlBlur = () => {
    const field = touchFormField(formData.url, commonRules.serverUrl, 'server-url');
    setFormData('url', field);
    // Sync with hook on blur
    hookHandleUrlChange(field.value);
    hookHandleUrlBlur();
  };

  const handleSearch = () => {
    const field = touchFormField(formData.url, commonRules.serverUrl, 'server-url');
    setFormData('url', field);
    // Sync with hook and search
    hookHandleUrlChange(field.value);
    hookHandleSearch();
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div class="w-full space-y-6">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4">
          <Search class="w-8 h-8 text-orange-600 dark:text-orange-400" />
        </div>
        <h2 class="text-3xl font-bold mb-2 text-foreground">Find Server</h2>
        <p class="text-sm text-muted-foreground">Enter your Jellyfin server address</p>
      </div>

      <div class="p-6 bg-card rounded-lg border space-y-4">
        <div class="space-y-2">
          <label for="server-url" class="text-sm font-medium text-foreground">
            Server Address
          </label>
          <div class="w-full flex gap-2">
            <div class="flex-1">
              <Input
                id="server-url"
                placeholder="https://jellyfin.example.com"
                value={formData.url.value}
                onInput={(e) => handleUrlChange(e.currentTarget.value)}
                onBlur={handleUrlBlur}
                onKeyPress={handleKeyPress}
                class="w-full"
                disabled={isLoading()}
                aria-invalid={!!formData.url.error && formData.url.touched}
                aria-describedby={formData.url.error && formData.url.touched ? 'url-error' : undefined}
              />
              <Show when={formData.url.error && formData.url.touched}>
                <p
                  id="url-error"
                  class="text-xs text-destructive mt-1.5 flex items-center gap-1"
                >
                  <AlertCircle class="w-3 h-3" />
                  {formData.url.error}
                </p>
              </Show>
            </div>
            <button
              class="h-10 w-10 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              onClick={handleSearch}
              disabled={!formData.url.value.trim() || isLoading()}
              aria-label="Search for servers"
            >
              <Show
                when={isLoading()}
                fallback={<Search class="w-5 h-5" />}
              >
                <Loader2 class="w-5 h-5 animate-spin" />
              </Show>
            </button>
          </div>
        </div>

        {/* Search Results */}
        <Show when={searchError()}>
          <div class="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <div class="flex items-start gap-3">
              <AlertCircle class="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p class="text-sm text-destructive font-medium">Search Failed</p>
                <p class="text-xs text-destructive/80 mt-1">
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
              <CheckCircle2 class="w-4 h-4 text-green-600 dark:text-green-400" />
              <p class="text-sm font-medium text-green-600 dark:text-green-400">
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
              <AlertCircle class="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p class="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                  No Servers Found
                </p>
                <p class="text-xs text-yellow-600/80 dark:text-yellow-400/80 mt-1">
                  No Jellyfin servers were detected at this address.
                </p>
              </div>
            </div>
          </div>
        </Show>
      </div>

      <Show when={props.onBack}>
        <button
          class="w-full h-10 px-4 bg-transparent border border-orange-500 dark:border-orange-400 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          onClick={handleBack}
          disabled={isLoading()}
        >
          <ArrowLeft class="w-4 h-4 mr-2" />
          Back to Server List
        </button>
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
    <div
      role="button"
      tabindex={0}
      class="cursor-pointer p-4 bg-card border rounded-lg hover:bg-muted transition-colors"
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
        <div class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center">
          <Search class="w-5 h-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-base truncate text-foreground">
            {props.server.systemInfo?.ServerName || 'Discovered Server'}
          </div>
          <div class="text-xs text-muted-foreground truncate mt-0.5">
            {props.server.address}
          </div>
          <Show when={props.server.systemInfo?.Version}>
            <div class="text-xs text-muted-foreground/60 mt-1">
              v{props.server.systemInfo?.Version}
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}