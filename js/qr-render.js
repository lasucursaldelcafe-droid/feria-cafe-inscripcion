/**
 * Generación de QR en el navegador (qrcode@1.5.4) con fallback a API externa.
 */
(function (global) {
  'use strict';

  var CDN = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/lib/browser.js';
  var loading = null;

  function loadLib() {
    if (global.QRCode) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = CDN;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('No se pudo cargar la librería QR.')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  function toCanvas(container, data, opts) {
    opts = opts || {};
    var width = opts.width || 220;
    var margin = opts.margin != null ? opts.margin : 2;
    container.innerHTML = '';

    return loadLib().then(function () {
      return new Promise(function (resolve, reject) {
        global.QRCode.toCanvas(data, { width: width, margin: margin, errorCorrectionLevel: 'M' }, function (err, canvas) {
          if (err) {
            reject(err);
            return;
          }
          canvas.setAttribute('role', 'img');
          canvas.setAttribute('aria-label', opts.ariaLabel || 'Código QR');
          container.appendChild(canvas);
          resolve(canvas);
        });
      });
    }).catch(function () {
      var img = document.createElement('img');
      img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=' + width + 'x' + width + '&data=' + encodeURIComponent(data);
      img.width = width;
      img.height = width;
      img.alt = opts.ariaLabel || 'Código QR';
      container.appendChild(img);
      return img;
    });
  }

  function descargarDesdeContenedor(container, filename) {
    var canvas = container.querySelector('canvas');
    if (canvas) {
      var link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = filename || 'qr.png';
      link.click();
      return;
    }
    var img = container.querySelector('img');
    if (img && img.src) {
      fetch(img.src).then(function (r) { return r.blob(); }).then(function (blob) {
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename || 'qr.png';
        link.click();
        URL.revokeObjectURL(link.href);
      });
    }
  }

  global.QRRender = {
    loadLib: loadLib,
    toCanvas: toCanvas,
    descargarDesdeContenedor: descargarDesdeContenedor
  };
})(window);
