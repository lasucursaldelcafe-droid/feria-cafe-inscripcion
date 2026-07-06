# Jurado V60 — Instrucciones de uso

Plataforma de calificación sensorial en vivo, configurable para otros eventos (white-label). Acceso por URL; paneles separados por rol.

## URLs de producción

| Panel | URL |
|-------|-----|
| **Consola principal** | https://la-sucursal-del-cafe.web.app/jurado-v60 |
| **Configuración** | https://la-sucursal-del-cafe.web.app/jurado/config?pin=v60organizador |
| **Torneo en vivo** | https://la-sucursal-del-cafe.web.app/jurado/organizador?pin=v60organizador |
| **Resultados competidor** | https://la-sucursal-del-cafe.web.app/jurado/resultados |
| **Juez N** | `https://la-sucursal-del-cafe.web.app/jurado/juez?pin=v60sensorial&juez=N` |
| **Inscripción evento** | https://la-sucursal-del-cafe.web.app/competencia |
| **Inscripción torneo (white-label)** | `https://la-sucursal-del-cafe.web.app/competencia/torneo?evt=slug-del-torneo` |

**Backend Apps Script (producción):**

`https://script.google.com/macros/s/AKfycbyiLN6ms5dSbm6f1ZmZsR7ktqWLFGxGJd5zAnhZlmX3d0lpKFx1AhLXMXWfnF8txsp0/exec`

También desde el panel admin: **Competidores** → tarjeta «Enlaces del jurado» o «Clientes plataforma jurado».

> Si cambias los PIN o el número de jueces en **Configuración**, vuelve a copiar y compartir los enlaces.

### Portal resultados (competidor)

Cada inscrito ingresa con:
- **Usuario:** nombre completo (como en el formulario de inscripción)
- **Clave:** número de cédula / documento de identidad

Solo ve **sus** puntajes, estado en el torneo y desglose por juez.

---

## Flujo del cliente (orden recomendado)

El cliente **no arma enlaces a mano**: configura el torneo y el sistema genera los links automáticamente en la pestaña **«3. Enlaces del evento»**.

| Paso | Qué hace el cliente | Dónde |
|------|---------------------|-------|
| **0. Alta** | La Sucursal crea el apartado en Admin | Admin → Clientes plataforma jurado |
| **1. Configurar** | Marca, reglas, tipo de torneo, criterios, jueces, PINs, campos del formulario | `/jurado/config?evt=slug&pin=…` → pestaña **1. Configurar torneo** |
| **2. Inscripciones** | Copia el formulario público y revisa registros | Misma URL → pestaña **2. Inscripciones** |
| **3. Enlaces** | Copia torneo en vivo, jueces y resultados (se regeneran al guardar) | Misma URL → pestaña **3. Enlaces del evento** |
| **4. Día del evento** | Organizador controla rondas; cada juez usa su enlace móvil | `/jurado/organizador` y `/jurado/juez` |
| **5. Resultados** | Competidores consultan con nombre + documento | `/jurado/resultados?evt=slug` |

Los enlaces se generan desde `SiteLinks.buildJuradoUrls()` (única fuente en `js/site-links.js`).

---

## Vender la plataforma (white-label)

En **Admin → Competidores → Clientes plataforma jurado**:

1. Ingresa nombre del cliente y del torneo.
2. Pulsa **Crear apartado y enlace**.
3. Copia el **enlace de configuración** y el de **inscripción en línea** y envíaselos al cliente.

El enlace de configuración tiene forma:

`https://…/jurado/config?evt=slug-del-cliente&pin=…`

El formulario público de inscripción:

`https://…/competencia/torneo?evt=slug-del-cliente`

- Cada cliente tiene **datos aislados** (config, puntajes, bracket, hoja de inscripciones).
- El cliente configura marca, reglas, criterios y **campos del formulario** en su panel.
- En la pestaña **Inscripciones** ve el enlace público y la lista de registros en tiempo real.
- Los competidores del torneo deben tener columna **Evento** = `slug` en el sheet principal (o vacía para incluir todos).

