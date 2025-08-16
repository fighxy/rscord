@echo off
echo Starting RSCORD project with Docker Compose...
echo.

echo Step 1: Starting infrastructure services (MongoDB, Redis, RabbitMQ, MinIO, LiveKit)...
docker-compose up -d

echo Waiting for infrastructure services to start...
timeout /t 15 /nobreak >nul

echo Step 2: Checking service health...
echo - MongoDB: http://localhost:27017
echo - Redis: http://localhost:6379
echo - RabbitMQ: http://localhost:15672 (guest/guest)
echo - MinIO: http://localhost:9001 (minioadmin/minioadmin)
echo - LiveKit: ws://localhost:7880

echo.
echo Step 3: Starting API server...
cd servers
start "RSCORD API" cmd /k "cargo run -p rscord-api"
cd ..

echo Waiting for API server to start...
timeout /t 10 /nobreak >nul

echo Step 4: Starting Events server...
cd servers
start "RSCORD Events" cmd /k "cargo run -p rscord-events"
cd ..

echo Waiting for Events server to start...
timeout /t 5 /nobreak >nul

echo Step 5: Starting Files server...
cd servers
start "RSCORD Files" cmd /k "cargo run -p rscord-files"
cd ..

echo Waiting for Files server to start...
timeout /t 5 /nobreak >nul

echo Step 6: Starting Signaling server...
cd servers
start "RSCORD Signaling" cmd /k "cargo run -p rscord-signaling"
cd ..

echo Waiting for Signaling server to start...
timeout /t 5 /nobreak >nul

echo Step 7: Starting desktop app...
cd apps\desktop
start "RSCORD Desktop" cmd /k "npm run dev"
cd ..\..

echo.
echo All services are starting...
echo - Infrastructure: Docker Compose (MongoDB, Redis, RabbitMQ, MinIO, LiveKit)
echo - API Server: http://127.0.0.1:14702
echo - Events Server: http://127.0.0.1:14703
echo - Files Server: http://127.0.0.1:14704
echo - Signaling Server: http://127.0.0.1:8787
echo - Desktop App: http://localhost:5173
echo.
echo Press any key to open the desktop app in browser...
pause >nul
start http://localhost:5173

echo.
echo RSCORD project is running!
echo Close this window when you're done.
echo.
echo To stop all services, run: docker-compose down
pause
