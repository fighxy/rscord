#!/bin/bash

# Тест авторизационного flow между сервисами
# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Тестирование Auth Flow ===${NC}"

# Проверяем доступность сервисов
echo -e "\n${YELLOW}1. Проверка доступности сервисов...${NC}"

# Auth Service
AUTH_HEALTH=$(curl -s http://localhost:14701/health)
if [ "$AUTH_HEALTH" == "Auth service is healthy" ]; then
    echo -e "${GREEN}✓ Auth Service работает на порту 14701${NC}"
else
    echo -e "${RED}✗ Auth Service не доступен на порту 14701${NC}"
    exit 1
fi

# Telegram Bot Service
BOT_HEALTH=$(curl -s http://localhost:14703/health)
if [ "$BOT_HEALTH" == "Telegram Bot Service is healthy" ]; then
    echo -e "${GREEN}✓ Telegram Bot Service работает на порту 14703${NC}"
else
    echo -e "${RED}✗ Telegram Bot Service не доступен на порту 14703${NC}"
    exit 1
fi

# Тест 1: Проверка username
echo -e "\n${YELLOW}2. Тест проверки username...${NC}"
CHECK_USERNAME=$(curl -s -X POST http://localhost:14701/api/auth/check-username \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser123"}')

echo "Результат проверки username: $CHECK_USERNAME"

# Тест 2: Регистрация через Telegram
echo -e "\n${YELLOW}3. Тест регистрации через Telegram...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:14701/api/auth/telegram/register \
  -H "Content-Type: application/json" \
  -d '{
    "telegram_id": 123456789,
    "telegram_username": "test_telegram_user",
    "username": "testuser123",
    "display_name": "Test User"
  }')

if echo "$REGISTER_RESPONSE" | grep -q "user"; then
    echo -e "${GREEN}✓ Регистрация успешна${NC}"
    echo "Ответ: $REGISTER_RESPONSE"
else
    echo -e "${YELLOW}⚠ Пользователь уже существует или ошибка регистрации${NC}"
    echo "Ответ: $REGISTER_RESPONSE"
fi

# Тест 3: Запрос кода авторизации
echo -e "\n${YELLOW}4. Тест запроса кода авторизации...${NC}"
CODE_RESPONSE=$(curl -s -X POST http://localhost:14701/api/auth/telegram/request-code \
  -H "Content-Type: application/json" \
  -d '{
    "telegram_id": 123456789,
    "username": "testuser123"
  }')

if echo "$CODE_RESPONSE" | grep -q "code"; then
    echo -e "${GREEN}✓ Код сгенерирован${NC}"
    echo "Ответ: $CODE_RESPONSE"
    
    # Извлекаем код из ответа
    CODE=$(echo "$CODE_RESPONSE" | grep -o '"code":"[0-9]*"' | cut -d'"' -f4)
    echo -e "${GREEN}Код авторизации: $CODE${NC}"
    
    # Тест 4: Проверка кода
    echo -e "\n${YELLOW}5. Тест проверки кода...${NC}"
    VERIFY_RESPONSE=$(curl -s -X POST http://localhost:14701/api/auth/telegram/verify-code \
      -H "Content-Type: application/json" \
      -d "{\"code\": \"$CODE\"}")
    
    if echo "$VERIFY_RESPONSE" | grep -q "token"; then
        echo -e "${GREEN}✓ Код подтвержден, JWT токен получен${NC}"
        # Извлекаем токен
        TOKEN=$(echo "$VERIFY_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        echo -e "${GREEN}JWT Token (первые 50 символов): ${TOKEN:0:50}...${NC}"
        
        # Тест 5: Проверка токена
        echo -e "\n${YELLOW}6. Тест проверки JWT токена...${NC}"
        USER_RESPONSE=$(curl -s -X GET http://localhost:14701/api/auth/verify \
          -H "Authorization: Bearer $TOKEN")
        
        if echo "$USER_RESPONSE" | grep -q "username"; then
            echo -e "${GREEN}✓ JWT токен валиден${NC}"
            echo "Пользователь: $USER_RESPONSE"
        else
            echo -e "${RED}✗ JWT токен не валиден${NC}"
            echo "Ответ: $USER_RESPONSE"
        fi
    else
        echo -e "${RED}✗ Ошибка проверки кода${NC}"
        echo "Ответ: $VERIFY_RESPONSE"
    fi
else
    echo -e "${RED}✗ Ошибка генерации кода${NC}"
    echo "Ответ: $CODE_RESPONSE"
fi

echo -e "\n${GREEN}=== Тестирование завершено ===${NC}"
