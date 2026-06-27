/**
 * Sección Operadores de confianza — escáner Pasaporte Cafetero por stand.
 */
(function (global) {
  'use strict';

  var mounted = false;
  var unsubOps = null;

  function root() {
    return document.getElementById('adminOperadoresRoot');
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escanerUrl() {
    return global.SiteLinks ? global.SiteLinks.absUrl('escanearPasaporte') : '/escanear-pasaporte';
  }

  function renderShell() {
    var el = root();
    if (!el || mounted) return;
    mounted = true;

    el.innerHTML =
      '<div class="admin-card">' +
        '<h4 class="admin-card__title">Crear operador de confianza</h4>' +
        '<p class="admin-table-meta">Usuario y PIN para escanear Pasaportes en ' +
        '<a href="' + escapeHtml(escanerUrl()) + '" target="_blank" rel="noopener">' + escapeHtml(escanerUrl()) + '</a>.</p>' +
        '<form id="formAdminOperador" class="admin-inline-form">' +
          '<div class="admin-inline-form__row">' +
            '<label class="admin-inline-form__field"><span>Nombre del stand *</span>' +
            '<input type="text" id="adminOpStand" required maxlength="120"></label>' +
            '<label class="admin-inline-form__field"><span>Usuario *</span>' +
            '<input type="text" id="adminOpUsuario" required maxlength="40" placeholder="cafe-arabica"></label>' +
            '<label class="admin-inline-form__field admin-inline-form__field--sm"><span>PIN *</span>' +
            '<input type="password" id="adminOpPin" required minlength="4" maxlength="12"></label>' +
            '<label class="admin-inline-form__field admin-inline-form__field--sm"><span>Pts/escaneo</span>' +
            '<input type="number" id="adminOpPuntos" value="10" min="1" max="100"></label>' +
          '</div>' +
          '<div class="admin-inline-form__actions">' +
            '<button type="submit" class="admin-btn admin-btn--primary" id="adminOpSubmit">Crear operador</button>' +
          '</div>' +
        '</form>' +
        '<div id="adminOpResult" class="admin-create-result" hidden role="status"></div>' +
        '<p id="adminOpFirestoreStatus" class="admin-table-meta"></p>' +
      '</div>' +
      '<div class="admin-card">' +
        '<h4 class="admin-card__title">Operadores activos</h4>' +
        '<div id="adminOpTable"></div>' +
      '</div>';

    document.getElementById('formAdminOperador').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = document.getElementById('adminOpSubmit');
      var resultEl = document.getElementById('adminOpResult');
      var stand = document.getElementById('adminOpStand').value.trim();
      var usuario = document.getElementById('adminOpUsuario').value.trim();
      var pin = document.getElementById('adminOpPin').value;
      var puntos = document.getElementById('adminOpPuntos').value;

      btn.disabled = true;
      btn.textContent = 'Creando…';
      resultEl.hidden = true;

      global.Fidelizacion.initBackend().then(function () {
        return global.Fidelizacion.crearOperador({
          standNombre: stand,
          usuario: usuario,
          pin: pin,
          puntosPorEscaneo: puntos
        });
      }).then(function () {
        btn.disabled = false;
        btn.textContent = 'Crear operador';
        resultEl.innerHTML =
          '<p><strong>Operador creado</strong> — Comparte con el stand:</p>' +
          '<p>Usuario: <code>' + escapeHtml(usuario.toLowerCase()) + '</code> · PIN: <code>' +
          escapeHtml(pin) + '</code> · Stand: ' + escapeHtml(stand) + '</p>';
        resultEl.hidden = false;
        document.getElementById('formAdminOperador').reset();
        document.getElementById('adminOpPuntos').value = '10';
      }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = 'Crear operador';
        resultEl.innerHTML = '<p style="margin:0;color:var(--admin-accent-red,#e07070)">' +
          escapeHtml(err.message || 'Error al crear operador.') + '</p>';
        resultEl.hidden = false;
      });
    });
  }

  function renderTable(ops) {
    var tableEl = document.getElementById('adminOpTable');
    if (!tableEl) return;

    if (!ops.length) {
      tableEl.innerHTML = '<p class="admin-empty">Aún no hay operadores. Crea uno por cada stand autorizado.</p>';
      return;
    }

    var html = '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
      '<th>Stand</th><th>Usuario</th><th>Pts/escaneo</th><th>Estado</th><th></th></tr></thead><tbody>';
    ops.forEach(function (op) {
      html += '<tr><td>' + escapeHtml(op.standNombre) + '</td><td><code>' + escapeHtml(op.usuario) +
        '</code></td><td>' + (op.puntosPorEscaneo || 10) + '</td><td>' +
        (op.activo ? 'Activo' : 'Inactivo') + '</td><td>' +
        '<button type="button" class="admin-btn admin-btn--sm admin-btn--secondary admin-op-toggle" data-op-id="' +
        escapeHtml(op.id) + '" data-op-active="' + (op.activo ? '0' : '1') + '">' +
        (op.activo ? 'Desactivar' : 'Activar') + '</button></td></tr>';
    });
    html += '</tbody></table></div>';
    tableEl.innerHTML = html;

    tableEl.querySelectorAll('.admin-op-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-op-id');
        var activate = btn.getAttribute('data-op-active') === '1';
        btn.disabled = true;
        global.Fidelizacion.db().collection('fidelizacion_operadores').doc(id)
          .update({ activo: activate })
          .finally(function () { btn.disabled = false; });
      });
    });
  }

  function listenOperadores() {
    var statusEl = document.getElementById('adminOpFirestoreStatus');
    if (unsubOps && typeof unsubOps === 'function') unsubOps();

    global.Fidelizacion.initBackend().then(function (mode) {
      if (statusEl) {
        statusEl.textContent = mode === 'firestore'
          ? 'Backend Firestore activo.'
          : 'Backend Google Sheets activo.';
      }
      unsubOps = global.Fidelizacion.db().collection('fidelizacion_operadores').onSnapshot(function (snap) {
        var items = [];
        snap.forEach(function (doc) {
          items.push(Object.assign({ id: doc.id }, doc.data()));
        });
        items.sort(function (a, b) {
          return String(a.standNombre || '').localeCompare(String(b.standNombre || ''), 'es');
        });
        renderTable(items);
      });
    }).catch(function (err) {
      if (statusEl) statusEl.textContent = err.message || 'Error de conexión.';
      renderTable([]);
    });
  }

  function onShow() {
    renderShell();
    listenOperadores();
  }

  global.AdminOperadores = { onShow: onShow };
})(window);
