import type { RecommendedServerInfo } from "@jellyfin/sdk";
import { useNavigate } from "@solidjs/router";
import { Effect } from "effect";
import { createSignal } from "solid-js";
import {
  createEffectMutation,
  createEffectQuery,
  createQueryDataHelpers,
  createQueryKey,
  queryClient,
} from "~/effect/tanstack/query";
import { showErrorToast, showSuccessToast } from "~/lib/toast";
import { JellyfinClientService } from "../jellyfin/client";
import { AuthService } from ".";

export const currentUserKey = createQueryKey("currentUser");
export const currentUserDataHelpers = createQueryDataHelpers(currentUserKey);

export const useCurrentUserQuery = () => {
  const navigate = useNavigate();
  return createEffectQuery(() => ({
    queryKey: currentUserKey(),
    queryFn: () =>
      AuthService.pipe(
        Effect.flatMap((auth) => auth.getUser()),
        Effect.catchTag("NoUserFound", (e) => {
          navigate("/auth/new");
          return Effect.fail(e);
        })
      ),
  }));
};

export const currentServerKey = createQueryKey("currentServer");
export const currentServerDataHelpers =
  createQueryDataHelpers(currentServerKey);

export const useCurrentServerQuery = () =>
  createEffectQuery(() => ({
    queryKey: currentServerKey(),
    queryFn: () => AuthService.pipe(Effect.flatMap((auth) => auth.getServer())),
  }));

export const useLoginMutation = () => {
  const navigate = useNavigate();
  return createEffectMutation(() => ({
    mutationFn: (variables: {
      username: string;
      password: string;
      server: RecommendedServerInfo;
    }) =>
      AuthService.pipe(
        Effect.flatMap((auth) =>
          Effect.gen(function* () {
            yield* auth.login(
              variables.server,
              variables.username,
              variables.password
            );

            yield* auth.setPassword(
              variables.server,
              variables.username,
              variables.password
            );
          })
        ),
        Effect.catchAll((e) => {
          showErrorToast(e.message || e._tag || "Error while Loggin");
          return Effect.fail(e);
        }),
        Effect.flatMap(() =>
          JellyfinClientService.pipe(
            Effect.flatMap((client) =>
              client.addUser(variables.server, variables.username)
            )
          )
        ),
        Effect.catchTag("NoFieldFound", (e) => {
          showErrorToast(e.message || e._tag || "Error while Loggin");
          return Effect.fail(e);
        }),
        Effect.tap(() =>
          Effect.promise(async () => {
            await currentUserDataHelpers.invalidateAllQueries();
            await currentServerDataHelpers.invalidateAllQueries();
          })
        ),
        Effect.tap(() =>
          Effect.sync(() => {
            showSuccessToast(`Successfully Logged in, ${variables.username}`);
            navigate("/");
          })
        )
      ),
  }));
};

export const useLoginBySelectionMutation = () => {
  const navigate = useNavigate();
  const [step, setStep] = createSignal<
    "idle" | "password" | "authenticating" | "logged-in" | "error"
  >("idle");

  const invalidateQueries = async () => {
    await currentUserDataHelpers.invalidateAllQueries();
    await currentServerDataHelpers.invalidateAllQueries();
  };

  return [
    createEffectMutation(() => ({
      mutationKey: ["loginBySelection"],
      mutationFn: (variables: {
        username: string;
        server: RecommendedServerInfo;
      }) =>
        Effect.gen(function* () {
          setStep("password");

          const auth = yield* AuthService;
          const password = yield* auth.getPassword(
            variables.server,
            variables.username
          );

          setStep("authenticating");

          yield* auth.login(variables.server, variables.username, password);

          setStep("logged-in");

          yield* Effect.promise(async () => {
            await invalidateQueries();
          });

          yield* Effect.sync(() => {
            showSuccessToast(`Successfully Logged in, ${variables.username}`);
            navigate("/");
          });
        }).pipe(
          Effect.catchAll((e) =>
            Effect.gen(function* () {
              setStep("error");
              showErrorToast(e.message || e._tag || "Error while Loggin In");
              return yield* Effect.fail(e);
            })
          )
        ),
    })),
    step,
  ] as const;
};

export const useLogoutMutation = () => {
  const navigate = useNavigate();
  return createEffectMutation(() => ({
    mutationFn: () =>
      AuthService.pipe(
        Effect.flatMap((auth) => auth.logout()),
        Effect.tap(() =>
          Effect.promise(async () => {
            await currentUserDataHelpers.invalidateAllQueries();
            await currentServerDataHelpers.invalidateAllQueries();
            queryClient.clear();

            showSuccessToast("Logged Out");
            navigate("/auth/new");
          })
        )
      ),
  }));
};
