import { useMutation } from "@tanstack/solid-query";
import { batch, createMemo } from "solid-js";
import { strongholdService } from "~/lib/jellyfin/stronghold";
import { user } from "~/lib/jellyfin/user";
import { useServerStore } from "~/lib/store-hooks";
import { showErrorToast, showSuccessToast } from "~/lib/toast";
import type { AuthCredentials, AuthState, ServerConnection } from "~/types";

export interface UseAuthenticationOptions {
  onSuccess?: (credentials: AuthCredentials) => void;
  onError?: (error: Error) => void;
}

export function useAuthentication(options: UseAuthenticationOptions = {}) {
  const { store: serverStore, setStore: setServerStore } = useServerStore();

  // Login mutation
  const loginMutation = useMutation(() => ({
    mutationKey: ["login"],
    mutationFn: async (credentials: AuthCredentials) => {
      try {
        const token = await user.mutation.login(
          credentials.username,
          credentials.password,
          credentials.server
        );

        return { token, credentials };
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error(
          "Login failed. Please check your credentials and try again."
        );
      }
    },
    onSuccess: async ({ token, credentials }) => {
      // Optimistic update: Update server store immediately for better UX
      batch(() => {
        const existingServerIndex = serverStore.servers.findIndex(
          (s) => s.info.address === credentials.server.address
        );

        const now = Date.now();
        const newUser = {
          username: credentials.username,
          savedAt: now,
        };

        let updatedServers;
        if (existingServerIndex >= 0) {
          // Update existing server
          updatedServers = [...serverStore.servers];
          const existingServer = updatedServers[existingServerIndex];

          // Add user if not already present
          const userExists = existingServer.users.some(
            (u) => u.username === credentials.username
          );
          const updatedUsers = userExists
            ? existingServer.users.map((u) =>
                u.username === credentials.username ? { ...u, savedAt: now } : u
              )
            : [...existingServer.users, newUser];

          updatedServers[existingServerIndex] = {
            ...existingServer,
            users: updatedUsers,
            lastConnected: new Date(),
            isOnline: true,
            currentUser: credentials.username,
          };
        } else {
          // Add new server
          const serverConnection: ServerConnection = {
            info: credentials.server,
            users: [newUser],
            lastConnected: new Date(),
            isOnline: true,
            currentUser: credentials.username,
          };
          updatedServers = [...serverStore.servers, serverConnection];
        }

        setServerStore({
          servers: updatedServers,
          current:
            updatedServers[
              existingServerIndex >= 0
                ? existingServerIndex
                : updatedServers.length - 1
            ],
        });
      });

      showSuccessToast("Successfully signed in");
      options.onSuccess?.(credentials);

      // Save password to Stronghold in background (non-blocking)
      try {
        await strongholdService.saveCredentials(
          credentials.server,
          credentials.username,
          credentials.password
        );
      } catch (_error) {
        // Don't show error to user since login was successful
      }
    },
    onError: (error: Error) => {
      const errorMessage =
        error.message ||
        "Login failed. Please check your credentials and try again.";

      showErrorToast(errorMessage);

      options.onError?.(error);
    },
  }));

  // Logout mutation
  const logoutMutation = useMutation(() => ({
    mutationFn: async () => {
      await user.mutation.logout();
    },
    onSuccess: () => {
      showSuccessToast("Successfully signed out");
    },
    onError: (_error: Error) => {
      showErrorToast("Failed to sign out");
    },
  }));

  // Authentication state
  const authState = createMemo<AuthState>(() => ({
    isAuthenticated: serverStore.current !== null,
    accessToken: null, // This would come from auth store if needed
    user: null, // This would come from general info store
    server: serverStore.current?.info || null,
    isLoading: loginMutation.isPending || logoutMutation.isPending,
    error:
      loginMutation.error?.message || logoutMutation.error?.message || null,
  }));

  // Computed states
  const isLoading = createMemo(
    () => loginMutation.isPending || logoutMutation.isPending
  );

  const error = createMemo(
    () => loginMutation.error?.message || logoutMutation.error?.message || null
  );

  const isAuthenticated = createMemo(() => serverStore.current !== null);

  const currentServer = createMemo(() => serverStore.current?.info || null);

  // Actions
  const login = (credentials: AuthCredentials) => {
    loginMutation.mutate(credentials);
  };

  const logout = () => {
    logoutMutation.mutate();
  };

  const retryLogin = async () => {
    if (serverStore.current?.currentUser) {
      try {
        // Get password from Stronghold only
        const credential = await strongholdService.getCredentials(
          serverStore.current.info,
          serverStore.current.currentUser
        );

        const credentials: AuthCredentials = {
          username: serverStore.current.currentUser,
          password: credential.password,
          server: serverStore.current.info,
        };
        login(credentials);
      } catch (_error) {
        showErrorToast("Failed to retrieve saved credentials");
      }
    }
  };

  const removeServer = async (serverAddress: string) => {
    const serverToRemove = serverStore.servers.find(
      (server) => server.info.address === serverAddress
    );

    if (serverToRemove) {
      // Remove all user credentials from Stronghold
      for (const user of serverToRemove.users) {
        try {
          await strongholdService.deleteUser(
            serverToRemove.info,
            user.username
          );
        } catch (_error) {}
      }
    }

    const updatedServers = serverStore.servers.filter(
      (server) => server.info.address !== serverAddress
    );

    const isCurrentServer = serverStore.current?.info.address === serverAddress;

    setServerStore({
      servers: updatedServers,
      current: isCurrentServer ? null : serverStore.current,
    });

    if (isCurrentServer) {
      showSuccessToast("Server removed and signed out");
    } else {
      showSuccessToast("Server removed successfully");
    }
  };

  const updateServerCredentials = async (
    serverAddress: string,
    newCredentials: Partial<AuthCredentials>
  ) => {
    const serverIndex = serverStore.servers.findIndex(
      (server) => server.info.address === serverAddress
    );

    if (
      serverIndex >= 0 &&
      newCredentials.username &&
      newCredentials.password
    ) {
      try {
        // Update password in Stronghold only
        await strongholdService.saveCredentials(
          serverStore.servers[serverIndex].info,
          newCredentials.username,
          newCredentials.password
        );

        // Update server store with user info (no passwords)
        const updatedServers = [...serverStore.servers];
        const existingServer = updatedServers[serverIndex];

        const now = Date.now();
        const updatedUser = {
          username: newCredentials.username,
          savedAt: now,
        };

        // Add or update user in the list
        const userExists = existingServer.users.some(
          (u) => u.username === newCredentials.username
        );
        const updatedUsers = userExists
          ? existingServer.users.map((u) =>
              u.username === newCredentials.username
                ? { ...u, savedAt: now }
                : u
            )
          : [...existingServer.users, updatedUser];

        updatedServers[serverIndex] = {
          ...existingServer,
          users: updatedUsers,
          currentUser: newCredentials.username,
        };

        setServerStore({ servers: updatedServers });

        // If updating current server, also update current
        if (serverStore.current?.info.address === serverAddress) {
          setServerStore({
            current: {
              ...serverStore.current,
              users: updatedUsers,
              currentUser: newCredentials.username,
            },
          });
        }

        showSuccessToast("Server credentials updated");
      } catch (_error) {
        showErrorToast("Failed to update server credentials");
      }
    }
  };

  return {
    // State
    authState,
    isLoading,
    error,
    isAuthenticated,
    currentServer,

    // Mutations
    loginMutation,
    logoutMutation,

    // Actions
    login,
    logout,
    retryLogin,
    removeServer,
    updateServerCredentials,
  };
}
