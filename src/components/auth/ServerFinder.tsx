import type { RecommendedServerInfo } from '@jellyfin/sdk';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Search,
} from 'lucide-solid';
import { Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Input } from '~/components/input';
import { useServerDiscovery } from '~/hooks/useServerDiscovery';
import {
  commonRules,
  createFormField,
  touchFormField,
  updateFormField,
} from '~/lib/validation';

interface ServerFinderProps {
  onServerSelected: (server: RecommendedServerInfo) => void;
  onBack?: () => void;
}

export function ServerFinder(props: ServerFinderProps) {
  // Use a store for form data like LoginForm does
  const [formData, setFormData] = createStore<{
    url: {
      value: string;
      error: string | null;
      touched: boolean;
      dirty: boolean;
    };
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
    const field = updateFormField(
      formData.url,
      value,
      commonRules.serverUrl,
      'server-url'
    );
    setFormData('url', field);
    // Don't update hook on every keystroke to prevent focus loss
  };

  const handleUrlBlur = () => {
    const field = touchFormField(
      formData.url,
      commonRules.serverUrl,
      'server-url'
    );
    setFormData('url', field);
    // Sync with hook on blur
    hookHandleUrlChange(field.value);
    hookHandleUrlBlur();
  };

  const handleSearch = () => {
    const field = touchFormField(
      formData.url,
      commonRules.serverUrl,
      'server-url'
    );
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
      <div class="mb-8 text-center">
        <div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full">
          <Search class="h-8 w-8 text-orange-600 dark:text-orange-400" />
        </div>
        <h2 class="mb-2 font-bold text-3xl text-foreground">Find Server</h2>
        <p class="text-muted-foreground text-sm">
          Enter your Jellyfin server address
        </p>
      </div>

      <div class="space-y-4 rounded-lg border bg-card p-6">
        <div class="space-y-2">
          <label class="font-medium text-foreground text-sm" for="server-url">
            Server Address
          </label>
          <div class="flex w-full gap-2">
            <div class="flex-1">
              <Input
                aria-describedby={
                  formData.url.error && formData.url.touched
                    ? 'url-error'
                    : undefined
                }
                aria-invalid={!!formData.url.error && formData.url.touched}
                class="w-full"
                disabled={isLoading()}
                id="server-url"
                onBlur={handleUrlBlur}
                onInput={(e) => handleUrlChange(e.currentTarget.value)}
                onKeyPress={handleKeyPress}
                placeholder="https://jellyfin.example.com"
                value={formData.url.value}
              />
              <Show when={formData.url.error && formData.url.touched}>
                <p
                  class="mt-1.5 flex items-center gap-1 text-destructive text-xs"
                  id="url-error"
                >
                  <AlertCircle class="h-3 w-3" />
                  {formData.url.error}
                </p>
              </Show>
            </div>
            <button
              aria-label="Search for servers"
              class="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-600 text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!formData.url.value.trim() || isLoading()}
              onClick={handleSearch}
            >
              <Show fallback={<Search class="h-5 w-5" />} when={isLoading()}>
                <Loader2 class="h-5 w-5 animate-spin" />
              </Show>
            </button>
          </div>
        </div>

        {/* Search Results */}
        <Show when={searchError()}>
          <div class="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <div class="flex items-start gap-3">
              <AlertCircle class="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
              <div>
                <p class="font-medium text-destructive text-sm">
                  Search Failed
                </p>
                <p class="mt-1 text-destructive/80 text-xs">
                  {searchError()?.message ||
                    'Could not connect to server. Please check the address and try again.'}
                </p>
              </div>
            </div>
          </div>
        </Show>

        <Show when={hasServers()}>
          <div class="mt-4">
            <div class="mb-3 flex items-center gap-2">
              <CheckCircle2 class="h-4 w-4 text-green-600 dark:text-green-400" />
              <p class="font-medium text-green-600 text-sm dark:text-green-400">
                Found {discoveredServers().length} server
                {discoveredServers().length !== 1 ? 's' : ''}
              </p>
            </div>
            <div class="space-y-2">
              <DiscoveredServerList
                onServerSelect={handleServerSelect}
                servers={discoveredServers()}
              />
            </div>
          </div>
        </Show>

        <Show when={showNoResults()}>
          <div class="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
            <div class="flex items-start gap-3">
              <AlertCircle class="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
              <div>
                <p class="font-medium text-sm text-yellow-600 dark:text-yellow-400">
                  No Servers Found
                </p>
                <p class="mt-1 text-xs text-yellow-600/80 dark:text-yellow-400/80">
                  No Jellyfin servers were detected at this address.
                </p>
              </div>
            </div>
          </div>
        </Show>
      </div>

      <Show when={props.onBack}>
        <button
          class="flex h-10 w-full items-center justify-center rounded-lg border border-orange-500 bg-transparent px-4 text-orange-600 transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-orange-400 dark:text-orange-400 dark:hover:bg-orange-900/20"
          disabled={isLoading()}
          onClick={handleBack}
        >
          <ArrowLeft class="mr-2 h-4 w-4" />
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
          onSelect={() => props.onServerSelect(server)}
          server={server}
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
      aria-label={`Connect to ${props.server.systemInfo?.ServerName}`}
      class="cursor-pointer rounded-lg border bg-card p-4 transition-colors hover:bg-muted"
      onClick={props.onSelect}
      onKeyPress={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onSelect();
        }
      }}
      role="button"
      tabindex={0}
    >
      <div class="flex items-start gap-3">
        <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
          <Search class="h-5 w-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate font-semibold text-base text-foreground">
            {props.server.systemInfo?.ServerName || 'Discovered Server'}
          </div>
          <div class="mt-0.5 truncate text-muted-foreground text-xs">
            {props.server.address}
          </div>
          <Show when={props.server.systemInfo?.Version}>
            <div class="mt-1 text-muted-foreground/60 text-xs">
              v{props.server.systemInfo?.Version}
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
