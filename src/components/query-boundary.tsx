import { ErrorBoundary, Match, Suspense, Switch } from 'solid-js';
import type { UseQueryResult } from '@tanstack/solid-query';
import type { JSX } from 'solid-js';
import { showToast } from './ui/toast';

export interface QueryBoundaryProps<T = unknown> {
  query: UseQueryResult<T, Error>;

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
  errorFallback?: (err: Error | null, retry: () => void) => JSX.Element;

  /**
   * Triggered when fetching is complete, and the returned data is not falsey.
   */
  children: (data: Exclude<T, null | false | undefined>) => JSX.Element;
}

/**
 * Convenience wrapper that handles suspense and errors for queries. Makes the results of query.data available to
 * children (as a render prop) in a type-safe way.
 */
export function QueryBoundary<T>(props: QueryBoundaryProps<T>) {
  return (
    <Suspense fallback={props.loadingFallback}>
      <ErrorBoundary
        fallback={(err: Error, reset) =>
          props.errorFallback ? (
            props.errorFallback(err, async () => {
              await props.query.refetch();
              reset();
            })
          ) : (
            <div>
              <div class="error">{err.message}</div>
              <button
                onClick={async () => {
                  await props.query.refetch();
                  reset();
                }}
              >
                retry
              </button>
            </div>
          )
        }
      >
        <Switch>
          <Match when={props.query.isError}>
            {(() => {
              const error = props.query.error;
              if (error) {
                showToast({
                  message: error.message || 'An error occurred',
                  type: 'error',
                  duration: 5000,
                });
              }
              return props.errorFallback ? (
                props.errorFallback(error, props.query.refetch)
              ) : (
                <div class="p-4 text-center">
                  <div class="text-red-500 mb-2">
                    {error?.message || 'An error occurred'}
                  </div>
                  <button
                    onClick={() => {
                      props.query.refetch();
                    }}
                    class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              );
            })()}
          </Match>

          <Match when={props.query.isFetched && !props.query.data}>
            {props.notFoundFallback ? (
              props.notFoundFallback
            ) : (
              <div>not found</div>
            )}
          </Match>

          <Match when={!props.query.isFetched && !props.query.data}>
            {props.notStartedFallback ? props.notStartedFallback : <></>}
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
