# Square Context

Square is a macOS-first Jellyfin desktop client. This context captures the project language used when discussing media browsing, playback, account access, and external media integrations.

## Language

**Jellyfin Catalogue**:
The Square-owned view of Jellyfin libraries, media items, media rails, and their display-ready artwork.
_Avoid_: Jellyfin service, catalogue API, BaseItemDto wrapper

**Media Item**:
A Square-owned media data shape for a movie, series, season, episode, or library entry shown or played by Square.
_Avoid_: BaseItemDto, item DTO

**Library**:
A Jellyfin collection of media items, currently movies or TV shows in Square.
_Avoid_: folder, collection view

**Media Rail**:
A horizontal group of media items on the home screen, such as resume, next up, or latest media.
_Avoid_: section, carousel

**Artwork**:
Display-ready image URLs for a media item, including primary, backdrop, and logo images when available.
_Avoid_: image tags, Images map

**Playback Metadata**:
The Jellyfin-derived stream, source, chapter, and track summary data needed to start playback or inspect available audio/subtitle languages.
_Avoid_: MediaStreams, MediaSources, raw playback info

## Relationships

- A **Jellyfin Catalogue** contains zero or more **Libraries**.
- A **Library** contains zero or more **Media Items**.
- A **Media Rail** contains zero or more **Media Items**.
- A **Media Item** has zero or more **Artwork** URLs.

## Example dialogue

> **Dev:** "Should the home page call Jellyfin directly for resume items?"
> **Domain expert:** "No — ask the **Jellyfin Catalogue** for the resume **Media Rail** so empty results and **Artwork** fallback rules stay consistent."

## Flagged ambiguities

- "item" was used to mean both raw Jellyfin `BaseItemDto` and Square display data — resolved: use **Media Item** for Square-owned data and mention raw Jellyfin DTOs only inside the **Jellyfin Catalogue** implementation.
