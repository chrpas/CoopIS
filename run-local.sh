#!/usr/bin/env bash
set -e

echo "=============================================================================="
echo "                CoopIS - Cooperative Management System"
echo "                 Single-Command Local Docker Launcher"
echo "=============================================================================="
echo ""

# 1. Check if Docker is running
echo "[1/4] Checking Docker daemon status..."
if ! docker info >/dev/null 2>&1; then
    echo "[ERROR] Docker daemon is not running or Docker is not installed."
    echo "Please start the Docker daemon (e.g. 'sudo systemctl start docker' or Docker Desktop) and re-run."
    exit 1
fi
echo "[OK] Docker daemon is running."
echo ""

# 2. Ensure .env file exists
echo "[2/4] Verifying environment configuration..."
if [ ! -f ".env" ]; then
    echo "[.env] File not found. Copying defaults from .env.example..."
    cp .env.example .env
    echo "[OK] Created .env file."
else
    echo "[OK] .env configuration found."
fi
echo ""

# 3. Build and launch Docker Compose stack
echo "[3/4] Building and launching CoopIS containers (db, api, web)..."
docker compose up --build -d

echo ""
# 4. Completion summary
echo "[4/4] CoopIS services successfully started!"
echo "=============================================================================="
echo "   Web Application:     http://localhost  (or https://localhost)"
echo "   Backend API Swagger: http://localhost:5208/swagger"
echo "------------------------------------------------------------------------------"
echo "   Default Credentials:"
echo "     - Administrator:   Username: admin    | Password: Admin123!"
echo "     - Standard User:   Username: loanuser | Password: User123!"
echo "=============================================================================="
echo ""

# Optional browser opening on macOS or Linux desktop
if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost" >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then
    open "http://localhost" >/dev/null 2>&1 || true
fi
