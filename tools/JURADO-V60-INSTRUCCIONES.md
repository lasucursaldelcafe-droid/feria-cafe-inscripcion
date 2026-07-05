# Jurado V60 — Instrucciones de uso

Plataforma de calificación sensorial en vivo, configurable para otros eventos (white-label). Acceso solo por URL con PIN; no aparece en el menú público del sitio.

## URLs de producción

| Rol | URL |
|-----|-----|
| **Organizador** | https://la-sucursal-del-cafe.web.app/jurado-v60?pin=v60organizador |
| **Juez 1** | https://la-sucursal-del-cafe.web.app/jurado-v60?pin=v60sensorial&juez=1 |
| **Juez 2** | https://la-sucursal-del-cafe.web.app/jurado-v60?pin=v60sensorial&juez=2 |
| **Juez 3** | https://la-sucursal-del-cafe.web.app/jurado-v60?pin=v60sensorial&juez=3 |

También desde el panel admin: **Competidores** → tarjeta «Enlaces del jurado».

> Si cambias los PIN en la pestaña **Marca**, los enlaces válidos serán los nuevos. Vuelve a copiar y compartir.

---

## Roles

### Organizador

Ve el dashboard completo: clasificación en vivo, torneo por duelos, puntajes, control de rondas, marca del evento y exportación del kit.

### Jueces 1, 2 y 3

Cada juez abre **su enlace** desde el celular, elige competidor activo y califica **solo su columna** (7 criterios, escala 1–5). Máximo 35 pts por juez; total máximo 105 pts (J1 + J2 + J3).

---

## Panel organizador — pestañas

### 1. Vista general

- **Tarjetas de resumen:** activos, calificados, eliminados, fase actual.
- **Clasificación en vivo (estilo torneo):** tabla por puntaje total, con posición, estado de cada juez y puntos. Se actualiza cada 3 segundos.
- **Enlaces del jurado:** copiar o abrir enlace de organizador y de cada juez.

### 2. Torneo

- Duelos de **2 competidores** en la ronda actual.
- **Pasa quien tenga mayor puntaje total** (no promedio).
- En empate o falta de puntajes: botón **Declarar ganador**.
- Tras cerrar duelos: **Avanzar ganadores + limpiar puntajes** (pestaña Control).

### 3. Puntajes

- Tabla con J1, J2, J3 y total por competidor activo.
- **Edición manual** de puntajes (correcciones del organizador).
- **Detalle** por competidor: desglose por criterio y notas.

### 4. Control

| Acción | Cuándo usarla |
|--------|----------------|
| **Aplicar fase** | Cambiar entre Clasificatoria, Semifinal o Final y número de ronda |
| **Reiniciar puntajes de activos** | Nueva catación con los mismos participantes |
| **Reiniciar TODOS** | Borrar todos los puntajes del torneo |
| **Avanzar ganadores** | Pasar ganadores de duelos a la siguiente ronda y limpiar puntajes |
| **Eliminar / Restaurar** | Sacar o volver a meter participantes de la ronda |

#### Flujo típico — semifinal ronda 1

1. **Control** → Fase: Semifinal · Ronda 1 → **Aplicar fase**
2. **Eliminar** participantes que no van a semifinal
3. **Reiniciar puntajes de activos** (empieza catación limpia)
4. Jueces califican desde sus móviles **o** edición manual en **Puntajes**
5. Revisar duelos en **Torneo**
6. **Avanzar ganadores + limpiar puntajes** para la siguiente ronda

### 5. Marca (white-label)

Personaliza el torneo para vender la plataforma a otros eventos:

| Campo | Descripción |
|-------|-------------|
| Nombre del torneo | Título en header y dashboard |
| Subtítulo | Texto bajo el título |
| Organizador / marca | Kicker y datos de contacto |
| URL del logo | Imagen pública (PNG/JPG) |
| Colores | Acento y fondo (se aplican al instante en vista previa) |
| PIN organizador / PIN jueces | Acceso por URL (mín. 4 caracteres recomendado) |
| Datos de inscripción | Para la plantilla exportada: tarifa, cupo, fecha, lugar, correo, WhatsApp, reglamento |

Pulsa **Guardar configuración**. Se almacena en el servidor (`jurado_v60_platform`).

### 6. Exportar

| Botón | Contenido |
|-------|-----------|
| **Descargar config JSON** | Kit completo: marca, criterios, enlaces, fecha de exportación |
| **Descargar formulario HTML** | Página de inscripción lista para publicar o conectar a tu backend |

El HTML incluye tu logo, colores y campos básicos (nombre, documento, correo, celular, ciudad, representa). Conéctalo a Google Apps Script u otro formulario según tu evento.

---

## Criterios de calificación

| Criterio | Escala |
|----------|--------|
| Aroma | 1–5 |
| Dulzor | 1–5 |
| Acidez | 1–5 |
| Sabor | 1–5 |
| Balance | 1–5 |
| Cuerpo | 1–5 |
| Limpieza de taza | 1–5 |

- Subtotal por juez: máx. **35 pts**
- Total competidor: **J1 + J2 + J3** (máx. **105 pts**)
- Ganador de duelo: **mayor total**, no promedio

---

## Datos en el servidor

| Clave `pasaporte_config` | Contenido |
|--------------------------|-----------|
| `jurado_v60_calificaciones` | Puntajes por competidor y juez |
| `jurado_v60_bracket` | Fase, ronda, activos, eliminados, ganadores forzados |
| `jurado_v60_platform` | Marca, colores, PINs, datos de inscripción |

Los competidores se leen de la hoja **Competencia** (solo filas con **Habilitado** = sí).

---

## Consejos operativos

1. **Un enlace por juez** — no compartas el mismo enlace entre jueces.
2. **Móvil para jueces, tablet/PC para organizador** — la UI de juez está optimizada para celular.
3. **Actualización automática** — el organizador refresca cada 3 s; usa **Actualizar** si necesitas forzar.
4. **Antes de una nueva ronda** — confirma ganadores en **Torneo**, luego **Avanzar ganadores** en **Control**.
5. **Otros eventos** — configura **Marca**, exporta HTML/JSON y usa PINs propios; no hace falta tocar código.

---

## Solución de problemas

| Problema | Qué hacer |
|----------|-----------|
| «Falta el PIN» | Usa el enlace completo con `?pin=...` |
| No aparecen competidores | Revisa hoja Competencia y columna Habilitado |
| Duelo sin ganador | Espera los 3 jueces o usa **Declarar ganador** / edición manual |
| Cambié PIN y el enlace viejo no funciona | Copia enlaces nuevos desde **Vista general** tras guardar en **Marca** |
| Página con datos viejos | Forzar recarga (Ctrl+Shift+R); versión actual en URL: `jurado16` |

---

## Enlaces relacionados

| Recurso | Ubicación |
|---------|-----------|
| Panel admin | `/admin` → Competidores |
| Inscripción pública V60 | `/competencia` |
| Reglamento | `/reglas-v60-championship` |
| Código panel jurado | `jurado-v60.html`, `js/jurado-v60.js`, `css/jurado-v60.css` |
| Pruebas E2E | `node tools/test_jurado_e2e.mjs` |

---

*Última actualización: julio 2026 · cache `jurado16`*
