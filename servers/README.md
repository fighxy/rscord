# RSCORD Backend Services

Backend микросервисы для RSCORD desktop приложения.

## 🚀 Быстрый запуск

### 1. Установка зависимостей

```bash
# Установить Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Установить MongoDB
sudo apt update
sudo apt install mongodb

# Установить Redis
sudo apt install redis-server

# Установить curl для проверки статуса
sudo apt install curl
```

### 2. Запуск всех сервисов

```bash
# Сделать скрипты исполняемыми
chmod +x *.sh

# Запустить все сервисы
./start-backend.sh
```

### 3. Проверка статуса

```bash
# Проверить статус всех сервисов
./check-status.sh

# Просмотр логов в реальном времени
tail -f logs/gateway.log
tail -f logs/auth-service.log
tail -f logs/chat-service.log
```

### 4. Остановка сервисов

```bash
# Остановить все сервисы
./stop-backend.sh
```

## 🌐 Конфигурация

### Порты сервисов:
- **API Gateway**: 14700 (основной endpoint)
- **Auth Service**: 14701
- **Chat Service**: 14703
- **Voice Service**: 14705
- **Presence Service**: 14706

### Внешний доступ:
- **URL**: `http://5.35.83.143:14700`
- **Desktop app**: подключается к `http://5.35.83.143:14700`

## 📡 API Endpoints

### Аутентификация:
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход
- `GET /api/auth/me` - Получить текущего пользователя
- `GET /api/auth/verify` - Проверить токен
- `POST /api/auth/refresh` - Обновить токен
- `POST /api/auth/logout` - Выход

### Серверы:
- `GET /api/servers` - Список серверов пользователя
- `POST /api/servers` - Создать сервер
- `GET /api/servers/:id` - Получить сервер
- `GET /api/servers/:id/channels` - Каналы сервера
- `GET /api/servers/:id/members` - Участники сервера

### Каналы:
- `GET /api/channels/:id/messages` - Сообщения канала
- `POST /api/channels/:id/messages` - Отправить сообщение

### Пользователи:
- `GET /api/users/profile` - Профиль пользователя
- `POST /api/users/update` - Обновить профиль
- `POST /api/users/avatar` - Обновить аватар
- `POST /api/users/status` - Обновить статус
- `POST /api/users/settings` - Обновить настройки

### Файлы:
- `POST /api/files/upload` - Загрузить файл
- `GET /api/files/:id` - Получить файл
- `DELETE /api/files/:id` - Удалить файл

### Голос:
- `POST /api/voice/channels/:id/join` - Присоединиться к голосовому каналу
- `POST /api/voice/channels/:id/leave` - Покинуть голосовой канал
- `POST /api/voice/mute` - Заглушить/разглушить
- `POST /api/voice/deafen` - Заглушить/разглушить звук

## 🔧 Разработка

### Запуск отдельного сервиса:

```bash
cd auth-service
cargo run --release

cd ../chat-service
cargo run --release

cd ../voice-service
cargo run --release

cd ../gateway
cargo run --release
```

### Логи:
- Все логи сохраняются в папке `logs/`
- Каждый сервис имеет свой лог файл
- PID файлы для управления процессами

## 🚨 Устранение неполадок

### Сервис не запускается:
1. Проверить, что MongoDB и Redis запущены
2. Проверить, что порт не занят: `netstat -tlnp | grep :14700`
3. Проверить логи: `tail -f logs/[service-name].log`

### Desktop app не подключается:
1. Проверить, что gateway запущен на порту 14700
2. Проверить firewall: `sudo ufw status`
3. Проверить внешний доступ: `curl http://5.35.83.143:14700/health`

### Ошибки базы данных:
1. Проверить, что MongoDB запущен: `sudo systemctl status mongodb`
2. Проверить подключение: `mongo --eval "db.runCommand('ping')"`

## 📋 Мониторинг

### Системные ресурсы:
```bash
# Память
free -h

# Диск
df -h

# Процессы
ps aux | grep -E "(gateway|auth|chat|voice|presence)"
```

### Сетевые соединения:
```bash
# Активные соединения
netstat -tlnp

# Проверка портов
nmap localhost -p 14700-14706
```

## 🔐 Безопасность

- JWT токены для аутентификации
- CORS настроен для desktop приложения
- Все API endpoints защищены (кроме /health)
- Пароли хешируются с помощью Argon2

## 📞 Поддержка

При возникновении проблем:
1. Проверить логи сервисов
2. Проверить статус: `./check-status.sh`
3. Перезапустить сервисы: `./stop-backend.sh && ./start-backend.sh`
