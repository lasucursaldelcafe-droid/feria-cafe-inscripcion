---
name: feria-ux-minimal
description: >-
  UX minimalista para el sitio público Feria Café: tarjetas de presentación (bizcard),
  textos cortos, progressive disclosure con details/tabs, espaciado y jerarquía visual.
  Usar al rediseñar home, el-evento, landings o cuando el usuario pida menos texto,
  más aire, interfaz amigable o estilo tarjeta.
---

# UX minimal — Sitio público Feria Café

## Principios

1. **Una idea por bloque** — cada tarjeta o panel comunica una sola acción o tema.
2. **Progressive disclosure** — detalle en pestañas, `<details>` o segunda pantalla; no todo visible de golpe.
3. **Copy corto** — frases de una línea; datos largos en `event-config.js` con variantes `mensaje` / `heroLead` / `exploreIntro`.
4. **Aire y alineación** — padding generoso, grid con `gap` fijo, contenido centrado en tarjetas de identidad/contacto.
5. **Sin duplicar** — un solo bloque de patrocinadores, un CTA principal, sin footer repetitivo si la info ya está arriba.

## Patrones del repo

| Patrón | Archivos |
|--------|----------|
| Tarjeta de presentación (home) | `index.html`, `.bizcard`, `.bizcard-layout` en `brand.css` |
| Pestañas exploración | `js/festival-explore.js`, `EVENT_CONFIG.festival.explore` |
| Acordeón en subpáginas | `<details class="festival-details">` en `el-evento.html` |
| Textos centralizados | `js/event-config.js` — `heroLead`, `mensaje`, `explore[]` |
| Chips en lugar de párrafos | `.bizcard__chip`, `.hero-meta--compact` |

## Estructura bizcard (home)

```
fondo suave (--cream-muted)
└── bizcard-layout (grid, max-width ~960px)
    ├── bizcard--identity (ancho completo, centrado)
    ├── bizcard--explore | bizcard--sponsors (2 cols desktop)
    └── bizcard--contact (sustituye footer pesado)
```

## Checklist al tocar una página pública

- [ ] ¿Se puede quitar un párrafo sin perder el mensaje?
- [ ] ¿Los CTAs repetidos se pueden reducir a uno primario + uno secundario?
- [ ] ¿Bloques largos van en `<details>` o pestañas?
- [ ] ¿Fechas/sede salen de `event-config.js`?
- [ ] Bump `?v=` en `brand.css` y JS tocados

## Perfiles y bios (competidores / marcas)

- Resumir perfil en **2–4 líneas** para PNG y fichas; sin etiquetas redundantes (`Nombre:`, `Rol:`).
- No mezclar datos entre registros; usar IDs estables en admin.
- Ver skill `feria-admin-ux` para editor de competidores.

## Referencia de diseño externa

Si el usuario comparte un perfil o portfolio (PDF, Figma, enlace), extraer:

- Paleta y contraste (fondo / superficie / acento)
- Radio de borde y sombras
- Tipografía (tamaños display vs cuerpo)
- Densidad (cuántos elementos por viewport)
- Componentes recurrentes (chips, tabs, cards)

Documentar hallazgos en el PR o en este skill si son reglas fijas del proyecto.
