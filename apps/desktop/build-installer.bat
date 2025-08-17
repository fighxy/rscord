@echo off
echo Building RSCord Desktop Application...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if Rust is installed
rustc --version >nul 2>&1
if errorlevel 1 (
    echo Error: Rust is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if Tauri CLI is installed
tauri --version >nul 2>&1
if errorlevel 1 (
    echo Installing Tauri CLI...
    npm install -g @tauri-apps/cli
)

echo.
echo Installing dependencies...
npm install

echo.
echo Building frontend...
npm run build

echo.
echo Building Tauri application...
tauri build

echo.
echo Build completed successfully!
echo.
echo Installers can be found in:
echo - src-tauri/target/release/bundle/msi/
echo - src-tauri/target/release/bundle/nsis/
echo.
pause
