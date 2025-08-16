@echo off
echo Stopping RSCORD project...
echo.

echo Step 1: Stopping all Rust servers...
taskkill /f /im cargo.exe 2>nul
taskkill /f /im rscord-api.exe 2>nul
taskkill /f /im rscord-events.exe 2>nul
taskkill /f /im rscord-files.exe 2>nul
taskkill /f /im rscord-signaling.exe 2>nul

echo Step 2: Stopping desktop app...
taskkill /f /im node.exe 2>nul

echo Step 3: Stopping Docker services...
docker-compose down

echo.
echo All RSCORD services have been stopped.
echo.
echo To start again, run: scripts\start_project.cmd
pause
