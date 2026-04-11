import {
	Calendar,
	CheckCircle,
	Server,
	Settings as SettingsIcon,
	Shield,
	User as UserIcon,
	Zap,
} from "lucide-solid";
import { createSignal, For, Show } from "solid-js";
import { Nav } from "~/components/Nav";
import { QueryBoundary } from "~/components/query-boundary";
import { InlineLoading } from "~/components/ui/loading";

import {
	useCurrentServerQuery,
	useCurrentUserQuery,
} from "~/effect/services/auth/operations";

export default function SettingsPage() {
	const [activeTab, setActiveTab] = createSignal("profile");

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
	] as const;

	return (
		<section class="flex h-full flex-col overflow-hidden">
			{/* Navigation Bar */}
			<Nav
				breadcrumbs={[
					{
						label: "Settings",
						icon: <SettingsIcon class="h-4 w-4 shrink-0 opacity-70" />,
					},
				]}
				class="mt-4"
				currentPage={activeTab() === "profile" ? "Profile" : "Server"}
				variant="light"
			/>

			{/* Content Area */}
			<div
				class="flex-1 overflow-y-auto px-8 py-8"
				style={{
					animation: "fadeSlideUp 350ms cubic-bezier(0.22,1,0.36,1) both",
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
										<div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-400/10 ring-1 ring-amber-400/20 ring-inset">
											<UserIcon class="h-8 w-8 text-amber-400/70" />
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
												<span class="mt-1 inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-0.5 text-amber-300 text-xs">
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
