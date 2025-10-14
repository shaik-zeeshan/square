import { useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { Show } from "solid-js";
import { LoginForm } from "~/components/auth/LoginForm";
import { RouteProtection } from "~/components/auth/RouteProtection";
import { AuthErrorBoundary } from "~/components/error/ErrorBoundary";
import { useAuthentication } from "~/hooks/useAuthentication";
import { useServerStore } from "~/lib/store-hooks";

export default function LoginPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { store: serverStore } = useServerStore();
  const { isAuthenticated } = useAuthentication();

  // Find the server by address from URL params
  const server = () => {
    const serverAddress = params.serverAddress;
    if (!serverAddress) {
      return null;
    }

    const foundServer = serverStore.servers.find(
      (s) => s.info.address === decodeURIComponent(serverAddress)
    );
    return foundServer?.info || null;
  };

  const _handleLoginComplete = () => {
    // Redirect to home after successful login
    navigate("/");
  };

  const handleBack = () => {
    navigate("/auth/onboarding");
  };

  return (
    <RouteProtection requireAuth={false}>
      <AuthErrorBoundary>
        <div class="relative grid h-full w-full place-items-center overflow-hidden bg-background">
          <div class="relative z-10 w-full max-w-md px-4">
            <Show when={server()}>
              <LoginForm
                initialPassword={
                  searchParams.edit
                    ? serverStore.servers.find(
                        (s) =>
                          s.info.address ===
                          decodeURIComponent(params.serverAddress)
                      )?.auth.password
                    : undefined
                }
                initialUsername={
                  searchParams.edit
                    ? serverStore.servers.find(
                        (s) =>
                          s.info.address ===
                          decodeURIComponent(params.serverAddress)
                      )?.auth.username
                    : undefined
                }
                isEditing={!!searchParams.edit}
                onBack={handleBack}
                server={server()!}
              />
            </Show>
            <Show when={!server()}>
              <div class="text-center">
                <h2 class="mb-4 font-bold text-2xl">Server Not Found</h2>
                <p class="mb-6 text-sm opacity-60">
                  The requested server could not be found.
                </p>
                <button
                  class="rounded-lg bg-orange-500/20 px-6 py-2 transition-colors hover:bg-orange-500/30"
                  onClick={handleBack}
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
