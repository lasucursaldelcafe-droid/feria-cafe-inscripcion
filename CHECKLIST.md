# Checklist — La Sucursal del Café

## Sitio en producción

| Página | URL local | URL Firebase |
|--------|-----------|--------------|
| Inicio | `index.html` | https://la-sucursal-del-cafe.web.app/ |
| El evento | `el-evento.html` | https://la-sucursal-del-cafe.web.app/el-evento |
| Actividades | `actividades.html` | https://la-sucursal-del-cafe.web.app/actividades |
| Patrocinadores | `patrocinadores.html` | https://la-sucursal-del-cafe.web.app/patrocinadores |
| Inscripción feria | `inscripcion.html` | https://la-sucursal-del-cafe.web.app/inscripcion |
| Switch Championship | `competencia.html` | https://la-sucursal-del-cafe.web.app/competencia |
| ¿Cómo funciona? | `como-funciona-evento.html` | https://la-sucursal-del-cafe.web.app/como-funciona |
| Reglamento | `reglas-switch-championship.html` | https://la-sucursal-del-cafe.web.app/reglas |
| Privacidad | `privacidad.html` | https://la-sucursal-del-cafe.web.app/privacidad |
| QR inscripción | `qr-inscripcion.html` | https://la-sucursal-del-cafe.web.app/qr |
| Alias festival | `festival.html` → inicio | https://la-sucursal-del-cafe.web.app/festival |

Enlaces internos usan `data-link` + `js/site-links.js` (`.html` en local, URLs limpias en producción).

## Correr en local

```bash
cd D:\Desarrollo\02_Proyectos\Feria-Cafe-Inscripcion
npx serve .
```

Abre http://localhost:3000 (o el puerto que indique `serve`).

## Formularios → Google Sheets

1. Sigue [`tools/INSTRUCCIONES-SHEETS.md`](tools/INSTRUCCIONES-SHEETS.md).
2. Despliega `tools/google-apps-script/Code.gs` como **Aplicación web** (acceso: cualquier persona).
3. Copia la URL `/exec` en `js/sheets-config.js`:

```js
window.SHEETS_CONFIG = {
  WEB_APP_URL: 'https://script.google.com/macros/s/TU_ID/exec'
};
```

O con Python:

```bash
py tools/conectar_sheets.py --configurar-url "https://script.google.com/macros/s/TU_ID/exec"
```

Sin URL configurada, los formularios guardan copia en `localStorage` del navegador.

## Desplegar a Firebase

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use la-sucursal-del-cafe
npx -y firebase-tools@latest deploy --only hosting
```

## GitHub Actions (CI)

Secretos en el repo:

| Secreto | Uso |
|---------|-----|
| `FIREBASE_SERVICE_ACCOUNT` | JSON cuenta de servicio con rol *Firebase Hosting Admin* |
| `SHEETS_WEB_APP_URL` | URL `/exec` de Apps Script (opcional; genera `js/sheets-config.js` en deploy) |

Push a `main` → despliegue automático vía `.github/workflows/deploy-firebase.yml`.

## Verificación rápida

- [ ] Nav hamburger funciona en móvil
- [ ] Cada página muestra título claro arriba
- [ ] Enlaces del menú funcionan (local y producción)
- [ ] Modal de bienvenida en inicio (`index.html`)
- [ ] QR apunta a `/inscripcion` y `/competencia`
- [ ] Inscripción feria envía a Sheets (o modo local si falta URL)
- [ ] Competencia envía a Sheets y consulta cupo
- [ ] Patrocinadores: Ghost, Medium Café, Elixir, Black Coffee, Prisma (sin Pulpo ni Comandante)
- [ ] Rutas Firebase sin 404: `/`, `/el-evento`, `/actividades`, `/patrocinadores`, `/inscripcion`, `/competencia`, `/como-funciona`, `/reglas`, `/privacidad`, `/qr`, `/festival`
