#!/bin/bash

# Quick fix and build script for RSCORD

echo "🔧 Fixing compilation warnings and errors..."

cd servers

# Auto-fix warnings
echo "Running cargo fix..."
cargo fix --allow-dirty --allow-staged 2>/dev/null

# Build with error details
echo ""
echo "🔨 Building services..."
cargo build --release 2>&1 | tee build.log

# Check if build succeeded
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo ""
    echo "Binary sizes:"
    ls -lh target/release/gateway target/release/auth-service target/release/voice-service target/release/presence-service 2>/dev/null | awk '{print $9 ": " $5}'
    
    echo ""
    echo "Ready to deploy with: ./quick-deploy.sh"
else
    echo ""
    echo "❌ Build failed! Check build.log for details"
    echo ""
    echo "Common fixes:"
    echo "1. Run: cargo update"
    echo "2. Clean build: cargo clean && cargo build --release"
    echo "3. Check Rust version: rustc --version"
fi