### Flujo rápido — inscripción en línea

1. **Admin** crea el apartado → copia enlace de **config** (paso 1 al cliente).
2. El **cliente** abre `/jurado/config?evt=slug&pin=…`.
3. **1. Configurar torneo**: logo, colores, modo (duelos/ranking), criterios, jueces, cupo, reglamento y campos → **Guardar** (abre automáticamente enlaces).
4. **2. Inscripciones**: copia el enlace público y compártelo (redes, QR, correo).
5. **3. Enlaces del evento**: copia torneo en vivo, un link por juez y resultados.
6. Cada registro se guarda en hoja **`Comp. {slug}`** y **`Competencia`** (columna **Evento** = slug).
7. En **Torneo en vivo**, los inscritos habilitados aparecen para sorteo y calificación.

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
- Tras cerrar ronda: **Publicar resultados a competidores** (obligatorio para que vean puntajes) y luego **Avanzar ganadores** o **Clasificar por puntaje** en **Control**

### Portal resultados (competidor)

Los participantes **no ven calificaciones en vivo**. Solo acceden a sus puntajes cuando el organizador pulsa **«Publicar resultados a competidores»** en **Control de ronda**, típicamente al terminar la ronda. Los eliminados conservan la última publicación de su ronda.

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
| **Campos del formulario** | Activa/desactiva campos, etiquetas, obligatoriedad y tipo (texto, email, tel, número, textarea) |
| **Datos del evento** | Título del formulario, tarifa, cupo, fecha, lugar, contacto y URL del reglamento (visible en el formulario público) |

Pulsa **Guardar configuración**. Se almacena en el servidor (`jurado_v60_platform__{slug}`) y se aplica al instante en tablas, formularios de juez, formulario en línea y enlaces.

### 7. Inscripciones (solo panel Config)

Disponible en `/jurado/config` (no en el panel Torneo en vivo):

| Elemento | Descripción |
|----------|-------------|
| **Enlace público** | `https://…/competencia/torneo?evt=slug` — compártelo con competidores |
| **Copiar enlace** | Portapapeles para WhatsApp, QR o correo |
| **Tabla de registros** | Lista en tiempo real desde la hoja `Comp. {slug}` |
| **Actualizar lista** | Refresca sin recargar toda la página |

Requisitos:
- URL con `?evt=slug` del torneo white-label
- PIN de organizador válido en la misma URL
- Backend Apps Script desplegado con APIs `competencia_torneo_*`

### 8. Exportar (opcional)

| Botón | Contenido |
|-------|-----------|
| **Descargar config JSON** | Kit completo: marca, criterios, enlaces, fecha de exportación |
| **Descargar formulario HTML** | Plantilla estática offline (alternativa al formulario en línea) |

> **Recomendado:** usa el formulario en línea (`/competencia/torneo?evt=…`). El HTML exportado sirve como respaldo o para eventos sin backend conectado.

El HTML incluye logo, colores y campos básicos. El formulario en línea lee la configuración guardada en el servidor y respeta cupo y campos activos.

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
| `jurado_v60_calificaciones__{slug}` | Puntajes por competidor y juez (por torneo) |
| `jurado_v60_bracket__{slug}` | Fase, ronda, activos, eliminados, sorteo, grupos, historial, publicación de resultados |
| `jurado_v60_platform__{slug}` | Marca, colores, PINs, scoring, **formFields**, datos de inscripción |
| Hoja **`Comp. {slug}`** | Inscripciones en línea del torneo white-label |
| Hoja **`Competencia`** | Registro global; filtra jurado por columna **Evento** |

Sin `?evt=slug` en la URL se usan las claves globales (`jurado_v60_*` sin sufijo) del festival principal.

Los competidores se leen de la hoja **Competencia** (solo filas con **Habilitado** = sí).

---

## Consejos operativos

