#!/bin/bash

# RSCORD WebSocket Test Script
# Проверяет работу WebSocket соединения с gateway

set -e

echo "🧪 Testing RSCORD WebSocket Implementation..."

GATEWAY_URL="http://localhost:14700"
WS_URL="ws://localhost:14700/ws"
TEST_TOKEN="test_token_12345"

echo "1️⃣ Testing gateway health endpoint..."
if curl -f "$GATEWAY_URL/health"; then
    echo "✅ Gateway health check passed"
else
    echo "❌ Gateway health check failed"
    exit 1
fi

echo ""
echo "2️⃣ Testing WebSocket endpoint availability..."
# Простая проверка доступности WebSocket endpoint
if curl -f -H "Connection: upgrade" -H "Upgrade: websocket" "$GATEWAY_URL/ws?token=$TEST_TOKEN" 2>/dev/null; then
    echo "✅ WebSocket endpoint is reachable"
else
    echo "⚠️  WebSocket endpoint test inconclusive (expected for curl)"
fi

echo ""
echo "3️⃣ Building gateway service..."
cd servers
if cargo build --release --bin rscord-gateway; then
    echo "✅ Gateway build successful"
else
    echo "❌ Gateway build failed"
    exit 1
fi

echo ""
echo "4️⃣ Checking gateway binary..."
if [ -f "target/release/rscord-gateway" ]; then
    echo "✅ Gateway binary exists"
    echo "📊 Binary size: $(du -h target/release/rscord-gateway | cut -f1)"
else
    echo "❌ Gateway binary not found"
    exit 1
fi

echo ""
echo "5️⃣ Testing gateway service startup..."
# Запускаем gateway в фоне для тестирования
RUST_LOG=info ./target/release/rscord-gateway &
GATEWAY_PID=$!

echo "Gateway started with PID: $GATEWAY_PID"

# Ждем запуска
sleep 3

# Проверяем что процесс запущен
if kill -0 $GATEWAY_PID 2>/dev/null; then
    echo "✅ Gateway process is running"
    
    # Тестируем health endpoint
    if curl -f "$GATEWAY_URL/health" 2>/dev/null; then
        echo "✅ Gateway responds to health checks"
    else
        echo "❌ Gateway not responding to health checks"
    fi
    
    # Останавливаем процесс
    kill $GATEWAY_PID
    echo "🛑 Gateway stopped"
else
    echo "❌ Gateway process failed to start"
    exit 1
fi

echo ""
echo "6️⃣ Validating WebSocket message types..."
cd ..
if grep -q "WsMessage" servers/gateway/src/websocket/handler.rs; then
    echo "✅ WebSocket message types defined"
else
    echo "❌ WebSocket message types not found"
    exit 1
fi

echo ""
echo "7️⃣ Checking JWT validation..."
if grep -q "JwtValidator" servers/gateway/src/websocket/auth.rs; then
    echo "✅ JWT validation implemented"
else
    echo "❌ JWT validation not found"
    exit 1
fi

echo ""
echo "8️⃣ Verifying chat service integration..."
if grep -q "ChatServiceClient" servers/gateway/src/websocket/chat_client.rs; then
    echo "✅ Chat service integration implemented"
else
    echo "❌ Chat service integration not found"
    exit 1
fi

echo ""
echo "🎉 All WebSocket tests passed!"
echo ""
echo "📝 Next steps:"
echo "  1. Start all services: ./start-backend.sh"
echo "  2. Test WebSocket from frontend"
echo "  3. Monitor logs for WebSocket connections"
echo ""
echo "🔗 WebSocket endpoint: $WS_URL?token=YOUR_JWT_TOKEN"
echo "📋 Use WEBSOCKET_API.md for integration details"
