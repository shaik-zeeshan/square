/** biome-ignore-all lint/correctness/noNestedComponentDefinitions: No Nested */
import type { RecommendedServerInfo } from "@jellyfin/sdk";
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
import { useLoginBySelectionMutation } from "~/effect/services/auth/operations";
import { useAuth } from "~/effect/services/hooks/use-auth";
import { JellyfinClientService } from "~/effect/services/jellyfin/client";
import {
  createEffectMutation,
  createEffectQuery,
  queryClient,
} from "~/effect/tanstack/query";
import { showErrorToast, showSuccessToast } from "~/lib/toast";
import { cn } from "~/lib/utils";
import ArrowSmallLeft from "~icons/heroicons/arrow-small-left";
import ArrowSmallRight from "~icons/heroicons/arrow-small-right";
import Finder from "~icons/heroicons/magnifying-glass";
import Server from "~icons/heroicons/server";
import ServerStack from "~icons/heroicons/server-stack";
import Trash from "~icons/heroicons/trash";
import LockClosed from "~icons/lucide/lock-keyhole";
import User from "~icons/lucide/user";

type AuthStage =
  | "server-selection"
  | "server-search"
  | "user-selection"
  | "user-login";

type AuthSteps = {
  stage: AuthStage;
  payload: RecommendedServerInfo | null;
};

// ── Step indicator labels ──────────────────────────────────────────────────────
const STEP_ORDER: AuthStage[] = [
  "server-selection",
  "user-selection",
  "user-login",
];

const STEP_LABELS: Record<AuthStage, string> = {
  "server-selection": "Server",
  "server-search": "Add Server",
  "user-selection": "Account",
  "user-login": "Sign In",
};

function StepIndicator(props: { stage: AuthStage }) {
  const steps = STEP_ORDER;
  const currentIdx = () => {
    const idx = steps.indexOf(props.stage);
    return idx === -1 ? 0 : idx;
  };

  return (
    <div class="mb-8 flex items-center justify-center gap-2">
      <For each={steps}>
        {(_step, i) => {
          const stepClass = () => {
            if (i() < currentIdx()) {
              return "bg-blue-400 text-slate-950";
            }
            if (i() === currentIdx()) {
              return "bg-blue-400/20 text-blue-300 ring-1 ring-blue-400/40 ring-inset";
            }
            return "bg-white/[0.06] text-white/30";
          };
          return (
            <>
              <div
                class={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full font-semibold text-xs transition-all duration-300",
                  stepClass()
                )}
              >
                {i() < currentIdx() ? "✓" : i() + 1}
              </div>
              <Show when={i() < steps.length - 1}>
                <div
                  class={cn(
                    "h-px w-8 rounded-full transition-all duration-300",
                    i() < currentIdx() ? "bg-blue-400/60" : "bg-white/[0.1]"
                  )}
                />
              </Show>
            </>
          );
        }}
      </For>
    </div>
  );
}

