/** biome-ignore-all lint/correctness/noNestedComponentDefinitions: No Nested */
import type { RecommendedServerInfo } from "@jellyfin/sdk";
import { useNavigate } from "@solidjs/router";
import { useQueryClient } from "@tanstack/solid-query";
import { Effect } from "effect";
import {
  type Component,
  type ComponentProps,
  createSignal,
  For,
  Match,
  Show,
  Suspense,
  Switch,
  splitProps,
} from "solid-js";
import { createStore, type SetStoreFunction } from "solid-js/store";
import { AuthOperations } from "~/effect/services/auth/operations";
import { useAuth } from "~/effect/services/hooks/use-auth";
import { JellyfinClientService } from "~/effect/services/jellyfin/client";
import {
  createEffectMutation,
  createEffectQuery,
} from "~/effect/tanstack/query";
import { showErrorToast, showSuccessToast } from "~/lib/toast";
import { cn } from "~/lib/utils";
import ArrowSmallLeft from "~icons/heroicons/arrow-small-left";
import ArrowSmallRight from "~icons/heroicons/arrow-small-right";
import LockClosed from "~icons/heroicons/lock-closed";
import Finder from "~icons/heroicons/magnifying-glass";
import Server from "~icons/heroicons/server";
import ServerStack from "~icons/heroicons/server-stack";
import Trash from "~icons/heroicons/trash";
import User from "~icons/heroicons/user";
import UserGroup from "~icons/heroicons/user-group";

type AuthStage =
  | "server-selection"
  | "server-search"
  | "user-selection"
  | "user-login";

type AuthSteps = {
  stage: AuthStage;
  payload: RecommendedServerInfo | null;
};

export default function Home() {
  const [step, setStep] = createStore<AuthSteps>({
    stage: "server-selection",
    payload: null,
  });

  createEffectQuery(() => ({
    queryKey: ["getServers"],
    queryFn: () =>
      JellyfinClientService.pipe(
        Effect.flatMap((client) => client.getServers()),
        Effect.tap(
          (data) => data.length === 0 && setStep("stage", "server-search")
        )
      ),
  }));

  return (
    <section class="grid h-full w-full place-items-center bg-background">
      <Suspense>
        <Switch>
          <Match when={step.stage === "server-selection"}>
            <ServerSelection setStage={setStep} />
          </Match>
          <Match when={step.stage === "server-search"}>
            <ServerSearch setStage={setStep} />
          </Match>
          <Match when={step.stage === "user-selection"}>
            <Show when={step.payload}>
              <UserSelection
                server={step.payload as RecommendedServerInfo}
                setStage={setStep}
              />
            </Show>
          </Match>
          <Match when={step.stage === "user-login"}>
            <Show when={step.payload}>
              <UserLogin
                server={step.payload as RecommendedServerInfo}
                setStage={setStep}
              />
            </Show>
          </Match>
        </Switch>
      </Suspense>
    </section>
  );
}

/*
 *
 *
 * User Stages
 *
 */

const UserCard = (
  props: ComponentProps<"button"> & {
    user: string;
    server: RecommendedServerInfo;
    stage?: string;
  }
) => {
  const qc = useQueryClient();
  const [{ class: className, user, server }, other] = splitProps(props, [
    "class",
    "user",
    "server",
  ]);

  const removeUser = createEffectMutation(() => ({
    mutationKey: ["removeUser"],
    mutationFn: (variables: { server: RecommendedServerInfo; user: string }) =>
      JellyfinClientService.pipe(
        Effect.flatMap((client) =>
          client.removeUser(variables.server, variables.user)
        ),
        Effect.catchTag("NoFieldFound", (e) => {
          showErrorToast("No Field Found");
          return Effect.fail(e);
        }),
        Effect.tap(() =>
          Effect.promise(async () => {
            await qc.invalidateQueries({
              queryKey: [
                "getUsers",

                {
                  serverId: props.server.systemInfo?.Id,
                },
              ],
            });
            showSuccessToast("Successfully Removed User");
          })
        )
      ),
  }));

  return (
    <button
      class={cn(
        "flex w-96 items-center gap-x-4 overflow-hidden rounded border-2 bg-border p-4 px-6",
        className
      )}
      {...other}
    >
      <User class="h-6 w-6 text-orange-600" />
      <div class="flex-1">
        <h1 class="text-justify">{user}</h1>
        <Show when={props.stage}>
          <div class="flex items-center gap-2 text-muted-foreground">
            <div class="text-xs">{props.stage}</div>
          </div>
        </Show>
      </div>
      <div
        class="grid place-items-center rounded p-2 hover:bg-muted/80"
        onClick={(e) => {
          e.stopPropagation();
          removeUser.mutate({ server, user });
        }}
        role="button"
      >
        <Trash class="h-5 w-5 text-red-400" />
      </div>
    </button>
  );
};

