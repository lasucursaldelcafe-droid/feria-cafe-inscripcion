# Feria Café — La Sucursal del Café

Sitio del festival de café especial: páginas informativas + formularios de inscripción (feria y V60 Championship). Datos en Google Sheets vía Apps Script. Hosting en Firebase.

## URLs publicadas

| Página | URL |
|--------|-----|
| Inicio | https://la-sucursal-del-cafe.web.app/ |
| El evento | https://la-sucursal-del-cafe.web.app/el-evento |
| Actividades | https://la-sucursal-del-cafe.web.app/actividades |
| Patrocinadores | https://la-sucursal-del-cafe.web.app/patrocinadores |
| Inscripción feria | https://la-sucursal-del-cafe.web.app/inscripcion |
| V60 Championship | https://la-sucursal-del-cafe.web.app/competencia |
| ¿Cómo funciona? | https://la-sucursal-del-cafe.web.app/como-funciona |
| Reglamento | https://la-sucursal-del-cafe.web.app/reglas |
| Privacidad | https://la-sucursal-del-cafe.web.app/privacidad |
| QR inscripción | https://la-sucursal-del-cafe.web.app/qr |
| Alias festival | https://la-sucursal-del-cafe.web.app/festival |
| Panel admin (interno) | https://la-sucursal-del-cafe.web.app/admin |
| Consola principal V60 (interno) | https://la-sucursal-del-cafe.web.app/jurado-v60 |
| Torneo en vivo (interno) | https://la-sucursal-del-cafe.web.app/jurado/organizador?pin=v60organizador |

### Contacto y redes

| Canal | URL |
|-------|-----|
| Instagram | https://www.instagram.com/lasucursal.delcafe/ |
| WhatsApp | https://wa.me/573116699638 |
| Correo | mailto:lasucursaldelcafe@gmail.com |
| Apps Script (formularios) | Ver `js/sheets-config.js` → `WEB_APP_URL` |

Checklist operativo: [`CHECKLIST.md`](CHECKLIST.md) · Panel admin: [`tools/ADMIN-DASHBOARD.md`](tools/ADMIN-DASHBOARD.md) · Jurado V60: [`tools/JURADO-V60-INSTRUCCIONES.md`](tools/JURADO-V60-INSTRUCCIONES.md)

## Estructura del sitio

- **`index.html`** — Landing del festival (hero, actividades, patrocinadores, CTAs).
- **`el-evento.html`**, **`actividades.html`**, **`patrocinadores.html`** — Subpáginas informativas.
- **`inscripcion.html`** — Formulario feria (gratis).
- **`competencia.html`** — V60 Championship ($90.000 COP, cupo 36).
- **`como-funciona-evento.html`**, **`reglas-v60-championship.html`**, **`privacidad.html`**, **`qr-inscripcion.html`** — Guía, reglamento, legal y QR.
- **`festival.html`** — Redirección al inicio (alias `/festival`).

## Formularios → Google Sheets

Guía completa: [`tools/INSTRUCCIONES-SHEETS.md`](tools/INSTRUCCIONES-SHEETS.md)

1. Crear hoja en Google Sheets.
2. Pegar `tools/google-apps-script/Code.gs` en Apps Script.
3. Desplegar como **Aplicación web** (acceso: cualquier persona).
4. Copiar la URL `/exec` en `js/sheets-config.js` (desde `js/sheets-config.example.js`).

Sin URL configurada, los formularios guardan copia local en `localStorage`.

## Desarrollo local

```bash
npx serve .
```

Abre la URL que indique el servidor (p. ej. http://localhost:3000).

## Firebase Hosting

Proyecto: **`la-sucursal-del-cafe`**

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use la-sucursal-del-cafe
npx -y firebase-tools@latest deploy --only hosting
```

### GitHub Actions

Push a `main` → `.github/workflows/deploy-firebase.yml` publica el sitio.

Configuración paso a paso de secretos (`FIREBASE_SERVICE_ACCOUNT`, `SHEETS_WEB_APP_URL`): ver sección **GitHub Actions (CI)** en [`CHECKLIST.md`](CHECKLIST.md). No subas `js/sheets-config.js` ni el JSON de la cuenta de servicio al repositorio.

## Herramientas Python (`tools/`)

Ver [`tools/INSTRUCCIONES-PYTHON.md`](tools/INSTRUCCIONES-PYTHON.md) para automatizar Sheets, Apps Script y Firebase.

**Ecosistema Google (entrada unificada):**

```bash
py tools/automatizar_google.py mantenimiento
```

Guía completa: [`tools/GOOGLE-ECOSISTEMA.md`](tools/GOOGLE-ECOSISTEMA.md).

## Estructura de archivos

```
├── index.html
├── el-evento.html
├── actividades.html
├── patrocinadores.html
├── inscripcion.html
├── competencia.html
├── como-funciona-evento.html
├── reglas-v60-championship.html
├── privacidad.html
├── qr-inscripcion.html
├── festival.html
├── css/brand.css
├── js/
│   ├── site-links.js       # Rutas local vs Firebase
│   ├── festival-nav.js     # Nav + contacto
│   ├── site-chrome.js      # Footer, OG, data-bind
│   ├── form-submit.js      # Envío a Sheets
│   └── sheets-config.js    # (local, no versionado)
├── tools/google-apps-script/Code.gs
├── firebase.json
└── .github/workflows/deploy-firebase.yml
```

## Licencia

Uso interno — La Sucursal del Café.
