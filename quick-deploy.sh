#!/bin/bash

# Quick deployment script for RSCORD
# This script compiles and deploys only the binaries to 5.35.83.143

SERVER_IP="5.35.83.143"
SERVER_USER="root"

echo "🚀 Quick deployment to $SERVER_IP"

# Build in release mode
echo "📦 Building services..."
cd servers
cargo build --release 2>&1 | grep -E "(Compiling|Finished|warning|error)"

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"

# Upload binaries directly
echo "📤 Uploading binaries..."
for service in gateway auth-service voice-service presence-service; do
    if [ -f "target/release/$service" ]; then
        echo "  Uploading $service..."
        scp target/release/$service ${SERVER_USER}@${SERVER_IP}:/opt/rscord/bin/ 2>/dev/null || {
            ssh ${SERVER_USER}@${SERVER_IP} "mkdir -p /opt/rscord/bin"
            scp target/release/$service ${SERVER_USER}@${SERVER_IP}:/opt/rscord/bin/
        }
    fi
done

# Upload config if it changed
echo "📤 Uploading configuration..."
scp production.toml ${SERVER_USER}@${SERVER_IP}:/opt/rscord/config/rscord.toml

# Restart services
echo "🔄 Restarting services..."
ssh ${SERVER_USER}@${SERVER_IP} << 'EOF'
for service in gateway auth-service voice-service presence-service; do
    if systemctl is-active --quiet rscord-$service; then
        echo "  Restarting rscord-$service..."
        systemctl restart rscord-$service
    else
        echo "  Starting rscord-$service..."
        systemctl start rscord-$service
    fi
done

sleep 2

echo ""
echo "=== Service Status ==="
for service in gateway auth-service voice-service presence-service; do
    status=$(systemctl is-active rscord-$service)
    if [ "$status" == "active" ]; then
        echo "  ✅ rscord-$service: active"
    else
        echo "  ❌ rscord-$service: $status"
    fi
done
EOF

echo ""
echo "✨ Deployment complete!"
echo "📍 Services available at:"
echo "   http://$SERVER_IP:14700 (Gateway)"
echo "   http://$SERVER_IP:14701 (Auth)"
echo "   http://$SERVER_IP:14705 (Voice)"
echo "   http://$SERVER_IP:14706 (Presence)"
