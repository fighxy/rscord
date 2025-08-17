@echo off
echo Quick Build Test for RSCord Desktop
echo ==================================

REM Check if we're in the right directory
if not exist "package.json" (
    echo Error: Please run this script from the desktop app directory
    pause
    exit /b 1
)

echo.
echo 🚀 Starting quick build test...
echo.

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Build frontend
echo Building frontend...
npm run build
if errorlevel 1 (
    echo ❌ Frontend build failed
    pause
    exit /b 1
)

REM Quick Tauri build (development mode)
echo Building Tauri app (dev mode)...
tauri build
if errorlevel 1 (
    echo ❌ Tauri build failed
    pause
    exit /b 1
)

echo.
echo ✅ Quick build test completed successfully!
echo.
echo 📁 Check the following directories for output:
echo    - src-tauri/target/debug/bundle/ (development)
echo    - src-tauri/target/release/bundle/ (release)
echo.
pause
