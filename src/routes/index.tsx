import { debounce } from "@solid-primitives/scheduled";
import { createSignal, For, Match, Show, Switch } from "solid-js";
import { ItemActions } from "~/components/ItemActions";
import { MainPageEpisodeCard, SeriesCard } from "~/components/media-card";
import { Nav } from "~/components/Nav";
import { QueryBoundary } from "~/components/query-boundary";

import { InlineLoading } from "~/components/ui/loading";
import { useCurrentUserQuery } from "~/effect/services/auth/operations";
import { JellyfinOperations } from "~/effect/services/jellyfin/operations";
import HouseIcon from "~icons/lucide/house";

// ── Section heading with amber left-rule accent ───────────────────────────────
function SectionHeading(props: {
	label: string;
	searchLabel?: string;
	isSearch?: boolean;
	count?: number;
}) {
	return (
		<div
			class="mb-5 flex items-baseline gap-3"
			style={{
				animation: "fadeSlideUp 300ms cubic-bezier(0.22,1,0.36,1) both",
			}}
		>
			{/* Amber vertical rule */}
			<div
				aria-hidden="true"
				class="h-5 w-0.5 shrink-0 rounded-full bg-amber-400/70"
			/>
			<h2 class="font-semibold text-lg text-white/90 tracking-tight">
				{props.isSearch ? (props.searchLabel ?? props.label) : props.label}
			</h2>
			<Show when={props.count !== undefined && props.count > 0}>
				<span class="ml-0.5 rounded-md bg-white/[0.07] px-1.5 py-0.5 font-medium text-white/35 text-xs tabular-nums">
					{props.count}
				</span>
			</Show>
		</div>
	);
}

// ── Section skeleton shimmer ───────────────────────────────────────────────────
// variant drives the responsive column pattern to match the loaded grid layout.
// "video"  → Continue Watching / Next Up  (aspect-video / 16:8 cards)
// "poster" → Movies / TV Shows            (aspect-2/3 poster cards)
// "library"→ Libraries row               (fixed-height landscape tiles)
function SectionSkeleton(props: {
	count?: number;
	aspect?: string;
	variant?: "video" | "poster" | "library";
}) {
	const count = props.count ?? 5;
	const aspect = props.aspect ?? "aspect-2/3";
	// Pick a responsive grid class set that mirrors the real loaded grid.
	const gridClass = () => {
		switch (props.variant) {
			case "video":
				// matches: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
				return "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
			case "library":
				// matches: grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6
				return "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6";
			default:
				// poster — matches: grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7
				return "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7";
		}
	};
	return (
		<div class={gridClass()}>
			<For each={Array.from({ length: count })}>
				{() => (
					<div
						class={`${aspect} animate-pulse rounded-xl bg-white/[0.05]`}
						style={{ animation: "pulse 1.8s ease-in-out infinite" }}
					/>
				)}
			</For>
		</div>
	);
}

// ── Section loading state ────────────────────────────────────────────────────
const LoadingSection = (props: {
	name: string;
	aspect?: string;
	count?: number;
	variant?: "video" | "poster" | "library";
}) => (
	<div
		class="space-y-3"
		style={{ animation: "fadeSlideUp 300ms cubic-bezier(0.22,1,0.36,1) both" }}
	>
		<div class="flex items-center gap-3">
			<div class="h-5 w-0.5 rounded-full bg-amber-400/30" />
			<div class="h-4 w-32 animate-pulse rounded-md bg-white/[0.07]" />
			<InlineLoading class="ml-1 opacity-50" size="sm" />
		</div>
		<SectionSkeleton
			aspect={props.aspect}
			count={props.count ?? 5}
			variant={props.variant}
		/>
	</div>
);

// ── Inline empty-state for a section ────────────────────────────────────────
function SectionEmpty(props: { label: string }) {
	return (
		<div
			class="flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] py-10 text-center"
			style={{
				animation: "fadeSlideUp 300ms cubic-bezier(0.22,1,0.36,1) both",
			}}
		>
			<p class="text-sm text-white/40">No {props.label} found</p>
		</div>
	);
}

