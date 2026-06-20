# Panel de administración y analíticas

Panel interno para **visitas al sitio** e **inscripciones** (feria + Switch Championship). No está enlazado desde la navegación pública.

## URL del panel

| Entorno | URL |
| ------- | --- |
| Producción | https://la-sucursal-del-cafe.web.app/admin |
| Directo | https://la-sucursal-del-cafe.web.app/admin.html |

## Qué muestra el panel

| Métrica | Descripción |
| ------- | ----------- |
| Visitas hoy / totales | Pageviews registrados en la hoja `Analytics` |
| Registros feria | Total en hoja `Feria` |
| Inscripciones Switch | Total en hoja `Competencia` |
| Lista de espera | Total en hoja `Lista de espera` |
| Cupo competencia | Confirmados vs máximo (36) |
| Conversión (aprox.) | Registros ÷ visitas a `/inscripcion` o `/competencia` hoy |
| Top páginas hoy | Rutas más visitadas en el día |
| Tablas | Últimos 25 registros de feria y competencia |

## Flujo de login

1. Abre `/admin` en el navegador.
2. Ingresa usuario y contraseña en el formulario.
3. El cliente envía `POST action=admin_login` a la Web App de Apps Script.
4. El servidor valida contra **Propiedades del script** (`ADMIN_USER`, `ADMIN_PASS`).
5. Si es correcto, devuelve un **token de sesión** (8 h) guardado en `sessionStorage`.
6. El panel carga datos con `GET action=admin_dashboard&token=...`.

La contraseña **nunca** está en HTML, JS ni en este repositorio.

## Configurar credenciales (Apps Script)

**Opción A — Propiedades del script (recomendada)**

1. Abre el proyecto de Apps Script vinculado a tu hoja de inscripciones.
2. **Configuración del proyecto** (⚙) → **Propiedades del script** → **Editar propiedades**.
3. Añade:

| Propiedad | Valor |
| --------- | ----- |
| `ADMIN_USER` | `Adminsucursaldelcafe` |
| `ADMIN_PASS` | Tu contraseña segura (no la pegues en git) |

**Opción B — Función en el editor**

Ejecuta una sola vez desde el editor (no commitear la contraseña):

```javascript
configurarCredencialesAdmin('Adminsucursaldelcafe', 'TU_CONTRASEÑA_SEGURA');
```

Esto guarda `ADMIN_USER` y `ADMIN_PASS` en Propiedades del script.

### Cambiar contraseña

Si compartiste la contraseña en chat, correo o ticket, **cámbiala de inmediato** con la opción A o B y no reutilices esa contraseña en otros servicios.

## Desplegar Apps Script (obligatorio tras actualizar Code.gs)

1. Copia `tools/google-apps-script/Code.gs` al editor de Apps Script.
2. Ejecuta **una vez** `sincronizarEncabezados()` (crea la hoja `Analytics`).
3. Configura credenciales (ver arriba).
4. **Implementar** → **Nueva implementación** → tipo **Aplicación web**.
5. Ejecutar como: **Yo** · Acceso: **Cualquier persona**.
6. Copia la URL `/exec` y actualiza:
   - Local: `js/sheets-config.js`
   - CI: secreto GitHub `SHEETS_WEB_APP_URL`

## Desplegar el sitio (Firebase)

```powershell
cd D:\Desarrollo\02_Proyectos\Feria-Cafe-Inscripcion
npx -y firebase-tools@latest deploy --only hosting --project la-sucursal-del-cafe
```

O push a `main` para el workflow de GitHub Actions.

## Archivos del panel

| Archivo | Rol |
| ------- | --- |
| `admin.html` | Página del panel (`noindex`) |
| `css/admin.css` | Estilos del panel |
| `js/admin-dashboard.js` | Login, sesión y tablas |
| `js/analytics-tracker.js` | Pageviews en páginas públicas |
| `js/site-chrome.js` | Carga automática del tracker |

## Hoja Analytics

Columnas: `Timestamp`, `Path`, `Titulo`, `Referrer`, `Session ID`, `User agent`.

## Seguridad

- Rutas `/admin` con `noindex` y `X-Robots-Tag: noindex`.
- Sesiones admin en `CacheService` (Apps Script).
- Vista previa de comprobantes en base64 omitida en el panel.
- El endpoint de pageview es público; el dashboard exige token válido.
