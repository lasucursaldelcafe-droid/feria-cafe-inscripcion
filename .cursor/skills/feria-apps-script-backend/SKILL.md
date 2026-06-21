---
name: feria-apps-script-backend
description: >-
  Backend Google Apps Script de Feria Café: Code.gs (doGet/doPost, formTypes feria/
  competencia/stands/lista_espera, emails, Drive uploads, stands_map, expositor_feed,
  admin_dashboard, pageview). Redeploy Web App, sincronizarEncabezados, setup_admin.py
  y conectar_sheets.py. Usar al editar formularios, Sheets, stands, panel expositor,
  admin o scripts Python de Apps Script.
---

# Feria Apps Script Backend

Fuente de verdad: `tools/google-apps-script/Code.gs` (vinculado a Google Sheet del evento).

## Arquitectura API

Web App desplegada como **Ejecutar como: yo** + **Acceso: cualquier persona**. URL `/exec` → `js/sheets-config.js` (`WEB_APP_URL`).

### doGet (`?action=`)

| action | Uso |
|--------|-----|
| *(vacío)* | Health: `{ ok, forms: [...] }` |
| `cupo` | Cupo Switch Championship |
| `stands_map` | Ocupación + logos para mapa |
| `expositor_feed` | Novedades panel expositor |
| `admin_dashboard` | Stats admin (+ `idToken` Firebase) |
| `admin_export` | CSV datasets admin |

### doPost (JSON body)

| Campo | Comportamiento |
|-------|----------------|
| `action=pageview` | Analítica propia → hoja Analytics |
| `action=expositor_login` | Login panel (`email` + `accessCode`) |
| `formType=feria` | Inscripción visitante |
| `formType=competencia` | Switch Championship (+ foto/comprobante Drive) |
| `formType=stands` | Solicitud stand (+ logo Drive, `accessCode`, `expositorPanelUrl`) |
| `formType=lista_espera` | Lista de espera competencia |

Errores frecuentes en respuesta: `cupoCompleto`, `duplicate`, `standOcupado`.

## Hojas y encabezados

Pestañas: Feria, Competencia, Stands, Lista de espera, Analytics, Novedades.

**Sincronizar encabezados** (editor Apps Script → ejecutar una vez):

```javascript
sincronizarEncabezados()
```

Crea pestañas faltantes y escribe fila 1 desde constantes `HEADERS_*`. Tras añadir columnas en `Code.gs`, volver a ejecutar.

Plantilla columnas: `tools/PLANTILLA-ENCABEZADOS.json`.

## Emails y Drive

- Confirmación inscrito + alerta organizador (`ORGANIZER_EMAIL` en Code.gs; alinear con `EVENT_CONFIG.alerts.email`).
- Logos stands → carpeta Drive `Feria — Logos expositores`.
- Competencia: fotos/comprobantes en Drive; URLs en fila Sheet.

## Stands y expositor

- GET `stands_map` → datos para `js/stands-map.js`.
- POST `stands` → genera `accessCode`; email con enlace panel (`/mi-stand` → `expositor.html`).
- POST `expositor_login` → sesión panel (`js/expositor-panel.js`).

## Redeploy Web App

Tras editar `Code.gs`:

### Opción A — setup_admin (recomendada, OAuth + deploy + verify)

```powershell
py tools/setup_admin.py
py tools/setup_admin.py --script-id TU_SCRIPT_ID
```

Variables en `tools/.env` (gitignored): `APPS_SCRIPT_ID`, `GOOGLE_SHEET_ID`, `SHEETS_WEB_APP_URL`.

Sube Code.gs, crea deployment Web App, actualiza `js/sheets-config.js` y corre checks.

### Opción B — clasp manual

```powershell
py tools/desplegar_apps_script.py --script-id TU_SCRIPT_ID
```

Requiere `npx @google/clasp` + login. Luego **nueva versión** de deployment Web App en consola si la URL no cambia pero el código sí (misma URL `/exec` sirve tras redeploy).

### Verificar

```powershell
py tools/verify_admin.py
py tools/conectar_sheets.py --verificar
py tools/conectar_sheets.py --probar-envio
```

## conectar_sheets.py — flujo Sheets

```powershell
py tools/conectar_sheets.py --crear-hoja --share-with tu@gmail.com
# Desplegar Code.gs (paso anterior)
py tools/conectar_sheets.py --configurar-url "https://script.google.com/macros/s/.../exec"
py tools/conectar_sheets.py --verificar
py tools/conectar_sheets.py --probar-envio
```

Escribe `js/sheets-config.js` vía `write_sheets_config()` en `tools/_util.py`.

Guía completa: `tools/INSTRUCCIONES-SHEETS.md`.

## Cambios seguros en Code.gs

1. Mantener `jsonResponse()` y CORS (`doOptions`).
2. Nuevo `formType` → encabezados + `sincronizarEncabezados` + emails + health `forms[]`.
3. Nuevo `action` GET → rama en `doGet` + consumidor JS/documentación.
4. No hardcodear secretos; IDs de hoja vía propiedades o spreadsheet activo.
5. Tras deploy: `verify_admin.py` + prueba manual del formulario afectado.

## Checklist backend

```
- [ ] Code.gs editado en tools/google-apps-script/
- [ ] sincronizarEncabezados si cambiaron columnas
- [ ] py tools/setup_admin.py (o desplegar_apps_script.py)
- [ ] py tools/conectar_sheets.py --verificar
- [ ] py tools/verify_admin.py
- [ ] Bump ?v= en JS cliente si cambió contrato API
- [ ] Redeploy Firebase Hosting si solo cambió frontend
```

## Referencias

- `tools/google-apps-script/Code.gs`, `appsscript.json`
- `tools/setup_admin.py`, `tools/conectar_sheets.py`, `tools/verify_admin.py`
- `tools/ADMIN-DASHBOARD.md`, `js/form-submit.js`, `js/stands-map.js`, `js/expositor-panel.js`
