# Panel de administración y analíticas

Panel interno para **visitas al sitio** e **inscripciones** (feria + Switch Championship). No está enlazado desde la navegación pública.

## URL del panel

| Entorno | URL |
| ------- | --- |
| Producción | https://la-sucursal-del-cafe.web.app/admin |
| Directo | https://la-sucursal-del-cafe.web.app/admin.html |

## Modo actual: **panel abierto (sin login)**

Tras **3 intentos fallidos** de arreglar Google OAuth (`GeneralOAuthFlow`, `401 invalid_client`), el panel carga **directamente** sin inicio de sesión.

| Intento | Qué se hizo | Resultado |
| ------- | ----------- | --------- |
| 1 | `firebase apps:sdkconfig` + `deploy --only auth` + verificar `firebase-config.js` | Config correcta; OAuth client ausente en GCP |
| 2 | Redeploy auth + dominios autorizados en `firebase.json` | Google Sign-In habilitado en Firebase, pero client ID inválido |
| 3 | Diagnóstico con `py tools/check_oauth.py` | Confirma `invalid_client` — requiere clic manual en consola |

**Protección actual:** URL no publicada en el sitio + `noindex` + `X-Robots-Tag`. **No compartas `/admin`.**

### Volver a exigir login (Google)

1. [Firebase Console](https://console.firebase.google.com/project/la-sucursal-del-cafe/authentication/providers) → **Google** → **Habilitar** → Guardar.
2. [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=la-sucursal-del-cafe) → **Credentials** → debe existir un **OAuth 2.0 Client ID** tipo *Web client (auto created by Google Service)*.
3. Si falta: deshabilita y vuelve a habilitar Google en Firebase Authentication.
4. En Apps Script ejecuta `configurarAdminPublico(false)` y redeploy `Code.gs`.
5. Restaura login en `admin.html` / `admin-dashboard.js` (commit anterior con Firebase Auth).

## Qué muestra el panel

| Métrica | Descripción |
| ------- | ----------- |
| Visitas hoy / totales | Pageviews en hoja `Analytics` |
| Registros feria | Total en hoja `Feria` |
| Inscripciones Switch | Total en hoja `Competencia` |
| Lista de espera | Total en hoja `Lista de espera` |
| Cupo competencia | Confirmados vs máximo (36) |
| Conversión (aprox.) | Registros ÷ visitas a `/inscripcion` o `/competencia` hoy |
| Top páginas hoy | Rutas más visitadas |
| Tablas | Últimos 25 registros feria y competencia |

## Flujo técnico (sin login)

1. Abre `/admin`.
2. `admin-dashboard.js` llama `GET action=admin_dashboard` (sin token).
3. Apps Script permite lectura si `ALLOW_PUBLIC_ADMIN` ≠ `false` (por defecto **abierto**).
4. Si en el futuro hay token Firebase válido de `lasucursaldelcafe@gmail.com`, también funciona.

## Desplegar Apps Script

```powershell
cd D:\Desarrollo\02_Proyectos\Feria-Cafe-Inscripcion
py tools/setup_admin.py
```

O copia manualmente `tools/google-apps-script/Code.gs` → editor Apps Script → **Nueva implementación** Web App.

Propiedades útiles (editor Apps Script):

```javascript
configurarAdminPublico(true);   // panel sin token (actual)
configurarAdminPublico(false);  // exige Firebase ID token
configurarAdminEmail('lasucursaldelcafe@gmail.com');
```

## Desplegar hosting

```powershell
npx -y firebase-tools@latest deploy --only hosting --project la-sucursal-del-cafe
```

## Diagnóstico OAuth

```powershell
py tools/check_oauth.py
```

## Archivos del panel

| Archivo | Rol |
| ------- | --- |
| `admin.html` | Página del panel (`noindex`) |
| `css/admin.css` | Estilos + aviso de panel abierto |
| `js/admin-dashboard.js` | Carga directa del dashboard |
| `js/sheets-config.js` | URL Apps Script |
| `js/firebase-config.js` | Reservado si se reactiva Google Auth |
| `tools/check_oauth.py` | Valida config OAuth/Firebase |

## Seguridad

- `/admin` con `noindex` y `X-Robots-Tag: noindex`.
- **Datos sensibles** (correos, celulares, inscripciones) visibles sin autenticación mientras OAuth esté roto.
- Vista previa base64 de comprobantes omitida en el panel.
- Endpoint pageview público; dashboard abierto por `ALLOW_PUBLIC_ADMIN` (default).

## Troubleshooting OAuth (referencia)

| Error | Causa | Fix |
| ----- | ----- | --- |
| `invalid_client` / `GeneralOAuthFlow` | OAuth Web client no existe en GCP | Firebase Auth → Google → Enable; revisar Credentials en GCP |
| `auth/unauthorized-domain` | Dominio no autorizado | Authentication → Settings → Authorized domains |
| Popup bloqueado | Navegador | Usar `signInWithRedirect` (requiere OAuth OK) |
