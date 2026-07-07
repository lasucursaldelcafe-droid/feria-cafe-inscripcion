@echo off
chcp 65001 >nul 2>&1
title La Sucursal del Cafe - Automatizador
cd /d "%~dp0"

where py >nul 2>&1 && (set PY=py) || (set PY=python)
where %PY% >nul 2>&1 || (
  echo [ERROR] No se encontro Python. Instala Python 3.11+ desde https://python.org
  pause
  exit /b 1
)

if not exist "tools\.env" (
  if exist "tools\.env.example" copy "tools\.env.example" "tools\.env" >nul
  echo [INFO] Creado tools\.env desde plantilla.
)

if "%~1"=="auto" goto auto
if "%~1"=="audit" goto audit
if "%~1"=="gui" goto gui
if "%~1"=="report" goto report

:menu
echo.
echo  ============================================
echo   Feria Cafe - Automatizador de faltantes
echo  ============================================
echo   1. App grafica (recomendado)
echo   2. Corregir todo automatico
echo   3. Solo auditar faltantes
echo   4. Generar reporte HTML
echo   5. Salir
echo.
set /p OPCION=Elige [1-5]: 
if "%OPCION%"=="1" goto gui
if "%OPCION%"=="2" goto auto
if "%OPCION%"=="3" goto audit
if "%OPCION%"=="4" goto report
if "%OPCION%"=="5" exit /b 0
goto menu

:gui
%PY% tools\feria_automatizador_gui.py
goto end

:auto
%PY% tools\automatizar_faltantes.py --aplicar --deploy --reporte
goto end

:audit
%PY% tools\automatizar_faltantes.py --auditar --reporte
goto end

:report
%PY% tools\automatizar_faltantes.py --auditar --reporte
goto end

:end
echo.
pause
