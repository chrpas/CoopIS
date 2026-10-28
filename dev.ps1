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

# 1. Start .NET API in new terminal
Write-Step "Step 1/2 -- Starting .NET API"
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
Write-Step "Step 2/2 -- Starting Frontend Dev Server"
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
