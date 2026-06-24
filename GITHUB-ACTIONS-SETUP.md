# Configuración de GitHub Actions y CI/CD

Este documento explica qué secretos y configuraciones se necesitan para que el workflow de despliegue funcione completamente.

## Estado actual

El repositorio tiene un workflow automático de despliegue a Firebase (`/.github/workflows/deploy-firebase.yml`) que se dispara en cada push a `main`.

## Secretos requeridos en GitHub

Ir a **Settings** → **Secrets and variables** → **Actions** y agregar:

### 1. FIREBASE_SERVICE_ACCOUNT ⚠️ FALTA

**Tipo**: Repository secret  
**Necesario para**: Desplegar a Firebase Hosting (sitio público)

**Cómo obtenerlo**:
1. Ir a Firebase Console → proyecto `la-sucursal-del-cafe` → Project settings (engranaje arriba)
2. Tab **Service accounts** → Click **Generate new private key**
3. Esto descarga un JSON. Copiar el contenido completo y pegarlo como valor del secreto.

**Qué contiene**: Credenciales de la cuenta de servicio de Google Cloud para autenticarse con Firebase.

### 2. SHEETS_WEB_APP_URL

**Tipo**: Repository secret  
**Necesario para**: Conectar Google Sheets como base de datos (secciones de inscripción, etc.)

**Cómo obtenerlo**:
1. Existe un Google Apps Script que expone un webhook de Sheets.
2. La URL de ese webhook (termina en `/usercontent/...` o `/dev/...`).

**Estado**: Probablemente ya está configurado (el workflow actual corre sin errores en ese paso).

## Qué hace el workflow

```
1. Checkout → descarga el código
2. Validar secretos (con continue-on-error → no bloquea si falla)
3. Generar js/sheets-config.js → inyecta la URL de Sheets
4. Deploy to Firebase Hosting → sube HTML/CSS/JS a firebase.app
5. Deploy Firestore Rules → actualiza firestore.rules (módulo fidelización)
```

**Actualmente**:
- ✅ Pasos 2–3 funcionan
- ❌ Paso 4 requiere FIREBASE_SERVICE_ACCOUNT (aún no configurado)
- ⚠️ Paso 5 puede ejecutarse si el secreto existe, sino se salta

## Despliegue manual mientras se configura el secreto

Si necesitas desplegar sin esperar a que se configure el secreto:

```bash
# Instalar Firebase CLI si no está
npm install -g firebase-tools

# Autenticarse
firebase login

# Desplegar todo
firebase deploy --project la-sucursal-del-cafe

# O solo una parte
firebase deploy --only hosting --project la-sucursal-del-cafe
firebase deploy --only firestore:rules --project la-sucursal-del-cafe
```

## Próximos pasos

1. **Obtener y configurar FIREBASE_SERVICE_ACCOUNT** → desbloquea despliegue automático a Hosting
2. Desplegar manualmente una vez para verificar que el sitio es vivo
3. Agregar alertas/notifications cuando algo falla

## Notas de seguridad

- El secreto FIREBASE_SERVICE_ACCOUNT nunca debería exponerse (es un JSON con credenciales reales).
- GitHub encripta secretos automáticamente; no aparecen en logs ni en el historio del repo.
- Los secretos pueden rotarse/revocarse desde Google Cloud → IAM en cualquier momento.
