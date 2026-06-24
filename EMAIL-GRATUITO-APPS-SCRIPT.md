# Email Gratuito — Usar Google Apps Script (SIN COSTO)

## ¿Por qué esta opción?

✅ **GRATIS** — Gmail nativo de Google Apps Script  
✅ **YA FUNCIONA** — Mismo script que envía emails de competencia  
✅ **SIN CUENTAS EXTERNAS** — No necesita SendGrid ni nada más  
✅ **CONFIABLE** — Usado en producción en La Sucursal del Café

---

## PASO 1: Agregar función en Google Apps Script

El archivo que necesitas editar está en:
**Google Sheets → Extensions → Apps Script**

O acceder directamente: https://script.google.com

---

### PASO 1.1: Buscar el proyecto correcto

1. Abre https://script.google.com
2. En la lista, busca y abre el proyecto llamado **"La Sucursal del Café"** (o similar)
3. Deberías ver el archivo **Code.gs** con todo el código

---

### PASO 1.2: Agregar la función de email

Al final del archivo **Code.gs**, pega esto:

```javascript
// ========== FIDELIZACIÓN — Envío de email con QR ==========

function enviarEmailFidelizacion(email, nombre, clienteId) {
  if (!email || !nombre || !clienteId) {
    Logger.log('❌ Parámetros inválidos');
    return false;
  }

  try {
    var urlTarjeta = 'https://la-sucursal-del-cafe.web.app/mi-tarjeta.html?id=' + encodeURIComponent(clienteId);
    var urlQR = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(clienteId);

    var subject = '¡Tu tarjeta de fidelización está lista! 🎯 ☕ — La Sucursal del Café';
    
    var htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; color: #4B352A; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4B352A, #5D3A1A); color: #fff; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
          .content { background: #f9f7f4; padding: 20px; border-radius: 0 0 10px 10px; }
          .qr-box { text-align: center; margin: 20px 0; }
          .qr-box img { max-width: 200px; border: 2px solid #D9D4C8; border-radius: 8px; }
          .button { display: inline-block; background: #C1272D; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; }
          .footer { font-size: 12px; color: #999; text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>¡Bienvenido a La Sucursal del Café!</h1>
            <p>Tu tarjeta de fidelización está lista</p>
          </div>
          <div class="content">
            <p>Hola <strong>${nombre}</strong>,</p>
            
            <p>Gracias por registrarte en nuestro programa de fidelización. A partir de ahora, cada compra te acumulará puntos que podrás canjear por recompensas.</p>
            
            <h3>Tu código QR:</h3>
            <div class="qr-box">
              <img src="${urlQR}" alt="Tu código QR" />
              <p style="font-size: 12px; color: #666; margin: 5px 0;">Muestra este QR en caja al comprar</p>
            </div>
            
            <h3>Cómo funciona:</h3>
            <ul>
              <li>🎯 Cada compra suma puntos (según monto)</li>
              <li>⬆️ Acumula puntos → sube de nivel: Bronce → Plata → Oro → Diamante</li>
              <li>🎁 Canjea puntos por recompensas exclusivas</li>
            </ul>
            
            <p style="text-align: center;">
              <a href="${urlTarjeta}" class="button">Ver mi tarjeta digital</a>
            </p>
            
            <p style="font-size: 12px; color: #666;">
              <strong>Tu ID de cliente:</strong> ${clienteId}<br>
              Guárdalo o usa el QR arriba.
            </p>
          </div>
          <div class="footer">
            <p>© 2026 La Sucursal del Café · Apoya lo nuestro, toma café colombiano.</p>
            <p>¿Preguntas? Escribenos por WhatsApp o aquí.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    GmailApp.sendEmail(email, subject, '', { htmlBody: htmlBody });
    Logger.log('✓ Email enviado a ' + email);
    return true;
  } catch (err) {
    Logger.log('❌ Error enviando email: ' + err);
    return false;
  }
}
```

---

## PASO 2: Llamar la función desde Cloud Functions

En el archivo `functions/index.js`, **reemplaza** la función `exports.enviarTarjetaAlRegistro` con esto:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.enviarTarjetaAlRegistro = functions.firestore
  .document('fidelizacion_clientes/{clienteId}')
  .onCreate(async (snap, context) => {
    const clienteId = snap.id;
    const cliente = snap.data();

    if (!cliente.email) {
      console.log(`Cliente ${clienteId} sin email`);
      return null;
    }

    try {
      // Llamar al Apps Script via Web App
      const appsScriptUrl = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/d/TU_SCRIPT_ID/usercodeapp';
      
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enviarEmailFidelizacion',
          email: cliente.email,
          nombre: cliente.nombre,
          clienteId: clienteId
        })
      });

      const result = await response.json();
      console.log(`Email a ${cliente.email}:`, result);
      return result;
    } catch (error) {
      console.error(`Error enviando email a ${cliente.email}:`, error);
      return { sent: false, error: error.message };
    }
  });
```

---

## PASO 3: Obtener Script ID del Apps Script

1. Abre tu proyecto en Google Apps Script
2. Click en el ícono de **engranaje** ⚙️ (Project settings)
3. Copia el **Script ID** (algo como `1abc2def3ghi...`)

---

## PASO 4: Configurar en Firebase

```bash
firebase functions:config:set apps_script.url="https://script.google.com/macros/d/TU_SCRIPT_ID/usercodeapp" \
  --project la-sucursal-del-cafe
```

(Reemplaza `TU_SCRIPT_ID` con el que copiaste)

---

## PASO 5: Desplegar Cloud Functions

```bash
firebase deploy --only functions --project la-sucursal-del-cafe
```

---

## RESULTADO

✅ **TODO GRATIS**
✅ **Sin cuentas externas**
✅ **Usa el mismo script que ya funciona**
✅ **Emails llegan desde Gmail de Google Apps Script**

---

## COSTO FINAL

| Servicio | Costo |
|----------|-------|
| Google Apps Script | $0 (gratis) |
| Firebase Cloud Functions | $0 (2M invocaciones/mes gratis) |
| Gmail nativo | $0 (gratis) |
| **TOTAL** | **$0** |

---

## ⏱️ TIEMPO

- Agregar función a Code.gs: **2 min**
- Actualizar functions/index.js: **2 min**
- Desplegar: **3 min**
- Test: **2 min**
- **TOTAL: ~9 minutos**

---

## 🚀 SIGUIENTE: ¿EMPEZAMOS?

¿Quieres que te ayude a:
1. Encontrar el Code.gs exacto
2. Insertar la función
3. Desplegar

Solo di "continúa" y te lo hago paso a paso.
