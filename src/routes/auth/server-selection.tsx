import type { RecommendedServerInfo } from "@jellyfin/sdk";
import { useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { AuthFlow } from "~/components/auth/AuthFlow";
import { RouteProtection } from "~/components/auth/RouteProtection";
import { ServerSelection } from "~/components/auth/ServerSelection";
import { AuthErrorBoundary } from "~/components/error/ErrorBoundary";
import { useServerStore } from "~/lib/store-hooks";

export default function ServerSelectionPage() {
  const navigate = useNavigate();
  const { store: serverStore } = useServerStore();
  const [selectedServer, setSelectedServer] =
    createSignal<RecommendedServerInfo | null>(null);

  const handleServerSelect = (server: RecommendedServerInfo) => {
    setSelectedServer(server);
  };

  const handleEditServer = (server: RecommendedServerInfo) => {
    // Navigate to login page with server address for editing
    navigate(`/auth/login/${encodeURIComponent(server.address)}?edit=true`);
  };

  const handleSearchNewServer = () => {
    navigate("/auth/server-finder");
  };

  const handleBack = () => {
    setSelectedServer(null);
  };

  const handleBackToOnboarding = () => {
    navigate("/auth/onboarding");
  };

  const handleAuthSuccess = () => {
    // Navigate to main app after successful authentication
    navigate("/");
  };

  // onMount(() => {
  //   strongholdService.preInitialize().catch((_error) => {
  //     // Do nothing
  //   });
  // });

  return (
    <RouteProtection requireAuth={false}>
      <AuthErrorBoundary>
        <div class="relative grid h-full w-full place-items-center overflow-hidden bg-background">
          <div class="relative z-10 w-full max-w-md px-4">
            <Show
              fallback={
                <ServerSelection
                  onBack={
                    serverStore.servers.length > 0
                      ? undefined
                      : handleBackToOnboarding
                  }
                  onEditServer={handleEditServer}
                  onSearchNewServer={handleSearchNewServer}
                  onSelectServer={handleServerSelect}
                />
              }
              when={selectedServer()}
            >
              <AuthFlow
                onBack={handleBack}
                onSuccess={handleAuthSuccess}
                server={selectedServer() as RecommendedServerInfo}
              />
            </Show>
          </div>
        </div>
      </AuthErrorBoundary>
    </RouteProtection>
  );
}
