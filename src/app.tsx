import { Router, useLocation } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { SolidQueryDevtools } from '@tanstack/solid-query-devtools';
import { createEffect, ErrorBoundary, type JSX, Suspense } from 'solid-js';

import { GeneralInfoProvider } from './components/current-user-provider';
import { ErrorBoundary as AppErrorBoundary } from './components/error/ErrorBoundary';
import { JellyFinProvider } from './components/jellyfin-provider';
import { PageLoading } from './components/ui/loading';
import { Toaster } from './components/ui/sonner';
import { useOverlayScrollbars } from './hooks/useOverlayScrollbars';
import { ServerStoreProvider } from './lib/store-hooks';
import { commands } from './lib/tauri';

import './app.css';

const queryClient = new QueryClient({});

const AppContainer = (props: { children: JSX.Element }) => {
  const path = useLocation();

  // Initialize custom scrollbars
  useOverlayScrollbars();

  createEffect(() => {
    if (!path.pathname.startsWith('/video')) {
      commands.playbackClear();
    }
  });
  return (
    <div class="relative grid min-h-screen">
      <div
        class="absolute top-0 left-0 z-10 h-10 w-full"
        data-tauri-drag-region
      />
      {props.children}
    </div>
  );
};

export default function App() {
  return (
    <Router
      root={(props) => (
        <AppErrorBoundary>
          <ErrorBoundary
            fallback={(e: Error) => <div>error occured : {e.message}</div>}
          >
            <QueryClientProvider client={queryClient}>
              <ServerStoreProvider>
                <JellyFinProvider>
                  <GeneralInfoProvider>
                    <AppContainer>
                      <Suspense fallback={<PageLoading />}>
                        {props.children}
                      </Suspense>
                    </AppContainer>
                    <Toaster />
                    <SolidQueryDevtools initialIsOpen={false} position="top" />
                  </GeneralInfoProvider>
                </JellyFinProvider>
              </ServerStoreProvider>
            </QueryClientProvider>
          </ErrorBoundary>
        </AppErrorBoundary>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