const Input = (
  props: ComponentProps<"input"> & {
    icon: Component<ComponentProps<"svg">>;
  }
) => {
  const Icon = props.icon;
  return (
    <div class="flex h-12 w-full items-center gap-4 rounded bg-border px-4">
      <Icon class="h-6 w-6 text-muted-foreground" />
      <input
        class="flex-1 text-muted-foreground caret-muted-foreground outline-none"
        {...props}
      />
    </div>
  );
};

const UserSelection = (props: {
  server: RecommendedServerInfo;
  setStage?: SetStoreFunction<AuthSteps>;
}) => {
  const users = createEffectQuery(() => ({
    queryKey: [
      "getUsers",
      {
        serverId: props.server.systemInfo?.Id,
      },
    ],
    queryFn: () =>
      JellyfinClientService.pipe(
        Effect.flatMap((client) => client.getUsers(props.server))
      ),
  }));

  return (
    <div class="flex flex-col items-center justify-center space-y-10">
      <UserGroup class="h-20 w-20 text-orange-600" />
      <div>
        <ServerFinderCard class="border-orange-600" server={props.server} />
      </div>
      <div class="button-group space-y-4">
        <For each={users.data}>
          {(user) => {
            const [loginBySelection, step] = AuthOperations.loginBySelection();

            const styleStep = (stage: ReturnType<typeof step>) => {
              switch (stage) {
                case "idle":
                  return;
                case "password":
                  return "Getting Password";
                case "authenticating":
                  return "Loggin In";
                case "logged-in":
                  return "Logged In";
                case "error":
                  return "Error";
                default:
                  break;
              }
            };

            return (
              <UserCard
                class="cursor-pointer peer-data-[action=true]:pointer-events-none"
                data-action={!["idle", "error"].includes(step())}
                onClick={() =>
                  loginBySelection.mutate({
                    username: user,
                    server: props.server,
                  })
                }
                server={props.server}
                stage={styleStep(step())}
                user={user}
              />
            );
          }}
        </For>
      </div>
      <div class="w-96 space-y-4 overflow-hidden">
        <button
          class="flex w-full cursor-pointer items-center justify-center gap-4 rounded bg-orange-600 p-2 text-white transition-all hover:gap-6"
          onClick={() => props.setStage?.("stage", "user-login")}
        >
          <div class="flex items-center gap-2">
            <ServerStack class="h-4 w-4 text-orange-600" />
            <span class="text-sm">Login</span>
          </div>
          <ArrowSmallRight class="h-6 w-6" />
        </button>
        <button
          class="flex w-full cursor-pointer items-center justify-center gap-4 p-2 text-orange-600 transition-all hover:gap-6"
          onClick={() => props.setStage?.("stage", "server-selection")}
        >
          <ArrowSmallLeft class="h-6 w-6" />
          <div class="flex items-center gap-2">
            <ServerStack class="h-4 w-4 text-orange-600" />
            <span class="text-sm">Added servers</span>
          </div>
        </button>
      </div>
    </div>
  );
};

