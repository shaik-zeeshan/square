# Square

A modern Jellyfin client built with Tauri, featuring high-performance MPV integration and comprehensive media server support.

## 🎯 Overview

Square is a sleek desktop Jellyfin client designed for seamless integration with your media server. Built with modern web technologies and native performance, it provides a beautiful interface for browsing and playing your Jellyfin media library.

## ✨ Key Features

### 🏠 Jellyfin Integration
- **Server Discovery**: Automatic detection of Jellyfin servers on your network
- **Multi-User Support**: Switch between user profiles seamlessly
- **Library Browsing**: Browse movies, TV shows, and media collections
- **Smart Collections**: Continue watching, next up, and latest media sections
- **Search Functionality**: Quick search across your entire media library

### 🎬 Media Playback
- **High-Performance Video**: MPV-powered playback with hardware acceleration
- **Comprehensive Format Support**: Wide codec compatibility through FFmpeg
- **Picture-in-Picture**: Native PiP support for multitasking
- **Advanced Controls**: Keyboard shortcuts, playback speed control, and volume management
- **Resume Playback**: Automatically track and resume from where you left off

### 🔧 Technical Excellence
- **macOS Native**: Optimized for macOS with proper code signing
- **Type-Safe**: Full TypeScript implementation from frontend to backend
- **Modern Stack**: Built with SolidJS, Tauri, and Rust
- **Secure**: Proper code signing and sandboxing
- **Offline Capable**: Local caching and offline playback support

## 🛠️ Technology Stack

### Frontend
- **SolidJS**: Reactive UI framework for optimal performance
- **SolidStart**: Full-stack SolidJS framework
- **Tailwind CSS**: Utility-first styling with custom glass morphism
- **TanStack Query**: Powerful data fetching and caching

### Backend
- **Tauri**: Lightweight, secure desktop app framework
- **Rust**: Systems programming for performance and safety
- **libmpv2**: Rust bindings for MPV media player
- **OpenGL**: Hardware-accelerated graphics rendering

### Integration
- **Jellyfin SDK**: Official Jellyfin API client
- **Stronghold**: Secure credential storage
- **HTTP Plugin**: Native HTTP requests

## 🚀 Getting Started

### Prerequisites
- **Node.js**: >= 22
- **Bun**: Latest version for package management
- **Rust**: Latest stable version
- **Platform-specific build tools** (handled automatically by Makefile)

### Quick Setup

```bash
# Clone the repository
git clone https://github.com/shaik-zeeshan/square.git
cd square

# Install dependencies
bun install

# Setup MPV and dynamic libraries (automatic)
make download-dylibs

# Start development server
make dev
```

## 🏗️ Build System

Square uses a sophisticated Makefile-based build system that handles everything automatically:

### Platform Support
- **macOS**: Universal binaries (Apple Silicon + Intel) with proper code signing

### Automated Features
- **Library Management**: Downloads MPV/FFmpeg libraries from IINA repository
- **Code Signing**: Automatic ad-hoc signing for macOS
- **Dependency Resolution**: Installs platform-specific build dependencies
- **Cross-Compilation**: Builds for all target platforms

### Build Commands

```bash
# Development
make dev              # Start development server
make build            # Build for production
make test             # Run tests

# Library Management
make download-dylibs  # Download MPV/FFmpeg libraries
make sign-dylibs      # Sign libraries (macOS)
make verify-dylibs    # Verify library integrity

# Release Builds
make build-app        # Build complete application
make build-dmg        # Build with DMG creation (macOS)
make ci-build         # Complete CI/CD build process

# Maintenance
make clean            # Clean build artifacts
make install-deps     # Install build dependencies
make check-deps       # Verify dependencies
```

## 📦 Distribution

### Automated Releases
Releases are triggered automatically when commits contain "release" in the message:

```bash
git commit -m "feat: add new feature - release"
git push origin main
```

This triggers a complete CI/CD pipeline that:
1. Builds for macOS
2. Creates signed DMG installer
3. Generates GitHub releases with artifacts
4. Uploads binaries for 30 days

### Manual Builds
```bash
# Platform-specific builds
make build-dmg    # macOS DMG
make build-app    # macOS application

# Artifacts location:
# - src-tauri/target/release/bundle/dmg/ (macOS DMG)
```

## 🎮 Usage

### First-Time Setup
1. Launch Square
2. Discover or manually add your Jellyfin server
3. Select your user profile and sign in
4. Browse your media library and start watching

### Keyboard Shortcuts
- **Space**: Play/Pause
- **Arrow Keys**: Seek (←/→) and Volume (↑/↓)
- **F**: Fullscreen toggle
- **P**: Picture-in-Picture toggle
- **M**: Mute/Unmute
- **?**: Show help overlay

### Features at a Glance
- **Dashboard**: Home screen with continue watching, next up, and latest media
- **Library View**: Browse by movies, TV shows, or custom collections
- **Video Player**: Full-featured player with subtitles, audio tracks, and playback controls
- **Search**: Instant search across your entire media library
- **Settings**: Configure playback, server connections, and user preferences

## 🔧 Configuration

### Application Settings
Configuration is stored in:
- **macOS**: `~/Library/Application Support/com.square.media/`

### Environment Variables
```bash
TAURI_DEV_HOST=1          # Enable development mode
RUST_LOG=debug           # Enable debug logging
```

### Code Signing (Production)
Update `src-tauri/tauri.conf.json` for production signing:

```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: Your Name"
    }
  }
}
```

## 🧪 Development

### Project Structure
```
square/
├── src/                    # Frontend source (SolidJS)
│   ├── components/         # UI components
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Utilities and libraries
│   ├── routes/            # Application routes
│   └── types/             # TypeScript definitions
├── src-tauri/             # Tauri backend (Rust)
│   ├── src/               # Rust source code
│   ├── scripts/           # Build and signing scripts
│   └── tauri.conf.json    # Tauri configuration
├── lib/dylib/             # Dynamic libraries (MPV, FFmpeg)
├── Makefile               # Build system
└── package.json           # Node.js dependencies
```

### Testing
```bash
# Frontend tests
bun test

# Backend tests
cd src-tauri && cargo test

# Integration tests
make test
```

### Code Quality
- **Biome**: Linting and formatting
- **TypeScript**: Full type coverage
- **Husky**: Git hooks for pre-commit checks
- **Conventional Commits**: Standardized commit messages

## 🤝 Contributing

We welcome contributions! Please follow our guidelines:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** with conventional messages: `git commit -m 'feat: add amazing feature'`
4. **Push** to your branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Development Guidelines
- Follow existing code style and patterns
- Add tests for new features
- Update documentation as needed
- Ensure all checks pass before submitting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[Tauri](https://tauri.app/)** - Incredible desktop app framework
- **[SolidJS](https://www.solidjs.com/)** - Performant reactive UI library
- **[MPV](https://mpv.io/)** - Powerful media player engine
- **[IINA](https://iina.io/)** - Dynamic library repository and inspiration
- **[Jellyfin](https://jellyfin.org/)** - Open source media server
- **[libmpv2](https://github.com/kohsine/libmpv2-rs)** - Rust bindings for MPV
- **[Anime.js](https://animejs.com/)** - Smooth animations and transitions

---

**Square** - Where your media library meets modern design. Enjoy your favorite content in style.
