#Requires -Version 5.1
<#
.SYNOPSIS
    CoopIS Setup Script
.DESCRIPTION
    Sets up the CoopIS solution:
      1. Restores and builds .NET Solution
      2. Installs frontend dependencies via Yarn
      3. Verifies compilation
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step([string]$msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "  [OK]   $msg" -ForegroundColor Green }

$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) {
    $ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}

Write-Step "Step 1/3 -- Restoring and Building .NET Solution"
dotnet restore "$ProjectRoot\CoopIS.sln"
dotnet build "$ProjectRoot\CoopIS.sln" --no-restore
Write-Ok ".NET Solution restored and built"

Write-Step "Step 2/3 -- Installing Frontend Dependencies"
Set-Location "$ProjectRoot\client\web"
yarn install
Write-Ok "Frontend dependencies installed"

Write-Step "Step 3/3 -- Building Frontend"
yarn build
Write-Ok "Frontend built successfully"

Set-Location "$ProjectRoot"
Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "  CoopIS Setup Complete! Run .\dev.ps1 to start the servers."   -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
