@echo off
setlocal enabledelayedexpansion

echo RSCord Desktop - Release Creator
echo ================================

REM Get version from package.json
for /f "tokens=*" %%i in ('node -p "require('./package.json').version"') do set VERSION=%%i
echo Creating release for version: %VERSION%

REM Create release directory
set RELEASE_DIR=releases\v%VERSION%
if exist "%RELEASE_DIR%" (
    echo Release directory already exists. Removing...
    rmdir /s /q "%RELEASE_DIR%"
)
mkdir "%RELEASE_DIR%"

echo.
echo 🏗️ Building release version...
echo.

REM Clean previous builds
if exist "src-tauri\target" (
    echo Cleaning previous builds...
    rmdir /s /q "src-tauri\target"
)

REM Install dependencies
echo Installing dependencies...
npm ci
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

REM Build frontend
echo Building frontend...
npm run build
if errorlevel 1 (
    echo ❌ Frontend build failed
    pause
    exit /b 1
)

REM Build Tauri in release mode
echo Building Tauri application (release mode)...
tauri build --release
if errorlevel 1 (
    echo ❌ Tauri build failed
    pause
    exit /b 1
)

echo.
echo 📦 Copying installers to release directory...
echo.

REM Copy installers to release directory
set BUNDLE_DIR=src-tauri\target\release\bundle
if exist "%BUNDLE_DIR%" (
    xcopy "%BUNDLE_DIR%" "%RELEASE_DIR%" /e /i /y
    echo ✅ Installers copied successfully
) else (
    echo ❌ Bundle directory not found
    pause
    exit /b 1
)

REM Create release notes
echo.
echo 📝 Creating release notes...
echo.

set RELEASE_NOTES=%RELEASE_DIR%\RELEASE_NOTES.md
echo # RSCord Desktop v%VERSION% > "%RELEASE_NOTES%"
echo. >> "%RELEASE_NOTES%"
echo ## What's New >> "%RELEASE_NOTES%"
echo - Bug fixes and improvements >> "%RELEASE_NOTES%"
echo - Enhanced performance >> "%RELEASE_NOTES%"
echo - Better user experience >> "%RELEASE_NOTES%"
echo. >> "%RELEASE_NOTES%"
echo ## Installation >> "%RELEASE_NOTES%"
echo. >> "%RELEASE_NOTES%"
echo ### Windows >> "%RELEASE_NOTES%"
echo - **MSI Installer**: Use the .msi file for corporate deployment >> "%RELEASE_NOTES%"
echo - **NSIS Installer**: Use the .exe file for standard installation >> "%RELEASE_NOTES%"
echo. >> "%RELEASE_NOTES%"
echo ### Linux >> "%RELEASE_NOTES%"
echo - **AppImage**: Portable format, no installation required >> "%RELEASE_NOTES%"
echo - **DEB Package**: For Debian/Ubuntu systems >> "%RELEASE_NOTES%"
echo. >> "%RELEASE_NOTES%"
echo ### macOS >> "%RELEASE_NOTES%"
echo - **DMG**: Standard macOS installer >> "%RELEASE_NOTES%"
echo. >> "%RELEASE_NOTES%"
echo ## System Requirements >> "%RELEASE_NOTES%"
echo - Windows 10+ / Linux / macOS 10.15+ >> "%RELEASE_NOTES%"
echo - 4GB RAM minimum, 8GB recommended >> "%RELEASE_NOTES%"
echo - 500MB free disk space >> "%RELEASE_NOTES%"
echo. >> "%RELEASE_NOTES%"
echo ## Changelog >> "%RELEASE_NOTES%"
echo - Initial release >> "%RELEASE_NOTES%"

REM Create checksums
echo.
echo 🔐 Creating checksums...
echo.

cd "%RELEASE_DIR%"
for %%f in (*.msi *.exe *.deb *.AppImage *.dmg) do (
    echo Creating checksum for %%f...
    certutil -hashfile "%%f" SHA256 > "%%f.sha256"
)

REM Create zip archive
echo.
echo 📦 Creating release archive...
echo.

cd ..
powershell -Command "Compress-Archive -Path 'v%VERSION%' -DestinationPath 'RSCord-Desktop-v%VERSION%.zip' -Force"

echo.
echo 🎉 Release created successfully!
echo.
echo 📁 Release location: %RELEASE_DIR%
echo 📦 Archive: RSCord-Desktop-v%VERSION%.zip
echo.
echo 📋 Contents:
dir "%RELEASE_DIR%" /b

echo.
pause
