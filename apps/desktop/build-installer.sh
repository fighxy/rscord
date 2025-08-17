#!/bin/bash

echo "Building RSCord Desktop Application..."
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH"
    exit 1
fi

# Check if Rust is installed
if ! command -v rustc &> /dev/null; then
    echo "Error: Rust is not installed or not in PATH"
    exit 1
fi

# Check if Tauri CLI is installed
if ! command -v tauri &> /dev/null; then
    echo "Installing Tauri CLI..."
    npm install -g @tauri-apps/cli
fi

echo
echo "Installing dependencies..."
npm install

echo
echo "Building frontend..."
npm run build

echo
echo "Building Tauri application..."
tauri build

echo
echo "Build completed successfully!"
echo
echo "Installers can be found in:"
echo "- src-tauri/target/release/bundle/msi/ (Windows MSI)"
echo "- src-tauri/target/release/bundle/nsis/ (Windows NSIS)"
echo "- src-tauri/target/release/bundle/appimage/ (Linux AppImage)"
echo "- src-tauri/target/release/bundle/deb/ (Linux DEB)"
echo "- src-tauri/target/release/bundle/dmg/ (macOS DMG)"
echo
