# 🎁 Módulo de Fidelización — La Sucursal del Café

Sistema de puntos y niveles con tarjeta digital (QR) y panel administrativo. Construido **sin build**
(vanilla JS + React vía Babel standalone, igual que `stands-reserva-firebase.html`) para integrarse
directo en el repo existente, sin tocar el resto del sitio.

## Decisión de arquitectura (importante)

El documento original que inspiró este módulo pedía React+TypeScript, Tailwind, Firebase Auth,
Firestore, Functions y Google Wallet API. Este repo **no usa build step ni Auth** (se eliminó
deliberadamente del panel admin — ver `js/firebase-config.js`), así que el módulo se adaptó así:

| Propuesto originalmente | Implementado aquí | Por qué |
|---|---|---|
| React + TypeScript + Tailwind | React vía Babel standalone, sin build | Consistente con `stands-reserva-firebase.html`, cero configuración nueva |
| Firebase Authentication | URL no publicada, sin login | Mismo patrón ya usado en `admin.html` |
| Cloud Firestore | ✅ Firestore (sí se activa) | Necesario para puntos en tiempo real, a diferencia del resto del sitio que usa Sheets |
| Firebase Functions | No incluido | Sin Functions en el repo hoy; necesario solo para Wallet |
| Google Wallet API | Pendiente (ver pestaña "Wallet" en el panel) | Requiere Cloud Function que firme el pase — fuera de alcance de esta primera versión |

## Modelo de seguridad — léelo antes de lanzar a producción

El panel admin (`/panel-fidelizacion`) **no tiene login**, igual que `/admin`. La protección es que
la URL no está enlazada públicamente y lleva `noindex`. Las reglas de Firestore (`firestore.rules`)
permiten lectura/escritura abierta **solo** en las colecciones `fidelizacion_*` — todo lo demás sigue
denegado. Esto significa que cualquiera que descubra la API key del proyecto y el nombre de una
colección podría leer o escribir esos datos directamente (no a través del panel). Es el mismo nivel
de riesgo ya aceptado para `stands_reserva`. Si esto te preocupa para datos de clientes reales,
el siguiente paso natural es reactivar Firebase Auth solo para este módulo (custom claims `admin`).

## Antes de usarlo en producción

1. **Activar Firestore** en Firebase Console → proyecto `la-sucursal-del-cafe` → Firestore Database → modo producción.
2. **Llenar credenciales reales** en `js/firebase-fidelizacion-config.js` (apiKey, appId, etc. — están como `TU_API_KEY`).
3. **Desplegar las reglas**: `npx -y firebase-tools@latest deploy --only firestore:rules`
4. **Desplegar el sitio**: `npx -y firebase-tools@latest deploy --only hosting`

## URLs

| Página | Ruta | Público |
|---|---|---|
| Info del programa | `/fidelizacion` | Sí |
| Registro de cliente | `/registro-fidelizacion` | Sí (sin index en buscadores) |
| Tarjeta digital del cliente | `/mi-tarjeta?id=...` | Sí (link personal, sin index) |
| Panel admin | `/panel-fidelizacion` | No publicado, sin login |

## Colecciones de Firestore

- `fidelizacion_clientes` — nombre, teléfono, email, puntos, puntosHistoricos, nivel, fechaRegistro, ultimaVisita, activo
- `fidelizacion_transacciones` — clienteId, tipo (`acumulacion`/`canje`), puntos, descripcion, monto, sede, fecha
- `fidelizacion_recompensas` — nombre, puntosRequeridos, descripcion, activa
- `fidelizacion_promociones` — nombre, fechaInicio, fechaFin, descripcion, activa
- `fidelizacion_config/niveles` — umbrales de nivel editables desde el panel (pestaña Configuración)

Niveles por defecto: Bronce (0+), Plata (200+), Oro (500+), Diamante (1000+) puntos históricos.
Editable sin tocar código desde el panel admin → pestaña Configuración.

## Archivos agregados

```
fidelizacion.html              # Página pública del programa
fidelizacion-registro.html     # Formulario de registro de cliente
mi-tarjeta.html                # Tarjeta digital del cliente (QR + puntos + nivel)
dashboard-fidelizacion.html    # Panel admin (Resumen, Clientes, Recompensas, Promociones, CRM, Wallet, Configuración)
css/fidelizacion.css           # Estilos del módulo
js/fidelizacion-common.js      # Lógica compartida: Firestore, niveles, transacciones
js/firebase-fidelizacion-config.js  # Credenciales Firebase (llenar antes de producción)
```

## Pendiente / próximas fases

- **Google Wallet**: requiere Cloud Functions + cuenta de servicio de Wallet API (ver pestaña Wallet en el panel para el detalle).
- **Estadísticas avanzadas**: hoy viven integradas en la pestaña Resumen; se puede separar si crece.
- **Auth real para el panel**: si el volumen de datos de clientes lo justifica.
