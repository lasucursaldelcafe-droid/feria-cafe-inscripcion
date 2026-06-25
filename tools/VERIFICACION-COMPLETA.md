# Verificación completa y orden automática

Auditoría de **todo el sitio en producción**, el backend Apps Script, el repositorio y la CI — con un comando que genera y ejecuta el plan de corrección.

## Un comando

```powershell
# 1. Auditoría completa (informe en consola)
py tools/verificar_todo.py

# 2. Plan de acciones ordenadas según fallos detectados
py tools/orden_automatica.py

# 3. Aplicar correcciones automáticas + re-verificar
py tools/orden_automatica.py --aplicar

# 4. Pipeline de mantenimiento completo
py tools/orden_automatica.py --completo --aplicar
```

## Qué verifica `verificar_todo.py`

| Categoría | Comprobaciones |
|-----------|----------------|
| **hosting** | 20 rutas públicas, assets críticos, scripts en formularios |
| **backend** | `sheets-config.js` en prod, health/cupo/stands_map/admin/pageview |
| **wallet** | Cloud Function (opcional) |
| **repo** | Archivos clave + HTML de `firebase.json` |
| **local** | `tools/.env`, `sheets-config.js` local (opcional) |

```powershell
py tools/verificar_todo.py --solo-web    # Solo producción
py tools/verificar_todo.py --solo-repo   # Solo archivos del repo
py tools/verificar_todo.py --json        # Salida para scripts
```

## Orden automática de implementación

`orden_automatica.py` lee los fallos y propone acciones en este orden de prioridad:

1. Variables locales / `.env`
2. URL Sheets local
3. **Apps Script** → `setup_admin.py --sin-firebase`
4. **Secretos CI** → `setup_github_ci.py`
5. **Firebase Hosting** → `deploy_firebase.py`
6. **Google Wallet** (manual si aplica)

Con `--completo --aplicar` ejecuta el pipeline de mantenimiento estándar del proyecto.

## CI en GitHub

Workflow `.github/workflows/verificar-sitio.yml`:

- Manual: **Actions → Verificar sitio → Run workflow**
- Programado: lunes 08:00 UTC

## Estado verificado (producción)

Última auditoría manual: todas las rutas canónicas **HTTP 200**, Apps Script operativo (health, dashboard, pageview, cupo, stands_map), `sheets-config.js` con URL `/exec` válida.

Pendiente opcional: Cloud Function `generateWalletPass` (ver `GOOGLE-WALLET-SETUP.md`).

## Scripts relacionados

| Script | Uso |
|--------|-----|
| `verificar_todo.py` | Auditoría integral |
| `orden_automatica.py` | Plan + ejecución automática |
| `verify_admin.py` | Solo Apps Script + admin |
| `validate_ci_secrets.py` | Secretos GitHub |
| `automatizar_manual.py` | Mantenimiento release |
| `fix_all.py` | Legacy (usar orden_automatica) |
