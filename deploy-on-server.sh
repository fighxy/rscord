#!/bin/bash

# Build and deploy script - RUN THIS ON THE SERVER
# This script compiles and deploys RSCORD services locally on the server

set -e

echo "======================================="
echo "   RSCORD Build & Deploy (On Server)"
echo "======================================="

# Check if we're in the right directory
if [ ! -f "servers/Cargo.toml" ]; then
    echo "❌ Error: Not in RSCORD directory!"
    echo "Please run from /root/rscord"
    exit 1
fi

# Step 1: Build the services
echo "🔨 Building services..."
cd servers

# Build in release mode, continue even if some warnings
cargo build --release 2>&1 | grep -E "(Compiling|Finished|error)" || true

echo ""
echo "📦 Checking built binaries..."

# Step 2: Copy successful builds to /opt/rscord/bin
echo "📤 Installing binaries..."
mkdir -p /opt/rscord/bin

# Copy only if binary exists
if [ -f "target/release/gateway" ]; then
    cp target/release/gateway /opt/rscord/bin/
    echo "✅ Gateway installed"
else
    echo "❌ Gateway not built (check errors above)"
fi

if [ -f "target/release/auth-service" ]; then
    cp target/release/auth-service /opt/rscord/bin/
    echo "✅ Auth Service installed"
else
    echo "❌ Auth Service not built"
fi

if [ -f "target/release/voice-service" ]; then
    cp target/release/voice-service /opt/rscord/bin/
    echo "✅ Voice Service installed"
else
    echo "❌ Voice Service not built"
fi

if [ -f "target/release/presence-service" ]; then
    cp target/release/presence-service /opt/rscord/bin/
    echo "✅ Presence Service installed"
else
    echo "❌ Presence Service not built"
fi

cd ..

# Step 3: Copy configuration
echo ""
echo "📝 Installing configuration..."
mkdir -p /opt/rscord/config
if [ -f "servers/production.toml" ]; then
    cp servers/production.toml /opt/rscord/config/rscord.toml
else
    # Create basic config if production.toml doesn't exist
    cat > /opt/rscord/config/rscord.toml << 'EOF'
[server]
host = "0.0.0.0"

[database]
mongodb_uri = "mongodb://127.0.0.1:27017"
mongodb_database = "rscord"

[cache]
redis_url = "redis://127.0.0.1:6379"

[messaging]
rabbitmq_url = "amqp://127.0.0.1:5672"

[auth]
jwt_secret = "CHANGE_THIS_SECRET_KEY_IN_PRODUCTION_2024"
jwt_expiry = "7d"
EOF
fi

# Step 4: Check and start infrastructure
echo ""
echo "🐳 Checking Docker services..."
docker ps --format "table {{.Names}}\t{{.Status}}" | grep rscord || {
    echo "Starting infrastructure services..."
    if [ -f "docker-compose-infra.yml" ]; then
        docker-compose -f docker-compose-infra.yml up -d
    else
        echo "⚠️  Docker services not configured. Run setup-server.sh first!"
    fi
}

# Step 5: Restart services
echo ""
echo "🔄 Restarting services..."

for service in gateway auth-service voice-service presence-service; do
    if [ -f "/opt/rscord/bin/$service" ]; then
        if systemctl is-enabled --quiet rscord-$service 2>/dev/null; then
            echo "Restarting rscord-$service..."
            systemctl restart rscord-$service || echo "  ⚠️  Failed to restart (service might not be configured)"
        else
            echo "Starting rscord-$service..."
            systemctl start rscord-$service 2>/dev/null || echo "  ⚠️  Service not configured. Run setup-server.sh first!"
        fi
    fi
done

# Step 6: Check status
echo ""
echo "📊 Service Status:"
echo "=================="

for service in gateway auth-service voice-service presence-service; do
    if systemctl is-active --quiet rscord-$service 2>/dev/null; then
        echo "✅ rscord-$service: Running"
    else
        echo "❌ rscord-$service: Not running"
    fi
done

echo ""
echo "🌐 Testing endpoints:"
for port in 14700 14701 14705 14706; do
    if curl -s -f -m 2 http://localhost:$port/health > /dev/null 2>&1; then
        echo "✅ Port $port: Responding"
    else
        echo "❌ Port $port: Not responding"
    fi
done

echo ""
echo "======================================="
echo "Deployment complete!"
echo ""
echo "Services available at:"
echo "  Gateway:  http://5.35.83.143:14700"
echo "  Auth:     http://5.35.83.143:14701"
echo "  Voice:    http://5.35.83.143:14705"
echo "  Presence: http://5.35.83.143:14706"
echo ""
echo "View logs with: journalctl -u rscord-* -f"
echo "======================================="
