# Configurar Firebase dedicado — La Sucursal del Café

Este repositorio (**feria-cafe-inscripcion**) usa un proyecto Firebase **independiente** de Viajes Peludos.

| Concepto | Valor |
|----------|-------|
| **ID del proyecto** | `la-sucursal-del-cafe` |
| **Nombre visible** | La Sucursal del Café |
| **URL principal** | https://la-sucursal-del-cafe.web.app |
| **URL alternativa** | https://la-sucursal-del-cafe.firebaseapp.com |

> Si el ID `la-sucursal-del-cafe` ya está ocupado globalmente, usa `feria-sucursal-cafe` y actualiza `.firebaserc`, el workflow de GitHub y las variables `FIREBASE_PROJECT`.

---

## 1. Crear el proyecto en Firebase Console

1. Abre [Firebase Console](https://console.firebase.google.com/).
2. Clic en **Agregar proyecto** (o **Create a project**).
3. **Nombre del proyecto:** `La Sucursal del Café`.
4. **ID del proyecto:** `la-sucursal-del-cafe` (debe ser único en Google).
5. Desactiva Google Analytics si no lo necesitas (opcional para hosting estático).
6. Clic en **Crear proyecto**.

### Alternativa por CLI (tras iniciar sesión)

```powershell
cd D:\Desarrollo\02_Proyectos\Feria-Cafe-Inscripcion
npx -y firebase-tools@latest login
npx -y firebase-tools@latest projects:create la-sucursal-del-cafe --display-name "La Sucursal del Café"
```

Si aparece *"Failed to authenticate"*, ejecuta primero `firebase login` y repite.

---

## 2. Habilitar Firebase Hosting

1. En la consola, entra al proyecto **la-sucursal-del-cafe**.
2. Menú lateral → **Build** → **Hosting**.
3. Clic en **Comenzar** / **Get started**.
4. No es obligatorio completar el asistente web: este repo ya incluye `firebase.json` con:
   - `public: "."`
   - Rewrites: `/competencia`, `/reglas`, `/como-funciona`
5. El primer despliegue real lo harás desde tu máquina o GitHub Actions (paso 4).

---

## 3. Autenticación local y primer despliegue

```powershell
cd D:\Desarrollo\02_Proyectos\Feria-Cafe-Inscripcion

# Iniciar sesión (solo una vez por máquina)
npx -y firebase-tools@latest login

# Seleccionar el proyecto dedicado
npx -y firebase-tools@latest use la-sucursal-del-cafe

# Desplegar hosting
npx -y firebase-tools@latest deploy --only hosting --project la-sucursal-del-cafe
```

O con el script Python:

```powershell
py tools/deploy_firebase.py
```

Verifica en el navegador:

- https://la-sucursal-del-cafe.web.app/
- https://la-sucursal-del-cafe.web.app/competencia
- https://la-sucursal-del-cafe.web.app/como-funciona

---

## 4. GitHub Actions — secreto `FIREBASE_SERVICE_ACCOUNT`

El workflow `.github/workflows/deploy-firebase.yml` despliega automáticamente en cada push a `main`.

### Generar la cuenta de servicio (proyecto NUEVO)

1. Firebase Console → proyecto **la-sucursal-del-cafe**.
2. **Configuración del proyecto** (engranaje) → pestaña **Cuentas de servicio**.
3. Clic en **Generar nueva clave privada** (JSON).
4. Guarda el archivo **fuera del repositorio** (nunca lo subas a git).

### Permisos mínimos

En [Google Cloud Console → IAM](https://console.cloud.google.com/iam-admin/iam) del proyecto `la-sucursal-del-cafe`, la cuenta de servicio debe tener al menos:

- **Firebase Hosting Admin**, o
- **Firebase Admin** (más amplio; evítalo si puedes usar solo Hosting Admin).

### Configurar el secreto en GitHub

1. Repositorio: [lasucursaldelcafe-droid/feria-cafe-inscripcion](https://github.com/lasucursaldelcafe-droid/feria-cafe-inscripcion).
2. **Settings** → **Secrets and variables** → **Actions**.
3. Si existía un secreto `FIREBASE_SERVICE_ACCOUNT` del proyecto **viajes-peludos-cotizador**, **reemplázalo** por el JSON del proyecto **la-sucursal-del-cafe**.
4. Nombre del secreto: `FIREBASE_SERVICE_ACCOUNT`.
5. Valor: pega el contenido completo del JSON descargado.

Opcional (formularios con Google Sheets en producción):

| Secreto | Descripción |
|---------|-------------|
| `SHEETS_WEB_APP_URL` | URL `/exec` de Apps Script |

---

## 5. Qué NO mezclar con Viajes Peludos

| Recurso | Feria / Sucursal del Café | Viajes Peludos |
|---------|---------------------------|----------------|
| Proyecto Firebase | `la-sucursal-del-cafe` | `viajes-peludos-cotizador` |
| Secreto GitHub `FIREBASE_SERVICE_ACCOUNT` | JSON del proyecto nuevo | No reutilizar |
| URL pública | `*.la-sucursal-del-cafe.web.app` | Otro dominio |

Google Sheets y Apps Script pueden vivir en un proyecto de Google Cloud distinto; eso es normal y está documentado en `INSTRUCCIONES-SHEETS.md`.

---

## 6. Comprobar el despliegue CI

1. Haz push a la rama `main`.
2. En GitHub → pestaña **Actions** → workflow **Deploy Firebase Hosting**.
3. Si falla por autenticación, revisa que el secreto apunte al proyecto correcto.
4. Tras éxito, abre https://la-sucursal-del-cafe.web.app

---

## Solución de problemas

| Error | Acción |
|-------|--------|
| `Failed to authenticate` | `npx -y firebase-tools@latest login` |
| ID de proyecto no disponible | Prueba `feria-sucursal-cafe` y actualiza configs |
| 403 en deploy CI | Regenera JSON y actualiza `FIREBASE_SERVICE_ACCOUNT` |
| Sitio vacío / 404 | Confirma `firebase deploy --only hosting` completado |
| Formularios sin datos | Configura `SHEETS_WEB_APP_URL` (ver `INSTRUCCIONES-SHEETS.md`) |

---

## Referencias en este repo

- `.firebaserc` — proyecto activo
- `firebase.json` — reglas de hosting y rewrites
- `tools/deploy_firebase.py` — despliegue manual
- `.github/workflows/deploy-firebase.yml` — CI/CD
