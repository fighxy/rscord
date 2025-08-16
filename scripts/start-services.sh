#!/bin/bash

echo "Starting RSCORD Microservices..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to start a service
start_service() {
    local service_name=$1
    local port=$2
    local path=$3
    
    echo -e "${YELLOW}Starting $service_name on port $port...${NC}"
    cd "$path"
    cargo run --release &
    local pid=$!
    echo "$pid" > "/tmp/rscord_${service_name}.pid"
    echo -e "${GREEN}$service_name started with PID $pid${NC}"
    cd - > /dev/null
}

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${RED}Port $port is already in use${NC}"
        return 1
    fi
    return 0
}

# Function to stop all services
stop_services() {
    echo -e "${YELLOW}Stopping all RSCORD services...${NC}"
    for pidfile in /tmp/rscord_*.pid; do
        if [ -f "$pidfile" ]; then
            local pid=$(cat "$pidfile")
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid"
                echo -e "${GREEN}Stopped service with PID $pid${NC}"
            fi
            rm "$pidfile"
        fi
    done
}

# Handle Ctrl+C
trap stop_services EXIT

# Check if we want to stop services
if [ "$1" = "stop" ]; then
    stop_services
    exit 0
fi

# Check if all ports are available
ports=(14700 14701 14703 14705 14706)
for port in "${ports[@]}"; do
    if ! check_port $port; then
        echo -e "${RED}Please stop services using these ports before starting RSCORD${NC}"
        exit 1
    fi
done

# Start infrastructure services (Docker Compose)
echo -e "${YELLOW}Starting infrastructure services...${NC}"
docker-compose up -d

# Wait a bit for infrastructure to start
sleep 5

# Start microservices
echo -e "${YELLOW}Starting microservices...${NC}"

# Start services in order
start_service "gateway" "14700" "servers/gateway"
sleep 2

start_service "auth-service" "14701" "servers/auth-service"
sleep 2

start_service "chat-service" "14703" "servers/chat-service"
sleep 2

start_service "voice-service" "14705" "servers/voice-service"
sleep 2

start_service "presence-service" "14706" "servers/presence-service"

echo -e "${GREEN}All services started successfully!${NC}"
echo ""
echo "Service endpoints:"
echo "  API Gateway:      http://localhost:14700"
echo "  Auth Service:     http://localhost:14701"
echo "  Chat Service:     http://localhost:14703"
echo "  Voice Service:    http://localhost:14705"
echo "  Presence Service: http://localhost:14706"
echo ""
echo "Infrastructure:"
echo "  MongoDB:          mongodb://localhost:27017"
echo "  RabbitMQ:         http://localhost:15672 (admin/admin)"
echo "  Redis:            redis://localhost:6379"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Wait for all background processes
wait
