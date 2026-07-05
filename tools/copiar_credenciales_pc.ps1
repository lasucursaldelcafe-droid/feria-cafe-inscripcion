# Copia credenciales desde tu PC al proyecto (Windows)
# Uso: .\tools\copiar_credenciales_pc.ps1
# Ajusta $OrigenFirebase y $OrigenSheets si tus JSON están en otra ruta.

$ErrorActionPreference = "Stop"
$Dest = Join-Path $PSScriptRoot "credentials"
New-Item -ItemType Directory -Force -Path $Dest | Out-Null

$OrigenFirebase = @(
    "$env:USERPROFILE\Downloads\firebase-sa.json",
    "$env:USERPROFILE\Downloads\la-sucursal-del-cafe-firebase-adminsdk.json",
    "C:\Users\LENOVO\Projects\feria-cafe-inscripcion\tools\credentials\firebase-hosting-sa.json"
)

$OrigenSheets = @(
    "$env:USERPROFILE\Downloads\feria-sheets-sa.json",
    "C:\Users\LENOVO\Projects\feria-cafe-inscripcion\tools\credentials\feria-sheets-sa.json"
)

function Copy-FirstExisting($candidates, $destName) {
    foreach ($path in $candidates) {
        if (Test-Path $path) {
            $dest = Join-Path $Dest $destName
            Copy-Item $path $dest -Force
            Write-Host "[OK] $destName <- $path"
            return $true
        }
    }
    Write-Host "[AVISO] No encontrado: $destName"
    return $false
}

Copy-FirstExisting $OrigenFirebase "firebase-hosting-sa.json"
Copy-FirstExisting $OrigenSheets "feria-sheets-sa.json"

if (Test-Path (Join-Path $Dest ".oauth-script-token.json")) {
    Write-Host "[OK] .oauth-script-token.json ya existe"
} else {
    Write-Host "[INFO] OAuth: ejecuta  py tools\setup_admin.py --sin-firebase"
}

Write-Host ""
Write-Host "Siguiente paso:"
Write-Host "  py tools\agent_setup_completo.py --aplicar"
