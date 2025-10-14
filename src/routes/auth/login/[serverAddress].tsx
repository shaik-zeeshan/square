import { createSignal, Show } from 'solid-js';
import { useParams, useNavigate, useSearchParams } from '@solidjs/router';
import { RecommendedServerInfo } from '@jellyfin/sdk';
import { AuthErrorBoundary } from '~/components/error/ErrorBoundary';
import { RouteProtection } from '~/components/auth/RouteProtection';
import { LoginForm } from '~/components/auth/LoginForm';
import { useServerStore } from '~/lib/store-hooks';
import { useAuthentication } from '~/hooks/useAuthentication';

export default function LoginPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { store: serverStore } = useServerStore();
  const { isAuthenticated } = useAuthentication();

  // Find the server by address from URL params
  const server = () => {
    const serverAddress = params.serverAddress;
    if (!serverAddress) return null;
    
    console.log('Looking for server with address:', decodeURIComponent(serverAddress));
    console.log('Available servers:', serverStore.servers);
    
    const foundServer = serverStore.servers.find(
      (s) => s.info.address === decodeURIComponent(serverAddress)
    );
    
    console.log('Found server:', foundServer);
    return foundServer?.info || null;
  };

  const handleLoginComplete = () => {
    // Redirect to home after successful login
    navigate('/');
  };

  const handleBack = () => {
    navigate('/auth/onboarding');
  };

  return (
    <RouteProtection requireAuth={false}>
      <AuthErrorBoundary>
        <div class="h-full w-full grid place-items-center relative overflow-hidden bg-background">

        <div class="w-full max-w-md px-4 relative z-10">
          <Show when={server()}>
            <LoginForm
              server={server()!}
              initialUsername={searchParams.edit ? serverStore.servers.find(s => s.info.address === decodeURIComponent(params.serverAddress))?.auth.username : undefined}
              initialPassword={searchParams.edit ? serverStore.servers.find(s => s.info.address === decodeURIComponent(params.serverAddress))?.auth.password : undefined}
              isEditing={!!searchParams.edit}
              onBack={handleBack}
            />
          </Show>
          <Show when={!server()}>
            <div class="text-center">
              <h2 class="text-2xl font-bold mb-4">Server Not Found</h2>
              <p class="text-sm opacity-60 mb-6">
                The requested server could not be found.
              </p>
              <button
                onClick={handleBack}
                class="px-6 py-2 bg-orange-500/20 hover:bg-orange-500/30 rounded-lg transition-colors"
              >
                Back to Onboarding
              </button>
            </div>
          </Show>
        </div>
      </div>
      </AuthErrorBoundary>
    </RouteProtection>
  );
}
