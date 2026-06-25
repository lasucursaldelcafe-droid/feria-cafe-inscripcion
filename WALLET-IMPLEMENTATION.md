# Google Wallet Integration — Guía de implementación

## Estado actual

**Fase 2 implementada** en el código:

- Cloud Function `generateWalletPass` (`functions/wallet.js`)
- Cliente `js/wallet-qr.js` llama a la función automáticamente
- Guía de configuración: [`GOOGLE-WALLET-SETUP.md`](GOOGLE-WALLET-SETUP.md)
- Script asistente: `py tools/setup_google_wallet.py`

Falta **configurar credenciales** en tu proyecto Firebase (Issuer ID + cuenta de servicio). Sin eso, el botón muestra un mensaje de error y sugiere guardar la tarjeta web.

## Fase 1 (workaround anterior)

El botón redirigía solo a la tarjeta web. Eso sigue siendo el fallback si Wallet no está configurado.

### 1. Crear proyecto en Google Wallet Console

1. Ir a https://developers.google.com/wallet (aún en Partners Console)
2. Crear proyecto (si no existe)
3. Configurar "Loyalty Program" class:
   - **Class ID**: `la-sucursal-del-cafe.fidelizacion`
   - **Issuer name**: La Sucursal del Café
   - **Logo**: subir logo de marca (128x128px)
   - **Banner**: fondo para la tarjeta

### 2. Obtener credenciales

1. En el mismo proyecto → **Credentials** → **Service Account**
2. Crear una cuenta de servicio nueva si no existe
3. Crear **JSON private key** → esto es lo que necesitas para firmar passes

### 3. Crear Cloud Function que firme passes

Archivo: `functions/generateWalletPass.js` (crear esta carpeta y archivo)

```javascript
const functions = require('@google-cloud/functions-framework');
const jwt = require('jsonwebtoken');

functions.http('generateWalletPass', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    return res.sendStatus(204);
  }

  try {
    const { clienteId, nombre, puntos, nivel } = req.body;
    if (!clienteId || !nombre) {
      return res.status(400).json({ error: 'Faltan clienteId o nombre' });
    }

    // Obtener service account desde variable de entorno
    const serviceAccountJson = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT;
    if (!serviceAccountJson) {
      return res.status(500).json({ error: 'Credenciales no configuradas' });
    }
    const serviceAccount = JSON.parse(serviceAccountJson);

    // Construir objeto del pass (Loyalty Object)
    const passPayload = {
      iss: serviceAccount.client_email,
      aud: 'google',
      typ: 'savetowallet',
      origins: ['https://la-sucursal-del-cafe.web.app'],
      payload: {
        loyaltyObjects: [
          {
            id: `la-sucursal-del-cafe.${clienteId}`,
            classId: 'la-sucursal-del-cafe.fidelizacion',
            state: 'ACTIVE',
            heroImage: {
              sourceUri: {
                uri: 'https://la-sucursal-del-cafe.web.app/assets/logo-la-sucursal-del-cafe.png'
              }
            },
            logo: {
              sourceUri: {
                uri: 'https://la-sucursal-del-cafe.web.app/assets/logo-la-sucursal-del-cafe.png'
              }
            },
            textModulesData: [
              {
                id: 'nombreCliente',
                header: nombre,
                body: 'Cliente fidelización'
              },
              {
                id: 'nivel',
                header: nivel || 'Bronce',
                body: 'Nivel actual'
              },
              {
                id: 'puntos',
                header: (puntos || 0).toString(),
                body: 'Puntos disponibles'
              }
            ],
            infoModuleData: {
              showLastUpdateTime: true
            },
            barcode: {
              type: 'QR_CODE',
              value: clienteId,
              alternateText: clienteId
            },
            accountId: clienteId,
            accountName: nombre
          }
        ]
      }
    };

    // Firmar con JWT
    const iat = Math.floor(Date.now() / 1000);
    const signedPass = jwt.sign(passPayload, serviceAccount.private_key, {
      algorithm: 'RS256',
      issuer: serviceAccount.client_email,
      audience: 'google',
      iat: iat,
      exp: iat + 3600
    });

    // URL para abrir en Google Wallet (mobile) o Save to Wallet (web)
    const walletUrl = `https://pay.google.com/gp/v/save/${signedPass}`;

    return res.json({
      success: true,
      walletUrl: walletUrl,
      passId: `la-sucursal-del-cafe.${clienteId}`
    });
  } catch (err) {
    console.error('Error generando pass:', err);
    return res.status(500).json({ error: err.message });
  }
});
```

### 4. Desplegar Cloud Function

```bash
# Instalar Firebase CLI si no está
npm install -g firebase-tools

# Inicializar functions en el proyecto (si no existe)
firebase init functions --project la-sucursal-del-cafe

# Instalar dependencias
cd functions
npm install jsonwebtoken

# Configurar la variable de entorno con el service account
firebase functions:config:set wallet.service_account='{"type":"service_account",...}'

# Desplegar
firebase deploy --only functions --project la-sucursal-del-cafe
```

### 5. Actualizar `js/wallet-qr.js` y `mi-tarjeta.html`

En `js/wallet-qr.js`, reemplazar la función `abrirWallet` para llamar a la Cloud Function:

```javascript
abrirWallet: async function(clienteId, clienteData) {
  const response = await fetch('https://tu-region-la-sucursal-del-cafe.cloudfunctions.net/generateWalletPass', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clienteId: clienteId,
      nombre: clienteData.nombre,
      puntos: clienteData.puntos,
      nivel: clienteData.nivel
    })
  });
  
  const result = await response.json();
  if (result.walletUrl) {
    window.open(result.walletUrl, '_blank');
  } else {
    alert('Error al generar pass: ' + result.error);
  }
}
```

## Cronograma recomendado

- **Hoy (fase 1)**: Botón funcional que redirige a tarjeta digital
- **Semana 1**: Crear Cloud Function local y testear
- **Semana 2**: Desplegar a producción con Google Wallet oficial
- **Resultado final**: Clientes pueden agregar la tarjeta a Google Wallet con un tap

## Validación / QA

1. En celular Android: abrir `/mi-tarjeta.html` → tap "Agregar a Google Wallet" → debe abrir la app de Google Wallet (si está instalada) o Google Pay
2. El pass debería mostrar el QR, nombre, puntos y nivel
3. El código QR debería ser escaneable desde caja

## Precios / costos

Google Wallet API es **gratis** (no hay límite de passes). Solo pagas por Firestore (que ya está activado) y Cloud Functions (primeras 2M invocaciones/mes son gratis).

## Apoyo técnico

- Docs oficiales: https://developers.google.com/wallet/loyalty/rest
- CodeLab: https://codelabs.developers.google.com/codelabs/save-to-wallet-loyalty
