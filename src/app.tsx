import { Router, useLocation, useNavigate } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { createEffect, ErrorBoundary, JSX, Show, Suspense } from 'solid-js';

import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { SolidQueryDevtools } from '@tanstack/solid-query-devtools';

import './app.css';
import { GeneralInfoProvider } from './components/current-user-provider';
import { JellyFinProvider } from './components/jellyfin-provider';


import { commands } from './lib/tauri';
import { ServerStoreProvider } from './lib/store-hooks';

const queryClient = new QueryClient({});

const AppContainer = (props: { children: JSX.Element }) => {
  const path = useLocation();
  const navigate = useNavigate();

  createEffect(() => {
    if (!path.pathname.startsWith('/video')) {
      commands.playbackClear();
    }
  });
  return (
    <div class="grid min-h-screen overflow-hidden relative">
      <div
        data-tauri-drag-region
        class="absolute top-0 left-0 w-full h-10 z-10"
      />
      {props.children}
    </div>
  );
};

export default function App() {
  return (
    <Router
      root={(props) => (
        <ErrorBoundary
          fallback={(e: Error) => <div>error occured : {e.message}</div>}
        >
          <QueryClientProvider client={queryClient}>
            <ServerStoreProvider>
              <JellyFinProvider>
                <GeneralInfoProvider>
                  <AppContainer>
                    <Suspense>{props.children}</Suspense>
                  </AppContainer>
                  <SolidQueryDevtools initialIsOpen={false} position="top" />
                </GeneralInfoProvider>
              </JellyFinProvider>
            </ServerStoreProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
