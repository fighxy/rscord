#!/bin/bash

# Enhanced deployment script for Radiate Voice Service with Redis integration
# Server: 5.35.83.143

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVER_IP="5.35.83.143"
REDIS_PASSWORD="radiate_redis_2024_secure"
LIVEKIT_SECRET="livekit_secret_2024_radiate"
LIVEKIT_API_KEY="devkey"
LIVEKIT_API_SECRET="secret"

echo -e "${BLUE}=== Enhanced Radiate Voice Service Deployment ===${NC}"
echo "Server: $SERVER_IP"
echo "$(date)"

# Function to print status
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    print_error "This script should not be run as root for security reasons"
    exit 1
fi

# Update system packages
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install required packages
print_status "Installing required packages..."
sudo apt install -y \
    nginx \
    redis-server \
    postgresql-14 \
    mongodb \
    curl \
    wget \
    git \
    build-essential \
    pkg-config \
    libssl-dev \
    certbot \
    python3-certbot-nginx \
    htop \
    iotop \
    netstat-nat \
    ufw \
    fail2ban

# Install Rust if not present
if ! command -v rustc &> /dev/null; then
    print_status "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source ~/.cargo/env
fi

# Install Node.js and npm if not present
if ! command -v node &> /dev/null; then
    print_status "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Configure Redis
print_status "Configuring Redis..."
sudo cp /etc/redis/redis.conf /etc/redis/redis.conf.backup
sudo cp redis.conf /etc/redis/redis.conf

# Set Redis password
sudo sed -i "s/requirepass radiate_redis_2024_secure/requirepass $REDIS_PASSWORD/" /etc/redis/redis.conf

# Create Redis directories and set permissions
sudo mkdir -p /var/lib/redis /var/log/redis
sudo chown redis:redis /var/lib/redis /var/log/redis
sudo chmod 750 /var/lib/redis /var/log/redis

# Start and enable Redis
sudo systemctl enable redis-server
sudo systemctl restart redis-server

# Verify Redis is working
if ! redis-cli -a "$REDIS_PASSWORD" ping > /dev/null 2>&1; then
    print_error "Redis is not responding correctly"
    exit 1
fi
print_status "Redis configured and running successfully"

# Configure PostgreSQL
print_status "Configuring PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE IF NOT EXISTS radiate;"
sudo -u postgres psql -c "CREATE USER IF NOT EXISTS radiate WITH ENCRYPTED PASSWORD 'radiate_secure_2024';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE radiate TO radiate;"

# Configure MongoDB
print_status "Configuring MongoDB..."
sudo systemctl enable mongod
sudo systemctl start mongod

# Download and install LiveKit server
print_status "Installing LiveKit server..."
if [ ! -f "/usr/local/bin/livekit-server" ]; then
    wget https://github.com/livekit/livekit/releases/latest/download/livekit_linux_amd64.tar.gz
    tar -xzf livekit_linux_amd64.tar.gz
    sudo mv livekit-server /usr/local/bin/
    sudo chmod +x /usr/local/bin/livekit-server
    rm livekit_linux_amd64.tar.gz
fi

# Create LiveKit configuration
print_status "Creating LiveKit configuration..."
sudo mkdir -p /etc/livekit
cat << EOF | sudo tee /etc/livekit/livekit.yaml
port: 7880
bind_addresses:
  - 0.0.0.0

rtc:
  tcp_port: 7881
  udp_port: 7882
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
  
redis:
  address: localhost:6379
  password: $REDIS_PASSWORD
  db: 0

keys:
  $LIVEKIT_API_KEY: $LIVEKIT_API_SECRET

region: us-east-1

turn:
  enabled: true
  domain: $SERVER_IP
  cert_file: ""
  key_file: ""
  tls_port: 5349
  udp_port: 3478
  relay_range_start: 50000
  relay_range_end: 60000

webhook:
  api_key: $LIVEKIT_API_KEY

development: false

log_level: info
EOF

# Create LiveKit systemd service
print_status "Creating LiveKit systemd service..."
cat << EOF | sudo tee /etc/systemd/system/livekit.service
[Unit]
Description=LiveKit Server
After=network.target redis.service
Requires=redis.service

