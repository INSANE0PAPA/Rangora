@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ===================================================================
echo  RANGORA - Starting Local Development Server
echo ===================================================================

rem 1. Check for Python executable
set "PYTHON_EXE="
where python >nul 2>&1
if !errorlevel! equ 0 (
  set "PYTHON_EXE=python"
) else (
  where py >nul 2>&1
  if !errorlevel! equ 0 (
    set "PYTHON_EXE=py -3"
  )
)

if "%PYTHON_EXE%"=="" (
  echo [Rangora ERROR] Python was not found on your system PATH.
  echo Please install Python 3.10+ from https://www.python.org/downloads/
  echo Make sure to check "Add Python to PATH" during installation.
  echo.
  pause
  exit /b 1
)

rem 2. Ensure .env file exists
if not exist ".env" (
  if exist ".env.example" (
    copy .env.example .env >nul
    echo [Rangora] Created .env from .env.example with default offline SQLite mode.
  )
)

rem 3. Ensure virtual environment exists
if not exist ".venv\Scripts\python.exe" (
  echo [Rangora] Creating Python virtual environment in .venv...
  %PYTHON_EXE% -m venv .venv
  if !errorlevel! neq 0 (
    echo [Rangora ERROR] Failed to create virtual environment.
    pause
    exit /b 1
  )
)

rem 4. Verify dependencies - fast check so subsequent launches are instant
".venv\Scripts\python.exe" -c "import flask, dotenv" >nul 2>&1
if !errorlevel! neq 0 (
  echo [Rangora] Installing dependencies from requirements.txt...
  ".venv\Scripts\pip.exe" install -r requirements.txt
  if !errorlevel! neq 0 (
    echo [Rangora ERROR] Dependency installation failed.
    pause
    exit /b 1
  )
) else (
  echo [Rangora] Virtual environment and dependencies verified.
)

rem 5. Open browser automatically after 1 second
echo [Rangora] Launching http://127.0.0.1:5000 in your web browser...
start "" cmd /c "ping 127.0.0.1 -n 2 >nul & start http://127.0.0.1:5000"

echo ===================================================================
echo  RANGORA - Live on http://127.0.0.1:5000
echo  Press CTRL+C in this console window to stop the server.
echo ===================================================================

rem 6. Start Flask backend server
".venv\Scripts\python.exe" backend.py

if !errorlevel! neq 0 (
  echo.
  echo [Rangora] Server stopped with error code !errorlevel!.
  pause
)
