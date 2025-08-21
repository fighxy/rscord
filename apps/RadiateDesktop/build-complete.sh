#!/bin/bash

echo "🚀 RSCORD Desktop - Complete Build & Integration Script"
echo "======================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Not in the desktop app directory!"
    exit 1
fi

# Step 1: Install Node dependencies
print_status "Installing Node.js dependencies..."
npm install

# Step 2: Build the frontend
print_status "Building frontend with Vite..."
npm run build

# Step 3: Build Tauri application
print_status "Building Tauri application..."
npm run tauri build

# Step 4: Check server connection
print_status "Checking connection to backend server (5.35.83.143:14700)..."
if curl -s -o /dev/null -w "%{http_code}" http://5.35.83.143:14700/health | grep -q "200"; then
    print_status "Backend server is reachable!"
else
    print_warning "Backend server is not reachable. The app will work in offline mode."
fi

# Step 5: Summary
echo ""
echo "======================================================="
print_status "Build complete!"
echo ""
echo "📦 Built files location:"
echo "   - Windows: src-tauri/target/release/bundle/msi/"
echo "   - Linux: src-tauri/target/release/bundle/appimage/"
echo "   - macOS: src-tauri/target/release/bundle/dmg/"
echo ""
echo "🚀 To run in development mode: npm run tauri dev"
echo "📱 To install: Run the installer from the bundle directory"
echo ""
echo "======================================================="
