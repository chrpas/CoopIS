#Requires -Version 5.1
<#
.SYNOPSIS
    CoopIS Developer Start Script
.DESCRIPTION
    Starts the full CoopIS development environment in a single command:
      1. Launches the .NET API in a new terminal window
      2. Launches the Vite frontend dev server in a new terminal window
      3. Opens the browser at http://localhost:5173

    URLs:
      Frontend  : http://localhost:5173
      API       : http://localhost:5208
      Swagger   : http://localhost:5208/swagger
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step([string]$msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "  [OK]   $msg" -ForegroundColor Green }
function Write-Warn([string]$msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }

function Test-PortOpen([string]$computer, [int]$port) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $iar = $tcp.BeginConnect($computer, $port, $null, $null)
        $wait = $iar.AsyncWaitHandle.WaitOne(1000, $false)
        if ($wait) {
            $tcp.EndConnect($iar)
            $tcp.Close()
            return $true
        }
        $tcp.Close()
        return $false
    } catch {
        return $false
    }
}

$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) {
    $ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host "  CoopIS -- Developer Environment Start"       -ForegroundColor Magenta
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host "  Project root : $ProjectRoot"                -ForegroundColor DarkGray
Write-Host "  Frontend     : http://localhost:5173"       -ForegroundColor DarkGray
Write-Host "  API          : http://localhost:5208"       -ForegroundColor DarkGray
Write-Host "  Swagger      : http://localhost:5208/swagger" -ForegroundColor DarkGray
Write-Host ""

# Step 0: Ensure PostgreSQL Database is Running
Write-Step "Step 0/3 -- Checking PostgreSQL Database"
$pgPortOpen = Test-PortOpen "127.0.0.1" 5432
if (-not $pgPortOpen) {
    Write-Warn "PostgreSQL is not listening on port 5432. Attempting to start service..."
    $pgServices = @("postgresql-x64-18", "postgresql-x64-17", "postgresql-x64-16", "postgresql-x64-15", "postgresql")
    $started = $false
    foreach ($svc in $pgServices) {
        try {
            $s = Get-Service -Name $svc -ErrorAction SilentlyContinue
            if ($s) {
                Write-Host "  Found service: $svc. Starting..." -ForegroundColor Gray
                Start-Process -FilePath "net.exe" -ArgumentList "start `"$svc`"" -Verb RunAs -Wait -WindowStyle Hidden -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 3
                if (Test-PortOpen "127.0.0.1" 5432) {
                    Write-Ok "PostgreSQL service '$svc' started successfully."
                    $started = $true
                    break
                }
            }
        } catch { }
    }

    if (-not $started -and (Test-Path "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe")) {
        # Fallback using pg_ctl if registered service didn't start or requires manual startup
        try {
            $dataDir = "C:\Program Files\PostgreSQL\18\data"
            if (Test-Path $dataDir) {
                Write-Host "  Attempting to start via pg_ctl..." -ForegroundColor Gray
                Start-Process -FilePath "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -ArgumentList "start -D `"$dataDir`"" -WindowStyle Hidden -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 3
                if (Test-PortOpen "127.0.0.1" 5432) {
                    Write-Ok "PostgreSQL started via pg_ctl."
                    $started = $true
                }
            }
        } catch { }
    }

    if (-not (Test-PortOpen "127.0.0.1" 5432)) {
        Write-Host ""
        Write-Host "  [!] WARNING: PostgreSQL database is NOT responding on port 5432." -ForegroundColor Red
        Write-Host "      The .NET API will fail to start without a running database." -ForegroundColor Yellow
        Write-Host "      Please start PostgreSQL with:" -ForegroundColor White
        Write-Host "        net start postgresql-x64-18" -ForegroundColor Cyan
        Write-Host ""
    }
} else {
    Write-Ok "PostgreSQL is online and listening on port 5432."
}

# 1. Start .NET API in new terminal
Write-Step "Step 1/3 -- Starting .NET API"
$apiDir = Join-Path $ProjectRoot "src\Api"
$apiCmd = "Set-Location '$apiDir'; Write-Host '--- CoopIS API (http://localhost:5208) ---' -ForegroundColor Cyan; dotnet run --launch-profile http"

Write-Host "  Opening API terminal window..." -ForegroundColor White
Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-Command", $apiCmd
)
Write-Ok "API terminal launched (http://localhost:5208)"

Start-Sleep -Seconds 2

# 2. Start Frontend Dev Server
Write-Step "Step 2/3 -- Starting Frontend Dev Server"
$webDir = Join-Path $ProjectRoot "client\web"
$frontendCmd = "Set-Location '$webDir'; Write-Host '--- CoopIS Frontend (http://localhost:5173) ---' -ForegroundColor Magenta; yarn dev"

Write-Host "  Opening Frontend terminal window..." -ForegroundColor White
Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-Command", $frontendCmd
)
Write-Ok "Frontend terminal launched (http://localhost:5173)"

Write-Host ""
Write-Host "  Opening browser in 4 seconds..." -ForegroundColor Cyan
Start-Sleep -Seconds 4
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  CoopIS dev environment is running!"          -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  Frontend  -->  http://localhost:5173"
Write-Host "  API       -->  http://localhost:5208"
Write-Host "  Swagger   -->  http://localhost:5208/swagger"
Write-Host "=============================================" -ForegroundColor Green
