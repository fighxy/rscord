@echo off
setlocal EnableDelayedExpansion

echo Starting RSCORD Microservices...

:: Function to start a service
:start_service
set service_name=%1
set port=%2
set path=%3

echo Starting %service_name% on port %port%...
cd /d "%path%"
start /B cargo run --release
cd /d "%~dp0\.."
timeout /t 2 /nobreak >nul
goto :eof

:: Check if we want to stop services
if "%1"=="stop" (
    echo Stopping all RSCORD services...
    taskkill /F /IM "cargo.exe" 2>nul
    taskkill /F /IM "rscord-gateway.exe" 2>nul
    taskkill /F /IM "rscord-auth-service.exe" 2>nul
    taskkill /F /IM "rscord-chat-service.exe" 2>nul
    taskkill /F /IM "rscord-voice-service.exe" 2>nul
    taskkill /F /IM "rscord-presence-service.exe" 2>nul
    exit /b 0
)

:: Start infrastructure services (Docker Compose)
echo Starting infrastructure services...
docker-compose up -d

:: Wait for infrastructure to start
timeout /t 5 /nobreak >nul

:: Start microservices
echo Starting microservices...

:: Start services in order
call :start_service "gateway" "14700" "servers\gateway"
call :start_service "auth-service" "14701" "servers\auth-service"
call :start_service "chat-service" "14703" "servers\chat-service"
call :start_service "voice-service" "14705" "servers\voice-service"
call :start_service "presence-service" "14706" "servers\presence-service"

echo.
echo All services started successfully!
echo.
echo Service endpoints:
echo   API Gateway:      http://localhost:14700
echo   Auth Service:     http://localhost:14701
echo   Chat Service:     http://localhost:14703
echo   Voice Service:    http://localhost:14705
echo   Presence Service: http://localhost:14706
echo.
echo Infrastructure:
echo   MongoDB:          mongodb://localhost:27017
echo   RabbitMQ:         http://localhost:15672 (admin/admin)
echo   Redis:            redis://localhost:6379
echo.
echo Press Ctrl+C to stop all services

:: Keep the window open
pause
