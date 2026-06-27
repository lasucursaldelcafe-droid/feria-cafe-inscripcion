/**
 * Escáner de Pasaporte Cafetero para operadores de stand.
 */
(function () {
  'use strict';

  var SESSION_KEY = 'lsc_operador_session';
  var operador = null;
  var scanner = null;
  var procesando = false;

  var loginSection = document.getElementById('loginSection');
  var scannerSection = document.getElementById('scannerSection');
  var loginError = document.getElementById('loginError');
  var scanError = document.getElementById('scanError');
  var successMsg = document.getElementById('successMsg');

  function guardarSesion(op) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(op));
    } catch (e) { /* ignore */ }
  }

  function leerSesion() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function limpiarSesion() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function mostrarLogin() {
    operador = null;
    limpiarSesion();
    detenerScanner();
    loginSection.hidden = false;
    scannerSection.hidden = true;
  }

  function mostrarScanner(op) {
    operador = op;
    guardarSesion(op);
    loginSection.hidden = true;
    scannerSection.hidden = false;
    document.getElementById('standNombre').textContent = op.standNombre;
    document.getElementById('puntosPorScan').textContent = op.puntosPorEscaneo || Fidelizacion.PUNTOS_DEFAULT;
    scanError.hidden = true;
    successMsg.hidden = true;
    iniciarScanner();
  }

  function detenerScanner() {
    if (!scanner) return;
    scanner.stop().catch(function () { /* ya detenido */ }).finally(function () {
      scanner.clear();
      scanner = null;
    });
  }

  function onScanSuccess(texto) {
    if (procesando) return;
    procesarCodigo(texto);
  }

  function procesarCodigo(texto) {
    if (!operador || procesando) return;
    procesando = true;
    scanError.hidden = true;
    successMsg.hidden = true;

    Fidelizacion.registrarPuntosEscaneo(operador, texto, texto)
      .then(function (res) {
        successMsg.innerHTML =
          '<strong>✓ +' + res.puntosOtorgados + ' puntos</strong><br>' +
          res.nombre + ' · Total: ' + res.puntosTotales + ' pts · ' + res.nivel;
        successMsg.hidden = false;
        document.getElementById('manualCode').value = '';
        if (navigator.vibrate) navigator.vibrate(120);
      })
      .catch(function (err) {
        scanError.textContent = err.message || 'No se pudieron registrar los puntos.';
        scanError.hidden = false;
      })
      .finally(function () {
        setTimeout(function () { procesando = false; }, 1500);
      });
  }

  function iniciarScanner() {
    if (!window.Html5Qrcode || scanner) return;
    var reader = document.getElementById('qrReader');
    reader.innerHTML = '';
    scanner = new Html5Qrcode('qrReader');

    scanner.start(
      { facingMode: 'environment' },
      { fps: 8, qrbox: { width: 240, height: 240 } },
      onScanSuccess,
      function () { /* frame sin QR */ }
    ).catch(function (err) {
      scanError.textContent = 'No se pudo usar la cámara: ' + (err.message || 'permiso denegado');
      scanError.hidden = false;
    });
  }

  document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    loginError.hidden = true;
    var btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.textContent = 'Verificando…';

    Fidelizacion.initBackend().then(function () {
      return Fidelizacion.verificarOperador(
        document.getElementById('loginUsuario').value,
        document.getElementById('loginPin').value
      );
    }).then(function (op) {
      mostrarScanner(op);
    }).catch(function (err) {
      loginError.textContent = err.message;
      loginError.hidden = false;
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = 'Entrar al escáner';
    });
  });

  document.getElementById('logoutBtn').addEventListener('click', mostrarLogin);

  document.getElementById('manualBtn').addEventListener('click', function () {
    var code = document.getElementById('manualCode').value.trim();
    if (!code) return;
    procesarCodigo(code);
  });

  var sesion = leerSesion();
  if (sesion && sesion.id) {
    Fidelizacion.initBackend().then(function () {
      mostrarScanner(sesion);
    }).catch(function () {
      mostrarLogin();
    });
  }
})();
