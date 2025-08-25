#!/bin/bash

# Install and configure nginx for Radiate
# Run with sudo on production server (5.35.83.143)

set -e

echo "========================================="
echo "     Radiate NGINX Setup Script"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

# Install nginx if not installed
echo -e "${YELLOW}Checking nginx installation...${NC}"
if ! command -v nginx &> /dev/null; then
    echo -e "${YELLOW}Installing nginx...${NC}"
    apt update
    apt install -y nginx
    echo -e "${GREEN}✓ nginx installed${NC}"
else
    echo -e "${GREEN}✓ nginx already installed${NC}"
fi

# Backup existing nginx config
if [ -f /etc/nginx/nginx.conf ]; then
    echo -e "${YELLOW}Backing up existing nginx config...${NC}"
    cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✓ Backup created${NC}"
fi

# Copy new nginx configuration
echo -e "${YELLOW}Installing Radiate nginx configuration...${NC}"
cp nginx-production.conf /etc/nginx/nginx.conf
echo -e "${GREEN}✓ Configuration installed${NC}"

# Create necessary directories
echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p /var/www/radiate/static
mkdir -p /var/www/radiate/updates
mkdir -p /var/log/nginx
chown -R www-data:www-data /var/www/radiate
echo -e "${GREEN}✓ Directories created${NC}"

# Test nginx configuration
echo -e "${YELLOW}Testing nginx configuration...${NC}"
nginx -t
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Configuration test passed${NC}"
else
    echo -e "${RED}✗ Configuration test failed${NC}"
    exit 1
fi

# Enable nginx to start on boot
echo -e "${YELLOW}Enabling nginx service...${NC}"
systemctl enable nginx
echo -e "${GREEN}✓ nginx enabled${NC}"

# Restart nginx
echo -e "${YELLOW}Restarting nginx...${NC}"
systemctl restart nginx
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ nginx restarted successfully${NC}"
else
    echo -e "${RED}✗ Failed to restart nginx${NC}"
    exit 1
fi

# Check nginx status
echo -e "${YELLOW}Checking nginx status...${NC}"
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ nginx is running${NC}"
else
    echo -e "${RED}✗ nginx is not running${NC}"
    exit 1
fi

# Configure firewall if ufw is installed
if command -v ufw &> /dev/null; then
    echo -e "${YELLOW}Configuring firewall...${NC}"
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 3478/tcp  # TURN
    ufw allow 3478/udp  # TURN
    ufw allow 5349/tcp  # TURN TLS
    ufw allow 5349/udp  # TURN TLS
    echo -e "${GREEN}✓ Firewall rules added${NC}"
fi

# Setup log rotation
echo -e "${YELLOW}Setting up log rotation...${NC}"
cat > /etc/logrotate.d/radiate-nginx << EOF
/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    prerotate
        if [ -d /etc/logrotate.d/httpd-prerotate ]; then \\
            run-parts /etc/logrotate.d/httpd-prerotate; \\
        fi
    endscript
    postrotate
        invoke-rc.d nginx rotate >/dev/null 2>&1
    endscript
}
EOF
echo -e "${GREEN}✓ Log rotation configured${NC}"

# Display service URLs
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}     NGINX Setup Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Service endpoints:"
echo "  Main API:     http://5.35.83.143/api"
echo "  Auth:         http://5.35.83.143/api/auth"
echo "  WebSocket:    ws://5.35.83.143/ws"
echo "  Voice:        ws://5.35.83.143/ws/voice"
echo "  Health:       http://5.35.83.143/health"
echo ""
echo "Logs:"
echo "  Access log:   /var/log/nginx/access.log"
echo "  Error log:    /var/log/nginx/error.log"
echo ""
echo "Commands:"
echo "  Reload:       systemctl reload nginx"
echo "  Restart:      systemctl restart nginx"
echo "  Status:       systemctl status nginx"
echo "  Test config:  nginx -t"
echo ""

# Check if services are accessible
echo -e "${YELLOW}Checking service connectivity...${NC}"

# Check health endpoint
if curl -s -o /dev/null -w "%{http_code}" http://localhost/health | grep -q "200"; then
    echo -e "${GREEN}✓ Health endpoint responding${NC}"
else
    echo -e "${YELLOW}⚠ Health endpoint not responding (services may not be started)${NC}"
fi

echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Start all backend services"
echo "2. Configure SSL certificate (optional)"
echo "3. Update Desktop app to use nginx proxy"
echo ""
