# Orquestador completo: Google Cloud SA → Sheets → Apps Script → sitio.
# Requiere: Python 3.11+ (Node.js opcional para clasp/Firebase).
#
# Uso (un comando):
#   .\tools\conectar_todo.ps1
#
# Equivalente directo:
#   py tools/automatizar_todo.py --todo

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "=== Feria-Cafe-Inscripcion: automatizacion completa ===" -ForegroundColor Cyan

if (-not (Test-Path "tools\.env")) {
    Copy-Item "tools\.env.example" "tools\.env"
    Write-Host "[AVISO] Creado tools\.env desde plantilla." -ForegroundColor Yellow
}

$sinFirebase = $false
if ($args -contains "--sin-firebase") { $sinFirebase = $true }

$pyArgs = @("tools/automatizar_todo.py", "--todo")
if ($sinFirebase) { $pyArgs += "--sin-firebase" }

py -3 @pyArgs
exit $LASTEXITCODE
