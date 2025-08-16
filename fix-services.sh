#!/bin/bash

echo "🔧 Исправление и перезапуск RSCORD сервисов"
echo "==========================================="

# Остановка всех сервисов
echo "🛑 Остановка всех сервисов..."
sudo systemctl stop rscord-gateway rscord-auth-service rscord-voice-service rscord-presence-service rscord-chat-service

# Проверяем и создаем необходимые директории
echo "📁 Создание необходимых директорий..."
sudo mkdir -p /opt/rscord/bin
sudo mkdir -p /opt/rscord/config
sudo mkdir -p /opt/rscord/logs

# Устанавливаем правильные права
echo "🔑 Установка прав доступа..."
sudo chown -R root:root /opt/rscord
sudo chmod +x /opt/rscord/bin/*

# Проверяем конфигурационные файлы
if [ ! -f /opt/rscord/config/production.toml ]; then
    echo "❌ Файл конфигурации отсутствует!"
    echo "Создаем базовую конфигурацию..."
    
    sudo tee /opt/rscord/config/production.toml > /dev/null << 'EOF'
[database]
mongodb_url = "mongodb://localhost:27017"
database_name = "rscord_prod"

[redis]
url = "redis://localhost:6379"

[rabbitmq]
url = "amqp://localhost:5672"

[server]
host = "0.0.0.0"

[jwt]
secret = "your-super-secret-jwt-key-change-in-production-123456789"

[gateway]
port = 14700

[auth_service]
port = 14701

[chat_service]
port = 14702

[voice_service] 
port = 14705

[presence_service]
port = 14706

[livekit]
api_key = "devkey"
api_secret = "secret"
host = "localhost:7880"
EOF
fi

# Создаем улучшенные systemd unit файлы
echo "📝 Создание systemd unit файлов..."

# Gateway Service
sudo tee /etc/systemd/system/rscord-gateway.service > /dev/null << 'EOF'
[Unit]
Description=RSCORD Gateway Service
After=network.target mongodb.service redis.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rscord
ExecStart=/opt/rscord/bin/rscord-gateway
Environment=RUST_LOG=info
Environment=CONFIG_PATH=/opt/rscord/config/production.toml
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Auth Service
sudo tee /etc/systemd/system/rscord-auth-service.service > /dev/null << 'EOF'
[Unit]
Description=RSCORD Auth Service
After=network.target mongodb.service redis.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rscord
ExecStart=/opt/rscord/bin/rscord-auth-service
Environment=RUST_LOG=info
Environment=CONFIG_PATH=/opt/rscord/config/production.toml
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Voice Service
sudo tee /etc/systemd/system/rscord-voice-service.service > /dev/null << 'EOF'
[Unit]
Description=RSCORD Voice Service
After=network.target mongodb.service redis.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rscord
ExecStart=/opt/rscord/bin/rscord-voice-service
Environment=RUST_LOG=info
Environment=CONFIG_PATH=/opt/rscord/config/production.toml
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Presence Service
sudo tee /etc/systemd/system/rscord-presence-service.service > /dev/null << 'EOF'
[Unit]
Description=RSCORD Presence Service
After=network.target mongodb.service redis.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rscord
ExecStart=/opt/rscord/bin/rscord-presence-service
Environment=RUST_LOG=info
Environment=CONFIG_PATH=/opt/rscord/config/production.toml
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Chat Service
sudo tee /etc/systemd/system/rscord-chat-service.service > /dev/null << 'EOF'
[Unit]
Description=RSCORD Chat Service
After=network.target mongodb.service redis.service rabbitmq-server.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rscord
ExecStart=/opt/rscord/bin/rscord-chat-service
Environment=RUST_LOG=info
Environment=CONFIG_PATH=/opt/rscord/config/production.toml
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Перезагружаем systemd
echo "🔄 Перезагрузка systemd..."
sudo systemctl daemon-reload

# Включаем автозапуск сервисов
echo "⚙️ Включение автозапуска сервисов..."
sudo systemctl enable rscord-gateway rscord-auth-service rscord-voice-service rscord-presence-service

# Проверяем статус инфраструктуры
echo "📊 Проверка статуса инфраструктуры..."
echo "MongoDB:"
sudo systemctl status mongodb --no-pager -l | head -5
echo "Redis:"
sudo systemctl status redis --no-pager -l | head -5
echo "RabbitMQ:"
sudo systemctl status rabbitmq-server --no-pager -l | head -5

# Запускаем сервисы по одному с проверкой
echo "🚀 Запуск сервисов..."

services=("rscord-auth-service" "rscord-voice-service" "rscord-presence-service" "rscord-gateway")

for service in "${services[@]}"; do
    echo "Запуск $service..."
    sudo systemctl start $service
    sleep 3
    
    if sudo systemctl is-active --quiet $service; then
        echo "✅ $service запущен успешно"
    else
        echo "❌ $service не запустился. Логи:"
        sudo journalctl -u $service -n 10 --no-pager
    fi
done

echo ""
echo "📊 Финальная проверка статуса:"
for service in "${services[@]}"; do
    status=$(sudo systemctl is-active $service)
    if [ "$status" = "active" ]; then
        echo "✅ $service: $status"
    else
        echo "❌ $service: $status"
    fi
done

echo ""
echo "🔗 Проверка портов:"
netstat -tlnp | grep -E "(14700|14701|14705|14706)" || echo "Нет активных портов"

echo ""
echo "🎯 Быстрый тест подключения:"
for port in 14700 14701 14705 14706; do
    if timeout 3 bash -c "</dev/tcp/localhost/$port"; then
        echo "✅ Порт $port открыт"
    else
        echo "❌ Порт $port недоступен"
    fi
done

echo ""
echo "✨ Исправления завершены!"
echo "📍 Проверьте сервисы:"
echo "   Gateway: http://5.35.83.143:14700/health"
echo "   Auth: http://5.35.83.143:14701/health" 
echo "   Voice: http://5.35.83.143:14705/health"
echo "   Presence: http://5.35.83.143:14706/health"
