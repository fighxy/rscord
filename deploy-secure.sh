#!/bin/bash

# Radiate Secure Deployment Script
# Этот скрипт проверяет безопасность конфигурации перед развертыванием

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 Radiate Secure Deployment Check"
echo "=================================="

# Функция для вывода ошибок
error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Функция для вывода предупреждений
warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Функция для вывода успешных проверок
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Проверка наличия .env файла
if [ ! -f .env ]; then
    error "Файл .env не найден! Создайте его из .env.production.example"
fi

# Загрузка переменных окружения
set -a
source .env
set +a

echo ""
echo "🔒 Проверка безопасности..."
echo "----------------------------"

# 1. Проверка JWT секрета
if [ -z "${JWT_SECRET:-}" ]; then
    error "JWT_SECRET не установлен!"
fi

if [ ${#JWT_SECRET} -lt 32 ]; then
    error "JWT_SECRET слишком короткий! Минимум 32 символа для безопасности."
fi

if [ "$JWT_SECRET" == "default-jwt-secret-change-in-production" ]; then
    error "Используется дефолтный JWT_SECRET! Это критическая уязвимость!"
fi

success "JWT секрет настроен правильно"

# 2. Проверка Telegram токена
if [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
    error "TELEGRAM_BOT_TOKEN не установлен!"
fi

if [[ ! "$TELEGRAM_BOT_TOKEN" =~ ^[0-9]+:[A-Za-z0-9_-]{35,}$ ]]; then
    error "TELEGRAM_BOT_TOKEN имеет неверный формат!"
fi

# Проверяем, не захардкожен ли токен
if grep -r "8485874967:AAHyf9abWYBwbTrlHFcY9RaP25IvRg8jbk8Use" ./servers > /dev/null 2>&1; then
    error "Найден захардкоженный Telegram токен в коде! Удалите его немедленно!"
fi

success "Telegram бот токен настроен правильно"

# 3. Проверка MongoDB
if [ -z "${MONGO_URI:-}" ]; then
    error "MONGO_URI не установлен!"
fi

if [[ "$MONGO_URI" == *"localhost"* ]] && [ "$NODE_ENV" == "production" ]; then
    warning "Используется localhost для MongoDB в production!"
fi

if [[ "$MONGO_URI" != *"authSource"* ]]; then
    warning "MongoDB URI не содержит authSource. Убедитесь, что авторизация настроена!"
fi

success "MongoDB настроен"

# 4. Проверка Redis
if [ -z "${REDIS_URL:-}" ]; then
    error "REDIS_URL не установлен!"
fi

if [[ "$REDIS_URL" != *"redis://:*"* ]] && [ "$NODE_ENV" == "production" ]; then
    warning "Redis не защищен паролем в production!"
fi

success "Redis настроен"

# 5. Проверка LiveKit
if [ -z "${LIVEKIT_API_KEY:-}" ] || [ -z "${LIVEKIT_API_SECRET:-}" ]; then
    error "LiveKit API credentials не установлены!"
fi

if [ "$LIVEKIT_API_KEY" == "devkey" ] || [ "$LIVEKIT_API_SECRET" == "secret" ]; then
    error "Используются дефолтные LiveKit credentials! Это небезопасно!"
fi

success "LiveKit настроен правильно"

# 6. Проверка TLS/SSL
if [ "${USE_TLS:-false}" == "true" ]; then
    if [ ! -f "${TLS_CERT_PATH:-}" ] || [ ! -f "${TLS_KEY_PATH:-}" ]; then
        error "TLS включен, но сертификаты не найдены!"
    fi
    success "TLS/SSL сертификаты найдены"
else
    if [ "$NODE_ENV" == "production" ]; then
        warning "TLS отключен в production! Это серьезная уязвимость!"
    fi
fi

echo ""
echo "📦 Проверка зависимостей..."
echo "---------------------------"

# Проверка Docker
if ! command -v docker &> /dev/null; then
    error "Docker не установлен!"
fi
success "Docker установлен"

# Проверка Docker Compose
if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose не установлен!"
fi
success "Docker Compose установлен"

# Проверка Nginx
if ! docker ps | grep -q nginx; then
    warning "Nginx контейнер не запущен"
fi

# Проверка портов
echo ""
echo "🔌 Проверка портов..."
echo "---------------------"

check_port() {
    local port=$1
    local service=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        success "Порт $port ($service) доступен"
    else
        warning "Порт $port ($service) не слушается"
    fi
}

check_port 14701 "Auth Service"
check_port 14702 "Chat Service"
check_port 14703 "Telegram Bot"
check_port 14705 "Voice Service"
check_port 7880 "LiveKit"
check_port 6379 "Redis"
check_port 27017 "MongoDB"

echo ""
echo "🏗️  Сборка и развертывание..."
echo "-----------------------------"

# Сборка Rust сервисов
echo "Сборка backend сервисов..."
cd servers
cargo build --release

# Проверка успешности сборки
if [ $? -ne 0 ]; then
    error "Сборка Rust сервисов провалилась!"
fi
success "Backend сервисы собраны"

# Запуск через Docker Compose
echo "Запуск сервисов через Docker Compose..."
docker-compose -f ../docker-compose.production.yml up -d

# Проверка статуса контейнеров
sleep 5
if [ $(docker ps -q | wc -l) -lt 5 ]; then
    warning "Не все контейнеры запущены. Проверьте логи: docker-compose logs"
fi

echo ""
echo "🔍 Финальные проверки..."
echo "------------------------"

# Health checks
check_health() {
    local url=$1
    local service=$2
    
    if curl -f -s "$url/health" > /dev/null 2>&1; then
        success "$service health check пройден"
    else
        warning "$service health check провален"
    fi
}

check_health "http://localhost:14701" "Auth Service"
check_health "http://localhost:14702" "Chat Service"
check_health "http://localhost:14703" "Telegram Bot"
check_health "http://localhost:14705" "Voice Service"

echo ""
echo "=================================="
echo -e "${GREEN}🎉 Развертывание завершено!${NC}"
echo ""
echo "📋 Следующие шаги:"
echo "  1. Проверьте логи: docker-compose logs -f"
echo "  2. Настройте мониторинг: http://localhost:9090 (Prometheus)"
echo "  3. Проверьте метрики: http://localhost:14705/metrics"
echo "  4. Настройте backup: ./backup.sh"
echo ""
echo "⚠️  Важные напоминания:"
echo "  - Регулярно обновляйте зависимости"
echo "  - Проверяйте логи на наличие ошибок"
echo "  - Настройте автоматический backup БД"
echo "  - Включите fail2ban для защиты от брутфорса"
echo ""
