# Automatización del ecosistema Google — Feria Café

Guía central para **Google Sheets**, **Apps Script**, **GitHub Actions** y su conexión con **Firebase Hosting**.

## Arquitectura

```
Formularios web (Firebase Hosting)
        │
        ▼
  js/sheets-config.js  ←── SHEETS_WEB_APP_URL (secreto CI o local)
        │
        ▼
  Apps Script Web App (/exec)  ←── tools/google-apps-script/Code.gs
        │
        ▼
  Google Spreadsheet (Feria, Competencia, Stands, Analytics, …)
```

| Componente | Fuente de verdad | Automatización |
|------------|------------------|----------------|
| Backend API | `tools/google-apps-script/Code.gs` | `setup_admin.py`, workflow `deploy-apps-script.yml` |
| Hoja de datos | Google Sheets del evento | `conectar_sheets.py`, `automatizar_todo.py` |
| URL en el sitio | `js/sheets-config.js` (gitignored) | `conectar_sheets.py --configurar-url` o CI |
| Secretos CI | GitHub → Settings → Secrets | `setup_github_ci.py` |

## Comando único

```powershell
py tools/automatizar_google.py mantenimiento
```

**Windows (doble clic):** `AUTOMATIZAR.bat` en la raíz — app gráfica o corrección automática de faltantes.

**Auditar / corregir pendientes:**

```powershell
py tools/automatizar_faltantes.py --auditar --reporte
py tools/automatizar_faltantes.py --aplicar
py tools/automatizar_google.py faltantes
py tools/feria_automatizador_gui.py
```

Equivalente a `automatizar_manual.py --todo`: Apps Script + sheets-config + secretos GitHub + Firebase + verificación.

### Todos los modos

| Modo | Cuándo usarlo |
|------|----------------|
| `inicial` | Primera vez: cuenta de servicio + hoja + Apps Script |
| `mantenimiento` | Antes de un release o tras cambiar `Code.gs` |
| `apps-script` | Solo subir `Code.gs` y redeploy Web App |
| `sheets` | Crear o actualizar la hoja de inscripciones |
| `ci` | Sincronizar secretos en GitHub Actions |
| `deploy` | Solo Firebase Hosting |
| `verificar` | Health checks de endpoints y configuración |
| `sin-sa` | Sin JSON de cuenta de servicio GCP (política org) |
| `urls` | Abrir consolas Google / Firebase / GitHub |

```powershell
py tools/automatizar_google.py help
```

## Flujos habituales

### 1. Primera configuración (con cuenta de servicio GCP)

```powershell
py tools/automatizar_google.py inicial
# o equivalente:
py tools/automatizar_todo.py --todo
```

### 2. Sin cuenta de servicio (solo Gmail)

```powershell
py tools/automatizar_google.py sin-sa
```

Ver [`credentials/README.md`](credentials/README.md) si la org bloquea claves SA.

### 3. Tras editar Code.gs (local)

```powershell
py tools/automatizar_google.py apps-script
# o:
py tools/setup_admin.py --sin-firebase
```

Recordatorio: si cambiaste encabezados de columnas, ejecuta `sincronizarEncabezados()` una vez en el editor de Apps Script.

### 4. Despliegue automático de Apps Script (CI)

Cuando haces push a `main` con cambios en `tools/google-apps-script/**`, el workflow **Deploy Apps Script** sube `Code.gs` y actualiza la implementación Web App.

**Secretos requeridos en GitHub:**

| Secreto | Origen |
|---------|--------|
| `APPS_SCRIPT_OAUTH_TOKEN` | JSON de `tools/credentials/.oauth-script-token.json` (generado por `setup_admin.py`) |
| `APPS_SCRIPT_ID` | ID del proyecto Apps Script (`tools/.env` o editor → ⚙) |
| `SHEETS_WEB_APP_URL` | URL `/exec` actual de la Web App |

Sincronizar desde tu PC (requiere `gh auth login`):

```powershell
py tools/setup_admin.py --sin-firebase    # genera token OAuth la primera vez
py tools/setup_github_ci.py --apps-script
```

Lanzar manualmente:

```powershell
gh workflow run "Deploy Apps Script"
gh run list --workflow deploy-apps-script.yml --limit 3
```

### 5. Secretos Firebase + Sheets (CI Hosting)

```powershell
py tools/setup_github_ci.py --wait-sa
py tools/validate_ci_secrets.py
```

Workflow: `.github/workflows/deploy-firebase.yml` (push a `main`).

## Scripts relacionados

| Script | Rol |
|--------|-----|
| `automatizar_google.py` | **Entrada unificada** (este documento) |
| `automatizar_todo.py` | Setup inicial completo |
| `automatizar_manual.py` | Mantenimiento y releases |
| `setup_admin.py` | Subir Code.gs vía API (OAuth) |
| `conectar_sheets.py` | Hoja + sheets-config + pruebas |
| `setup_github_ci.py` | Secretos GitHub (Firebase + Apps Script) |
| `validate_ci_secrets.py` | Diagnóstico local y en CI |
| `verify_admin.py` | Verificación de endpoints |

## Variables en `tools/.env`

Ver [`PLANTILLA-ENV.md`](PLANTILLA-ENV.md) y [`.env.example`](.env.example).

## Referencias

- [`INSTRUCCIONES-SHEETS.md`](INSTRUCCIONES-SHEETS.md) — detalle Sheets + Apps Script
- [`ADMIN-DASHBOARD.md`](ADMIN-DASHBOARD.md) — panel `/admin`
- [`CONFIGURAR-FIREBASE-NUEVO.md`](CONFIGURAR-FIREBASE-NUEVO.md) — Firebase Hosting
- [`GITHUB-ACTIONS-SETUP.md`](../GITHUB-ACTIONS-SETUP.md) — secretos CI
- Skill Cursor: `.cursor/skills/feria-apps-script-backend/SKILL.md`
