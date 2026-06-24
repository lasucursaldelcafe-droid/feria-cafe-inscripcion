# Email de Fidelización — División de Tareas

## 🔵 PABLO HACE (3 pasos simples — 5 minutos)

### PASO 1: Crear cuenta SendGrid
1. Abre: https://sendgrid.com/free
2. Completa el formulario:
   - Email: tu-email@gmail.com (cualquiera)
   - Password: algo seguro
3. Verifica tu email (revisa spam)
4. Inicia sesión

**Tiempo: 2 minutos**

---

### PASO 2: Obtener API Key
1. Una vez dentro, busca el ícono de **engranaje** (Settings) en el menú lateral izquierdo
2. Click **API Keys**
3. Botón **Create API Key** (azul, arriba a la derecha)
4. **API Key Name:** `La Sucursal del Cafe - Fidelizacion`
5. **Permissions:** Elige "Restricted Access"
6. Baja y selecciona SOLO: **Mail Send → Full Access**
7. Click **Create & Copy**

**Copia la clave que genera (empieza con `SG_`)**

**Tiempo: 2 minutos**

---

### PASO 3: Pasarle la API Key a Claude
Aquí mismo en el chat, escribe:

```
La API Key de SendGrid es: SG_xxxxxxxxxxxxxxxxxxxxx
```

(Sin comillas, sin "SG_" duplicado, solo copiar-pegar)

**Tiempo: 30 segundos**

---

## 🟠 CLAUDE HACE (automatizado)

Una vez me des la API Key, yo voy a:

1. ✅ Configurar SendGrid en Firebase
2. ✅ Actualizar el código de Cloud Functions (ya está casi listo)
3. ✅ Desplegar a producción
4. ✅ Verificar que funciona en los logs
5. ✅ Te confirmo que está listo

**Tiempo: ~10 minutos, TODO AUTOMÁTICO**

---

## 🟢 PABLO HACE DESPUÉS (testing)

Una vez que yo confirme que está desplegado:

1. Abre: https://la-sucursal-del-cafe.web.app/registro-fidelizacion
2. Registra un cliente de prueba:
   - Nombre: `Test Client`
   - Teléfono: `3001234567`
   - Email: **tu-email-real** (para que recibas el email)
3. Click **"Crear mi tarjeta"**
4. Espera ~10 segundos
5. Revisa tu correo (bandeja principal + spam)
6. Me reportas: ✅ "Llegó el email con QR" o ❌ "No llegó"

**Tiempo: 2 minutos**

---

## 📊 RESUMEN

| Tarea | Quién | Tiempo |
|-------|-------|--------|
| Crear SendGrid | 🔵 Pablo | 2 min |
| Obtener API Key | 🔵 Pablo | 2 min |
| Pasar API Key | 🔵 Pablo | 30 seg |
| Configurar Firebase | 🟠 Claude | 3 min |
| Desplegar Cloud Functions | 🟠 Claude | 5 min |
| Verificar logs | 🟠 Claude | 2 min |
| Test de email | 🟢 Pablo | 2 min |
| **TOTAL** | | **~16 minutos** |

---

## ⏰ TIMELINE

```
T+0:00    Pablo crea SendGrid
T+2:00    Pablo obtiene API Key
T+2:30    Pablo pasa API Key a Claude
T+2:31    Claude configura Firebase
T+5:31    Claude despliega Cloud Functions
T+7:31    Claude verifica en logs
T+7:32    Claude le dice a Pablo "listo"
T+7:34    Pablo testa registrando un cliente
T+7:45    Email llega ✅
T+7:46    ¡LISTO! 🎉
```

---

## 🎯 ¿CUÁNDO EMPEZAMOS?

**Tienes 5 minutos?**

1. Crea la cuenta SendGrid AHORA
2. Obtén la API Key
3. Pégamela aquí

Yo hago el resto en ~10 minutos y te aviso.

---

## ⚠️ NOTAS IMPORTANTES

- **La API Key es privada:** No la compartas públicamente (pero está bien aquí en el chat privado)
- **Es gratuita:** SendGrid da 100 emails/día gratis, nunca te cobrarán
- **Se puede revocar después:** Si cambias de opinión, en SendGrid puedes eliminar esa API Key en cualquier momento
- **El email viene de:** noreply@la-sucursal-del-cafe.com (puedes cambiar esto después si quieres)

---

**¿Empezamos?** 👇
