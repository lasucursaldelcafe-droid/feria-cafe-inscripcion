/**
 * Lógica compartida del módulo de Fidelización / Pasaporte Cafetero.
 * Usa Firebase compat SDK — sin build, sin Auth.
 */
(function (global) {
  'use strict';

  var app = null;
  var db = null;

  var QR_PREFIX = 'LSCPAS:';
  var PASAPORTE_STORAGE_KEY = 'lsc_pasaporte_cliente_id';

  function guardarPasaporteLocal(clienteId) {
    if (!clienteId) return;
    try {
      localStorage.setItem(PASAPORTE_STORAGE_KEY, String(clienteId));
    } catch (e) { /* quota / privado */ }
  }

  function leerPasaporteLocal() {
    try {
      return localStorage.getItem(PASAPORTE_STORAGE_KEY) || '';
    } catch (e) {
      return '';
    }
  }
  var PIN_SALT = 'LSC-Pasaporte2026';
  var backendMode = null;
  var backendReady = null;

  function sheetsApi() {
    return global.FidelizacionSheets;
  }

  function isFirestoreError(err) {
    var msg = String((err && err.message) || err || '');
    var code = String((err && err.code) || '');
    return msg.indexOf('SERVICE_DISABLED') !== -1 ||
      msg.indexOf('permission-denied') !== -1 ||
      code === 'permission-denied' ||
      msg.indexOf('Failed to get document') !== -1;
  }

  function resolveBackend() {
    if (backendMode) return Promise.resolve(backendMode);
    if (!backendReady) {
      backendReady = new Promise(function (resolve) {
        var api = sheetsApi();
        if (api && api.isAvailable() && api.probe) {
          api.probe().then(function (pasaportesReady) {
            if (pasaportesReady) {
              backendMode = 'sheets';
              resolve('sheets');
              return;
            }
            tryFirestoreOrSheets(resolve);
          }).catch(function () {
            tryFirestoreOrSheets(resolve);
          });
          return;
        }
        tryFirestoreOrSheets(resolve);
      });
    }
    return backendReady;
  }

  function tryFirestoreOrSheets(resolve) {
    if (!global.firebase || !global.FIREBASE_FIDELIZACION_CONFIG ||
        global.FIREBASE_FIDELIZACION_CONFIG.apiKey === 'TU_API_KEY') {
      backendMode = sheetsApi() && sheetsApi().isAvailable() ? 'sheets' : 'sheets';
      resolve(backendMode);
      return;
    }
    try {
      var testDb = readyFirestore();
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        console.warn('Firestore timeout, usando Google Sheets.');
        backendMode = 'sheets';
        resolve('sheets');
      }, 4000);
      testDb.collection('fidelizacion_clientes').limit(1).get()
        .then(function () {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          backendMode = 'firestore';
          resolve('firestore');
        })
        .catch(function (err) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          console.warn('Firestore no disponible, usando Google Sheets:', err && err.message);
          backendMode = 'sheets';
          resolve('sheets');
        });
    } catch (err) {
      backendMode = 'sheets';
      resolve('sheets');
    }
  }

  function readyFirestore() {
    if (!global.FIREBASE_FIDELIZACION_CONFIG || global.FIREBASE_FIDELIZACION_CONFIG.apiKey === 'TU_API_KEY') {
      throw new Error('Falta configurar js/firebase-fidelizacion-config.js con tus credenciales reales de Firebase.');
    }
    if (!global.firebase) {
      throw new Error('Firebase SDK no cargó. Revisa que los <script> de firebase estén antes de este archivo.');
    }
    var apps = global.firebase.apps;
    app = apps && apps.length ? global.firebase.app() : global.firebase.initializeApp(global.FIREBASE_FIDELIZACION_CONFIG);
    db = global.firebase.firestore();
    return db;
  }

  function ready() {
    if (backendMode === 'sheets') {
      if (global.FidelizacionDbShim) return global.FidelizacionDbShim.create();
      throw new Error('Backend Sheets: falta js/fidelizacion-db-shim.js');
    }
    return readyFirestore();
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

  function crearClienteFirestore(datos) {
    var firestore = readyFirestore();
    return firestore.collection('fidelizacion_clientes').add({
      nombre: datos.nombre || '',
      telefono: datos.telefono || '',
      email: datos.email || '',
      puntos: 0,
      puntosHistoricos: 0,
      nivel: 'Bronce',
      activo: true,
      origen: datos.origen || 'registro',
      fechaRegistro: global.firebase.firestore.FieldValue.serverTimestamp(),
      ultimaVisita: global.firebase.firestore.FieldValue.serverTimestamp()
    }).then(function (ref) {
      guardarPasaporteLocal(ref.id);
      return ref;
    });
  }

  function crearCliente(datos) {
    return resolveBackend().then(function (mode) {
      if (mode === 'sheets') {
        return sheetsApi().crearORecuperarCliente(datos).then(function (res) {
          guardarPasaporteLocal(res.id);
          return { id: res.id };
        });
      }
      return crearClienteFirestore(datos);
    });
  }

  function crearORecuperarCliente(datos) {
    return resolveBackend().then(function (mode) {
      if (mode === 'sheets') {
        if (!sheetsApi()) {
          return Promise.reject(new Error('Falta js/fidelizacion-sheets.js en esta página. Actualiza el sitio (deploy).'));
        }
        return sheetsApi().crearORecuperarCliente(datos).then(function (res) {
          guardarPasaporteLocal(res.id);
          return res;
        });
      }
      var tel = String(datos.telefono || datos.celular || '').trim();
      if (!tel) {
        return crearClienteFirestore(datos).then(function (ref) {
          return { id: ref.id, existed: false };
        });
      }
      return readyFirestore().collection('fidelizacion_clientes')
        .where('telefono', '==', tel)
        .limit(1)
        .get()
        .then(function (snap) {
          if (!snap.empty) {
            var doc = snap.docs[0];
            guardarPasaporteLocal(doc.id);
            return { id: doc.id, existed: true };
          }
          return crearClienteFirestore(Object.assign({}, datos, { telefono: tel, origen: datos.origen || 'registro' })).then(function (ref) {
            return { id: ref.id, existed: false };
          });
        });
    });
  }

  function obtenerCliente(clienteId) {
    return resolveBackend().then(function (mode) {
      if (mode === 'sheets') return sheetsApi().obtenerCliente(clienteId);
      return readyFirestore().collection('fidelizacion_clientes').doc(clienteId).get();
    });
  }

  function escucharCliente(clienteId, callback) {
    return resolveBackend().then(function (mode) {
      if (mode === 'sheets') return sheetsApi().escucharCliente(clienteId, callback);
      return readyFirestore().collection('fidelizacion_clientes').doc(clienteId).onSnapshot(callback);
    });
  }

  function listarTransaccionesCliente(clienteId, limite) {
    return resolveBackend().then(function (mode) {
      if (mode === 'sheets') return sheetsApi().listarTransaccionesCliente(clienteId, limite);
      var max = limite || 20;
      return readyFirestore().collection('fidelizacion_transacciones')
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
    });
  }

  function registrarTransaccion(clienteId, tipo, puntos, detalle) {
    return resolveBackend().then(function (mode) {
      if (mode === 'sheets') return sheetsApi().registrarTransaccion(clienteId, tipo, puntos, detalle);
      var firestore = readyFirestore();
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
    });
  }

  function crearOperador(datos) {
    var usuario = String(datos.usuario || '').trim().toLowerCase();
    if (!usuario || usuario.length < 3) return Promise.reject(new Error('Usuario inválido (mínimo 3 caracteres).'));
    if (!datos.standNombre) return Promise.reject(new Error('Nombre del stand es obligatorio.'));
    if (!datos.pin || String(datos.pin).length < 4) return Promise.reject(new Error('PIN de al menos 4 dígitos.'));

    return resolveBackend().then(function (mode) {
      if (mode === 'sheets') return sheetsApi().crearOperador(datos);
      var firestore = readyFirestore();
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
    });
  }

  function verificarOperador(usuario, pin) {
    var u = String(usuario || '').trim().toLowerCase();
    if (!u || !pin) return Promise.reject(new Error('Usuario y PIN son obligatorios.'));

    return resolveBackend().then(function (mode) {
      if (mode === 'sheets') return sheetsApi().verificarOperador(u, pin);
      return hashPin(pin).then(function (pinHash) {
        return readyFirestore().collection('fidelizacion_operadores')
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
    });
  }

  function yaEscaneadoHoy(operadorId, clienteId) {
    return resolveBackend().then(function (mode) {
      if (mode === 'sheets') return Promise.resolve(false);
      var dia = hoyColombia();
      var escaneoId = operadorId + '_' + clienteId + '_' + dia;
      return readyFirestore().collection('fidelizacion_escaneos').doc(escaneoId).get().then(function (snap) {
        return snap.exists;
      });
    });
  }

  function registrarPuntosEscaneo(operador, clienteId, textoQr) {
    return resolveBackend().then(function (mode) {
      if (mode === 'sheets') return sheetsApi().registrarPuntosEscaneo(operador, clienteId, textoQr);
      var parsed = parseClienteIdDesdeQr(textoQr || clienteId);
      if (!parsed) return Promise.reject(new Error('QR no reconocido. Usa el Pasaporte Cafetero.'));

      return yaEscaneadoHoy(operador.id, parsed).then(function (ya) {
        if (ya) throw new Error('Este visitante ya recibió puntos en tu stand hoy.');

        var puntos = operador.puntosPorEscaneo || PUNTOS_DEFAULT;
        var escaneoId = operador.id + '_' + parsed + '_' + hoyColombia();
        var firestore = readyFirestore();

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
    });
  }

  function db() {
    return resolveBackend().then(function (mode) {
      if (mode === 'sheets') {
        if (global.FidelizacionDbShim) return global.FidelizacionDbShim.create();
        throw new Error('Backend Sheets: falta js/fidelizacion-db-shim.js');
      }
      return readyFirestore();
    });
  }

  function probePasaportesBackend() {
    var api = sheetsApi();
    if (!api || !api.isAvailable()) {
      return Promise.resolve({ ready: false, message: 'URL de Apps Script no configurada.' });
    }
    return api.isPasaportesBackendReady().then(function (ready) {
      return {
        ready: ready,
        message: ready
          ? 'Backend Pasaportes (Google Sheets) operativo.'
          : 'Apps Script desactualizado: ejecuta py tools/setup_admin.py y sincronizarEncabezados() en el editor.'
      };
    });
  }

  global.Fidelizacion = {
    db: function () {
      if (backendMode === 'sheets' && global.FidelizacionDbShim) {
        return global.FidelizacionDbShim.create();
      }
      if (backendMode === 'firestore' || db) {
        try { return readyFirestore(); } catch (e) { /* fall through */ }
      }
      resolveBackend();
      if (backendMode === 'sheets' && global.FidelizacionDbShim) {
        return global.FidelizacionDbShim.create();
      }
      return readyFirestore();
    },
    initBackend: resolveBackend,
    probePasaportesBackend: probePasaportesBackend,
    getBackendMode: function () { return backendMode; },
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
    crearORecuperarCliente: crearORecuperarCliente,
    guardarPasaporteLocal: guardarPasaporteLocal,
    leerPasaporteLocal: leerPasaporteLocal,
    obtenerCliente: obtenerCliente,
    escucharCliente: escucharCliente,
    listarTransaccionesCliente: listarTransaccionesCliente,
    registrarTransaccion: registrarTransaccion,
    crearOperador: crearOperador,
    verificarOperador: verificarOperador,
    registrarPuntosEscaneo: registrarPuntosEscaneo
  };
})(window);
