const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const { createGenerateWalletPassHandler } = require('./wallet');

// Inicializar Firebase Admin
admin.initializeApp();

exports.generateWalletPass = createGenerateWalletPassHandler();

/**
 * OPCIÓN A: Usar Gmail (requiere contraseña de aplicación)
 * OPCIÓN B: Usar SendGrid, Mailgun, Resend (más seguro)
 * 
 * POR AHORA: Usar un transporte genérico SMTP (configurable vía env vars)
 */

// Configurar transporte de email
// Reemplaza con tus credenciales en firebase functions:config:set
let transporter;

exports.enviarTarjetaAlRegistro = functions.firestore
  .document('fidelizacion_clientes/{clienteId}')
  .onCreate(async (snap, context) => {
    const clienteId = snap.id;
    const cliente = snap.data();

    // Validar que tenga email
    if (!cliente.email) {
      console.log(`Cliente ${clienteId} sin email, saltando envío`);
      return null;
    }

    try {
      console.log(`Enviando tarjeta a ${cliente.email}...`);

      // Generar URL de tarjeta digital
      const urlTarjeta = `${process.env.HOSTING_URL || 'https://la-sucursal-del-cafe.web.app'}/pasaporte?id=${encodeURIComponent(clienteId)}`;

      // Generar URL del QR (usando API gratuita)
      const urlQR = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent('LSCPAS:' + clienteId)}`;

      // HTML del email
      const htmlEmail = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Inter, sans-serif; color: #4B352A; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4B352A, #5D3A1A); color: #fff; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: #f9f7f4; padding: 20px; border-radius: 0 0 10px 10px; }
            .qr-box { text-align: center; margin: 20px 0; }
            .qr-box img { max-width: 200px; border: 2px solid #D9D4C8; border-radius: 8px; }
            .button { display: inline-block; background: #C1272D; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 10px; }
            .footer { font-size: 12px; color: #999; text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; }
            .badge { display: inline-block; background: #A86B3C; color: #fff; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; margin: 10px 0; }
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
              
              <div class="badge">Bronce</div>
              
              <p><strong>Tu código QR:</strong></p>
              <div class="qr-box">
                <img src="${urlQR}" alt="Tu código QR" />
                <p style="font-size: 12px; color: #666; margin: 5px 0;">Muestra este QR en caja al comprar</p>
              </div>
              
              <p><strong>Cómo funciona:</strong></p>
              <ul>
                <li>🎯 Cada compra suma puntos (según monto)</li>
                <li>⬆️ Acumula puntos → sube de nivel: Bronce → Plata → Oro → Diamante</li>
                <li>🎁 Canjea puntos por recompensas exclusivas</li>
              </ul>
              
              <p>O accede a tu tarjeta digital aquí:</p>
              <p><a href="${urlTarjeta}" class="button">Ver mi tarjeta digital</a></p>
              
              <p style="font-size: 12px; color: #666;">
                <strong>Tu ID de cliente:</strong> ${clienteId}<br>
                Guárdalo o usa el QR arriba.
              </p>
            </div>
            <div class="footer">
              <p>© 2026 La Sucursal del Café · Apoya lo nuestro, toma café colombiano.</p>
              <p>¿Preguntas? Escribenos en WhatsApp o por aquí.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Opción 1: Si tienes email configurado vía env vars
      if (process.env.SMTP_HOST) {
        transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });

        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@la-sucursal-del-cafe.com',
          to: cliente.email,
          subject: `¡Tu tarjeta de fidelización está lista! - La Sucursal del Café`,
          html: htmlEmail,
          replyTo: process.env.SUPPORT_EMAIL || 'info@la-sucursal-del-cafe.com'
        });

        console.log(`✓ Email enviado a ${cliente.email}`);
        return { sent: true, email: cliente.email };
      } else {
        console.log(`⚠️ Variables SMTP no configuradas. Email no enviado.`);
        console.log(`Instrucciones: firebase functions:config:set smtp.host="..." smtp.user="..." smtp.pass="..."`);
        return { sent: false, reason: 'SMTP not configured' };
      }
    } catch (error) {
      console.error(`Error enviando email a ${cliente.email}:`, error);
      return { sent: false, error: error.message };
    }
  });

/**
 * Función alternativa: endpoint HTTP para enviar email manualmente
 * (por si quieres re-enviar la tarjeta a un cliente existente)
 */
exports.reenviarTarjeta = functions.https.onCall(async (data, context) => {
  const { clienteId } = data;

  if (!clienteId) {
    throw new functions.https.HttpsError('invalid-argument', 'clienteId es requerido');
  }

  try {
    // Obtener datos del cliente
    const clienteSnap = await admin.firestore().collection('fidelizacion_clientes').doc(clienteId).get();
    if (!clienteSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Cliente no encontrado');
    }

    const cliente = clienteSnap.data();
    if (!cliente.email) {
      throw new functions.https.HttpsError('invalid-argument', 'El cliente no tiene email registrado');
    }

    // Reutilizar la lógica de envío de arriba
    const urlTarjeta = `${process.env.HOSTING_URL || 'https://la-sucursal-del-cafe.web.app'}/mi-tarjeta.html?id=${encodeURIComponent(clienteId)}`;
    const urlQR = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(clienteId)}`;

    // (Aquí irían los detalles del email — reutilizar htmlEmail de arriba)

    return { success: true, message: `Email reenviado a ${cliente.email}` };
  } catch (error) {
    console.error('Error reenviando tarjeta:', error);
    throw error;
  }
});

/**
 * CONFIGURACIÓN REQUERIDA:
 *
 * 1. Opción A — Gmail (simple pero menos seguro):
 *    firebase functions:config:set smtp.host="smtp.gmail.com" smtp.port="587" \
 *      smtp.user="tu-email@gmail.com" smtp.pass="tu-app-password" \
 *      smtp.from="noreply@la-sucursal-del-cafe.com"
 *
 * 2. Opción B — SendGrid (recomendado, más confiable):
 *    npm install --save @sendgrid/mail
 *    firebase functions:config:set sendgrid.api_key="SG.xxxxx"
 *    (Luego reemplazar nodemailer con SendGrid)
 *
 * 3. Opción C — Resend (alternativa moderna):
 *    npm install --save resend
 *    firebase functions:config:set resend.api_key="re_xxxxx"
 *
 * Ver CLOUD-FUNCTIONS-EMAIL.md para detalle completo.
 */
