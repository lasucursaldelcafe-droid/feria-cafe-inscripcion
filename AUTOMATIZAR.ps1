# Automatizador Feria Cafe — PowerShell
# Uso: .\AUTOMATIZAR.ps1 [-Modo gui|auto|audit|report]

param(
    [ValidateSet("gui", "auto", "audit", "report", "menu")]
    [string]$Modo = "menu"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Get-Python {
    if (Get-Command py -ErrorAction SilentlyContinue) { return "py" }
    if (Get-Command python -ErrorAction SilentlyContinue) { return "python" }
    throw "Python no encontrado. Instala desde https://python.org"
}

$Py = Get-Python

if (-not (Test-Path "tools\.env") -and (Test-Path "tools\.env.example")) {
    Copy-Item "tools\.env.example" "tools\.env"
    Write-Host "[INFO] Creado tools\.env" -ForegroundColor Yellow
}

switch ($Modo) {
    "gui" {
        & $Py tools/feria_automatizador_gui.py
    }
    "auto" {
        & $Py tools/automatizar_faltantes.py --aplicar --deploy --reporte
    }
    "audit" {
        & $Py tools/automatizar_faltantes.py --auditar --reporte
    }
    "report" {
        & $Py tools/automatizar_faltantes.py --auditar --reporte
    }
    default {
        Write-Host ""
        Write-Host " Feria Cafe — Automatizador" -ForegroundColor Cyan
        Write-Host " 1. App grafica"
        Write-Host " 2. Corregir todo"
        Write-Host " 3. Auditar"
        Write-Host " 4. Reporte HTML"
        $c = Read-Host "Opcion"
        switch ($c) {
            "1" { & $Py tools/feria_automatizador_gui.py }
            "2" { & $Py tools/automatizar_faltantes.py --aplicar --reporte }
            "3" { & $Py tools/automatizar_faltantes.py --auditar --reporte }
            "4" { & $Py tools/automatizar_faltantes.py --auditar --reporte }
            default { Write-Host "Opcion invalida" -ForegroundColor Red }
        }
    }
}
