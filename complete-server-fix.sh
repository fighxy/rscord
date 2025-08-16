#!/bin/bash

echo "🔧 ПОЛНОЕ ИСПРАВЛЕНИЕ RSCORD СЕРВЕРА"
echo "===================================="

# Останавливаем все сервисы
echo "🛑 Остановка всех RSCORD сервисов..."
sudo systemctl stop rscord-* 2>/dev/null || true

echo "1. 📦 Установка необходимой инфраструктуры..."

# Обновляем пакеты
sudo apt update

# Устанавливаем MongoDB
echo "Installing MongoDB..."
sudo apt install -y mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Устанавливаем Redis
echo "Installing Redis..."
sudo apt install -y redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Устанавливаем RabbitMQ
echo "Installing RabbitMQ..."
sudo apt install -y rabbitmq-server
sudo systemctl start rabbitmq-server
sudo systemctl enable rabbitmq-server

# Ждем запуска сервисов
sleep 10

echo "2. 📂 Проверка и копирование бинарных файлов..."

# Проверяем откуда можно скопировать бинарники
if [ -d "target/release" ]; then
    echo "Найден target/release, копируем бинарники..."
    sudo mkdir -p /opt/rscord/bin
    
    # Копируем все бинарные файлы
    for binary in rscord-gateway rscord-auth-service rscord-voice-service rscord-presence-service rscord-chat-service; do
        if [ -f "target/release/$binary" ]; then
            echo "Копируем $binary..."
            sudo cp "target/release/$binary" "/opt/rscord/bin/"
            sudo chmod +x "/opt/rscord/bin/$binary"
            echo "✅ $binary скопирован"
        else
            echo "❌ $binary не найден в target/release"
        fi
    done
else
    echo "❌ Директория target/release не найдена!"
    echo "Нужно сначала скомпилировать проект..."
    
    # Компилируем проект
    echo "📦 Компиляция проекта..."
    cd /root/rscord/servers
    cargo build --release
    
    # Копируем после компиляции
    cd /root/rscord
    sudo mkdir -p /opt/rscord/bin
    
    for binary in rscord-gateway rscord-auth-service rscord-voice-service rscord-presence-service rscord-chat-service; do
        if [ -f "target/release/$binary" ]; then
            echo "Копируем $binary..."
            sudo cp "target/release/$binary" "/opt/rscord/bin/"
            sudo chmod +x "/opt/rscord/bin/$binary"
            echo "✅ $binary скопирован"
        fi
    done
fi

echo "3. 📝 Создание правильной конфигурации..."

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
secret = "rscord-super-secret-jwt-key-for-production-env-2025-very-long-and-secure"

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

echo "4. 🔧 Создание правильных systemd unit файлов..."

# Удаляем старые
sudo rm -f /etc/systemd/system/rscord-*.service

# Создаем новые без зависимостей от несуществующих сервисов
create_service() {
    local service_name=$1
    local binary_name=$2

    sudo tee /etc/systemd/system/${service_name}.service > /dev/null << EOF
[Unit]
Description=RSCORD ${service_name}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rscord
ExecStart=/opt/rscord/bin/${binary_name}
Environment=RUST_LOG=info
Environment=CONFIG_PATH=/opt/rscord/config/production.toml
Environment=RUST_BACKTRACE=1
Restart=on-failure
RestartSec=5
TimeoutStartSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    echo "✅ Создан сервис ${service_name}"
}

# Создаем сервисы
create_service "rscord-auth-service" "rscord-auth-service"
create_service "rscord-voice-service" "rscord-voice-service" 
create_service "rscord-presence-service" "rscord-presence-service"
create_service "rscord-gateway" "rscord-gateway"
create_service "rscord-chat-service" "rscord-chat-service"

# Перезагружаем systemd
sudo systemctl daemon-reload

echo "5. 🔍 Проверка инфраструктуры..."

# Проверяем MongoDB
if systemctl is-active --quiet mongodb; then
    echo "✅ MongoDB работает"
else
    echo "❌ MongoDB не работает, пытаемся перезапустить..."
    sudo systemctl restart mongodb
fi

# Проверяем Redis
if systemctl is-active --quiet redis-server; then
    echo "✅ Redis работает"
else
    echo "❌ Redis не работает, пытаемся перезапустить..."
    sudo systemctl restart redis-server
fi

# Проверяем RabbitMQ
if systemctl is-active --quiet rabbitmq-server; then
    echo "✅ RabbitMQ работает"
else
    echo "❌ RabbitMQ не работает, пытаемся перезапустить..."
    sudo systemctl restart rabbitmq-server
fi

echo "6. 📋 Проверка бинарных файлов..."
ls -la /opt/rscord/bin/

echo "7. 🚀 Запуск сервисов по очереди..."

services=("rscord-auth-service" "rscord-voice-service" "rscord-presence-service" "rscord-gateway")

for service in "${services[@]}"; do
    echo ""
    echo "Запуск $service..."
    sudo systemctl enable $service
    sudo systemctl start $service
    sleep 5
    
    # Детальная проверка
    if sudo systemctl is-active --quiet $service; then
        echo "✅ $service запущен успешно"
        # Проверяем порт
        case $service in
            rscord-gateway) port=14700 ;;
            rscord-auth-service) port=14701 ;;
            rscord-voice-service) port=14705 ;;
            rscord-presence-service) port=14706 ;;
        esac
        
        sleep 2
        if ss -tlnp | grep ":$port " > /dev/null; then
            echo "✅ Порт $port открыт"
        else
            echo "⚠️  Порт $port пока не открыт (возможно, еще запускается)"
        fi
    else
        echo "❌ $service не запустился"
        echo "Логи ошибок:"
        sudo journalctl -u $service -n 10 --no-pager
        echo "---"
    fi
done

echo ""
echo "8. 📊 Финальная диагностика..."

echo "Статус инфраструктуры:"
for infra in mongodb redis-server rabbitmq-server; do
    if systemctl is-active --quiet $infra; then
        echo "  ✅ $infra: active"
    else
        echo "  ❌ $infra: inactive"
    fi
done

echo ""
echo "Статус RSCORD сервисов:"
for service in "${services[@]}"; do
    status=$(sudo systemctl is-active $service 2>/dev/null || echo "не найден")
    if [ "$status" = "active" ]; then
        echo "  ✅ $service: $status"
    else
        echo "  ❌ $service: $status"
    fi
done

echo ""
echo "Открытые порты:"
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
echo ""
echo "📍 Сервисы должны быть доступны по адресам:"
echo "   Gateway: http://5.35.83.143:14700/health"
echo "   Auth: http://5.35.83.143:14701/health" 
echo "   Voice: http://5.35.83.143:14705/health"
echo "   Presence: http://5.35.83.143:14706/health"
echo ""
echo "🔍 Для дополнительной диагностики используйте:"
echo "   sudo journalctl -u rscord-gateway -f"
echo "   sudo systemctl status rscord-gateway"
