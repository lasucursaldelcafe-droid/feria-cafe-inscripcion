/**
 * Shim Firestore-like para dashboard-fidelizacion cuando el backend es Google Sheets.
 */
(function (global) {
  'use strict';

  function SheetsCollection(name) {
    this.name = name;
    this._limit = null;
  }

  SheetsCollection.prototype.limit = function (n) {
    this._limit = n;
    return this;
  };

  SheetsCollection.prototype.get = function () {
    var self = this;
    var api = global.FidelizacionSheets;
    if (self.name === 'fidelizacion_clientes') {
      return api.listClientes(self._limit || 500).then(function (rows) {
        return {
          empty: !rows.length,
          docs: rows.map(function (r) {
            return {
              id: r.id,
              data: function () {
                return {
                  nombre: r.nombre,
                  telefono: r.telefono,
                  email: r.email,
                  puntos: r.puntos,
                  puntosHistoricos: r.puntosHistoricos,
                  nivel: r.nivel,
                  activo: r.activo,
                  ultimaVisita: api.fakeTimestamp(r.fechaRegistro),
                  fechaRegistro: api.fakeTimestamp(r.fechaRegistro)
                };
              }
            };
          }),
          forEach: function (fn) {
            this.docs.forEach(fn);
          }
        };
      });
    }
    if (self.name === 'fidelizacion_transacciones') {
      return api.sheetsGet('pasaporte_tx', { limit: self._limit || 300 }).then(function (res) {
        var rows = res.transacciones || [];
        return {
          empty: !rows.length,
          docs: rows.map(function (t) {
            return {
              id: t.id,
              data: function () {
                return {
                  clienteId: t.clienteId,
                  tipo: t.tipo,
                  puntos: t.puntos,
                  descripcion: t.descripcion,
                  sede: t.sede,
                  fecha: api.fakeTimestamp(t.fecha)
                };
              }
            };
          }),
          forEach: function (fn) { this.docs.forEach(fn); }
        };
      });
    }
    return Promise.resolve({ empty: true, docs: [], forEach: function () {} });
  };

  SheetsCollection.prototype.onSnapshot = function (callback) {
    var self = this;
    var stopped = false;

    function emit() {
      if (stopped) return;
      self.get().then(function (snap) {
        if (!stopped) callback(snap);
      }).catch(function () { /* ignore */ });
    }

    emit();
    var timer = setInterval(emit, 6000);
    return function () {
      stopped = true;
      clearInterval(timer);
    };
  };

  SheetsCollection.prototype.add = function (data) {
    var api = global.FidelizacionSheets;
    if (this.name === 'fidelizacion_recompensas' || this.name === 'fidelizacion_promociones') {
      return api.sheetsPost({
        action: 'pasaporte_config_save',
        key: this.name,
        data: { items: [{ id: 'item-' + Date.now(), activa: true, nombre: data.nombre || '', puntos: data.puntos, descripcion: data.descripcion }] }
      });
    }
    return Promise.reject(new Error('Colección no soportada en modo Sheets: ' + this.name));
  };

  SheetsCollection.prototype.doc = function (id) {
    return new SheetsDoc(this.name, id);
  };

  function SheetsDoc(collectionName, id) {
    this.collectionName = collectionName;
    this.id = id;
  }

  SheetsDoc.prototype.get = function () {
    var api = global.FidelizacionSheets;
    if (this.collectionName === 'fidelizacion_config') {
      return api.sheetsGet('pasaporte_config', { key: this.id }).then(function (res) {
        return {
          exists: !!(res.data && Object.keys(res.data).length),
          data: function () { return res.data || {}; }
        };
      });
    }
    if (this.collectionName === 'fidelizacion_clientes') {
      return api.obtenerCliente(this.id);
    }
    return Promise.resolve({ exists: false, data: function () { return {}; } });
  };

  SheetsDoc.prototype.set = function (data) {
    return global.FidelizacionSheets.sheetsPost({
      action: 'pasaporte_config_save',
      key: this.id,
      data: data
    });
  };

  SheetsDoc.prototype.update = function (data) {
    if (this.collectionName === 'fidelizacion_operadores' && data.activo !== undefined) {
      return global.FidelizacionSheets.toggleOperador(this.id, data.activo);
    }
    return Promise.resolve();
  };

  SheetsDoc.prototype.delete = function () {
    return Promise.resolve();
  };

  function create() {
    return {
      collection: function (name) {
        if (name === 'fidelizacion_operadores') {
          return {
            onSnapshot: function (cb) {
              var stopped = false;
              function poll() {
                if (stopped) return;
                global.FidelizacionSheets.listOperadores().then(function (ops) {
                  if (stopped) return;
                  cb({
                    forEach: function (fn) {
                      ops.forEach(function (op) {
                        fn({
                          id: op.id,
                          data: function () {
                            return {
                              standNombre: op.standNombre,
                              usuario: op.usuario,
                              puntosPorEscaneo: op.puntosPorEscaneo,
                              activo: op.activo
                            };
                          }
                        });
                      });
                    }
                  });
                });
              }
              poll();
              var t = setInterval(poll, 6000);
              return function () { stopped = true; clearInterval(t); };
            },
            doc: function (id) { return new SheetsDoc('fidelizacion_operadores', id); }
          };
        }
        return new SheetsCollection(name);
      }
    };
  }

  global.FidelizacionDbShim = { create: create };
})(window);
