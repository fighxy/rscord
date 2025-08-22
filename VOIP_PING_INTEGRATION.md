# 🏓 VoIP Ping Integration Guide

## Обзор

Система отображения задержки голосового общения (ping VoIP) для Radiate включает:

- **Backend**: Расширенный signaling сервис с ping/pong логикой
- **Frontend**: React компоненты для отображения статистики
- **API**: REST endpoints для получения детальной статистики

## 🏗️ Архитектура

```
[Desktop App] ↔ WebSocket ↔ [Signaling Service] ↔ [LiveKit API] 
      ↑                              ↑
   UI Components              HTTP REST API
      ↑                              ↑
  VoipPingManager           /api/voice/stats/:room_id
```

## 🎯 Типы задержек

| Тип | Описание | Источник |
|-----|----------|----------|
| **Network RTT** | Сетевая задержка до сервера | WebSocket ping/pong |
| **WebRTC RTT** | Задержка WebRTC соединения | LiveKit Stats API |
| **Audio Latency** | Задержка обработки аудио | WebRTC getStats() |
| **Jitter** | Вариация задержки | WebRTC jitter buffer |
| **Packet Loss** | Потеря пакетов | WebRTC statistics |

## 🔧 Backend API

### WebSocket Messages

#### Client → Server
```json
{
  "type": "ping",
  "timestamp": 1703123456789,
  "sequence": 42
}
```

#### Server → Client  
```json
{
  "type": "pong", 
  "timestamp": 1703123456789,
  "sequence": 42,
  "serverTimestamp": 1703123456795
}
```

### REST Endpoints

#### GET `/api/voice/ping`
Простой ping test для проверки связи
```json
{
  "serverTimestamp": 1703123456789,
  "serverRtt": 15,
  "status": "ok"
}
```

#### GET `/api/voice/stats/:room_id`
Детальная статистика комнаты
```json
{
  "roomId": "voice_room_123",
  "participants": [
    {
      "peerId": "user123",
      "networkRtt": 45,
      "webrtcRtt": 52,
      "audioLatency": 38,
      "jitter": 3,
      "packetLoss": 0.1,
      "connectionQuality": "good",
      "audioLevel": 0.7,
      "isSpeaking": true
    }
  ],
  "serverStats": {
    "serverRtt": 12,
    "serverLoad": 0.35,
    "activeRooms": 5,
    "totalParticipants": 23
  }
}
```

## 📱 Frontend Integration

### Простое использование
```tsx
import { VoicePingDisplay } from '../components/VoicePingDisplay';

function VoiceChannel() {
  return (
    <div className="voice-channel">
      <VoicePingDisplay 
        signalingUrl="ws://localhost:8787/ws"
        showNumeric={true}
        showIcon={true}
        showGraph={false}
        size="medium"
      />
    </div>
  );
}
```

### Продвинутое использование с хуком
```tsx
import { useVoipPing } from '../components/VoicePingDisplay';

function AdvancedVoicePanel() {
  const ping = useVoipPing("ws://localhost:8787/ws");
  
  return (
    <div>
      <div className="connection-status">
        Status: {ping.isConnected ? 'Connected' : 'Disconnected'}
      </div>
      <div className="ping-info">
        Current: {ping.current}ms | Average: {ping.average}ms
      </div>
      <div className={`quality-${ping.quality}`}>
        Quality: {ping.quality}
      </div>
    </div>
  );
}
```

## 🎨 Визуальные индикаторы

### Цветовая схема
- 🟢 **Excellent** (< 30ms): Зеленый
- 🟡 **Good** (30-60ms): Желтый  
- 🟠 **Fair** (60-120ms): Оранжевый
- 🔴 **Poor** (120-200ms): Красный
- ⚫ **Disconnected** (> 200ms): Черный

### Компоненты отображения
1. **Numeric Display**: `45ms (avg: 52ms)`
2. **Icon Indicator**: 🟢🟡🟠🔴⚫
3. **Mini Graph**: Линейный график истории ping
4. **Packet Loss**: `2% loss` (если > 0%)

## 🚀 Запуск

### 1. Backend
```bash
# Запуск signaling сервиса (порт 8787)
cd servers/signaling
cargo run --release
```

### 2. Frontend
```bash
# В приложении Radiate Desktop
npm start
# или
yarn dev
```

### 3. Тестирование API
```bash
# Тест ping
curl http://localhost:8787/api/voice/ping

# Статистика комнаты  
curl http://localhost:8787/api/voice/stats/room_123
```

## ⚙️ Настройка

### Конфигурация ping интервала
```typescript
// В VoipPingManager
private readonly PING_INTERVAL = 2000; // 2 секунды
private readonly HISTORY_LENGTH = 30;   // 30 последних ping
```

### Пороги качества соединения
```typescript
export const PING_THRESHOLDS = {
  excellent: 30,   // < 30ms
  good: 60,        // 30-60ms  
  fair: 120,       // 60-120ms
  poor: 200        // 120-200ms
} as const;
```

## 🔍 Мониторинг и отладка

### Логи signaling сервиса
```bash
docker logs radiate-signaling
# или
tail -f servers/logs/signaling.log
```

### Browser DevTools
```javascript
// В консоли браузера
window.addEventListener('voip-ping-update', (e) => {
  console.log('Ping update:', e.detail);
});
```

### Curl тестирование
```bash
# WebSocket test с wscat
wscat -c ws://localhost:8787/ws
# Отправить: {"type":"ping","timestamp":1703123456789,"sequence":1}
```

## 🔗 Интеграция с LiveKit

Для получения реальных WebRTC статистик:

```typescript
// Интеграция с LiveKit Room
const room = new Room();
room.on('connectionQualityChanged', (quality, participant) => {
  // Обновить статистику качества соединения
});

// Получение WebRTC статистик
const stats = await room.localParticipant.getStats();
```

## 📊 Производительность

- **Ping интервал**: 2 секунды (настраивается)
- **Память**: ~1MB для истории 30 ping
- **CPU**: Минимальная нагрузка
- **Сеть**: ~50 bytes каждые 2 секунды

## 🛠️ Расширения

### Дополнительные метрики
- Bandwidth utilization  
- Audio/Video bitrate
- Frame rate (для видео)
- CPU usage клиента

### Уведомления
- Alerts при высоком ping  
- Push notifications о проблемах связи
- Email отчеты для админов

### Analytics  
- История ping в базе данных
- Графики в админ панели
- Экспорт статистик в CSV