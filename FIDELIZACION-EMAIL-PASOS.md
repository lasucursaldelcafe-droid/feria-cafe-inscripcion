# Email de Fidelización — Guía Paso a Paso

**Objetivo:** Cuando un cliente se registra en `/registro-fidelizacion`, recibe automáticamente un email con su QR.

**Tiempo total:** ~15 minutos

---

## PASO 1: Crear cuenta SendGrid (gratuita)

**Por qué SendGrid:** Es lo mismo que usas en Apps Script, pero más robusto. 100 emails/día gratis. Es el estándar para este tipo de aplicaciones.

1. Abre: https://sendgrid.com/free
2. Crea una cuenta con tu email
3. Completa el email de verificación (revisa spam)
4. Inicia sesión

---

## PASO 2: Obtener la API Key de SendGrid

1. Después de iniciar sesión, busca el menú lateral → **Settings** (engranaje)
2. Click **API Keys**
3. Botón **Create API Key** (azul)
4. Llena:
   - **API Key Name:** `La Sucursal del Cafe - Fidelizacion`
   - **Permissions:** Selecciona solo **Mail Send**
5. Click **Create & Copy** (copía la clave)

**Guarda esa clave en un lugar seguro** (la vamos a usar en 2 minutos).

---

## PASO 3: Configurar la API Key en Firebase

Abre una terminal/CMD en tu computadora y copia-pega esto (reemplaza `SG_xxxxx` con tu clave):

```bash
firebase functions:config:set sendgrid.api_key="SG_xxxxx" --project la-sucursal-del-cafe
```

**Ejemplo real:**
```bash
firebase functions:config:set sendgrid.api_key="SG_abc123def456ghi" --project la-sucursal-del-cafe
```

Deberías ver:
```
✓ Config updated successfully
```

---

## PASO 4: Instalar SendGrid en Cloud Functions

En la misma terminal, corre:

```bash
cd tu-repo/functions
npm install --save @sendgrid/mail
cd ..
```

Deberías ver algo como:
```
added X packages
```

---

## PASO 5: Actualizar el código de Cloud Functions

Abre el archivo `functions/index.js` (en tu editor o en GitHub).

**Reemplaza** la función `exports.enviarTarjetaAlRegistro` completa con esto:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

admin.initializeApp();

exports.enviarTarjetaAlRegistro = functions.firestore
  .document('fidelizacion_clientes/{clienteId}')
  .onCreate(async (snap, context) => {
    const clienteId = snap.id;
    const cliente = snap.data();

    // Si no tiene email, no enviamos
    if (!cliente.email) {
      console.log(`Cliente ${clienteId} sin email`);
      return null;
    }

    try {
      // Configurar SendGrid
      const apiKey = process.env.SENDGRID_API_KEY;
      if (!apiKey) {
        console.log('⚠️ SendGrid API key no configurada');
        return null;
      }
      sgMail.setApiKey(apiKey);

      // Generar URLs
      const urlTarjeta = `https://la-sucursal-del-cafe.web.app/mi-tarjeta.html?id=${encodeURIComponent(clienteId)}`;
      const urlQR = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(clienteId)}`;

      // Enviar email
      await sgMail.send({
        to: cliente.email,
        from: 'noreply@la-sucursal-del-cafe.com',
        subject: '¡Tu tarjeta de fidelización está lista! 🎯 ☕',
        html: `
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
                <p>Hola <strong>${cliente.nombre}</strong>,</p>
                
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
        `
      });

      console.log(`✓ Email enviado a ${cliente.email}`);
      return { sent: true, email: cliente.email };
    } catch (error) {
      console.error(`Error enviando email a ${cliente.email}:`, error);
      return { sent: false, error: error.message };
    }
  });
```

---

## PASO 6: Desplegar a Firebase

En tu terminal:

```bash
firebase deploy --only functions --project la-sucursal-del-cafe
```

Deberías ver:
```
✔ Deploy complete!

Function URL (enviarTarjetaAlRegistro): https://us-central1-la-sucursal-del-cafe.cloudfunctions.net/enviarTarjetaAlRegistro
```

---

## PASO 7: Probar que funciona

1. Abre: https://la-sucursal-del-cafe.web.app/registro-fidelizacion
2. Registra un cliente TEST:
   - **Nombre:** Test User
   - **Teléfono:** 3001234567
   - **Email:** tu-email@gmail.com (usa TU email real para ver si llega)
3. Click "Crear mi tarjeta"
4. Espera ~10 segundos
5. Revisa tu bandeja de entrada (y spam)

**Deberías recibir un email con el QR 🎉**

---

## ¿Qué hicimos?

| Paso | Qué | Resultado |
|------|-----|-----------|
| 1-2 | Crear SendGrid + API Key | Servicio de email listo |
| 3 | Configurar API Key en Firebase | Firebase puede usar SendGrid |
| 4-5 | Actualizar código + instalar paquete | Cloud Function lista para enviar |
| 6 | Desplegar | Función viva en producción |
| 7 | Test | Email real enviado |

---

## Troubleshooting

### "El email no llega"
1. Revisa spam/promotions
2. Verifica que el email sea correcto en el formulario
3. Revisa los logs: `firebase functions:log --project la-sucursal-del-cafe`

### "Error de API Key"
```bash
firebase functions:config:get --project la-sucursal-del-cafe
```
Deberías ver:
```
{
  "sendgrid": {
    "api_key": "SG_xxxxx"
  }
}
```

### "npm install falló"
```bash
cd functions
npm install @sendgrid/mail
cd ..
firebase deploy --only functions
```

---

## Siguientes pasos (opcional)

1. **Personalizar el email:** Edita el HTML en `functions/index.js` para agregar tu logo, cambiar colores, etc.
2. **Botón de re-envío en el panel admin:** Agregar opción para re-enviar QR a un cliente (si lo solicitó)
3. **Enviar por WhatsApp también:** Agregar un servicio de WhatsApp Business (más adelante)

---

## Costos

- **SendGrid:** Gratis hasta 100 emails/día
- **Cloud Functions:** Primeras 2M invocaciones/mes gratis
- **Total:** 💰 **GRATIS**

---

**¿Dudas en algún paso? Revisa `CLOUD-FUNCTIONS-EMAIL.md` para más detalle.**
