import { For, Show, Switch, Match, createEffect } from "solid-js";
import { createSignal } from "solid-js";
import { RecommendedServerInfo } from "@jellyfin/sdk";
import { useGeneralInfo } from "~/components/current-user-provider";
import { UserDropdown } from "~/components/user-dropdown";
import { QueryBoundary } from "~/components/query-boundary";
import {
  ErrorBoundary,
  AuthErrorBoundary,
} from "~/components/error/ErrorBoundary";
import { ServerSelection } from "~/components/auth/ServerSelection";
import { ServerFinder } from "~/components/auth/ServerFinder";
import { LoginForm } from "~/components/auth/LoginForm";
import library from "~/lib/jellyfin/library";
import { useServerStore } from "~/lib/store-hooks";
import { authStore } from "~/lib/persist-store";
import { createJellyFinQuery } from "~/lib/utils";
import { GlassCard } from "~/components/ui";
import { useAuthentication } from "~/hooks/useAuthentication";

export default function Home() {
  const { store } = useGeneralInfo();
  const { store: auth } = authStore();

  const libraries = createJellyFinQuery(() => ({
    queryKey: [library.query.getLibraries.key, auth.isUserLoggedIn],
    queryFn: (jf) => library.query.getLibraries(jf, store?.user?.Id),
    enabled: auth.isUserLoggedIn,
  }));

  const resumeItems = createJellyFinQuery(() => ({
    queryKey: [library.query.getResumeItems.key, auth.isUserLoggedIn],
    queryFn: (jf) => library.query.getResumeItems(jf, store?.user?.Id),
    enabled: auth.isUserLoggedIn,
  }));

  createEffect(() => {
    console.log("Libraries:", libraries.data);
  });

  return (
    <section class="w-full h-full">
      <Switch>
        {/* not logged in  */}
        <Match when={!auth.isUserLoggedIn}>
          <AuthErrorBoundary>
            <OnboardingFlow />
          </AuthErrorBoundary>
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
                  "grid-template-columns": `repeat(${Math.min(libraries.data?.length ?? 1, 4)}, minmax(0, 1fr))`,
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
                    <For each={data}>
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
                                    alt={item.Name ?? "Library"}
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
                      "grid-template-columns": `repeat(${Math.min(resumeItems.data?.length ?? 1, 6)}, minmax(0, 1fr))`,
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
                            const isMovie = item.Type === "Movie";
                            const isEpisode = item.Type === "Episode";

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
                                        alt={item.Name ?? "Item"}
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

type OnboardingStep = "search-server" | "select-server" | "login";

function OnboardingFlow() {
  const { store: serverStore } = useServerStore();
  const { isAuthenticated } = useAuthentication();

  const [step, setStep] = createSignal<OnboardingStep>(
    serverStore.servers.length > 0 ? "select-server" : "search-server",
  );
  const [selectedServer, setSelectedServer] = createSignal<
    RecommendedServerInfo | undefined
  >();
  const [editingServer, setEditingServer] = createSignal<
    | { server: RecommendedServerInfo; username?: string; password?: string }
    | undefined
  >();

  const handleServerSelect = (server: RecommendedServerInfo) => {
    setSelectedServer(server);
    setStep("login");
  };

  const handleEditServer = (server: RecommendedServerInfo) => {
    const existingServer = serverStore.servers.find(
      (s) => s.info.address === server.address,
    );
    if (existingServer) {
      setEditingServer({
        server,
        username: existingServer.auth.username,
        password: existingServer.auth.password,
      });
      setSelectedServer(server);
      setStep("login");
    }
  };

  const handleLoginComplete = () => {
    // Login is complete, let the auth state handle the redirect
  };

  const handleBack = () => {
    if (step() === "login" && serverStore.servers.length > 0) {
      setStep("select-server");
    } else if (step() === "search-server" && serverStore.servers.length > 0) {
      setStep("select-server");
    }
    setSelectedServer(undefined);
    setEditingServer(undefined);
  };

  return (
    <div class="h-full w-full grid place-items-center relative overflow-hidden">
      {/* Background decoration */}
      <div class="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 pointer-events-none" />
      <div class="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div class="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-[120px] pointer-events-none" />

      <div class="w-full max-w-md px-4 relative z-10">
        <Switch>
          <Match when={step() === "select-server"}>
            <ServerSelection
              onBack={serverStore.servers.length > 0 ? undefined : handleBack}
              onSelectServer={handleServerSelect}
              onEditServer={handleEditServer}
              onSearchNewServer={() => setStep("search-server")}
            />
          </Match>

          <Match when={step() === "search-server"}>
            <ServerFinder
              onServerSelected={handleServerSelect}
              onBack={
                serverStore.servers.length > 0
                  ? () => setStep("select-server")
                  : undefined
              }
            />
          </Match>

          <Match when={step() === "login" && selectedServer()}>
            <LoginForm
              server={selectedServer()!}
              initialUsername={editingServer()?.username}
              initialPassword={editingServer()?.password}
              isEditing={!!editingServer()}
              onBack={handleBack}
            />
          </Match>
        </Switch>
      </div>
    </div>
  );
}