1. **Un enlace por juez** — no compartas el mismo enlace entre jueces.
2. **Móvil para jueces, tablet/PC para organizador** — la UI de juez está optimizada para celular.
3. **Actualización automática** — el organizador refresca cada 3 s; usa **Actualizar** si necesitas forzar.
4. **Antes de una nueva ronda** — confirma ganadores en **Torneo**, luego **Avanzar ganadores** en **Control**.
5. **Otros eventos** — configura **Marca y reglas**, comparte el enlace de **Inscripciones** y usa PINs propios; no hace falta tocar código.
6. **Cupo** — cuando se llena, el formulario en línea muestra «cupo completo» y deja de aceptar envíos.
7. **Publicar resultados** — en **Control**, pulsa «Publicar resultados a competidores» al cerrar cada ronda; hasta entonces el portal `/jurado/resultados` no muestra puntajes.

---

## Solución de problemas

| Problema | Qué hacer |
|----------|-----------|
| «Falta el PIN» | Usa el enlace completo con `?pin=...` |
| `/competencia/torneo` da 404 | Espera deploy Firebase o relanza workflow **Actualizar todo** / **Deploy Firebase Hosting** |
| «Torneo no encontrado» en inscripción | Verifica `?evt=slug` correcto y que el cliente fue creado en Admin |
| «Cupo completo» | Aumenta cupo en Marca y reglas o deshabilita inscripciones antiguas en la hoja |
| No aparecen inscripciones en la tabla | Pulsa **Actualizar lista**; revisa PIN organizador y slug en la URL |
| No aparecen competidores en jurado | Revisa hoja Competencia, columna **Habilitado** y **Evento** = slug del torneo |
| Duelo sin ganador | Espera a que todos los jueces califiquen o usa **Declarar ganador** / edición manual |
| Modo ranking no avanza | Verifica que todos tengan nota completa; usa **Clasificar por puntaje** en Control |
| Competidor no ve resultados | El organizador debe **Publicar resultados a competidores** en Control |
| Cambié PIN o jueces y el enlace viejo no funciona | Copia enlaces nuevos desde **Vista general** o **Inscripciones** tras guardar |
| Página con datos viejos | Forzar recarga (Ctrl+Shift+R); versión actual: cache `jurado25` |
| CI Apps Script falla | Renueva `OAUTH_SCRIPT_TOKEN` en GitHub Secrets y ejecuta `py tools/setup_admin.py` |

---

## Enlaces relacionados

| Recurso | Ubicación |
|---------|-----------|
| Panel admin | `/admin` → Competidores |
| Inscripción festival V60 | `/competencia` |
| Inscripción torneo white-label | `/competencia/torneo?evt=slug` |
| Reglamento | `/reglas` |
| Código panel jurado | `jurado-config.html`, `js/jurado-v60.js`, `css/jurado-v60.css` |
| Formulario público torneo | `competencia-torneo.html`, `js/competencia-torneo.js` |
| Backend APIs torneo | `Code.gs` → `competencia_torneo_*` |
| URL canónica backend | `tools/CANONICAL_SHEETS_URL.txt` |
| Pruebas E2E jurado | `node tools/test_jurado_e2e.mjs` |
| Verificar backend | `python3 tools/conectar_sheets.py --verificar` |

---

## Mantenimiento y deploy

| Acción | Comando / dónde |
|--------|-----------------|
| Actualizar URL backend local | `python3 tools/conectar_sheets.py --configurar-url "<URL /exec>"` |
| Secreto GitHub (CI) | `gh secret set SHEETS_WEB_APP_URL --body "$(cat tools/CANONICAL_SHEETS_URL.txt)"` |
| Redeploy Apps Script manual | `python3 tools/setup_admin.py` (requiere OAuth en `tools/.env`) |
| Sincronizar rutas Firebase | `python3 tools/sync_routes.py` |
| Deploy hosting manual | Workflow **Deploy Firebase Hosting** o **Actualizar todo** en GitHub Actions |

Tras cambiar `Code.gs`, el workflow **Deploy Apps Script** en `main` intenta subir el código. Si falla por `OAUTH_SCRIPT_TOKEN`, haz deploy manual y actualiza el token en GitHub Secrets.

---

*Última actualización: julio 2026 · cache `jurado25` · PR #52*
