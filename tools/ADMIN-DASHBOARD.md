# Panel de administración y analíticas



Panel interno para **visitas al sitio** e **inscripciones** (feria + Switch Championship). No está enlazado desde la navegación pública.



## URL del panel



| Entorno | URL |

| ------- | --- |

| Producción | https://la-sucursal-del-cafe.web.app/admin |

| Directo | https://la-sucursal-del-cafe.web.app/admin.html |



## Diagnóstico (2026-06-21)

| Síntoma | Causa | Fix |
| ------- | ----- | --- |
| Panel vacío / botón Google no carga datos | Cliente exigía Firebase Auth (OAuth roto) | Modo **sin login** en `admin-dashboard.js` |
| `admin_dashboard` devuelve solo `{message, forms}` | **Code.gs no desplegado** en Apps Script | `py tools/setup_admin.py` (OAuth una vez) |
| Analytics sin visitas | `pageview` POST devuelve `formType inválido` | Mismo redeploy de `Code.gs` |
| Export CSV falla | `admin_export` no existe en deploy viejo | Redeploy + botones en panel |

Verificación rápida:

```powershell
py -c "import urllib.request,json; u='https://script.google.com/macros/s/AKfycbxZWXGgnYy76cMQFTpixZPkZvS9VZRdJD_9VQRRdwQ9R-KZTB6rmTWn9W64ZNjX3PkE/exec?action=admin_dashboard'; d=json.loads(urllib.request.urlopen(u,timeout=60).read()); print('stats' in d, d.get('error', d.get('message')))"
```

Debe imprimir `True` y stats. Si imprime `False` y mensaje genérico → redeploy Apps Script.

## Modo actual: **panel abierto (sin login)**



Google OAuth / Firebase Auth **eliminado del panel** tras errores repetidos (`401 invalid_client`, `GeneralOAuthFlow`). Al abrir `/admin` se cargan estadísticas e inscripciones **sin popup ni botón de Google**.



### Seguridad



| Medida | Estado |

| ------ | ------ |

| URL no publicada en el sitio | Sí |

| `noindex` + `X-Robots-Tag` | Sí |

| Autenticación | **No** (temporal) |

| Datos expuestos | Correos, celulares, inscripciones |



**No compartas `/admin`.** Cuando OAuth esté reparado en GCP, se puede volver a exigir login (ver sección al final).



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

| Tablas | Todos los inscritos feria y Switch (más recientes primero) |

| Descargas CSV | Por hoja o **Descargar todo** |



## Exportar CSV



| Botón | Endpoint / origen |

| ----- | ----------------- |

| Descargar CSV (feria) | `GET action=admin_export&dataset=feria` o cache local |

| Descargar CSV (competencia) | `dataset=competencia` |

| Descargar CSV (analytics) | `dataset=analytics` |

| Descargar todo (CSV) | `dataset=all` → 4 archivos |



Tras editar `Code.gs`, redeploy con `py tools/setup_admin.py`.



## Flujo técnico (sin login)



1. Abre `/admin` → carga automática del dashboard.

2. `admin-dashboard.js` llama `GET action=admin_dashboard` (sin token).

3. Apps Script permite lectura sin token (`assertAdminAccess_` acepta peticiones vacías).

4. Export CSV usa el mismo acceso público.



## Desplegar Apps Script



```powershell

cd D:\Desarrollo\02_Proyectos\Feria-Cafe-Inscripcion

py tools/setup_admin.py

```



Propiedades útiles (editor Apps Script):



```javascript

configurarAdminPublico(true);   // legacy — ya no bloquea sin token

configurarAdminEmail('lasucursaldelcafe@gmail.com');

```



## Desplegar hosting



```powershell

npx -y firebase-tools@latest deploy --only hosting --project la-sucursal-del-cafe

```



## Archivos del panel



| Archivo | Rol |

| ------- | --- |

| `admin.html` | Página del panel (`noindex`, tema oscuro, sin logos) |

| `css/admin.css` | Estilos dark mode |

| `js/admin-dashboard.js` | Carga directa del dashboard (sin Firebase Auth) |

| `js/sheets-config.js` | URL Apps Script |

| `tools/google-apps-script/Code.gs` | Backend: stats + export |



## Volver a exigir login (futuro)



1. Reparar OAuth en [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=la-sucursal-del-cafe) (Web client para Firebase Auth).

2. Restaurar Firebase Auth en `admin.html` / `admin-dashboard.js`.

3. Endurecer `assertAdminAccess_` en `Code.gs` para rechazar peticiones sin token.



## Troubleshooting OAuth (3 intentos fallidos)

| # | Acción | Resultado |
| - | ------ | --------- |
| 1 | `firebase apps:sdkconfig` + `deploy --only auth` + verificar `js/firebase-config.js` | Config OK; cliente OAuth ausente en GCP |
| 2 | Redeploy auth + dominios en `firebase.json` | Google habilitado en Firebase; `invalid_client` persiste |
| 3 | `py tools/check_oauth.py` | Confirma error OAuth — requiere consola manual |

**Causa raíz:** `401 invalid_client` / `GeneralOAuthFlow` — el **OAuth 2.0 Web client** de Firebase Auth no existe o está roto en [Google Cloud Credentials](https://console.cloud.google.com/apis/credentials?project=la-sucursal-del-cafe).

**Reparar (una vez en navegador):** Firebase Console → Authentication → Sign-in method → **Google** → Enable → Save. Si sigue fallando: deshabilitar y volver a habilitar Google.

```powershell
py tools/check_oauth.py
```

## Troubleshooting panel



| Síntoma | Causa probable | Fix |

| ------- | -------------- | --- |

| Popup Google / `invalid_client` | Caché de versión antigua con login | Hard refresh (Ctrl+Shift+R) o abrir en incógnito |

| `No autorizado` en panel | Apps Script desactualizado | `py tools/setup_admin.py` |

| `Apps Script desactualizado` | Falta `action=admin_dashboard` en deploy | Redeploy `Code.gs` |

| Stats en cero | Hoja Analytics vacía | Visitas públicas registran vía `analytics-tracker.js` |

