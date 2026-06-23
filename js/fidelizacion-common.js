/**
 * Lógica compartida del módulo de Fidelización.
 * Usa Firebase compat SDK (igual que stands-reserva-firebase.html) — sin build, sin Auth.
 *
 * Carga este archivo DESPUÉS de:
 *   <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js"></script>
 *   <script src="js/firebase-fidelizacion-config.js"></script>
 */
(function (global) {
  'use strict';

  var app = null;
  var db = null;

  function ready() {
    if (db) return db;
    if (!global.FIREBASE_FIDELIZACION_CONFIG || global.FIREBASE_FIDELIZACION_CONFIG.apiKey === 'TU_API_KEY') {
      throw new Error('Falta configurar js/firebase-fidelizacion-config.js con tus credenciales reales de Firebase.');
    }
    if (!global.firebase) {
      throw new Error('Firebase SDK no cargó. Revisa que los <script> de firebase estén antes de este archivo.');
    }
    app = global.firebase.apps.length ? global.firebase.app() : global.firebase.initializeApp(global.FIREBASE_FIDELIZACION_CONFIG);
    db = global.firebase.firestore();
    return db;
  }

  // ---- Niveles ----
  // Umbrales por puntos históricos acumulados (no se pierden al canjear).
  // Editable desde el panel admin (colección fidelizacion_config, doc "niveles").
  var NIVELES_DEFAULT = [
    { nombre: 'Bronce', minimo: 0, color: '#A86B3C' },
    { nombre: 'Plata', minimo: 200, color: '#9AA3AC' },
    { nombre: 'Oro', minimo: 500, color: '#C99B33' },
    { nombre: 'Diamante', minimo: 1000, color: '#5FB3C9' }
  ];

  function calcularNivel(puntosHistoricos, niveles) {
    var lista = (niveles && niveles.length ? niveles : NIVELES_DEFAULT).slice().sort(function (a, b) { return a.minimo - b.minimo; });
    var actual = lista[0];
    for (var i = 0; i < lista.length; i++) {
      if (puntosHistoricos >= lista[i].minimo) actual = lista[i];
    }
    return actual;
  }

  function siguienteNivel(puntosHistoricos, niveles) {
    var lista = (niveles && niveles.length ? niveles : NIVELES_DEFAULT).slice().sort(function (a, b) { return a.minimo - b.minimo; });
    for (var i = 0; i < lista.length; i++) {
      if (puntosHistoricos < lista[i].minimo) return lista[i];
    }
    return null; // ya está en el nivel máximo
  }

  // ---- Formato ----
  function formatoFecha(timestamp) {
    if (!timestamp) return '—';
    var date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function qrUrl(data, size) {
    var s = size || 220;
    return 'https://api.qrserver.com/v1/create-qr-code/?size=' + s + 'x' + s + '&data=' + encodeURIComponent(data);
  }

  function urlTarjeta(clienteId) {
    var base = global.location.origin + global.location.pathname.replace(/[^/]*$/, '');
    return base + 'mi-tarjeta.html?id=' + encodeURIComponent(clienteId);
  }

  // ---- API de datos ----
  function crearCliente(datos) {
    var firestore = ready();
    return firestore.collection('fidelizacion_clientes').add({
      nombre: datos.nombre || '',
      telefono: datos.telefono || '',
      email: datos.email || '',
      puntos: 0,
      puntosHistoricos: 0,
      nivel: 'Bronce',
      activo: true,
      fechaRegistro: global.firebase.firestore.FieldValue.serverTimestamp(),
      ultimaVisita: global.firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function obtenerCliente(clienteId) {
    return ready().collection('fidelizacion_clientes').doc(clienteId).get();
  }

  function registrarTransaccion(clienteId, tipo, puntos, detalle) {
    var firestore = ready();
    var refCliente = firestore.collection('fidelizacion_clientes').doc(clienteId);
    var refTx = firestore.collection('fidelizacion_transacciones').doc();
    var delta = tipo === 'canje' ? -Math.abs(puntos) : Math.abs(puntos);

    return firestore.runTransaction(function (t) {
      return t.get(refCliente).then(function (snap) {
        if (!snap.exists) throw new Error('Cliente no encontrado.');
        var data = snap.data();
        var nuevosPuntos = (data.puntos || 0) + delta;
        if (nuevosPuntos < 0) throw new Error('El cliente no tiene suficientes puntos para este canje.');
        var nuevosHistoricos = (data.puntosHistoricos || 0) + (delta > 0 ? delta : 0);
        var nivel = calcularNivel(nuevosHistoricos).nombre;

        t.update(refCliente, {
          puntos: nuevosPuntos,
          puntosHistoricos: nuevosHistoricos,
          nivel: nivel,
          ultimaVisita: global.firebase.firestore.FieldValue.serverTimestamp()
        });
        t.set(refTx, {
          clienteId: clienteId,
          tipo: tipo,
          puntos: delta,
          descripcion: (detalle && detalle.descripcion) || '',
          monto: (detalle && detalle.monto) || null,
          sede: (detalle && detalle.sede) || '',
          fecha: global.firebase.firestore.FieldValue.serverTimestamp()
        });
      });
    });
  }

  global.Fidelizacion = {
    db: ready,
    NIVELES_DEFAULT: NIVELES_DEFAULT,
    calcularNivel: calcularNivel,
    siguienteNivel: siguienteNivel,
    formatoFecha: formatoFecha,
    qrUrl: qrUrl,
    urlTarjeta: urlTarjeta,
    crearCliente: crearCliente,
    obtenerCliente: obtenerCliente,
    registrarTransaccion: registrarTransaccion
  };
})(window);
