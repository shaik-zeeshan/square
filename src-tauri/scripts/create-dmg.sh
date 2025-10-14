#!/bin/bash

# Custom DMG creation script that preserves MPV library configuration
set -e

echo "Creating DMG with properly configured app bundle..."

# Get the app bundle path
APP_BUNDLE="target/release/bundle/macos/sreal.app"
DMG_NAME="sreal_0.1.0_aarch64"
DMG_PATH="target/release/bundle/dmg/${DMG_NAME}.dmg"

# Check if we're in the right directory
if [ ! -d "src-tauri" ]; then
    echo "Error: This script must be run from the project root directory"
    exit 1
fi

cd src-tauri

# Check if the app bundle exists
if [ ! -d "$APP_BUNDLE" ]; then
    echo "Error: App bundle not found at $APP_BUNDLE"
    echo "Make sure the Tauri build completed successfully"
    exit 1
fi

# Create a temporary directory for DMG creation
TEMP_DIR=$(mktemp -d)
echo "Using temporary directory: $TEMP_DIR"

# Copy the app bundle to the temp directory
echo "Copying app bundle to temporary directory..."
cp -R "$APP_BUNDLE" "$TEMP_DIR/"

# Create a symbolic link to Applications folder
echo "Creating Applications link..."
ln -s /Applications "$TEMP_DIR/Applications"

# Create the DMG
echo "Creating DMG..."
hdiutil create -volname "sreal" -srcfolder "$TEMP_DIR" -ov -format UDZO "$DMG_PATH"

# Clean up
echo "Cleaning up temporary directory..."
rm -rf "$TEMP_DIR"

echo "DMG created successfully at: $DMG_PATH"

