# Configuración de GitHub Actions y CI/CD

Este documento explica qué secretos y configuraciones se necesitan para que el workflow de despliegue funcione completamente.

## Estado actual (verificado 2026-06-25)

| Componente | Estado |
|------------|--------|
| Workflow `.github/workflows/deploy-firebase.yml` | Activo |
| `FIREBASE_SERVICE_ACCOUNT` | Configurado — Hosting despliega correctamente |
| `SHEETS_WEB_APP_URL` | Configurado — formularios conectados a Apps Script |
| Deploy Firebase Hosting | Funcional — https://la-sucursal-del-cafe.web.app/ |
| Deploy Firestore rules | Falla con 403 IAM (no bloquea Hosting) |

Los últimos runs en `main` completan el deploy de Hosting en ~45 s. El paso de Firestore rules requiere permisos adicionales en la cuenta de servicio (ver sección más abajo).

## Secretos requeridos en GitHub

Ir a **Settings** → **Secrets and variables** → **Actions**:

### 1. FIREBASE_SERVICE_ACCOUNT (obligatorio)

**Necesario para**: Desplegar a Firebase Hosting.

**Cómo obtenerlo**:
1. Firebase Console → proyecto `la-sucursal-del-cafe` → Project settings
2. Tab **Service accounts** → **Generate new private key**
3. Copiar el JSON completo como valor del secreto.

**Sincronizar desde tu PC** (recomendado):

```bash
py tools/setup_github_ci.py
# o en PowerShell:
.\tools\sync_github_secrets.ps1
```

### 2. SHEETS_WEB_APP_URL (opcional pero recomendado)

**Necesario para**: Conectar formularios a Google Sheets en producción.

**Valor**: URL `/exec` del Apps Script desplegado como aplicación web.

Sin este secreto, el sitio se publica pero los formularios usan `localStorage` como respaldo.

## Qué hace el workflow

```
1. Checkout → descarga el código
2. Validar secretos → comprueba JSON de Firebase y URL de Sheets
3. Generar js/sheets-config.js → inyecta la URL de Sheets
4. Deploy to Firebase Hosting → sube HTML/CSS/JS a firebase.app
5. Deploy Firestore Rules → actualiza firestore.rules (opcional, no bloquea si falla)
```

## Firestore rules — permisos pendientes

El paso 5 falla con:

```
Permission denied to get service [firestore.googleapis.com]
```

**Solución**: En [Google Cloud IAM](https://console.cloud.google.com/iam-admin/iam?project=la-sucursal-del-cafe), añadir a la cuenta de servicio de Firebase uno de estos roles:

- **Firebase Rules Admin**, o
- **Cloud Datastore Owner**

Hosting no depende de este paso; el módulo de fidelización sí usa Firestore en producción.

## Comandos útiles

```bash
# Diagnóstico local
py tools/validate_ci_secrets.py

# Relanzar deploy manual
gh workflow run "Deploy Firebase Hosting"

# Ver últimos runs
gh run list --workflow deploy-firebase.yml --limit 5

# Logs del último run fallido
gh run list --workflow deploy-firebase.yml --limit 1 --json databaseId -q '.[0].databaseId' | xargs -I{} gh run view {} --log-failed
```

## Despliegue manual (alternativa)

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest deploy --project la-sucursal-del-cafe
```

## Notas de seguridad

- `FIREBASE_SERVICE_ACCOUNT` nunca debe versionarse en el repo.
- GitHub encripta secretos; no aparecen en logs.
- Rotar la clave desde Google Cloud → IAM si se compromete.
