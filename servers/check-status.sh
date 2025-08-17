#!/bin/bash

# RSCORD Backend Status Check Script
# This script checks the status of all microservices

echo "🔍 RSCORD Backend Service Status Check"
echo "======================================"
echo ""

# Function to check service status
check_service() {
    local service_name=$1
    local port=$2
    local pid_file="logs/${service_name}.pid"
    
    echo "📡 $service_name:"
    
    # Check if PID file exists
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        echo "  PID: $pid"
        
        # Check if process is running
        if kill -0 "$pid" 2>/dev/null; then
            echo "  Process: ✅ RUNNING"
        else
            echo "  Process: ❌ NOT RUNNING (stale PID file)"
        fi
    else
        echo "  PID: No PID file found"
        echo "  Process: ❌ NOT RUNNING"
    fi
    
    # Check HTTP endpoint
    if curl -s "http://localhost:$port/health" > /dev/null 2>&1; then
        echo "  HTTP: ✅ RESPONDING (:$port)"
    else
        echo "  HTTP: ❌ NOT RESPONDING (:$port)"
    fi
    
    echo ""
}

# Check all services
check_service "API Gateway" "14700"
check_service "Auth Service" "14701"
check_service "Chat Service" "14703"
check_service "Voice Service" "14705"
check_service "Presence Service" "14706"

# Check databases
echo "🗄️  Database Status:"
echo "==================="

# Check MongoDB
if pgrep -x "mongod" > /dev/null; then
    echo "MongoDB: ✅ RUNNING"
else
    echo "MongoDB: ❌ NOT RUNNING"
fi

# Check Redis
if pgrep -x "redis-server" > /dev/null; then
    echo "Redis: ✅ RUNNING"
else
    echo "Redis: ❌ NOT RUNNING"
fi

echo ""
echo "🌐 External Access:"
echo "=================="

# Check if gateway is accessible from outside
if curl -s --connect-timeout 5 "http://5.35.83.143:14700/health" > /dev/null 2>&1; then
    echo "External Gateway: ✅ ACCESSIBLE (5.35.83.143:14700)"
else
    echo "External Gateway: ❌ NOT ACCESSIBLE (5.35.83.143:14700)"
    echo "  Check firewall settings and network configuration"
fi

echo ""
echo "📊 System Resources:"
echo "==================="

# Check memory usage
echo "Memory Usage:"
free -h | grep -E "Mem|Swap"

# Check disk usage
echo ""
echo "Disk Usage:"
df -h | grep -E "Filesystem|/dev/"

echo ""
echo "======================================"
echo "💡 To restart services: ./start-backend.sh"
echo "💡 To stop services: ./stop-backend.sh"
echo "======================================"
