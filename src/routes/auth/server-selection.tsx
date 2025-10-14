import { useNavigate } from '@solidjs/router';
import { RecommendedServerInfo } from '@jellyfin/sdk';
import { AuthErrorBoundary } from '~/components/error/ErrorBoundary';
import { RouteProtection } from '~/components/auth/RouteProtection';
import { ServerSelection } from '~/components/auth/ServerSelection';
import { useServerStore } from '~/lib/store-hooks';
import { useAuthentication } from '~/hooks/useAuthentication';

export default function ServerSelectionPage() {
  const navigate = useNavigate();
  const { store: serverStore } = useServerStore();
  const { login } = useAuthentication();

  const handleServerSelect = (server: RecommendedServerInfo) => {
    // Check if this server has stored credentials
    const storedServer = serverStore.servers.find(s => s.info.address === server.address);
    
    if (storedServer && storedServer.auth.username && storedServer.auth.password) {
      // Auto-login with stored credentials
      const credentials = {
        username: storedServer.auth.username,
        password: storedServer.auth.password,
        server: server,
      };
      
      login(credentials);
    } else {
      // Navigate to login page with server address
      navigate(`/auth/login/${encodeURIComponent(server.address)}`);
    }
  };

  const handleEditServer = (server: RecommendedServerInfo) => {
    // Navigate to login page with server address for editing
    navigate(`/auth/login/${encodeURIComponent(server.address)}?edit=true`);
  };

  const handleSearchNewServer = () => {
    navigate('/auth/server-finder');
  };

  const handleBack = () => {
    // Only show back button if there are no servers
    if (serverStore.servers.length === 0) {
      navigate('/auth/onboarding');
    }
  };

  return (
    <RouteProtection requireAuth={false}>
      <AuthErrorBoundary>
        <div class="h-full w-full grid place-items-center relative overflow-hidden bg-background">

        <div class="w-full max-w-md px-4 relative z-10">
          <ServerSelection
            onBack={serverStore.servers.length > 0 ? undefined : handleBack}
            onSelectServer={handleServerSelect}
            onEditServer={handleEditServer}
            onSearchNewServer={handleSearchNewServer}
          />
        </div>
      </div>
      </AuthErrorBoundary>
    </RouteProtection>
  );
}
