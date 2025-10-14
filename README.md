# SReal

A modern, cross-platform media player built with Tauri, featuring MPV integration and Jellyfin server support.

## 🚀 Features

- **Cross-Platform**: Runs on macOS, Linux, and Windows
- **MPV Integration**: High-performance video playback with MPV
- **Jellyfin Support**: Connect to your Jellyfin media server
- **Modern UI**: Built with SolidJS and Tailwind CSS
- **Code Signed**: Properly signed for macOS distribution
- **Automated Builds**: CI/CD with GitHub Actions

## 🛠️ Development

### Prerequisites

- **Node.js**: >= 22
- **Bun**: Latest version
- **Rust**: Latest stable version
- **System Dependencies**: See Makefile for platform-specific requirements

### Quick Start

```bash
# Clone the repository
git clone https://github.com/shaik-zeeshan/sreal.git
cd sreal

# Install dependencies
bun install

# Setup MPV and dynamic libraries
make download-dylibs

# Start development server
make dev
```

### Available Commands

```bash
# Development
make dev              # Start development server
make build            # Build the application
make test             # Test the application

# Library Management
make download-dylibs  # Download MPV/FFmpeg libraries
make sign-dylibs      # Sign libraries (macOS only)
make verify-dylibs    # Verify downloaded libraries

# Build & Release
make build-app        # Build Tauri application
make build-dmg        # Build with DMG creation (macOS)
make clean            # Clean build artifacts

# Dependencies
make install-deps     # Install build dependencies
make check-deps       # Check installed dependencies
make remove-deps      # Remove build dependencies
```

## 🏗️ Build System

The project uses a sophisticated Makefile-based build system that:

- **Automatically detects** your platform (macOS ARM64/Intel, Linux, Windows)
- **Downloads** MPV and FFmpeg libraries from the IINA repository
- **Signs** dynamic libraries for macOS distribution
- **Builds** cross-platform Tauri applications
- **Manages** all build dependencies automatically

### Architecture Support

- **macOS**: Universal binaries (ARM64 + Intel)
- **Linux**: x86_64
- **Windows**: x86_64

## 📦 Distribution

### Release Process

Releases are automatically triggered when you commit with the word "release" in the commit message:

```bash
git commit -m "feat: add new feature - release"
git push origin main
```

This will:
1. Build the application for all platforms
2. Create signed installers (DMG, DEB, MSI, AppImage)
3. Generate a GitHub release with all artifacts
4. Upload artifacts for 30 days

### Manual Release

```bash
# Build for current platform
make build-dmg    # macOS
make build-app    # All platforms

# Artifacts will be in:
# - src-tauri/target/release/bundle/dmg/ (macOS DMG)
# - src-tauri/target/release/bundle/deb/ (Linux DEB)
# - src-tauri/target/release/bundle/msi/ (Windows MSI)
```

## 🔧 Configuration

### Tauri Configuration

The app is configured in `src-tauri/tauri.conf.json`:

- **Bundle ID**: `com.sreal.media`
- **Signing**: Ad-hoc signing for development, configurable for production
- **Entitlements**: Configured for dynamic library loading
- **Resources**: All MPV/FFmpeg libraries included

### Code Signing

For production releases, update the signing configuration:

```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: Your Name"
    }
  }
}
```

## 🧪 Testing

```bash
# Run all tests
make test

# Run specific tests
bun test                    # Frontend tests
cd src-tauri && cargo test  # Rust tests
```

## 📁 Project Structure

```
sreal/
├── .github/                 # GitHub Actions workflows
├── lib/dylib/              # Dynamic libraries (MPV, FFmpeg)
├── src/                    # Frontend source code
├── src-tauri/              # Tauri backend
│   ├── scripts/            # Build scripts
│   ├── src/                # Rust source code
│   └── tauri.conf.json     # Tauri configuration
├── Makefile                # Build system
└── package.json            # Node.js dependencies
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Use conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Tauri](https://tauri.app/) - Desktop app framework
- [MPV](https://mpv.io/) - Media player
- [IINA](https://iina.io/) - For the dynamic library repository
- [Jellyfin](https://jellyfin.org/) - Media server
- [SolidJS](https://www.solidjs.com/) - Frontend framework