@echo off
echo Starting RSCORD Desktop Application...

:: Check if node_modules exists
if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
)

:: Start the development server
echo Starting development server...
call npm run dev