// ── Shared heading/subtitle wrapper ───────────────────────────────────────────
function StageHeading(props: { title: string; subtitle?: string }) {
  return (
    <div class="mb-6 text-center">
      <h1 class="font-semibold text-lg text-white/90 tracking-tight">
        {props.title}
      </h1>
      <Show when={props.subtitle}>
        <p class="mt-1 text-sm text-white/40">{props.subtitle}</p>
      </Show>
    </div>
  );
}

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
    <section
      class="relative flex h-full w-full flex-col items-center overflow-y-auto bg-background"
      style={{
        animation: "fadeSlideUp 350ms cubic-bezier(0.22,1,0.36,1) both",
      }}
    >
      {/* ── Cinematic hero backdrop ── */}
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-x-0 top-0 h-[45vh] max-h-[480px] min-h-[320px]"
      >
        {/* Primary radial glow — cool blue streaming accent */}
        <div
          class="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 120% 80% at 50% 0%, rgba(60,130,246,0.12) 0%, rgba(40,80,180,0.06) 40%, transparent 70%)",
          }}
        />
        {/* Secondary warm accent — subtle asymmetric depth */}
        <div
          class="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 80% 10%, rgba(100,160,255,0.06) 0%, transparent 50%)",
          }}
        />
        {/* Film grain texture overlay — cinematic atmosphere */}
        <div
          class="absolute inset-0 opacity-[0.03]"
          style={{
            "background-image":
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
          }}
        />
        {/* Bottom dissolve into page background */}
        <div class="absolute inset-0 bg-gradient-to-t from-[var(--app-bg)] via-[var(--app-bg)]/40 to-transparent" />
      </div>

      {/* ── Centered content wrapper — my-auto centres when viewport is tall, scrolls safely when short ── */}
      <div class="relative z-10 my-auto flex w-full flex-col items-center px-4 py-8">
        {/* ── Branded welcome mark ── */}
        <div
          class="mb-2 flex flex-col items-center gap-4"
          style={{
            animation:
              "heroReveal 600ms cubic-bezier(0.22,1,0.36,1) 100ms both",
          }}
        >
          <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-400/10 shadow-[0_0_40px_rgba(60,130,246,0.15)] ring-1 ring-blue-400/20 ring-inset">
            <ServerStack class="h-8 w-8 text-blue-400" />
          </div>
          <div class="text-center">
            <h1 class="font-bold text-2xl text-white/90 tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
              Welcome to Square
            </h1>
            <p class="mt-1.5 text-sm text-white/35">
              Connect your Jellyfin server to get started
            </p>
          </div>
        </div>

        {/* ── Step indicator — floats below hero mark ── */}
        <Suspense>
          <Show when={step.stage !== "server-search"}>
            <div
              class="mt-6 mb-2"
              style={{
                animation:
                  "fadeSlideUp 300ms cubic-bezier(0.22,1,0.36,1) 200ms both",
              }}
            >
              <StepIndicator stage={step.stage} />
            </div>
          </Show>

          {/* ── Stage content — glass card surface ── */}
          <div
            class="mt-4 w-full max-w-sm rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-8 shadow-[0_8px_40px_rgba(0,0,0,0.3)] backdrop-blur-sm"
            style={{
              animation:
                "fadeSlideUp 400ms cubic-bezier(0.22,1,0.36,1) 250ms both",
            }}
          >
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
          </div>
        </Suspense>
      </div>
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
  props: ComponentProps<"div"> & {
    user: string;
    server: RecommendedServerInfo;
    stage?: string;
  }
) => {
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
            await queryClient.invalidateQueries({
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

  const isActive = () =>
    props.stage && !["idle", "error", undefined].includes(props.stage);

  return (
    <div
      class={cn(
        "group flex w-full cursor-pointer items-center gap-4 overflow-hidden rounded-xl border bg-white/[0.04] px-5 py-3.5 text-left transition-all duration-200",
        isActive()
          ? "border-blue-400/40 bg-blue-400/[0.07]"
          : "border-white/[0.08] hover:border-white/[0.16] hover:bg-white/[0.07]",
        className
      )}
      onClick={other.onClick as (e: MouseEvent) => void}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.currentTarget.click();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div
        class={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200",
          isActive()
            ? "bg-blue-400/20 ring-1 ring-blue-400/40 ring-inset"
            : "bg-white/[0.07] group-hover:bg-white/[0.1]"
        )}
      >
        <User
          class={cn(
            "h-4 w-4 transition-colors",
            isActive() ? "text-blue-300" : "text-white/50"
          )}
        />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate font-medium text-sm text-white/90">{user}</p>
        <Show when={props.stage && props.stage !== "idle"}>
          <p
            class={cn(
              "mt-0.5 text-xs transition-colors",
              props.stage === "error" ? "text-red-400/70" : "text-blue-400/70"
            )}
          >
            {props.stage}
          </p>
        </Show>
      </div>
      <button
        aria-label={`Remove user ${user}`}
        class="grid shrink-0 place-items-center rounded-lg p-2 opacity-0 transition-all duration-150 hover:bg-red-500/10 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          removeUser.mutate({ server, user });
        }}
        type="button"
      >
        <Trash class="h-4 w-4 text-red-400/60 hover:text-red-400" />
      </button>
    </div>
  );
};

