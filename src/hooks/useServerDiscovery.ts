import type { RecommendedServerInfo } from '@jellyfin/sdk';
import { createMutation, useQuery } from '@tanstack/solid-query';
import { createMemo, createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { getServers } from '~/lib/jellyfin';
import { showErrorToast, showSuccessToast } from '~/lib/toast';
import {
  commonRules,
  createFormField,
  touchFormField,
  updateFormField,
} from '~/lib/validation';

export interface UseServerDiscoveryOptions {
  onServerSelected?: (server: RecommendedServerInfo) => void;
  onBack?: () => void;
  onError?: (error: Error) => void;
}

export function useServerDiscovery(options: UseServerDiscoveryOptions = {}) {
  // Use store for form data like LoginForm
  const [formData, setFormData] = createStore<{
    url: {
      value: string;
      error: string | null;
      touched: boolean;
      dirty: boolean;
    };
  }>({
    url: createFormField('', commonRules.serverUrl),
  });

  // Search state
  const [searchAttempted, setSearchAttempted] = createSignal(false);
  const [selectedServer, setSelectedServer] = createSignal<
    RecommendedServerInfo | undefined
  >();

  // URL validation
  const urlErrorDisplay = createMemo(() => {
    return formData.url.touched ? formData.url.error : null;
  });

  const isUrlValid = createMemo(() => {
    return !formData.url.error && formData.url.value.trim().length > 0;
  });

  // Server discovery query
  const serversQuery = useQuery(() => ({
    queryKey: ['discover-servers', formData.url.value],
    queryFn: async () => {
      const url = formData.url.value.trim();
      if (!url) {
        throw new Error('Server URL is required');
      }

      if (!isUrlValid()) {
        throw new Error(formData.url.error || 'Invalid server URL');
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
      const field = touchFormField(
        formData.url,
        commonRules.serverUrl,
        'server-url'
      );
      setFormData('url', field);

      if (field.error) {
        throw new Error(field.error);
      }

      return serversQuery.refetch();
    },
    onError: (error: Error) => {
      showErrorToast(error.message || 'Failed to discover servers');
      options.onError?.(error);
    },
    onSuccess: () => {
      showSuccessToast('Servers discovered successfully');
    },
  }));

  // Form handlers
  const handleUrlChange = (value: string) => {
    const field = updateFormField(
      formData.url,
      value,
      commonRules.serverUrl,
      'server-url'
    );
    setFormData('url', field);
  };

  const handleUrlBlur = () => {
    const field = touchFormField(
      formData.url,
      commonRules.serverUrl,
      'server-url'
    );
    setFormData('url', field);
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
  const isLoading = createMemo(
    () => searchMutation.isPending || serversQuery.isFetching
  );

  const discoveredServers = createMemo(() => serversQuery.data || []);

  const hasServers = createMemo(() => discoveredServers().length > 0);

  const searchError = createMemo(
    () => serversQuery.error || searchMutation.error
  );

  const showNoResults = createMemo(
    () => searchAttempted() && !isLoading() && !searchError() && !hasServers()
  );

  // Reset function
  const reset = () => {
    setFormData('url', createFormField('', commonRules.serverUrl));
    setSearchAttempted(false);
    setSelectedServer(undefined);
    searchMutation.reset();
    // Note: serversQuery doesn't have remove method, just reset mutation
  };

  return {
    // State
    urlValue: () => formData.url.value,
    urlError: urlErrorDisplay,
    urlTouched: () => formData.url.touched,
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
