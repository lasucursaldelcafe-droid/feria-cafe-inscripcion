---
name: web-performance-static
description: >-
  Optimiza rendimiento de sitios estáticos Feria Café: lazy loading, cache headers
  en firebase.json, WebP/imágenes, JS mínimo deferido, fuentes preconnect, patrones
  brand.css, stands-map y sponsors. Usar al mejorar LCP/CLS, peso de página, carga
  de imágenes, cache o rendimiento móvil del sitio estático.
---

# Web Performance — Sitio estático Feria Café

Sitio sin bundler: HTML + `css/brand.css` + scripts vanilla. Objetivo: pocas peticiones bloqueantes, imágenes acotadas, cache predecible.

## Cache (firebase.json)

Ya configurado en `firebase.json`:

| Recurso | Cache-Control |
|---------|---------------|
| `**/*.css`, `**/*.html`, `**/*.js` | `public, max-age=300, must-revalidate` |
| `/admin**`, `/expositor**`, `/mi-stand**` | `no-store` |

Implicación: cambios en CSS/JS **requieren** query `?v=YYYYMMDDx` en cada HTML que los referencia. Tras editar `brand.css` o un `.js`, buscar referencias y bump versión.

Assets estáticos pesados (`/assets/**`) sin regla especial → cache CDN Firebase por defecto. Para logos/sponsors que cambian poco, preferir nombres versionados o sufijo en URL.

## Imágenes

### Formatos

- Sponsors: WebP en `assets/sponsors/` (ver `event-config.js` → `sponsors[].image`).
- Logos upload: JPEG/PNG/WebP (`accept` en formularios; `logoTypes` en config stands).
- Hero/marca: PNG/SVG; evaluar WebP + `<picture>` solo si el ahorro justifica el markup.

### Lazy load

Patrón del repo:

```html
<img src="..." alt="..." width="160" height="64" loading="lazy">
```

- Logo footer y avatares sponsors: `loading="lazy"`.
- Logo nav/header (LCP): **sin** lazy — mantener `width`/`height` explícitos contra CLS.
- Logos dinámicos en `stands-map.js`: `loading="lazy"` + `referrerpolicy="no-referrer"`.

### Mapa de stands (`js/stands-map.js`)

- Plano: candidatos en cascada (config → JPG → SVG placeholder → inline SVG).
- `decoding="async"`; quitar `loading` del plano principal (above-the-fold en `/stands`).
- Dimensiones fijas `800×500` en `<img>` del mapa.

## JavaScript mínimo

| Principio | Aplicación en repo |
|-----------|-------------------|
| Sin frameworks | No añadir React/Vue por defecto |
| Scripts al final de `<body>` | Orden: `event-config` → `sheets-config` (formularios) → feature → `site-chrome` |
| Carga condicional | `site-chrome.js` inyecta `analytics-tracker.js` solo en páginas públicas |
| Evitar duplicar config | Un solo `event-config.js`; datos en `EVENT_CONFIG` |

No marcar scripts críticos de layout como `async` si dependen de orden. Analytics puede cargarse tarde (patrón actual).

## CSS (`css/brand.css`)

- Variables en `:root` — reutilizar tokens (`--coffee-deep`, `--font-body`) antes de CSS nuevo suelto.
- Evitar `@import` en cadena; una hoja `brand.css` + hojas de página (`admin.css`, `expositor.css`) cuando haga falta.
- Critical CSS inline: solo si LCP empeora mediblemente; el sitio ya usa una hoja externa con preconnect a fuentes.

## Fuentes

Patrón en `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:...&family=Playfair+Display:...&display=swap" rel="stylesheet">
```

`display=swap` ya presente. No añadir pesos de fuente no usados.

## Sponsors (`js/sponsors.js`)

- Imágenes 72×72 con `loading="lazy"`.
- Preferir WebP listado en `EVENT_CONFIG.sponsors`.
- Evitar JS que bloquee render antes del primer paint.

## Workflow mejora rendimiento

```
1. Identificar página (Lighthouse / Network: LCP element, peso total)
2. Imágenes: dimensiones, WebP, lazy vs eager
3. JS: ¿necesario en first load? ¿defer condicional?
4. CSS: ¿reglas duplicadas? ¿selectores costosos en mapa?
5. Bump ?v= en HTML tras cambiar assets cacheables
6. py tools/deploy_firebase.py o CI
7. Re-medir en producción (cache caliente)
```

## Anti-patrones (este proyecto)

- Añadir GA4 o tags third-party pesados (política: analítica propia).
- Subir JPG enormes sin redimensionar (stands, competencia fotos van a Drive — comprimir en cliente si se añade validación).
- Olvidar `?v=` tras editar `brand.css` / JS (usuarios ven cache 5 min viejo).
- `loading="lazy"` en imagen LCP del hero.

## Archivos clave

- `firebase.json` — headers
- `css/brand.css`, `js/stands-map.js`, `js/sponsors.js`, `js/site-chrome.js`
- `index.html`, `stands.html`, `patrocinadores.html` — patrones de carga
- Skill complementario: `feria-web-hosting` (deploy + cache-bust)