// ── Search active banner ─────────────────────────────────────────────────────
function SearchActiveBanner(props: { term: string }) {
	return (
		<div
			class="flex items-center gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-amber-300/90 text-sm"
			style={{
				animation: "fadeSlideUp 250ms cubic-bezier(0.22,1,0.36,1) both",
			}}
		>
			{/* Pulsing dot */}
			<span
				class="h-2 w-2 shrink-0 rounded-full bg-amber-400"
				style={{ animation: "liveDot 1.4s ease-in-out infinite" }}
			/>
			<span>
				Showing results for{" "}
				<strong class="font-semibold text-amber-200">"{props.term}"</strong>
			</span>
		</div>
	);
}

export default function Home() {
	const [searchTerm, setSearchTerm] = createSignal("");

	const user = useCurrentUserQuery();

	const debouncedSearchCallback = debounce(
		(value: string) => setSearchTerm(value),
		300,
	);

	const libraries = JellyfinOperations.getLibraries();

	const resumeItems = JellyfinOperations.getResumeItems();

	const nextupItems = JellyfinOperations.getNextupItems();

	const latestMovies = JellyfinOperations.getLatestMovies(
		() => searchTerm(),
		libraries.data,
	);

	const latestTVShows = JellyfinOperations.getLatestTVShows(
		() => searchTerm(),
		libraries.data,
	);

	return (
		<section class="h-full w-full">
			<Show when={user.data?.Id}>
				<section class="relative flex flex-col">
					{/* Navigation Bar */}
					<Nav
						breadcrumbs={[
							{
								label: "Home",
								icon: <HouseIcon class="h-4 w-4 shrink-0 opacity-70" />,
							},
						]}
						class="relative z-50 mt-4"
						currentPage="Dashboard"
						onSearchChange={debouncedSearchCallback}
						searchValue={searchTerm()}
						showSearch={true}
						variant="light"
					/>

					{/* Content Area */}
					<div class="relative z-20 flex flex-1 flex-col gap-10 px-8 py-8">
						{/* ── Search active state banner ── */}
						<Show when={searchTerm()}>
							<SearchActiveBanner term={searchTerm()} />
						</Show>

						{/* ── Libraries Section (hidden while searching) ── */}
						<Show when={!searchTerm()}>
							<QueryBoundary
								loadingFallback={
									<div class="space-y-3">
										<div class="flex items-center gap-3">
											<div class="h-5 w-0.5 rounded-full bg-amber-400/30" />
											<div class="h-4 w-28 animate-pulse rounded-md bg-white/[0.07]" />
											<InlineLoading class="ml-1 opacity-50" size="sm" />
										</div>
										<div class="grid h-36 grid-cols-2 gap-4 sm:h-44 sm:grid-cols-3 lg:h-52 lg:grid-cols-4 xl:grid-cols-6">
											<For each={Array.from({ length: 4 })}>
												{() => (
													<div class="animate-pulse rounded-xl bg-white/[0.05]" />
												)}
											</For>
										</div>
									</div>
								}
								notFoundFallback={<SectionEmpty label="libraries" />}
								query={libraries}
							>
								{(data) => (
									<Switch>
										<Match when={data.length === 0}>
											<SectionEmpty label="libraries" />
										</Match>

										<Match when={data.length > 0}>
											<div
												style={{
													animation:
														"fadeSlideUp 350ms cubic-bezier(0.22,1,0.36,1) both",
												}}
											>
												<SectionHeading label="Your Libraries" />
												<div
													class="grid h-52 gap-4"
													style={{
														"grid-template-columns": `repeat(${Math.min(data.length, 6)}, minmax(0, 1fr))`,
													}}
												>
													<For each={data}>
														{(item) => (
															<a
																class="group block h-full w-full"
																href={`/library/${item.Id}`}
															>
																<div class="relative h-full w-full overflow-hidden rounded-xl border border-white/[0.08] shadow-[var(--glass-shadow-md)] transition-all duration-300 group-hover:scale-[1.02] group-hover:border-white/[0.14] group-hover:shadow-[var(--glass-shadow-xl)]">
																	{/* Image */}
																	<Show
																		fallback={
																			<div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/[0.04] to-white/[0.02]">
																				<span class="font-bold text-5xl text-white/20">
																					{item.Name?.charAt(0)}
																				</span>
																			</div>
																		}
																		when={item.Image}
																	>
																		<img
																			alt={item.Name ?? "Library"}
																			class="absolute inset-0 h-full w-full scale-[1.08] object-cover transition-transform duration-700 ease-out group-hover:scale-100"
																			src={item.Image}
																		/>
																	</Show>

																	{/* Gradient overlay */}
																	<div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent transition-all duration-300 group-hover:from-black/90 group-hover:via-black/40" />

																	{/* Amber top edge on hover */}
																	<div class="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/0 to-transparent transition-all duration-300 group-hover:via-amber-400/50" />

																	{/* Title */}
																	<div class="absolute right-0 bottom-0 left-0 p-3.5">
																		<h3 class="line-clamp-2 font-semibold text-sm text-white drop-shadow-lg">
																			{item.Name}
																		</h3>
																		<Show when={item.CollectionType}>
																			<p class="mt-0.5 text-white/50 text-xs capitalize tracking-wide">
																				{item.CollectionType}
																			</p>
																		</Show>
																	</div>
																</div>
															</a>
														)}
													</For>
												</div>
											</div>
										</Match>
									</Switch>
								)}
							</QueryBoundary>

							{/* ── Continue Watching ── */}
							<QueryBoundary
								loadingFallback={
									<LoadingSection
										aspect="aspect-video"
										count={4}
										name="continue watching"
										variant="video"
									/>
								}
								notFoundFallback={null}
								query={resumeItems}
							>
								{(data) => (
									<Show when={data.length > 0}>
										<div
											style={{
												animation:
													"fadeSlideUp 380ms cubic-bezier(0.22,1,0.36,1) both",
											}}
										>
											<SectionHeading
												count={data.length}
												label="Continue Watching"
											/>
											{/* Responsive grid: 1 col → 2 on sm → 3 on lg → 4 on xl; tighter gap */}
											<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
												<For each={data.slice(0, 4)}>
													{(item) => {
														const progressPercentage =
															item.UserData?.PlayedPercentage || 0;
														const isEpisode = item.Type === "Episode";
														const isMovie = item.Type === "Movie";

														// Remaining time derived from existing tick data
														const remainingMinutes = (() => {
															const totalTicks = item.RunTimeTicks ?? 0;
															const pos =
																item.UserData?.PlaybackPositionTicks ?? 0;
															if (totalTicks === 0 || pos === 0) {
																return null;
															}
															const remainingTicks = totalTicks - pos;
															const mins = Math.round(
																remainingTicks / 600_000_000,
															);
															if (mins <= 0) {
																return null;
															}
															if (mins < 60) {
																return `${mins}m left`;
															}
															const h = Math.floor(mins / 60);
															const m = mins % 60;
															return m > 0 ? `${h}h ${m}m left` : `${h}h left`;
														})();

														// Episode context label e.g. "S2 E4"
														const episodeLabel = (() => {
															if (!isEpisode) {
																return null;
															}
															const s = item.ParentIndexNumber;
															const e = item.IndexNumber;
															if (s != null && e != null) {
																return `S${s} E${e}`;
															}
															if (e != null) {
																return `E${e}`;
															}
															return null;
														})();

														return (
															<a class="group block" href={`/video/${item.Id}`}>
																{/* Card shell — glass border + subtle lift */}
																<div class="relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] shadow-[var(--glass-shadow-sm)] transition-all duration-300 group-hover:scale-[1.02] group-hover:border-white/[0.15] group-hover:shadow-[var(--glass-shadow-xl)]">
																	{/* Amber top-edge accent on hover */}
																	<div class="pointer-events-none absolute inset-x-0 top-0 z-30 h-px bg-gradient-to-r from-transparent via-amber-400/0 to-transparent transition-all duration-300 group-hover:via-amber-400/55" />

																	{/* Compact aspect — slightly letterboxed to reduce height */}
																	<div
																		class="relative overflow-hidden rounded-t-xl"
																		style="aspect-ratio: 16/8"
																	>
																		{/* Image */}
																		<Show
																			fallback={
																				<div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/[0.05] to-white/[0.02]">
																					<span class="font-bold text-3xl text-white/20">
																						{item.Name?.charAt(0)}
																					</span>
																				</div>
																			}
																			when={item.Image}
																		>
																			<img
																				alt={item.Name ?? "Item"}
																				class="h-full w-full scale-[1.06] object-cover transition-transform duration-700 ease-out group-hover:scale-100"
																				loading="lazy"
																				src={item.Image}
																			/>
																		</Show>

																		{/* Cinematic depth gradient */}
																		<div class="absolute inset-0 bg-gradient-to-t from-black/88 via-black/20 to-transparent" />

																		{/* Play button — appears on hover */}
																		<div class="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
																			<div class="scale-75 rounded-full border border-white/25 bg-black/40 p-3 shadow-[0_0_28px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-300 group-hover:scale-100 group-hover:border-amber-400/40 group-hover:bg-amber-400/10 group-hover:shadow-[0_0_36px_rgba(251,191,36,0.18)]">
																				<svg
																					class="h-5 w-5 fill-white transition-colors duration-300 group-hover:fill-amber-100"
																					viewBox="0 0 24 24"
																				>
																					<title>Play</title>
																					<path d="M8 5v14l11-7z" />
																				</svg>
																			</div>
																		</div>

																		{/* "Resume" chip — top-left */}
																		<div class="absolute top-2 left-2 z-10 flex items-center gap-1 rounded border border-amber-400/20 bg-amber-400/[0.10] px-1.5 py-0.5 backdrop-blur-sm">
																			<svg
																				aria-hidden="true"
																				class="h-2 w-2 shrink-0 text-amber-400"
																				fill="currentColor"
																				viewBox="0 0 24 24"
																			>
																				<path d="M8 5v14l11-7z" />
																			</svg>
																			<span class="font-semibold text-[9px] text-amber-300 uppercase tracking-widest">
																				Resume
																			</span>
																		</div>

																		{/* Episode label — top-right */}
																		<Show when={episodeLabel}>
																			<div class="absolute top-2 right-2 z-10 rounded border border-white/15 bg-black/55 px-1.5 py-0.5 font-semibold text-[9px] text-white/65 uppercase tracking-wider backdrop-blur-sm">
																				{episodeLabel}
																			</div>
																		</Show>

																		{/* Item Actions — on hover */}
																		<div class="absolute top-1.5 right-1.5 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
																			<ItemActions
																				item={item}
																				itemId={item.Id as string}
																				variant="card"
																			/>
																		</div>

																		{/* Compact metadata footer */}
																		<div class="absolute right-0 bottom-0 left-0 px-2.5 pt-4 pb-2.5">
																			{/* Series name (episodes only) */}
																			<Show when={isEpisode && item.SeriesName}>
																				<p class="mb-px line-clamp-1 font-semibold text-[10px] text-white/50 uppercase tracking-wide drop-shadow-lg">
																					{item.SeriesName}
																				</p>
																			</Show>
																			{/* Title */}
																			<h3 class="line-clamp-1 font-bold text-xs text-white drop-shadow-lg">
																				{item.Name}
																			</h3>
																			{/* Meta row */}
																			<div class="mt-0.5 flex items-center gap-1.5">
																				<Show
																					when={isMovie && item.ProductionYear}
																				>
																					<span class="text-[10px] text-white/40 drop-shadow-md">
																						{item.ProductionYear}
																					</span>
																				</Show>
																				<Show
																					when={
																						isEpisode &&
																						item.SeasonName &&
																						!episodeLabel
																					}
																				>
																					<span class="text-[10px] text-white/40 drop-shadow-md">
																						{item.SeasonName}
																					</span>
																				</Show>
																				<Show when={remainingMinutes}>
																					<span class="ml-auto rounded-sm bg-black/45 px-1 py-px font-medium text-[9px] text-white/45 tabular-nums backdrop-blur-sm">
																						{remainingMinutes}
																					</span>
																				</Show>
																			</div>
																		</div>

																		{/* Progress bar — thin, glowing amber */}
																		<Show
																			when={
																				progressPercentage > 0 &&
																				progressPercentage < 100
																			}
																		>
																			<div class="absolute right-0 bottom-0 left-0 h-[3px] bg-white/[0.07]">
																				<div
																					class="h-full rounded-r-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.55)] transition-all duration-500"
																					style={`width: ${progressPercentage}%`}
																				/>
																			</div>
																		</Show>
																	</div>
																</div>
															</a>
														);
													}}
												</For>
											</div>
										</div>
									</Show>
								)}
							</QueryBoundary>

							{/* ── Next Up ── */}
							<QueryBoundary
								loadingFallback={
									<LoadingSection
										aspect="aspect-video"
										count={4}
										name="next up"
										variant="video"
									/>
								}
								notFoundFallback={null}
								query={nextupItems}
							>
								{(data) => (
									<Show when={data.length > 0}>
										<div
											style={{
												animation:
													"fadeSlideUp 410ms cubic-bezier(0.22,1,0.36,1) both",
											}}
										>
											<SectionHeading count={data.length} label="Next Up" />
											<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
												<For each={data}>
													{(item) => <MainPageEpisodeCard item={item} />}
												</For>
											</div>
										</div>
									</Show>
								)}
							</QueryBoundary>
						</Show>

						{/* ── Latest / Search Movies ── */}
						<QueryBoundary
							loadingFallback={
								<LoadingSection
									aspect="aspect-2/3"
									count={7}
									name={searchTerm() ? "movies" : "latest movies"}
									variant="poster"
								/>
							}
							notFoundFallback={
								searchTerm() ? (
									<div
										class="space-y-3"
										style={{
											animation:
												"fadeSlideUp 300ms cubic-bezier(0.22,1,0.36,1) both",
										}}
									>
										<SectionHeading isSearch label="Movies" />
										<div class="flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] py-10 text-center">
											<p class="text-sm text-white/40">
												No movies match "{searchTerm()}"
											</p>
										</div>
									</div>
								) : null
							}
							query={latestMovies}
						>
							{(data) => (
								<Show when={data.length > 0}>
									<div
										style={{
											animation:
												"fadeSlideUp 440ms cubic-bezier(0.22,1,0.36,1) both",
										}}
									>
										<SectionHeading
											count={data.length}
											isSearch={!!searchTerm()}
											label="Latest Movies"
											searchLabel="Movies"
										/>
										<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
											<For each={data}>
												{(item) => <SeriesCard item={item} />}
											</For>
										</div>
									</div>
								</Show>
							)}
						</QueryBoundary>

						{/* ── Latest / Search TV Shows ── */}
						<QueryBoundary
							loadingFallback={
								<LoadingSection
									aspect="aspect-2/3"
									count={7}
									name={searchTerm() ? "tv shows" : "latest tv shows"}
									variant="poster"
								/>
							}
							notFoundFallback={
								searchTerm() ? (
									<div
										class="space-y-3"
										style={{
											animation:
												"fadeSlideUp 300ms cubic-bezier(0.22,1,0.36,1) both",
										}}
									>
										<SectionHeading isSearch label="TV Shows" />
										<div class="flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] py-10 text-center">
											<p class="text-sm text-white/40">
												No TV shows match "{searchTerm()}"
											</p>
										</div>
									</div>
								) : null
							}
							query={latestTVShows}
						>
							{(data) => (
								<Show when={data.length > 0}>
									<div
										style={{
											animation:
												"fadeSlideUp 470ms cubic-bezier(0.22,1,0.36,1) both",
										}}
									>
										<SectionHeading
											count={data.length}
											isSearch={!!searchTerm()}
											label="Latest TV Shows"
											searchLabel="TV Shows"
										/>
										<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
											<For each={data}>
												{(item) => <SeriesCard item={item} />}
											</For>
										</div>
									</div>
								</Show>
							)}
						</QueryBoundary>
					</div>
				</section>
			</Show>
		</section>
	);
}