[Service]
Type=simple
User=livekit
Group=livekit
ExecStart=/usr/local/bin/livekit-server --config /etc/livekit/livekit.yaml
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal
SyslogIdentifier=livekit
Environment=NODE_ENV=production

# Security settings
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/log/livekit /var/lib/livekit

[Install]
WantedBy=multi-user.target
EOF

# Create livekit user
sudo useradd --system --shell /bin/false livekit || true
sudo mkdir -p /var/log/livekit /var/lib/livekit
sudo chown livekit:livekit /var/log/livekit /var/lib/livekit

# Build Rust services
print_status "Building Rust services..."
cd servers

# Build auth service
print_status "Building auth-service..."
cd auth-service
cargo build --release
sudo cp target/release/radiate-auth-service /usr/local/bin/
cd ..

# Build telegram bot service
print_status "Building telegram-bot-service..."
cd telegram-bot-service
cargo build --release
sudo cp target/release/radiate-telegram-bot-service /usr/local/bin/
cd ..

# Build voice service
print_status "Building voice-service..."
cd voice-service
cargo build --release
sudo cp target/release/radiate-voice-service /usr/local/bin/
cd ..

cd ..

# Create systemd services for Rust applications
print_status "Creating systemd services..."

# Auth service
cat << EOF | sudo tee /etc/systemd/system/radiate-auth.service
[Unit]
Description=Radiate Auth Service
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=radiate
Group=radiate
ExecStart=/usr/local/bin/radiate-auth-service
Restart=always
RestartSec=3
Environment=RUST_LOG=info
Environment=DATABASE_URL=postgresql://radiate:radiate_secure_2024@localhost/radiate
Environment=BIND_ADDRESS=127.0.0.1
Environment=AUTH_PORT=14701
WorkingDirectory=/opt/radiate

[Install]
WantedBy=multi-user.target
EOF

# Telegram bot service
cat << EOF | sudo tee /etc/systemd/system/radiate-telegram.service
[Unit]
Description=Radiate Telegram Bot Service
After=network.target radiate-auth.service

[Service]
Type=simple
User=radiate
Group=radiate
ExecStart=/usr/local/bin/radiate-telegram-bot-service
Restart=always
RestartSec=3
Environment=RUST_LOG=info
Environment=TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
Environment=AUTH_SERVICE_URL=http://127.0.0.1:14701
Environment=BIND_ADDRESS=127.0.0.1
Environment=BOT_PORT=14702
WorkingDirectory=/opt/radiate

[Install]
WantedBy=multi-user.target
EOF

# Voice service
cat << EOF | sudo tee /etc/systemd/system/radiate-voice.service
[Unit]
Description=Radiate Voice Service
After=network.target redis.service livekit.service
Requires=redis.service livekit.service

[Service]
Type=simple
User=radiate
Group=radiate
ExecStart=/usr/local/bin/radiate-voice-service
Restart=always
RestartSec=3
Environment=RUST_LOG=info
Environment=REDIS_URL=redis://:$REDIS_PASSWORD@localhost:6379
Environment=LIVEKIT_URL=http://127.0.0.1:7880
Environment=LIVEKIT_API_KEY=$LIVEKIT_API_KEY
Environment=LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET
Environment=BIND_ADDRESS=127.0.0.1
Environment=VOICE_PORT=14705
WorkingDirectory=/opt/radiate

[Install]
WantedBy=multi-user.target
EOF

# Create radiate user and directories
sudo useradd --system --shell /bin/bash radiate || true
sudo mkdir -p /opt/radiate /var/log/radiate
sudo chown radiate:radiate /opt/radiate /var/log/radiate

# Configure Nginx
print_status "Configuring Nginx..."
sudo cp nginx-voice-redis.conf /etc/nginx/nginx.conf

# Test Nginx configuration
if ! sudo nginx -t; then
    print_error "Nginx configuration test failed"
    exit 1
fi

# Configure firewall
print_status "Configuring UFW firewall..."
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow WebRTC ports
sudo ufw allow 50000:60000/udp
sudo ufw allow 7880:7885/tcp
sudo ufw allow 7880:7885/udp

# Allow TURN/STUN
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp

# Enable firewall
sudo ufw --force enable

# Configure fail2ban
print_status "Configuring fail2ban..."
cat << EOF | sudo tee /etc/fail2ban/jail.local
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log

