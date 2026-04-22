# Square

Square is a macOS-first Jellyfin desktop client built with Tauri, SolidStart, and `mpv`.

## Highlights

- Native `mpv` playback inside Tauri with buffering state, chapters, playback speed, fullscreen, and Picture-in-Picture.
- Audio and subtitle track switching, plus external subtitle injection into `mpv` so streamed subtitle URLs show up as normal selectable tracks.
- Persistent playback preferences for default audio/subtitle languages, with per-series overrides automatically learned from manual track changes.
- External player handoff to the system default app, IINA, or VLC.
- Jellyfin authentication and integration secrets stored via Stronghold and the OS keyring.
- Built-in updater support for GitHub release artifacts.

## Integrations

Square ships with a built-in capability-driven integration registry.

| Provider | Capabilities |
| --- | --- |
| Jellyseerr | `connect`, `validate`, `search`, `request` |
| Sonarr | `connect`, `validate`, `search`, `add_series` |
| Radarr | `connect`, `validate`, `search`, `add_movie` |

- Connections are validated through native Tauri HTTP commands instead of browser fetch/CORS.
- Saved integrations can be managed from Settings.
- Global search is available from the main app and uses `/` as the shortcut to search providers and run supported actions.

## Playback Shortcuts

| Shortcut | Action |
| --- | --- |
| `Space`, `K` | Play / pause |
| `J`, `L`, `Left`, `Right` | Seek backward / forward |
| `Up`, `Down` | Seek +/- 1 minute |
| `A`, `S` | Cycle audio / subtitles |
| `C`, `,`, `.` | Open chapters, previous chapter, next chapter |
| `[`, `]`, `\\` | Speed down, speed up, reset speed |
| `P` | Open Picture-in-Picture |
| `I`, `?` | Toggle shortcut help |
| `Esc` | Close panels or leave playback |

## Development

### Requirements

- macOS 11+ (current target platform)
- Bun
- Node.js 22+
- Rust 1.77.2+
- Xcode Command Line Tools
- Homebrew packages used by the build pipeline

Install the native build dependencies with:

```sh
make install-deps
```

### Setup

Install JavaScript dependencies:

```sh
bun install
```

Fetch and sign the bundled `mpv`/FFmpeg dylibs:

```sh
make sign-dylibs
```

### Run locally

Start the Tauri app in development mode:

```sh
make dev
```

If you only need the frontend dev server:

```sh
bun run localdev
```

### Build

Build the desktop app:

```sh
make build-app
```

Build a DMG:

```sh
make build-dmg
```

Run the CI-style build flow locally:

```sh
make ci-build
```
