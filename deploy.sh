#!/bin/bash

# RSCORD Production Deployment Script
# Server: 5.35.83.143

set -e  # Exit on error

# Configuration
SERVER_IP="5.35.83.143"
SERVER_USER="root"
REMOTE_DIR="/opt/rscord"
LOCAL_DIR="."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== RSCORD Production Deployment ===${NC}"
echo -e "${YELLOW}Deploying to: ${SERVER_IP}${NC}"

# Step 1: Build the project locally
echo -e "\n${GREEN}Step 1: Building project...${NC}"
cd servers
cargo build --release
cd ..

# Step 2: Create deployment package
echo -e "\n${GREEN}Step 2: Creating deployment package...${NC}"
mkdir -p deployment/bin
mkdir -p deployment/config

# Copy binaries
cp servers/target/release/gateway deployment/bin/
cp servers/target/release/auth-service deployment/bin/
cp servers/target/release/chat-service deployment/bin/ 2>/dev/null || true
cp servers/target/release/voice-service deployment/bin/
cp servers/target/release/presence-service deployment/bin/

# Copy configuration
cp servers/production.toml deployment/config/rscord.toml
cp docker-compose.yml deployment/

# Step 3: Create setup script for server
cat > deployment/setup.sh << 'EOF'
#!/bin/bash

# Setup script for RSCORD on production server

# Install dependencies
echo "Installing system dependencies..."
apt-get update
apt-get install -y docker.io docker-compose

# Create directories
mkdir -p /opt/rscord/bin
mkdir -p /opt/rscord/config
mkdir -p /opt/rscord/logs
mkdir -p /var/log/rscord

# Setup Docker services
echo "Starting infrastructure services..."
cd /opt/rscord
docker-compose up -d mongodb redis rabbitmq

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 10

# Create systemd services
for service in gateway auth-service chat-service voice-service presence-service; do
    cat > /etc/systemd/system/rscord-$service.service << SERVICEEOF
[Unit]
Description=RSCORD $service
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rscord
Environment="RUST_LOG=info"
Environment="RSCORD_CONFIG=/opt/rscord/config/rscord.toml"
Environment="MONGODB_URL=mongodb://127.0.0.1:27017"
Environment="REDIS_URL=redis://127.0.0.1:6379"
Environment="RABBITMQ_URL=amqp://guest:guest@127.0.0.1:5672"
ExecStart=/opt/rscord/bin/$service
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICEEOF
done

# Reload systemd
systemctl daemon-reload

# Enable and start services
for service in gateway auth-service voice-service presence-service; do
    systemctl enable rscord-$service
    systemctl start rscord-$service
done

echo "RSCORD services deployed and started!"
EOF

chmod +x deployment/setup.sh

# Step 4: Upload to server
echo -e "\n${GREEN}Step 4: Uploading to server...${NC}"
ssh ${SERVER_USER}@${SERVER_IP} "mkdir -p ${REMOTE_DIR}"
scp -r deployment/* ${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/

# Step 5: Run setup on server
echo -e "\n${GREEN}Step 5: Running setup on server...${NC}"
ssh ${SERVER_USER}@${SERVER_IP} "cd ${REMOTE_DIR} && bash setup.sh"

# Step 6: Check service status
echo -e "\n${GREEN}Step 6: Checking service status...${NC}"
ssh ${SERVER_USER}@${SERVER_IP} << 'EOF'
echo "=== Service Status ==="
for service in gateway auth-service voice-service presence-service; do
    echo -n "rscord-$service: "
    systemctl is-active rscord-$service || true
done

echo -e "\n=== Docker Services ==="
docker ps --format "table {{.Names}}\t{{.Status}}"

echo -e "\n=== Health Checks ==="
curl -s http://localhost:14700/health || echo "Gateway: Not responding"
curl -s http://localhost:14701/health || echo "Auth: Not responding"
curl -s http://localhost:14705/health || echo "Voice: Not responding"
curl -s http://localhost:14706/health || echo "Presence: Not responding"
EOF

echo -e "\n${GREEN}=== Deployment Complete ===${NC}"
echo -e "${YELLOW}Services are available at:${NC}"
echo "  Gateway:  http://${SERVER_IP}:14700"
echo "  Auth:     http://${SERVER_IP}:14701"
echo "  Voice:    http://${SERVER_IP}:14705"
echo "  Presence: http://${SERVER_IP}:14706"

# Cleanup
rm -rf deployment/
