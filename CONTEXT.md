# Square Context

Square is a macOS-first Jellyfin desktop client that plays Jellyfin media through mpv and can show the same playback in a full video page or Picture-in-Picture.

## Language

**Playback Session**:
A single Jellyfin item being played through mpv, including its selected media source, progress reporting, track selection, and startup/cleanup lifecycle.
_Avoid_: player session, video hook, mpv session

**Playback Viewer**:
A UI surface that presents and controls an active **Playback Session**.
_Avoid_: player instance, session

**Primary Playback Viewer**:
The full video page **Playback Viewer** that owns creation and destruction of the **Playback Session**.
_Avoid_: route owner, main player

**Picture-in-Picture Viewer**:
A secondary **Playback Viewer** attached to the active **Playback Session** that cannot outlive the **Primary Playback Viewer**.
_Avoid_: independent player, floating session

**Media Source Anchor**:
The Jellyfin `MediaSourceId` plus optional `LiveStreamId` selected for all stream URLs, subtitle URLs, and playback reports in a **Playback Session**.
_Avoid_: source ids, playback info cache

**External Subtitle Injection**:
Loading Jellyfin external subtitle streams into mpv as selectable subtitle tracks after the media file has loaded.
_Avoid_: subtitle fetch, sidecar loading

**Jellyfin Playback Reporting**:
The start, progress, and stop playstate messages sent to Jellyfin for a **Playback Session**.
_Avoid_: progress sync, playstate calls

**Autoplay Prompt**:
A **Primary Playback Viewer** workflow that offers the next episode based on **Playback Session** progress or end-of-file state.
_Avoid_: session autoplay, player autoplay

## Relationships

- A **Playback Session** plays exactly one Jellyfin item.
- A **Playback Session** uses at most one **Media Source Anchor**.
- A **Primary Playback Viewer** owns at most one **Playback Session**.
- A **Picture-in-Picture Viewer** attaches to exactly one active **Playback Session** and is closed when its **Primary Playback Viewer** closes.
- A **Picture-in-Picture Viewer** may control an active **Playback Session** only while the **Primary Playback Viewer** still exists.
- A **Playback Session** owns the Jellyfin item metadata needed for playback startup, resume position, chapters, track selection, and reporting.
- **Jellyfin Playback Reporting** is required for every **Playback Session**.
- **External Subtitle Injection** uses the same **Media Source Anchor** as the media stream and **Jellyfin Playback Reporting**.
- An **Autoplay Prompt** observes **Playback Session** progress/end state; it does not own **Playback Session** lifecycle.

## Example dialogue

> **Dev:** "If the **Picture-in-Picture Viewer** is open and the user leaves the **Primary Playback Viewer**, should the **Playback Session** keep running?"
> **Domain expert:** "No — the **Picture-in-Picture Viewer** is only a secondary viewer. Leaving the **Primary Playback Viewer** closes Picture-in-Picture and clears mpv."

## Flagged ambiguities

- "session" can mean UI route state, mpv state, or Jellyfin playstate; resolved: **Playback Session** means the app-owned lifecycle for playing one Jellyfin item through mpv.
