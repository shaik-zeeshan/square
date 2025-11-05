import {
  AlertTriangle,
  Film,
  Home,
  RefreshCw,
  Settings,
  WifiOff,
} from "lucide-solid";
import {
  createSignal,
  type JSX,
  Match,
  type ParentComponent,
  ErrorBoundary as SolidErrorBoundary,
  Switch,
} from "solid-js";
import { GlassButton } from "~/components/ui/glass-button";

type ErrorBoundaryProps = {
  fallback?: (error: Error, reset: () => void) => JSX.Element;
  onError?: (error: Error, errorInfo: unknown) => void;
  context?: "app" | "auth" | "media" | "query" | "component";
  title?: string;
  description?: string;
  children: JSX.Element;
};

export const ErrorBoundary: ParentComponent<ErrorBoundaryProps> = (props) => (
  <SolidErrorBoundary
    fallback={(error, reset) => {
      props.onError?.(error, { componentStack: "No stack available" });

      if (props.fallback) {
        return props.fallback(error, reset);
      }

      return (
        <ContextAwareErrorFallback
          context={props.context}
          description={props.description}
          error={error}
          reset={reset}
          title={props.title}
        />
      );
    }}
  >
    {props.children}
  </SolidErrorBoundary>
);

type DefaultErrorFallbackProps = {
  error: Error;
  reset: () => void;
  context?: "app" | "auth" | "media" | "query" | "component";
  title?: string;
  description?: string;
};

