---
name: feria-admin-ux
description: >-
  Panel admin Feria Café: tema claro minimalista, secciones plegables (admin-fold),
  menos densidad visual, navegación lateral. Usar al editar admin.html, admin.css,
  admin-dashboard.js o cuando el usuario pida admin más amigable, ordenado o con
  listas desplegables.
---

# Admin UX — Panel `/admin`

## Objetivo

Panel interno legible sin login: **poco ruido**, **bloques plegables**, KPIs visibles, formularios y tablas solo al expandir.

## Archivos

| Archivo | Rol |
|---------|-----|
| `admin.html` | Estructura por secciones `data-admin-section-panel` |
| `css/admin.css` | Tema claro (`--admin-surface` crema), `.admin-fold` |
| `js/admin-disclosures.js` | Envuelve `.admin-card` en `<details class="admin-fold">` |
| `js/admin-dashboard.js` | Lógica; llamar `AdminDisclosures.openFold(id)` al abrir editor |

## Patrón admin-fold

- Cada `.admin-card` hijo directo de una sección se convierte en `<details>` con `<summary>` = título de la tarjeta.
- **Primer card** de cada sección: abierto por defecto (`openFirst`).
- Cards que deben abrirse siempre: `data-admin-fold-open="true"` (ej. dashboard competidores, editor).
- IDs (`competidorEditorPanel`, etc.) se mueven al `<details>` para no romper JS.

```html
<div class="admin-card" id="miPanel" data-admin-fold-open="true">
  <h4 class="admin-card__title">Título visible en el summary</h4>
  <!-- contenido -->
</div>
```

Tras `innerHTML` dinámico (pasaportes, operadores), llamar:

```javascript
AdminDisclosures.wrapCardsIn(document.getElementById('adminPasaportesRoot'), { openFirst: true });
```

## Tema claro (minimal)

Variables en `:root` de `admin.css`:

- Fondo página: `#ebe4d8`
- Superficie tarjeta: `#fffdf9`
- Texto: `#3a2512`
- Bordes suaves café, `border-radius: 14px`, sombra ligera

Body: `class="admin-page admin-page--minimal"`.

## Qué NO plegar

- `.admin-toolbar` (título de sección + acciones)
- `.admin-stats` (KPIs siempre visibles)
- Nav lateral `admin-nav`

## Competidores / PNG

- Editor al abrir: `panel.hidden = false` + `AdminDisclosures.openFold('competidorEditorPanel')`.
- Tarjetas hero y PNG mantienen preview oscuro (contraste de marca); el **contenedor** admin sigue claro.

## Cache

Admin usa `no-store` en Firebase. Aun así bump `?v=` en `admin.css`, `admin-dashboard.js`, `admin-disclosures.js` tras cambios.

## Checklist

- [ ] Nueva tarjeta `.admin-card` con título en `h4.admin-card__title` o `h5`
- [ ] Si es crítica al cargar: `data-admin-fold-open="true"`
- [ ] Cards inyectadas por JS: `wrapCardsIn` después del mount
- [ ] Probar sección en móvil (nav + folds)
- [ ] `py tools/verify_admin.py` tras deploy Apps Script (si aplica)
