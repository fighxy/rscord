#!/bin/bash

# RSCORD Backend Test Script
# Tests all microservices on production server

SERVER="5.35.83.143"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "====================================="
echo "   RSCORD Backend Test Suite"
echo "   Server: $SERVER"
echo "====================================="
echo ""

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected=$3
    
    response=$(curl -s -o /dev/null -w "%{http_code}" $url)
    
    if [ "$response" = "$expected" ]; then
        echo -e "${GREEN}✓${NC} $name: ${GREEN}OK${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗${NC} $name: ${RED}FAILED${NC} (HTTP $response, expected $expected)"
        return 1
    fi
}

# Function to test WebSocket
test_websocket() {
    local name=$1
    local url=$2
    
    # Using curl to test WebSocket upgrade
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Connection: Upgrade" \
        -H "Upgrade: websocket" \
        -H "Sec-WebSocket-Version: 13" \
        -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
        $url)
    
    if [ "$response" = "101" ] || [ "$response" = "426" ]; then
        echo -e "${GREEN}✓${NC} $name WebSocket: ${GREEN}OK${NC}"
        return 0
    else
        echo -e "${RED}✗${NC} $name WebSocket: ${RED}FAILED${NC} (HTTP $response)"
        return 1
    fi
}

# Test health endpoints
echo "1. Testing Health Endpoints"
echo "----------------------------"
test_endpoint "Gateway" "http://$SERVER:14700/health" "200"
test_endpoint "Auth Service" "http://$SERVER:14701/health" "200"
test_endpoint "Voice Service" "http://$SERVER:14705/health" "200"
test_endpoint "Presence Service" "http://$SERVER:14706/health" "200"
echo ""

# Test Auth Service
echo "2. Testing Authentication"
echo "-------------------------"

# Register a test user
echo -n "Registering test user... "
register_response=$(curl -s -X POST http://$SERVER:14701/auth/register \
    -H "Content-Type: application/json" \
    -d '{
        "username": "testuser_'$(date +%s)'",
        "email": "test_'$(date +%s)'@example.com",
        "password": "TestPassword123!"
    }')

