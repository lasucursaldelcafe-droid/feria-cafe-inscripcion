# Panel de administración y analíticas

Panel interno unificado para **administrar** inscripciones, stands, sitio web y Pasaporte Cafetero. La sección **Analíticas** es independiente (tráfico del sitio). No está enlazado desde la navegación pública. **No usa Google Analytics ni GA4.**

## Secciones del panel (`/admin`)

| Sección | Función |
| ------- | ------- |
| Resumen | KPIs y accesos rápidos |
| Analíticas | Tráfico, top páginas, export CSV |
| Competidores | Alta manual V60 + listado |
| Stands / ventas | Crear marca/stand + expositores/aliados/patrocinadores |
| Visitantes feria | Registro manual + opción crear pasaporte |
| Sitio web | Directorio `/marcas` y patrocinadores competencia |
| Pasaportes | Crear pasaporte + clientes recientes |
| Operadores de confianza | Usuarios PIN para escáner en stands |
| Competidores (V60) | Listado + **enlaces del jurado sensorial** |

## Jurado sensorial V60 (interno)

Panel en vivo para calificación del torneo. No enlazado desde el sitio público.

| Rol | URL |
|-----|-----|
| Organizador | https://la-sucursal-del-cafe.web.app/jurado-v60?pin=v60organizador |
| Juez 1–3 | `…/jurado-v60?pin=v60sensorial&juez=1` (2, 3) |

**Guía completa:** [`tools/JURADO-V60-INSTRUCCIONES.md`](JURADO-V60-INSTRUCCIONES.md) — dashboard, torneo por duelos, marca white-label y exportación del kit de inscripción.


| Entorno | URL |
| ------- | --- |
| Producción | https://la-sucursal-del-cafe.web.app/admin |
| Directo | https://la-sucursal-del-cafe.web.app/admin.html |

### Enlaces del sitio

| Recurso | URL |
| ------- | --- |
| Sitio público | https://la-sucursal-del-cafe.web.app/ |
| Inscripción feria | https://la-sucursal-del-cafe.web.app/inscripcion |
| V60 Championship | https://la-sucursal-del-cafe.web.app/competencia |
| Instagram | https://www.instagram.com/lasucursal.delcafe/ |
| WhatsApp | https://wa.me/573116699638 |
| Apps Script `/exec` | `js/sheets-config.js` → `WEB_APP_URL` |

## Un solo comando (mantenimiento)

```powershell
cd D:\Desarrollo\02_Proyectos\Feria-Cafe-Inscripcion
py tools/fix_all.py
```

Solo verificar (sin redeploy):

```powershell
py tools/fix_all.py --solo-verificar
py tools/verify_admin.py
```

## Analítica propia (sin GA4)

| Paso | Componente |
| ---- | ----------- |
| 1 | `js/site-chrome.js` carga `js/analytics-tracker.js` en páginas públicas |
| 2 | Cada visita hace `POST` a Apps Script con `action=pageview` |
| 3 | `Code.gs` escribe una fila en la hoja **Analytics** |
| 4 | `GET action=admin_dashboard` agrega visitas, top páginas e inscripciones |
| 5 | El panel muestra KPIs con etiqueta **Analítica propia (pageviews)** |

Columnas hoja Analytics: `Timestamp`, `Path`, `Titulo`, `Referrer`, `Session ID`, `User agent`.

## Qué muestra el panel

| Sección | Métricas |
| ------- | -------- |
| Tráfico del sitio | Visitas hoy/total, rutas únicas, top 10 hoy e histórico |
| Inscripciones | Feria, Switch, lista de espera, cupo, conversión aprox. |
| Tablas | Todos los inscritos (más recientes primero) |
| Export | CSV por hoja o **Descargar todo** |

## Herramientas Python

| Script | Función |
| ------ | ------- |
| `tools/fix_all.py` | Maestro: env, deploy Apps Script, Firebase, verificaciones |
| `tools/setup_admin.py` | Sube `Code.gs`, redeploy Web App, actualiza `sheets-config.js` |
| `tools/verify_admin.py` | Prueba `admin_dashboard`, `pageview` y `/admin` |
| `tools/deploy_firebase.py` | Hosting Firebase |
| `tools/_find_script_id.py` | Detecta `APPS_SCRIPT_ID` desde `GOOGLE_SHEET_ID` |

Credenciales: `tools/.env` y `tools/credentials/.oauth-script-token.json` (OAuth Apps Script, una vez).

### Si OAuth bloquea el deploy automático

1. Abre la hoja → Extensiones → Apps Script.
2. Pega `tools/google-apps-script/Code.gs`.
3. Implementar → Nueva implementación → Web App (Cualquier persona).
4. Copia la URL `/exec` en `js/sheets-config.js` o ejecuta `py tools/conectar_sheets.py --configurar-url "…"`.

## Modo actual: panel abierto (sin login)

Firebase Auth eliminado del panel (`401 invalid_client`). Al abrir `/admin` se cargan datos **sin popup de Google**.

**No compartas `/admin`.** Expone correos, celulares e inscripciones.

## Archivos clave

| Archivo | Rol |
| ------- | --- |
| `admin.html` | Panel dark, sin logos, `noindex` |
| `css/admin.css` | Tema oscuro |
| `js/admin-dashboard.js` | KPIs, tablas, export CSV |
| `js/analytics-tracker.js` | Pageviews → Apps Script |
| `js/site-chrome.js` | Carga tracker + WhatsApp + footer |
| `js/sheets-config.js` | URL Web App |
| `tools/google-apps-script/Code.gs` | Backend: pageview, admin_dashboard, export |

## Troubleshooting

| Síntoma | Causa | Fix |
| ------- | ----- | --- |
| Panel vacío | Apps Script viejo | `py tools/setup_admin.py` |
| `Apps Script desactualizado` | Falta `admin_dashboard` en deploy | Redeploy `Code.gs` |
| Stats en cero | Hoja Analytics vacía | Visita páginas públicas; verifica pageview con `py tools/verify_admin.py` |
| `formType inválido` en pageview | Deploy sin acción `pageview` | Redeploy |
| Popup Google en /admin | Caché antigua | Ctrl+Shift+R o incógnito |

Verificación rápida:

```powershell
py tools/verify_admin.py
```

Debe mostrar `[OK] admin_dashboard` y `[OK] Pageview POST OK.`

## Novedades para expositores (hoja «Novedades»)

El panel del expositor (`/mi-stand`) muestra actualizaciones desde la hoja **Novedades** del mismo Google Spreadsheet.

| Columna | Descripción |
| ------- | ----------- |
| Timestamp | Fecha/hora de publicación (ISO o fecha Sheets) |
| Titulo | Título breve |
| Cuerpo | Texto de la novedad |
| Audiencia | `todos` (visible en feed) o `expositores` (solo panel expositor) |

Para crear la hoja y encabezados, ejecuta **`sincronizarEncabezados`** una vez en el editor de Apps Script (o redeploy con `Code.gs` actualizado).

Los expositores ingresan con **correo + código de acceso** de 8 caracteres (generado al enviar solicitud de stand; hash guardado en columna «Código acceso (hash)» de la hoja Stands).

| Panel expositor | URL |
| --------------- | --- |
| Producción | https://la-sucursal-del-cafe.web.app/mi-stand |
| Alternativa | https://la-sucursal-del-cafe.web.app/expositor |
