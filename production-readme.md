# RSCORD Production Deployment Guide

## Server: 5.35.83.143

This guide provides complete instructions for deploying RSCORD microservices to your production server.

## Prerequisites

- Ubuntu 20.04+ or Debian 11+
- Root or sudo access
- At least 4GB RAM
- 20GB free disk space
- Open ports: 22 (SSH), 80 (HTTP), 443 (HTTPS), 14700-14706 (Services), 3478 (STUN/TURN)

## Quick Start

### 1. Initial Server Setup

Connect to your server and run the initialization script:

```bash
ssh root@5.35.83.143
wget https://raw.githubusercontent.com/fighxy/rscord/main/server-init.sh
chmod +x server-init.sh
./server-init.sh
```

### 2. Clone the Repository

```bash
cd /opt
git clone https://github.com/fighxy/rscord.git
cd rscord
```

### 3. Configure Environment

Edit the production configuration:

```bash
nano servers/production.toml
```

Update the following:
- `jwt_secret` - Change to a secure random string
- `mongodb_url` - Set MongoDB credentials if changed
- `redis_url` - Set Redis password if configured
- `rabbitmq_url` - Update RabbitMQ credentials

### 4. Start Infrastructure Services

```bash
docker-compose -f docker-compose.production.yml up -d
```

Verify services are running:
```bash
docker ps
```

### 5. Build and Deploy Services

From your local machine (with Rust installed):

```bash
# Make scripts executable
chmod +x deploy.sh quick-deploy.sh

# Full deployment (first time)
./deploy.sh

# Or quick deployment (updates only)
./quick-deploy.sh
```

## Service Endpoints

After deployment, services are available at:

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| Gateway | 14700 | http://5.35.83.143:14700 | API Gateway |
| Auth | 14701 | http://5.35.83.143:14701 | Authentication |
| Voice | 14705 | http://5.35.83.143:14705 | Voice/WebRTC |
| Presence | 14706 | http://5.35.83.143:14706 | User presence |

## Health Checks

Test if services are running:

```bash
# From server
/opt/rscord/monitor.sh

# Or individually
curl http://localhost:14700/health
curl http://localhost:14701/health
curl http://localhost:14705/health
curl http://localhost:14706/health
```

## Service Management

### Start Services
```bash
systemctl start rscord@gateway
systemctl start rscord@auth-service
systemctl start rscord@voice-service
systemctl start rscord@presence-service
```

### Stop Services
```bash
systemctl stop rscord@gateway
systemctl stop rscord@auth-service
systemctl stop rscord@voice-service
systemctl stop rscord@presence-service
```

### Restart Services
```bash
systemctl restart rscord@gateway
systemctl restart rscord@auth-service
systemctl restart rscord@voice-service
systemctl restart rscord@presence-service
```

### View Logs
```bash
# All services
journalctl -u 'rscord@*' -f

# Specific service
journalctl -u rscord@gateway -f

# Log files
tail -f /var/log/rscord/gateway.log
```

## Database Management

### MongoDB

Access MongoDB:
```bash
docker exec -it rscord-mongodb mongosh
```

Create database and user:
```javascript
use rscord
db.createUser({
  user: "rscord",
  pwd: "your_password",
  roles: [{role: "readWrite", db: "rscord"}]
})
```

### Redis

Access Redis CLI:
```bash
docker exec -it rscord-redis redis-cli
AUTH your_password
```

### RabbitMQ

Access management UI:
```
http://5.35.83.143:15672
Username: admin
Password: your_password
```

## Monitoring

### System Monitoring
```bash
# Real-time monitoring
/opt/rscord/monitor.sh

# System resources
htop

# Network connections
netstat -tlnp | grep rscord

# Docker containers
docker stats
```

### Application Metrics

View Prometheus metrics:
```
http://5.35.83.143:9090
```

View Grafana dashboards:
```
http://5.35.83.143:3000
```

## Backup & Recovery

### Manual Backup
```bash
/opt/rscord/backup.sh
```

### Restore from Backup
```bash
cd /opt/rscord/backups
tar -xzf rscord_backup_TIMESTAMP.tar.gz
docker exec -i rscord-mongodb mongorestore /path/to/backup
docker exec -i rscord-redis redis-cli --rdb /path/to/redis_dump.rdb
```

### Automated Backups

Backups run daily at 3 AM. Check crontab:
```bash
crontab -l
```

## Troubleshooting

### Service Won't Start

1. Check logs:
```bash
journalctl -u rscord@service-name -n 50
```

2. Verify dependencies:
```bash
docker ps
```

3. Check ports:
```bash
netstat -tlnp | grep PORT_NUMBER
```

### Connection Issues

1. Check firewall:
```bash
ufw status
```

2. Test connectivity:
```bash
curl -v http://localhost:14700/health
```

3. Check nginx (if using):
```bash
nginx -t
systemctl status nginx
```

### Performance Issues

1. Check resource usage:
```bash
htop
df -h
free -m
```

2. Check Docker resources:
```bash
docker system df
docker stats
```

3. Review application logs for errors:
```bash
grep ERROR /var/log/rscord/*.log
```

## Security Recommendations

1. **Change Default Passwords**
   - Update all passwords in `production.toml`
   - Change Docker service passwords
   - Use strong JWT secret

2. **Enable HTTPS**
   - Obtain SSL certificate (Let's Encrypt)
   - Configure nginx with SSL
   - Update CORS settings

3. **Firewall Configuration**
   - Only open required ports
   - Use fail2ban for SSH protection
   - Consider VPN for admin access

4. **Regular Updates**
   ```bash
   apt update && apt upgrade
   docker-compose pull
   ```

5. **Monitor Logs**
   - Set up log aggregation
   - Configure alerts for errors
   - Regular security audits

## Development Workflow

### Local Development
```bash
cd servers
cargo build
cargo test
```

### Deploy Updates
```bash
# From local machine
./quick-deploy.sh
```

### Rollback
```bash
# Keep previous binaries
cp /opt/rscord/bin/* /opt/rscord/bin.backup/

# If needed, restore
cp /opt/rscord/bin.backup/* /opt/rscord/bin/
systemctl restart rscord@*
```

## Support

### Logs Location
- Application logs: `/var/log/rscord/`
- Docker logs: `docker logs container_name`
- System logs: `journalctl`

### Configuration Files
- Main config: `/opt/rscord/config/rscord.toml`
- Environment: `/etc/rscord/environment`
- Systemd: `/etc/systemd/system/rscord@.service`

### Common Commands
```bash
# Check all services
for s in gateway auth-service voice-service presence-service; do
  echo "$s: $(systemctl is-active rscord@$s)"
done

# Restart all services
systemctl restart rscord@*

# View recent errors
journalctl -u 'rscord@*' -p err -since "1 hour ago"

# Check disk usage
du -sh /opt/rscord/*
```

## Next Steps

1. Configure frontend to connect to `http://5.35.83.143:14700`
2. Set up domain name and SSL certificates
3. Configure monitoring and alerts
4. Implement backup strategy
5. Performance tuning based on usage

## Architecture Overview

```
Client → Nginx (80/443) → Gateway (14700) → Services (14701-14706)
                                                ↓
                                          MongoDB + Redis + RabbitMQ
```

Services communicate through:
- REST APIs for synchronous operations
- WebSockets for real-time features
- RabbitMQ for event-driven updates
- Redis for caching and sessions

Remember to regularly check for updates and security patches!