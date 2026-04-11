import type { UseQueryResult } from "@tanstack/solid-query";
import { AlertCircle, RefreshCw, SearchX } from "lucide-solid";
import type { JSX } from "solid-js";
import { ErrorBoundary, Match, Suspense, Switch } from "solid-js";
import { cn } from "~/lib/utils";

export type QueryBoundaryProps<E, T = unknown> = {
  query: UseQueryResult<T, E>;

  /**
   * Triggered when the data is initially loading.
   */
  loadingFallback?: JSX.Element;

  /**
   * Triggered when fetching is complete, but the returned data was falsey.
   */
  notFoundFallback?: JSX.Element;

  /**
   * Triggered when fetching is not started, but the returned data was falsey.
   */
  notStartedFallback?: JSX.Element;

  /**
   * Triggered when the query results in an error.
   */
  errorFallback?: (err: E | null, retry: () => void) => JSX.Element;

  /**
   * Triggered when fetching is complete, and the returned data is not falsey.
   */
  children: (data: Exclude<T, null | false | undefined>) => JSX.Element;
};

// ── Inline not-found surface ──────────────────────────────────────────────────
function DefaultNotFound() {
  return (
    <div
      class={cn(
        "flex flex-col items-center gap-3 rounded-xl py-12 text-center",
        "border border-white/[0.06] bg-white/[0.03]"
      )}
      style={{
        animation: "fadeSlideUp 300ms cubic-bezier(0.22,1,0.36,1) both",
      }}
    >
      <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/[0.08] ring-inset">
        <SearchX class="h-5 w-5 text-white/40" />
      </div>
      <div class="space-y-1">
        <p class="font-medium text-sm text-white/60">Nothing here</p>
        <p class="text-white/30 text-xs">No results were found.</p>
      </div>
    </div>
  );
}

// ── Inline error surface ──────────────────────────────────────────────────────
function DefaultError(props: { message?: string; onRetry: () => void }) {
  return (
    <div
      class={cn(
        "flex flex-col items-center gap-4 rounded-xl px-6 py-10 text-center",
        "border border-red-500/[0.15] bg-red-500/[0.04]"
      )}
      style={{
        animation: "fadeSlideUp 300ms cubic-bezier(0.22,1,0.36,1) both",
      }}
    >
      <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500/[0.12] ring-1 ring-red-500/[0.2] ring-inset">
        <AlertCircle class="h-5 w-5 text-red-400" />
      </div>
      <div class="space-y-1">
        <p class="font-medium text-sm text-white/70">Something went wrong</p>
        <p class="max-w-xs break-words text-red-400/70 text-xs">
          {props.message || "An unexpected error occurred."}
        </p>
      </div>
      <button
        class={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-4 py-2",
          "border border-white/[0.1] bg-white/[0.07] text-sm text-white/80",
          "transition-all duration-150",
          "hover:border-amber-400/40 hover:bg-amber-400/[0.08] hover:text-white",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 focus-visible:outline-offset-2",
          "active:scale-95"
        )}
        onClick={props.onRetry}
        type="button"
      >
        <RefreshCw class="h-3.5 w-3.5" />
        Retry
      </button>
    </div>
  );
}

// ── Switch-fallback stub ──────────────────────────────────────────────────────
function SwitchFallback() {
  return <div class="z-50" />;
}

/**
 * Convenience wrapper that handles suspense and errors for queries.
 * Makes the results of query.data available to children (render-prop)
 * in a type-safe way, and renders polished inline fallback surfaces.
 */
export function QueryBoundary<T, E>(props: QueryBoundaryProps<E, T>) {
  return (
    <Suspense fallback={props.loadingFallback}>
      <ErrorBoundary
        fallback={(err: E, reset) =>
          props.errorFallback ? (
            props.errorFallback(err, async () => {
              await props.query.refetch();
              reset();
            })
          ) : (
            <DefaultError
              message={(err as { message?: string })?.message}
              onRetry={async () => {
                await props.query.refetch();
                reset();
              }}
            />
          )
        }
      >
        <Switch fallback={<SwitchFallback />}>
          <Match when={props.query.isFetched && !props.query.data}>
            {props.notFoundFallback ? (
              props.notFoundFallback
            ) : (
              <DefaultNotFound />
            )}
          </Match>

          <Match when={props.query.isError}>
            {(() => {
              const error = props.query.error;
              return props.errorFallback ? (
                props.errorFallback(error as E, props.query.refetch)
              ) : (
                <DefaultError
                  message={
                    (error as { message?: string } | null)?.message ?? undefined
                  }
                  onRetry={props.query.refetch}
                />
              );
            })()}
          </Match>

          <Match when={!(props.query.isFetched || Boolean(props.query.data))}>
            {props.notStartedFallback ? props.notStartedFallback : <div />}
          </Match>

          <Match when={props.query.data}>
            {props.children(
              props.query.data as Exclude<T, null | false | undefined>
            )}
          </Match>
        </Switch>
      </ErrorBoundary>
    </Suspense>
  );
}
