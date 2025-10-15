# Makefile for building Tauri app with MPV dynamic linking
# Downloads dynamic libraries from IINA repository and builds the app

# Detect system architecture and OS
UNAME_S := $(shell uname -s)
UNAME_M := $(shell uname -m)

# Set default architecture based on system
ifeq ($(UNAME_S),Darwin)
    ifeq ($(UNAME_M),arm64)
        ARCH := arm64
    else
        ARCH := x86_64
    endif
    OS := macos
    # Use universal libraries from IINA for macOS
    DYLIBS_ARCH := universal
    DYLIBS_URL := https://iina.io/dylibs/$(DYLIBS_ARCH)
    FILELIST_URL := $(DYLIBS_URL)/filelist.txt
    # macOS dependencies
    BUILD_DEPS := git pkg-config cmake nasm yasm autoconf automake libtool meson ninja curl
    PACKAGE_MANAGER := brew
else ifeq ($(UNAME_S),Linux)
    ARCH := x86_64
    OS := linux
    DYLIBS_ARCH := x86_64
    DYLIBS_URL := https://iina.io/dylibs/$(DYLIBS_ARCH)
    FILELIST_URL := $(DYLIBS_URL)/filelist.txt
    # Linux dependencies
    BUILD_DEPS := git pkg-config cmake build-essential nasm yasm autoconf automake libtool meson ninja-build curl
    PACKAGE_MANAGER := apt
else
    # Windows (assume x86_64)
    ARCH := x86_64
    OS := windows
    DYLIBS_ARCH := x86_64
    DYLIBS_URL := https://iina.io/dylibs/$(DYLIBS_ARCH)
    FILELIST_URL := $(DYLIBS_URL)/filelist.txt
    # Windows dependencies (MSYS2)
    BUILD_DEPS := git pkgconf cmake mingw-w64-x86_64-toolchain autoconf automake libtool meson ninja curl
    PACKAGE_MANAGER := pacman
endif

# Build directories
DYLIB_DIR := lib/dylib
TEMP_DIR := /tmp/sreal-build
FILELIST_FILE := $(TEMP_DIR)/filelist.txt

# Default target
.PHONY: all
all: download-dylibs build-app

# Install build dependencies
.PHONY: install-deps
install-deps:
	@echo "Installing build dependencies for $(OS)..."
ifeq ($(OS),macos)
	@$(PACKAGE_MANAGER) install $(BUILD_DEPS)
else ifeq ($(OS),linux)
	@sudo $(PACKAGE_MANAGER) update
	@sudo $(PACKAGE_MANAGER) install -y $(BUILD_DEPS)
else
	@$(PACKAGE_MANAGER) -S $(BUILD_DEPS)
endif
	@echo "Build dependencies installed!"

# Remove build dependencies
.PHONY: remove-deps
remove-deps:
	@echo "Removing build dependencies for $(OS)..."
ifeq ($(OS),macos)
	@$(PACKAGE_MANAGER) uninstall $(BUILD_DEPS) || true
else ifeq ($(OS),linux)
	@sudo $(PACKAGE_MANAGER) remove -y $(BUILD_DEPS) || true
else
	@$(PACKAGE_MANAGER) -R $(BUILD_DEPS) || true
endif
	@echo "Build dependencies removed!"

# Check which dependencies are installed
.PHONY: check-deps
check-deps:
	@echo "Checking build dependencies for $(OS)..."
ifeq ($(OS),macos)
	@for dep in $(BUILD_DEPS); do \
		if $(PACKAGE_MANAGER) list | grep -q "$$dep"; then \
			echo "✅ $$dep - installed"; \
		else \
			echo "❌ $$dep - not installed"; \
		fi; \
	done
else ifeq ($(OS),linux)
	@for dep in $(BUILD_DEPS); do \
		if dpkg -l | grep -q "$$dep"; then \
			echo "✅ $$dep - installed"; \
		else \
			echo "❌ $$dep - not installed"; \
		fi; \
	done
else
	@for dep in $(BUILD_DEPS); do \
		if $(PACKAGE_MANAGER) -Q | grep -q "$$dep"; then \
			echo "✅ $$dep - installed"; \
		else \
			echo "❌ $$dep - not installed"; \
		fi; \
	done
endif

# Download file list from IINA repository
$(FILELIST_FILE):
	@echo "Downloading file list from IINA repository..."
	@mkdir -p $(TEMP_DIR)
	@curl -s $(FILELIST_URL) -o $(FILELIST_FILE)
	@echo "File list downloaded to: $(FILELIST_FILE)"

# Download dynamic libraries from IINA repository
.PHONY: download-dylibs
download-dylibs: $(FILELIST_FILE)
	@echo "Downloading dynamic libraries from IINA repository..."
	@echo "Architecture: $(DYLIBS_ARCH)"
	@echo "URL: $(DYLIBS_URL)"
	@mkdir -p $(DYLIB_DIR)
	@echo "Downloading libraries to: $(DYLIB_DIR)"
	@while IFS= read -r filename; do \
		if [ -n "$$filename" ]; then \
			if [ -f "$(DYLIB_DIR)/$$filename" ]; then \
				echo "⏭️  Skipping $$filename (already exists)"; \
			else \
				echo "Downloading: $$filename"; \
				curl -s "$(DYLIBS_URL)/$$filename" -o "$(DYLIB_DIR)/$$filename"; \
				if [ $$? -eq 0 ]; then \
					echo "✅ $$filename"; \
				else \
					echo "❌ Failed to download $$filename"; \
					exit 1; \
				fi; \
			fi; \
		fi; \
	done < $(FILELIST_FILE)
	@echo "All dynamic libraries downloaded successfully!"

