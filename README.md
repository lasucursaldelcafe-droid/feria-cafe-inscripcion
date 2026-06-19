# Feria Café — Inscripciones en línea

Formularios web para **La Sucursal del Café**: asistencia a la feria y inscripción al **Switch Championship**. Diseño responsive, datos centralizados en Google Sheets y hosting en Firebase.

## URLs publicadas

| Recurso | URL |
|---------|-----|
| Formulario feria | `https://la-sucursal-del-cafe.web.app/` |
| Switch Championship | `https://la-sucursal-del-cafe.web.app/competencia.html` |
| Reglamento (PDF) | `https://la-sucursal-del-cafe.web.app/assets/reglas-switch-championship.pdf` |
| Reglamento (web) | `https://la-sucursal-del-cafe.web.app/reglas-switch-championship.html` |
| Repositorio GitHub | `https://github.com/lasucursaldelcafe-droid/feria-cafe-inscripcion` |

> Si el despliegue aún no se ha ejecutado, las URLs anteriores estarán disponibles tras `firebase deploy`.

## Formularios

- **`index.html`** — Inscripción general a la feria (nombre, edad, contacto, intereses).
- **`competencia.html`** — Switch Championship: perfil profesional, equipo, envío del café de práctica, pago y términos legales.
- **`reglas-switch-championship.html`** — Reglamento oficial (versión web).
- **`assets/reglas-switch-championship.pdf`** — Reglamento descargable (PDF).

## Base de datos (Google Sheets)

Las inscripciones se envían a una hoja de cálculo mediante Google Apps Script.

**Guía completa:** [`tools/INSTRUCCIONES-SHEETS.md`](tools/INSTRUCCIONES-SHEETS.md)

Resumen:

1. Crear hoja en Google Sheets.
2. Pegar `tools/google-apps-script/Code.gs` en Apps Script.
3. Desplegar como **Aplicación web** (acceso: cualquier persona).
4. Copiar la URL en `js/sheets-config.js` (desde `js/sheets-config.example.js`).

Sin URL configurada, los formularios guardan copia local en `localStorage` del navegador.

## Firebase Hosting

Proyecto Firebase: **`la-sucursal-del-cafe`** (dedicado a La Sucursal del Café; no compartido con Viajes Peludos).

Guía de configuración inicial: [`tools/CONFIGURAR-FIREBASE-NUEVO.md`](tools/CONFIGURAR-FIREBASE-NUEVO.md)

### Despliegue manual

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use la-sucursal-del-cafe
npx -y firebase-tools@latest deploy --only hosting
```

### Despliegue automático (GitHub Actions)

Al hacer push a `main`, el workflow `.github/workflows/deploy-firebase.yml` publica el sitio.

Secretos recomendados en GitHub:

| Secreto | Uso |
|---------|-----|
| `FIREBASE_SERVICE_ACCOUNT` | JSON de cuenta de servicio del proyecto **`la-sucursal-del-cafe`** con rol *Firebase Hosting Admin* |
| `SHEETS_WEB_APP_URL` | URL `/exec` de Apps Script (opcional) |

## Desarrollo local

Abre `index.html` o `competencia.html` en un servidor local (Live Server, `npx serve .`, etc.) para probar los scripts.

## Estructura

```
├── index.html              # Feria
├── competencia.html        # Switch Championship
├── reglas-switch-championship.html
├── js/
│   ├── form-submit.js      # Envío a Sheets + localStorage
│   ├── sheets-config.example.js
│   └── sheets-config.js    # (local, no versionado)
├── tools/
│   ├── google-apps-script/Code.gs
│   ├── CONFIGURAR-FIREBASE-NUEVO.md
│   └── INSTRUCCIONES-SHEETS.md
├── firebase.json
├── .firebaserc
└── .github/workflows/deploy-firebase.yml
```

## Licencia

Uso interno — La Sucursal del Café.