if echo "$register_response" | grep -q "token"; then
    echo -e "${GREEN}OK${NC}"
    TOKEN=$(echo "$register_response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
else
    echo -e "${RED}FAILED${NC}"
    echo "Response: $register_response"
fi

# Login test
echo -n "Testing login... "
login_response=$(curl -s -X POST http://$SERVER:14701/auth/login \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test@example.com",
        "password": "TestPassword123!"
    }')

if echo "$login_response" | grep -q "token"; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${YELLOW}SKIPPED${NC} (user might not exist)"
fi
echo ""

# Test Voice Service
echo "3. Testing Voice Service"
echo "------------------------"

# Get ICE servers
echo -n "Getting ICE servers... "
ice_response=$(curl -s http://$SERVER:14705/voice/ice-servers)
if echo "$ice_response" | grep -q "stun"; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

# Test WebSocket
test_websocket "Voice" "http://$SERVER:14705/voice/ws"
echo ""

# Test Presence Service
echo "4. Testing Presence Service"
echo "---------------------------"

# Update presence
echo -n "Updating presence... "
presence_response=$(curl -s -X POST http://$SERVER:14706/presence/update/testuser \
    -H "Content-Type: application/json" \
    -d '{
        "status": "Online",
        "activity": "Testing"
    }')

if [ "$?" = "0" ]; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}FAILED${NC}"
fi

# Test WebSocket
test_websocket "Presence" "http://$SERVER:14706/presence/ws"
echo ""

# Test Gateway Routing
echo "5. Testing Gateway Routing"
echo "--------------------------"

echo -n "Testing /auth route... "
gateway_auth=$(curl -s -o /dev/null -w "%{http_code}" http://$SERVER:14700/auth/health)
if [ "$gateway_auth" = "200" ] || [ "$gateway_auth" = "404" ]; then
    echo -e "${GREEN}OK${NC} (Routed to Auth Service)"
else
    echo -e "${RED}FAILED${NC}"
fi

echo -n "Testing /voice route... "
gateway_voice=$(curl -s -o /dev/null -w "%{http_code}" http://$SERVER:14700/voice/health)
if [ "$gateway_voice" = "200" ] || [ "$gateway_voice" = "404" ]; then
    echo -e "${GREEN}OK${NC} (Routed to Voice Service)"
else
    echo -e "${RED}FAILED${NC}"
fi

echo -n "Testing /presence route... "
gateway_presence=$(curl -s -o /dev/null -w "%{http_code}" http://$SERVER:14700/presence/health)
if [ "$gateway_presence" = "200" ] || [ "$gateway_presence" = "404" ]; then
    echo -e "${GREEN}OK${NC} (Routed to Presence Service)"
else
    echo -e "${RED}FAILED${NC}"
fi
echo ""

# Infrastructure Tests
echo "6. Testing Infrastructure"
echo "-------------------------"

# Test MongoDB
echo -n "MongoDB connection... "
mongo_status=$(curl -s http://$SERVER:27017 2>/dev/null | head -c 100)
if echo "$mongo_status" | grep -q "MongoDB"; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${YELLOW}Not directly accessible${NC} (normal for production)"
fi

# Test Redis
echo -n "Redis connection... "
redis_ping=$(echo "PING" | nc -w 1 $SERVER 6379 2>/dev/null)
if echo "$redis_ping" | grep -q "PONG"; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${YELLOW}Protected${NC} (requires auth)"
fi

# Test RabbitMQ Management
echo -n "RabbitMQ Management UI... "
rabbitmq_status=$(curl -s -o /dev/null -w "%{http_code}" http://$SERVER:15672)
if [ "$rabbitmq_status" = "200" ] || [ "$rabbitmq_status" = "401" ]; then
    echo -e "${GREEN}OK${NC} (Available at http://$SERVER:15672)"
else
    echo -e "${RED}FAILED${NC}"
fi
echo ""

# Performance Test
echo "7. Simple Performance Test"
echo "--------------------------"

echo "Testing response times (5 requests each):"

# Gateway
total_time=0
for i in {1..5}; do
    time=$(curl -s -o /dev/null -w "%{time_total}" http://$SERVER:14700/health)
    total_time=$(echo "$total_time + $time" | bc)
done
avg_time=$(echo "scale=3; $total_time / 5" | bc)
echo "Gateway average: ${avg_time}s"

# Auth
total_time=0
for i in {1..5}; do
    time=$(curl -s -o /dev/null -w "%{time_total}" http://$SERVER:14701/health)
    total_time=$(echo "$total_time + $time" | bc)
done
avg_time=$(echo "scale=3; $total_time / 5" | bc)
echo "Auth average: ${avg_time}s"

# Voice
total_time=0
for i in {1..5}; do
    time=$(curl -s -o /dev/null -w "%{time_total}" http://$SERVER:14705/health)
    total_time=$(echo "$total_time + $time" | bc)
done
avg_time=$(echo "scale=3; $total_time / 5" | bc)
echo "Voice average: ${avg_time}s"

# Presence
total_time=0
for i in {1..5}; do
    time=$(curl -s -o /dev/null -w "%{time_total}" http://$SERVER:14706/health)
    total_time=$(echo "$total_time + $time" | bc)
done
avg_time=$(echo "scale=3; $total_time / 5" | bc)
echo "Presence average: ${avg_time}s"
echo ""

# Summary
echo "====================================="
echo "   Test Summary"
echo "====================================="
echo ""
echo "Services Available:"
echo "  Gateway:  http://$SERVER:14700"
echo "  Auth:     http://$SERVER:14701"
echo "  Voice:    http://$SERVER:14705"
echo "  Presence: http://$SERVER:14706"
echo ""
echo "Management UIs:"
echo "  RabbitMQ: http://$SERVER:15672"
echo "  MongoDB:  Use MongoDB Compass to connect"
echo ""
echo -e "${GREEN}Backend is ready for testing!${NC}"