const Input = (
  props: ComponentProps<"input"> & {
    icon: Component<ComponentProps<"svg">>;
  }
) => {
  const Icon = props.icon;
  return (
    <div class="flex h-12 w-full items-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 transition-all duration-150 focus-within:border-blue-400/40 focus-within:bg-blue-400/[0.04] focus-within:ring-1 focus-within:ring-blue-400/20">
      <Icon class="h-4 w-4 shrink-0 text-white/30" />
      <input
        class="flex-1 bg-transparent text-sm text-white/90 caret-blue-400 outline-none placeholder:text-white/25"
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
    <div class="flex w-full flex-col items-stretch">
      <StageHeading
        subtitle="Select an account to continue"
        title="Choose Account"
      />

      {/* Active server context */}
      <ServerContextBadge server={props.server} />

      {/* User list */}
      <div class="mt-5 space-y-2">
        <Show when={!users.data?.length}>
          <p class="py-6 text-center text-sm text-white/30">
            No saved accounts found
          </p>
        </Show>
        <For each={users.data}>
          {(user) => <UserSelectionItem server={props.server} user={user} />}
        </For>
      </div>

      {/* Actions */}
      <div class="mt-6 space-y-3">
        <button
          class="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-blue-400 px-4 py-3 font-semibold text-slate-950 text-sm transition-all duration-150 hover:bg-blue-300 active:scale-[0.98]"
          onClick={() => props.setStage?.("stage", "user-login")}
          type="button"
        >
          <ServerStack class="h-4 w-4" />
          Sign in with credentials
          <ArrowSmallRight class="h-4 w-4" />
        </button>
        <button
          class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-transparent px-4 py-2.5 text-sm text-white/50 transition-all duration-150 hover:border-white/[0.16] hover:text-white/80 active:scale-[0.98]"
          onClick={() => props.setStage?.("stage", "server-selection")}
          type="button"
        >
          <ArrowSmallLeft class="h-4 w-4" />
          Back to servers
        </button>
      </div>
    </div>
  );
};

const UserSelectionItem = (props: {
  user: string;
  server: RecommendedServerInfo;
}) => {
  const [loginBySelection, step] = useLoginBySelectionMutation();

  const styleStep = (stage: ReturnType<typeof step>) => {
    switch (stage) {
      case "idle":
        return;
      case "password":
        return "Getting password…";
      case "authenticating":
        return "Signing in…";
      case "logged-in":
        return "Signed in ✓";
      case "error":
        return "Sign-in failed";
      default:
        return;
    }
  };

  return (
    <UserCard
      class="peer-data-[action=true]:pointer-events-none"
      data-action={!["idle", "error"].includes(step())}
      onClick={() =>
        loginBySelection.mutate({
          username: props.user,
          server: props.server,
        })
      }
      server={props.server}
      stage={styleStep(step())}
      user={props.user}
    />
  );
};

