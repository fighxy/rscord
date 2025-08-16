#!/bin/bash

echo "🛠️ Исправление проблем конфигурации RSCORD"
echo "=========================================="

# Проверяем основные сервисы инфраструктуры
echo "1. 📊 Проверка инфраструктуры..."

# MongoDB
if ! systemctl is-active --quiet mongodb; then
    echo "⚠️  MongoDB не активен. Запускаем..."
    sudo systemctl start mongodb
    sudo systemctl enable mongodb
fi

# Redis
if ! systemctl is-active --quiet redis; then
    echo "⚠️  Redis не активен. Запускаем..."
    sudo systemctl start redis
    sudo systemctl enable redis
fi

# RabbitMQ
if ! systemctl is-active --quiet rabbitmq-server; then
    echo "⚠️  RabbitMQ не активен. Запускаем..."
    sudo systemctl start rabbitmq-server
    sudo systemctl enable rabbitmq-server
fi

sleep 5

echo "2. 🔧 Создание правильной конфигурации..."

# Создаем полную конфигурацию production.toml
sudo mkdir -p /opt/rscord/config

sudo tee /opt/rscord/config/production.toml > /dev/null << 'EOF'
[database]
mongodb_url = "mongodb://127.0.0.1:27017"
database_name = "rscord_prod"

[redis]
url = "redis://127.0.0.1:6379"

[rabbitmq]
url = "amqp://guest:guest@127.0.0.1:5672"

[server]
host = "0.0.0.0"

[jwt]
secret = "rscord-super-secret-jwt-key-for-production-env-2025"

[gateway]
port = 14700

[auth_service]
port = 14701

[chat_service]
port = 14702

[voice_service]
port = 14705
stun_servers = ["stun:stun.l.google.com:19302"]

[presence_service]
port = 14706

[livekit]
api_key = "devkey"
api_secret = "secret"
host = "127.0.0.1:7880"

[logging]
level = "info"
EOF

echo "✅ Конфигурация создана"

# Проверяем, что бинарные файлы существуют
echo "3. 📦 Проверка бинарных файлов..."
for bin in rscord-gateway rscord-auth-service rscord-voice-service rscord-presence-service; do
    if [ -f "/opt/rscord/bin/$bin" ]; then
        echo "✅ $bin найден"
        sudo chmod +x "/opt/rscord/bin/$bin"
    else
        echo "❌ $bin отсутствует!"
    fi
done

# Проверяем подключения к базам данных
echo "4. 🔗 Проверка подключений к базам..."

# MongoDB
echo "Тестируем MongoDB..."
if timeout 5 mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo "✅ MongoDB подключение OK"
else
    echo "❌ MongoDB недоступен"
fi

# Redis
echo "Тестируем Redis..."
if timeout 5 redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis подключение OK"
else
    echo "❌ Redis недоступен"
fi

# RabbitMQ
echo "Тестируем RabbitMQ..."
if timeout 5 rabbitmqctl status > /dev/null 2>&1; then
    echo "✅ RabbitMQ подключение OK"
else
    echo "❌ RabbitMQ недоступен"
fi

echo "5. 🚀 Пересоздание и запуск сервисов..."

# Останавливаем все сервисы
sudo systemctl stop rscord-* 2>/dev/null

# Удаляем старые unit файлы
sudo rm -f /etc/systemd/system/rscord-*.service

# Создаем новые unit файлы с правильными настройками
create_service() {
    local service_name=$1
    local binary_name=$2
    local port=$3

    sudo tee /etc/systemd/system/${service_name}.service > /dev/null << EOF
[Unit]
Description=RSCORD ${service_name}
After=network-online.target mongodb.service redis.service rabbitmq-server.service
Wants=network-online.target
Requires=mongodb.service redis.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rscord
ExecStart=/opt/rscord/bin/${binary_name}
Environment=RUST_LOG=debug
Environment=CONFIG_PATH=/opt/rscord/config/production.toml
Environment=RUST_BACKTRACE=1
Restart=on-failure
RestartSec=5
TimeoutStartSec=60
StandardOutput=journal
StandardError=journal
KillSignal=SIGINT
KillMode=mixed

[Install]
WantedBy=multi-user.target
EOF
    echo "✅ Создан сервис ${service_name}"
}

# Создаем все сервисы
create_service "rscord-auth-service" "rscord-auth-service" "14701"
create_service "rscord-voice-service" "rscord-voice-service" "14705" 
create_service "rscord-presence-service" "rscord-presence-service" "14706"
create_service "rscord-gateway" "rscord-gateway" "14700"

# Перезагружаем systemd
sudo systemctl daemon-reload

# Включаем и запускаем сервисы
echo "6. ⚙️ Включение и запуск сервисов..."

services=("rscord-auth-service" "rscord-voice-service" "rscord-presence-service" "rscord-gateway")

for service in "${services[@]}"; do
    sudo systemctl enable $service
    echo "Запуск $service..."
    sudo systemctl start $service
    sleep 3
    
    # Проверяем статус
    if sudo systemctl is-active --quiet $service; then
        echo "✅ $service запущен успешно"
    else
        echo "❌ $service не запустился"
        echo "Последние логи:"
        sudo journalctl -u $service -n 5 --no-pager
        echo "---"
    fi
done

echo ""
echo "7. 📊 Финальная диагностика..."

echo "Статус сервисов:"
for service in "${services[@]}"; do
    status=$(sudo systemctl is-active $service 2>/dev/null || echo "не найден")
    echo "  $service: $status"
done

echo ""
echo "Порты:"
ss -tlnp | grep -E ":1470[0156]" | while read line; do
    echo "  $line"
done

echo ""
echo "🎯 Тест HTTP подключений:"
for port in 14700 14701 14705 14706; do
    if timeout 3 bash -c "echo > /dev/tcp/127.0.0.1/$port" 2>/dev/null; then
        echo "  ✅ localhost:$port - открыт"
    else
        echo "  ❌ localhost:$port - недоступен"
    fi
done

echo ""
echo "✨ Исправление завершено!"
echo "Теперь запустите test-backend.sh для проверки"
