@echo off
echo Starting LiveKit server with Docker Compose...
echo.

echo Checking if Docker is running...
docker --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Error: Docker is not installed or not running.
    echo Please install Docker Desktop and start it.
    pause
    exit /b 1
)

echo Starting LiveKit server and dependencies...
docker-compose up -d livekit redis

echo.
echo LiveKit server is starting...
echo - LiveKit WebRTC: ws://localhost:7880
echo - LiveKit HTTP API: http://localhost:7880
echo - Redis: localhost:6379
echo.
echo API Key: devkey
echo API Secret: devsecret
echo.
echo Press any key to view logs...
pause >nul

echo Showing LiveKit logs (Ctrl+C to exit):
docker-compose logs -f livekit
