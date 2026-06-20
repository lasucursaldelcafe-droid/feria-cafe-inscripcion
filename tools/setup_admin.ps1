# Configura panel admin (Apps Script + credenciales + verificación).
# Uso: .\tools\setup_admin.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
py tools/setup_admin.py @args
exit $LASTEXITCODE
