import type { RecommendedServerInfo } from '@jellyfin/sdk';
import { useNavigate } from '@solidjs/router';
import { RouteProtection } from '~/components/auth/RouteProtection';
import { ServerFinder } from '~/components/auth/ServerFinder';
import { AuthErrorBoundary } from '~/components/error/ErrorBoundary';
import { useServerStore } from '~/lib/store-hooks';

export default function ServerFinderPage() {
  const navigate = useNavigate();
  const { store: serverStore, setStore: setServerStore } = useServerStore();

  const handleServerSelected = (server: RecommendedServerInfo) => {
    // Check if server already exists in store
    const existingServer = serverStore.servers.find(
      (s) => s.info.address === server.address
    );

    if (!existingServer) {
      // Add the discovered server to the store with empty auth credentials
      const newServer = {
        info: server,
        auth: { username: '', password: '' },
      };
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
        <div class="relative grid h-full w-full place-items-center overflow-hidden bg-background">
          <div class="relative z-10 w-full max-w-md px-4">
            <ServerFinder
              onBack={handleBack}
              onServerSelected={handleServerSelected}
            />
          </div>
        </div>
      </AuthErrorBoundary>
    </RouteProtection>
  );
}
