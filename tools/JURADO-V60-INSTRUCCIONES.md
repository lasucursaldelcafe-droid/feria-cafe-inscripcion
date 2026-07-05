# Jurado V60 — Instrucciones de uso

Plataforma de calificación sensorial en vivo, configurable para otros eventos (white-label). Acceso solo por URL con PIN; no aparece en el menú público del sitio.

## URLs de producción

| Rol | URL |
|-----|-----|
| **Organizador** | https://la-sucursal-del-cafe.web.app/jurado-v60?pin=v60organizador |
| **Juez N** | `https://la-sucursal-del-cafe.web.app/jurado-v60?pin=v60sensorial&juez=N` (N = 1…cantidad de jueces configurada) |

También desde el panel admin: **Competidores** → tarjeta «Enlaces del jurado», o en el organizador → pestaña **Vista general** → **Enlaces del jurado**.

> Si cambias los PIN o el número de jueces en **Marca y reglas**, los enlaces válidos serán los nuevos. Vuelve a copiar y compartir.

---

## Roles

### Organizador

Ve el dashboard completo: clasificación en vivo, torneo por duelos, puntajes, control de rondas, marca del evento y exportación del kit.

### Jueces (1 a 5)

Cada juez abre **su enlace** desde el celular, elige competidor activo y califica **solo su columna**. Los criterios, la escala y la cantidad de jueces se configuran en **Marca y reglas → Calificación y criterios**.

- Subtotal por juez = suma de todos los criterios (máx. `criterios × escala máxima`)
- Total competidor = suma de todos los jueces

---

## Panel organizador — pestañas

### 1. Vista general

- **Tarjetas de resumen:** activos, calificados, eliminados, fase actual.
- **Progreso del torneo:** resumen de la ronda actual y enlace al recorrido completo.
- **Clasificación en vivo (estilo torneo):** tabla por puntaje total, con posición, estado de cada juez y puntos. Se actualiza cada 3 segundos.
- **Enlaces del jurado:** copiar o abrir enlace de organizador y de cada juez.

### 2. Recorrido

- **Barra de progreso** de la ronda actual (cuántos ya calificaron).
- **Grupos del torneo** con estado (en juego / cerrado) y puntajes.
- **Historial de rondas:** sorteo, cierres de grupo, duelos y rankings con quién pasó y quién quedó fuera.
- **Avance automático:** cuando todos los activos tienen puntaje completo, el sistema avanza solo (configurable en Marca y reglas).

### 3. Torneo

Depende del **modo de clasificación** configurado en Marca y reglas:

| Modo | Comportamiento |
|------|----------------|
| **Duelos 1v1** | Parejas de 2 competidores · pasa quien tenga mayor puntaje total |
| **Puntaje general** | Ranking de todos los activos · avanzan los mejores por puntaje total |

- En duelos: empate o falta de puntajes → **Declarar ganador**
- Tras cerrar ronda: **Avanzar ganadores** o **Clasificar por puntaje** (modo ranking) en **Control**

### 4. Puntajes

- Tabla dinámica con una columna por juez (J1…JN) y total por competidor activo.
- **Edición manual** de puntajes (correcciones del organizador).
- **Detalle** por competidor: desglose por criterio y notas.

### 5. Control

#### Sorteo automático (inicio del torneo)

1. Ve a **Control** → bloque **Sorteo y formato del torneo**
2. Revisa el **formato sugerido** según inscritos habilitados:

| Inscritos | Fases típicas |
|-----------|----------------|
| 2 | Final |
| 3–4 | Semifinal → Final |
| 5–8 | Cuartos → Semifinal → Final |
| 9–16 | Octavos → Cuartos → Semifinal → Final |
| 17–32 | Dieciseisavos → Octavos → Cuartos → Semifinal → Final |
| 33+ | **Grupos** (top 2 por grupo) → eliminatorias |

3. Pulsa **🎲 Sorteo automático** — mezcla inscritos, asigna grupos si aplica y reinicia puntajes
4. El orden del sorteo y los grupos quedan guardados en el servidor

#### Fase de grupos (>32 inscritos o formato con grupos)

- Califica a **todos** los del grupo activo (no son duelos 1v1)
- Clasifican los **2 mejores** por puntaje total (o 1 si el grupo es de 3)
- **Cerrar grupo actual (top 2)** → pasa al siguiente grupo o a octavos/cuartos según cupo

#### Eliminatorias (dieciseisavos → final)

| Acción | Cuándo usarla |
|--------|----------------|
| **Aplicar fase** | Cambiar manualmente la fase (grupos, 16avos, 8avos, 4tos, semifinal, final) |
| **Reiniciar puntajes de activos** | Nueva catación con los mismos participantes |
| **Reiniciar TODOS** | Borrar todos los puntajes del torneo |
| **Avanzar ganadores** | Modo duelos: pasan los de mayor puntaje en cada duelo |
| **Clasificar por puntaje** | Modo puntaje general: avanzan los N mejores del ranking |
| **Cerrar grupo actual** | Solo en fase de grupos |
| **Eliminar / Restaurar** | Sacar o volver a meter participantes de la ronda |

