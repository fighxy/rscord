# RSCORD Audio Architecture: Hybrid LiveKit + Native Opus

## 🎯 Архитектурное решение: Гибридная система

### Core Principle: "LiveKit First, Opus Extensions"

Используем LiveKit для основной голосовой связи, а нативный Opus стек для специальных функций и расширений.

## 🔧 Компоненты системы

### 1. **LiveKit Core (Primary)**
```yaml
Роль: Основная голосовая связь
Функции:
  - Voice channels (стандартные)
  - Video calls
  - Screen sharing
  - Group conferences
  - Real-time communication

Преимущества:
  - ✅ Готовая production-grade система
  - ✅ Автоматическое управление кодеками
  - ✅ Масштабирование до тысяч пользователей
  - ✅ Встроенные оптимизации (DTX, FEC, simulcast)
  - ✅ Уже интегрирован в проекте
```

### 2. **Native Opus Stack (Extensions)**
```yaml
Роль: Специальные функции и расширения
Функции:
  - Audio effects (voice changer, echo, reverb)
  - Custom audio processing
  - Low-latency gaming voice
  - Audio recording/playback
  - Compression analysis
  - Audio debugging tools

Преимущества:
  - ✅ Полный контроль над аудио pipeline
  - ✅ Кастомная обработка звука
  - ✅ Низкая задержка для игр
  - ✅ Аудио эффекты и фильтры
```

## 🏗️ Интеграционная архитектура

### Audio Manager (Coordinator)
```typescript
interface RSCORDAudioSystem {
  // LiveKit methods
  joinLiveKitChannel(channelId: string): Promise<void>;
  leaveLiveKitChannel(): Promise<void>;
  
  // Native Opus methods
  enableAudioEffects(effects: AudioEffect[]): Promise<void>;
  startLowLatencyMode(): Promise<void>;
  processCustomAudio(data: AudioData): Promise<void>;
  
  // Switching between modes
  setMode(mode: 'livekit' | 'native' | 'hybrid'): Promise<void>;
}
```

### Use Cases Distribution

#### 🎙️ LiveKit Handles:
- **Regular voice channels** (99% случаев)
- **Video calls**
- **Screen sharing**
- **Group conferences** (5+ people)
- **Mobile support**
- **Web browser support**

#### 🔧 Native Opus Handles:
- **Voice effects** (robot voice, pitch change)
- **Gaming mode** (ultra-low latency)
- **Audio analysis** (spectrum, compression stats)
- **Custom processing** (noise reduction, echo cancellation)
- **Audio debugging** (buffer analysis, codec testing)

## 📁 Project Structure

```
apps/desktop/src/lib/audio/
├── livekit/                    # LiveKit integration
│   ├── livekitManager.ts      # Main LiveKit wrapper
│   ├── roomManager.ts         # Room management
│   └── deviceManager.ts       # Audio/video devices
├── opus/                      # Native Opus stack
│   ├── opusProcessor.ts       # Tauri Opus commands
│   ├── audioEffects.ts        # Audio effects
│   ├── lowLatency.ts         # Gaming mode
│   └── audioAnalysis.ts       # Debugging tools
└── audioCoordinator.ts        # Main coordinator
```

## 🔄 Implementation Strategy

### Phase 1: LiveKit Integration (Complete ✅)
- Уже реализовано в проекте
- Voice channels работают через LiveKit
- Production-ready solution

### Phase 2: Native Opus Extensions (New)
- Добавляем Tauri Opus модуль
- Интегрируем как дополнительные функции
- Не мешаем основной LiveKit системе

### Phase 3: Smart Routing
- Coordinator выбирает подходящий backend
- UI переключения между режимами
- Seamless transitions

## 💡 Конкретная реализация

### 1. Обновляем существующий AudioManager
```typescript
export class RSCORDAudioCoordinator {
  private livekitManager: LiveKitManager;
  private opusProcessor: OpusProcessor;
  private currentMode: 'livekit' | 'opus' = 'livekit';

  async joinVoiceChannel(channelId: string, options?: VoiceOptions) {
    if (options?.enableEffects || options?.lowLatency) {
      // Use native Opus for special features
      this.currentMode = 'opus';
      return this.opusProcessor.joinChannel(channelId, options);
    } else {
      // Use LiveKit for standard voice
      this.currentMode = 'livekit';
      return this.livekitManager.joinChannel(channelId);
    }
  }
}
```

### 2. UI Controls
```tsx
<VoiceChannelControls>
  <StandardVoiceButton />           {/* LiveKit */}
  <GamingModeButton />             {/* Native Opus */}
  <EffectsButton />                {/* Native Opus */}
  <AnalysisButton />               {/* Native Opus */}
</VoiceChannelControls>
```

## 🎯 Benefits of This Approach

### ✅ Best of Both Worlds
- **Stability**: LiveKit для основных функций
- **Flexibility**: Native Opus для расширений
- **Scalability**: LiveKit handles массовые каналы
- **Customization**: Opus для уникальных фич

### ✅ Migration Safety
- Текущие LiveKit каналы работают как прежде
- Native Opus добавляется как extension
- Нет breaking changes
- Gradual rollout возможен

### ✅ User Experience
- Стандартные каналы = стабильность
- Специальные функции = инновации
- Choice не навязывается
- Seamless switching

## 🚀 Action Plan

### Immediate (Week 3-4):
1. **Cleanup conflicts** - убираем WebRTC код, который дублирует LiveKit
2. **Refactor as extensions** - превращаем Opus в дополнительные функции
3. **Create coordinator** - unified API для переключения

### Next (Week 5-6):
1. **Audio effects implementation** - voice changer, filters
2. **Gaming mode** - ultra-low latency через Native Opus
3. **Analysis tools** - debugging и статистика

### Future:
1. **AI voice processing** - real-time voice enhancement
2. **Custom protocols** - для специальных use cases
3. **Performance optimization** - hybrid mode для лучшей производительности

---

## 🎵 Conclusion

Этот подход позволяет:
- Сохранить уже работающую LiveKit интеграцию
- Добавить уникальные функции через Native Opus
- Избежать конфликтов технологий
- Создать дифференцирующие фичи для RSCORD

**Next Step**: Refactoring нашего Opus кода как расширения к LiveKit, а не замена.