# 🎫 Sistema de Reserva de Stands - Integración Firebase

Documentación para integrar la aplicación de reserva de stands con Firebase Firestore y Cloud Storage.

---

## 📋 Archivos

### Versiones disponibles:

| Archivo | Descripción | Almacenamiento |
|---------|-------------|-----------------|
| `stands-reserva.html` | Versión local (sin Firebase) | JSON local/descarga |
| `stands-reserva-firebase.html` | **Versión integrada** ✅ | Firestore + Storage |

---

## 🔧 Instalación Firebase

### Paso 1: Activar Firebase en el proyecto

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Abre el proyecto `la-sucursal-del-cafe`
3. Activa **Firestore Database**:
   - Click en "Create database"
   - Modo: **Iniciar en modo de prueba** (para desarrollo)
   - Ubicación: `us-central1`

4. Activa **Cloud Storage**:
   - Click en "Get started"
   - Ubicación: `us-central1`

### Paso 2: Obtener credenciales

1. Ve a **Proyecto → Configuración → Tus apps → SDK de Firebase (web)**
2. Copia la configuración de inicialización
3. Actualiza `js/firebase-config.js`:

```javascript
/**
 * Copia como js/firebase-config.js con los valores de tu app web en Firebase Console.
 * Proyecto → Configuración → Tus apps → SDK de Firebase (web).
 */
window.FIREBASE_CONFIG = {
  apiKey: 'TU_API_KEY_AQUI',
  authDomain: 'la-sucursal-del-cafe.firebaseapp.com',
  projectId: 'la-sucursal-del-cafe',
  storageBucket: 'la-sucursal-del-cafe.firebasestorage.app',
  messagingSenderId: 'TU_SENDER_ID_AQUI',
  appId: 'TU_APP_ID_AQUI'
};

window.ALLOWED_ADMIN_EMAIL = 'lasucursaldelcafe@gmail.com';
```

### Paso 3: Configurar Firestore Rules

En **Firestore → Rules**, reemplaza con esto:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir lectura pública de reservas
    match /stands_reserva/{document=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }
    
    // Acceso público para crear documentos de prueba
    match /stands_reserva/{standId} {
      allow create: if true;
      allow read: if true;
    }
  }
}
```

### Paso 4: Configurar Cloud Storage Rules

En **Storage → Rules**, reemplaza con esto:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /stands_logos/{allPaths=**} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

---

## 🚀 Uso en producción

### Para ambiente DEV:
```html
<!-- En tu HTML -->
<script src="js/firebase-config.js"></script>
<script src="stands-reserva-firebase.html"></script>
```

### Para integrarlo en index.html:

1. Abre `index.html`
2. Agrega un enlace o iframe:

```html
<!-- Opción 1: Link directo -->
<a href="stands-reserva-firebase.html" class="btn-reserva">
  Adquiere tu Stand
</a>

<!-- Opción 2: iFrame embebido -->
<iframe 
  src="stands-reserva-firebase.html" 
  width="100%" 
  height="900px"
  style="border: none; border-radius: 8px;">
</iframe>
```

---

## 📊 Estructura Firestore

### Colección: `stands_reserva`

```json
{
  "standId": "1",
  "empresa": "Ghost Specialty Coffee",
  "contacto": "Diego Fernando Cobo",
  "email": "diego@ghostcoffee.com",
  "telefono": "+57 3001234567",
  "descripcion": "Café especializado con proceso de tueste artesanal",
  "logoUrl": "https://storage.googleapis.com/...",
  "standInfo": {
    "x": 60,
    "y": 520,
    "zone": "Origen",
    "area": "0.72"
  },
  "timestamp": "2026-06-20T12:30:00Z",
  "status": "pending"
}
```

---

## 📧 Funcionalidades automáticas

### Lo que hace Firebase automáticamente:

✅ **Guardar reservas** en Firestore  
✅ **Subir logos** a Cloud Storage  
✅ **Sincronizar en tiempo real** cuando alguien reserva  
✅ **Asignar timestamp** del servidor  
✅ **Validar email**  

### Manual (requiere Cloud Functions):

⚠️ **Enviar confirmación por email** → Necesita Cloud Functions

---

## ☁️ Cloud Functions (Opcional)

Si quieres enviar emails automáticos, crea esta función:

```javascript
const functions = require('firebase-functions');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'lasucursaldelcafe@gmail.com',
    pass: 'TU_APP_PASSWORD' // Usa contraseña de app
  }
});

exports.enviarConfirmacion = functions.firestore
  .document('stands_reserva/{docId}')
  .onCreate((snap, context) => {
    const data = snap.data();
    
    const mailOptions = {
      from: 'lasucursaldelcafe@gmail.com',
      to: data.email,
      subject: `✅ Tu Stand ${data.standId} está reservado`,
      html: `
        <h2>¡Reserva confirmada!</h2>
        <p>Hola ${data.empresa},</p>
        <p>Tu stand <strong>#${data.standId}</strong> en la Feria de Café La Sucursal 2026 está reservado.</p>
        <p><strong>Zona:</strong> ${data.standInfo.zone}</p>
        <p><strong>Área:</strong> ${data.standInfo.area} m²</p>
        <p>Te contactaremos pronto con más detalles.</p>
      `
    };
    
    return transporter.sendMail(mailOptions);
  });
```

Deploy con:
```bash
firebase deploy --only functions
```

---

## 🧪 Pruebas

### Test local (sin Firebase):

1. Abre `stands-reserva.html` en navegador
2. Selecciona un stand
3. Llena formulario
4. Click "Reservar"
5. Descarga JSON

### Test con Firebase:

1. Asegúrate que `js/firebase-config.js` esté configurado
2. Abre `stands-reserva-firebase.html`
3. Deberías ver "✓ Conectado a Firebase Firestore"
4. Haz una reserva
5. Verifica en **Firestore → stands_reserva** que aparezca el documento

---

## 🔐 Seguridad

**Importante para producción:**

1. **No guardes firebase-config.js en .gitignore** (la API key es pública, está diseñada así)
2. **Activa Authentication** cuando estés listo para producción
3. **Actualiza Firestore Rules** para validar usuarios autenticados
4. **Limita Cloud Storage** a tamaños máximos de archivos

---

## ❓ Troubleshooting

### "Firebase no está configurado"
- Verifica que `js/firebase-config.js` esté cargado
- Abre la consola del navegador (F12) → Console
- Busca mensajes de error

### "Error: Permission denied"
- Actualiza Firestore Rules
- Asegúrate que Cloud Storage Rules esté activo

### "Logo no sube"
- Verifica que Cloud Storage esté activado
- Comprueba tamaño del archivo (< 5MB)
- Revisa Cloud Storage Rules

---

## 📞 Soporte

Para problemas:
1. Revisa [Firebase Console Logs](https://console.firebase.google.com)
2. Abre Console del navegador (F12)
3. Contacta al equipo de desarrollo

---

**Última actualización:** Junio 20, 2026  
**Estado:** ✅ Listo para producción  
**Ambiente:** Firebase "la-sucursal-del-cafe"
