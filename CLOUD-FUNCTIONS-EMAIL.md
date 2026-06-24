# Cloud Functions — Email + QR automático

## Estado

Cloud Functions están creadas y listas para desplegar. Cuando un cliente se registra en `/registro-fidelizacion`, automáticamente recibe un email con:
- ✅ Su QR en código (imagen)
- ✅ Link a su tarjeta digital
- ✅ Instrucciones de cómo funciona

## Instalación

### Paso 1: Instalar Firebase CLI (si no está)
```bash
npm install -g firebase-tools
firebase login
```

### Paso 2: Elegir servicio de email

#### **Opción A: Gmail (más simple)**

1. Crear una contraseña de aplicación:
   - Ir a: https://myaccount.google.com/apppasswords
   - Seleccionar "Mail" y "Windows"
   - Copiar la contraseña generada

2. Configurar las variables:
```bash
firebase functions:config:set smtp.host="smtp.gmail.com" \
  smtp.port="587" \
  smtp.user="tu-email@gmail.com" \
  smtp.pass="app-password-generada" \
  smtp.from="noreply@la-sucursal-del-cafe.com"

firebase functions:config:set hosting.url="https://la-sucursal-del-cafe.web.app"
```

3. Desplegar:
```bash
firebase deploy --only functions --project la-sucursal-del-cafe
```

**Ventajas**: Gratis, fácil configuración  
**Desventajas**: Puede tener límites de rate, menos profesional

---

#### **Opción B: SendGrid (recomendado)**

1. Crear cuenta: https://sendgrid.com (free tier: 100 emails/día)

2. Obtener API Key:
   - Settings → API Keys → Create API Key
   - Copiar la clave

3. Instalar SendGrid:
```bash
cd functions
npm install --save @sendgrid/mail
cd ..
```

4. Actualizar `functions/index.js` — reemplazar la función de envío con:

```javascript
const sgMail = require('@sendgrid/mail');

exports.enviarTarjetaAlRegistro = functions.firestore
  .document('fidelizacion_clientes/{clienteId}')
  .onCreate(async (snap, context) => {
    const clienteId = snap.id;
    const cliente = snap.data();

    if (!cliente.email) return null;

    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      
      const urlTarjeta = `https://la-sucursal-del-cafe.web.app/mi-tarjeta.html?id=${encodeURIComponent(clienteId)}`;
      const urlQR = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(clienteId)}`;

      await sgMail.send({
        to: cliente.email,
        from: 'noreply@la-sucursal-del-cafe.com',
        subject: '¡Tu tarjeta de fidelización está lista! - La Sucursal del Café',
        html: `
          <h2>Hola ${cliente.nombre}</h2>
          <p>Tu tarjeta de fidelización está lista.</p>
          <img src="${urlQR}" alt="Tu QR" style="max-width:200px; border: 2px solid #ddd; border-radius: 8px;" />
          <p>Muestra este QR en caja al comprar para acumular puntos.</p>
          <a href="${urlTarjeta}" style="display:inline-block; background:#C1272D; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Ver mi tarjeta digital</a>
          <p style="font-size:12px; color:#666;">ID: ${clienteId}</p>
        `
      });

      console.log(`✓ Email enviado a ${cliente.email}`);
      return { sent: true };
    } catch (error) {
      console.error('Error:', error);
      return { sent: false, error: error.message };
    }
  });
```

5. Configurar variables:
```bash
firebase functions:config:set sendgrid.api_key="SG_xxxxx" \
  hosting.url="https://la-sucursal-del-cafe.web.app"
```

6. Desplegar:
```bash
firebase deploy --only functions --project la-sucursal-del-cafe
```

**Ventajas**: Profesional, confiable, analytics, free tier generoso  
**Desventajas**: Requiere cuenta externa (pero gratis)

---

#### **Opción C: Resend (alternativa moderna)**

Similar a SendGrid pero más simple. Crear cuenta en https://resend.com (100 emails/día gratis).

---

## Despliegue

Una vez configurado el servicio, desplegar:

```bash
firebase deploy --only functions --project la-sucursal-del-cafe
```

Verás algo como:
```
✔  Deploy complete!

Function URL (reenviarTarjeta): https://us-central1-la-sucursal-del-cafe.cloudfunctions.net/reenviarTarjeta
```

---

## Testing

### Test 1: Registrar un cliente de prueba

1. Abre https://la-sucursal-del-cafe.web.app/registro-fidelizacion
2. Llena el formulario con:
   - Nombre: "Test User"
   - Teléfono: "3001234567"
   - Email: tu-email@ejemplo.com
3. Click "Crear mi tarjeta"

En ~5 segundos deberías recibir un email con el QR.

### Test 2: Re-enviar tarjeta (desde el panel admin)

Próximamente: agregar botón "Re-enviar email" en el panel admin para cada cliente.

---

## Troubleshooting

### "Envío de email fallando"

1. Verifica los logs:
```bash
firebase functions:log --project la-sucursal-del-cafe
```

2. Revisa que las variables estén configuradas:
```bash
firebase functions:config:get --project la-sucursal-del-cafe
```

3. Si usas Gmail y falla: la contraseña de app podría ser incorrecta. Genera una nueva.

### "El email llega a spam"

SendGrid ayuda, pero también:
- Usa un dominio propio (noreply@tudominio.com)
- Configura SPF/DKIM en tu DNS
- SendGrid tiene guías para esto

---

## Versión simplificada (sin Cloud Functions)

Si prefieres no usar Functions, puedes:

1. Enviar email manualmente desde el panel admin (botón "Enviar QR por email")
2. Usar un servicio externo como Zapier o Make.com para disparar emails cuando se registre cliente
3. Integrar con WhatsApp Business API en lugar de email

---

## Costos

- **Gmail**: Gratis (pero limitado)
- **SendGrid**: Gratis hasta 100 emails/día, $20/mes para 100k emails/mes
- **Resend**: Similar a SendGrid
- **Cloud Functions**: Primeras 2M invocaciones/mes son gratis

---

## Próximos pasos

1. ✅ Cloud Functions creadas (`functions/index.js`)
2. ⏳ Elegir servicio de email (A, B o C)
3. ⏳ Configurar variables de entorno
4. ⏳ Desplegar: `firebase deploy --only functions`
5. ⏳ Testear con un cliente de prueba
6. ⏳ (Opcional) Agregar botón de re-envío en panel admin
