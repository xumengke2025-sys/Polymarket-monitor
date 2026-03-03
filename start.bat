@echo off
setlocal
title Polymarket Monitor Launcher

echo ========================================================
echo Polymarket Global Monitor - Startup Script
echo ========================================================

REM 1. Ensure we are running from the script's directory
cd /d "%~dp0"

echo.
echo [1/4] Checking Node.js environment...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in your PATH.
    echo Please download and install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)
node -v

echo.
echo [2/4] Entering project directory...
REM Running from project root
cd /d "%~dp0"


echo.
echo [3/4] Installing dependencies...
if not exist "node_modules" (
    echo Installing npm packages - this may take a few minutes...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies.
        echo Please check your internet connection or npm configuration.
        echo.
        pause
        exit /b 1
    )
) else (
    echo node_modules detected. Skipping installation.
)

echo.
echo [4/4] Starting server...
echo Server will be available at http://localhost:3000
echo Press Ctrl+C to stop the server.
echo.

REM Open browser after a short delay to ensure server is ready
echo Opening browser in 5 seconds...
start /b cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000"

REM Start the server
node server.js

REM If server crashes, keep window open
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server process exited with code %errorlevel%.
    pause
)

pause
