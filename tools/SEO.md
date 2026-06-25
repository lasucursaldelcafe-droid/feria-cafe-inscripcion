# SEO y Google Search Console — La Sucursal del Café

Sitio en producción: **https://la-sucursal-del-cafe.web.app**

## Archivos SEO del proyecto

| Archivo | URL pública | Propósito |
|---------|-------------|-----------|
| `robots.txt` | `/robots.txt` | Permite indexar páginas públicas; bloquea `/admin` |
| `sitemap.xml` | `/sitemap.xml` | Lista URLs canónicas con `lastmod` |
| `js/seo-structured-data.js` | (en cada HTML) | JSON-LD Event / Organization / WebSite |
| Meta + canonical | En `<head>` de cada página | Títulos, descripciones y URL canónica |

Tras cambios en `sitemap.xml` o meta tags, vuelve a desplegar con Firebase Hosting.

## 1. Verificar propiedad en Google Search Console

1. Entra a [Google Search Console](https://search.google.com/search-console).
2. **Agregar propiedad** → elige **Prefijo de URL** e ingresa:
   `https://la-sucursal-del-cafe.web.app`
3. Método de verificación recomendado: **Etiqueta HTML** (meta tag en `index.html`) o **Archivo HTML** en la raíz del hosting.
4. Guarda la verificación; no subas credenciales ni tokens a este repositorio.

## 2. Enviar el sitemap

1. En Search Console → **Sitemaps**.
2. Añade: `sitemap.xml`
3. URL completa enviada: **https://la-sucursal-del-cafe.web.app/sitemap.xml**

Google también descubre el sitemap vía la línea `Sitemap:` en `robots.txt`.

## 3. URLs canónicas a monitorizar

| Página | URL canónica |
|--------|----------------|
| Inicio / feria | https://la-sucursal-del-cafe.web.app/ |
| El evento | https://la-sucursal-del-cafe.web.app/el-evento |
| Actividades | https://la-sucursal-del-cafe.web.app/actividades |
| Registro visitante | https://la-sucursal-del-cafe.web.app/inscripcion |
| V60 Championship | https://la-sucursal-del-cafe.web.app/competencia |
| Patrocinadores | https://la-sucursal-del-cafe.web.app/patrocinadores |
| Reglamento | https://la-sucursal-del-cafe.web.app/reglas |
| Cómo funciona | https://la-sucursal-del-cafe.web.app/como-funciona |
| QR inscripción | https://la-sucursal-del-cafe.web.app/qr |
| Privacidad | https://la-sucursal-del-cafe.web.app/privacidad |

**No indexar:** `/admin` (bloqueado en `robots.txt`, meta `noindex` y cabecera `X-Robots-Tag`).

## 4. Solicitar indexación (opcional)

Tras el primer despliegue SEO, en Search Console usa **Inspección de URLs** en la home y en `/competencia`, luego **Solicitar indexación**.

## 5. Google Business Profile (si aplica)

Si **La Sucursal del Café** o el venue (**Palmetto Plaza**, Cali) tienen perfil de negocio:

- Actualiza nombre, categoría (evento / café), fechas del festival (29–30 ago 2026) y enlace al sitio.
- Publica un post con enlace a `/inscripcion` antes del evento.
- No es obligatorio para posicionar el sitio, pero ayuda en búsquedas locales (“feria café Cali”).

## 6. Mantenimiento

- Al añadir páginas públicas: actualiza `sitemap.xml` y `lastmod`.
- Revisa **Cobertura** y **Experiencia** en Search Console cada 2–4 semanas.
- Consultas objetivo: *feria café Cali*, *La Sucursal del Café*, *café especial Cali agosto 2026*, *V60 Championship*.

## 7. Despliegue

```bash
npx firebase-tools deploy --only hosting
```

Comprueba en el navegador:

- https://la-sucursal-del-cafe.web.app/robots.txt
- https://la-sucursal-del-cafe.web.app/sitemap.xml
