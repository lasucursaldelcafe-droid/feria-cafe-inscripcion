/**
 * Descargar / compartir QR del Pasaporte Cafetero.
 */
window.QRDescargar = {
  descargarQR: function (clienteId, nombreCliente) {
    var container = document.getElementById('qrContainer');
    if (container && window.QRRender) {
      QRRender.descargarDesdeContenedor(
        container,
        'pasaporte-' + (nombreCliente || 'cafetero').replace(/\s+/g, '-').toLowerCase() + '.png'
      );
      return;
    }
    var img = document.getElementById('qrImg');
    if (img && img.src) {
      var link = document.createElement('a');
      link.href = img.src;
      link.download = 'pasaporte-' + (nombreCliente || 'cafetero').replace(/\s+/g, '-') + '.png';
      link.click();
      return;
    }
    alert('QR aún no está listo');
  },

  compartirWhatsApp: function (clienteId) {
    var urlTarjeta = (window.Fidelizacion && Fidelizacion.urlPasaporte)
      ? Fidelizacion.urlPasaporte(clienteId)
      : window.location.origin + '/pasaporte?id=' + encodeURIComponent(clienteId);
    var mensaje = 'Mi Pasaporte Cafetero de La Sucursal del Café ☕\n' + urlTarjeta;
    window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(mensaje), '_blank');
  },

  copiarLink: function (clienteId) {
    var urlTarjeta = (window.Fidelizacion && Fidelizacion.urlPasaporte)
      ? Fidelizacion.urlPasaporte(clienteId)
      : window.location.origin + '/pasaporte?id=' + encodeURIComponent(clienteId);
    navigator.clipboard.writeText(urlTarjeta).then(function () {
      alert('Enlace copiado. Guárdalo en favoritos o añádelo a tu pantalla de inicio.');
    });
  }
};
