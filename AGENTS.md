# AGENTS.md

Proyecto **Feria Café — La Sucursal del Café**: sitio web estático (HTML/CSS/JS vanilla en la raíz) servido por Firebase Hosting, con backend real en Google Apps Script. Existen además Firebase Functions (envío de email) y herramientas de automatización en Python (`tools/`).

Para tareas específicas, consulta los skills en `.cursor/skills/` (`feria-web-hosting`, `feria-apps-script-backend`, `web-performance-static`) y la documentación raíz (`README.md`, `CHECKLIST.md`).

## Cursor Cloud specific instructions

El update script ya instala dependencias al arrancar la VM: `npm install` en `functions/` y los paquetes de `tools/requirements.txt` (vía `pip install --break-system-packages --user`, en `~/.local`). No necesitas reinstalarlas.

### Servicios y cómo ejecutarlos

- **Sitio estático (producto principal).** No tiene build ni dependencias en la raíz. Sírvelo con cualquier servidor estático desde la raíz del repo, p. ej. `python3 -m http.server 3000` (o `npx serve .` como indica el `README.md`). Las páginas se abren por su `.html` (`/inscripcion.html`, `/competencia.html`, etc.); las URLs limpias (`/inscripcion`) solo existen en Firebase Hosting vía los `rewrites` de `firebase.json`, no en local. `js/site-links.js` detecta `localhost`/`127.0.0.1` y usa rutas `.html` automáticamente.

- **Modo local sin backend.** Sin `js/sheets-config.js` (gitignored) los formularios entran en "Modo local": `js/form-submit.js` guarda el envío en `localStorage` y muestra confirmación de éxito. Es el modo esperado en la VM; no hace falta configurar Apps Script para probar el flujo de inscripción.

- **Firebase Functions (`functions/`, opcional).** Servicio secundario de email disparado por Firestore; el backend de formularios real es Apps Script. El código usa la API v1 de `firebase-functions` (`functions.firestore.document(...)`) pero el `package.json` fija `firebase-functions@^7` (API v2), por lo que `require('./functions/index.js')` falla tal cual. No es un fallo de entorno; no lo "arregles" salvo que la tarea lo pida. El emulador de Firebase además requiere Java, que no está instalado por defecto.

- **Herramientas Python (`tools/`).** Automatizan Google Sheets/Apps Script/Firebase. Ejecútalas con `python3 tools/<script>.py` (las dependencias están instaladas a nivel de usuario en `~/.local`). La mayoría requiere credenciales/secretos de Google (cuenta de servicio en `tools/credentials/`, `tools/.env`) que NO están presentes; sin ellos solo funcionan `--help` y validaciones offline.

### Lint / test / build

No hay configuración de lint, ni suite de tests automatizados, ni paso de build para el sitio (es estático servido tal cual). El `test` de `functions/package.json` es un placeholder que falla a propósito. Verifica los cambios sirviendo el sitio y probando la página afectada en el navegador.
