# Email Gratuito — Opción B ACTUALIZADA (estructura verificada)

## ESTRUCTURA CONFIRMADA ✅

He revisado su `Code.gs` y está usando:
- ✅ `MailApp.sendEmail()` con objeto de configuración
- ✅ Funciones separadas para HTML y texto plano
- ✅ `escapeHtml_()` para seguridad
- ✅ Array de strings que se unen con `.join('')`
- ✅ Variables de configuración globales

## PASO 1: Agregar código en Code.gs

**Al final del archivo `Code.gs` (después de la última función), pega esto:**

```javascript
// ========== FIDELIZACIÓN — Envío de email con QR ==========

function sendFidelizacionEmail_(nombre, email, clienteId) {
  /**
   * Envía email de bienvenida a cliente registrado en fidelización
   * Patrón: igual al de competencia, pero para tarjeta digital
   */
  
  if (!email || email.indexOf('@') === -1) {
    Logger.log('❌ Email inválido: ' + email);
    return false;
  }

  try {
    var subject = '¡Tu tarjeta de fidelización está lista! 🎯 ☕ — La Sucursal del Café';
    var htmlBody = buildFidelizacionEmailHtml_(nombre, clienteId);
    var plainBody = buildFidelizacionEmailPlain_(nombre, clienteId);

    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: plainBody,
      htmlBody: htmlBody,
      name: 'La Sucursal del Café'
    });

    Logger.log('✓ Email fidelización enviado a: ' + email);
    return true;
  } catch (err) {
    Logger.log('❌ Error enviando email fidelización a ' + email + ': ' + err);
    return false;
  }
}

function buildFidelizacionEmailHtml_(nombre, clienteId) {
  /**
   * Genera HTML del email de bienvenida a fidelización
   * Estructura: igual a buildCompetenciaEmailHtml_() pero con QR
   */
  
  var nombreEscapado = escapeHtml_(nombre || '');
  var clienteIdEscapado = escapeHtml_(clienteId || '');
  var urlTarjeta = SITE_PUBLIC_BASE_URL + '/mi-tarjeta.html?id=' + encodeURIComponent(clienteId);
  var urlQR = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(clienteId);
  var btnStyle = 'display:inline-block;padding:12px 20px;margin:8px 8px 8px 0;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;';
  var btnRed = btnStyle + 'background:#C1272D;color:#ffffff;';
  var btnBrown = btnStyle + 'background:#5f4a3a;color:#ffffff;';

  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#3d2b1f;max-width:600px;">',
    '<p style="margin:0 0 16px;">Hola <strong>' + nombreEscapado + '</strong>,</p>',
    '<p style="margin:0 0 16px;">¡Bienvenido/a al programa de <strong>fidelización</strong> de La Sucursal del Café! A partir de ahora, cada compra te acumulará puntos que podrás canjear por recompensas exclusivas.</p>',
    
    // Sección QR
    '<h2 style="font-size:17px;color:#5f4a3a;margin:24px 0 10px;">Tu código QR</h2>',
    '<p style="margin:0 0 16px;text-align:center;">',
    '<img src="' + urlQR + '" alt="Tu código QR" style="max-width:200px;border:2px solid #d4c4b0;border-radius:8px;display:inline-block;" />',
    '</p>',
    '<p style="margin:0 0 16px;text-align:center;font-size:13px;color:#6b5344;">Muestra este QR en caja al comprar para acumular puntos</p>',
    
    // Sección cómo funciona
    '<h2 style="font-size:17px;color:#5f4a3a;margin:24px 0 10px;">¿Cómo funciona?</h2>',
    '<ul style="margin:0 0 12px;padding-left:20px;">',
    '<li style="margin-bottom:6px;">🎯 <strong>Acumula puntos:</strong> cada compra suma puntos (según monto)</li>',
    '<li style="margin-bottom:6px;">⬆️ <strong>Sube de nivel:</strong> Bronce → Plata → Oro → Diamante</li>',
    '<li style="margin-bottom:6px;">🎁 <strong>Canjea recompensas:</strong> usa tus puntos en café, pasteles y más</li>',
    '</ul>',
    
    // Botones de acción
    '<p style="margin:24px 0 16px;">',
    '<a href="' + urlTarjeta + '" style="' + btnRed + '">Ver mi tarjeta digital</a>',
    '<a href="' + SITE_PUBLIC_BASE_URL + '/fidelizacion" style="' + btnBrown + '">Conocer el programa</a>',
    '</p>',
    
    // Información del cliente
    '<div style="margin:24px 0 16px;padding:12px 14px;background:#f5f0ea;border-left:4px solid #bb5e3c;font-size:14px;">',
    '<p style="margin:0 0 6px;"><strong>Tu ID de cliente:</strong> <code style="background:#fff;padding:2px 6px;border-radius:3px;">' + clienteIdEscapado + '</code></p>',
    '<p style="margin:0;">Guárdalo o usa el QR de arriba en cada compra.</p>',
    '</div>',
    
    // Footer
    '<hr style="border:none;border-top:1px solid #e0d5c8;margin:24px 0;">',
    '<p style="margin:0;font-size:13px;color:#888;">',
    '— La Sucursal del Café<br>',
    'Fidelización · Apoya lo nuestro, toma café colombiano.',
    '</p>',
    '</div>'
  ].join('');
}

function buildFidelizacionEmailPlain_(nombre, clienteId) {
  /**
   * Genera texto plano del email (alternativa HTML)
   * Para clientes de correo que no soportan HTML
   */
  
  var urlTarjeta = SITE_PUBLIC_BASE_URL + '/mi-tarjeta.html?id=' + encodeURIComponent(clienteId);
  var lines = [];
  
  lines.push('Hola ' + nombre + ',');
  lines.push('');
  lines.push('¡Bienvenido/a al programa de fidelización de La Sucursal del Café!');
  lines.push('A partir de ahora, cada compra te acumulará puntos que podrás canjear por recompensas.');
  lines.push('');
  lines.push('--- TU CÓDIGO QR ---');
  lines.push('Tu ID de cliente: ' + clienteId);
  lines.push('Muestra este código QR en caja al comprar para acumular puntos.');
  lines.push('');
  lines.push('--- ¿CÓMO FUNCIONA? ---');
  lines.push('🎯 Acumula puntos: cada compra suma puntos (según monto)');
  lines.push('⬆️ Sube de nivel: Bronce → Plata → Oro → Diamante');
  lines.push('🎁 Canjea recompensas: usa tus puntos en café, pasteles y más');
  lines.push('');
  lines.push('--- VER MI TARJETA DIGITAL ---');
  lines.push(urlTarjeta);
  lines.push('');
  lines.push('--- INFORMACIÓN ---');
  lines.push('Tu ID de cliente (guárdalo): ' + clienteId);
  lines.push('Programa completo: ' + SITE_PUBLIC_BASE_URL + '/fidelizacion');
  lines.push('');
  lines.push('— La Sucursal del Café');
  lines.push('Fidelización · Apoya lo nuestro, toma café colombiano.');
  
  return lines.join('\n');
}
```