const UserLogin = (props: {
  server: RecommendedServerInfo;
  setStage?: SetStoreFunction<AuthSteps>;
}) => {
  const { login } = useAuth();
  const loginMutation = login();
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

  const isPending = () => loginMutation.isPending;

  return (
    <div class="flex w-full flex-col items-stretch">
      <StageHeading
        subtitle="Enter your Jellyfin credentials"
        title="Sign In"
      />

      {/* Active server context */}
      <ServerContextBadge server={props.server} />

      {/* Credentials form */}
      <div class="mt-5 space-y-3">
        <Input
          autocomplete="username"
          icon={User}
          onChange={(e) => setLoginStore("username", e.target.value)}
          placeholder="Username"
          value={loginStore.username}
        />
        <Input
          autocomplete="current-password"
          icon={LockClosed}
          onChange={(e) => setLoginStore("password", e.target.value)}
          placeholder="Password"
          type="password"
          value={loginStore.password}
        />
      </div>

      {/* Inline status feedback */}
      <Show when={loginMutation.isError}>
        <div class="mt-3 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.08] px-3.5 py-2.5 text-red-400 text-sm">
          <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
          Invalid username or password
        </div>
      </Show>

      {/* Sign in CTA */}
      <div class="mt-6 space-y-3">
        <button
          class={cn(
            "flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl px-4 py-3 font-semibold text-sm transition-all duration-150",
            isPending()
              ? "cursor-not-allowed bg-blue-400/50 text-slate-950/60"
              : "bg-blue-400 text-slate-950 hover:bg-blue-300 active:scale-[0.98]"
          )}
          disabled={isPending()}
          onClick={() => {
            loginMutation.mutate({
              username: loginStore.username,
              password: loginStore.password,
              server: props.server,
            });
          }}
          type="button"
        >
          <Show
            fallback={
              <>
                Sign In
                <ArrowSmallRight class="h-4 w-4" />
              </>
            }
            when={isPending()}
          >
            <span
              class="h-4 w-4 shrink-0 rounded-full border-2 border-slate-950/30 border-t-slate-950/80"
              style={{ animation: "spinRing 700ms linear infinite" }}
            />
            Signing in…
          </Show>
        </button>

        {/* Back navigation — contextual */}
        <Show
          fallback={
            <button
              class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-transparent px-4 py-2.5 text-sm text-white/50 transition-all duration-150 hover:border-white/[0.16] hover:text-white/80 active:scale-[0.98]"
              onClick={() => props.setStage?.("stage", "server-selection")}
              type="button"
            >
              <ArrowSmallLeft class="h-4 w-4" />
              Back to servers
            </button>
          }
          when={users.data?.length}
        >
          <button
            class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-transparent px-4 py-2.5 text-sm text-white/50 transition-all duration-150 hover:border-white/[0.16] hover:text-white/80 active:scale-[0.98]"
            onClick={() => props.setStage?.("stage", "user-selection")}
            type="button"
          >
            <ArrowSmallLeft class="h-4 w-4" />
            Back to accounts
          </button>
        </Show>
      </div>
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
    <div class="flex w-full flex-col items-stretch">
      <StageHeading
        subtitle="Enter your Jellyfin server address"
        title="Add Server"
      />

      <ServerInputSearch
        onChange={(e) => setUrl(e.target.value)}
        value={url() || ""}
      />

      <Suspense>
        <Show when={searchServers.data?.length}>
          <div class="mt-4 space-y-2">
            <p class="mb-1 font-medium text-white/30 text-xs uppercase tracking-widest">
              Found servers
            </p>
            <For each={searchServers.data}>
              {(server) => (
                <ServerFinderCard
                  onClick={() => {
                    if (!server.systemInfo?.Id) {
                      showErrorToast("Invalid Server");
                      return;
                    }
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
          class="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-transparent px-4 py-2.5 text-sm text-white/50 transition-all duration-150 hover:border-white/[0.16] hover:text-white/80 active:scale-[0.98]"
          onClick={() => props.setStage?.("stage", "server-selection")}
          type="button"
        >
          <ArrowSmallLeft class="h-4 w-4" />
          Back to servers
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
    <div class="flex w-full flex-col items-stretch">
      <StageHeading
        subtitle="Select a Jellyfin server to connect"
        title="Choose Server"
      />

      <Show
        fallback={
          <p class="py-6 text-center text-sm text-white/30">
            No servers added yet
          </p>
        }
        when={servers.data?.length}
      >
        <div class="space-y-2">
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

      <button
        class="mt-5 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-blue-400/20 bg-blue-400/[0.06] px-4 py-3 text-blue-300 text-sm transition-all duration-150 hover:border-blue-400/40 hover:bg-blue-400/[0.1] active:scale-[0.98]"
        onClick={() => props?.setStage?.("stage", "server-search")}
        type="button"
      >
        <Finder class="h-4 w-4" />
        Add a server
        <ArrowSmallRight class="h-4 w-4" />
      </button>
    </div>
  );
};

// ── Shared server context badge (shows active server during user stages) ──────
const ServerContextBadge = (props: { server: RecommendedServerInfo }) => (
  <div class="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5">
    <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-400/10">
      <Server class="h-3.5 w-3.5 text-blue-400/70" />
    </div>
    <div class="min-w-0 flex-1">
      <p class="truncate font-medium text-sm text-white/80">
        {props.server.systemInfo?.ServerName}
      </p>
      <p class="truncate text-white/35 text-xs">{props.server.address}</p>
    </div>
    <div class="h-2 w-2 shrink-0 rounded-full bg-green-400/60" />
  </div>
);

const ServerInputSearch = (props: ComponentProps<"input">) => (
  <div class="flex h-12 w-full items-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 transition-all duration-150 focus-within:border-blue-400/40 focus-within:bg-blue-400/[0.04] focus-within:ring-1 focus-within:ring-blue-400/20">
    <Server class="h-4 w-4 shrink-0 text-white/30" />
    <input
      class="flex-1 bg-transparent text-sm text-white/90 caret-blue-400 outline-none placeholder:text-white/25"
      placeholder="http://192.168.1.x:8096"
      {...props}
    />
    <Finder class="h-4 w-4 shrink-0 text-white/25" />
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
        "group flex w-full cursor-pointer items-center gap-4 overflow-hidden rounded-xl border bg-white/[0.04] px-5 py-3.5 text-left transition-all duration-200",
        "border-white/[0.08] hover:border-blue-400/30 hover:bg-blue-400/[0.06]",
        className
      )}
      type="button"
      {...other}
    >
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-400/10 ring-1 ring-blue-400/20 ring-inset">
        <Server class="h-4 w-4 text-blue-400/70" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate font-medium text-sm text-white/90">
          {server.systemInfo?.ServerName}
        </p>
        <p class="mt-0.5 truncate text-white/40 text-xs">{server.address}</p>
      </div>
    </button>
  );
};

const ServerCard = (
  props: ComponentProps<"div"> & {
    server: RecommendedServerInfo;
  }
) => {
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
            await queryClient.invalidateQueries({ queryKey: ["getServers"] });
            showSuccessToast("Successfully Removed Server");
          })
        )
      ),
  }));
  return (
    <div
      class={cn(
        "group flex w-full cursor-pointer items-center gap-4 overflow-hidden rounded-xl border bg-white/[0.04] px-5 py-3.5 text-left transition-all duration-200",
        "border-white/[0.08] hover:border-white/[0.16] hover:bg-white/[0.07]",
        className
      )}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.currentTarget.click();
        }
      }}
      role="button"
      tabIndex={0}
      {...other}
    >
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.07] transition-all duration-150 group-hover:bg-blue-400/10">
        <Server class="h-4 w-4 text-white/50 transition-colors group-hover:text-blue-400/70" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate font-medium text-sm text-white/90">
          {server.systemInfo?.ServerName}
        </p>
        <p class="mt-0.5 truncate text-white/40 text-xs">{server.address}</p>
      </div>
      <button
        aria-label={`Remove server ${server.systemInfo?.ServerName}`}
        class="grid shrink-0 place-items-center rounded-lg p-2 opacity-0 transition-all duration-150 hover:bg-red-500/10 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          removeServer.mutate(props.server);
        }}
        type="button"
      >
        <Trash class="h-4 w-4 text-red-400/60 hover:text-red-400" />
      </button>
    </div>
  );
};