function ContextAwareErrorFallback(props: DefaultErrorFallbackProps) {
  const [isRetrying, setIsRetrying] = createSignal(false);

  const handleRetry = () => {
    setIsRetrying(true);
    try {
      props.reset();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleGoHome = () => {
    window.location.href = "/";
  };

  const getErrorDetails = () => {
    try {
      return {
        name: props.error.name,
        message: props.error.message,
        stack: props.error.stack,
        timestamp: new Date().toISOString(),
        context: props.context,
      };
    } catch {
      return {
        name: "Unknown Error",
        message: "An unexpected error occurred",
        stack: null,
        timestamp: new Date().toISOString(),
        context: props.context,
      };
    }
  };

  const getContextConfig = () => {
    switch (props.context) {
      case "auth":
        return {
          icon: <WifiOff class="h-8 w-8 text-orange-400" />,
          bgColor: "bg-orange-500/20",
          borderColor: "border-orange-500/20",
          title: props.title || "Authentication Error",
          description:
            props.description ||
            "Failed to authenticate. Please check your connection and try again.",
          showGoHome: false,
        };
      case "media":
        return {
          icon: <Film class="h-8 w-8 text-yellow-400" />,
          bgColor: "bg-yellow-500/20",
          borderColor: "border-yellow-500/20",
          title: props.title || "Media Loading Error",
          description:
            props.description ||
            "Failed to load media. Please check your connection and try again.",
          showGoHome: false,
        };
      case "query":
        return {
          icon: <AlertTriangle class="h-8 w-8 text-blue-400" />,
          bgColor: "bg-blue-500/20",
          borderColor: "border-blue-500/20",
          title: props.title || "Data Loading Error",
          description:
            props.description || "Failed to load data. Please try again.",
          showGoHome: false,
        };
      case "component":
        return {
          icon: <Settings class="h-8 w-8 text-purple-400" />,
          bgColor: "bg-purple-500/20",
          borderColor: "border-purple-500/20",
          title: props.title || "Component Error",
          description: props.description || "A component encountered an error.",
          showGoHome: true,
        };
      default:
        return {
          icon: <AlertTriangle class="h-8 w-8 text-red-400" />,
          bgColor: "bg-red-500/20",
          borderColor: "border-red-500/20",
          title: props.title || "Oops! Something went wrong",
          description:
            props.description ||
            "We encountered an unexpected error. This has been logged and we'll look into it.",
          showGoHome: true,
        };
    }
  };

  const config = getContextConfig();

  return (
    <Switch>
      <Match when={props.context === "auth"}>
        <div class="mx-auto w-full max-w-md p-4">
          <div
            class={`rounded-lg border ${config.borderColor} ${config.bgColor} p-6 text-center`}
          >
            <div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/20">
              {config.icon}
            </div>
            <h3 class="mb-2 font-semibold text-white text-xl">
              {config.title}
            </h3>
            <p class="mb-4 text-sm opacity-60">{config.description}</p>
            <div
              class={`rounded-lg border ${config.borderColor} ${config.bgColor} mb-4 p-3`}
            >
              <p class="font-medium text-orange-300 text-sm">
                {props.error.name || "Authentication Error"}
              </p>
              <p class="mt-1 break-words text-orange-400 text-xs">
                {props.error.message || "An authentication error occurred"}
              </p>
            </div>
            <GlassButton
              class="w-full"
              disabled={isRetrying()}
              onClick={handleRetry}
              variant="solid"
            >
              <RefreshCw
                class={`mr-2 h-4 w-4 ${isRetrying() ? "animate-spin" : ""}`}
              />
              {isRetrying() ? "Retrying..." : "Try Again"}
            </GlassButton>
          </div>
        </div>
      </Match>

      <Match when={props.context === "media"}>
        <div class="w-full p-8 text-center">
          <div class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/20">
            {config.icon}
          </div>
          <h3 class="mb-2 font-semibold text-lg text-white">{config.title}</h3>
          <p class="mb-4 text-sm opacity-60">{config.description}</p>
          <div
            class={`rounded-lg border ${config.borderColor} ${config.bgColor} mx-auto mb-4 max-w-md p-3`}
          >
            <p class="font-medium text-sm text-yellow-300">
              {props.error.name || "Media Error"}
            </p>
            <p class="mt-1 break-words text-xs text-yellow-400">
              {props.error.message || "A media loading error occurred"}
            </p>
          </div>
          <GlassButton
            disabled={isRetrying()}
            onClick={handleRetry}
            variant="solid"
          >
            <RefreshCw
              class={`mr-2 h-4 w-4 ${isRetrying() ? "animate-spin" : ""}`}
            />
            {isRetrying() ? "Retrying..." : "Retry"}
          </GlassButton>
        </div>
      </Match>

      <Match when={props.context === "query"}>
        <div class="w-full p-4 text-center">
          <div class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/20">
            {config.icon}
          </div>
          <h3 class="mb-2 font-semibold text-lg text-white">{config.title}</h3>
          <p class="mb-4 text-sm opacity-60">{config.description}</p>
          <div
            class={`rounded-lg border ${config.borderColor} ${config.bgColor} mx-auto mb-4 max-w-md p-3`}
          >
            <p class="font-medium text-blue-300 text-sm">
              {props.error.name || "Query Error"}
            </p>
            <p class="mt-1 break-words text-blue-400 text-xs">
              {props.error.message || "A data loading error occurred"}
            </p>
          </div>
          <GlassButton
            disabled={isRetrying()}
            onClick={handleRetry}
            variant="solid"
          >
            <RefreshCw
              class={`mr-2 h-4 w-4 ${isRetrying() ? "animate-spin" : ""}`}
            />
            {isRetrying() ? "Retrying..." : "Retry"}
          </GlassButton>
        </div>
      </Match>

      <Match when={props.context === "component"}>
        <div class="w-full p-4 text-center">
          <div class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/20">
            {config.icon}
          </div>
          <h3 class="mb-2 font-semibold text-lg text-white">{config.title}</h3>
          <p class="mb-4 text-sm opacity-60">{config.description}</p>
          <div
            class={`rounded-lg border ${config.borderColor} ${config.bgColor} mx-auto mb-4 max-w-md p-3`}
          >
            <p class="font-medium text-purple-300 text-sm">
              {props.error.name || "Component Error"}
            </p>
            <p class="mt-1 break-words text-purple-400 text-xs">
              {props.error.message || "A component error occurred"}
            </p>
          </div>
          <div class="flex flex-col justify-center gap-3 sm:flex-row">
            <GlassButton
              disabled={isRetrying()}
              onClick={handleRetry}
              variant="solid"
            >
              <RefreshCw
                class={`mr-2 h-4 w-4 ${isRetrying() ? "animate-spin" : ""}`}
              />
              {isRetrying() ? "Retrying..." : "Try Again"}
            </GlassButton>
            <GlassButton onClick={handleGoHome} variant="outline">
              <Home class="mr-2 h-4 w-4" />
              Go Home
            </GlassButton>
          </div>
        </div>
      </Match>

      <Match when={true}>
        <div class="flex min-h-screen items-center justify-center p-4">
          <div class="w-full max-w-lg space-y-6">
            {/* Error Icon and Title */}
            <div class="text-center">
              <div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
                {config.icon}
              </div>
              <h1 class="mb-2 font-bold text-2xl text-white">{config.title}</h1>
              <p class="text-sm opacity-60">{config.description}</p>
            </div>

            {/* Error Message */}
            <div
              class={`rounded-lg border ${config.borderColor} ${config.bgColor} p-4`}
            >
              <div class="space-y-2">
                <div class="flex items-start gap-3">
                  <AlertTriangle class="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
                  <div class="flex-1">
                    <p class="font-medium text-red-300 text-sm">
                      {props.error.name || "Application Error"}
                    </p>
                    <p class="mt-1 break-words text-red-400 text-xs">
                      {props.error.message || "An unexpected error occurred"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div class="flex flex-col gap-3 sm:flex-row">
              <GlassButton
                class="flex-1"
                disabled={isRetrying()}
                onClick={handleRetry}
                variant="solid"
              >
                <RefreshCw
                  class={`mr-2 h-4 w-4 ${isRetrying() ? "animate-spin" : ""}`}
                />
                {isRetrying() ? "Retrying..." : "Try Again"}
              </GlassButton>
              {config.showGoHome && (
                <GlassButton
                  class="flex-1"
                  onClick={handleGoHome}
                  variant="outline"
                >
                  <Home class="mr-2 h-4 w-4" />
                  Go Home
                </GlassButton>
              )}
            </div>

            {/* Error Details (Development Only) */}
            {import.meta.env.DEV && (
              <details class="text-left">
                <summary class="cursor-pointer text-xs opacity-60 transition-opacity hover:opacity-80">
                  Error Details (Development)
                </summary>
                <div
                  class={`mt-2 rounded-lg border ${config.borderColor} ${config.bgColor} p-3`}
                >
                  <pre class="whitespace-pre-wrap break-words font-mono text-red-400 text-xs">
                    {JSON.stringify(getErrorDetails(), null, 2)}
                  </pre>
                </div>
              </details>
            )}
          </div>
        </div>
      </Match>
    </Switch>
  );
}

// Specialized error boundaries for different contexts

export function AuthErrorBoundary(props: { children: JSX.Element }) {
  return (
    <ErrorBoundary
      context="auth"
      onError={(_error) => {
        // Error handling is managed by the error boundary state
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}

export function MediaErrorBoundary(props: { children: JSX.Element }) {
  return (
    <ErrorBoundary
      context="media"
      onError={(_error) => {
        // Error handling is managed by the error boundary state
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}

export function QueryErrorBoundary(props: { children: JSX.Element }) {
  return (
    <ErrorBoundary
      context="query"
      onError={(_error) => {
        // Error handling is managed by the error boundary state
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}

export function ComponentErrorBoundary(props: { children: JSX.Element }) {
  return (
    <ErrorBoundary
      context="component"
      onError={(_error) => {
        // Error handling is managed by the error boundary state
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}
