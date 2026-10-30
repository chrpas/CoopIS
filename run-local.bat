@echo off
setlocal enabledelayedexpansion

echo ==============================================================================
echo                 CoopIS - Cooperative Management System
echo                  Single-Command Local Docker Launcher
echo ==============================================================================
echo.

:: 1. Check if Docker is running
echo [1/4] Checking Docker daemon status...
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker daemon is not running or Docker Desktop is not installed.
    echo Please start Docker Desktop and run this script again.
    pause
    exit /b 1
)
echo [OK] Docker daemon is running.
echo.

:: 2. Ensure .env file exists
echo [2/4] Verifying environment configuration...
if not exist ".env" (
    echo [.env] File not found. Copying from .env.example with sensible local defaults...
    copy ".env.example" ".env" >nul
    echo [OK] Created .env configuration.
) else (
    echo [OK] .env configuration found.
)
echo.

:: 3. Build and launch Docker Compose stack
echo [3/4] Building and starting CoopIS containers (db, api, web)...
echo This may take a minute on initial setup while base images and dependencies download.
docker compose up --build -d

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker Compose failed to build or start containers.
    pause
    exit /b %ERRORLEVEL%
)
echo.

:: 4. Completion summary
echo [4/4] CoopIS services successfully started!
echo ==============================================================================
echo    Web Application:     http://localhost  (or https://localhost)
echo    Backend API Swagger: http://localhost:5208/swagger
echo ------------------------------------------------------------------------------
echo    Default Credentials:
echo      - Administrator:   Username: admin    ^| Password: Admin123!
echo      - Standard User:   Username: loanuser ^| Password: User123!
echo ==============================================================================
echo.
echo Launching default web browser...
start http://localhost

pause
