import { RecommendedServerInfo } from '@jellyfin/sdk/lib/models/recommended-server-info';
import { useMutation, useQuery } from '@tanstack/solid-query';
import {
  Search,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Server as ServerIcon,
  Trash2,
  Edit,
  X,
} from 'lucide-solid';
import { createSignal, For, Match, Show, Switch } from 'solid-js';
import { createStore } from 'solid-js/store';
import { useGeneralInfo } from '~/components/current-user-provider';
import { UserDropdown } from '~/components/user-dropdown';
import { Input } from '~/components/input';
import { QueryBoundary } from '~/components/query-boundary';
import { showToast } from '~/components/ui/toast';
import { getServers } from '~/lib/jellyfin';
import library from '~/lib/jellyfin/library';
import { user, setServerStore } from '~/lib/jellyfin/user';
import { useServerStore } from '~/lib/store-hooks';
import { authStore, Server } from '~/lib/persist-store';
import { createJellyFinQuery } from '~/lib/utils';
import { GlassButton, GlassCard } from '~/components/ui';

export default function Home() {
  const { store } = useGeneralInfo();
  const { store: auth } = authStore();

  const libraries = createJellyFinQuery(() => ({
    queryKey: [library.query.getLibraries.key, auth.isUserLoggedIn],
    queryFn: (jf) => library.query.getLibraries(jf, store?.user?.Id),
  }));

  const resumeItems = createJellyFinQuery(() => ({
    queryKey: [library.query.getResumeItems.key, auth.isUserLoggedIn],
    queryFn: (jf) => library.query.getResumeItems(jf, store?.user?.Id),
    enabled: auth.isUserLoggedIn,
  }));

  return (
    <section class="w-full h-full">
      <Switch>
        {/* not logged in  */}
        <Match when={!auth.isUserLoggedIn}>
          <OnboardingFlow />
        </Match>

        {/* logged in  */}
        <Match when={auth.isUserLoggedIn}>
          <main class="grid place-items-center h-full px-10 relative">
            {/* User Dropdown - Top Right */}
            <UserDropdown class="absolute top-6 right-6 z-50" />

            <div class="w-full max-w-7xl">
              <h1 class="text-4xl font-bold mb-10 text-center bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
                Your Libraries
              </h1>
              <div
                class="grid gap-6"
                style={{
                  'grid-template-columns': `repeat(${Math.min(libraries.data?.length ?? 1, 4)}, minmax(0, 1fr))`,
                }}
              >
                <QueryBoundary
                  query={libraries}
                  loadingFallback={
                    <GlassCard preset="card" class="p-8 text-center">
                      <div class="animate-pulse">Loading libraries...</div>
                    </GlassCard>
                  }
                >
                  {(data) => (
                    <For each={data} fallback={<div>Loading</div>}>
                      {(item) => {
                        return (
                          <a
                            class="col-span-1 group block"
                            href={`/library/${item.Id}`}
                          >
                            <GlassCard
                              preset="card"
                              class="overflow-hidden h-full transition-all duration-300 group-hover:scale-[1.02] shadow-[var(--glass-shadow-md)] group-hover:shadow-[var(--glass-shadow-lg)]"
                            >
                              <div class="relative aspect-[2/3] overflow-hidden">
                                {/* Image fills entire card */}
                                <Show
                                  when={item.Image}
                                  fallback={
                                    <div class="w-full h-full bg-gradient-to-br from-[var(--glass-bg-medium)] to-[var(--glass-bg-subtle)] flex items-center justify-center">
                                      <span class="text-6xl opacity-30">
                                        {item.Name?.charAt(0)}
                                      </span>
                                    </div>
                                  }
                                >
                                  <img
                                    src={item.Image}
                                    alt={item.Name ?? 'Library'}
                                    class="w-full h-full object-cover scale-110 group-hover:scale-100 transition-transform duration-700 ease-out"
                                  />
                                </Show>

                                {/* Gradient overlay - always visible, darkens on hover */}
                                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:from-black/90 group-hover:via-black/50 transition-all duration-300" />

                                {/* Title Info - always visible at bottom */}
                                <div class="absolute bottom-0 left-0 right-0 p-4">
                                  <h3 class="text-white text-lg font-semibold line-clamp-2 drop-shadow-lg">
                                    {item.Name}
                                  </h3>
                                  <Show when={item.CollectionType}>
                                    <p class="text-white/80 text-sm mt-1 drop-shadow-md capitalize">
                                      {item.CollectionType}
                                    </p>
                                  </Show>
                                </div>
                              </div>
                            </GlassCard>
                          </a>
                        );
                      }}
                    </For>
                  )}
                </QueryBoundary>
              </div>

              {/* Watching History Section */}
              <Show when={resumeItems.data && resumeItems.data.length > 0}>
                <div class="mt-16">
                  <h2 class="text-3xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
                    Continue Watching
                  </h2>
                  <div
                    class="grid gap-4"
                    style={{
                      'grid-template-columns': `repeat(${Math.min(resumeItems.data?.length ?? 1, 6)}, minmax(0, 1fr))`,
                    }}
                  >
                    <QueryBoundary
                      query={resumeItems}
                      loadingFallback={
                        <GlassCard
                          preset="card"
                          class="p-8 text-center col-span-full"
                        >
                          <div class="animate-pulse">Loading history...</div>
                        </GlassCard>
                      }
                    >
                      {(data) => (
                        <For each={data}>
                          {(item) => {
                            const progressPercentage =
                              item.UserData?.PlayedPercentage || 0;
                            const isMovie = item.Type === 'Movie';
                            const isEpisode = item.Type === 'Episode';

                            return (
                              <a class="group block" href={`/video/${item.Id}`}>
                                <GlassCard
                                  preset="card"
                                  class="overflow-hidden transition-all duration-300 group-hover:scale-[1.02] shadow-[var(--glass-shadow-md)] group-hover:shadow-[var(--glass-shadow-lg)]"
                                >
                                  <div class="relative aspect-[16/9] overflow-hidden">
                                    {/* Image */}
                                    <Show
                                      when={
                                        item.Images?.Primary ||
                                        item.Backdrop?.[0]
                                      }
                                      fallback={
                                        <div class="w-full h-full bg-gradient-to-br from-[var(--glass-bg-medium)] to-[var(--glass-bg-subtle)] flex items-center justify-center">
                                          <span class="text-4xl opacity-30">
                                            {item.Name?.charAt(0)}
                                          </span>
                                        </div>
                                      }
                                    >
                                      <img
                                        src={
                                          item.Images?.Primary ||
                                          item.Backdrop?.[0]
                                        }
                                        alt={item.Name ?? 'Item'}
                                        class="w-full h-full object-cover scale-110 group-hover:scale-100 transition-transform duration-700 ease-out"
                                      />
                                    </Show>

                                    {/* Gradient overlay */}
                                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:from-black/90 group-hover:via-black/50 transition-all duration-300" />

                                    {/* Progress bar */}
                                    <Show
                                      when={
                                        progressPercentage > 0 &&
                                        progressPercentage < 100
                                      }
                                    >
                                      <div class="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                                        <div
                                          class="h-full bg-blue-500 transition-all duration-300"
                                          style={`width: ${progressPercentage}%`}
                                        />
                                      </div>
                                    </Show>

                                    {/* Title Info */}
                                    <div class="absolute bottom-0 left-0 right-0 p-3">
                                      <h3 class="text-white text-sm font-semibold line-clamp-2 drop-shadow-lg">
                                        {item.Name}
                                      </h3>
                                      <Show when={isEpisode && item.SeriesName}>
                                        <p class="text-white/80 text-xs mt-1 drop-shadow-md">
                                          {item.SeriesName} - S
                                          {item.ParentIndexNumber}E
                                          {item.IndexNumber}
                                        </p>
                                      </Show>
                                      <Show
                                        when={isMovie && item.ProductionYear}
                                      >
                                        <p class="text-white/80 text-xs mt-1 drop-shadow-md">
                                          {item.ProductionYear}
                                        </p>
                                      </Show>
                                    </div>
                                  </div>
                                </GlassCard>
                              </a>
                            );
                          }}
                        </For>
                      )}
                    </QueryBoundary>
                  </div>
                </div>
              </Show>
            </div>
          </main>
        </Match>
      </Switch>
    </section>
  );
}

