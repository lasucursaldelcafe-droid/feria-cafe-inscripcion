# Automatización con Python — Feria-Cafe-Inscripcion

Scripts en `tools/` para configurar **Google Sheets** y desplegar **Firebase Hosting** desde Windows (PowerShell).

## Requisitos

| Herramienta | Versión | Notas |
|-------------|---------|-------|
| Python | 3.11+ | [python.org/downloads](https://www.python.org/downloads/) — marca «Add to PATH» |
| pip | incluido | `py -m pip install -r tools/requirements.txt` |
| Node.js | 18+ | Solo para Firebase: [nodejs.org](https://nodejs.org/) |

Si `python` no funciona en PowerShell, usa el launcher de Windows:

```powershell
py -3 --version
py -3 -m pip install -r tools/requirements.txt
```

## Instalación rápida

```powershell
cd D:\Desarrollo\02_Proyectos\Feria-Cafe-Inscripcion
py -3 -m pip install -r tools/requirements.txt
py tools/setup.py --init
copy tools\.env.example tools\.env
# Edita tools\.env con tus rutas y correos
```

## 1. Cuenta de servicio de Google (Sheets)

1. Entra a [Google Cloud Console](https://console.cloud.google.com/).
2. Crea o selecciona un proyecto (puede ser distinto al de Firebase).
3. **APIs y servicios → Biblioteca** → habilita:
   - Google Sheets API
   - Google Drive API
4. **APIs y servicios → Credenciales → Crear credenciales → Cuenta de servicio**.
5. Descarga el JSON y guárdalo **fuera del repositorio**, por ejemplo:
   `C:\secrets\feria-sheets-sa.json`
6. Anota el correo de la cuenta de servicio (`client_email` dentro del JSON).

### Configurar la hoja

```powershell
$env:GOOGLE_SERVICE_ACCOUNT_JSON = "C:\secrets\feria-sheets-sa.json"

py tools/setup_google_sheets.py `
  --share-with tu-correo@gmail.com
```

Opciones útiles:

```powershell
# Usar hoja existente
py tools/setup_google_sheets.py --sheet-id 1AbC... --credentials C:\secrets\sa.json

# Escribir js/sheets-config.js con la URL de Apps Script
py tools/setup_google_sheets.py `
  --share-with tu-correo@gmail.com `
  --web-app-url "https://script.google.com/macros/s/XXXX/exec"
```

El script crea la hoja **V60 Championship — Inscripciones** con pestañas **Feria** y **Competencia** y los encabezados que usa `tools/google-apps-script/Code.gs`.

### Apps Script (paso manual obligatorio)

Python **no puede** desplegar Apps Script de forma fiable sin herramientas extra (`clasp`). Después del script:

1. Abre la URL de la hoja que imprime el script.
2. **Extensiones → Apps Script**.
3. Pega `tools/google-apps-script/Code.gs`.
4. **Implementar → Nueva implementación → Aplicación web**
   - Ejecutar como: **Yo**
   - Acceso: **Cualquier persona**
5. Copia la URL `/exec` y ejecuta de nuevo con `--web-app-url` o edita `js/sheets-config.js`.

## 2. Firebase Hosting

Proyecto configurado: `la-sucursal-del-cafe` (ver `.firebaserc`). **No uses credenciales de Viajes Peludos.**

Guía paso a paso para crear el proyecto: `tools/CONFIGURAR-FIREBASE-NUEVO.md`

### Opción A — Sesión local (desarrollo)

```powershell
npx -y firebase-tools@latest login
py tools/deploy_firebase.py
```

### Opción B — Token CI (GitHub Actions o scripts)

```powershell
npx -y firebase-tools@latest login:ci
# Copia el token mostrado

py tools/deploy_firebase.py --token "1//0g..."
```

También puedes definir `$env:FIREBASE_TOKEN`.

### Opción C — Cuenta de servicio

1. En Firebase Console → **Configuración del proyecto → Cuentas de servicio**.
2. Genera una clave JSON con permisos de **Firebase Hosting Admin** (o usa la misma SA del workflow de GitHub).
3. Ejecuta:

```powershell
py tools/deploy_firebase.py --service-account C:\secrets\firebase-sa.json
```

## 3. Orquestador (todo en uno)

```powershell
# Solo generar plantilla .env
py tools/setup.py --init

# Google Sheets
py tools/setup.py --sheets-only --share-with tu@gmail.com

# Firebase
py tools/setup.py --firebase-only --token TU_TOKEN

# Secuencia completa (Sheets → Firebase)
py tools/setup.py --all --share-with tu@gmail.com
```

Variables en `tools/.env` (copia desde `.env.example`):

| Variable | Uso |
|----------|-----|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Ruta al JSON de Sheets |
| `GOOGLE_SHEET_ID` | ID opcional de hoja existente |
| `SHARE_SHEET_WITH` | Correo editor de la hoja |
| `SHEETS_WEB_APP_URL` | URL `/exec` de Apps Script |
| `FIREBASE_PROJECT` | `la-sucursal-del-cafe` |
| `FIREBASE_TOKEN` | Token de `firebase login:ci` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON para deploy sin login |

## Solución de problemas

| Problema | Solución |
|----------|----------|
| `'python' no se reconoce` | Usa `py -3` en lugar de `python` |
| Error 403 Google API | Habilita Sheets API y Drive API en Cloud Console |
| Hoja no visible | Usa `--share-with` con tu correo de Google |
| Firebase pide login | Usa `--token` o `--service-account` |
| Formularios sin datos en Sheets | Falta desplegar Apps Script y configurar `WEB_APP_URL` |
| `js/sheets-config.js` no en git | Es normal (`.gitignore`); se genera localmente o en CI |

## Referencias

- Guía manual de Sheets: `tools/INSTRUCCIONES-SHEETS.md`
- Configurar Firebase dedicado: `tools/CONFIGURAR-FIREBASE-NUEVO.md`
- Workflow CI: `.github/workflows/deploy-firebase.yml`
- Repositorio: [lasucursaldelcafe-droid/feria-cafe-inscripcion](https://github.com/lasucursaldelcafe-droid/feria-cafe-inscripcion)
