# Informe de conectividad al 100% — La Sucursal del Café

**Proyecto:** `lasucursaldelcafe-droid/feria-cafe-inscripcion`  
**Sitio producción:** https://la-sucursal-del-cafe.web.app  
**Fecha:** julio 2026  
**Auditoría base:** `python3 tools/verificar_todo.py` (última ejecución: crítico OK, 1 aviso Wallet)

---

## Resumen ejecutivo

| Área | Estado | Bloquea el evento |
|------|--------|-------------------|
| Firebase Hosting (sitio público) | ✅ Conectado | No |
| Apps Script `/exec` (formularios, admin, pasaporte, jurado) | ✅ Conectado | No |
| GitHub Actions — deploy Hosting | ✅ Conectado (`FIREBASE_SERVICE_ACCOUNT`) | No |
| GitHub Actions — deploy `Code.gs` automático | ⚠️ Requiere `OAUTH_SCRIPT_TOKEN` | No (hay plan B manual) |
| Google Wallet (`/mi-tarjeta`) | ⚠️ Cloud Function 404 | No (opcional) |
| Firestore rules (fidelización avanzada) | ⚠️ Permisos IAM pendientes | No (Sheets respalda datos) |
| Seguridad `/admin` | ⚠️ Sin login (panel abierto) | Riesgo operativo |

**Conclusión:** El ecosistema principal (inscripciones, competencia V60, pasaporte, jurado, admin, hosting) **ya funciona en producción**. Lo que falta son automatizaciones CI, Wallet opcional y endurecimiento de seguridad.

---

## Cuadro maestro — qué conectar y dónde