const UserLogin = (props: {
  server: RecommendedServerInfo;
  setStage?: SetStoreFunction<AuthSteps>;
}) => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { login } = useAuth();
  const [loginStore, setLoginStore] = createStore({
    username: "",
    password: "",
  });

  const users = createEffectQuery(() => ({
    queryKey: [
      "getUsers",
      {
        serverId: props.server.systemInfo?.Id,
      },
    ],
    queryFn: () =>
      JellyfinClientService.pipe(
        Effect.flatMap((client) => client.getUsers(props.server))
      ),
  }));

  // const login = createEffectMutation(() => ({
  //   mutationKey: ["login"],
  //   mutationFn: (variables: { username: string; password: string }) =>
  //     AuthService.pipe(
  //       Effect.flatMap((auth) =>
  //         Effect.gen(function* () {
  //           yield* auth.login(
  //             props.server,
  //             variables.username,
  //             variables.password
  //           );
  //
  //           yield* auth.setPassword(
  //             props.server,
  //             variables.username,
  //             variables.password
  //           );
  //         })
  //       ),
  //       Effect.catchAll((e) => {
  //         showErrorToast(e.message || e._tag || "Error while Loggin");
  //         return Effect.fail(e);
  //       }),
  //       Effect.flatMap(() =>
  //         JellyfinClientService.pipe(
  //           Effect.flatMap((client) =>
  //             client.addUser(props.server, variables.username)
  //           )
  //         )
  //       ),
  //       Effect.catchTag("NoFieldFound", (e) => {
  //         showErrorToast(e.message || e._tag || "Error while Loggin");
  //         return Effect.fail(e);
  //       }),
  //       Effect.tap(() =>
  //         Effect.promise(async () => {
  //           await qc.invalidateQueries({
  //             queryKey: ["currentUser", "currentServer"],
  //           });
  //           await qc.invalidateQueries({
  //             predicate: (query) => query.queryKey.includes(variables.username),
  //           });
  //         })
  //       ),
  //       Effect.tap(() =>
  //         Effect.sync(() => {
  //           showSuccessToast(`Successfully Logged in, ${variables.username}`);
  //           navigate("/");
  //         })
  //       )
  //     ),
  // }));

  return (
    <div class="flex flex-col items-center justify-center space-y-10">
      <User class="h-18 w-18 text-orange-600" />
      <div>
        <ServerFinderCard class="border-orange-600" server={props.server} />
      </div>
      <div class="w-full space-y-4">
        <Input
          icon={User}
          onChange={(e) => setLoginStore("username", e.target.value)}
          placeholder="Username"
          value={loginStore.username}
        />
        <Input
          icon={LockClosed}
          onChange={(e) => setLoginStore("password", e.target.value)}
          placeholder="*********"
          type="password"
          value={loginStore.password}
        />
      </div>
      <button
        class="flex w-full cursor-pointer items-center justify-center gap-4 rounded bg-orange-600 p-2 text-white transition-all hover:gap-6"
        onClick={() => {
          // login
          login.mutate({
            username: loginStore.username,
            password: loginStore.password,
            server: props.server,
          });
        }}
      >
        <div class="flex items-center gap-2">
          <span class="text-sm">Login</span>
        </div>
        <ArrowSmallRight class="h-6 w-6" />
      </button>
      <Show when={!users.data?.length}>
        <button
          class="flex cursor-pointer items-center gap-4 text-orange-600 transition-all hover:gap-6"
          onClick={() => props.setStage?.("stage", "server-selection")}
        >
          <ArrowSmallLeft class="h-6 w-6" />
          <div class="flex items-center gap-2">
            <ServerStack class="h-4 w-4 text-orange-600" />
            <span class="text-sm">Added Server</span>
          </div>
        </button>
      </Show>
      <Show when={users.data?.length}>
        <button
          class="flex cursor-pointer items-center gap-4 text-orange-600 transition-all hover:gap-6"
          onClick={() => props.setStage?.("stage", "user-selection")}
        >
          <ArrowSmallRight class="h-6 w-6" />
          <div class="flex items-center gap-2">
            <UserGroup class="h-4 w-4 text-orange-600" />
            <span class="text-sm">Users</span>
          </div>
        </button>
      </Show>
    </div>
  );
};

/*
 *
 *
 * Server Stages
 *
 */

const ServerSearch = (props: { setStage?: SetStoreFunction<AuthSteps> }) => {
  const [url, setUrl] = createSignal<string>("");

  const servers = createEffectQuery(() => ({
    queryKey: ["getServers"],
    queryFn: () =>
      JellyfinClientService.pipe(
        Effect.flatMap((client) => client.getServers())
      ),
  }));

  const searchServers = createEffectQuery(() => ({
    queryKey: [
      "searchServers",
      {
        url: url(),
      },
    ],
    queryFn: () =>
      JellyfinClientService.pipe(
        Effect.flatMap((client) => client.searchServers(url()))
      ),
  }));

  const addServers = createEffectMutation(() => ({
    mutationKey: ["addServers"],
    mutationFn: (server: RecommendedServerInfo) =>
      JellyfinClientService.pipe(
        Effect.flatMap((client) => client.addServer(server)),
        Effect.tap(() => {
          if (props.setStage) {
            props?.setStage("stage", "server-selection");
          }
        })
      ),
  }));

  return (
    <div class="flex flex-col items-center justify-center space-y-10">
      <ServerStack class="h-18 w-18 text-orange-600" />
      <div class="w-96">
        <ServerInputSearch
          onChange={(e) => setUrl(e.target.value)}
          value={url() || ""}
        />
      </div>

      <Suspense>
        <Show when={searchServers.data?.length}>
          <div class="space-y-4">
            <For each={searchServers.data}>
              {(server) => (
                <ServerFinderCard
                  onClick={() => {
                    if (!server.systemInfo?.Id) {
                      showErrorToast("Invalid Server");
                      return;
                    }
                    // add the server
                    addServers.mutate(server);
                  }}
                  server={server}
                />
              )}
            </For>
          </div>
        </Show>
      </Suspense>

      <Show when={servers.data?.length}>
        <button
          class="flex cursor-pointer items-center gap-4 text-orange-600 transition-all hover:gap-6"
          onClick={() => props.setStage?.("stage", "server-selection")}
        >
          <ArrowSmallLeft class="h-6 w-6" />
          <div class="flex items-center gap-2">
            <ServerStack class="h-4 w-4 text-orange-600" />
            <span class="text-sm">Added servers</span>
          </div>
        </button>
      </Show>
    </div>
  );
};

