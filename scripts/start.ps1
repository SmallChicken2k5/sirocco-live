param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $PSScriptRoot
$studioUrl = 'http://127.0.0.1:8765'
$logRoot = Join-Path $studioRoot 'logs'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
function Show-StudioError([string]$message) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($message, 'Sirocco Live') | Out-Null
}
try {
    try {
        $health = Invoke-RestMethod -Uri "$studioUrl/api/health" -TimeoutSec 2
        if ($health.name -eq 'Sirocco Live') {
            if (-not $NoBrowser) { Start-Process $studioUrl }
            exit
        }
        throw 'Port 8765 is already used by another application.'
    } catch {
        if (Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue) {
            throw 'Port 8765 is already used. Close that application or use a different PORT with npm start.'
        }
    }
    $nodePath = Join-Path $studioRoot 'runtime\node.exe'
    if (-not (Test-Path -LiteralPath $nodePath)) {
        $nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
    }
    if (-not $nodePath) { throw 'Node.js 22+ is required. Please install Node.js LTS, then open START.vbs again.' }
    if (-not (Test-Path -LiteralPath (Join-Path $studioRoot 'dist\app.js'))) { throw 'Build files are missing. Run npm install and npm run build in the application folder.' }
    $serverFile = Join-Path $studioRoot 'server.mjs'
    $studioProcess = Start-Process -FilePath $nodePath -ArgumentList @('"' + $serverFile + '"') -WorkingDirectory $studioRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot 'server.log') -RedirectStandardError (Join-Path $logRoot 'error.log')
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 300
        if ($studioProcess.HasExited) { throw 'Sirocco Live stopped. See logs/error.log in the application folder.' }
        try {
            $health = Invoke-RestMethod -Uri "$studioUrl/api/health" -TimeoutSec 1
            if ($health.name -eq 'Sirocco Live') { if (-not $NoBrowser) { Start-Process $studioUrl }; exit }
        } catch { }
    }
    throw 'Sirocco Live did not start in time. See logs/error.log.'
} catch { Show-StudioError $_.Exception.Message }
