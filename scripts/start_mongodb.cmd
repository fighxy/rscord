@echo off
echo Starting MongoDB...
echo Make sure MongoDB is installed and added to PATH
echo Or update this script with the correct path to mongod.exe

REM Попробуем запустить MongoDB из PATH
mongod --dbpath "C:\data\db" --port 27017

REM Если MongoDB не найден в PATH, попробуем стандартные пути установки
if errorlevel 1 (
    echo MongoDB not found in PATH, trying default installation paths...
    
    REM MongoDB Community Server
    if exist "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" (
        "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath "C:\data\db" --port 27017
    ) else if exist "C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" (
        "C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" --dbpath "C:\data\db" --port 27017
    ) else if exist "C:\Program Files\MongoDB\Server\5.0\bin\mongod.exe" (
        "C:\Program Files\MongoDB\Server\5.0\bin\mongod.exe" --dbpath "C:\data\db" --port 27017
    ) else (
        echo MongoDB not found. Please install MongoDB or update the path in this script.
        echo Download from: https://www.mongodb.com/try/download/community
        pause
    )
)
