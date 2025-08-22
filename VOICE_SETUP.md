# 🎤 Radiate Voice Chat Setup

## Архитектура голосового общения

```
[Пользователь] → [NAT/Firewall] → [Coturn STUN/TURN] → [LiveKit] → [Redis] → [Backend Services]
```

## Компоненты

### 1. **Coturn** - STUN/TURN Server
- **Порт**: 3478 (UDP/TCP)
- **Функция**: Помогает преодолеть NAT и firewalls
- **Пользователь**: `radiate_user`
- **Пароль**: `radiate_secure_password_2024`

### 2. **LiveKit** - WebRTC Media Server  
- **Порт**: 7880 (HTTP API), 7881 (TCP), 50000-60000 (UDP)
- **Функция**: Обработка аудио/видео потоков
- **API Key**: `devkey` / `devsecret`

### 3. **Redis** - Session Storage
- **Порт**: 6379
- **Функция**: Кэш для LiveKit и сессий

## Запуск

### 1. Запуск инфраструктуры:
```bash
./start-voice-stack.sh
```

### 2. Запуск backend сервисов:
```bash
./start-backend.sh
```

## Как работает NAT Traversal

### 1. **STUN** (Session Traversal Utilities for NAT)
- Определяет внешний IP адрес клиента
- Определяет тип NAT
- Работает для простых NAT конфигураций

### 2. **TURN** (Traversal Using Relays around NAT)
- Релей сервер для сложных NAT/Firewall
- Весь трафик идет через TURN сервер
- Работает в 100% случаев (но использует больше трафика)

## Конфигурация для продакшена

### Для публичного сервера замените:

**docker-compose.yml:**
```yaml
coturn:
  environment:
    - EXTERNAL_IP=YOUR_PUBLIC_IP
```

**livekit.yaml:**
```yaml
rtc:
  use_external_ip: true
  # Замените 127.0.0.1 на ваш публичный IP
  ice_servers:
    - urls: "stun:YOUR_PUBLIC_IP:3478"
    - urls: "turn:YOUR_PUBLIC_IP:3478"
```

**radiate.toml:**
```toml
[voice]
stun_servers = ["stun:YOUR_PUBLIC_IP:3478"]
turn_servers = ["turn:YOUR_PUBLIC_IP:3478"]
```

## Безопасность

1. **Смените пароли**:
   - Coturn: `TURN_PASSWORD`
   - LiveKit: `devsecret`

2. **Firewall правила**:
   ```bash
   # Открыть порты
   ufw allow 3478/udp    # Coturn STUN
   ufw allow 3478/tcp    # Coturn TURN
   ufw allow 7880/tcp    # LiveKit API
   ufw allow 7881/tcp    # LiveKit RTC
   ufw allow 50000:60000/udp  # LiveKit media
   ```

## Отладка

### Проверить Coturn:
```bash
docker logs radiate-coturn
```

### Проверить LiveKit:
```bash
curl http://localhost:7880/twirp/livekit.HealthService/HealthCheck
```

### Тест STUN:
```bash
# Установить stun-client: apt install stun-client
stun localhost -p 3478
```

## Порты

| Сервис   | Порт     | Протокол | Описание |
|----------|----------|----------|----------|
| Coturn   | 3478     | UDP/TCP  | STUN/TURN |
| Coturn   | 5349     | TCP      | TURN over TLS |
| LiveKit  | 7880     | TCP      | HTTP API |
| LiveKit  | 7881     | TCP      | WebRTC TCP |
| LiveKit  | 50000-60000 | UDP   | WebRTC media |

## Мониторинг

- **LiveKit Dashboard**: http://localhost:7880
- **Redis**: `redis-cli monitor` 
- **Logs**: `docker-compose logs -f coturn livekit`