| # | Componente | Estado | Consola / enlace de configuración | Qué escribir (key / secreto / valor) | Plan B sin push a `main` |
|---|------------|--------|-----------------------------------|--------------------------------------|---------------------------|
| 1 | **Firebase Hosting** | ✅ OK | [Firebase Console → la-sucursal-del-cafe](https://console.firebase.google.com/project/la-sucursal-del-cafe/hosting) | Secreto GitHub `FIREBASE_SERVICE_ACCOUNT` = **JSON completo** del Admin SDK (`{ "type": "service_account", "project_id": "la-sucursal-del-cafe", "private_key": "-----BEGIN...", ... }`) | `py tools/deploy_firebase.py` o `npx firebase-tools deploy --only hosting --project la-sucursal-del-cafe` con `GOOGLE_APPLICATION_CREDENTIALS=tools/credentials/firebase-hosting-sa.json` |
| 2 | **URL Apps Script** (formularios) | ✅ OK | [Apps Script del proyecto](https://script.google.com/home) → Implementar → Aplicación web | Secreto `SHEETS_WEB_APP_URL` = URL que termina en `/exec`. **Valor canónico actual:** ver `tools/CANONICAL_SHEETS_URL.txt` | `py tools/conectar_sheets.py --configurar-url "$(cat tools/CANONICAL_SHEETS_URL.txt)"` → genera `js/sheets-config.js` local; luego deploy manual Firebase |
| 3 | **Backend `Code.gs`** | ✅ Prod OK / ⚠️ CI | [Editor Apps Script](https://script.google.com/home) (desde la hoja → Extensiones → Apps Script) | Local `tools/.env`: `SHEETS_WEB_APP_URL`, `APPS_SCRIPT_ID` (ID del script, ej. `1AbC…` desde ⚙ del editor) | Pegar `tools/google-apps-script/Code.gs` a mano → Implementar → Nueva implementación → Web App → **Cualquier persona** → copiar `/exec` |
| 4 | **CI deploy Apps Script** | ⚠️ Pendiente | [GitHub Secrets](https://github.com/lasucursaldelcafe-droid/feria-cafe-inscripcion/settings/secrets/actions) | `OAUTH_SCRIPT_TOKEN` = **contenido completo** de `tools/credentials/.oauth-script-token.json` (generado tras OAuth). `APPS_SCRIPT_ID` = ID del proyecto. `SHEETS_WEB_APP_URL` = misma URL `/exec` | `py tools/setup_admin.py --sin-firebase` en tu PC (abre navegador OAuth) |
| 5 | **Google Sheets** (datos) | ✅ OK si ya existe hoja | [Google Sheets](https://sheets.google.com) o abrir hoja vinculada al script | `tools/.env` → `GOOGLE_SHEET_ID` = ID de la URL (`docs.google.com/spreadsheets/d/**ESTE_ID**/edit`) | Modo sin JSON: `py tools/modo_sin_json.py` — crea hoja manual + encabezados de `tools/PLANTILLA-ENCABEZADOS.json` |
| 6 | **Encabezados Sheets** | Manual tras cambios | Editor Apps Script → ejecutar `sincronizarEncabezados` | No hay secreto; función en `Code.gs` | Misma función manual en el editor tras pegar `Code.gs` nuevo |
| 7 | **Cuenta servicio Sheets** (opcional) | Opcional | [GCP IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=la-sucursal-del-cafe) | `GOOGLE_SERVICE_ACCOUNT_JSON` = ruta a `tools/credentials/feria-sheets-sa.json` | No necesaria si usas solo Apps Script (`modo_sin_json.py`) |
| 8 | **GitHub Actions — Hosting** | ✅ OK | [Actions → Deploy Firebase Hosting](https://github.com/lasucursaldelcafe-droid/feria-cafe-inscripcion/actions/workflows/deploy-firebase.yml) | Dispara con push a `main` (cambios html/css/js) o `gh workflow run "Deploy Firebase Hosting"` | `py tools/automatizar_manual.py --deploy` |
| 9 | **GitHub Actions — Actualizar todo** | Parcial | [Actions → Actualizar todo](https://github.com/lasucursaldelcafe-droid/feria-cafe-inscripcion/actions/workflows/update-all.yml) | Usa los mismos secretos; orquesta mantenimiento completo | `py tools/automatizar_google.py mantenimiento` |
| 10 | **Panel admin** `/admin` | ✅ API OK | https://la-sucursal-del-cafe.web.app/admin | `ALLOWED_ADMIN_EMAIL=lasucursaldelcafe@gmail.com` en `tools/.env` (referencia; panel hoy sin login Firebase) | No compartir URL; acceso solo equipo interno |
| 11 | **Pasaporte cafetero** | ✅ OK | https://la-sucursal-del-cafe.web.app/pasaporte | Depende de Apps Script (fila 2–3). Crear pasaportes desde Admin → Pasaportes | Escanear: https://la-sucursal-del-cafe.web.app/escanear-pasaporte |
| 12 | **Operadores escáner** | Config en admin | Admin → Operadores de confianza | PIN definido en panel; backend `pasaporte_operador_*` en `Code.gs` | Alta manual desde `/admin` |
| 13 | **Panel expositor** | ✅ Ruta OK | https://la-sucursal-del-cafe.web.app/expositor | Código de acceso generado en Admin → Stands al crear expositor (correo + código) | Crear stand desde admin si falta acceso |
| 14 | **Jurado V60** | ✅ OK | [Consola jurado](https://la-sucursal-del-cafe.web.app/jurado-v60) | PINs en config: organizador `v60organizador`, sensorial `v60sensorial` (editables en `/jurado/config`) | Guía: `tools/JURADO-V60-INSTRUCCIONES.md` |
| 15 | **Competidores habilitados** | Datos en Sheets | Admin → Competidores o hoja **Competencia** | Columnas **Habilitado** = Sí, **Evento** = slug del torneo | `sincronizarEncabezados()` si faltan columnas |
| 16 | **Google Wallet** | ⚠️ 404 | [Wallet Console](https://pay.google.com/business/console) | `GOOGLE_WALLET_ISSUER_ID=3388000000023162431` en CI y `tools/.env`. Invitar SA de Firebase como **Developer** en Wallet | `py tools/setup_google_wallet.py --auto` o `--sin-json --issuer-id 3388000000023162431` |
| 17 | **Wallet APIs GCP** | ⚠️ Si Wallet falla | [Wallet API](https://console.cloud.google.com/apis/library/wallet.googleapis.com?project=la-sucursal-del-cafe) + [IAM Credentials API](https://console.cloud.google.com/apis/library/iamcredentials.googleapis.com?project=la-sucursal-del-cafe) | Habilitar ambas APIs en proyecto `la-sucursal-del-cafe` | Ver `GOOGLE-WALLET-SETUP.md` |
| 18 | **Firestore rules** | ⚠️ Opcional | [Firebase Firestore](https://console.firebase.google.com/project/la-sucursal-del-cafe/firestore) | Rol IAM a la SA: **Firebase Rules Admin** o **Cloud Datastore Owner** | El sitio no depende de esto; pasaporte usa Sheets |
| 19 | **Analítica propia** | ✅ OK | Admin → Analíticas | Sin secreto; `pageview` → hoja **Analytics** vía Apps Script | — |
| 20 | **Marcas / patrocinadores inicio** | ✅ OK | Admin → Sitio web / Stands | URLs de logo en hoja **Stands** o assets en `assets/sponsors/` | `sincronizarEncabezados()` crea Purist y Palmetto demo |

---

## Secretos GitHub Actions — referencia exacta

Ir a: **https://github.com/lasucursaldelcafe-droid/feria-cafe-inscripcion/settings/secrets/actions**

| Nombre del secreto | ¿Obligatorio? | Qué pegar exactamente | Cómo obtenerlo |
|--------------------|---------------|----------------------|----------------|
| `FIREBASE_SERVICE_ACCOUNT` | **Sí** | Todo el JSON de una línea (desde `{` hasta `}`) | [Firebase → Project settings → Service accounts → Generate new private key](https://console.firebase.google.com/project/la-sucursal-del-cafe/settings/serviceaccounts/adminsdk) |
| `SHEETS_WEB_APP_URL` | Recomendado | Solo la URL, sin comillas: `https://script.google.com/macros/s/AKfycb…/exec` | Tras desplegar Web App, o copiar de `tools/CANONICAL_SHEETS_URL.txt` |
| `OAUTH_SCRIPT_TOKEN` | Solo CI Apps Script | Contenido íntegro del archivo `.oauth-script-token.json` | `py tools/setup_admin.py --sin-firebase` → autorizar Google → `py tools/setup_github_ci.py --apps-script` |
| `APPS_SCRIPT_ID` | Opcional (CI) | ID alfanumérico del proyecto Apps Script | Editor Apps Script → ⚙ Configuración del proyecto → ID del script |

### Comandos para subir secretos (tu PC)

```bash
gh auth login
gh secret set FIREBASE_SERVICE_ACCOUNT < tools/credentials/firebase-hosting-sa.json
gh secret set SHEETS_WEB_APP_URL --body "$(cat tools/CANONICAL_SHEETS_URL.txt)"
gh secret set OAUTH_SCRIPT_TOKEN < tools/credentials/.oauth-script-token.json
gh secret set APPS_SCRIPT_ID --body "TU_SCRIPT_ID"
```

O todo junto: `py tools/setup_github_ci.py --wait-sa --run-workflow`

---

## Variables `tools/.env` (local, gitignored)

Copiar plantilla: `cp tools/.env.example tools/.env`

| Variable | Ejemplo / valor | Para qué sirve |
|----------|-----------------|----------------|
| `GOOGLE_SHEET_ID` | `1a2b3c…` | ID de la hoja central (opcional si el script ya está vinculado) |
| `SHEETS_WEB_APP_URL` | Igual que `CANONICAL_SHEETS_URL.txt` | Formularios + admin + pasaporte |
| `APPS_SCRIPT_URL` | Misma URL que arriba | Alias usado por algunos scripts |
| `APPS_SCRIPT_ID` | `1BxYz…` | Deploy automático vía API |
| `ALLOWED_ADMIN_EMAIL` | `lasucursaldelcafe@gmail.com` | Referencia admin (futuro login) |
| `GOOGLE_WALLET_ISSUER_ID` | `3388000000023162431` | Emisor Google Wallet |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL` | `firebase-adminsdk-xxx@la-sucursal-del-cafe.iam.gserviceaccount.com` | Cuenta que firma passes |
| `FIREBASE_PROJECT` | `la-sucursal-del-cafe` | Deploy Hosting |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | `tools/credentials/firebase-hosting-sa.json` | Deploy local sin `gh` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | `tools/credentials/feria-sheets-sa.json` | Solo si usas `conectar_sheets.py --crear-hoja` |
| `SHARE_SHEET_WITH` | `lasucursaldelcafe@gmail.com` | Compartir hoja al crearla con SA |

---

## Archivos de credenciales en disco (nunca subir al repo)

| Archivo | Origen | Usado por |
|---------|--------|-----------|
| `tools/credentials/firebase-hosting-sa.json` | Firebase Console → Generate new private key | Deploy Hosting, Wallet, CI |
| `tools/credentials/feria-sheets-sa.json` | GCP Console (opcional) | `conectar_sheets.py` |
| `tools/credentials/.oauth-script-token.json` | `setup_admin.py` (OAuth navegador) | CI deploy `Code.gs` |
| `js/sheets-config.js` | Generado por CI o `conectar_sheets.py` | Todos los formularios en el navegador |

---

## Flujos por módulo — enlaces de ingreso

### Sitio público y formularios

| Módulo | URL producción | Configuración backend |
|--------|----------------|----------------------|
| Inicio | https://la-sucursal-del-cafe.web.app/ | — |
| Inscripción feria | https://la-sucursal-del-cafe.web.app/inscripcion | Apps Script + hoja **Feria** |
| V60 Championship | https://la-sucursal-del-cafe.web.app/competencia | Hoja **Competencia** |
| Stands / mapa | https://la-sucursal-del-cafe.web.app/stands | Hoja **Stands** |
| Marcas | https://la-sucursal-del-cafe.web.app/marcas | Admin → Sitio web |

### Pasaporte y fidelización

| Módulo | URL | Notas |
|--------|-----|-------|
| Pasaporte visitante | https://la-sucursal-del-cafe.web.app/pasaporte | QR por visitante |
| Escanear QR | https://la-sucursal-del-cafe.web.app/escanear-pasaporte | Operadores con PIN |
| Fidelización | https://la-sucursal-del-cafe.web.app/fidelizacion | Programa puntos |
| Mi tarjeta (Wallet) | https://la-sucursal-del-cafe.web.app/mi-tarjeta | ⚠️ Requiere fila 16–17 |
| Panel fidelización | https://la-sucursal-del-cafe.web.app/panel-fidelizacion | Interno |

### Jurado V60

| Rol | URL |
|-----|-----|
| Consola | https://la-sucursal-del-cafe.web.app/jurado-v60 |
| Configuración | https://la-sucursal-del-cafe.web.app/jurado/config?pin=v60organizador |
| Organizador (día del evento) | https://la-sucursal-del-cafe.web.app/jurado/organizador?pin=v60organizador |
| Juez N | `https://la-sucursal-del-cafe.web.app/jurado/juez?pin=v60sensorial&juez=1` |
| Resultados competidor | https://la-sucursal-del-cafe.web.app/jurado/resultados |

Informe visual jurado: https://la-sucursal-del-cafe.web.app/docs/informe-plataforma-jurado-v60.html

### Administración

| Panel | URL |
|-------|-----|
| Admin unificado | https://la-sucursal-del-cafe.web.app/admin |
| Expositor (marcas) | https://la-sucursal-del-cafe.web.app/expositor |

---

## Plan B — sin merge ni push a `main`

Cuando no puedas hacer push a `main` (permisos, conflictos, ventana de evento):

| Objetivo | Comando / acción | Resultado |
|----------|------------------|-----------|
| Publicar sitio | `py tools/deploy_firebase.py` con SA local | Hosting actualizado sin GitHub |
| Actualizar backend | Editor Apps Script → pegar `Code.gs` → Implementar | API `/exec` actualizada |
| Sincronizar URL en local | `py tools/conectar_sheets.py --configurar-url "URL/exec"` | `js/sheets-config.js` + deploy |
| Mantenimiento completo local | `py tools/automatizar_google.py mantenimiento` | Script + config + deploy + verify |
| Solo verificar | `py tools/verificar_todo.py` | Informe de qué falla |
| Relanzar CI (si tienes `gh`) | `gh workflow run "Deploy Firebase Hosting"` | Deploy desde GitHub sin push |
| Release agente | `python3 tools/agent_release.py deploy` | Pipeline Cloud Agent |
| Abrir todas las consolas | `py tools/automatizar_google.py urls` | Firebase, GCP, GitHub, Wallet |

---

## Checklist día del evento (operativo)

- [ ] `python3 tools/verificar_todo.py` → sin fallos críticos
- [ ] Formulario inscripción envía fila a Sheets (prueba real)
- [ ] Admin `/admin` carga KPIs y tablas
- [ ] Competidores V60 con **Habilitado = Sí** en hoja Competencia
- [ ] Organizador jurado abre `/jurado/organizador` con PIN correcto
- [ ] Cada juez tiene enlace `/jurado/juez?juez=N` probado en móvil
- [ ] Operadores pasaporte con PIN activo en Admin
- [ ] Expositores con código de acceso en `/expositor`
- [ ] (Opcional) Wallet: botón «Agregar a Google Wallet» en `/mi-tarjeta`

---

## Comandos de verificación rápida

```bash
python3 tools/validate_ci_secrets.py
python3 tools/verificar_todo.py
python3 tools/verify_admin.py
python3 tools/agent_release.py status
curl -s "https://script.google.com/macros/s/AKfycbyiLN6ms5dSbm6f1ZmZsR7ktqWLFGxGJd5zAnhZlmX3d0lpKFx1AhLXMXWfnF8txsp0/exec?action=health"
```

---

## Documentación relacionada

| Documento | Contenido |
|-----------|-----------|
| `CHECKLIST.md` | URLs del sitio + CI |
| `docs/PASOS-MANUALES-USUARIO.md` | Qué hace el agente vs tú |
| `tools/GOOGLE-ECOSISTEMA.md` | Arquitectura Sheets ↔ Apps Script ↔ Firebase |
| `tools/PLANTILLA-ENV.md` | Variables `.env` |
| `GITHUB-ACTIONS-SETUP.md` | Secretos CI detallados |
| `GOOGLE-WALLET-SETUP.md` | Wallet paso a paso |
| `tools/JURADO-V60-INSTRUCCIONES.md` | Operación torneo |
| `tools/INSTRUCCIONES-SHEETS.md` | Hoja + Apps Script manual |

---

*Generado para el equipo La Sucursal del Café. URL canónica Apps Script: `tools/CANONICAL_SHEETS_URL.txt`.*
