#!/bin/bash

# RADIATE Backend Startup Script for 5.35.83.143
# This script starts all microservices

echo "🚀 Starting RADIATE Backend Services..."

# Set environment variables
export BIND_ADDRESS="0.0.0.0"
export RADIATE_CONFIG_PATH="./radiate.toml"

# Function to start a service
start_service() {
    local service_name=$1
    local service_dir=$2
    local port=$3
    
    echo "📡 Starting $service_name on port $port..."
    cd "$service_dir"
    
    # Start service in background
    cargo run --release > "../logs/${service_name}.log" 2>&1 &
    local pid=$!
    echo "$pid" > "../logs/${service_name}.pid"
    
    echo "✅ $service_name started with PID $pid"
    cd ..
}

# Create logs directory
mkdir -p logs

# Start MongoDB (if not running)
echo "🗄️  Checking MongoDB..."
if ! pgrep -x "mongod" > /dev/null; then
    echo "📊 Starting MongoDB..."
    mongod --config /etc/mongod.conf > logs/mongodb.log 2>&1 &
    sleep 3
else
    echo "✅ MongoDB already running"
fi

# Start Redis (if not running)
echo "🔴 Checking Redis..."
if ! pgrep -x "redis-server" > /dev/null; then
    echo "📊 Starting Redis..."
    redis-server > logs/redis.log 2>&1 &
    sleep 2
else
    echo "✅ Redis already running"
fi

# Wait a bit for databases to be ready
echo "⏳ Waiting for databases to be ready..."
sleep 5

# Start microservices
echo "🔧 Starting microservices..."

# Start Auth Service
start_service "auth-service" "auth-service" "14701"

# Start Chat Service
start_service "chat-service" "chat-service" "14703"

# Start Voice Service
start_service "voice-service" "voice-service" "14705"

# Start Presence Service
start_service "presence-service" "presence-service" "14706"

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Start Gateway (last, as it depends on other services)
echo "🌐 Starting API Gateway..."
start_service "gateway" "gateway" "14700"

# Wait for gateway
sleep 5

# Check service status
echo "🔍 Checking service status..."
echo "=================================="
echo "Service Status:"
echo "=================================="

check_service() {
    local service_name=$1
    local port=$2
    
    if curl -s "http://localhost:$port/health" > /dev/null 2>&1; then
        echo "✅ $service_name (:$port) - RUNNING"
    else
        echo "❌ $service_name (:$port) - NOT RESPONDING"
    fi
}

check_service "Auth Service" "14701"
check_service "Chat Service" "14703"
check_service "Voice Service" "14705"
check_service "Presence Service" "14706"
check_service "API Gateway" "14700"

echo "=================================="
echo "🎉 RADIATE Backend is starting up!"
echo "🌐 API Gateway: http://5.35.83.143:14700"
echo "📱 Desktop app should connect to: http://5.35.83.143:14700"
echo "=================================="
echo ""
echo "📋 Useful commands:"
echo "  View logs: tail -f logs/*.log"
echo "  Stop services: ./stop-backend.sh"
echo "  Check status: ./check-status.sh"
echo ""
echo "🔍 Monitor logs in real-time:"
echo "  tail -f logs/gateway.log"
echo "  tail -f logs/auth-service.log"
echo "  tail -f logs/chat-service.log"