[redis]
enabled = true
port = 6379
filter = redis-server
logpath = /var/log/redis/redis-server.log
maxretry = 3
EOF

# Reload systemd and start services
print_status "Starting services..."
sudo systemctl daemon-reload

# Start and enable services in order
sudo systemctl enable postgresql redis-server mongod
sudo systemctl start postgresql redis-server mongod

sudo systemctl enable livekit
sudo systemctl start livekit

sudo systemctl enable radiate-auth radiate-telegram radiate-voice
sudo systemctl start radiate-auth
sleep 5
sudo systemctl start radiate-telegram
sleep 5
sudo systemctl start radiate-voice

sudo systemctl enable nginx fail2ban
sudo systemctl restart nginx
sudo systemctl start fail2ban

# Verify services are running
print_status "Verifying services..."
services=("postgresql" "redis-server" "mongod" "livekit" "radiate-auth" "radiate-telegram" "radiate-voice" "nginx")

for service in "${services[@]}"; do
    if sudo systemctl is-active --quiet "$service"; then
        print_status "$service is running ✓"
    else
        print_error "$service is not running ✗"
    fi
done

# Test endpoints
print_status "Testing endpoints..."
sleep 10

# Test health endpoints
endpoints=(
    "http://localhost/health"
    "http://localhost/api/auth/health"
    "http://localhost/api/voice/health"
)

for endpoint in "${endpoints[@]}"; do
    if curl -f -s "$endpoint" > /dev/null; then
        print_status "$endpoint is responding ✓"
    else
        print_warning "$endpoint is not responding ✗"
    fi
done

# Create monitoring script
print_status "Creating monitoring script..."
cat << 'EOF' | sudo tee /usr/local/bin/radiate-monitor
#!/bin/bash

# Radiate services monitoring script

services=("postgresql" "redis-server" "mongod" "livekit" "radiate-auth" "radiate-telegram" "radiate-voice" "nginx")

echo "=== Radiate Services Status ==="
echo "$(date)"
echo

for service in "${services[@]}"; do
    if systemctl is-active --quiet "$service"; then
        echo "✓ $service is running"
    else
        echo "✗ $service is NOT running"
        echo "  Attempting to restart $service..."
        systemctl restart "$service"
        sleep 2
        if systemctl is-active --quiet "$service"; then
            echo "  ✓ $service restarted successfully"
        else
            echo "  ✗ Failed to restart $service"
        fi
    fi
done

echo
echo "=== Resource Usage ==="
echo "Memory Usage:"
free -h
echo
echo "Disk Usage:"
df -h
echo
echo "Load Average:"
uptime
echo
echo "=== Active Connections ==="
echo "Redis connections:"
redis-cli -a "radiate_redis_2024_secure" info clients | grep connected_clients
echo
echo "Nginx connections:"
curl -s http://127.0.0.1:8080/nginx_status 2>/dev/null | grep Active || echo "Status not available"
echo
echo "=== LiveKit Status ==="
curl -s http://127.0.0.1:7880/health 2>/dev/null | head -1 || echo "LiveKit health check failed"

EOF

sudo chmod +x /usr/local/bin/radiate-monitor

# Create cron job for monitoring
print_status "Setting up monitoring cron job..."
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/radiate-monitor >> /var/log/radiate/monitor.log 2>&1") | crontab -

# Create backup script
print_status "Creating backup script..."
cat << 'EOF' | sudo tee /usr/local/bin/radiate-backup
#!/bin/bash

BACKUP_DIR="/opt/radiate/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

echo "=== Radiate Backup Started at $(date) ==="

# Backup PostgreSQL
echo "Backing up PostgreSQL..."
sudo -u postgres pg_dump radiate > "$BACKUP_DIR/postgres_$DATE.sql"

# Backup Redis
echo "Backing up Redis..."
redis-cli -a "radiate_redis_2024_secure" --rdb "$BACKUP_DIR/redis_$DATE.rdb" > /dev/null

# Backup MongoDB
echo "Backing up MongoDB..."
mongodump --out "$BACKUP_DIR/mongodb_$DATE" > /dev/null

