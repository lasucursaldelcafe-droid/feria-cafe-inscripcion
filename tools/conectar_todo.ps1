# Conecta Google Sheets + Apps Script para Feria y Competencia.
# Requiere: Python 3.11+, Node.js, cuenta de servicio Google (JSON).
#
# Uso:
#   copy tools\.env.example tools\.env
#   # Edita tools\.env -> GOOGLE_SERVICE_ACCOUNT_JSON y SHARE_SHEET_WITH
#   .\tools\conectar_todo.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "=== Feria-Cafe-Inscripcion: conexion Google Sheets ===" -ForegroundColor Cyan

if (-not (Test-Path "tools\.env")) {
    Copy-Item "tools\.env.example" "tools\.env"
    Write-Host "[AVISO] Creado tools\.env desde plantilla. Completa GOOGLE_SERVICE_ACCOUNT_JSON antes de continuar." -ForegroundColor Yellow
}

py -3 -m pip install -r tools/requirements.txt -q

$envFile = Get-Content "tools\.env" -Raw
if ($envFile -notmatch "GOOGLE_SERVICE_ACCOUNT_JSON=\S") {
    Write-Host "[ERROR] Define GOOGLE_SERVICE_ACCOUNT_JSON en tools\.env" -ForegroundColor Red
    Write-Host "  1. Google Cloud Console -> Sheets API + Drive API -> cuenta de servicio -> descargar JSON"
    Write-Host "  2. Edita tools\.env con la ruta al JSON y SHARE_SHEET_WITH=tu@gmail.com"
    exit 2
}

$share = ""
if ($envFile -match "SHARE_SHEET_WITH=(.+)") {
    $share = $Matches[1].Trim().Trim('"').Trim("'")
}
$shareArgs = @()
if ($share) { $shareArgs = @("--share-with", $share) }

Write-Host "`n--- Paso 1: crear/actualizar hoja ---" -ForegroundColor Cyan
py tools/conectar_sheets.py --crear-hoja @shareArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n--- Paso 2: Apps Script (clasp) ---" -ForegroundColor Cyan
if (Test-Path "$env:USERPROFILE\.clasprc.json") {
    py tools/desplegar_apps_script.py
} else {
    Write-Host "[AVISO] clasp no autenticado. Opciones:" -ForegroundColor Yellow
    Write-Host "  A) npx -y @google/clasp login  ->  py tools/desplegar_apps_script.py"
    Write-Host "  B) Manual: abre la hoja -> Extensiones > Apps Script -> pega tools/google-apps-script/Code.gs"
    Write-Host "     Implementar > Aplicacion web > Ejecutar como: Yo | Acceso: Cualquier persona"
}

$config = Get-Content "js\sheets-config.js" -Raw -ErrorAction SilentlyContinue
if ($config -match "WEB_APP_URL:\s*'https://script\.google") {
    Write-Host "`n--- Paso 3: verificar ---" -ForegroundColor Cyan
    py tools/conectar_sheets.py --verificar
    py tools/conectar_sheets.py --probar-envio
} else {
    Write-Host "`n[AVISO] Falta configurar WEB_APP_URL:" -ForegroundColor Yellow
    Write-Host '  py tools/conectar_sheets.py --configurar-url "https://script.google.com/macros/s/.../exec"'
}

Write-Host "`n=== Fin ===" -ForegroundColor Green
