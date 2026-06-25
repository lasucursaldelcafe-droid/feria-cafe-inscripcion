# Checklist — La Sucursal del Café

## Sitio en producción

| Página | URL local | URL Firebase |
|--------|-----------|--------------|
| Inicio | `index.html` | https://la-sucursal-del-cafe.web.app/ |
| El evento | `el-evento.html` | https://la-sucursal-del-cafe.web.app/el-evento |
| Actividades | `actividades.html` | https://la-sucursal-del-cafe.web.app/actividades |
| Patrocinadores | `patrocinadores.html` | https://la-sucursal-del-cafe.web.app/patrocinadores |
| Inscripción feria | `inscripcion.html` | https://la-sucursal-del-cafe.web.app/inscripcion |
| V60 Championship | `competencia.html` | https://la-sucursal-del-cafe.web.app/competencia |
| ¿Cómo funciona? | `como-funciona-evento.html` | https://la-sucursal-del-cafe.web.app/como-funciona |
| Reglamento | `reglas-v60-championship.html` | https://la-sucursal-del-cafe.web.app/reglas |
| Privacidad | `privacidad.html` | https://la-sucursal-del-cafe.web.app/privacidad |
| QR inscripción | `qr-inscripcion.html` | https://la-sucursal-del-cafe.web.app/qr |
| Alias festival | `festival.html` → inicio | https://la-sucursal-del-cafe.web.app/festival |
| Panel admin (interno) | `admin.html` | https://la-sucursal-del-cafe.web.app/admin |

Claves de ruta en `SiteLinks`: `festival`, `evento`, `actividades`, `patrocinadores`, `feria`, `competencia`, `privacidad`, `comoFunciona` (alias `como-funciona`), `reglas`, `reglasPdf`, `qr`, `admin`.

### Contacto y redes (desde `js/event-config.js`)

| Canal | Valor |
|-------|-------|
| Instagram | https://www.instagram.com/lasucursal.delcafe/ |
| WhatsApp | https://wa.me/573116699638 (+57 311 669 9638) |
| Correo | lasucursaldelcafe@gmail.com |

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

Push a `main` → despliegue automático vía `.github/workflows/deploy-firebase.yml`.

### Automatización (recomendado)

Tras cambiar `Code.gs`, actualizar secretos o desplegar:

```powershell
py tools/automatizar_manual.py --todo
```

Orquesta Apps Script, `sheets-config.js`, secretos GitHub, Firebase Hosting y `verify_admin.py`. Ver [`tools/PLANTILLA-ENV.md`](tools/PLANTILLA-ENV.md).

### Sincronizar secretos desde tu PC

Si el deploy falla con *FIREBASE_SERVICE_ACCOUNT no es JSON valido*, *Unexpected token 'e', "necesitamos"...* o *Failed to authenticate*:

```powershell
cd D:\Desarrollo\02_Proyectos\Feria-Cafe-Inscripcion
gh auth login
# 1) Firebase Console -> la-sucursal-del-cafe -> Service accounts -> Generate new private key
# 2) Guardar como tools\credentials\firebase-hosting-sa.json (gitignored)
py tools\validate_ci_secrets.py --print-commands
py tools\setup_github_ci.py
# equivalente PowerShell:
# .\tools\sync_github_secrets.ps1
gh workflow run "Deploy Firebase Hosting"
gh run list --workflow deploy-firebase.yml --limit 3
```

Diagnostico sin subir secretos: `py tools/validate_ci_secrets.py`

El script valida el JSON, sube `FIREBASE_SERVICE_ACCOUNT` (y `SHEETS_WEB_APP_URL` si esta en `tools/.env`) y sugiere relanzar el workflow.

### Configurar secretos en GitHub

1. Abre el repositorio en GitHub → **Settings** → **Secrets and variables** → **Actions**.
2. Pulsa **New repository secret** para cada secreto (no uses *Environment secrets* salvo que lo necesites).

| Secreto | Obligatorio | Uso |
|---------|-------------|-----|
| `FIREBASE_SERVICE_ACCOUNT` | Sí | JSON completo de la cuenta de servicio para publicar en Firebase Hosting |
| `SHEETS_WEB_APP_URL` | No | URL `/exec` de Apps Script; el workflow genera `js/sheets-config.js` en cada deploy |

**No versionar** `js/sheets-config.js` ni pegar el JSON de Firebase en el código ni en el chat.

#### `FIREBASE_SERVICE_ACCOUNT` (cuenta de servicio)

1. [Firebase Console](https://console.firebase.google.com/) → proyecto **la-sucursal-del-cafe**.
2. ⚙️ **Project settings** → pestaña **Service accounts**.
3. **Generate new private key** → descarga un archivo `.json` (guárdalo solo en tu PC, p. ej. `D:\Desarrollo\02_Proyectos\Feria-Cafe-Inscripcion\tools\credentials\` — esa carpeta está en `.gitignore`).
4. En GitHub → **New repository secret**:
   - **Name:** `FIREBASE_SERVICE_ACCOUNT`
   - **Secret:** abre el `.json` con un editor de texto, selecciona **todo** el contenido (desde `{` hasta `}`) y pégalo. Debe ser un JSON válido en una sola pieza, sin comillas extra ni saltos inventados.
5. La cuenta debe tener permiso para Hosting (rol **Firebase Hosting Admin** en IAM de Google Cloud, o cuenta generada desde Firebase con acceso de deploy).

Comprobar: tras un push a `main`, en **Actions** el job *Deploy Firebase Hosting* debe terminar en verde.

#### `SHEETS_WEB_APP_URL` (formularios en producción)

1. Sigue [`tools/INSTRUCCIONES-SHEETS.md`](tools/INSTRUCCIONES-SHEETS.md) y despliega `Code.gs` como **Aplicación web** (acceso: cualquier persona).
2. Copia la URL que termina en `/exec` (ejemplo: `https://script.google.com/macros/s/AKfycb…/exec`).
3. En GitHub → **New repository secret**:
   - **Name:** `SHEETS_WEB_APP_URL`
   - **Secret:** pega solo la URL (sin comillas ni espacios al final).
4. Si omites este secreto, el deploy igual publica el sitio pero los formularios usan modo local (`localStorage`) hasta que lo configures.

**Local vs CI:** en tu máquina sigue usando `js/sheets-config.js` (desde `js/sheets-config.example.js`). En GitHub Actions el workflow **sobrescribe** ese archivo en el runner; no hace falta subirlo al repo.

## Verificación rápida

- [ ] Nav hamburger funciona en móvil
- [ ] Cada página muestra título claro arriba
- [ ] Enlaces del menú funcionan (local y producción)
- [ ] Modal de bienvenida en inicio (`index.html`)
- [ ] QR apunta a `/inscripcion` y `/competencia`
- [ ] Inscripción feria envía a Sheets (o modo local si falta URL)
- [ ] Competencia envía a Sheets y consulta cupo
- [ ] Patrocinadores: Purist, Palmetto Plaza, Ghost, Medium Café, Elixir, Black Coffee (sin Pulpo ni Comandante ni Prisma)
- [ ] Rutas Firebase sin 404: `/`, `/el-evento`, `/actividades`, `/patrocinadores`, `/inscripcion`, `/competencia`, `/como-funciona`, `/reglas`, `/privacidad`, `/qr`, `/festival`
