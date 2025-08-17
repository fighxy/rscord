@echo off
echo ========================================================
echo RSCORD Desktop - Complete Build ^& Integration Script
echo ========================================================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo [ERROR] Not in the desktop app directory!
    exit /b 1
)

REM Step 1: Install Node dependencies
echo [1/5] Installing Node.js dependencies...
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    exit /b 1
)
echo [OK] Dependencies installed
echo.

REM Step 2: Build the frontend
echo [2/5] Building frontend with Vite...
call npm run build
if errorlevel 1 (
    echo [ERROR] Failed to build frontend
    exit /b 1
)
echo [OK] Frontend built
echo.

REM Step 3: Build Tauri application
echo [3/5] Building Tauri application...
call npm run tauri build
if errorlevel 1 (
    echo [ERROR] Failed to build Tauri app
    exit /b 1
)
echo [OK] Tauri app built
echo.

REM Step 4: Check server connection
echo [4/5] Checking connection to backend server (5.35.83.143:14700)...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://5.35.83.143:14700/health' -UseBasicParsing -TimeoutSec 5; Write-Host '[OK] Backend server is reachable!' -ForegroundColor Green } catch { Write-Host '[WARNING] Backend server is not reachable. The app will work in offline mode.' -ForegroundColor Yellow }"
echo.

REM Step 5: Summary
echo [5/5] Build complete!
echo.
echo ========================================================
echo Built files location:
echo    - MSI Installer: src-tauri\target\release\bundle\msi\
echo    - NSIS Installer: src-tauri\target\release\bundle\nsis\
echo.
echo To run in development mode: npm run tauri dev
echo To install: Run the installer from the bundle directory
echo ========================================================
pause
