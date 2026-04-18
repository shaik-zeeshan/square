import { Router, useLocation } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { QueryClientProvider } from "@tanstack/solid-query";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ManagedRuntime } from "effect";
import {
  createEffect,
  ErrorBoundary,
  type JSX,
  lazy,
  Suspense,
} from "solid-js";
import { ErrorBoundary as AppErrorBoundary } from "./components/error/ErrorBoundary";
import { PageLoading } from "./components/ui/loading";
import { Toaster } from "./components/ui/sonner";
import { RuntimeProvider } from "./effect/runtime/runtime-provider";
import { LiveLayer } from "./effect/services/layer";
import { useOverlayScrollbars } from "./hooks/useOverlayScrollbars";
import { commands } from "./lib/tauri";

import "./app.css";
import { CheckForUpdate } from "~/components/update-component";
import { useVideoContext } from "~/contexts/video-context";
import { VideoContextProvider } from "./contexts/video-context";
import { queryClient } from "./effect/tanstack/query";
import { AppPreferencesProvider } from "./lib/store-hooks";

const SolidQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/solid-query-devtools").then((m) => ({
        default: m.SolidQueryDevtools,
      }))
    )
  : () => null;

const AppContainer = (props: { children: JSX.Element }) => {
  const path = useLocation();
  const [videoContext] = useVideoContext();

  // Initialize custom scrollbars (skip in PiP — unnecessary overhead)
  if (getCurrentWindow().label !== "pip") {
    useOverlayScrollbars();
  }

  createEffect(() => {
    if (!path.pathname.startsWith("/video")) {
      // Skip clearing playback when running inside the PiP webview — the PiP
      // window shares the same app shell but must never interrupt active playback.
      if (getCurrentWindow().label === "pip") {
        return;
      }

      // Non-video routes in the main window should always restore window chrome,
      // even when playback is preserved for PiP continuity.
      commands.toggleTitlebarHide(false);

      // Preserve playback continuity while PiP is active.
      if (videoContext.isPip) {
        return;
      }

      // Preserve playback continuity while PiP is intentionally transitioning
      // back to the main window.
      if (videoContext.isPipTransitioning) {
        return;
      }

      commands.playbackClear();
    }
  });

  const isVideoRoute = () => path.pathname.startsWith("/video");
  const isPipRoute = () => path.pathname === "/pip";

  createEffect(() => {
    const surface = isVideoRoute() || isPipRoute() ? "transparent" : "app";

    document.documentElement.dataset.windowSurface = surface;
    document.body.dataset.windowSurface = surface;
  });
  const isNavRoute = () => {
    const p = path.pathname;
    return p === "/" || p.startsWith("/library") || p.startsWith("/settings");
  };

  const shellClass = () => {
    if (isVideoRoute() || isPipRoute()) {
      return "app-shell app-shell--video relative grid min-h-screen";
    }
    if (isNavRoute()) {
      return "app-shell app-shell--nav relative grid min-h-screen";
    }
    return "app-shell relative grid min-h-screen";
  };

  return (
    <div class={shellClass()}>
      {/* Tauri drag region — above content, below video controls */}
      <div
        class="absolute top-0 left-0 z-10 h-10 w-full"
        data-tauri-drag-region
      />
      {props.children}
      {getCurrentWindow().label !== "pip" && <CheckForUpdate />}
    </div>
  );
};

export default function App() {
  const runtime = ManagedRuntime.make(LiveLayer);

  return (
    <Router
      root={(props) => (
        <AppErrorBoundary>
          <ErrorBoundary
            fallback={(e: Error) => <div>error occured : {e.message}</div>}
          >
            <RuntimeProvider runtime={runtime}>
              <QueryClientProvider client={queryClient}>
                <AppPreferencesProvider>
                <VideoContextProvider>
                  <AppContainer>
                    <Suspense fallback={<PageLoading />}>
                      {props.children}
                    </Suspense>
                  </AppContainer>
                  <Toaster />
                  <SolidQueryDevtools
                    buttonPosition="bottom-left"
                    initialIsOpen={false}
                    position="top"
                  />
                </VideoContextProvider>
                </AppPreferencesProvider>
              </QueryClientProvider>
            </RuntimeProvider>
          </ErrorBoundary>
        </AppErrorBoundary>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
