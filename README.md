# Square

A modern Jellyfin client built with Tauri, featuring high-performance MPV integration and comprehensive media server support. (Only macos for now)

## Plugin-based Integrations

Square supports a plugin system for third-party service integrations. Plugins are defined as built-in descriptors in a static registry and expose a consistent capability-driven interface (connect, validate, search, and provider-specific actions).

**Shipped providers:**

| Provider | Capabilities |
|---|---|
| Jellyseerr | connect, validate, search, request |
| Sonarr | connect, validate, search, add\_series |
| Radarr | connect, validate, search, add\_movie |

All providers also support removing a saved connection at runtime.

## TODO

- [x] Jellyfin integration
- [x] MPV player integration
- [x] PIP (Picture-in-Picture)
- [x] Effect-ts
- [x] Plugin-based integrations (Jellyseerr, Sonarr, Radarr)
- [ ] Improve Video Player and PIP (WIP)
- [ ] Other....
