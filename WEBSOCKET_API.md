# RSCORD WebSocket API Documentation

## Подключение к WebSocket

**Endpoint:** `ws://your-server:14700/ws?token=YOUR_JWT_TOKEN`

### Параметры подключения:
- `token` (обязательный) - JWT токен для аутентификации

## Структура сообщений

Все сообщения передаются в JSON формате со следующей структурой:

```json
{
  "type": "message_type",
  "field1": "value1",
  "field2": "value2"
}
```

## Сообщения от клиента к серверу

### 1. Присоединение к каналу
```json
{
  "type": "join_channel",
  "channel_id": "channel_123"
}
```

### 2. Покидание канала
```json
{
  "type": "leave_channel", 
  "channel_id": "channel_123"
}
```

### 3. Отправка сообщения
```json
{
  "type": "send_message",
  "channel_id": "channel_123",
  "content": "Привет всем!"
}
```

### 4. Начало набора текста
```json
{
  "type": "typing_start",
  "channel_id": "channel_123"
}
```

### 5. Завершение набора текста
```json
{
  "type": "typing_stop",
  "channel_id": "channel_123"
}
```

## Сообщения от сервера к клиенту

### 1. Получено новое сообщение
```json
{
  "type": "message_received",
  "channel_id": "channel_123",
  "user_id": "user_456", 
  "username": "JohnDoe",
  "content": "Привет всем!",
  "timestamp": 1703123456
}
```

### 2. Пользователь присоединился к каналу
```json
{
  "type": "user_joined",
  "channel_id": "channel_123",
  "user_id": "user_456",
  "username": "JohnDoe"
}
```

### 3. Пользователь покинул канал
```json
{
  "type": "user_left",
  "channel_id": "channel_123", 
  "user_id": "user_456"
}
```

### 4. Индикатор набора текста
```json
{
  "type": "typing_indicator",
  "channel_id": "channel_123",
  "user_id": "user_456",
  "username": "JohnDoe", 
  "is_typing": true
}
```

### 5. Ошибка
```json
{
  "type": "error",
  "message": "Описание ошибки"
}
```

### 6. Pong (ответ на ping)
```json
{
  "type": "pong"
}
```

## Пример использования в JavaScript

```javascript
// Подключение к WebSocket
const token = "your_jwt_token_here";
const ws = new WebSocket(`ws://localhost:14700/ws?token=${token}`);

// Обработка подключения
ws.onopen = () => {
    console.log('Connected to RSCORD WebSocket');
    
    // Присоединиться к каналу
    ws.send(JSON.stringify({
        type: "join_channel",
        channel_id: "general"
    }));
};

// Обработка входящих сообщений
ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch(message.type) {
        case 'message_received':
            console.log(`${message.username}: ${message.content}`);
            // Добавить сообщение в UI
            break;
            
        case 'user_joined':
            console.log(`${message.username} joined the channel`);
            break;
            
        case 'user_left':
            console.log(`User left the channel`);
            break;
            
        case 'typing_indicator':
            if (message.is_typing) {
                console.log(`${message.username} is typing...`);
            }
            break;
            
        case 'error':
            console.error('WebSocket error:', message.message);
            break;
    }
};

// Отправка сообщения
function sendMessage(channelId, content) {
    ws.send(JSON.stringify({
        type: "send_message",
        channel_id: channelId,
        content: content
    }));
}

// Показать индикатор набора текста
function startTyping(channelId) {
    ws.send(JSON.stringify({
        type: "typing_start",
        channel_id: channelId
    }));
}

// Скрыть индикатор набора текста
function stopTyping(channelId) {
    ws.send(JSON.stringify({
        type: "typing_stop", 
        channel_id: channelId
    }));
}

// Обработка ошибок
ws.onerror = (error) => {
    console.error('WebSocket error:', error);
};

// Обработка закрытия соединения
ws.onclose = () => {
    console.log('WebSocket connection closed');
    // Попытка переподключения
    setTimeout(() => {
        // Переподключение...
    }, 5000);
};
```

## Коды ответов и ошибки

### Успешное подключение
- Соединение устанавливается при наличии валидного JWT токена

### Ошибки подключения
- `401 Unauthorized` - Отсутствует или невалидный JWT токен
- `400 Bad Request` - Неверный формат запроса

### Ошибки во время работы
- Сообщения с `type: "error"` содержат описание проблемы
- Соединение может быть закрыто при критических ошибках

## Интеграция с chat-service

WebSocket автоматически сохраняет все сообщения в базу данных через chat-service API:
- Сообщения сохраняются перед трансляцией другим пользователям
- При ошибке сохранения пользователь получает уведомление об ошибке
- История сообщений доступна через REST API chat-service

## Производительность

- Поддержка множественных подключений через DashMap
- Эффективная трансляция сообщений только участникам канала
- Автоматическая очистка отключенных пользователей
- Heartbeat для поддержания соединения

## Безопасность

- Аутентификация через JWT токен
- Валидация всех входящих сообщений
- Изоляция каналов - пользователи получают сообщения только из своих каналов
- Защита от спама через rate limiting (планируется)
