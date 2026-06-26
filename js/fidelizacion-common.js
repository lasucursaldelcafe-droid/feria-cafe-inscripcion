/**
 * Lógica compartida del módulo de Fidelización / Pasaporte Cafetero.
 * Usa Firebase compat SDK — sin build, sin Auth.
 */
(function (global) {
  'use strict';

  var app = null;
  var db = null;

  var QR_PREFIX = 'LSCPAS:';
  var PIN_SALT = 'LSC-Pasaporte2026';

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

  var NIVELES_DEFAULT = [
    { nombre: 'Bronce', minimo: 0, color: '#A86B3C' },
    { nombre: 'Plata', minimo: 200, color: '#9AA3AC' },
    { nombre: 'Oro', minimo: 500, color: '#C99B33' },
    { nombre: 'Diamante', minimo: 1000, color: '#5FB3C9' }
  ];

  var PUNTOS_DEFAULT = 10;

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
    return null;
  }

  function formatoFecha(timestamp) {
    if (!timestamp) return '—';
    var date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatoHora(timestamp) {
    if (!timestamp) return '—';
    var date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function hoyColombia() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  }

  function qrPayload(clienteId) {
    return QR_PREFIX + clienteId;
  }

  function qrUrl(data, size) {
    var s = size || 220;
    return 'https://api.qrserver.com/v1/create-qr-code/?size=' + s + 'x' + s + '&data=' + encodeURIComponent(data);
  }

  function urlPasaporte(clienteId) {
    if (global.SiteLinks && global.SiteLinks.absUrl) {
      return global.SiteLinks.absUrl('pasaporte') + '?id=' + encodeURIComponent(clienteId);
    }
    var base = global.location.origin + global.location.pathname.replace(/[^/]*$/, '');
    return base + 'pasaporte-cafetero.html?id=' + encodeURIComponent(clienteId);
  }

  function urlTarjeta(clienteId) {
    return urlPasaporte(clienteId);
  }

  /** Extrae clienteId de QR escaneado (pasaporte, URL, Wallet, ID crudo). */
  function parseClienteIdDesdeQr(texto) {
    if (!texto) return null;
    var raw = String(texto).trim();
    if (!raw) return null;

    if (raw.indexOf(QR_PREFIX) === 0) {
      return raw.slice(QR_PREFIX.length).trim() || null;
    }

    var idMatch = raw.match(/[?&]id=([A-Za-z0-9_-]+)/);
    if (idMatch) return idMatch[1];

    try {
      var u = new URL(raw);
      var q = u.searchParams.get('id');
      if (q) return q;
    } catch (e) { /* no es URL */ }

    if (/^[A-Za-z0-9_-]{10,}$/.test(raw)) return raw;

    return null;
  }

  function hashPin(pin) {
    var str = String(pin).trim() + PIN_SALT;
    if (global.crypto && global.crypto.subtle) {
      return global.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
        return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      });
    }
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return Promise.resolve('legacy_' + Math.abs(h).toString(16));
  }

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

  function escucharCliente(clienteId, callback) {
    return ready().collection('fidelizacion_clientes').doc(clienteId).onSnapshot(callback);
  }

  function listarTransaccionesCliente(clienteId, limite) {
    var max = limite || 20;
    return ready().collection('fidelizacion_transacciones')
      .where('clienteId', '==', clienteId)
      .get()
      .then(function (snap) {
        var items = [];
        snap.forEach(function (d) { items.push({ id: d.id, data: d.data() }); });
        items.sort(function (a, b) {
          var ta = a.data.fecha && a.data.fecha.toMillis ? a.data.fecha.toMillis() : 0;
          var tb = b.data.fecha && b.data.fecha.toMillis ? b.data.fecha.toMillis() : 0;
          return tb - ta;
        });
        return {
          empty: items.length === 0,
          forEach: function (fn) {
            items.slice(0, max).forEach(function (item) {
              fn({ data: function () { return item.data; } });
            });
          }
        };
      });
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
          operadorId: (detalle && detalle.operadorId) || '',
          fecha: global.firebase.firestore.FieldValue.serverTimestamp()
        });
      });
    });
  }

  function crearOperador(datos) {
    var usuario = String(datos.usuario || '').trim().toLowerCase();
    if (!usuario || usuario.length < 3) return Promise.reject(new Error('Usuario inválido (mínimo 3 caracteres).'));
    if (!datos.standNombre) return Promise.reject(new Error('Nombre del stand es obligatorio.'));
    if (!datos.pin || String(datos.pin).length < 4) return Promise.reject(new Error('PIN de al menos 4 dígitos.'));

    var firestore = ready();
    return firestore.collection('fidelizacion_operadores')
      .where('usuario', '==', usuario)
      .limit(1)
      .get()
      .then(function (snap) {
        if (!snap.empty) throw new Error('Ese usuario ya existe.');
        return hashPin(datos.pin);
      })
      .then(function (pinHash) {
        return firestore.collection('fidelizacion_operadores').add({
          standNombre: datos.standNombre,
          usuario: usuario,
          pinHash: pinHash,
          puntosPorEscaneo: parseInt(datos.puntosPorEscaneo, 10) || PUNTOS_DEFAULT,
          activo: true,
          fechaCreacion: global.firebase.firestore.FieldValue.serverTimestamp()
        });
      });
  }

  function verificarOperador(usuario, pin) {
    var u = String(usuario || '').trim().toLowerCase();
    if (!u || !pin) return Promise.reject(new Error('Usuario y PIN son obligatorios.'));

    return hashPin(pin).then(function (pinHash) {
      return ready().collection('fidelizacion_operadores')
        .where('usuario', '==', u)
        .limit(1)
        .get()
        .then(function (snap) {
          if (snap.empty) throw new Error('Usuario o PIN incorrectos.');
          var doc = snap.docs[0];
          var data = doc.data();
          if (!data.activo) throw new Error('Este operador está desactivado.');
          if (data.pinHash !== pinHash) throw new Error('Usuario o PIN incorrectos.');
          return { id: doc.id, standNombre: data.standNombre, puntosPorEscaneo: data.puntosPorEscaneo || PUNTOS_DEFAULT, usuario: data.usuario };
        });
    });
  }

  function yaEscaneadoHoy(operadorId, clienteId) {
    var dia = hoyColombia();
    var escaneoId = operadorId + '_' + clienteId + '_' + dia;
    return ready().collection('fidelizacion_escaneos').doc(escaneoId).get().then(function (snap) {
      return snap.exists;
    });
  }

  function registrarPuntosEscaneo(operador, clienteId, textoQr) {
    var parsed = parseClienteIdDesdeQr(textoQr || clienteId);
    if (!parsed) return Promise.reject(new Error('QR no reconocido. Usa el Pasaporte Cafetero.'));

    return yaEscaneadoHoy(operador.id, parsed).then(function (ya) {
      if (ya) throw new Error('Este visitante ya recibió puntos en tu stand hoy.');

      var puntos = operador.puntosPorEscaneo || PUNTOS_DEFAULT;
      var escaneoId = operador.id + '_' + parsed + '_' + hoyColombia();
      var firestore = ready();

      return registrarTransaccion(parsed, 'acumulacion', puntos, {
        descripcion: 'Visita a stand — escaneo Pasaporte Cafetero',
        sede: operador.standNombre,
        operadorId: operador.id
      }).then(function () {
        return firestore.collection('fidelizacion_escaneos').doc(escaneoId).set({
          operadorId: operador.id,
          clienteId: parsed,
          standNombre: operador.standNombre,
          puntos: puntos,
          dia: hoyColombia(),
          fecha: global.firebase.firestore.FieldValue.serverTimestamp()
        });
      }).then(function () {
        return obtenerCliente(parsed).then(function (snap) {
          var data = snap.exists ? snap.data() : {};
          return {
            clienteId: parsed,
            nombre: data.nombre || 'Visitante',
            puntosOtorgados: puntos,
            puntosTotales: data.puntos || 0,
            nivel: data.nivel || 'Bronce'
          };
        });
      });
    });
  }

  global.Fidelizacion = {
    db: ready,
    QR_PREFIX: QR_PREFIX,
    PUNTOS_DEFAULT: PUNTOS_DEFAULT,
    NIVELES_DEFAULT: NIVELES_DEFAULT,
    calcularNivel: calcularNivel,
    siguienteNivel: siguienteNivel,
    formatoFecha: formatoFecha,
    formatoHora: formatoHora,
    hoyColombia: hoyColombia,
    qrPayload: qrPayload,
    qrUrl: qrUrl,
    urlPasaporte: urlPasaporte,
    urlTarjeta: urlTarjeta,
    parseClienteIdDesdeQr: parseClienteIdDesdeQr,
    hashPin: hashPin,
    crearCliente: crearCliente,
    obtenerCliente: obtenerCliente,
    escucharCliente: escucharCliente,
    listarTransaccionesCliente: listarTransaccionesCliente,
    registrarTransaccion: registrarTransaccion,
    crearOperador: crearOperador,
    verificarOperador: verificarOperador,
    registrarPuntosEscaneo: registrarPuntosEscaneo
  };
})(window);
