# LiveKit Integration для RSCORD

## ✅ Итерация 3 завершена: Backend Setup

### Что было реализовано:

#### 1. **Docker Compose конфигурация**
- ✅ Добавлен LiveKit сервер в `docker-compose.yml`
- ✅ Конфигурация `livekit.yaml` с development настройками
- ✅ Интеграция с Redis для state management
- ✅ Порты: 7880 (WebRTC), 7881 (TCP), 7882 (UDP)

#### 2. **API интеграция**
- ✅ Эндпоинт `/voice/token` для генерации токенов
- ✅ JWT аутентификация для доступа к голосовым каналам
- ✅ Mock версия для development (из-за проблем компиляции LiveKit crate)

#### 3. **Frontend интеграция**
- ✅ Автоматическое получение токенов из API
- ✅ Подключение к LiveKit серверу через WebSocket
- ✅ Обработка loading состояний

#### 4. **Development скрипты**
- ✅ `servers/start_livekit.cmd` - запуск только LiveKit
- ✅ `scripts/start_livekit_dev.cmd` - полный development стек

### Конфигурация LiveKit:

```yaml
# livekit.yaml
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000

redis:
  address: redis:6379

keys:
  devkey: devsecret

development: true
```

### API Endpoint:

```
GET /voice/token?channel_id={channel_id}&user_id={user_id}
Authorization: Bearer {jwt_token}

Response:
{
  "token": "eyJ...", // LiveKit JWT token
  "url": "ws://localhost:7880"
}
```

### Frontend интеграция:

```typescript
// VoiceChannelPane.tsx
const fetchLivekitToken = async () => {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(
    `http://127.0.0.1:14702/voice/token?channel_id=${channelId}&user_id=${user.id}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  const data = await response.json();
  setLivekitToken(data.token);
};

<LiveKitRoom
  token={livekitToken || ""}
  serverUrl="ws://localhost:7880"
  connect={joined && !!livekitToken}
  audio={true}
  video={true}
>
```

## Как запустить:

### Вариант 1: Полный стек
```bash
scripts/start_livekit_dev.cmd
```

### Вариант 2: Только LiveKit
```bash
servers/start_livekit.cmd
```

### Вариант 3: Manual
```bash
# 1. Start dependencies
docker-compose up -d mongo redis livekit

# 2. Start API server
cd servers && cargo run -p rscord-api

# 3. Start frontend
cd apps/desktop && npm run dev
```

## Известные проблемы:

### 1. **LiveKit Rust crate компиляция**
- **Проблема**: WebRTC dependencies не компилируются на Windows
- **Решение**: Используется mock token generation для development
- **Production**: Нужно настроить Linux build environment или использовать LiveKit Cloud

### 2. **CORS для development**
- API сервер уже настроен с CORS для localhost
- Frontend делает запросы на `http://127.0.0.1:14702`

### 3. **WebRTC permissions**
- В Tauri app нужны permissions для mic/camera
- В браузере (dev mode) автоматически запрашиваются

## Следующие шаги (Итерация 4):

1. **Тестирование интеграции**
   - Запуск полного стека
   - Тест подключения к голосовым каналам
   - Проверка audio/video/screen sharing

2. **Production готовность**
   - Настройка TURN серверов
   - Реальная LiveKit token generation
   - SSL/TLS для production

3. **UI доработки**
   - Реальные видео треки вместо плейсхолдеров
   - Обработка ошибок подключения
   - Индикаторы качества связи

## Структура файлов:

```
docker-compose.yml          # LiveKit сервер
livekit.yaml               # LiveKit конфигурация
servers/
  start_livekit.cmd        # Запуск LiveKit
  crates/api/src/
    livekit_mock.rs        # Mock token generation
scripts/
  start_livekit_dev.cmd    # Полный dev стек
apps/desktop/src/modules/voice/components/
  VoiceChannelPane.tsx     # LiveKit интеграция
```

Итерация 3 готова! Можно переходить к тестированию полной интеграции.
