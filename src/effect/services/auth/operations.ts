import type { RecommendedServerInfo } from "@jellyfin/sdk";
import { useNavigate } from "@solidjs/router";
import { useQueryClient } from "@tanstack/solid-query";
import { Effect } from "effect";
import { createSignal } from "solid-js";
import {
  createEffectMutation,
  createEffectQuery,
  createQueryDataHelpers,
  createQueryKey,
} from "~/effect/tanstack/query";
import { showErrorToast, showSuccessToast } from "~/lib/toast";
import { JellyfinClientService } from "../jellyfin/client";
import { AuthService } from ".";

class AuthOperationsClass {
  /*
   *
   * User Methods
   *
   */

  currentUserKey = createQueryKey("currentUser");
  currentUserDataHelpers = createQueryDataHelpers(this.currentUserKey);

  currentUser = () => {
    const navigate = useNavigate();
    return createEffectQuery(() => ({
      queryKey: this.currentUserKey(),
      queryFn: () =>
        AuthService.pipe(
          Effect.flatMap((auth) => auth.getUser()),
          Effect.catchTag("NoUserFound", (e) => {
            // this.navigate()("/auth/new");
            navigate("/auth/new");
            return Effect.fail(e);
          })
        ),
    }));
  };

  /*
   *
   * Server Methods
   *
   */

  currentServerKey = createQueryKey("currentServer");
  currentServerDataHelpers = createQueryDataHelpers(this.currentServerKey);

  currentServer = () =>
    createEffectQuery(() => ({
      queryKey: this.currentServerKey(),
      queryFn: () =>
        AuthService.pipe(Effect.flatMap((auth) => auth.getServer())),
    }));

  /*
   *
   * Auth Methods
   *
   */

  login = () => {
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
              await this.currentUserDataHelpers.invalidateAllQueries();
              await this.currentServerDataHelpers.invalidateAllQueries();
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

  loginBySelection = () => {
    const navigate = useNavigate();
    const [step, setStep] = createSignal<
      "idle" | "password" | "authenticating" | "logged-in" | "error"
    >("idle");

    const invalidateQueries = async () => {
      await this.currentUserDataHelpers.invalidateAllQueries();
      await this.currentServerDataHelpers.invalidateAllQueries();
    };

    return [
      createEffectMutation(() => ({
        mutationKey: ["loginBySelection"],
        mutationFn: (variables: {
          username: string;
          server: RecommendedServerInfo;
        }) =>
          Effect.gen(function* () {
            // Set password stage
            setStep("password");

            const auth = yield* AuthService;
            const password = yield* auth.getPassword(
              variables.server,
              variables.username
            );

            // Set authenticating stage
            setStep("authenticating");

            yield* auth.login(variables.server, variables.username, password);

            // Set logged-in stage
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

  logout = () => {
    const navigate = useNavigate();
    const qc = useQueryClient();
    return createEffectMutation(() => ({
      mutationFn: () =>
        AuthService.pipe(
          Effect.flatMap((auth) => auth.logout()),
          Effect.tap(() =>
            Effect.promise(async () => {
              await this.currentUserDataHelpers.invalidateAllQueries();
              await this.currentServerDataHelpers.invalidateAllQueries();
              qc.clear();

              navigate("/auth/new");
              showSuccessToast("Logged Out");
            })
          )
        ),
    }));
  };
}

export const AuthOperations = new AuthOperationsClass();
