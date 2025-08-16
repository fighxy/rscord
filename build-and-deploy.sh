#!/bin/bash

# RSCORD Build & Deploy Script
# Run this directly on the server at /root/rscord

set -e

echo "======================================="
echo "   RSCORD Build & Deploy"  
echo "======================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Setup infrastructure if needed
echo -e "${GREEN}📦 Checking infrastructure...${NC}"
if ! docker ps | grep -q rscord-mongodb; then
    echo "Starting MongoDB, Redis, RabbitMQ..."
    
    cat > docker-compose-infra.yml << 'EOF'
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    container_name: rscord-mongodb
    restart: always
    ports:
      - "127.0.0.1:27017:27017"
    volumes:
      - mongodb_data:/data/db

  redis:
    image: redis:7-alpine
    container_name: rscord-redis
    restart: always
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis_data:/data

  rabbitmq:
    image: rabbitmq:3-management-alpine
    container_name: rscord-rabbitmq
    restart: always
    ports:
      - "127.0.0.1:5672:5672"
      - "127.0.0.1:15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

volumes:
  mongodb_data:
  redis_data:
  rabbitmq_data:
EOF

    docker-compose -f docker-compose-infra.yml up -d
    sleep 5
fi

# Step 2: Create directories
echo -e "${GREEN}📁 Creating directories...${NC}"
mkdir -p /opt/rscord/{bin,config,logs}
mkdir -p /var/log/rscord

# Step 3: Build services
echo -e "${GREEN}🔨 Building services...${NC}"
cd servers

# Build with release mode
cargo build --release 2>&1 | grep -E "(Compiling|Finished|error:|warning:)" || true

echo ""
echo -e "${GREEN}Build complete! Checking binaries...${NC}"

# Step 4: Install binaries
echo -e "${GREEN}📤 Installing binaries...${NC}"

install_binary() {
    local service=$1
    if [ -f "target/release/$service" ]; then
        cp target/release/$service /opt/rscord/bin/
        chmod +x /opt/rscord/bin/$service
        echo -e "${GREEN}✅ $service installed${NC}"
        return 0
    else
        echo -e "${RED}❌ $service not found${NC}"
        return 1
    fi
}

# Install each service
SUCCESS_COUNT=0
install_binary "gateway" && ((SUCCESS_COUNT++)) || true
install_binary "auth-service" && ((SUCCESS_COUNT++)) || true
install_binary "chat-service" && ((SUCCESS_COUNT++)) || true
install_binary "voice-service" && ((SUCCESS_COUNT++)) || true
install_binary "presence-service" && ((SUCCESS_COUNT++)) || true

cd ..

if [ $SUCCESS_COUNT -eq 0 ]; then
    echo -e "${RED}No services were built successfully!${NC}"
    exit 1
fi

# Step 5: Create configuration
echo ""
echo -e "${GREEN}📝 Creating configuration...${NC}"
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

# Step 6: Create systemd services
echo ""
echo -e "${GREEN}⚙️ Creating systemd services...${NC}"

# Gateway service
if [ -f "/opt/rscord/bin/gateway" ]; then
cat > /etc/systemd/system/rscord-gateway.service << 'EOF'
[Unit]
Description=RSCORD Gateway
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rscord
Environment="RUST_LOG=info"
Environment="BIND_ADDRESS=0.0.0.0"
Environment="GATEWAY_PORT=14700"
Environment="RSCORD_CONFIG=/opt/rscord/config/rscord.toml"
ExecStart=/opt/rscord/bin/gateway
Restart=always
RestartSec=10
StandardOutput=append:/var/log/rscord/gateway.log
StandardError=append:/var/log/rscord/gateway-error.log

[Install]
WantedBy=multi-user.target
EOF
fi

# Auth service
if [ -f "/opt/rscord/bin/auth-service" ]; then
cat > /etc/systemd/system/rscord-auth-service.service << 'EOF'
[Unit]
Description=RSCORD Auth Service
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rscord
Environment="RUST_LOG=info"
Environment="BIND_ADDRESS=0.0.0.0"
Environment="AUTH_PORT=14701"
Environment="MONGODB_URL=mongodb://127.0.0.1:27017"
Environment="RSCORD_CONFIG=/opt/rscord/config/rscord.toml"
ExecStart=/opt/rscord/bin/auth-service
Restart=always
RestartSec=10
StandardOutput=append:/var/log/rscord/auth-service.log
StandardError=append:/var/log/rscord/auth-service-error.log

[Install]
WantedBy=multi-user.target
EOF
fi

