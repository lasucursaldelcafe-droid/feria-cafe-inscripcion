# Plantilla `tools/.env`

Copia este archivo como **`tools/.env`** (está en `.gitignore`; no lo subas al repo).

```bash
copy tools\.env.example tools\.env
```

Completa los valores según tu entorno. Referencia completa en [`tools/.env.example`](.env.example).

## Comando único recomendado

Tras clonar el repo o antes de un release (Apps Script + Firebase + CI):

```powershell
py tools/automatizar_google.py mantenimiento
```

Ese comando, en orden:

1. Sincroniza y verifica `js/sheets-config.js`
2. Sube `Code.gs` y redeploy Web App (`setup_admin.py`)
3. Recuerda ejecutar `sincronizarEncabezados()` si cambiaste encabezados
4. Sincroniza secretos GitHub (`FIREBASE_SERVICE_ACCOUNT`, `SHEETS_WEB_APP_URL`)
5. Despliega Firebase Hosting
6. Ejecuta verificación completa (`verify_admin.py`)

## Pasos individuales

| Objetivo | Comando |
|----------|---------|
| Solo secretos CI | `py tools/automatizar_manual.py --ci` |
| Solo Apps Script | `py tools/automatizar_manual.py --apps-script` |
| Solo Firebase | `py tools/automatizar_manual.py --deploy` |
| Solo verificar | `py tools/automatizar_manual.py --verificar` |
| Abrir consolas | `py tools/automatizar_manual.py --abrir-urls` |
| CI + relanzar Actions | `py tools/setup_github_ci.py --wait-sa --run-workflow` |
| CI Apps Script | `py tools/setup_github_ci.py --apps-script` |
| Diagnosticar CI | `py tools/validate_ci_secrets.py` |
| Ecosistema Google (todos los modos) | `py tools/automatizar_google.py help` |

## Variables principales

| Variable | Uso |
|----------|-----|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Ruta al JSON de Sheets (local, `conectar_sheets.py`) |
| `GOOGLE_SHEET_ID` | ID de la hoja de inscripciones |
| `SHEETS_WEB_APP_URL` | URL `/exec` de Apps Script (CI + local) |
| `APPS_SCRIPT_ID` | ID del proyecto Apps Script |
| `FIREBASE_PROJECT` | `la-sucursal-del-cafe` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Opcional local; CI usa `tools/credentials/firebase-hosting-sa.json` |
| `ALLOWED_ADMIN_EMAIL` | Correo admin del panel |

## Credenciales en disco (no versionar)

| Archivo | Origen |
|---------|--------|
| `tools/credentials/feria-sheets-sa.json` | Google Cloud Console (Sheets API) |
| `tools/credentials/firebase-hosting-sa.json` | Firebase Console → Service accounts |
| `tools/credentials/.oauth-script-token.json` | Generado por `setup_admin.py` |

Ver [`credentials/README.md`](credentials/README.md) y [`CONFIGURAR-FIREBASE-NUEVO.md`](CONFIGURAR-FIREBASE-NUEVO.md).
