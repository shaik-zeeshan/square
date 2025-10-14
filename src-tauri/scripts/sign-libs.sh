#!/bin/bash

# Script to code sign dynamic libraries for macOS
# This is required to prevent code signature validation errors

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
DYLIB_DIR="$PROJECT_ROOT/lib/dylib"

echo "Code signing dynamic libraries in: $DYLIB_DIR"

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "This script is only for macOS"
    exit 1
fi

# Check if codesign is available
if ! command -v codesign &> /dev/null; then
    echo "codesign command not found"
    exit 1
fi

# Function to sign a library
sign_library() {
    local lib_path="$1"
    local lib_name=$(basename "$lib_path")
    
    echo "Signing: $lib_name"
    
    # Remove any existing signature
    codesign --remove-signature "$lib_path" 2>/dev/null || true
    
    # Sign with ad-hoc signature, ensuring compatibility and same Team ID
    codesign --force --sign - --timestamp=none --options runtime "$lib_path"
    
    # Verify the signature
    if codesign --verify --verbose "$lib_path" 2>/dev/null; then
        echo "✓ Successfully signed: $lib_name"
    else
        echo "✗ Failed to sign: $lib_name"
        return 1
    fi
}

# Sign all .dylib files
if [ -d "$DYLIB_DIR" ]; then
    for dylib in "$DYLIB_DIR"/*.dylib; do
        if [ -f "$dylib" ]; then
            sign_library "$dylib"
        fi
    done
    echo "All dynamic libraries have been code signed"
else
    echo "Error: Dylib directory not found: $DYLIB_DIR"
    exit 1
fi
