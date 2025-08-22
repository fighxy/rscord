#!/bin/bash

# Radiate Voice Stack Startup Script
# Запускает инфраструктуру для голосового общения

echo "🎤 Starting Radiate Voice Stack..."

# Проверяем, что Docker запущен
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Создаем директории если нужно
mkdir -p logs
mkdir -p coturn

echo "🐳 Starting infrastructure services..."

# Запускаем только инфраструктурные сервисы + голосовые
docker-compose up -d mongo redis rabbitmq minio coturn livekit

echo "⏳ Waiting for services to be ready..."

# Ждем готовности MongoDB
echo "📊 Waiting for MongoDB..."
while ! docker exec radiate-mongo mongosh --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; do
    sleep 2
done
echo "✅ MongoDB ready"

# Ждем готовности Redis
echo "🔴 Waiting for Redis..."
while ! docker exec radiate-redis redis-cli ping > /dev/null 2>&1; do
    sleep 2
done
echo "✅ Redis ready"

# Ждем готовности Coturn
echo "🔄 Waiting for Coturn..."
sleep 5
echo "✅ Coturn should be ready"

# Ждем готовности LiveKit
echo "🎥 Waiting for LiveKit..."
while ! curl -s "http://localhost:7880/twirp/livekit.HealthService/HealthCheck" > /dev/null 2>&1; do
    sleep 3
done
echo "✅ LiveKit ready"

echo "🎉 Voice infrastructure is ready!"
echo ""
echo "📋 Service Status:"
echo "  MongoDB:    http://localhost:27017"
echo "  Redis:      localhost:6379" 
echo "  RabbitMQ:   http://localhost:15672 (guest/guest)"
echo "  MinIO:      http://localhost:9001 (minioadmin/minioadmin)"
echo "  Coturn:     localhost:3478 (STUN/TURN)"
echo "  LiveKit:    http://localhost:7880"
echo ""
echo "🚀 Now you can start the Radiate backend services:"
echo "  ./start-backend.sh"
echo ""
echo "🔊 Voice Features Enabled:"
echo "  ✅ STUN server for NAT detection"
echo "  ✅ TURN server for NAT traversal" 
echo "  ✅ LiveKit for WebRTC media"
echo "  ✅ Redis for session management"