type OnboardingSteps = 'search-server' | 'select-server' | 'login';

function OnboardingFlow() {
  let { store, setStore } = useServerStore();
  const [loginError, setLoginError] = createSignal<string>('');
  const [step, setStep] = createSignal<OnboardingSteps>(
    store.servers.length > 0 ? 'select-server' : 'search-server'
  );
  const [processData, setProcessData] = createStore<Partial<Server>>({});

  const login = useMutation(() => ({
    mutationKey: ['login'],
    mutationFn: async (inputs: {
      username: string;
      password: string;
      server: RecommendedServerInfo;
    }) => {
      setLoginError('');
      return await user.mutation.login(
        inputs.username,
        inputs.password,
        inputs.server
      );
    },
    onError: (error: Error) => {
      console.error('Login error:', error);
      const errorMessage =
        error?.message ||
        'Failed to login. Please check your credentials and try again.';
      setLoginError(errorMessage);
      showToast({
        message: errorMessage,
        type: 'error',
        duration: 5000,
      });
    },
  }));

  const handleDeleteServer = (serverAddress: string) => {
    const updatedServers = store.servers.filter(
      (server) => server.info.address !== serverAddress
    );

    setStore({
      servers: updatedServers,
      current:
        store.current?.info.address === serverAddress ? null : store.current,
    });

    showToast({
      message: 'Server removed successfully',
      type: 'success',
      duration: 3000,
    });
  };

  return (
    <div class="h-full w-full grid place-items-center relative overflow-hidden">
      {/* Background decoration */}
      <div class="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 pointer-events-none" />
      <div class="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div class="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-[120px] pointer-events-none" />

      <div class="w-full max-w-md px-4 relative z-10">
        {/* Global Error Display */}
        <Show when={loginError()}>
          <GlassCard
            preset="card"
            class="mb-4 p-4 bg-red-500/10 border-red-500/30"
          >
            <div class="flex items-start gap-3">
              <AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div class="flex-1">
                <p class="text-sm text-red-300 font-medium">Login Failed</p>
                <p class="text-xs text-red-400 mt-1">{loginError()}</p>
              </div>
              <button
                onClick={() => setLoginError('')}
                class="text-red-400 hover:text-red-300 transition-colors"
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          </GlassCard>
        </Show>

        <Switch>
          <Match when={!!store.servers.length && step() === 'select-server'}>
            <div class="space-y-4">
              <div class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 mb-4">
                  <ServerIcon class="w-8 h-8 text-blue-400" />
                </div>
                <h2 class="text-3xl font-bold mb-2">Select Server</h2>
                <p class="text-sm opacity-60">Choose a server to connect to</p>
              </div>

              <div class="space-y-3">
                <For each={store.servers}>
                  {(server) => (
                    <ServerCard
                      server={server.info}
                      isLoading={login.isPending}
                      showActions={true}
                      onSelect={() => {
                        let creds = {
                          ...server.auth,
                          server: server.info,
                        };

                        login.mutate(creds);
                        setStore({ current: server });
                      }}
                      onDelete={(serverAddress) => {
                        handleDeleteServer(serverAddress);
                      }}
                      onEdit={(server) => {
                        // Set up for editing - go to login screen with pre-filled data
                        setProcessData({
                          info: server,
                          auth: store.servers.find(
                            (s) => s.info.address === server.address
                          )?.auth,
                        });
                        setStep('login');
                      }}
                    />
                  )}
                </For>
              </div>

              <Show when={store.servers.length > 0}>
                <div class="relative my-6">
                  <div class="absolute inset-0 flex items-center">
                    <div class="w-full border-t border-white/10" />
                  </div>
                  <div class="relative flex justify-center text-xs uppercase">
                    <span class="bg-background px-2 text-muted-foreground">
                      Or
                    </span>
                  </div>
                </div>
              </Show>

              <GlassButton
                variant="glass-subtle"
                class="w-full"
                onClick={() => {
                  setStep('search-server');
                  setLoginError('');
                }}
                disabled={login.isPending}
              >
                <Search class="w-4 h-4 mr-2" />
                Add New Server
              </GlassButton>
            </div>
          </Match>

          <Match when={step() === 'search-server'}>
            <ServerFinder
              onServerSelected={(server) => {
                setProcessData({ info: server });
                setStep('login');
                setLoginError('');
              }}
              onBack={
                store.servers.length > 0
                  ? () => setStep('select-server')
                  : undefined
              }
            />
          </Match>

          <Match
            when={
              step() === 'login' && 'info' in processData && processData.info
            }
          >
            <LoginScreen
              server={(processData as Server).info}
              isLoading={login.isPending}
              initialUsername={processData.auth?.username}
              initialPassword={processData.auth?.password}
              isEditing={!!processData.auth}
              onBack={() => {
                setStep(
                  store.servers.length > 0 ? 'select-server' : 'search-server'
                );
                setLoginError('');
              }}
              onLogin={async (name, pass) => {
                const creds = {
                  username: name.trim(),
                  password: pass,
                  server: processData.info as RecommendedServerInfo,
                };

                setProcessData({
                  auth: creds,
                });

                try {
                  await login.mutateAsync(creds);

                  let server = {
                    info: creds.server,
                    auth: {
                      username: creds.username,
                      password: creds.password,
                    },
                  };

                  // If editing, update existing server, otherwise add new
                  let updatedServers;

                  let currentServer = store.servers.find(
                    (s) => s.info.address === creds.server.address
                  );

                  if (currentServer) {
                    updatedServers = store.servers.map((s) =>
                      s.info.address === currentServer.info.address ? server : s
                    );
                  } else {
                    updatedServers = [...store.servers, server];
                  }

                  // Use setServerStore to properly persist to localStorage
                  setStore({
                    servers: updatedServers,
                    current: server,
                  });
                } catch (error) {
                  // Error is handled by mutation onError
                  console.error('Login failed:', error);
                }
              }}
            />
          </Match>
        </Switch>
      </div>
    </div>
  );
}

