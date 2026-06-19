# Google Sheets como base de datos — Instrucciones

Esta guía conecta los formularios web con una hoja de cálculo para revisar todas las inscripciones.

## 1. Crear la hoja de cálculo

1. Entra a [Google Sheets](https://sheets.google.com) con la cuenta de **La Sucursal del Café**.
2. Crea una hoja nueva, por ejemplo: **Inscripciones Feria y Switch Championship**.
3. Renombra la primera pestaña a **Feria** (opcional: el script también crea las pestañas si no existen).
4. Crea una segunda pestaña llamada **Competencia** (opcional).

> Las columnas se crean automáticamente al recibir la primera inscripción de cada tipo.

## 2. Pegar el script de Apps Script

1. En la hoja: **Extensiones → Apps Script**.
2. Borra el contenido del editor y pega el código de `tools/google-apps-script/Code.gs` de este repositorio.
3. Guarda el proyecto (Ctrl+S) con un nombre, por ejemplo: **Inscripciones Web Feria**.

## 3. Desplegar como aplicación web

1. En Apps Script: **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Configuración:
   - **Descripción:** Inscripciones web
   - **Ejecutar como:** Yo (tu cuenta)
   - **Quién tiene acceso:** Cualquier persona
4. Haz clic en **Implementar** y autoriza los permisos cuando Google lo solicite.
5. Copia la **URL de la aplicación web** (termina en `/exec`).

## 4. Configurar el sitio web

1. En tu copia del proyecto, copia el archivo de ejemplo:
   ```bash
   cp js/sheets-config.example.js js/sheets-config.js
   ```
2. Abre `js/sheets-config.js` y pega la URL en `WEB_APP_URL`:
   ```javascript
   window.SHEETS_CONFIG = {
     WEB_APP_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec'
   };
   ```
3. Si despliegas en Firebase Hosting, vuelve a desplegar después de cambiar la URL:
   ```bash
   npx -y firebase-tools@latest deploy --only hosting
   ```

### Despliegue automático (GitHub Actions)

Si usas el workflow de GitHub, agrega un secreto en el repositorio:

- **Nombre:** `SHEETS_WEB_APP_URL`
- **Valor:** la URL `/exec` de Apps Script

El workflow generará `js/sheets-config.js` en cada despliegue.

## 5. Probar

1. Abre el sitio (local o Firebase Hosting).
2. Envía una inscripción de prueba en **index.html** (feria).
3. Envía otra en **competencia.html**.
4. Revisa las pestañas **Feria** y **Competencia** en la hoja: debe aparecer una fila nueva en cada una.

## Respaldo local (localStorage)

Si `WEB_APP_URL` está vacío o falla la red, los formularios siguen guardando una copia en el navegador (`localStorage`). Eso **no** reemplaza la hoja: solo sirve como respaldo temporal en ese dispositivo.

## Columnas registradas

### Pestaña Feria

| Columna | Descripción |
|---------|-------------|
| Fecha registro | ISO timestamp |
| ID | Identificador único |
| Nombre | Nombre completo |
| Edad | Edad |
| Celular | Teléfono |
| Correo | Email |
| Intereses | Lista separada por `;` |

### Pestaña Competencia

| Columna | Descripción |
|---------|-------------|
| Fecha registro | ISO timestamp |
| ID | Identificador único (ej. `SC-…`) |
| Evento | Nombre del torneo |
| Valor inscripción | Monto en COP |
| Nombre, Documento, Edad, Ciudad, Celular, Correo | Datos personales |
| Representa, Rol, Experiencia café, Experiencia Switch, Torneos previos | Perfil profesional |
| Equipo Switch / gramera / tetera | Confirmación de equipo propio (`Sí`/`No`) |
| Dirección envío … Instrucciones envío | Logística del café de práctica |
| Método pago | Forma de pago elegida |
| Referencia pago | Texto opcional (últimos dígitos, ref. transferencia) |
| Tiene comprobante | `Sí` / `No` |
| Comprobante nombre | Nombre del archivo subido |
| Comprobante tipo | MIME (`image/jpeg`, `application/pdf`, etc.) |
| Comprobante enlace Drive | URL del archivo en Google Drive (si Apps Script pudo guardarlo) |
| Comprobante base64 (preview) | Primeros ~1000 caracteres del data URL (respaldo si Drive falla) |
| Observaciones | Notas del participante |

> **Comprobante de pago:** el formulario envía el archivo como data URL en JSON. Apps Script intenta guardarlo en la carpeta de Drive `Switch Championship — Comprobantes` y registra el enlace en la hoja. Vuelve a **Implementar** el script tras actualizar `Code.gs`.

Si ya tenías una hoja **Competencia** con la columna antigua `Comprobante`, puedes renombrarla a `Referencia pago` y agregar manualmente las columnas nuevas, o dejar que el script las cree en hojas nuevas.

## Solución de problemas

| Problema | Solución |
|----------|----------|
| No llegan filas | Verifica que la URL termine en `/exec` y que el acceso sea "Cualquier persona". |
| Error de permisos | Vuelve a implementar el script y acepta permisos de la hoja. |
| Formulario envía pero hoja vacía | Abre Apps Script → **Ejecuciones** y revisa errores recientes. |
| CORS en consola | Es normal con `mode: 'no-cors'`; si la fila aparece en Sheets, funciona. |
