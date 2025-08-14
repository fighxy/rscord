@echo off
echo Starting RSCORD with LiveKit development environment...
echo.

echo Step 1: Starting MongoDB and Redis...
start "MongoDB" cmd /k "docker-compose up mongo redis"

echo Waiting for databases to start...
timeout /t 5 /nobreak >nul

echo Step 2: Starting LiveKit server...
start "LiveKit" cmd /k "docker-compose up livekit"

echo Waiting for LiveKit to start...
timeout /t 10 /nobreak >nul

echo Step 3: Starting API server (without LiveKit compilation)...
cd servers
start "RSCORD API" cmd /k "echo Note: LiveKit compilation failed, using mock tokens && cargo run -p rscord-api"
cd ..

echo Waiting for API server to start...
timeout /t 10 /nobreak >nul

echo Step 4: Starting desktop app...
cd apps\desktop
start "RSCORD Desktop" cmd /k "npm run dev"
cd ..\..

echo.
echo All services are starting...
echo - MongoDB: http://localhost:27017
echo - Redis: http://localhost:6379
echo - LiveKit WebRTC: ws://localhost:7880
echo - LiveKit HTTP: http://localhost:7880
echo - API Server: http://127.0.0.1:14702
echo - Desktop App: http://localhost:5173
echo.
echo LiveKit Credentials:
echo - API Key: devkey
echo - API Secret: devsecret
echo.
echo Press any key to open the desktop app in browser...
pause >nul
start http://localhost:5173

echo.
echo RSCORD with LiveKit is running!
echo Close this window when you're done.
pause
