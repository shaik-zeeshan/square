import type { RecommendedServerInfo } from '@jellyfin/sdk';
import { useNavigate } from '@solidjs/router';
import { createSignal, Match, Switch } from 'solid-js';
import { LoginForm } from '~/components/auth/LoginForm';
import { RouteProtection } from '~/components/auth/RouteProtection';
import { ServerFinder } from '~/components/auth/ServerFinder';
import { ServerSelection } from '~/components/auth/ServerSelection';
import { AuthErrorBoundary } from '~/components/error/ErrorBoundary';
import { useAuthentication } from '~/hooks/useAuthentication';
import { useServerStore } from '~/lib/store-hooks';

type OnboardingStep = 'search-server' | 'select-server' | 'login';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { store: serverStore, setStore: setServerStore } = useServerStore();
  const { isAuthenticated, login } = useAuthentication();

  const [step, setStep] = createSignal<OnboardingStep>(
    serverStore.servers.length > 0 ? 'select-server' : 'search-server'
  );
  const [selectedServer, setSelectedServer] = createSignal<
    RecommendedServerInfo | undefined
  >();
  const [editingServer, setEditingServer] = createSignal<
    | { server: RecommendedServerInfo; username?: string; password?: string }
    | undefined
  >();

  const handleServerSelect = (server: RecommendedServerInfo) => {
    // Ensure the server is in the store first
    let storedServer = serverStore.servers.find(
      (s) => s.info.address === server.address
    );

    if (!storedServer) {
      // Add the server to the store if it doesn't exist with new structure
      const newServer = {
        info: server,
        users: [],
        lastConnected: undefined,
        isOnline: undefined,
        currentUser: undefined,
      };

      setServerStore('servers', [...serverStore.servers, newServer]);
      storedServer = newServer;
    }

    // Navigate to server selection page which will handle the new AuthFlow
    navigate('/auth/server-selection');
  };

  const handleEditServer = (server: RecommendedServerInfo) => {
    navigate(`/auth/login/${encodeURIComponent(server.address)}?edit=true`);
  };

  const _handleLoginComplete = () => {
    // Login is complete, let the auth state handle the redirect
  };

  const handleBack = () => {
    if (step() === 'login' && serverStore.servers.length > 0) {
      setStep('select-server');
    } else if (step() === 'search-server' && serverStore.servers.length > 0) {
      setStep('select-server');
    }
    setSelectedServer(undefined);
    setEditingServer(undefined);
  };

  return (
    <RouteProtection requireAuth={false}>
      <AuthErrorBoundary>
        <div class="relative grid h-full w-full place-items-center overflow-hidden bg-background">
          <div class="relative z-10 w-full max-w-md px-4">
            <Switch>
              <Match when={step() === 'select-server'}>
                <ServerSelection
                  onBack={
                    serverStore.servers.length > 0 ? undefined : handleBack
                  }
                  onEditServer={handleEditServer}
                  onSearchNewServer={() => setStep('search-server')}
                  onSelectServer={handleServerSelect}
                />
              </Match>

              <Match when={step() === 'search-server'}>
                <ServerFinder
                  onBack={
                    serverStore.servers.length > 0
                      ? () => setStep('select-server')
                      : undefined
                  }
                  onServerSelected={handleServerSelect}
                />
              </Match>

              <Match when={step() === 'login' && selectedServer()}>
                <LoginForm
                  initialPassword={editingServer()?.password}
                  initialUsername={editingServer()?.username}
                  isEditing={!!editingServer()}
                  onBack={handleBack}
                  server={selectedServer()!}
                />
              </Match>
            </Switch>
          </div>
        </div>
      </AuthErrorBoundary>
    </RouteProtection>
  );
}
