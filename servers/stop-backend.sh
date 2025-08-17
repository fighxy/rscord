#!/bin/bash

# RSCORD Backend Stop Script
# This script stops all microservices

echo "🛑 Stopping RSCORD Backend Services..."

# Function to stop a service
stop_service() {
    local service_name=$1
    local pid_file="logs/${service_name}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        echo "🛑 Stopping $service_name (PID: $pid)..."
        
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            sleep 2
            
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                echo "⚠️  Force killing $service_name..."
                kill -9 "$pid"
            fi
            
            echo "✅ $service_name stopped"
        else
            echo "ℹ️  $service_name not running"
        fi
        
        rm -f "$pid_file"
    else
        echo "ℹ️  No PID file found for $service_name"
    fi
}

# Stop services in reverse order
echo "🔧 Stopping microservices..."

# Stop Gateway first
stop_service "gateway"

# Stop other services
stop_service "presence-service"
stop_service "voice-service"
stop_service "chat-service"
stop_service "auth-service"

# Stop databases
echo "🗄️  Stopping databases..."

# Stop Redis
if pgrep -x "redis-server" > /dev/null; then
    echo "🛑 Stopping Redis..."
    pkill -f "redis-server"
    sleep 2
    echo "✅ Redis stopped"
else
    echo "ℹ️  Redis not running"
fi

# Stop MongoDB
if pgrep -x "mongod" > /dev/null; then
    echo "🛑 Stopping MongoDB..."
    pkill -f "mongod"
    sleep 3
    echo "✅ MongoDB stopped"
else
    echo "ℹ️  MongoDB not running"
fi

echo "=================================="
echo "🛑 All RSCORD Backend services stopped!"
echo "=================================="
echo ""
echo "💡 To start services again, run:"
echo "  ./start-backend.sh"
