# Sincroniza secretos de GitHub Actions (Firebase Hosting + Sheets opcional).
#
# Requisitos:
#   - gh auth login
#   - tools/credentials/firebase-hosting-sa.json (descargado desde Firebase Console)
#
# Uso:
#   .\tools\sync_github_secrets.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$SaPath = Join-Path $Root "tools\credentials\firebase-hosting-sa.json"

function Write-Info([string]$Message) {
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
    Write-Host "[AVISO] $Message" -ForegroundColor Yellow
}

function Write-Err([string]$Message) {
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

if (-not (Test-Path $SaPath)) {
    Write-Err "No se encontró la cuenta de servicio de Firebase Hosting."
    Write-Host ""
    Write-Host "Pasos:" -ForegroundColor Yellow
    Write-Host "  1. Firebase Console → la-sucursal-del-cafe → Project settings → Service accounts"
    Write-Host "  2. Generate new private key → descarga el .json"
    Write-Host "  3. Guárdalo como: tools\credentials\firebase-hosting-sa.json"
    Write-Host ""
    Write-Host "Ver también: tools\CONFIGURAR-FIREBASE-NUEVO.md"
    exit 1
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Err "No se encontró gh (GitHub CLI). Instálalo y ejecuta: gh auth login"
    exit 1
}

Write-Info "Validando JSON con deploy_firebase.py --dry-run..."
py tools/deploy_firebase.py --service-account $SaPath --dry-run
if ($LASTEXITCODE -ne 0) {
    Write-Err "El JSON no pasó la validación. Corrige el archivo antes de subir secretos."
    exit $LASTEXITCODE
}
Write-Ok "JSON de cuenta de servicio válido."

Write-Info "Subiendo secreto FIREBASE_SERVICE_ACCOUNT a GitHub..."
Get-Content -Raw -Encoding UTF8 $SaPath | gh secret set FIREBASE_SERVICE_ACCOUNT
if ($LASTEXITCODE -ne 0) {
    Write-Err "No se pudo subir FIREBASE_SERVICE_ACCOUNT. ¿Estás autenticado con gh auth login?"
    exit 1
}
Write-Ok "Secreto FIREBASE_SERVICE_ACCOUNT actualizado."

$EnvPath = Join-Path $Root "tools\.env"
if (Test-Path $EnvPath) {
    $SheetsUrl = $null
    foreach ($line in Get-Content $EnvPath -Encoding UTF8) {
        if ($line -match '^\s*SHEETS_WEB_APP_URL\s*=\s*(.+)\s*$') {
            $SheetsUrl = $Matches[1].Trim().Trim('"').Trim("'")
            break
        }
    }
    if ($SheetsUrl) {
        Write-Info "Subiendo SHEETS_WEB_APP_URL desde tools\.env..."
        $SheetsUrl | gh secret set SHEETS_WEB_APP_URL
        if ($LASTEXITCODE -ne 0) {
            Write-Err "No se pudo subir SHEETS_WEB_APP_URL."
            exit 1
        }
        Write-Ok "Secreto SHEETS_WEB_APP_URL actualizado."
    }
    else {
        Write-Warn "tools\.env no define SHEETS_WEB_APP_URL; se omite (opcional)."
    }
}
else {
    Write-Warn "No hay tools\.env; solo se subió FIREBASE_SERVICE_ACCOUNT."
}

Write-Host ""
Write-Ok "Secretos sincronizados."
Write-Host ""
Write-Host "Para reintentar el deploy en GitHub Actions:" -ForegroundColor Green
Write-Host '  gh workflow run "Deploy Firebase Hosting"'
Write-Host ""
Write-Host "Comprobar el resultado:" -ForegroundColor Green
Write-Host "  gh run list --workflow deploy-firebase.yml --limit 3"