#### Flujo típico — torneo de 16

1. **Sorteo automático** (formato: octavos → cuartos → semifinal → final)
2. **Reiniciar puntajes de activos** si hace falta
3. Jueces califican duelos 1v1 en **Torneo**
4. **Avanzar ganadores** tras cada ronda (la fase cambia sola: 8 → 4 → 2)
5. Final: último duelo define campeón

#### Flujo manual (sin sorteo)

### 6. Marca y reglas (white-label)

Personaliza el torneo para vender la plataforma a otros eventos:

| Campo | Descripción |
|-------|-------------|
| Nombre del torneo | Título en header y dashboard |
| Subtítulo | Texto bajo el título |
| Organizador / marca | Kicker y datos de contacto |
| URL del logo | Imagen pública (PNG/JPG) |
| Colores | Acento y fondo (se aplican al instante en vista previa) |
| PIN organizador / PIN jueces | Acceso por URL (mín. 4 caracteres recomendado) |
| **Modo de clasificación** | Duelos 1v1 o Puntaje general (ranking) |
| **Escala mín/máx** | Valores permitidos por criterio (ej. 1–5, 0–10) |
| **Número de jueces** | De 1 a 5 (genera enlaces J1…JN) |
| **Avance por ronda** | Cuántos clasifican (0 = automático según fase) |
| **Avance automático** | Al completar puntajes de todos los activos, pasa a la siguiente ronda sin pulsar botón |
| **Criterios sensoriales** | Nombre y descripción; puedes añadir o quitar filas |
| Datos de inscripción | Para la plantilla exportada: tarifa, cupo, fecha, lugar, correo, WhatsApp, reglamento |

Pulsa **Guardar configuración**. Se almacena en el servidor (`jurado_v60_platform`) y se aplica al instante en tablas, formularios de juez y enlaces.

### 7. Exportar

| Botón | Contenido |
|-------|-----------|
| **Descargar config JSON** | Kit completo: marca, criterios, enlaces, fecha de exportación |
| **Descargar formulario HTML** | Página de inscripción lista para publicar o conectar a tu backend |

El HTML incluye tu logo, colores y campos básicos (nombre, documento, correo, celular, ciudad, representa). Conéctalo a Google Apps Script u otro formulario según tu evento.

---

## Criterios de calificación (configurables)

Por defecto el torneo V60 usa 7 criterios sensoriales (aroma, dulzor, acidez, sabor, balance, cuerpo, limpieza de taza) con escala **1–5** y **3 jueces**. Todo es editable en **Marca y reglas → Calificación y criterios**:

| Parámetro | Descripción |
|-----------|-------------|
| Criterios | Lista editable (nombre + descripción). Mínimo 1 criterio. |
| Escala | `mínimo` y `máximo` por criterio (ej. 1–5 o 0–10) |
| Jueces | 1 a 5 columnas independientes |
| Modo | Duelos o ranking por puntaje general |

**Cálculo de puntajes:**

- Subtotal juez = suma de todos los criterios
- Total competidor = suma de todos los jueces
- Modo duelos: gana el **mayor total** (no promedio)
- Modo puntaje general: clasifican los **N mejores** del ranking (N automático o manual)

---

## Datos en el servidor

| Clave `pasaporte_config` | Contenido |
|--------------------------|-----------|
| `jurado_v60_calificaciones` | Puntajes por competidor y juez |
| `jurado_v60_bracket` | Fase, ronda, activos, eliminados, sorteo, grupos, plan de fases, **historial** |
| `jurado_v60_platform` | Marca, colores, PINs, **scoring** (modo, escala, jueces, criterios), datos de inscripción |

Los competidores se leen de la hoja **Competencia** (solo filas con **Habilitado** = sí).

---

## Consejos operativos

1. **Un enlace por juez** — no compartas el mismo enlace entre jueces.
2. **Móvil para jueces, tablet/PC para organizador** — la UI de juez está optimizada para celular.
3. **Actualización automática** — el organizador refresca cada 3 s; usa **Actualizar** si necesitas forzar.
4. **Antes de una nueva ronda** — confirma ganadores en **Torneo**, luego **Avanzar ganadores** en **Control**.
5. **Otros eventos** — configura **Marca y reglas**, exporta HTML/JSON y usa PINs propios; no hace falta tocar código.

---

## Solución de problemas

| Problema | Qué hacer |
|----------|-----------|
| «Falta el PIN» | Usa el enlace completo con `?pin=...` |
| No aparecen competidores | Revisa hoja Competencia y columna Habilitado |
| Duelo sin ganador | Espera a que todos los jueces califiquen o usa **Declarar ganador** / edición manual |
| Modo ranking no avanza | Verifica que todos tengan nota completa; usa **Clasificar por puntaje** en Control |
| Cambié PIN o jueces y el enlace viejo no funciona | Copia enlaces nuevos desde **Vista general** tras guardar en **Marca y reglas** |
| Página con datos viejos | Forzar recarga (Ctrl+Shift+R); versión actual en URL: `jurado20` |

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

*Última actualización: julio 2026 · cache `jurado20`*
