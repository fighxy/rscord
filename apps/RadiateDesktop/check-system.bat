@echo off
echo RSCord Desktop - System Check
echo =============================
echo.

set MISSING_DEPS=0

echo Checking system requirements...
echo.

REM Check Node.js
echo Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found
    echo    Please install Node.js from https://nodejs.org/
    set /a MISSING_DEPS+=1
) else (
    for /f "tokens=*" %%i in ('node --version') do echo ✅ Node.js %%i
)

REM Check npm
echo.
echo Checking npm...
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm not found
    set /a MISSING_DEPS+=1
) else (
    for /f "tokens=*" %%i in ('npm --version') do echo ✅ npm %%i
)

REM Check Rust
echo.
echo Checking Rust...
rustc --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Rust not found
    echo    Please install Rust from https://rustup.rs/
    set /a MISSING_DEPS+=1
) else (
    for /f "tokens=*" %%i in ('rustc --version') do echo ✅ Rust %%i
)

REM Check Cargo
echo.
echo Checking Cargo...
cargo --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Cargo not found
    set /a MISSING_DEPS+=1
) else (
    for /f "tokens=*" %%i in ('cargo --version') do echo ✅ Cargo %%i
)

REM Check Tauri CLI
echo.
echo Checking Tauri CLI...
tauri --version >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Tauri CLI not found
    echo    Installing Tauri CLI...
    npm install -g @tauri-apps/cli
    if errorlevel 1 (
        echo ❌ Failed to install Tauri CLI
        set /a MISSING_DEPS+=1
    ) else (
        echo ✅ Tauri CLI installed successfully
    )
) else (
    for /f "tokens=*" %%i in ('tauri --version') do echo ✅ Tauri CLI %%i
)

REM Check Windows specific tools
echo.
echo Checking Windows build tools...
where cl >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Microsoft Visual Studio Build Tools not found
    echo    This may cause Rust compilation issues
    echo    Install from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
) else (
    echo ✅ Microsoft Visual Studio Build Tools found
)

REM Check available disk space
echo.
echo Checking disk space...
for /f "tokens=3" %%a in ('dir /-c 2^>nul ^| find "bytes free"') do set FREE_SPACE=%%a
set FREE_SPACE=%FREE_SPACE:,=%
if %FREE_SPACE% LSS 1000000000 (
    echo ⚠️  Low disk space: %FREE_SPACE% bytes free
    echo    Recommended: at least 1GB free space
) else (
    echo ✅ Sufficient disk space: %FREE_SPACE% bytes free
)

REM Check if we're in the right directory
echo.
echo Checking project structure...
if not exist "package.json" (
    echo ❌ package.json not found
    echo    Please run this script from the desktop app directory
    set /a MISSING_DEPS+=1
) else (
    echo ✅ package.json found
)

if not exist "src-tauri\Cargo.toml" (
    echo ❌ Cargo.toml not found
    echo    Please run this script from the desktop app directory
    set /a MISSING_DEPS+=1
) else (
    echo ✅ Cargo.toml found
)

REM Summary
echo.
echo =============================
echo System Check Summary
echo =============================

if %MISSING_DEPS% EQU 0 (
    echo.
    echo 🎉 All requirements met! You can proceed with building.
    echo.
    echo Next steps:
    echo 1. Run: build-installer.bat
    echo 2. Or run: quick-build.bat for testing
    echo.
) else (
    echo.
    echo ❌ %MISSING_DEPS% requirement(s) missing
    echo.
    echo Please install the missing dependencies and run this check again.
    echo.
)

echo Press any key to continue...
pause >nul
