# Configurar Google Wallet — Fidelización La Sucursal del Café

Guía paso a paso para que el botón **«Agregar a Google Wallet»** en `/mi-tarjeta` abra un pass nativo con QR, puntos y nivel.

## Resumen rápido

| Paso | Qué haces | Automático en CI |
|------|-----------|------------------|
| Issuer ID `3388000000023162431` | Cuenta `lasucursaldelcafe@gmail.com` en Wallet Console | Sí (workflow) |
| Cuenta de servicio Firebase | `FIREBASE_SERVICE_ACCOUNT` en GitHub (Admin SDK) | Sí |
| Deploy `generateWalletPass` | Push a `main` | Sí |

**No necesitas** `google-wallet-sa.json` ni invitar `@appspot`. CI usa la misma clave que el deploy de Hosting.

```bash
# Local (con firebase-hosting-sa.json):
py tools/setup_google_wallet.py --auto
```

---

## Paso 1 — Issuer ID (Google Wallet Console)

1. Abre [Google Pay & Wallet Console](https://pay.google.com/business/console).
2. Crea una cuenta de emisor (Issuer) si no tienes una.
3. Anota tu **Issuer ID** (número, ej. `3388000000022345678`).

> Sin Issuer ID no se puede firmar ningún pass.

---

## Alternativa recomendada — Sin clave JSON (si Google bloquea descargar JSON)

Muchos proyectos Firebase **no permiten** crear claves JSON (`Service account key creation is disabled`).  
En ese caso **no necesitas descargar ningún archivo**.

### Qué haces (5 pasos)

1. Entra con **`lasucursaldelcafe@gmail.com`** a [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=la-sucursal-del-cafe).
2. Copia el email de una cuenta que **aparezca en la lista** (no inventes el email). Prioridad:
   - `firebase-adminsdk-xxxxx@la-sucursal-del-cafe.iam.gserviceaccount.com` (la que ya trae Firebase)
   - Si existe: `la-sucursal-del-cafe@appspot.gserviceaccount.com`
   - O crea `google-wallet-issuer` → su email termina en `@la-sucursal-del-cafe.iam.gserviceaccount.com`
3. Habilita APIs:
   - [Google Wallet API](https://console.cloud.google.com/apis/library/wallet.googleapis.com?project=la-sucursal-del-cafe)
   - [IAM Credentials API](https://console.cloud.google.com/apis/library/iamcredentials.googleapis.com?project=la-sucursal-del-cafe)
4. En [Wallet Console](https://pay.google.com/business/console) → **Users** → **Invite user** → pega ese email `@appspot.gserviceaccount.com` → rol **Developer**.
5. Configura y despliega (sin JSON):

```bash
py tools/setup_google_wallet.py --sin-json --issuer-id 3388000000023162431 --configurar-firebase
py tools/setup_google_wallet.py --deploy
```

La Cloud Function firma el pass con la API **IAM signJwt** (la clave privada nunca sale de Google).

### Si signJwt falla con permisos

En [IAM](https://console.cloud.google.com/iam-admin/iam?project=la-sucursal-del-cafe), la cuenta `...@appspot.gserviceaccount.com` debe poder firmar como sí misma. En Cloud Shell (opcional):

```bash
gcloud iam service-accounts add-iam-policy-binding \
  la-sucursal-del-cafe@appspot.gserviceaccount.com \
  --project=la-sucursal-del-cafe \
  --member="serviceAccount:la-sucursal-del-cafe@appspot.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"
```

---

## Paso 2 — Google Cloud con JSON (solo si puedes descargar clave)

Proyecto: **`la-sucursal-del-cafe`**

1. [APIs & Services → Library](https://console.cloud.google.com/apis/library) → habilita **Google Wallet API**.
2. [IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts) → **Create service account**
   - Nombre: `google-wallet-issuer`
   - Rol: ninguno obligatorio en IAM (el permiso real está en Wallet Console).
3. En la cuenta → **Keys** → **Add key** → **JSON** → descarga el archivo.
4. Guárdalo como (gitignored):

```
tools/credentials/google-wallet-sa.json
```

---

## Paso 3 — Autorizar la cuenta de servicio en Wallet

1. Vuelve a [Wallet Console](https://pay.google.com/business/console).
2. **Users** (o Usuarios) → **Invite user**.
3. Pega el email de la cuenta de servicio (`...@...iam.gserviceaccount.com`).
4. Rol: **Developer** (o equivalente con permiso de emitir passes).

> Si omites este paso, el JWT se firma pero Google rechaza el pass.

---

## Paso 4 — Variables en Firebase Functions

Desde la raíz del repo (con Firebase CLI instalado y login hecho):

```bash
# Issuer ID numérico de Wallet Console
firebase functions:config:set wallet.issuer_id="TU_ISSUER_ID" --project la-sucursal-del-cafe

# JSON de la cuenta de servicio (una línea; en PowerShell usa el script Python)
py tools/setup_google_wallet.py --configurar-firebase
```

El script lee `tools/credentials/google-wallet-sa.json` y configura:

- `wallet.issuer_id`
- `wallet.service_account` (JSON completo)
- `wallet.class_suffix` (opcional, default `la_sucursal_fidelizacion`)

**Alternativa manual (PowerShell):**

```powershell
$json = Get-Content -Raw -Encoding UTF8 tools\credentials\google-wallet-sa.json
firebase functions:config:set wallet.service_account="$json" wallet.issuer_id="TU_ISSUER_ID" --project la-sucursal-del-cafe
```

---

## Paso 5 — Desplegar

```bash
cd functions && npm install && cd ..
firebase deploy --only functions:generateWalletPass,hosting --project la-sucursal-del-cafe
```

O con el script:

```powershell
py tools/setup_google_wallet.py --deploy
```

La Cloud Function queda en:

```
https://us-central1-la-sucursal-del-cafe.cloudfunctions.net/generateWalletPass
```

El cliente (`js/wallet-qr.js`) la detecta automáticamente desde `FIREBASE_FIDELIZACION_CONFIG.projectId`.

---

## Paso 6 — Probar

1. En Android, abre una tarjeta:  
   `https://la-sucursal-del-cafe.web.app/mi-tarjeta?id=ID_CLIENTE`
2. Toca **+ Agregar a Google Wallet**.
3. Debe abrir Google Wallet / Google Pay con el pass.
4. El QR debe ser escaneable en caja (valor = `clienteId` de Firestore).

### Errores frecuentes

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `GOOGLE_WALLET_ISSUER_ID no configurado` | Falta config en Functions | Paso 4 |
| `403` / pass inválido | SA no invitada en Wallet Console | Paso 3 |
| «Correo no está en ninguna cuenta de Google» | SA no existe en GCP o Issuer en otra cuenta Google | Sección troubleshooting abajo |
| `Wallet API has not been used` | API no habilitada | Paso 2 |
| Botón abre solo la web | Function no desplegada o error 500 | Paso 5 + logs Firebase |
| Pass en revisión | Normal la primera vez | Wallet Console → aprobar clase |

Ver logs:

```bash
firebase functions:log --only generateWalletPass --project la-sucursal-del-cafe
```

---

## «Ese correo no está en ninguna cuenta de Google»

Wallet muestra esto cuando el email **no existe** en el proyecto Google Cloud del Issuer, o cuando el Issuer y Firebase están en **cuentas Google distintas**.

### Checklist (en orden)

**1. Misma cuenta Google en todo**

| Consola | Usa |
|---------|-----|
| Firebase / Google Cloud | `lasucursaldelcafe@gmail.com` |
| Wallet Console (Issuer `3388000000023162431`) | **La misma** `lasucursaldelcafe@gmail.com` si es posible |

Si el Issuer lo creó `pabcolgom@gmail.com` pero el proyecto Firebase es de `lasucursaldelcafe@gmail.com`, Wallet **no** encontrará las cuentas de servicio del proyecto. Solución: entrar a Wallet con `lasucursaldelcafe@gmail.com` o crear el Issuer desde esa cuenta.

**2. Copiar un email que exista de verdad**

Abre [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=la-sucursal-del-cafe) con `lasucursaldelcafe@gmail.com`.

¿Ves `la-sucursal-del-cafe@appspot.gserviceaccount.com` en la lista?

- **No** → no la invites (no existe). Usa en su lugar:
  - `firebase-adminsdk-XXXX@la-sucursal-del-cafe.iam.gserviceaccount.com`
- **Sí** → puedes invitarla, pero `@iam.gserviceaccount.com` suele funcionar mejor.

**3. Crear cuenta solo para Wallet (sin JSON)**

En Service Accounts → **CREATE** → nombre `google-wallet-issuer` → **DONE**.

Copia el email exacto (termina en `@la-sucursal-del-cafe.iam.gserviceaccount.com`) e invítalo en Wallet → Users → Developer.

**4. Recrear appspot si falta** (solo si necesitas esa cuenta)

En [Cloud Shell](https://console.cloud.google.com/?project=la-sucursal-del-cafe):

```bash
gcloud app create --region=us-central
```

O desactiva y reactiva Cloud Functions API (a veces recrea appspot).

**5. Cuentas de prueba (para probar en el móvil)**

En Wallet Console → **Manage** → **Test accounts** → añade `lasucursaldelcafe@gmail.com` (Gmail sí vale aquí).

### Si nada de lo anterior funciona

Google Wallet exige alinear Issuer + proyecto GCP + cuenta de servicio. Opciones:

1. Soporte Google Pay & Wallet Console (feedback en la consola).
2. **Plan B (ya funciona hoy):** tarjeta web en `/mi-tarjeta` con QR — no requiere Wallet nativo.

---

## Arquitectura

```
mi-tarjeta.html
    → WalletQR.abrirWallet(clienteId, datos)
    → POST generateWalletPass (Firebase Function)
    → JWT firmado (loyaltyClass + loyaltyObject)
    → https://pay.google.com/gp/v/save/{jwt}
    → Google Wallet app
```

Archivos clave:

| Archivo | Rol |
|---------|-----|
| `functions/wallet.js` | Firma JWT del pass |
| `functions/index.js` | Exporta `generateWalletPass` |
| `js/wallet-qr.js` | Cliente en el navegador |
| `js/wallet-config.example.js` | Override opcional de URL |

---

## Costos

Google Wallet API: **gratis**.  
Firebase Functions: capa gratuita generosa (2M invocaciones/mes).

---

## Referencias

- [Loyalty cards — JWT](https://developers.google.com/wallet/retail/loyalty-cards/use-cases/jwt)
- [Autenticación REST](https://developers.google.com/wallet/retail/loyalty-cards/getting-started/auth/rest)
- `WALLET-IMPLEMENTATION.md` — notas técnicas del repo
