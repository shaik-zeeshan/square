import { createEventListener } from "@solid-primitives/event-listener";
import { useNavigate } from "@solidjs/router";
import { createEffect, createSignal, For, type JSX, Show } from "solid-js";
import { cn } from "~/lib/utils";
import ChevronRight from "~icons/lucide/chevron-right";
import House from "~icons/lucide/house";
import Search from "~icons/lucide/search";
import X from "~icons/lucide/x";
import { UserDropdown } from "./user-dropdown";

type NavProps = {
	/** Breadcrumb items to display */
	breadcrumbs?: Array<{
		label: string;
		onClick?: () => void;
		icon?: JSX.Element;
	}>;
	/** Current page title (shown as the last breadcrumb) */
	currentPage?: string;
	/** Show search functionality */
	showSearch?: boolean;
	/** Search value */
	searchValue?: string;
	/** Search callback */
	onSearchChange?: (value: string) => void;
	/** Additional actions to render on the right side */
	actions?: JSX.Element;
	/** Custom class for the nav container */
	class?: string;
	/**
	 * Color variant — kept for backward-compat; both render on the dark shell.
	 * "light" is treated as "dark" now — all routes use the cinematic surface.
	 */
	variant?: "light" | "dark";
};

export function Nav(props: NavProps) {
	const navigate = useNavigate();
	const [isSearchOpen, setIsSearchOpen] = createSignal(false);

	let searchInputRef!: HTMLInputElement;

	// Auto-focus search input when opened
	createEffect(() => {
		if (isSearchOpen() && searchInputRef) {
			searchInputRef.focus();
		}
	});

	const handleSearchClose = () => {
		setIsSearchOpen(false);
		props.onSearchChange?.("");
	};

	const handleSearchOpen = () => {
		if (props.showSearch) {
			setIsSearchOpen(true);
		}
	};

	// Keyboard shortcuts
	createEventListener(
		document,
		"keydown",
		(e) => {
			const target = e.target as HTMLElement;
			if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
				return;
			}
			if ((e.ctrlKey || e.metaKey) && e.key === "k") {
				e.preventDefault();
				handleSearchOpen();
			}
			if (e.key === "Escape" && isSearchOpen()) {
				e.preventDefault();
				handleSearchClose();
			}
		},
		{ passive: false },
	);

	return (
		<nav
			class={cn(
				// Cinematic glass bar — tighter, more intentional height
				"relative z-50 h-[52px] shrink-0 px-5",
				"border-white/[0.07] border-b",
				// Richer frosted glass — slightly more opaque for premium layering
				"bg-black/40 backdrop-blur-xl",
				props.class,
			)}
		>
			{/* Amber hairline accent at top edge — warmer, more defined */}
			<div
				aria-hidden="true"
				class="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent"
			/>
			{/* Subtle bottom glow — grounds the bar visually */}
			<div
				aria-hidden="true"
				class="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent"
			/>

			<div class="flex h-full items-center justify-between gap-2 sm:gap-4">
				{/* ── Left: home icon + breadcrumbs ── */}
				<div class="flex min-w-0 flex-1 items-center gap-2">
					<button
						aria-label="Go home"
						class={cn(
							"shrink-0 rounded-md p-1.5 text-white/50",
							"transition-all duration-150",
							"hover:bg-white/[0.09] hover:text-white/90",
							"focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 focus-visible:outline-offset-2",
							"active:scale-95",
						)}
						onClick={() => navigate("/")}
						title="Home"
						type="button"
					>
						<House class="h-[15px] w-[15px]" />
					</button>

					{/* Vertical divider — refined opacity */}
					<div aria-hidden="true" class="h-4 w-px shrink-0 bg-white/[0.12]" />

					{/* Breadcrumb trail */}
					<div class="flex min-w-0 items-center gap-1 overflow-hidden">
						<Show when={props.breadcrumbs && props.breadcrumbs.length > 0}>
							<For each={props.breadcrumbs}>
								{(breadcrumb, index) => (
									<>
										<Show when={breadcrumb.icon}>
											<span class="text-white/35 [&_svg]:h-3.5 [&_svg]:w-3.5">
												{breadcrumb.icon}
											</span>
										</Show>
										<Show
											fallback={
												<span class="truncate font-medium text-[11px] text-white/35 tracking-wide">
													{breadcrumb.label}
												</span>
											}
											when={breadcrumb.onClick}
										>
											<button
												aria-label={`Navigate to ${breadcrumb.label}`}
												class={cn(
													"truncate font-medium text-[11px] text-white/35 tracking-wide",
													"transition-colors duration-150 hover:text-white/70",
													"focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400",
												)}
												onClick={breadcrumb.onClick}
												type="button"
											>
												{breadcrumb.label}
											</button>
										</Show>
										<Show
											when={
												index() < (props.breadcrumbs?.length ?? 0) - 1 ||
												props.currentPage
											}
										>
											<ChevronRight class="h-2.5 w-2.5 shrink-0 text-white/18" />
										</Show>
									</>
								)}
							</For>
						</Show>

						<Show when={props.currentPage}>
							<span class="truncate font-semibold text-[13px] text-white/95 tracking-tight">
								{props.currentPage}
							</span>
						</Show>
					</div>
				</div>

				{/* ── Right: search + actions + user ── */}
				<div class="flex h-full min-w-0 shrink items-center gap-1">
					<Show when={props.showSearch}>
						<Show
							fallback={
								/* Search trigger — pill hint with ⌘K shortcut badge */
								<button
									aria-label="Search (Ctrl+K)"
									class={cn(
										"flex items-center gap-1.5 rounded-md px-2.5 py-1.5",
										"border border-white/[0.07] bg-white/[0.04]",
										"text-white/40 text-xs",
										"transition-all duration-150",
										"hover:border-white/[0.12] hover:bg-white/[0.08] hover:text-white/75",
										"focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 focus-visible:outline-offset-2",
										"active:scale-95",
									)}
									onClick={handleSearchOpen}
									title="Search (Ctrl+K)"
									type="button"
								>
									<Search class="h-3.5 w-3.5 shrink-0" />
									<span class="hidden sm:inline">Search</span>
									<kbd class="hidden rounded border border-white/[0.1] bg-white/[0.06] px-1 py-px font-mono text-[9px] text-white/25 leading-none sm:inline">
										⌘K
									</kbd>
								</button>
							}
							when={isSearchOpen()}
						>
							{/* Inline search field — expanded, premium feel */}
							<div
								class={cn(
									"flex h-8 items-center gap-2 rounded-md px-2.5",
									"border border-white/[0.1] bg-white/[0.06]",
									"backdrop-blur-sm",
									"ring-0 focus-within:border-amber-400/45 focus-within:ring-1 focus-within:ring-amber-400/20",
									"transition-all duration-200",
								)}
							>
								<Search class="h-3 w-3 shrink-0 text-white/35" />
								<input
									aria-label="Search"
									class={cn(
										"w-[clamp(5rem,20vw,12rem)] bg-transparent text-[13px] text-white outline-none",
										"placeholder:text-white/25",
										"caret-amber-400",
									)}
									onInput={(e) => props.onSearchChange?.(e.currentTarget.value)}
									onKeyDown={(e) => {
										if (e.key === "Escape") {
											e.preventDefault();
											handleSearchClose();
										}
									}}
									placeholder="Search…"
									ref={searchInputRef}
									type="text"
									value={props.searchValue ?? ""}
								/>
								<button
									aria-label="Close search"
									class={cn(
										"rounded p-0.5 text-white/25",
										"transition-colors duration-150 hover:text-white/60",
										"focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400",
									)}
									onClick={handleSearchClose}
									type="button"
								>
									<X class="h-3 w-3" />
								</button>
							</div>
						</Show>
					</Show>

					{props.actions}

					{/* Subtle separator before user avatar */}
					<div aria-hidden="true" class="mx-0.5 h-4 w-px bg-white/[0.09]" />

					<UserDropdown variant="dark" />
				</div>
			</div>
		</nav>
	);
}
