import { AlertTriangle, Home, RefreshCw } from 'lucide-solid';
import {
  createSignal,
  type ParentComponent,
  ErrorBoundary as SolidErrorBoundary,
} from 'solid-js';
import { GlassCard } from '~/components/ui';
import { GlassButton } from '~/components/ui/glass-button';

interface ErrorBoundaryProps {
  fallback?: (error: Error, reset: () => void) => JSX.Element;
  onError?: (error: Error, errorInfo: unknown) => void;
  children: JSX.Element;
}

export const ErrorBoundary: ParentComponent<ErrorBoundaryProps> = (props) => {
  return (
    <SolidErrorBoundary
      fallback={(error, reset) => {
        props.onError?.(error, { componentStack: 'No stack available' });

        if (props.fallback) {
          return props.fallback(error, reset);
        }

        return <DefaultErrorFallback error={error} reset={reset} />;
      }}
    >
      {props.children}
    </SolidErrorBoundary>
  );
};

interface DefaultErrorFallbackProps {
  error: Error;
  reset: () => void;
}

function DefaultErrorFallback(props: DefaultErrorFallbackProps) {
  const [isRetrying, setIsRetrying] = createSignal(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await props.reset();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const getErrorDetails = () => {
    try {
      return {
        name: props.error.name,
        message: props.error.message,
        stack: props.error.stack,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        name: 'Unknown Error',
        message: 'An unexpected error occurred',
        stack: null,
        timestamp: new Date().toISOString(),
      };
    }
  };

  return (
    <div class="flex min-h-screen items-center justify-center p-4">
      <div class="w-full max-w-lg space-y-6">
        {/* Error Icon and Title */}
        <div class="text-center">
          <div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
            <AlertTriangle class="h-8 w-8 text-red-400" />
          </div>
          <h1 class="mb-2 font-bold text-2xl text-white">
            Oops! Something went wrong
          </h1>
          <p class="text-sm opacity-60">
            We encountered an unexpected error. This has been logged and we'll
            look into it.
          </p>
        </div>

        {/* Error Message */}
        <GlassCard class="p-4" preset="card">
          <div class="space-y-2">
            <div class="flex items-start gap-3">
              <AlertTriangle class="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
              <div class="flex-1">
                <p class="font-medium text-red-300 text-sm">
                  {props.error.name || 'Application Error'}
                </p>
                <p class="mt-1 break-words text-red-400 text-xs">
                  {props.error.message || 'An unexpected error occurred'}
                </p>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Action Buttons */}
        <div class="flex flex-col gap-3 sm:flex-row">
          <GlassButton
            class="flex-1"
            disabled={isRetrying()}
            onClick={handleRetry}
            variant="glass"
          >
            <RefreshCw
              class={`mr-2 h-4 w-4 ${isRetrying() ? 'animate-spin' : ''}`}
            />
            {isRetrying() ? 'Retrying...' : 'Try Again'}
          </GlassButton>
          <GlassButton
            class="flex-1"
            onClick={handleGoHome}
            variant="glass-subtle"
          >
            <Home class="mr-2 h-4 w-4" />
            Go Home
          </GlassButton>
        </div>

        {/* Error Details (Development Only) */}
        {import.meta.env.DEV && (
          <details class="text-left">
            <summary class="cursor-pointer text-xs opacity-60 transition-opacity hover:opacity-80">
              Error Details (Development)
            </summary>
            <GlassCard class="mt-2 p-3" preset="card">
              <pre class="whitespace-pre-wrap break-words font-mono text-red-400 text-xs">
                {JSON.stringify(getErrorDetails(), null, 2)}
              </pre>
            </GlassCard>
          </details>
        )}
      </div>
    </div>
  );
}

// Specialized error boundaries for different contexts

export function AuthErrorBoundary(props: { children: JSX.Element }) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <AuthErrorFallback error={error} reset={reset} />
      )}
      onError={(_error) => {
        // Error handling is managed by the error boundary state
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}

function AuthErrorFallback(props: { error: Error; reset: () => void }) {
  return (
    <div class="mx-auto w-full max-w-md p-4">
      <GlassCard class="p-6 text-center" preset="card">
        <AlertTriangle class="mx-auto mb-4 h-12 w-12 text-red-400" />
        <h3 class="mb-2 font-semibold text-lg text-white">
          Authentication Error
        </h3>
        <p class="mb-4 text-sm opacity-60">
          {props.error.message || 'Failed to authenticate. Please try again.'}
        </p>
        <GlassButton class="w-full" onClick={props.reset} variant="glass">
          Try Again
        </GlassButton>
      </GlassCard>
    </div>
  );
}

export function MediaErrorBoundary(props: { children: JSX.Element }) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <MediaErrorFallback error={error} reset={reset} />
      )}
      onError={(_error) => {
        // Error handling is managed by the error boundary state
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}

function MediaErrorFallback(props: { error: Error; reset: () => void }) {
  return (
    <div class="w-full p-8 text-center">
      <div class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/20">
        <AlertTriangle class="h-6 w-6 text-yellow-400" />
      </div>
      <h3 class="mb-2 font-semibold text-lg text-white">Media Loading Error</h3>
      <p class="mb-4 text-sm opacity-60">
        {props.error.message || 'Failed to load media. Please try again.'}
      </p>
      <GlassButton onClick={props.reset} variant="glass">
        Retry
      </GlassButton>
    </div>
  );
}
