@echo off
setlocal
title Rangora Campus Festival Platform Launcher

echo ========================================================
echo   R A N G O R A  -- Campus Festival Platform
echo   "Find your kind of celebration."
echo ========================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js was not detected in PATH.
    echo Please install Node.js v20+ or v24+ from https://nodejs.org/
    echo and ensure "Add to PATH" is selected.
    echo.
    pause
    exit /b 1
)

if not exist node_modules (
    echo [*] Installing dependencies with npm...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install encountered an error.
        pause
        exit /b 1
    )
)

if not exist .env (
    if exist .env.example (
        echo [*] Initializing .env from .env.example...
        copy .env.example .env >nul
    )
)

echo [*] Starting Rangora development server on port 8080...
start "" http://localhost:8080

call npm run dev
pause

