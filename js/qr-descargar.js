/**
 * Opción alternativa: Generador de QR client-side
 * 
 * Si no quieres configurar Cloud Functions, puedes:
 * 1. Generar QR en el navegador del cliente
 * 2. Ofrecerle un botón para descargar/compartir
 * 3. Opcionalmente: hacer que el usuario mismo copie el enlace para compartir
 * 
 * Este script va en mi-tarjeta.html
 */

window.QRDescargar = {
  /**
   * Descargar el QR como imagen PNG
   */
  descargarQR: function(clienteId, nombreCliente) {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      alert('QR aún no está generado');
      return;
    }
    
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `tarjeta-${nombreCliente.replace(/\s+/g, '-')}.png`;
    link.click();
  },

  /**
   * Compartir QR por WhatsApp
   */
  compartirWhatsApp: function(clienteId) {
    const urlTarjeta = `${window.location.origin}/mi-tarjeta.html?id=${encodeURIComponent(clienteId)}`;
    const mensaje = `Aquí está mi tarjeta de fidelización en La Sucursal del Café 🎯☕\n${urlTarjeta}`;
    const whatsappURL = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    window.open(whatsappURL, '_blank');
  },

  /**
   * Copiar link al portapapeles
   */
  copiarLink: function(clienteId) {
    const urlTarjeta = `${window.location.origin}/mi-tarjeta.html?id=${encodeURIComponent(clienteId)}`;
    navigator.clipboard.writeText(urlTarjeta).then(() => {
      alert('✓ Link copiado al portapapeles');
    });
  },

  /**
   * Envío simple por correo (abre el cliente de email del usuario)
   */
  abrirEmail: function(email, clienteId, nombreCliente) {
    const urlTarjeta = `${window.location.origin}/mi-tarjeta.html?id=${encodeURIComponent(clienteId)}`;
    const asunto = '¡Tu tarjeta de fidelización - La Sucursal del Café!';
    const cuerpo = `Hola ${nombreCliente},\n\nAquí está tu tarjeta de fidelización:\n${urlTarjeta}\n\nMuestra el QR en caja para acumular puntos.\n\n¡Saludos!`;
    
    const mailtoURL = `mailto:${email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
    window.location.href = mailtoURL;
  }
};

/**
 * Para usar esto en mi-tarjeta.html:
 * 
 * 1. Agregar botones de acción:
 * 
 * <div style="margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
 *   <button onclick="QRDescargar.descargarQR('...')">📥 Descargar QR</button>
 *   <button onclick="QRDescargar.compartirWhatsApp('...')">📱 Compartir por WhatsApp</button>
 *   <button onclick="QRDescargar.copiarLink('...')">📋 Copiar enlace</button>
 * </div>
 * 
 * 2. Opción más simple: mostrar el link directamente para que lo copie/comparta
 */
