#!/bin/bash

# RSCORD Server Setup Script
# Run this ON THE SERVER (5.35.83.143)

set -e

echo "======================================="
echo "   RSCORD Server Setup"
echo "======================================="

# Create directories
echo "📁 Creating directories..."
mkdir -p /opt/rscord/{bin,config,logs}
mkdir -p /var/log/rscord

# Create systemd service files
echo "⚙️ Creating systemd services..."

# Gateway service
cat > /etc/systemd/system/rscord-gateway.service << 'EOF'
[Unit]
Description=RSCORD Gateway Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rscord
Environment="RUST_LOG=info"
Environment="BIND_ADDRESS=0.0.0.0"
Environment="GATEWAY_PORT=14700"
ExecStart=/opt/rscord/bin/gateway
Restart=always
RestartSec=10
StandardOutput=append:/var/log/rscord/gateway.log
StandardError=append:/var/log/rscord/gateway-error.log

[Install]
WantedBy=multi-user.target
EOF

# Auth service
cat > /etc/systemd/system/rscord-auth-service.service << 'EOF'
[Unit]
Description=RSCORD Auth Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rscord
Environment="RUST_LOG=info"
Environment="BIND_ADDRESS=0.0.0.0"
Environment="AUTH_PORT=14701"
Environment="MONGODB_URL=mongodb://127.0.0.1:27017"
ExecStart=/opt/rscord/bin/auth-service
Restart=always
RestartSec=10
StandardOutput=append:/var/log/rscord/auth-service.log
StandardError=append:/var/log/rscord/auth-service-error.log

[Install]
WantedBy=multi-user.target
EOF

# Voice service
cat > /etc/systemd/system/rscord-voice-service.service << 'EOF'
[Unit]
Description=RSCORD Voice Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rscord
Environment="RUST_LOG=info"
Environment="BIND_ADDRESS=0.0.0.0"
Environment="VOICE_PORT=14705"
ExecStart=/opt/rscord/bin/voice-service
Restart=always
RestartSec=10
StandardOutput=append:/var/log/rscord/voice-service.log
StandardError=append:/var/log/rscord/voice-service-error.log

[Install]
WantedBy=multi-user.target
EOF

# Presence service
cat > /etc/systemd/system/rscord-presence-service.service << 'EOF'
[Unit]
Description=RSCORD Presence Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rscord
Environment="RUST_LOG=info"
Environment="BIND_ADDRESS=0.0.0.0"
Environment="PRESENCE_PORT=14706"
Environment="REDIS_URL=redis://127.0.0.1:6379"
Environment="RABBITMQ_URL=amqp://127.0.0.1:5672"
ExecStart=/opt/rscord/bin/presence-service
Restart=always
RestartSec=10
StandardOutput=append:/var/log/rscord/presence-service.log
StandardError=append:/var/log/rscord/presence-service-error.log

[Install]
WantedBy=multi-user.target
EOF

# Create default config
echo "📝 Creating default configuration..."
cat > /opt/rscord/config/rscord.toml << 'EOF'
# RSCORD Configuration

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

# Install Docker and Docker Compose if not installed
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    apt-get update
    apt-get install -y docker.io docker-compose
    systemctl enable docker
    systemctl start docker
fi

# Start infrastructure services
echo "🚀 Starting infrastructure services..."
cd /root/rscord

# Create simple docker-compose for infrastructure
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

docker compose -f docker-compose-infra.yml up -d

# Reload systemd
echo "🔄 Reloading systemd..."
systemctl daemon-reload

# Enable services
echo "✅ Enabling services..."
systemctl enable rscord-gateway
systemctl enable rscord-auth-service
systemctl enable rscord-voice-service
systemctl enable rscord-presence-service

echo ""
echo "✅ Server setup complete!"
echo ""
echo "Now copy the compiled binaries to /opt/rscord/bin/ and start services:"
echo "  systemctl start rscord-gateway"
echo "  systemctl start rscord-auth-service"
echo "  systemctl start rscord-voice-service"
echo "  systemctl start rscord-presence-service"
echo ""
echo "Or use: systemctl start rscord-*.service"
