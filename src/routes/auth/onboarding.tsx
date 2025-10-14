import { createSignal, Switch, Match } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { RecommendedServerInfo } from '@jellyfin/sdk';
import { AuthErrorBoundary } from '~/components/error/ErrorBoundary';
import { RouteProtection } from '~/components/auth/RouteProtection';
import { ServerSelection } from '~/components/auth/ServerSelection';
import { ServerFinder } from '~/components/auth/ServerFinder';
import { LoginForm } from '~/components/auth/LoginForm';
import { useServerStore } from '~/lib/store-hooks';
import { useAuthentication } from '~/hooks/useAuthentication';

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
    let storedServer = serverStore.servers.find(s => s.info.address === server.address);
    
    if (!storedServer) {
      // Add the server to the store if it doesn't exist
      const newServer = {
        info: server,
        auth: { username: '', password: '' }
      };
      
      setServerStore('servers', [...serverStore.servers, newServer]);
      storedServer = newServer;
    }
    
    // Now check if this server has stored credentials
    if (storedServer && storedServer.auth.username) {
      // Auto-login with stored credentials (password can be empty for some Jellyfin setups)
      const credentials = {
        username: storedServer.auth.username,
        password: storedServer.auth.password || '',
        server: storedServer.info, // Use the stored server info
      };
      
      login(credentials);
    } else {
      // Navigate to login page with server address
      navigate(`/auth/login/${encodeURIComponent(server.address)}`);
    }
  };

  const handleEditServer = (server: RecommendedServerInfo) => {
    navigate(`/auth/login/${encodeURIComponent(server.address)}?edit=true`);
  };

  const handleLoginComplete = () => {
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
        <div class="h-full w-full grid place-items-center relative overflow-hidden bg-background">

        <div class="w-full max-w-md px-4 relative z-10">
          <Switch>
            <Match when={step() === 'select-server'}>
              <ServerSelection
                onBack={serverStore.servers.length > 0 ? undefined : handleBack}
                onSelectServer={handleServerSelect}
                onEditServer={handleEditServer}
                onSearchNewServer={() => setStep('search-server')}
              />
            </Match>

            <Match when={step() === 'search-server'}>
              <ServerFinder
                onServerSelected={handleServerSelect}
                onBack={
                  serverStore.servers.length > 0
                    ? () => setStep('select-server')
                    : undefined
                }
              />
            </Match>

            <Match when={step() === 'login' && selectedServer()}>
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
      </AuthErrorBoundary>
    </RouteProtection>
  );
}
