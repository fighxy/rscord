#!/bin/bash

# RSCORD Server Initialization Script
# This script sets up the server environment for first-time deployment

set -e

echo "======================================="
echo "   RSCORD Server Setup - 5.35.83.143  "
echo "======================================="

# Update system
echo "📦 Updating system packages..."
apt-get update
apt-get upgrade -y

# Install required packages
echo "📦 Installing dependencies..."
apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    pkg-config \
    libssl-dev \
    docker.io \
    docker-compose \
    nginx \
    ufw \
    htop \
    net-tools \
    jq

# Install Rust if not already installed
if ! command -v cargo &> /dev/null; then
    echo "🦀 Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

# Create directories
echo "📁 Creating directory structure..."
mkdir -p /opt/rscord/{bin,config,logs,data}
mkdir -p /var/log/rscord
mkdir -p /etc/rscord

# Configure firewall
echo "🔥 Configuring firewall..."
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 14700/tcp # Gateway
ufw allow 14701/tcp # Auth
ufw allow 14703/tcp # Chat
ufw allow 14705/tcp # Voice
ufw allow 14706/tcp # Presence
ufw allow 3478/tcp  # STUN/TURN
ufw allow 3478/udp  # STUN/TURN
ufw allow 49152:65535/udp # WebRTC media ports
ufw --force enable

# Setup Docker
echo "🐳 Setting up Docker..."
systemctl enable docker
systemctl start docker

# Add current user to docker group
usermod -aG docker $USER

# Create docker network
docker network create rscord-network 2>/dev/null || true

# Setup log rotation
echo "📝 Setting up log rotation..."
cat > /etc/logrotate.d/rscord << EOF
/var/log/rscord/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 640 root root
    sharedscripts
    postrotate
        systemctl reload rscord-gateway 2>/dev/null || true
        systemctl reload rscord-auth-service 2>/dev/null || true
        systemctl reload rscord-voice-service 2>/dev/null || true
        systemctl reload rscord-presence-service 2>/dev/null || true
    endscript
}
EOF

# Create environment file
echo "🔧 Creating environment configuration..."
cat > /etc/rscord/environment << EOF
# RSCORD Environment Variables
RUST_LOG=info
RUST_BACKTRACE=1
RSCORD_CONFIG=/opt/rscord/config/rscord.toml

# Database URLs
MONGODB_URL=mongodb://127.0.0.1:27017
REDIS_URL=redis://127.0.0.1:6379
RABBITMQ_URL=amqp://guest:guest@127.0.0.1:5672

# Server Configuration
SERVER_IP=5.35.83.143
BIND_ADDRESS=0.0.0.0
EOF

# Create systemd service template
echo "⚙️ Creating systemd service templates..."
cat > /etc/systemd/system/rscord@.service << 'EOF'
[Unit]
Description=RSCORD %i Service
After=network.target docker.service
Requires=docker.service
StartLimitIntervalSec=0

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rscord
EnvironmentFile=/etc/rscord/environment
ExecStart=/opt/rscord/bin/%i
Restart=always
RestartSec=10
StandardOutput=append:/var/log/rscord/%i.log
StandardError=append:/var/log/rscord/%i-error.log

# Resource limits
LimitNOFILE=65535
LimitNPROC=4096

# Security
PrivateTmp=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

# Create monitoring script
echo "📊 Creating monitoring script..."
cat > /opt/rscord/monitor.sh << 'EOF'
#!/bin/bash

# RSCORD Service Monitor

echo "=== RSCORD Service Status ==="
echo ""

# Check Docker services
echo "📦 Infrastructure Services:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep rscord || echo "No Docker services running"

echo ""
echo "🚀 Application Services:"
for service in gateway auth-service voice-service presence-service; do
    if systemctl is-active --quiet rscord@$service; then
        echo "  ✅ $service: Running"
        # Get memory usage
        pid=$(systemctl show -p MainPID --value rscord@$service)
        if [ "$pid" != "0" ]; then
            mem=$(ps -o rss= -p $pid | awk '{printf "%.1f MB", $1/1024}')
            echo "     Memory: $mem"
        fi
    else
        echo "  ❌ $service: Stopped"
    fi
done

echo ""
echo "🌐 Network Connections:"
netstat -tlnp | grep -E ":(14700|14701|14705|14706|3478)" | awk '{print "  "$4" -> "$7}'

echo ""
echo "💾 Disk Usage:"
df -h /opt/rscord | tail -1 | awk '{print "  Used: "$3" / "$2" ("$5")"}'

echo ""
echo "🔍 Recent Errors (last 10):"
journalctl -u 'rscord@*' -p err -n 10 --no-pager | tail -10

echo ""
echo "📈 API Health Checks:"
for port in 14700 14701 14705 14706; do
    service=$(case $port in
        14700) echo "Gateway";;
        14701) echo "Auth";;
        14705) echo "Voice";;
        14706) echo "Presence";;
    esac)
    
    if curl -s -f -m 2 http://localhost:$port/health > /dev/null; then
        echo "  ✅ $service (port $port): Healthy"
    else
        echo "  ❌ $service (port $port): Not responding"
    fi
done
EOF

chmod +x /opt/rscord/monitor.sh

# Create backup script
echo "💾 Creating backup script..."
cat > /opt/rscord/backup.sh << 'EOF'
#!/bin/bash

# RSCORD Backup Script

BACKUP_DIR="/opt/rscord/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="rscord_backup_$TIMESTAMP"

mkdir -p $BACKUP_DIR

echo "Starting backup: $BACKUP_NAME"

# Backup MongoDB
echo "Backing up MongoDB..."
docker exec rscord-mongodb mongodump --out /tmp/$BACKUP_NAME
docker cp rscord-mongodb:/tmp/$BACKUP_NAME $BACKUP_DIR/
docker exec rscord-mongodb rm -rf /tmp/$BACKUP_NAME

# Backup Redis
echo "Backing up Redis..."
docker exec rscord-redis redis-cli BGSAVE
sleep 5
docker cp rscord-redis:/data/dump.rdb $BACKUP_DIR/$BACKUP_NAME/redis_dump.rdb

# Backup configuration
echo "Backing up configuration..."
cp -r /opt/rscord/config $BACKUP_DIR/$BACKUP_NAME/

# Compress backup
echo "Compressing backup..."
cd $BACKUP_DIR
tar -czf $BACKUP_NAME.tar.gz $BACKUP_NAME
rm -rf $BACKUP_NAME

# Keep only last 7 backups
ls -t $BACKUP_DIR/*.tar.gz | tail -n +8 | xargs -r rm

echo "Backup completed: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
EOF

chmod +x /opt/rscord/backup.sh

# Create daily backup cron job
echo "⏰ Setting up automated backups..."
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/rscord/backup.sh >> /var/log/rscord/backup.log 2>&1") | crontab -

echo ""
echo "✅ Server initialization complete!"
echo ""
echo "Next steps:"
echo "1. Start Docker services: docker-compose -f docker-compose.production.yml up -d"
echo "2. Deploy application: ./deploy.sh"
echo "3. Monitor services: /opt/rscord/monitor.sh"
echo ""
