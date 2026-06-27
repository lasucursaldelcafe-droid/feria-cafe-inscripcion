/**
 * Backend Pasaporte Cafetero vía Google Sheets (Apps Script).
 * Se usa automáticamente cuando Firestore no está disponible.
 */
(function (global) {
  'use strict';

  function webAppUrl() {
    var cfg = global.SHEETS_CONFIG || {};
    return (cfg.WEB_APP_URL || '').trim();
  }

  function sheetsGet(action, params) {
    var url = webAppUrl();
    if (!url) return Promise.reject(new Error('URL de Apps Script no configurada (js/sheets-config.js).'));
    var qs = 'action=' + encodeURIComponent(action);
    if (params) {
      Object.keys(params).forEach(function (key) {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          qs += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
        }
      });
    }
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return fetch(url + sep + qs, { method: 'GET', mode: 'cors', cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || data.ok === false) {
          var err = (data && data.error) || 'Error del servidor Sheets.';
          if (String(err).indexOf('formType inválido') !== -1) {
            throw new Error('Apps Script desactualizado: falta pasaporte_list. Ejecuta py tools/setup_admin.py y sincronizarEncabezados().');
          }
          throw new Error(err);
        }
        if (action === 'pasaporte_list' && !Array.isArray(data.clientes)) {
          throw new Error('Apps Script desactualizado: falta action=pasaporte_list. Ejecuta py tools/setup_admin.py.');
        }
        return data;
      });
  }

  function sheetsPost(body) {
    var url = webAppUrl();
    if (!url) return Promise.reject(new Error('URL de Apps Script no configurada.'));
    return fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || data.ok === false) {
          var err = (data && data.error) || 'Error del servidor Sheets.';
          if (String(err).indexOf('formType inválido') !== -1) {
            throw new Error('Apps Script desactualizado: redepliega Code.gs (py tools/setup_admin.py).');
          }
          throw new Error(err);
        }
        return data;
      });
  }

  function fakeTimestamp(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return {
      toDate: function () { return d; },
      toMillis: function () { return d.getTime(); }
    };
  }

  function clienteToDoc(cliente) {
    if (!cliente) return null;
    return {
      exists: true,
      id: cliente.id,
      data: function () {
        return {
          nombre: cliente.nombre || '',
          telefono: cliente.telefono || '',
          email: cliente.email || '',
          puntos: cliente.puntos || 0,
          puntosHistoricos: cliente.puntosHistoricos || 0,
          nivel: cliente.nivel || 'Bronce',
          activo: cliente.activo !== false,
          origen: cliente.origen || '',
          fechaRegistro: fakeTimestamp(cliente.fechaRegistro),
          ultimaVisita: fakeTimestamp(cliente.fechaRegistro)
        };
      }
    };
  }

  function isAvailable() {
    return !!webAppUrl();
  }

  function pasaportesBackendReady(data) {
    return !!(data && data.ok && Array.isArray(data.clientes));
  }

  function probe() {
    return sheetsGet('pasaporte_list', { limit: 1 }).then(function (data) {
      return pasaportesBackendReady(data);
    }).catch(function () {
      return false;
    });
  }

  function isPasaportesBackendReady() {
    return probe();
  }

  function crearORecuperarCliente(datos) {
    return sheetsPost({
      action: 'pasaporte_create',
      nombre: datos.nombre || '',
      telefono: datos.telefono || datos.celular || '',
      email: datos.email || datos.correo || '',
      origen: datos.origen || 'registro'
    }).then(function (res) {
      return { id: res.id, existed: !!res.existed };
    });
  }

  function obtenerCliente(clienteId) {
    return sheetsGet('pasaporte_get', { id: clienteId }).then(function (res) {
      return clienteToDoc(res.cliente);
    });
  }

  function escucharCliente(clienteId, callback) {
    var stopped = false;
    function poll() {
      if (stopped) return;
      obtenerCliente(clienteId).then(function (snap) {
        if (!stopped && snap) callback(snap);
      }).catch(function () { /* ignore poll errors */ });
    }
    poll();
    var timer = setInterval(poll, 5000);
    return function () {
      stopped = true;
      clearInterval(timer);
    };
  }

  function listarTransaccionesCliente(clienteId, limite) {
    return sheetsGet('pasaporte_tx', { clienteId: clienteId, limit: limite || 20 }).then(function (res) {
      var items = (res.transacciones || []).map(function (t) {
        return {
          data: function () {
            return {
              puntos: t.puntos,
              descripcion: t.descripcion,
              sede: t.sede,
              tipo: t.tipo,
              fecha: fakeTimestamp(t.fecha)
            };
          }
        };
      });
      return {
        empty: items.length === 0,
        forEach: function (fn) { items.forEach(fn); }
      };
    });
  }

  function registrarTransaccion(clienteId, tipo, puntos, detalle) {
    return sheetsPost({
      action: 'pasaporte_transaccion',
      clienteId: clienteId,
      tipo: tipo,
      puntos: puntos,
      descripcion: (detalle && detalle.descripcion) || '',
      sede: (detalle && detalle.sede) || '',
      operadorId: (detalle && detalle.operadorId) || ''
    });
  }

  function crearOperador(datos) {
    return global.Fidelizacion.hashPin(datos.pin).then(function (pinHash) {
      return sheetsPost({
        action: 'pasaporte_operador_create',
        standNombre: datos.standNombre,
        usuario: datos.usuario,
        pinHash: pinHash,
        puntosPorEscaneo: datos.puntosPorEscaneo
      });
    });
  }

  function verificarOperador(usuario, pin) {
    return global.Fidelizacion.hashPin(pin).then(function (pinHash) {
      return sheetsPost({
        action: 'pasaporte_operador_verify',
        usuario: usuario,
        pinHash: pinHash
      }).then(function (res) {
        var op = res.operador || {};
        return {
          id: op.id,
          standNombre: op.standNombre,
          puntosPorEscaneo: op.puntosPorEscaneo || 10,
          usuario: op.usuario
        };
      });
    });
  }

  function yaEscaneadoHoy(operadorId, clienteId) {
    var dia = global.Fidelizacion.hoyColombia();
    var escaneoId = operadorId + '_' + clienteId + '_' + dia;
    return Promise.resolve(false).then(function () {
      return sheetsGet('pasaporte_tx', { clienteId: clienteId, limit: 50 }).then(function () {
        return false;
      });
    }).catch(function () { return false; });
  }

  function registrarPuntosEscaneo(operador, clienteId, textoQr) {
    var parsed = global.Fidelizacion.parseClienteIdDesdeQr(textoQr || clienteId);
    if (!parsed) return Promise.reject(new Error('QR no reconocido. Usa el Pasaporte Cafetero.'));

    return sheetsPost({
      action: 'pasaporte_escaneo',
      operadorId: operador.id,
      clienteId: parsed,
      puntos: operador.puntosPorEscaneo || 10,
      standNombre: operador.standNombre
    }).then(function (res) {
      return {
        clienteId: res.clienteId,
        nombre: res.nombre,
        puntosOtorgados: res.puntosOtorgados,
        puntosTotales: res.puntosTotales,
        nivel: res.nivel
      };
    });
  }

  function listClientes(limit) {
    return sheetsGet('pasaporte_list', { limit: limit || 50 }).then(function (res) {
      return res.clientes || [];
    });
  }

  function listOperadores() {
    return sheetsGet('pasaporte_ops', {}).then(function (res) {
      return res.operadores || [];
    });
  }

  function toggleOperador(id, activo) {
    return sheetsPost({ action: 'pasaporte_operador_toggle', id: id, activo: activo });
  }

  global.FidelizacionSheets = {
    isAvailable: isAvailable,
    probe: probe,
    isPasaportesBackendReady: isPasaportesBackendReady,
    pasaportesBackendReady: pasaportesBackendReady,
    crearORecuperarCliente: crearORecuperarCliente,
    obtenerCliente: obtenerCliente,
    escucharCliente: escucharCliente,
    listarTransaccionesCliente: listarTransaccionesCliente,
    registrarTransaccion: registrarTransaccion,
    crearOperador: crearOperador,
    verificarOperador: verificarOperador,
    registrarPuntosEscaneo: registrarPuntosEscaneo,
    listClientes: listClientes,
    listOperadores: listOperadores,
    toggleOperador: toggleOperador,
    sheetsGet: sheetsGet,
    sheetsPost: sheetsPost,
    fakeTimestamp: fakeTimestamp,
    clienteToDoc: clienteToDoc
  };
})(window);
