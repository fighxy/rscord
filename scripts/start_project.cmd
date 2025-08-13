@echo off
echo Starting RSCORD project...
echo.

echo Step 1: Starting MongoDB...
start "MongoDB" cmd /k "scripts\start_mongodb.cmd"

echo Waiting for MongoDB to start...
timeout /t 5 /nobreak >nul

echo Step 2: Starting API server...
cd servers
start "RSCORD API" cmd /k "cargo run -p rscord-api"
cd ..

echo Waiting for API server to start...
timeout /t 10 /nobreak >nul

echo Step 3: Starting desktop app...
cd apps\desktop
start "RSCORD Desktop" cmd /k "npm run dev"
cd ..\..

echo.
echo All services are starting...
echo - MongoDB: http://localhost:27017
echo - API Server: http://127.0.0.1:14702
echo - Desktop App: http://localhost:5173
echo.
echo Press any key to open the desktop app in browser...
pause >nul
start http://localhost:5173

echo.
echo RSCORD project is running!
echo Close this window when you're done.
pause
