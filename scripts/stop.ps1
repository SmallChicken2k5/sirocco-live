$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $PSScriptRoot
$studioScript = Join-Path $studioRoot 'server.mjs'
$listener = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue
if (-not $listener) { Write-Host 'Sirocco Live is not running.'; exit }
$health = Invoke-RestMethod -Uri 'http://127.0.0.1:8765/api/health' -TimeoutSec 2
if ($health.name -ne 'Sirocco Live') { throw 'Port 8765 belongs to another application.' }
foreach ($owner in ($listener.OwningProcess | Sort-Object -Unique)) {
    $details = Get-CimInstance Win32_Process -Filter "ProcessId = $owner"
    if ($details.Name -ne 'node.exe' -or -not $details.CommandLine.Contains($studioScript)) { throw 'Unexpected process. Will not stop it.' }
    Stop-Process -Id $owner
}
Write-Host 'Sirocco Live stopped. Configuration is saved in data/config.json.'
