#Requires -Version 5.1
<#
.SYNOPSIS
    CoopIS Developer Stop Script
.DESCRIPTION
    Safely stops all running CoopIS development processes:
      1. .NET API (port 5208 / CoopIS.Api process)
      2. Vite Frontend dev server (port 5173 / node processes)
      3. Associated terminal sessions
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'SilentlyContinue'

function Write-Step([string]$msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "  [OK]   $msg" -ForegroundColor Green }
function Write-Info([string]$msg) { Write-Host "  [INFO] $msg" -ForegroundColor Gray }

Write-Host ""
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host "  CoopIS -- Developer Environment Stop"        -ForegroundColor Magenta
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host ""

$killedCount = 0

# 1. Stop processes listening on CoopIS ports (5208 for API, 5173 for Frontend)
Write-Step "Step 1/2 -- Checking active ports (5208 & 5173)"
$ports = @(5208, 5173)
$pidsToKill = @()

foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            if ($conn.OwningProcess -and $conn.OwningProcess -ne 0 -and $conn.OwningProcess -ne $PID) {
                $pidsToKill += $conn.OwningProcess
            }
        }
    }
}

$uniquePids = $pidsToKill | Select-Object -Unique
foreach ($procId in $uniquePids) {
    try {
        $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($p) {
            $procName = $p.ProcessName
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            Write-Ok "Stopped process '$procName' (PID: $procId) on active port."
            $killedCount++
        }
    } catch { }
}

# 2. Stop known CoopIS processes by name
Write-Step "Step 2/2 -- Cleaning up CoopIS application processes"
$targetNames = @("CoopIS.Api")
foreach ($name in $targetNames) {
    $found = Get-Process -Name $name -ErrorAction SilentlyContinue
    if ($found) {
        foreach ($proc in $found) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            Write-Ok "Stopped '$name' (PID: $($proc.Id))."
            $killedCount++
        }
    }
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
if ($killedCount -gt 0) {
    Write-Host "  All CoopIS services have been stopped.     " -ForegroundColor Green
} else {
    Write-Host "  No active CoopIS services were running.    " -ForegroundColor Gray
}
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

