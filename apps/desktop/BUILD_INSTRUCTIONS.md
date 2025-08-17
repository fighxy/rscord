# RSCord Desktop - Build Instructions

Это руководство поможет вам собрать и создать установщики для RSCord Desktop приложения.

## Предварительные требования

### Windows
- [Node.js](https://nodejs.org/) (версия 18 или выше)
- [Rust](https://rustup.rs/) (последняя стабильная версия)
- [Microsoft Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (для компиляции Rust)
- [WiX Toolset](https://wixtoolset.org/) (опционально, для MSI установщиков)

### Linux
- Node.js (версия 18 или выше)
- Rust (последняя стабильная версия)
- GTK3 и WebKit2GTK
- AppImage tools (для AppImage)

### macOS
- Node.js (версия 18 или выше)
- Rust (последняя стабильная версия)
- Xcode Command Line Tools

## Быстрая сборка

### Windows
```cmd
# Простая сборка
build-installer.bat

# Продвинутая сборка (PowerShell)
powershell -ExecutionPolicy Bypass -File build-advanced.ps1

# Сборка с очисткой
powershell -ExecutionPolicy Bypass -File build-advanced.ps1 -Clean

# Сборка в release режиме
powershell -ExecutionPolicy Bypass -File build-advanced.ps1 -Release
```

### Linux/macOS
```bash
# Сделать скрипт исполняемым
chmod +x build-installer.sh

# Запустить сборку
./build-installer.sh
```

## Ручная сборка

### 1. Установка зависимостей
```bash
npm install
```

### 2. Сборка фронтенда
```bash
npm run build
```

### 3. Сборка Tauri приложения
```bash
# Development сборка
tauri build

# Release сборка
tauri build --release
```

## Типы установщиков

### Windows
- **MSI** - Microsoft Installer (рекомендуется для корпоративного использования)
- **NSIS** - Nullsoft Scriptable Install System (более гибкий)

### Linux
- **AppImage** - Портативный формат
- **DEB** - Debian/Ubuntu пакет
- **RPM** - Red Hat/Fedora пакет

### macOS
- **DMG** - Disk Image с установщиком

## Расположение файлов

После успешной сборки установщики находятся в:
```
src-tauri/target/release/bundle/
├── msi/          # Windows MSI
├── nsis/         # Windows NSIS
├── appimage/     # Linux AppImage
├── deb/          # Linux DEB
└── dmg/          # macOS DMG
```

## Настройка сборки

Основные настройки находятся в `src-tauri/tauri.conf.json`:

- **productName** - название приложения
- **version** - версия
- **identifier** - уникальный идентификатор
- **bundle.targets** - типы создаваемых установщиков
- **bundle.publisher** - издатель
- **bundle.category** - категория в магазине приложений

## Устранение проблем

### Ошибка "Rust not found"
```bash
# Установить Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

### Ошибка "Tauri CLI not found"
```bash
npm install -g @tauri-apps/cli
```

### Ошибки компиляции на Windows
- Убедитесь, что установлены Microsoft Visual Studio Build Tools
- Запустите `rustup default stable-msvc`

### Ошибки на Linux
```bash
# Ubuntu/Debian
sudo apt install libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev

# Fedora
sudo dnf install gtk3-devel webkit2gtk3-devel libappindicator-gtk3 librsvg2-devel
```

## Оптимизация размера

### Уменьшение размера Rust зависимостей
В `src-tauri/Cargo.toml`:
```toml
[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
panic = "abort"
strip = true
```

### Оптимизация фронтенда
В `vite.config.ts`:
```typescript
export default defineConfig({
  build: {
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-*']
        }
      }
    }
  }
})
```

## Автоматизация сборки

### GitHub Actions
Создайте `.github/workflows/build.yml`:
```yaml
name: Build Desktop App
on: [push, pull_request]
jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, ubuntu-latest, macos-latest]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - run: npm ci
      - run: npm run build
      - run: tauri build
      - uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.os }}-installer
          path: src-tauri/target/release/bundle/
```

## Подпись приложений

### Windows
```bash
# Подпись MSI
signtool sign /f certificate.pfx /p password installer.msi

# Подпись EXE
signtool sign /f certificate.pfx /p password installer.exe
```

### macOS
```bash
# Подпись DMG
codesign --force --sign "Developer ID Application: Your Name" app.dmg
```

### Linux
```bash
# Подпись AppImage
gpg --detach-sign --armor app.AppImage
```

## Распространение

### Windows Store
- Создайте аккаунт разработчика Microsoft
- Упакуйте приложение в MSIX формат
- Загрузите в Microsoft Store

### macOS App Store
- Создайте аккаунт Apple Developer
- Подпишите приложение сертификатом Apple
- Загрузите в App Store

### Linux
- AppImage: загрузите на GitHub Releases
- DEB/RPM: создайте репозиторий или загрузите на GitHub Releases

## Поддержка

При возникновении проблем:
1. Проверьте логи сборки
2. Убедитесь в корректности всех зависимостей
3. Создайте issue в репозитории проекта
4. Обратитесь к [документации Tauri](https://tauri.app/)
