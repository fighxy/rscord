@echo off
setlocal

REM Try VsDevCmd first (x86 and non-x86 Program Files)
set VSDEV1="C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat"
set VSDEV2="C:\Program Files\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat"
if exist %VSDEV1% (
  call %VSDEV1% -arch=x64
  goto run
)
if exist %VSDEV2% (
  call %VSDEV2% -arch=x64
  goto run
)

REM Try default BuildTools install paths for vcvars
set VCVARS1="C:\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
set VCVARS2="C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
set VCVARS3="C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if exist %VCVARS1% (
  call %VCVARS1%
  goto run
)
if exist %VCVARS2% (
  call %VCVARS2%
  goto run
)
if exist %VCVARS3% (
  call %VCVARS3%
  goto run
)

echo Visual Studio Build Tools environment not found.
exit /b 1

:run
where link || (
  echo link.exe not found in PATH. Aborting.
  exit /b 1
)

cd /d "%~dp0..\apps\desktop"
npm run tauri dev


