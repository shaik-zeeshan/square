import {
  Calendar,
  CheckCircle,
  Globe,
  Monitor,
  Server,
  Settings as SettingsIcon,
  Shield,
  Subtitles,
  User as UserIcon,
  Zap,
} from "lucide-solid";
import { createSignal, For, Show } from "solid-js";
import { Nav } from "~/components/Nav";
import { QueryBoundary } from "~/components/query-boundary";
import { InlineLoading } from "~/components/ui/loading";
import { EXTERNAL_PLAYERS } from "~/components/video";
import type { ExternalPlayerId } from "~/components/video/external-players";
import {
  useCurrentServerQuery,
  useCurrentUserQuery,
} from "~/effect/services/auth/operations";
import {
  getLanguageLabel,
  LANGUAGE_OPTIONS,
} from "~/lib/playback-language-preferences";
import { useAppPreferences } from "~/lib/store-hooks";

/** Return LANGUAGE_OPTIONS with the persisted value prepended when missing. */
function languageOptionsWithCurrent(currentCode: string | undefined) {
  if (!currentCode || LANGUAGE_OPTIONS.some((o) => o.code === currentCode)) {
    return LANGUAGE_OPTIONS;
  }
  return [
    { code: currentCode, label: getLanguageLabel(currentCode) },
    ...LANGUAGE_OPTIONS,
  ];
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = createSignal("profile");
  const { store: appPrefs, setStore: setAppPrefs } = useAppPreferences();

  const userDetails = useCurrentUserQuery();
  const serverDetails = useCurrentServerQuery();

  const formatDate = (dateString?: string) => {
    if (!dateString) {
      return "N/A";
    }
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const tabs = [
    {
      id: "profile",
      label: "Profile",
      icon: UserIcon,
    },
    {
      id: "server",
      label: "Server",
      icon: Server,
    },
    {
      id: "playback",
      label: "Playback",
      icon: Monitor,
    },
  ] as const;

  return (
    <section class="flex h-full flex-col overflow-hidden">
      {/* Navigation Bar — overlays the hero zone */}
      <Nav
        breadcrumbs={[
          {
            label: "Settings",
            icon: <SettingsIcon class="h-4 w-4 shrink-0 opacity-70" />,
          },
        ]}
        currentPage={
          { profile: "Profile", server: "Server", playback: "Playback" }[
            activeTab()
          ] ?? "Settings"
        }
        variant="light"
      />

      {/* ── Hero header zone ── */}
      <div
        class="relative overflow-hidden px-8 pt-4 pb-8 sm:px-10 lg:px-12"
        style={{
          animation: "heroReveal 600ms cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        {/* Atmospheric gradient backdrop */}
        <div
          aria-hidden="true"
          class="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 100% 100% at 50% 0%, rgba(60,130,246,0.08) 0%, rgba(40,80,180,0.03) 50%, transparent 80%)",
          }}
        />
        {/* Bottom dissolve */}
        <div
          aria-hidden="true"
          class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--app-bg)] to-transparent"
        />

        <div class="relative mx-auto flex max-w-3xl items-center gap-5">
          {/* Settings icon mark */}
          <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-400/10 shadow-[0_0_32px_rgba(60,130,246,0.12)] ring-1 ring-blue-400/20 ring-inset">
            <SettingsIcon class="h-7 w-7 text-blue-400" />
          </div>
          <div class="min-w-0 flex-1">
            <h1 class="font-bold text-2xl text-white/90 tracking-tight">
              Settings
            </h1>
            <p class="mt-0.5 text-sm text-white/35">
              Manage your profile and server connection
            </p>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div
        class="flex-1 overflow-y-auto px-8 pb-8 sm:px-10 lg:px-12"
        style={{
          animation: "fadeSlideUp 350ms cubic-bezier(0.22,1,0.36,1) 100ms both",
        }}
      >
        <div class="mx-auto max-w-3xl">
          {/* Tab Strip */}
          <div class="mb-8 flex items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1">
            <For each={tabs}>
              {(tab) => {
                const Icon = tab.icon;
                const isActive = () => activeTab() === tab.id;
                return (
                  <button
                    class={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium text-sm transition-all duration-200 ${
                      isActive()
                        ? "bg-white/[0.09] text-white/90 shadow-sm ring-1 ring-white/[0.08] ring-inset"
                        : "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                    type="button"
                  >
                    <Icon class="h-4 w-4 shrink-0" />
                    {tab.label}
                  </button>
                );
              }}
            </For>
          </div>

          {/* ── Profile Tab ── */}
          <Show when={activeTab() === "profile"}>
            <QueryBoundary
              loadingFallback={
                <div class="flex items-center justify-center py-16">
                  <InlineLoading message="Loading profile…" size="md" />
                </div>
              }
              query={userDetails}
            >
              {(data) => (
                <div
                  class="space-y-4"
                  style={{
                    animation:
                      "fadeSlideUp 280ms cubic-bezier(0.22,1,0.36,1) both",
                  }}
                >
                  {/* Profile Hero */}
                  <div class="flex items-center gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6">
                    {/* Avatar placeholder */}
                    <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-400/10 ring-1 ring-blue-400/20 ring-inset">
                      <UserIcon class="h-8 w-8 text-blue-400/70" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <h2 class="truncate font-semibold text-white/90 text-xl tracking-tight">
                        {data?.Name || "—"}
                      </h2>
                      <Show
                        fallback={
                          <span class="mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.06] px-2.5 py-0.5 text-white/50 text-xs">
                            <Shield class="h-3 w-3" />
                            User
                          </span>
                        }
                        when={data?.Policy?.IsAdministrator}
                      >
                        <span class="mt-1 inline-flex items-center gap-1.5 rounded-full border border-blue-400/25 bg-blue-400/10 px-2.5 py-0.5 text-blue-300 text-xs">
                          <Shield class="h-3 w-3" />
                          Administrator
                        </span>
                      </Show>
                    </div>
                  </div>

                  {/* Profile Details Grid */}
                  <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <InfoCard
                      icon={Calendar}
                      label="Last Login"
                      value={formatDate(data?.LastLoginDate || undefined)}
                    />
                    <InfoCard
                      icon={UserIcon}
                      label="User ID"
                      mono
                      truncate
                      value={data?.Id || "—"}
                    />
                  </div>

                  {/* Server version cross-ref */}
                  <Show when={serverDetails?.data?.systemInfo?.Version}>
                    <InfoCard
                      icon={Server}
                      label="Connected Jellyfin Version"
                      value={serverDetails?.data?.systemInfo?.Version || "—"}
                    />
                  </Show>
                </div>
              )}
            </QueryBoundary>
          </Show>

          {/* ── Server Tab ── */}
          <Show when={activeTab() === "server"}>
            <QueryBoundary
              loadingFallback={
                <div class="flex items-center justify-center py-16">
                  <InlineLoading message="Loading server info…" size="md" />
                </div>
              }
              query={serverDetails}
            >
              {(data) => (
                <div
                  class="space-y-4"
                  style={{
                    animation:
                      "fadeSlideUp 280ms cubic-bezier(0.22,1,0.36,1) both",
                  }}
                >
                  {/* Server Hero */}
                  <div class="flex items-center gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6">
                    <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/[0.08] ring-inset">
                      <Server class="h-8 w-8 text-white/40" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <h2 class="truncate font-semibold text-white/90 text-xl tracking-tight">
                        {data?.systemInfo?.ServerName || "Unknown Server"}
                      </h2>
                      <Show when={data?.systemInfo?.Version}>
                        <p class="mt-1 text-sm text-white/40">
                          Jellyfin {data?.systemInfo?.Version}
                        </p>
                      </Show>
                    </div>
                    {/* Online indicator */}
                    <div class="flex shrink-0 items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1.5 font-medium text-green-400 text-xs">
                      <CheckCircle class="h-3.5 w-3.5" />
                      Online
                    </div>
                  </div>

                  {/* Server Details Grid */}
                  <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <InfoCard
                      icon={Server}
                      label="Server ID"
                      mono
                      truncate
                      value={data?.systemInfo?.Id || "—"}
                    />
                    <InfoCard
                      icon={Zap}
                      label="Response Time"
                      value={
                        data?.responseTime ? `${data.responseTime}ms` : "—"
                      }
                    />
                  </div>
                </div>
              )}
            </QueryBoundary>
          </Show>

          {/* ── Playback Tab ── */}
          <Show when={activeTab() === "playback"}>
            <div
              class="space-y-4"
              style={{
                animation: "fadeSlideUp 280ms cubic-bezier(0.22,1,0.36,1) both",
              }}
            >
              {/* External Player Card */}
              <div class="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6">
                <div class="mb-4 flex items-center gap-3">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/[0.08] ring-inset">
                    <Monitor class="h-5 w-5 text-white/40" />
                  </div>
                  <div>
                    <h3 class="font-semibold text-sm text-white/90">
                      External Player
                    </h3>
                    <p class="text-white/35 text-xs">
                      Choose which app opens video streams
                    </p>
                  </div>
                </div>
                <select
                  class="w-full appearance-none rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2.5 text-sm text-white/80 outline-none transition-colors hover:border-white/[0.15] focus:border-blue-400/40 focus:ring-1 focus:ring-blue-400/20"
                  onChange={(e) => {
                    setAppPrefs(
                      "externalPlayer",
                      e.currentTarget.value as ExternalPlayerId
                    );
                  }}
                  value={appPrefs.externalPlayer}
                >
                  <For each={EXTERNAL_PLAYERS}>
                    {(player) => (
                      <option class="bg-[#1a1a2e] text-white" value={player.id}>
                        {player.label}
                      </option>
                    )}
                  </For>
                </select>
              </div>

              {/* Default Audio Language Card */}
              <div class="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6">
                <div class="mb-4 flex items-center gap-3">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/[0.08] ring-inset">
                    <Globe class="h-5 w-5 text-white/40" />
                  </div>
                  <div>
                    <h3 class="font-semibold text-sm text-white/90">
                      Default Audio Language
                    </h3>
                    <p class="text-white/35 text-xs">
                      Preferred language for audio tracks
                    </p>
                  </div>
                </div>
                <select
                  class="w-full appearance-none rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2.5 text-sm text-white/80 outline-none transition-colors hover:border-white/[0.15] focus:border-blue-400/40 focus:ring-1 focus:ring-blue-400/20"
                  onChange={(e) => {
                    setAppPrefs("defaultAudioLanguage", e.currentTarget.value);
                  }}
                  value={appPrefs.defaultAudioLanguage}
                >
                  <For
                    each={languageOptionsWithCurrent(
                      appPrefs.defaultAudioLanguage
                    )}
                  >
                    {(lang) => (
                      <option class="bg-[#1a1a2e] text-white" value={lang.code}>
                        {lang.label}
                      </option>
                    )}
                  </For>
                </select>
              </div>

              {/* Default Subtitle Language Card */}
              <div class="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6">
                <div class="mb-4 flex items-center gap-3">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/[0.08] ring-inset">
                    <Subtitles class="h-5 w-5 text-white/40" />
                  </div>
                  <div>
                    <h3 class="font-semibold text-sm text-white/90">
                      Default Subtitle Language
                    </h3>
                    <p class="text-white/35 text-xs">
                      Preferred language for subtitle tracks
                    </p>
                  </div>
                </div>
                <select
                  class="w-full appearance-none rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-2.5 text-sm text-white/80 outline-none transition-colors hover:border-white/[0.15] focus:border-blue-400/40 focus:ring-1 focus:ring-blue-400/20"
                  onChange={(e) => {
                    setAppPrefs(
                      "defaultSubtitleLanguage",
                      e.currentTarget.value
                    );
                  }}
                  value={appPrefs.defaultSubtitleLanguage}
                >
                  <For
                    each={languageOptionsWithCurrent(
                      appPrefs.defaultSubtitleLanguage
                    )}
                  >
                    {(lang) => (
                      <option class="bg-[#1a1a2e] text-white" value={lang.code}>
                        {lang.label}
                      </option>
                    )}
                  </For>
                </select>
              </div>

              {/* Override hint */}
              <p class="px-1 text-white/30 text-xs leading-relaxed">
                Language choices made during playback for a specific series will
                override these defaults automatically for that series.
              </p>
            </div>
          </Show>
        </div>
      </div>
    </section>
  );
}

// ── Shared info card ──────────────────────────────────────────────────────────
function InfoCard(props: {
  label: string;
  value: string;
  icon: typeof UserIcon;
  mono?: boolean;
  truncate?: boolean;
}) {
  const Icon = props.icon;
  return (
    <div class="flex flex-col gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
      <div class="flex items-center gap-1.5">
        <Icon class="h-3.5 w-3.5 text-white/25" />
        <span class="font-medium text-white/35 text-xs uppercase tracking-widest">
          {props.label}
        </span>
      </div>
      <p
        class={`text-sm text-white/80 ${props.mono ? "font-mono text-xs" : "font-medium"} ${props.truncate ? "truncate" : ""}`}
      >
        {props.value}
      </p>
    </div>
  );
}