---

## PASO 2: Integración con doPost()

En la función `doPost()` (línea ~150 aprox), después de procesar el formulario, agregar esto:

**Busca la línea donde dice:**
```javascript
if (formType === 'competencia' || formType === 'stands' || formType === 'feria') {
  sendConfirmationEmail_(formType, formDataNormalized);
}
```

**Y agrega ANTES (para fidelización):**
```javascript
// Envío de email para fidelización (nuevo módulo)
if (data.action === 'enviarEmailFidelizacion') {
  var resultado = sendFidelizacionEmail_(data.nombre, data.email, data.clienteId);
  return jsonResponse({ 
    ok: resultado, 
    mensaje: resultado ? 'Email enviado' : 'Error enviando email' 
  });
}
```

---

## PASO 3: Actualizar Cloud Functions

En `functions/index.js`, reemplaza la función `enviarTarjetaAlRegistro` con:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.enviarTarjetaAlRegistro = functions.firestore
  .document('fidelizacion_clientes/{clienteId}')
  .onCreate(async (snap, context) => {
    const clienteId = snap.id;
    const cliente = snap.data();

    if (!cliente.email || !cliente.nombre) {
      console.log(`Cliente ${clienteId}: datos incompletos`);
      return null;
    }

    try {
      // URL del Apps Script Web App (debes configurarla)
      const appsScriptUrl = process.env.APPS_SCRIPT_URL || '';
      
      if (!appsScriptUrl) {
        console.log('⚠️ APPS_SCRIPT_URL no configurada');
        return null;
      }

      // Llamar al Apps Script
      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enviarEmailFidelizacion',
          nombre: cliente.nombre,
          email: cliente.email,
          clienteId: clienteId
        })
      });

      const result = await response.json();
      console.log(`Email fidelización para ${cliente.email}:`, result);
      return result;
    } catch (error) {
      console.error(`Error enviando email para ${clienteId}:`, error);
      return { ok: false, error: error.message };
    }
  });
```

---

## PASO 4: Tus tareas

### 4.1: Script ID
1. Abre Google Apps Script (Extensions → Apps Script)
2. ⚙️ Project Settings
3. Copia el **Script ID**

### 4.2: URL del Web App
1. En el mismo Apps Script, click **Deploy** → **New deployment**
2. Type: **Web app**
3. Execute as: **yo** (tu cuenta)
4. Who has access: **Anyone**
5. Click **Deploy**
6. Copia la URL generada (termina en `/usercodeapp`)

### 4.3: Configurar en Firebase
```bash
firebase functions:config:set apps_script.url="https://script.google.com/macros/d/SCRIPT_ID/usercodeapp" \
  --project la-sucursal-del-cafe
```

(Reemplaza `SCRIPT_ID` con lo que copiaste)

---

## PASO 5: Desplegar

```bash
firebase deploy --only functions --project la-sucursal-del-cafe
```

---

## BENEFICIOS de esta estructura

✅ **100% compatible** con su Code.gs existente  
✅ **Mismo patrón** de emails (competencia → fidelización)  
✅ **Seguridad:**  `escapeHtml_()`  
✅ **Mantenible:** funciones separadas HTML/plain  
✅ **Escalable:** usa la misma infraestructura  

---

**¿Listos para ejecutar?** Avísame cuando tengas el Script ID y la URL del Web App.
