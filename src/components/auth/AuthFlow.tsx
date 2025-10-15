import type { RecommendedServerInfo } from "@jellyfin/sdk";
import { createSignal, onMount, Show } from "solid-js";
import { useAuthentication } from "~/hooks/useAuthentication";
import { strongholdService } from "~/lib/jellyfin/stronghold";
import { useServerStore } from "~/lib/store-hooks";
import type { AuthCredentials } from "~/types";
import { LoginForm } from "./LoginForm";
import { UserSelection } from "./UserSelection";

type AuthFlowProps = {
  server: RecommendedServerInfo;
  onBack?: () => void;
  onSuccess?: () => void;
};

type AuthStep = "user-selection" | "login";

export function AuthFlow(props: AuthFlowProps) {
  const { store: serverStore } = useServerStore();
  const [currentStep, setCurrentStep] =
    createSignal<AuthStep>("user-selection");
  const [savedUsers, setSavedUsers] = createSignal<string[]>([]);
  const [selectedUsername, setSelectedUsername] = createSignal<string>("");
  const [isLoading, setIsLoading] = createSignal(true);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = createSignal(false);
  // Use the authentication hook to login directly
  const { login } = useAuthentication({
    onSuccess: () => {
      setIsAutoLoggingIn(false);
      props.onSuccess?.();
    },
    onError: (_error) => {
      setIsAutoLoggingIn(false);
      // Fall back to manual login if auto-login fails
      setSelectedUsername(selectedUsername());
      setCurrentStep("login");
    },
  });

  // Load saved users on mount
  const loadSavedUsers = () => {
    try {
      setIsLoading(true);

      // Pre-initialize Stronghold in background for faster auto-login
      strongholdService.preInitialize().catch((_error) => {
        // Do nothing
      });

      // Get users from the server store only
      const storedServer = serverStore.servers.find(
        (s) => s.info.address === props.server.address
      );

      if (storedServer?.users && storedServer.users.length > 0) {
        // Use users from server store
        const usernames = storedServer.users.map((user) => user.username);
        setSavedUsers(usernames);
      } else {
        setCurrentStep("login");
      }
    } catch (_error) {
      setCurrentStep("login");
    } finally {
      setIsLoading(false);
    }
  };

  onMount(() => {
    loadSavedUsers();
  });

  const handleSelectUser = (username: string, password: string) => {
    setIsAutoLoggingIn(true);

    try {
      // Auto-login with retrieved credentials
      const credentials: AuthCredentials = {
        username,
        password,
        server: props.server,
      };

      login(credentials);
    } catch (_error) {
      setIsAutoLoggingIn(false);
      // Fall back to manual login
      setSelectedUsername(username);
      setCurrentStep("login");
    }
  };

  const handleAddNewUser = () => {
    setSelectedUsername("");
    setCurrentStep("login");
  };

  const handleBackToUserSelection = () => {
    setCurrentStep("user-selection");
    setSelectedUsername("");
  };

  const handleBackToServerSelection = () => {
    props.onBack?.();
  };

  const _handleLoginSuccess = () => {
    // Refresh the user list and go back to user selection
    loadSavedUsers();
    setCurrentStep("user-selection");
    props.onSuccess?.();
  };

  const handleUserDeleted = (username: string) => {
    // Update the local users list
    const updatedUsers = savedUsers().filter((u) => u !== username);
    setSavedUsers(updatedUsers);

    // If no users left, go to login
    if (updatedUsers.length === 0) {
      setCurrentStep("login");
    }
  };

  return (
    <Show
      fallback={
        <div class="flex h-64 items-center justify-center">
          <div class="text-muted-foreground text-sm">
            {isAutoLoggingIn() ? "Signing in..." : "Loading saved users..."}
          </div>
        </div>
      }
      when={!(isLoading() || isAutoLoggingIn())}
    >
      <Show when={currentStep() === "user-selection"}>
        <UserSelection
          onAddNewUser={handleAddNewUser}
          onBack={handleBackToServerSelection}
          onSelectUser={handleSelectUser}
          onUserDeleted={handleUserDeleted}
          server={props.server}
          users={savedUsers()}
        />
      </Show>

      <Show when={currentStep() === "login"}>
        <LoginForm
          initialUsername={selectedUsername()}
          onBack={
            selectedUsername()
              ? handleBackToUserSelection
              : handleBackToServerSelection
          }
          server={props.server}
        />
      </Show>
    </Show>
  );
}
