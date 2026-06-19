# Google Sheets — Feria y Competencia

Conecta **index.html** (feria) y **competencia.html** (Switch Championship) con una hoja de cálculo centralizada.

## Un solo comando (recomendado)

Automatiza credenciales, hoja, Apps Script, configuración y (opcional) Firebase:

```powershell
cd D:\Desarrollo\02_Proyectos\Feria-Cafe-Inscripcion
py tools/automatizar_todo.py --todo
```

Equivalente PowerShell:

```powershell
.\tools\conectar_todo.ps1
```

Subcomandos:

| Comando | Descripción |
| ------- | ----------- |
| `--todo` | Pipeline completo (pasos 1–6) |
| `--solo-sheets` | Solo prerrequisitos + cuenta de servicio + hoja |
| `--solo-apps-script` | Solo Apps Script + `js/sheets-config.js` |
| `--verificar` | Comprueba GET/OPTIONS/POST contra la Web App |
| `--sin-firebase` | Omite despliegue Firebase en `--todo` |

El script escribe el log en `tools/automatizar.log`, busca JSON en Descargas, abre el navegador para OAuth cuando hace falta y actualiza `tools/.env` (nunca sube secretos al repo).

---

## Google Cloud ya creado (siguiente paso)

Si ya tienes el proyecto en [Google Cloud Console](https://console.cloud.google.com/), solo falta la **cuenta de servicio** y el JSON local.

### 1. Habilitar APIs (si aún no lo hiciste)

En tu proyecto GCP → **APIs y servicios** → **Biblioteca**:

- **Google Sheets API**
- **Google Drive API** (comprobantes de pago en Competencia)

### 2. Crear cuenta de servicio y descargar JSON

1. **IAM y administración** → **Cuentas de servicio** → **Crear cuenta de servicio**
2. Nombre sugerido: `feria-sheets` (rol no crítico para crear hojas; la API usa la cuenta directamente)
3. **Claves** → **Agregar clave** → **JSON** → descarga el archivo
4. Guárdalo **fuera del repositorio** en:

   ```
   D:\Desarrollo\02_Proyectos\Feria-Cafe-Inscripcion\tools\credentials\feria-sheets-sa.json
   ```

   (La carpeta `tools/credentials/` está en `.gitignore`.)

5. En `tools/.env` confirma:

   ```env
   GOOGLE_SERVICE_ACCOUNT_JSON=D:\Desarrollo\02_Proyectos\Feria-Cafe-Inscripcion\tools\credentials\feria-sheets-sa.json
   SHARE_SHEET_WITH=tu-gmail@gmail.com
   ```

   Usa tu **Gmail real** (no el correo `@users.noreply.github.com` de GitHub).

### 3. Crear la hoja y compartirla contigo

```powershell
cd D:\Desarrollo\02_Proyectos\Feria-Cafe-Inscripcion
py -3 -m pip install -r tools/requirements.txt
py tools/conectar_sheets.py --crear-hoja --share-with tu-gmail@gmail.com
```

El script crea **Switch Championship — Inscripciones** con pestañas **Feria** y **Competencia**, escribe encabezados y te muestra la URL de la hoja.

Alternativa automatizada (pipeline completo):

```powershell
py tools/automatizar_todo.py --todo
# o: .\tools\conectar_todo.ps1
```

### 4. Apps Script (obligatorio)

`js/sheets-config.js` debe tener `WEB_APP_URL` con la URL `/exec` de Apps Script. Hasta entonces los formularios solo guardan copia en `localStorage`.

**Manual (recomendado la primera vez):**

1. Abre la hoja compartida contigo → **Extensiones** → **Apps Script**
2. Pega `tools/google-apps-script/Code.gs`
3. **Implementar** → **Nueva implementación** → **Aplicación web**
   - Ejecutar como: **Yo**
   - Acceso: **Cualquier persona**
4. Copia la URL que termina en `/exec`

**Con clasp (opcional):** `npx -y @google/clasp login` y luego `py tools/desplegar_apps_script.py --sheet-id ID_DE_LA_HOJA`

### 5. Configurar URL y verificar

```powershell
py tools/conectar_sheets.py --configurar-url "https://script.google.com/macros/s/XXXXXXXX/exec"
py tools/conectar_sheets.py --verificar
py tools/conectar_sheets.py --probar-envio
```

---

## Flujo rápido (recomendado)

```powershell
cd D:\Desarrollo\02_Proyectos\Feria-Cafe-Inscripcion
py -3 -m pip install -r tools/requirements.txt
copy tools\.env.example tools\.env
# Edita tools\.env → GOOGLE_SERVICE_ACCOUNT_JSON y SHARE_SHEET_WITH

py tools/conectar_sheets.py --crear-hoja --share-with tu@gmail.com
```

**Manual (Apps Script):** abre la hoja → Extensiones → Apps Script → pega `tools/google-apps-script/Code.gs` → Implementar como **Aplicación web** (Ejecutar como: Yo | Acceso: Cualquier persona).

```powershell
py tools/conectar_sheets.py --configurar-url "https://script.google.com/macros/s/XXXXXXXX/exec"
py tools/conectar_sheets.py --verificar
py tools/conectar_sheets.py --probar-envio
```

Despliega el sitio (Firebase Hosting o servidor local) después de configurar la URL.

## Comandos de `conectar_sheets.py`


| Comando                        | Descripción                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `--crear-hoja`                 | Crea o actualiza la hoja con pestañas **Feria** y **Competencia** y todos los encabezados. |
| `--share-with email@gmail.com` | Comparte la hoja con tu cuenta de Google (editor).                                         |
| `--sheet-id ID`                | Usa una hoja existente en lugar de crear una nueva.                                        |
| `--configurar-url URL`         | Escribe `js/sheets-config.js` con la URL `/exec` de Apps Script.                           |
| `--verificar`                  | Comprueba la URL local, GET, OPTIONS y POST de prueba.                                     |
| `--probar-envio`               | Inserta filas de prueba `TEST-`* en ambas pestañas.                                        |
| `--dry-run`                    | Con `--crear-hoja`, muestra el plan sin llamar a Google.                                   |


Variables en `tools/.env` (opcional):

- `GOOGLE_SERVICE_ACCOUNT_JSON` — ruta al JSON de cuenta de servicio
- `GOOGLE_SHEET_ID` — ID de hoja existente
- `SHARE_SHEET_WITH` — correo para compartir
- `SHEETS_WEB_APP_URL` — URL de Apps Script (alternativa a `--configurar-url`)

## Cuenta de servicio de Google

1. [Google Cloud Console](https://console.cloud.google.com/) → habilita **Google Sheets API** y **Google Drive API**.
2. Crea una **cuenta de servicio** y descarga el JSON (guárdalo fuera del repo).
3. Anota el `client_email` del JSON.

La cuenta de servicio crea la hoja; **debes compartirla** con tu Gmail (`--share-with`) para abrirla y pegar Apps Script.

## Apps Script (`Code.gs`)

Archivo: `tools/google-apps-script/Code.gs`

- Recibe JSON con `formType`: `"feria"` o `"competencia"`.
- Escribe en la pestaña correspondiente del libro vinculado al script.
- Guarda comprobantes de pago en Drive (`Switch Championship — Comprobantes`) y registra el enlace.

Tras actualizar `Code.gs`, vuelve a **Implementar → Nueva implementación** en Apps Script.

## Configuración del sitio web

El script genera `js/sheets-config.js`:

```javascript
window.SHEETS_CONFIG = {
  WEB_APP_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec'
};
```

Si despliegas con Firebase Hosting, vuelve a desplegar tras cambiar la URL. En GitHub Actions puedes usar el secreto `SHEETS_WEB_APP_URL`.

## Respaldo local

Si `WEB_APP_URL` está vacía, los formularios guardan copia en `localStorage` del navegador. No reemplaza la hoja central.

## Columnas — pestaña Feria


| Columna        | Campo del formulario              |
| -------------- | --------------------------------- |
| Fecha registro | `fecha` (ISO)                     |
| ID             | `id` (ej. `F-…`)                  |
| Nombre         | `nombre`                          |
| Edad           | `edad`                            |
| Celular        | `celular`                         |
| Correo         | `correo`                          |
| Intereses      | `intereses` (lista unida con `;`) |


## Columnas — pestaña Competencia


| Columna                                               | Campo del formulario                   |
| ----------------------------------------------------- | -------------------------------------- |
| Fecha registro                                        | `fecha`                                |
| ID                                                    | `id` (ej. `SC-…`)                      |
| Evento                                                | `evento`                               |
| Valor inscripción                                     | `valorInscripcion`                     |
| Nombre, Documento, Edad, Ciudad, Celular, Correo      | datos personales                       |
| Representa, Rol                                       | perfil                                 |
| Experiencia café, Experiencia Switch, Torneos previos | selects / radios                       |
| Equipo Switch / gramera / tetera                      | `equipoPropio` → `Sí`/`No`             |
| Dirección envío … Instrucciones envío                 | `envio.*`                              |
| Método pago                                           | `metodoPago`                           |
| Referencia pago                                       | `comprobanteReferencia`                |
| Tiene comprobante                                     | `comprobanteArchivo.tieneComprobante`  |
| Comprobante nombre / tipo                             | archivo subido                         |
| Comprobante enlace Drive                              | URL en Drive (si se guardó)            |
| Comprobante base64 (preview)                          | primeros ~1000 caracteres del data URL |
| Acepta voluntaria … Acepta imagen                     | `aceptacionesLegales.*` → `Sí`/`No`    |
| Observaciones                                         | `observaciones`                        |


## Solución de problemas


| Problema                       | Solución                                                              |
| ------------------------------ | --------------------------------------------------------------------- |
| No llegan filas                | URL debe terminar en `/exec` y acceso «Cualquier persona».            |
| Error de permisos              | Reimplementa Apps Script y acepta permisos de hoja y Drive.           |
| Hoja vacía tras envío          | Apps Script → **Ejecuciones** → revisa errores.                       |
| CORS en consola del navegador  | Normal con `mode: 'no-cors'`; si la fila aparece en Sheets, funciona. |
| `--verificar` falla en OPTIONS | No crítico si GET y `--probar-envio` funcionan.                       |


## Scripts relacionados

- `tools/automatizar_todo.py` — orquestador completo (un comando)
- `tools/conectar_todo.ps1` — wrapper PowerShell → `automatizar_todo.py --todo`
- `tools/conectar_sheets.py` — CLI granular (crear hoja, verificar, probar)
- `tools/desplegar_apps_script.py` — despliegue con clasp
- `tools/setup_google_sheets.py` — bajo nivel (usado por `setup.py --sheets-only`)
- `js/form-submit.js` — envío desde los formularios HTML