const ServerSelection = (props: { setStage?: SetStoreFunction<AuthSteps> }) => {
  const servers = createEffectQuery(() => ({
    queryKey: ["getServers"],
    queryFn: () =>
      JellyfinClientService.pipe(
        Effect.flatMap((client) => client.getServers())
      ),
  }));

  return (
    <div class="flex flex-col items-center justify-center space-y-10">
      <ServerStack class="h-18 w-18 text-orange-600" />

      <Show when={servers.data?.length}>
        <div class="space-y-4">
          <For each={servers.data}>
            {(server) => (
              <ServerCard
                onClick={() => {
                  props.setStage?.("stage", "user-selection");
                  props.setStage?.("payload", server);
                }}
                server={server}
              />
            )}
          </For>
        </div>
      </Show>
      <div>
        <button
          class="flex cursor-pointer items-center gap-4 text-orange-600 transition-all hover:gap-6"
          onClick={() => props?.setStage?.("stage", "server-search")}
        >
          <div class="flex items-center gap-2">
            <Finder class="h-4 w-4 text-orange-600" />
            <span class="text-sm">Search Server</span>
          </div>
          <ArrowSmallLeft class="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};

const ServerInputSearch = (props: ComponentProps<"input">) => (
  <div class="flex h-12 w-full items-center gap-4 rounded bg-border px-4">
    <Server class="h-6 w-6 text-muted-foreground" />
    <input
      class="flex-1 text-muted-foreground caret-muted-foreground outline-none"
      placeholder="Server Address"
      {...props}
    />
    <Finder class="h-6 w-6 text-muted-foreground" />
  </div>
);

const ServerFinderCard = (
  props: ComponentProps<"button"> & {
    server: RecommendedServerInfo;
  }
) => {
  const [{ class: className, server }, other] = splitProps(props, [
    "class",
    "server",
  ]);
  return (
    <button
      class={cn(
        "flex w-96 cursor-pointer items-center gap-x-4 overflow-hidden rounded border-2 bg-border p-4 px-6",
        className
      )}
      {...other}
    >
      <Server class="h-6 w-6 text-orange-600" />
      <div class="flex-1">
        <h1 class="text-justify">{server.systemInfo?.ServerName}</h1>
        <div class="flex items-center gap-2 text-muted-foreground">
          <div class="text-xs">{server.address}</div>
        </div>
      </div>
    </button>
  );
};

const ServerCard = (
  props: ComponentProps<"button"> & {
    server: RecommendedServerInfo;
  }
) => {
  const qc = useQueryClient();
  const [{ class: className, server }, other] = splitProps(props, [
    "class",
    "server",
  ]);
  const removeServer = createEffectMutation(() => ({
    mutationKey: ["removeServer"],
    mutationFn: (server: RecommendedServerInfo) =>
      JellyfinClientService.pipe(
        Effect.flatMap((client) => client.removeServer(server)),
        Effect.catchTag("NoFieldFound", (e) => {
          showErrorToast("No Field Found");
          return Effect.fail(e);
        }),
        Effect.tap(() =>
          Effect.promise(async () => {
            await qc.invalidateQueries({ queryKey: ["getServers"] });
            showSuccessToast("Successfully Removed Server");
          })
        )
      ),
  }));
  return (
    <button
      class={cn(
        "flex w-96 cursor-pointer items-center gap-x-4 overflow-hidden rounded border-2 bg-border p-4 px-6",
        className
      )}
      {...other}
    >
      <Server class="h-6 w-6 text-orange-600" />
      <div class="flex-1">
        <h1 class="text-justify">{server.systemInfo?.ServerName}</h1>
        <div class="flex items-center gap-2 text-muted-foreground">
          <div class="text-xs">{server.address}</div>
          {/* <Show when={props.users}> */}
          {/*   <span class="h-0.5 w-0.5 rounded-4xl bg-primary/50" /> */}
          {/*   <div class="text-xs">{props.users} users</div> */}
          {/* </Show> */}
        </div>
      </div>
      <div
        class="grid place-items-center rounded p-2 hover:bg-muted/80"
        onClick={(e) => {
          e.stopPropagation();
          removeServer.mutate(props.server);
        }}
        role="button"
      >
        <Trash class="h-5 w-5 text-red-400" />
      </div>
      {/* <div> */}
      {/*   <Icon */}
      {/*     class="signal-icon text-green-400" */}
      {/*     height={24} */}
      {/*     icon="heroicons:signal" */}
      {/*     width={24} */}
      {/*   /> */}
      {/* </div> */}
      {/* <Icon */}
      {/*   class="signal-icon text-green-400" */}
      {/*   height={24} */}
      {/*   icon="heroicons:signal-slash" */}
      {/*   width={24} */}
      {/* /> */}
    </button>
  );
};
