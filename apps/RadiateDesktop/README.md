# RSCord Desktop Application

Desktop приложение RSCord, построенное с использованием Tauri 2.0 и React.

## 🚀 Быстрый старт

### Предварительные требования

- **Node.js** 18+ 
- **Rust** (последняя стабильная версия)
- **Tauri CLI** (`npm install -g @tauri-apps/cli`)

### Установка и запуск

```bash
# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev

# Сборка для production
npm run build
```

## 📦 Скрипты сборки

### Windows

#### Простая сборка
```cmd
build-installer.bat
```

#### Продвинутая сборка (PowerShell)
```powershell
# Обычная сборка
powershell -ExecutionPolicy Bypass -File build-advanced.ps1

# Сборка с очисткой
powershell -ExecutionPolicy Bypass -File build-advanced.ps1 -Clean

# Release сборка
powershell -ExecutionPolicy Bypass -File build-advanced.ps1 -Release
```

#### Быстрый тест сборки
```cmd
quick-build.bat
```

#### Создание релиза
```cmd
create-release.bat
```

### Linux/macOS

```bash
# Сделать скрипт исполняемым
chmod +x build-installer.sh

# Запустить сборку
./build-installer.sh
```

## 🏗️ Процесс сборки

1. **Установка зависимостей** - npm install
2. **Сборка фронтенда** - npm run build
3. **Сборка Tauri** - tauri build --release
4. **Создание установщиков** - автоматически для всех платформ

## 📱 Поддерживаемые платформы

### Windows
- **MSI** - Microsoft Installer (корпоративное использование)
- **NSIS** - Nullsoft Scriptable Install System

### Linux
- **AppImage** - Портативный формат
- **DEB** - Debian/Ubuntu пакет

### macOS
- **DMG** - Disk Image с установщиком

## 🔧 Конфигурация

### Tauri (src-tauri/tauri.conf.json)
- Настройки приложения
- Конфигурация окон
- Параметры сборки

### Vite (vite.config.ts)
- Оптимизация production сборки
- Разделение кода на чанки
- Минификация

### Cargo (src-tauri/Cargo.toml)
- Оптимизация размера Rust кода
- LTO и strip для release сборок

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
└── README.md              # Этот файл
```

## 🎯 Оптимизации

### Размер приложения
- LTO (Link Time Optimization)
- Strip символов в release
- Оптимизация для размера (opt-level = "z")
- Разделение кода на чанки

### Производительность
- Terser минификация
- Tree shaking
- Оптимизация зависимостей
- Source maps отключены в production

## 🚀 GitHub Actions

Автоматическая сборка на всех платформах при push в main/develop ветки.

### Триггеры
- Push в main/develop
- Pull Request
- Release

### Платформы
- Windows (MSI, NSIS)
- Linux (AppImage, DEB)
- macOS (DMG)

## 📋 Troubleshooting

### Ошибка "Rust not found"
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

### Ошибка "Tauri CLI not found"
```bash
npm install -g @tauri-apps/cli
```

### Ошибки компиляции на Windows
- Установить Microsoft Visual Studio Build Tools
- `rustup default stable-msvc`

### Ошибки на Linux
```bash
# Ubuntu/Debian
sudo apt install libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev

# Fedora
sudo dnf install gtk3-devel webkit2gtk3-devel libappindicator-gtk3 librsvg2-devel
```

## 📚 Документация

- [Tauri Documentation](https://tauri.app/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)

## 🤝 Поддержка

При возникновении проблем:
1. Проверьте логи сборки
2. Убедитесь в корректности зависимостей
3. Создайте issue в репозитории
4. Обратитесь к документации

## 📄 Лицензия

См. файл LICENSE в корне проекта.
