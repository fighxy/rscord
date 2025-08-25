#!/bin/bash

# Deploy script for Radiate Auth System on production server
# Server IP: 5.35.83.143

echo "Starting Radiate Auth System deployment..."

# Set environment variables
export BIND_ADDRESS=0.0.0.0
export AUTH_PORT=14701
export TELEGRAM_BOT_PORT=14703
export MONGO_URI=mongodb://localhost:27017/radiate
export JWT_SECRET=$(openssl rand -hex 32)
export BOT_TOKEN=8485874967:AAHyf9abWYBwbTrlHFcY9RaP25IvRg8jbk8Use
export RUST_LOG=info

# Function to check if service is running
check_service() {
    local service_name=$1
    local port=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo "✓ $service_name is running on port $port"
        return 0
    else
        echo "✗ $service_name is not running on port $port"
        return 1
    fi
}

# Stop existing services
echo "Stopping existing services..."
pkill -f "radiate-auth-service" || true
pkill -f "radiate-telegram-bot" || true
sleep 2

# Build services
echo "Building services..."
cd servers

# Build auth-service
echo "Building auth-service..."
cd auth-service
cargo build --release
cd ..

# Build telegram-bot-service
echo "Building telegram-bot-service..."
cd telegram-bot-service
cargo build --release
cd ..

# Start MongoDB if not running
echo "Checking MongoDB..."
if ! pgrep -x "mongod" > /dev/null; then
    echo "Starting MongoDB..."
    sudo systemctl start mongod
fi

# Start services
echo "Starting services..."

# Start auth-service
echo "Starting auth-service..."
nohup ./auth-service/target/release/radiate-auth-service > auth-service.log 2>&1 &
AUTH_PID=$!
echo "Auth service started with PID: $AUTH_PID"
sleep 3

# Start telegram-bot-service  
echo "Starting telegram-bot-service..."
nohup ./telegram-bot-service/target/release/radiate-telegram-bot > telegram-bot.log 2>&1 &
BOT_PID=$!
echo "Telegram bot started with PID: $BOT_PID"
sleep 3

# Check services
echo ""
echo "Checking services status..."
check_service "Auth Service" 14701
check_service "Telegram Bot" 14703

echo ""
echo "Deployment complete!"
echo ""
echo "Service URLs:"
echo "  Auth Service: http://5.35.83.143:14701"
echo "  Telegram Bot: http://5.35.83.143:14703"
echo ""
echo "Logs:"
echo "  Auth Service: servers/auth-service.log"
echo "  Telegram Bot: servers/telegram-bot.log"
echo ""
echo "To stop services, run:"
echo "  pkill -f radiate-auth-service"
echo "  pkill -f radiate-telegram-bot"
