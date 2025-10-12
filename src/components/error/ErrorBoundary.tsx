import { ErrorBoundary as SolidErrorBoundary, createSignal, ParentComponent } from 'solid-js';
import { AlertTriangle, RefreshCw, Home } from 'lucide-solid';
import { GlassCard } from '~/components/ui';
import { GlassButton } from '~/components/ui/glass-button';
import { AppError } from '~/types';

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
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="w-full max-w-lg space-y-6">
        {/* Error Icon and Title */}
        <div class="text-center">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-4">
            <AlertTriangle class="w-8 h-8 text-red-400" />
          </div>
          <h1 class="text-2xl font-bold text-white mb-2">
            Oops! Something went wrong
          </h1>
          <p class="text-sm opacity-60">
            We encountered an unexpected error. This has been logged and we'll look into it.
          </p>
        </div>

        {/* Error Message */}
        <GlassCard preset="card" class="p-4">
          <div class="space-y-2">
            <div class="flex items-start gap-3">
              <AlertTriangle class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div class="flex-1">
                <p class="text-sm font-medium text-red-300">
                  {props.error.name || 'Application Error'}
                </p>
                <p class="text-xs text-red-400 mt-1 break-words">
                  {props.error.message || 'An unexpected error occurred'}
                </p>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Action Buttons */}
        <div class="flex flex-col sm:flex-row gap-3">
          <GlassButton
            variant="glass"
            class="flex-1"
            onClick={handleRetry}
            disabled={isRetrying()}
          >
            <RefreshCw class={`w-4 h-4 mr-2 ${isRetrying() ? 'animate-spin' : ''}`} />
            {isRetrying() ? 'Retrying...' : 'Try Again'}
          </GlassButton>
          <GlassButton
            variant="glass-subtle"
            class="flex-1"
            onClick={handleGoHome}
          >
            <Home class="w-4 h-4 mr-2" />
            Go Home
          </GlassButton>
        </div>

        {/* Error Details (Development Only) */}
        {import.meta.env.DEV && (
          <details class="text-left">
            <summary class="cursor-pointer text-xs opacity-60 hover:opacity-80 transition-opacity">
              Error Details (Development)
            </summary>
            <GlassCard preset="card" class="mt-2 p-3">
              <pre class="text-xs text-red-400 whitespace-pre-wrap break-words font-mono">
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
      onError={(error) => {
        console.error('Authentication Error:', error);
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}

function AuthErrorFallback(props: { error: Error; reset: () => void }) {
  return (
    <div class="w-full max-w-md mx-auto p-4">
      <GlassCard preset="card" class="p-6 text-center">
        <AlertTriangle class="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 class="text-lg font-semibold text-white mb-2">
          Authentication Error
        </h3>
        <p class="text-sm opacity-60 mb-4">
          {props.error.message || 'Failed to authenticate. Please try again.'}
        </p>
        <GlassButton
          variant="glass"
          class="w-full"
          onClick={props.reset}
        >
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
      onError={(error) => {
        console.error('Media Loading Error:', error);
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}

function MediaErrorFallback(props: { error: Error; reset: () => void }) {
  return (
    <div class="w-full p-8 text-center">
      <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-yellow-500/20 mb-4">
        <AlertTriangle class="w-6 h-6 text-yellow-400" />
      </div>
      <h3 class="text-lg font-semibold text-white mb-2">
        Media Loading Error
      </h3>
      <p class="text-sm opacity-60 mb-4">
        {props.error.message || 'Failed to load media. Please try again.'}
      </p>
      <GlassButton
        variant="glass"
        onClick={props.reset}
      >
        Retry
      </GlassButton>
    </div>
  );
}