---
name: feria-web-hosting
description: >-
  Despliega y configura Firebase Hosting del sitio Feria Café (la-sucursal-del-cafe):
  firebase.json rewrites/redirects/headers, deploy_firebase.py, verify_admin.py,
  sheets-config local vs GitHub Actions CI, cache-bust ?v= en HTML. Usar al desplegar
  hosting, editar firebase.json, rutas canónicas (site-links), event-config, CI/CD o
  cuando el usuario mencione Firebase Hosting, GitHub Actions, SHEETS_WEB_APP_URL o
  secretos de deploy.
---

# Feria Web Hosting

Stack: sitio estático en raíz del repo → Firebase Hosting (`la-sucursal-del-cafe`). Backend en Apps Script (no Firebase Functions).

## Convenciones del repo

| Tema | Regla |
|------|-------|
| Rutas | `js/site-links.js`: `LOCAL` (.html) vs `HOSTED` (URLs limpias). Enlaces con `data-link="clave"`; no hardcodear rutas en HTML nuevos. |
| Config pública | `js/event-config.js` — fechas, sedes, sponsors, stands. Editar aquí, no duplicar en cada HTML. |
| Sheets URL | `js/sheets-config.js` (gitignored). Plantilla: `js/sheets-config.example.js`. |
| Analítica | **Analítica propia** (`js/analytics-tracker.js` → Apps Script). **No GA4 / Google Analytics.** |
| Secretos | No versionar `js/sheets-config.js`, `tools/.env`, JSON de cuentas de servicio. |

## firebase.json

- **`public`:** `.` — HTML/CSS/JS en raíz; `tools/` excluido del deploy.
- **`rewrites`:** URLs limpias → `*.html` (p. ej. `/inscripcion` → `inscripcion.html`, `/mi-stand` → `expositor.html`).
- **`redirects`:** trailing slash → sin slash (301).
- **`headers`:** CSS/JS/HTML `max-age=300, must-revalidate`; `/admin`, `/expositor`, `/mi-stand` → `no-store` + `X-Robots-Tag: noindex`.

Al añadir página pública: actualizar **rewrites + redirects + sitemap.xml + site-links.js** juntos.

## Cache-bust

Tras cambiar CSS/JS servidos con cache corto, bump `?v=YYYYMMDDx` en los `<link>`/`<script>` del HTML afectado (convención actual: `20260620c`, `20260621a`, etc.). Archivos dinámicos/admin: mismos sufijos en `admin.html`, `site-chrome.js` (analytics).

## sheets-config: local vs CI

| Entorno | Origen de `WEB_APP_URL` |
|---------|-------------------------|
| Local | `js/sheets-config.js` manual o `py tools/conectar_sheets.py --configurar-url "…/exec"` |
| GitHub Actions | Secreto `SHEETS_WEB_APP_URL` → workflow genera `js/sheets-config.js` en el runner (`.github/workflows/deploy-firebase.yml`) |

Sin URL: formularios usan `localStorage` (modo fallback).

**No subir** `js/sheets-config.js` al repo. Detalle: `CHECKLIST.md` § GitHub Actions.

## Despliegue local

```powershell
cd D:\Desarrollo\02_Proyectos\Feria-Cafe-Inscripcion
py tools/deploy_firebase.py
# Alternativas auth:
py tools/deploy_firebase.py --token TU_TOKEN
py tools/deploy_firebase.py --service-account ruta/firebase-sa.json
py tools/deploy_firebase.py --dry-run
```

Usa `npx firebase-tools@latest`; proyecto default `la-sucursal-del-cafe` (`tools/_util.py`).

## CI (GitHub Actions)

Push a `main` → `.github/workflows/deploy-firebase.yml`.

Secretos requeridos (Settings → Secrets → Actions):

| Secreto | Obligatorio |
|---------|-------------|
| `FIREBASE_SERVICE_ACCOUNT` | Sí — JSON completo |
| `SHEETS_WEB_APP_URL` | No — URL `/exec` de Apps Script |

Configuración manual: `CHECKLIST.md`, `tools/CONFIGURAR-FIREBASE-NUEVO.md`.

Script automatizado (requiere `gh auth login` + JSON local):

```powershell
.\tools\sync_github_secrets.ps1
```

Alternativa con `gh` CLI directo:

```powershell
gh secret set FIREBASE_SERVICE_ACCOUNT < ruta\firebase-sa.json
gh secret set SHEETS_WEB_APP_URL --body "https://script.google.com/macros/s/.../exec"
```

## Verificación post-deploy

```powershell
py tools/verify_admin.py
py tools/verify_admin.py --url "https://script.google.com/macros/s/.../exec"
```

Comprueba: health GET, `admin_dashboard`, POST `pageview`, panel `/admin` sin OAuth legacy.

## Checklist deploy hosting

```
- [ ] Cambios en firebase.json coherentes con site-links.js
- [ ] ?v= actualizado si cambió CSS/JS cacheable
- [ ] js/sheets-config.js local OK (CI usa secreto)
- [ ] py tools/deploy_firebase.py o push a main
- [ ] py tools/verify_admin.py
- [ ] Probar una URL limpia en producción (/stands, /inscripcion)
```

## Referencias

- `README.md`, `CHECKLIST.md`
- `tools/deploy_firebase.py`, `tools/verify_admin.py`, `tools/sync_github_secrets.ps1`
- `.github/workflows/deploy-firebase.yml`
