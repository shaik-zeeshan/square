import { useNavigate } from '@solidjs/router';
import { RecommendedServerInfo } from '@jellyfin/sdk';
import { AuthErrorBoundary } from '~/components/error/ErrorBoundary';
import { RouteProtection } from '~/components/auth/RouteProtection';
import { ServerFinder } from '~/components/auth/ServerFinder';
import { useServerStore } from '~/lib/store-hooks';

export default function ServerFinderPage() {
  const navigate = useNavigate();
  const { store: serverStore, setStore: setServerStore } = useServerStore();

  const handleServerSelected = (server: RecommendedServerInfo) => {
    // Check if server already exists in store
    const existingServer = serverStore.servers.find(
      (s) => s.info.address === server.address
    );

    console.log('existingServer', existingServer);

    if (!existingServer) {
      // Add the discovered server to the store with empty auth credentials
      const newServer = {
        info: server,
        auth: { username: '', password: '' }
      };
      
      console.log('newServer', newServer);
      setServerStore('servers', [...serverStore.servers, newServer]);
    }

    // Navigate to login page with server address
    navigate(`/auth/login/${encodeURIComponent(server.address)}`);
  };

  const handleBack = () => {
    navigate('/auth/onboarding');
  };

  return (
    <RouteProtection requireAuth={false}>
      <AuthErrorBoundary>
        <div class="h-full w-full grid place-items-center relative overflow-hidden bg-background">

        <div class="w-full max-w-md px-4 relative z-10">
          <ServerFinder
            onServerSelected={handleServerSelected}
            onBack={handleBack}
          />
        </div>
      </div>
      </AuthErrorBoundary>
    </RouteProtection>
  );
}