# Chat service
if [ -f "/opt/rscord/bin/chat-service" ]; then
cat > /etc/systemd/system/rscord-chat-service.service << 'EOF'
[Unit]
Description=RSCORD Chat Service
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rscord
Environment="RUST_LOG=info"
Environment="BIND_ADDRESS=0.0.0.0"
Environment="CHAT_PORT=14703"
Environment="MONGODB_URL=mongodb://127.0.0.1:27017"
Environment="RABBITMQ_URL=amqp://127.0.0.1:5672"
Environment="RSCORD_CONFIG=/opt/rscord/config/rscord.toml"
ExecStart=/opt/rscord/bin/chat-service
Restart=always
RestartSec=10
StandardOutput=append:/var/log/rscord/chat-service.log
StandardError=append:/var/log/rscord/chat-service-error.log

[Install]
WantedBy=multi-user.target
EOF
fi

# Voice service
if [ -f "/opt/rscord/bin/voice-service" ]; then
cat > /etc/systemd/system/rscord-voice-service.service << 'EOF'
[Unit]
Description=RSCORD Voice Service
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rscord
Environment="RUST_LOG=info"
Environment="BIND_ADDRESS=0.0.0.0"
Environment="VOICE_PORT=14705"
Environment="RSCORD_CONFIG=/opt/rscord/config/rscord.toml"
ExecStart=/opt/rscord/bin/voice-service
Restart=always
RestartSec=10
StandardOutput=append:/var/log/rscord/voice-service.log
StandardError=append:/var/log/rscord/voice-service-error.log

[Install]
WantedBy=multi-user.target
EOF
fi

# Presence service
if [ -f "/opt/rscord/bin/presence-service" ]; then
cat > /etc/systemd/system/rscord-presence-service.service << 'EOF'
[Unit]
Description=RSCORD Presence Service
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rscord
Environment="RUST_LOG=info"
Environment="BIND_ADDRESS=0.0.0.0"
Environment="PRESENCE_PORT=14706"
Environment="REDIS_URL=redis://127.0.0.1:6379"
Environment="RABBITMQ_URL=amqp://127.0.0.1:5672"
Environment="RSCORD_CONFIG=/opt/rscord/config/rscord.toml"
ExecStart=/opt/rscord/bin/presence-service
Restart=always
RestartSec=10
StandardOutput=append:/var/log/rscord/presence-service.log
StandardError=append:/var/log/rscord/presence-service-error.log

[Install]
WantedBy=multi-user.target
EOF
fi

# Step 7: Reload systemd and start services
echo ""
echo -e "${GREEN}🔄 Starting services...${NC}"
systemctl daemon-reload

# Start only installed services
for service in gateway auth-service chat-service voice-service presence-service; do
    if [ -f "/opt/rscord/bin/$service" ]; then
        systemctl enable rscord-$service 2>/dev/null || true
        systemctl restart rscord-$service 2>/dev/null || true
    fi
done

sleep 3

# Step 8: Check status
echo ""
echo -e "${GREEN}📊 Service Status:${NC}"
echo "===================="

for service in gateway auth-service chat-service voice-service presence-service; do
    if [ -f "/opt/rscord/bin/$service" ]; then
        if systemctl is-active --quiet rscord-$service 2>/dev/null; then
            echo -e "${GREEN}✅ rscord-$service: Running${NC}"
        else
            echo -e "${RED}❌ rscord-$service: Not running${NC}"
            echo "   Check logs: journalctl -u rscord-$service -n 50"
        fi
    else
        echo -e "${YELLOW}⚠️  $service: Not installed${NC}"
    fi
done

echo ""
echo -e "${GREEN}🌐 Testing endpoints:${NC}"
test_endpoint() {
    local port=$1
    local name=$2
    if curl -s -f -m 2 http://localhost:$port/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name (port $port): Responding${NC}"
    else
        echo -e "${RED}❌ $name (port $port): Not responding${NC}"
    fi
}

test_endpoint 14700 "Gateway" 
test_endpoint 14701 "Auth"
test_endpoint 14703 "Chat"
test_endpoint 14705 "Voice"
test_endpoint 14706 "Presence"

echo ""
echo "======================================="
echo -e "${GREEN}Deployment complete!${NC}"
echo ""
echo "Services available at:"
echo "  Gateway:  http://5.35.83.143:14700"
echo "  Auth:     http://5.35.83.143:14701"
echo "  Chat:     http://5.35.83.143:14703"
echo "  Voice:    http://5.35.83.143:14705"
echo "  Presence: http://5.35.83.143:14706"
echo ""
echo "View logs with: journalctl -u 'rscord-*' -f"
echo "======================================="