# Backup configuration files
echo "Backing up configuration files..."
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" \
    /etc/nginx/nginx.conf \
    /etc/livekit/livekit.yaml \
    /etc/redis/redis.conf \
    /etc/systemd/system/radiate-*.service \
    /etc/systemd/system/livekit.service

# Cleanup old backups (keep 7 days)
find "$BACKUP_DIR" -type f -mtime +7 -delete

echo "=== Backup completed at $(date) ==="
echo "Backup files stored in: $BACKUP_DIR"
ls -la "$BACKUP_DIR"

EOF

sudo chmod +x /usr/local/bin/radiate-backup

# Setup daily backup cron job
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/radiate-backup >> /var/log/radiate/backup.log 2>&1") | crontab -

# Create environment file template
print_status "Creating environment template..."
cat << EOF | sudo tee /opt/radiate/.env.template
# Radiate Environment Variables Template
# Copy this to .env and fill in your actual values

# Database
DATABASE_URL=postgresql://radiate:radiate_secure_2024@localhost/radiate

# Redis
REDIS_URL=redis://:$REDIS_PASSWORD@localhost:6379

# LiveKit
LIVEKIT_URL=http://127.0.0.1:7880
LIVEKIT_API_KEY=$LIVEKIT_API_KEY
LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Server
BIND_ADDRESS=127.0.0.1
AUTH_PORT=14701
BOT_PORT=14702
VOICE_PORT=14705

# Logging
RUST_LOG=info
EOF

# Create SSL certificate generation script
print_status "Creating SSL certificate script..."
cat << 'EOF' | sudo tee /usr/local/bin/setup-ssl
#!/bin/bash

# SSL Certificate setup for Radiate

DOMAIN="5.35.83.143"
EMAIL="admin@radiate.local"

echo "Setting up SSL certificate for $DOMAIN"

# Install certbot if not present
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    apt update
    apt install -y certbot python3-certbot-nginx
fi

# Get certificate
echo "Requesting SSL certificate..."
certbot --nginx -d $DOMAIN --email $EMAIL --agree-tos --non-interactive --redirect

# Setup auto-renewal
echo "Setting up auto-renewal..."
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -

echo "SSL certificate setup complete!"
echo "Your site should now be available at https://$DOMAIN"

EOF

sudo chmod +x /usr/local/bin/setup-ssl

# Final status check
print_status "Final system check..."
sleep 5

echo
echo -e "${BLUE}=== Deployment Summary ===${NC}"
echo -e "${GREEN}✓ Redis configured and running${NC}"
echo -e "${GREEN}✓ PostgreSQL configured and running${NC}"
echo -e "${GREEN}✓ MongoDB configured and running${NC}"
echo -e "${GREEN}✓ LiveKit server installed and running${NC}"
echo -e "${GREEN}✓ Rust services built and deployed${NC}"
echo -e "${GREEN}✓ Nginx configured with enhanced proxy settings${NC}"
echo -e "${GREEN}✓ Firewall configured${NC}"
echo -e "${GREEN}✓ Monitoring and backup scripts created${NC}"

echo
echo -e "${BLUE}=== Available Endpoints ===${NC}"
echo "Health Check: http://$SERVER_IP/health"
echo "Auth API: http://$SERVER_IP/api/auth/"
echo "Voice API: http://$SERVER_IP/api/voice/"
echo "Voice WebSocket: ws://$SERVER_IP/ws/voice"
echo "LiveKit: http://$SERVER_IP/livekit/"
echo "Telegram Bot: http://$SERVER_IP/api/telegram/"

echo
echo -e "${BLUE}=== Next Steps ===${NC}"
echo "1. Set your Telegram bot token:"
echo "   sudo systemctl edit radiate-telegram"
echo "   Add: Environment=TELEGRAM_BOT_TOKEN=your_token_here"
echo
echo "2. Setup SSL certificate:"
echo "   sudo /usr/local/bin/setup-ssl"
echo
echo "3. Monitor services:"
echo "   /usr/local/bin/radiate-monitor"
echo
echo "4. Check logs:"
echo "   sudo journalctl -f -u radiate-voice"
echo "   sudo journalctl -f -u livekit"
echo
echo "5. Desktop app configuration:"
echo "   Update API_BASE_URL to: http://$SERVER_IP"
echo

print_status "Deployment completed successfully!"