function ServerFinder(props: {
  onServerSelected: (server: RecommendedServerInfo) => void;
  onBack?: () => void;
}) {
  const [url, setUrl] = createSignal<string>('');
  const [urlError, setUrlError] = createSignal<string>('');
  const [searchAttempted, setSearchAttempted] = createSignal(false);

  const validateUrl = (value: string): boolean => {
    setUrlError('');

    if (!value.trim()) {
      setUrlError('Server address is required');
      return false;
    }

    // Basic URL validation
    try {
      const urlObj = new URL(value);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        setUrlError('URL must start with http:// or https://');
        return false;
      }
      return true;
    } catch {
      setUrlError(
        'Please enter a valid URL (e.g., https://jellyfin.example.com)'
      );
      return false;
    }
  };

  const servers = useQuery(() => ({
    queryKey: ['getServers', url()],
    queryFn: async (ctx) => {
      const address = ctx.queryKey[1];

      if (!address) {
        return [];
      }

      if (!validateUrl(address)) {
        throw new Error(urlError());
      }

      setSearchAttempted(true);
      const foundServers = await getServers(address);

      if (foundServers.length === 0) {
        throw new Error(
          'No Jellyfin servers found at this address. Please check the URL and try again.'
        );
      }

      return foundServers;
    },
    enabled: false,
    retry: false,
  }));

  const handleSearch = () => {
    if (validateUrl(url())) {
      servers.refetch();
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

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
                value={url()}
                onInput={(e) => {
                  setUrl(e.currentTarget.value);
                  if (urlError()) setUrlError('');
                }}
                onKeyPress={handleKeyPress}
                class="w-full"
                disabled={servers.isFetching}
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
              disabled={!url().trim() || servers.isFetching}
              aria-label="Search for servers"
            >
              <Show
                when={servers.isFetching}
                fallback={<Search class="w-5 h-5" />}
              >
                <Loader2 class="w-5 h-5 animate-spin" />
              </Show>
            </GlassButton>
          </div>
        </div>

        {/* Search Results */}
        <Show when={servers.isError}>
          <div class="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
            <div class="flex items-start gap-3">
              <AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p class="text-sm text-red-300 font-medium">Search Failed</p>
                <p class="text-xs text-red-400 mt-1">
                  {servers.error?.message ||
                    'Could not connect to server. Please check the address and try again.'}
                </p>
              </div>
            </div>
          </div>
        </Show>

        <Show
          when={servers.isSuccess && servers.data && servers.data.length > 0}
        >
          <div class="mt-4">
            <div class="flex items-center gap-2 mb-3">
              <CheckCircle2 class="w-4 h-4 text-green-400" />
              <p class="text-sm font-medium text-green-400">
                Found {servers.data!.length} server
                {servers.data!.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div class="space-y-2">
              <For each={servers.data}>
                {(server) => (
                  <ServerCard
                    server={server}
                    onSelect={(server) => {
                      props.onServerSelected(server);
                    }}
                  />
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show
          when={
            searchAttempted() &&
            !servers.isFetching &&
            !servers.isError &&
            (!servers.data || servers.data.length === 0)
          }
        >
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
          onClick={props.onBack}
        >
          <ArrowLeft class="w-4 h-4 mr-2" />
          Back to Server List
        </GlassButton>
      </Show>
    </div>
  );
}

function ServerCard(props: {
  server: RecommendedServerInfo;
  onSelect: (server: RecommendedServerInfo) => void;
  isLoading?: boolean;
  showActions?: boolean;
  onDelete?: (serverAddress: string) => void;
  onEdit?: (server: RecommendedServerInfo) => void;
}) {
  const handleCardClick = () => {
    if (!props.isLoading) {
      props.onSelect(props.server);
    }
  };

  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (props.onDelete && props.server.address) {
      props.onDelete(props.server.address);
    }
  };

  const handleEdit = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (props.onEdit) {
      props.onEdit(props.server);
    }
  };

  return (
    <GlassCard
      preset="card"
      role="button"
      tabindex={0}
      class="cursor-pointer p-4 hover:bg-[var(--glass-bg-medium)] transition-all group relative"
      onClick={handleCardClick}
      onKeyPress={(e: KeyboardEvent) => {
        if ((e.key === 'Enter' || e.key === ' ') && !props.isLoading) {
          e.preventDefault();
          props.onSelect(props.server);
        }
      }}
      aria-label={`Connect to ${props.server.systemInfo?.ServerName}`}
      aria-disabled={props.isLoading}
    >
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
          <ServerIcon class="w-5 h-5 text-blue-400" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-base truncate">
            {props.server.systemInfo?.ServerName || 'Unknown Server'}
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

        {/* Action Buttons */}
        <Show when={props.showActions && !props.isLoading}>
          <div
            class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <Show when={props.onEdit}>
              <button
                type="button"
                onClick={handleEdit}
                class="p-2 rounded-lg hover:bg-blue-500/20 transition-colors"
                aria-label="Edit server"
                title="Edit credentials"
              >
                <Edit class="w-4 h-4 text-blue-400" />
              </button>
            </Show>
            <Show when={props.onDelete}>
              <button
                type="button"
                onClick={handleDelete}
                class="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                aria-label="Delete server"
                title="Delete server"
              >
                <Trash2 class="w-4 h-4 text-red-400" />
              </button>
            </Show>
          </div>
        </Show>

        <Show when={props.isLoading}>
          <Loader2 class="w-5 h-5 animate-spin text-blue-400 flex-shrink-0" />
        </Show>
      </div>
    </GlassCard>
  );
}

function LoginScreen(props: {
  server: RecommendedServerInfo;
  onLogin: (username: string, password: string) => Promise<void>;
  isLoading?: boolean;
  onBack?: () => void;
  initialUsername?: string;
  initialPassword?: string;
  isEditing?: boolean;
}) {
  const [formData, setFormData] = createStore({
    username: props.initialUsername || '',
    password: props.initialPassword || '',
  });
  const [errors, setErrors] = createStore({
    username: '',
    password: '',
  });
  const [touched, setTouched] = createStore({
    username: false,
    password: false,
  });

  const validateUsername = (value: string): string => {
    if (!value.trim()) {
      return 'Username is required';
    }
    if (value.trim().length < 2) {
      return 'Username must be at least 2 characters';
    }
    return '';
  };

  const validatePassword = (value: string): string => {
    // Allow empty password as some Jellyfin setups don't require it
    return '';
  };

  const handleUsernameChange = (value: string) => {
    setFormData('username', value);
    if (touched.username) {
      setErrors('username', validateUsername(value));
    }
  };

  const handlePasswordChange = (value: string) => {
    setFormData('password', value);
    if (touched.password) {
      setErrors('password', validatePassword(value));
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    // Mark all fields as touched
    setTouched({ username: true, password: true });

    // Validate all fields
    const usernameError = validateUsername(formData.username);
    const passwordError = validatePassword(formData.password);

    setErrors({
      username: usernameError,
      password: passwordError,
    });

    // If there are errors, don't submit
    if (usernameError || passwordError) {
      return;
    }

    // Submit the form
    await props.onLogin(formData.username.trim(), formData.password);
  };

  return (
    <div class="space-y-6">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-green-500/20 to-blue-500/20 mb-4">
          <Show
            when={props.isEditing}
            fallback={<CheckCircle2 class="w-8 h-8 text-green-400" />}
          >
            <Edit class="w-8 h-8 text-blue-400" />
          </Show>
        </div>
        <h2 class="text-3xl font-bold mb-2">
          {props.isEditing ? 'Edit Credentials' : 'Welcome Back'}
        </h2>
        <p class="text-sm opacity-60 mb-3">
          {props.isEditing
            ? 'Update your login credentials'
            : 'Sign in to continue'}
        </p>
        <GlassCard preset="card" class="inline-block px-4 py-2">
          <div class="flex items-center gap-2">
            <ServerIcon class="w-4 h-4 text-blue-400" />
            <p class="text-sm font-medium">
              {props.server.systemInfo?.ServerName || 'Jellyfin Server'}
            </p>
          </div>
          <p class="text-xs opacity-50 mt-1">{props.server.address}</p>
        </GlassCard>
      </div>

      <GlassCard preset="card" class="p-6">
        <form class="space-y-5" onSubmit={handleSubmit}>
          <div class="space-y-2">
            <label for="username" class="text-sm font-medium opacity-80">
              Username <span class="text-red-400">*</span>
            </label>
            <Input
              id="username"
              placeholder="Enter your username"
              name="username"
              value={formData.username}
              onInput={(e) => handleUsernameChange(e.currentTarget.value)}
              onBlur={() => {
                setTouched('username', true);
                setErrors('username', validateUsername(formData.username));
              }}
              disabled={props.isLoading}
              autocomplete="username"
              aria-invalid={!!errors.username && touched.username}
              aria-describedby={
                errors.username && touched.username
                  ? 'username-error'
                  : undefined
              }
              class="w-full"
            />
            <Show when={errors.username && touched.username}>
              <p
                id="username-error"
                class="text-xs text-red-400 flex items-center gap-1"
              >
                <AlertCircle class="w-3 h-3" />
                {errors.username}
              </p>
            </Show>
          </div>

          <div class="space-y-2">
            <label for="password" class="text-sm font-medium opacity-80">
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              name="password"
              value={formData.password}
              onInput={(e) => handlePasswordChange(e.currentTarget.value)}
              onBlur={() => {
                setTouched('password', true);
                setErrors('password', validatePassword(formData.password));
              }}
              disabled={props.isLoading}
              autocomplete="current-password"
              aria-invalid={!!errors.password && touched.password}
              aria-describedby={
                errors.password && touched.password
                  ? 'password-error'
                  : undefined
              }
              class="w-full"
            />
            <Show when={errors.password && touched.password}>
              <p
                id="password-error"
                class="text-xs text-red-400 flex items-center gap-1"
              >
                <AlertCircle class="w-3 h-3" />
                {errors.password}
              </p>
            </Show>
            <p class="text-xs opacity-50">Leave empty if no password is set</p>
          </div>

          <GlassButton
            type="submit"
            variant="glass"
            class="w-full"
            disabled={props.isLoading || !!errors.username || !!errors.password}
          >
            <Show
              when={props.isLoading}
              fallback={props.isEditing ? 'Update & Sign In' : 'Sign In'}
            >
              <Loader2 class="w-4 h-4 mr-2 animate-spin" />
              {props.isEditing ? 'Updating...' : 'Signing In...'}
            </Show>
          </GlassButton>
        </form>
      </GlassCard>

      <Show when={props.onBack}>
        <GlassButton
          variant="ghost"
          class="w-full"
          onClick={props.onBack}
          disabled={props.isLoading}
        >
          <ArrowLeft class="w-4 h-4 mr-2" />
          Back
        </GlassButton>
      </Show>
    </div>
  );
}
