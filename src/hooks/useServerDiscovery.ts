import { createSignal, createMemo, Accessor } from 'solid-js';
import { createMutation, useQuery } from '@tanstack/solid-query';
import { RecommendedServerInfo } from '@jellyfin/sdk';
import { getServers } from '~/lib/jellyfin';
import {
  ServerSearchData,
  FormFieldState,
  OnboardingState
} from '~/types';
import {
  createFormField,
  updateFormField,
  touchFormField,
  commonRules
} from '~/lib/validation';
import { showErrorToast, showSuccessToast } from '~/lib/toast';

export interface UseServerDiscoveryOptions {
  onServerSelected?: (server: RecommendedServerInfo) => void;
  onBack?: () => void;
  onError?: (error: Error) => void;
}

export function useServerDiscovery(options: UseServerDiscoveryOptions = {}) {
  // URL input state
  const [urlField, setUrlField] = createSignal<FormFieldState<string>>(
    createFormField('', commonRules.serverUrl)
  );

  // Search state
  const [searchAttempted, setSearchAttempted] = createSignal(false);
  const [selectedServer, setSelectedServer] = createSignal<RecommendedServerInfo | undefined>();

  // URL validation
  const urlError = createMemo(() => {
    const field = urlField();
    return field.touched ? field.error : null;
  });

  const isUrlValid = createMemo(() => {
    const field = urlField();
    return !field.error && field.value.trim().length > 0;
  });

  // Server discovery query
  const serversQuery = useQuery(() => ({
    queryKey: ['discover-servers', urlField().value],
    queryFn: async () => {
      const url = urlField().value.trim();
      if (!url) {
        throw new Error('Server URL is required');
      }

      if (!isUrlValid()) {
        throw new Error(urlError() || 'Invalid server URL');
      }

      setSearchAttempted(true);

      try {
        const foundServers = await getServers(url);

        if (foundServers.length === 0) {
          throw new Error(
            'No Jellyfin servers found at this address. Please check the URL and try again.'
          );
        }

        return foundServers;
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to discover servers. Please try again.');
      }
    },
    enabled: false, // Manually triggered
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  }));

  // Search mutation
  const searchMutation = createMutation(() => ({
    mutationFn: async () => {
      // Validate URL first
      const field = urlField();
      const touchedField = touchFormField(field, commonRules.serverUrl, 'server-url');
      setUrlField(touchedField);

      if (touchedField.error) {
        throw new Error(touchedField.error);
      }

      return serversQuery.refetch();
    },
    onError: (error: Error) => {
      console.error('Server discovery failed:', error);
      showErrorToast(error.message || 'Failed to discover servers');
      options.onError?.(error);
    },
    onSuccess: () => {
      showSuccessToast('Servers discovered successfully');
    }
  }));

  // Form handlers
  const handleUrlChange = (value: string) => {
    const field = urlField();
    const updatedField = updateFormField(field, value, commonRules.serverUrl, 'server-url');
    setUrlField(updatedField);
  };

  const handleUrlBlur = () => {
    const field = urlField();
    const touchedField = touchFormField(field, commonRules.serverUrl, 'server-url');
    setUrlField(touchedField);
  };

  const handleSearch = () => {
    searchMutation.mutate();
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleServerSelect = (server: RecommendedServerInfo) => {
    setSelectedServer(server);
    options.onServerSelected?.(server);
  };

  const handleBack = () => {
    options.onBack?.();
  };

  // Computed states
  const isLoading = createMemo(() =>
    searchMutation.isPending || serversQuery.isFetching
  );

  const discoveredServers = createMemo(() =>
    serversQuery.data || []
  );

  const hasServers = createMemo(() =>
    discoveredServers().length > 0
  );

  const searchError = createMemo(() =>
    serversQuery.error || searchMutation.error
  );

  const showNoResults = createMemo(() =>
    searchAttempted() &&
    !isLoading() &&
    !searchError() &&
    !hasServers()
  );

  // Reset function
  const reset = () => {
    setUrlField(createFormField('', commonRules.serverUrl));
    setSearchAttempted(false);
    setSelectedServer(undefined);
    searchMutation.reset();
    serversQuery.remove();
  };

  return {
    // State
    urlField,
    urlError,
    isUrlValid,
    searchAttempted,
    selectedServer,
    isLoading,
    discoveredServers,
    hasServers,
    searchError,
    showNoResults,

    // Actions
    handleUrlChange,
    handleUrlBlur,
    handleSearch,
    handleKeyPress,
    handleServerSelect,
    handleBack,
    reset,

    // Query and mutation states
    serversQuery,
    searchMutation,
  };
}