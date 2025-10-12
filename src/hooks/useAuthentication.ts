import { createSignal, createMemo, Accessor } from 'solid-js';
import { createMutation } from '@tanstack/solid-query';
import { RecommendedServerInfo } from '@jellyfin/sdk';
import { useServerStore } from '~/lib/store-hooks';
import { user } from '~/lib/jellyfin/user';
import { AuthCredentials, AuthState } from '~/types';
import { showSuccessToast, showErrorToast } from '~/lib/toast';

export interface UseAuthenticationOptions {
  onSuccess?: (credentials: AuthCredentials) => void;
  onError?: (error: Error) => void;
}

export function useAuthentication(options: UseAuthenticationOptions = {}) {
  const { store: serverStore, setStore: setServerStore } = useServerStore();

  // Login mutation
  const loginMutation = createMutation(() => ({
    mutationKey: ['login'],
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
        throw new Error('Login failed. Please check your credentials and try again.');
      }
    },
    onSuccess: ({ token, credentials }) => {
      // Store server credentials
      const existingServerIndex = serverStore.servers.findIndex(
        s => s.info.address === credentials.server.address
      );

      const serverConnection = {
        info: credentials.server,
        auth: {
          username: credentials.username,
          password: credentials.password,
        },
        lastConnected: new Date(),
        isOnline: true,
      };

      let updatedServers;
      if (existingServerIndex >= 0) {
        // Update existing server
        updatedServers = [...serverStore.servers];
        updatedServers[existingServerIndex] = serverConnection;
      } else {
        // Add new server
        updatedServers = [...serverStore.servers, serverConnection];
      }

      setServerStore({
        servers: updatedServers,
        current: serverConnection,
      });

      showSuccessToast('Successfully signed in');

      options.onSuccess?.(credentials);
    },
    onError: (error: Error) => {
      console.error('Login error:', error);

      const errorMessage = error.message || 'Login failed. Please check your credentials and try again.';

      showErrorToast(errorMessage);

      options.onError?.(error);
    },
  }));

  // Logout mutation
  const logoutMutation = createMutation(() => ({
    mutationFn: async () => {
      await user.mutation.logout();
    },
    onSuccess: () => {
      showSuccessToast('Successfully signed out');
    },
    onError: (error: Error) => {
      console.error('Logout error:', error);
      showErrorToast('Failed to sign out');
    },
  }));

  // Authentication state
  const authState = createMemo<AuthState>(() => ({
    isAuthenticated: serverStore.current !== null,
    accessToken: null, // This would come from auth store if needed
    user: null, // This would come from general info store
    server: serverStore.current?.info || null,
    isLoading: loginMutation.isPending || logoutMutation.isPending,
    error: loginMutation.error?.message || logoutMutation.error?.message || null,
  }));

  // Computed states
  const isLoading = createMemo(() =>
    loginMutation.isPending || logoutMutation.isPending
  );

  const error = createMemo(() =>
    loginMutation.error?.message || logoutMutation.error?.message || null
  );

  const isAuthenticated = createMemo(() =>
    serverStore.current !== null
  );

  const currentServer = createMemo(() =>
    serverStore.current?.info || null
  );

  // Actions
  const login = (credentials: AuthCredentials) => {
    loginMutation.mutate(credentials);
  };

  const logout = () => {
    logoutMutation.mutate();
  };

  const retryLogin = () => {
    if (serverStore.current) {
      const credentials: AuthCredentials = {
        username: serverStore.current.auth.username,
        password: serverStore.current.auth.password,
        server: serverStore.current.info,
      };
      login(credentials);
    }
  };

  const removeServer = (serverAddress: string) => {
    const updatedServers = serverStore.servers.filter(
      server => server.info.address !== serverAddress
    );

    const isCurrentServer = serverStore.current?.info.address === serverAddress;

    setServerStore({
      servers: updatedServers,
      current: isCurrentServer ? null : serverStore.current,
    });

    if (isCurrentServer) {
      showSuccessToast('Server removed and signed out');
    } else {
      showSuccessToast('Server removed successfully');
    }
  };

  const updateServerCredentials = (
    serverAddress: string,
    newCredentials: Partial<AuthCredentials>
  ) => {
    const serverIndex = serverStore.servers.findIndex(
      server => server.info.address === serverAddress
    );

    if (serverIndex >= 0) {
      const updatedServers = [...serverStore.servers];
      updatedServers[serverIndex] = {
        ...updatedServers[serverIndex],
        auth: {
          ...updatedServers[serverIndex].auth,
          ...newCredentials,
        },
      };

      setServerStore({ servers: updatedServers });

      // If updating current server, also update current
      if (serverStore.current?.info.address === serverAddress) {
        setServerStore({
          current: {
            ...serverStore.current,
            auth: {
              ...serverStore.current.auth,
              ...newCredentials,
            },
          },
        });
      }

      showSuccessToast('Server credentials updated');
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