# 🚀 RSCord Desktop - Полное руководство по сборке

Это руководство поможет вам собрать и создать установщики для RSCord Desktop приложения на всех поддерживаемых платформах.

## 📋 Содержание

1. [Предварительные требования](#предварительные-требования)
2. [Быстрый старт](#быстрый-старт)
3. [Скрипты сборки](#скрипты-сборки)
4. [Поддерживаемые платформы](#поддерживаемые-платформы)
5. [Оптимизации](#оптимизации)
6. [Автоматизация](#автоматизация)
7. [Устранение проблем](#устранение-проблем)

## 🎯 Предварительные требования

### Windows
- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (последняя стабильная версия)
- [Microsoft Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- [WiX Toolset](https://wixtoolset.org/) (опционально, для MSI)

### Linux
- Node.js 18+
- Rust (последняя стабильная версия)
- GTK3 и WebKit2GTK
- AppImage tools

### macOS
- Node.js 18+
- Rust (последняя стабильная версия)
- Xcode Command Line Tools

## 🚀 Быстрый старт

### 1. Проверка системы
```bash
# Windows
cd apps/desktop
check-system.bat

# Linux/macOS
cd apps/desktop
chmod +x check-system.sh
./check-system.sh
```

### 2. Установка зависимостей
```bash
cd apps/desktop
npm install
npm install -g @tauri-apps/cli
```

### 3. Первая сборка
```bash
# Windows
build-installer.bat

# Linux/macOS
./build-installer.sh
```

## 📦 Скрипты сборки

### Windows

#### Простая сборка
```cmd
build-installer.bat
```
**Что делает:**
- Проверяет зависимости
- Устанавливает npm пакеты
- Собирает фронтенд
- Создает Tauri приложение
- Генерирует MSI и NSIS установщики

#### Продвинутая сборка (PowerShell)
```powershell
# Обычная сборка
powershell -ExecutionPolicy Bypass -File build-advanced.ps1

# Сборка с очисткой
powershell -ExecutionPolicy Bypass -File build-advanced.ps1 -Clean

# Release сборка
powershell -ExecutionPolicy Bypass -File build-advanced.ps1 -Release
```

**Возможности:**
- Цветной вывод
- Проверка зависимостей
- Очистка предыдущих сборок
- Оптимизированная сборка

#### Быстрый тест
```cmd
quick-build.bat
```
**Для чего:**
- Тестирование сборки
- Быстрая проверка конфигурации
- Development режим

#### Создание релиза
```cmd
create-release.bat
```
**Функции:**
- Автоматическое определение версии
- Создание структуры релиза
- Генерация checksums
- Создание архива
- Автоматические release notes

### Linux/macOS

```bash
# Сделать исполняемым
chmod +x build-installer.sh

# Запустить сборку
./build-installer.sh
```

## 🖥️ Поддерживаемые платформы

### Windows
- **MSI** - Microsoft Installer
  - Корпоративное развертывание
  - Автоматические обновления
  - Интеграция с Windows
  
- **NSIS** - Nullsoft Scriptable Install System
  - Гибкая настройка
  - Меньший размер
  - Кастомизация

### Linux
- **AppImage** - Портативный формат
  - Без установки
  - Работает на всех дистрибутивах
  - Легкое распространение
  
- **DEB** - Debian/Ubuntu пакет
  - Нативная интеграция
  - Автоматические обновления
  - Управление зависимостями

### macOS
- **DMG** - Disk Image
  - Стандартный macOS формат
  - Drag & Drop установка
  - App Store совместимость

## ⚡ Оптимизации

### Размер приложения

#### Rust оптимизации (Cargo.toml)
```toml
[profile.release]
opt-level = "z"           # Оптимизация для размера
lto = true                # Link Time Optimization
codegen-units = 1         # Один блок кода
panic = "abort"           # Аборт при панике
strip = true              # Удаление символов
overflow-checks = false   # Отключение проверок
```

#### Frontend оптимизации (vite.config.ts)
```typescript
build: {
  target: 'esnext',
  minify: 'terser',
  sourcemap: false,
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom'],
        ui: ['@radix-ui/react-*'],
        utils: ['clsx', 'class-variance-authority'],
        livekit: ['@livekit/components-react']
      }
    }
  }
}
```

### Производительность
- Tree shaking
- Code splitting
- Lazy loading
- Bundle analysis

## 🤖 Автоматизация

### GitHub Actions

Автоматическая сборка на всех платформах:

```yaml
# .github/workflows/build-desktop.yml
name: Build Desktop App
on: [push, pull_request, release]

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: windows-latest
            target: x86_64-pc-windows-msvc
          - os: ubuntu-latest
            target: x86_64-unknown-linux-gnu
          - os: macos-latest
            target: x86_64-apple-darwin
```

**Триггеры:**
- Push в main/develop
- Pull Request
- Release

**Результаты:**
- Артефакты для каждой платформы
- Автоматические релизы
- Проверка качества

### Локальная автоматизация

#### Batch скрипты
- `check-system.bat` - Проверка системы
- `build-installer.bat` - Простая сборка
- `build-advanced.ps1` - Продвинутая сборка
- `quick-build.bat` - Быстрый тест
- `create-release.bat` - Создание релиза

#### Shell скрипты
- `build-installer.sh` - Кроссплатформенная сборка

## 🔧 Конфигурация

### Tauri (tauri.conf.json)
```json
{
  "productName": "RSCord",
  "version": "0.2.1",
  "identifier": "com.rscord.desktop",
  "bundle": {
    "targets": ["msi", "nsis", "appimage", "deb", "dmg"],
    "publisher": "RSCord Team",
    "category": "Social Networking"
  }
}
```

### Cargo (Cargo.toml)
```toml
[package]
name = "desktop"
version = "0.1.0"
description = "RSCord Desktop Application"
authors = ["RSCord Team"]

[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
```

### Vite (vite.config.ts)
```typescript
export default defineConfig({
  build: {
    target: 'esnext',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom']
        }
      }
    }
  }
})
```

## 🚨 Устранение проблем

### Частые ошибки

#### "Rust not found"
```bash
# Установка Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

#### "Tauri CLI not found"
```bash
npm install -g @tauri-apps/cli
```

#### Ошибки компиляции на Windows
```bash
# Установить Build Tools
# Скачать с: https://visualstudio.microsoft.com/visual-cpp-build-tools/

# Установить MSVC toolchain
rustup default stable-msvc
```

#### Ошибки на Linux
```bash
# Ubuntu/Debian
sudo apt install libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev

# Fedora
sudo dnf install gtk3-devel webkit2gtk3-devel libappindicator-gtk3 librsvg2-devel
```

### Отладка

#### Логи сборки
```bash
# Подробные логи Tauri
tauri build --verbose

# Логи npm
npm run build --verbose

# Логи Cargo
cargo build --verbose
```

#### Проверка зависимостей
```bash
# Проверка Node.js
node --version
npm --version

# Проверка Rust
rustc --version
cargo --version

# Проверка Tauri
tauri --version
```

## 📁 Структура проекта

```
apps/desktop/
├── src/                    # React компоненты
├── src-tauri/             # Rust backend
│   ├── src/               # Rust код
│   ├── Cargo.toml         # Rust зависимости
│   └── tauri.conf.json    # Tauri конфигурация
├── build-installer.bat    # Windows сборка
├── build-installer.sh     # Linux/macOS сборка
├── build-advanced.ps1     # PowerShell сборка
├── quick-build.bat        # Быстрый тест
├── create-release.bat     # Создание релиза
├── check-system.bat       # Проверка системы
└── README.md              # Документация
```

## 🎯 Лучшие практики

### Разработка
1. Всегда запускайте `check-system.bat` перед сборкой
2. Используйте `quick-build.bat` для тестирования
3. Используйте `build-advanced.ps1` для production

### Production
1. Используйте `create-release.bat` для создания релизов
2. Проверяйте checksums
3. Тестируйте установщики на чистой системе

### CI/CD
1. Используйте GitHub Actions для автоматизации
2. Тестируйте на всех платформах
3. Автоматизируйте релизы

## 📚 Дополнительные ресурсы

- [Tauri Documentation](https://tauri.app/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Rust Documentation](https://doc.rust-lang.org/)

## 🤝 Поддержка

При возникновении проблем:

1. **Проверьте логи сборки**
2. **Убедитесь в корректности зависимостей**
3. **Запустите `check-system.bat`**
4. **Создайте issue в репозитории**
5. **Обратитесь к документации**

## 🎉 Готово!

Теперь у вас есть полный набор инструментов для сборки и создания установщиков RSCord Desktop приложения. 

**Следующие шаги:**
1. Запустите `check-system.bat` для проверки системы
2. Используйте `build-installer.bat` для первой сборки
3. Настройте GitHub Actions для автоматизации
4. Создавайте релизы с помощью `create-release.bat`

Удачи в разработке! 🚀