# Create symlink for libmpv (needed for linking)
.PHONY: create-symlink
create-symlink: download-dylibs
	@echo "Creating symlink for libmpv..."
	@cd $(DYLIB_DIR) && \
		if [ -f "libmpv.2.dylib" ] && [ ! -L "libmpv.dylib" ]; then \
			ln -sf libmpv.2.dylib libmpv.dylib; \
			echo "✅ Created symlink: libmpv.dylib -> libmpv.2.dylib"; \
		else \
			echo "⚠️  Symlink already exists or libmpv.2.dylib not found"; \
		fi

# Sign dynamic libraries (macOS only)
.PHONY: sign-dylibs
sign-dylibs: create-symlink
ifeq ($(OS),macos)
	@echo "Signing dynamic libraries for macOS..."
	@if [ -f "src-tauri/scripts/sign-libs.sh" ]; then \
		chmod +x src-tauri/scripts/sign-libs.sh; \
		./src-tauri/scripts/sign-libs.sh; \
		echo "✅ Dynamic libraries signed successfully!"; \
	else \
		echo "⚠️  Sign script not found, skipping code signing"; \
	fi
else
	@echo "Code signing not needed for $(OS)"
endif

# Build Tauri application
.PHONY: build-app
build-app: sign-dylibs
	@echo "Building Tauri application..."
	@bun run tauri build
	@echo "✅ Tauri application built successfully!"

# Build Tauri application and create DMG file
.PHONY: build-dmg
build-dmg: sign-dylibs
	@echo "Building Tauri application and creating DMG..."
	@bun run tauri build --bundles dmg
	@echo "✅ DMG build completed successfully!"
	@echo "DMG file location: src-tauri/target/release/bundle/dmg/"

# CI/CD build target - combines all steps from GitHub workflow
.PHONY: ci-build
ci-build:
	@echo "Starting CI/CD build process..."
	@echo "Step 1: Downloading and setting up dynamic libraries..."
	@$(MAKE) download-dylibs
	@echo "Step 2: Code signing dynamic libraries..."
	@$(MAKE) sign-dylibs
	@echo "Step 3: Building frontend..."
	@bun run build
	@echo "Step 4: Building Tauri app with DMG..."
	@APPLE_SIGNING_IDENTITY="-" bun run tauri build --bundles dmg
	@echo "✅ CI/CD build completed successfully!"
	@echo "DMG file location: src-tauri/target/release/bundle/dmg/"

# Start Tauri development server
.PHONY: dev
dev: sign-dylibs
	@echo "Starting Tauri development server..."
	@bun run tauri dev

# Test the built application
.PHONY: test
test: build-app
	@echo "Testing the built application..."
ifeq ($(OS),macos)
	@open src-tauri/target/release/bundle/macos/sreal.app
	@echo "✅ Application launched for testing"
else
	@echo "Manual testing required for $(OS)"
	@echo "Application location: src-tauri/target/release/"
endif

# Verify dynamic libraries
.PHONY: verify-dylibs
verify-dylibs: download-dylibs
	@echo "Verifying downloaded dynamic libraries..."
	@echo "Checking $(DYLIB_DIR) directory..."
	@ls -la $(DYLIB_DIR) | head -10
	@echo ""
	@echo "Total files: $$(ls -1 $(DYLIB_DIR) | wc -l)"
	@echo "Total size: $$(du -sh $(DYLIB_DIR) | cut -f1)"
	@echo ""
	@echo "Key libraries:"
	@for lib in libmpv.2.dylib libavcodec.61.dylib libavformat.61.dylib; do \
		if [ -f "$(DYLIB_DIR)/$$lib" ]; then \
			echo "✅ $$lib"; \
		else \
			echo "❌ $$lib - missing"; \
		fi; \
	done

# Clean build artifacts
.PHONY: clean
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf $(TEMP_DIR)
	@rm -rf $(DYLIB_DIR)
	@rm -rf src-tauri/target
	@echo "✅ Build artifacts cleaned!"

# Clean everything including dependencies
.PHONY: clean-all
clean-all: clean remove-deps
	@echo "✅ Everything cleaned!"

# Show help
.PHONY: help
help:
	@echo "SReal Tauri App Build System"
	@echo "============================"
	@echo ""
	@echo "Main Targets:"
	@echo "  all                   - Download dylibs and build app (default)"
	@echo "  ci-build              - Complete CI/CD build (download, sign, build frontend & DMG)"
	@echo "  download-dylibs       - Download dynamic libraries from IINA repository"
	@echo "  create-symlink        - Create libmpv symlink for linking"
	@echo "  sign-dylibs           - Sign dynamic libraries (macOS only)"
	@echo "  build-app             - Build Tauri application"
	@echo "  build-dmg             - Build Tauri application and create DMG file"
	@echo "  dev                   - Start Tauri development server"
	@echo "  test                  - Test the built application"
	@echo "  verify-dylibs         - Verify downloaded dynamic libraries"
	@echo ""
	@echo "Dependency Management:"
	@echo "  install-deps          - Install build dependencies"
	@echo "  remove-deps           - Remove build dependencies"
	@echo "  check-deps            - Check which dependencies are installed"
	@echo ""
	@echo "Cleanup:"
	@echo "  clean                 - Clean build artifacts"
	@echo "  clean-all             - Clean everything including dependencies"
	@echo ""
	@echo "Current System: $(OS) $(ARCH)"
	@echo "Dynamic Libraries: $(DYLIBS_ARCH)"
	@echo "Download URL: $(DYLIBS_URL)"