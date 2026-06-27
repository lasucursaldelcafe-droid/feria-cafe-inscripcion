/**
 * Sección Pasaportes del panel admin — crear y listar clientes.
 */
(function (global) {
  'use strict';

  var mounted = false;
  var unsubClientes = null;

  function root() {
    return document.getElementById('adminPasaportesRoot');
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderShell() {
    var el = root();
    if (!el || mounted) return;
    mounted = true;

    el.innerHTML =
      '<div class="admin-card">' +
        '<h4 class="admin-card__title">Crear Pasaporte Cafetero</h4>' +
        '<p class="admin-table-meta">Genera la tarjeta digital con QR para un visitante. Funciona con Firestore o Google Sheets.</p>' +
        '<form id="formAdminPasaporte" class="admin-inline-form">' +
          '<div class="admin-inline-form__row">' +
            '<label class="admin-inline-form__field"><span>Nombre *</span>' +
            '<input type="text" id="adminPasNombre" required maxlength="120"></label>' +
            '<label class="admin-inline-form__field"><span>Teléfono (WhatsApp) *</span>' +
            '<input type="tel" id="adminPasTelefono" required maxlength="30"></label>' +
            '<label class="admin-inline-form__field"><span>Correo</span>' +
            '<input type="email" id="adminPasEmail" maxlength="120"></label>' +
          '</div>' +
          '<div class="admin-inline-form__actions">' +
            '<button type="submit" class="admin-btn admin-btn--primary" id="adminPasSubmit">Crear pasaporte</button>' +
          '</div>' +
        '</form>' +
        '<div id="adminPasResult" class="admin-create-result" hidden role="status"></div>' +
      '</div>' +
      '<div class="admin-card">' +
        '<h4 class="admin-card__title">Clientes recientes</h4>' +
        '<p id="adminPasFirestoreStatus" class="admin-table-meta"></p>' +
        '<div id="adminPasClientesTable"></div>' +
      '</div>';

    document.getElementById('formAdminPasaporte').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = document.getElementById('adminPasSubmit');
      var resultEl = document.getElementById('adminPasResult');
      var nombre = document.getElementById('adminPasNombre').value.trim();
      var telefono = document.getElementById('adminPasTelefono').value.trim();
      var email = document.getElementById('adminPasEmail').value.trim();

      if (!nombre || !telefono) return;

      btn.disabled = true;
      btn.textContent = 'Creando…';
      resultEl.hidden = true;

      global.Fidelizacion.initBackend().then(function () {
        return global.Fidelizacion.crearORecuperarCliente({
          nombre: nombre,
          telefono: telefono,
          email: email,
          origen: 'admin'
        });
      }).then(function (res) {
        btn.disabled = false;
        btn.textContent = 'Crear pasaporte';
        var url = global.Fidelizacion.urlPasaporte(res.id);
        var existed = res.existed ? ' (ya existía)' : '';
        resultEl.innerHTML =
          '<p><strong>Pasaporte listo' + existed + ':</strong> ' + escapeHtml(nombre) + '</p>' +
          '<p><a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">Abrir pasaporte</a> · ' +
          '<button type="button" class="admin-btn admin-btn--secondary admin-btn--sm" id="adminPasCopiar">Copiar enlace</button></p>';
        resultEl.hidden = false;
        document.getElementById('adminPasCopiar').addEventListener('click', function () {
          navigator.clipboard.writeText(url);
        });
        document.getElementById('formAdminPasaporte').reset();
        listenClientes();
      }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = 'Crear pasaporte';
        resultEl.innerHTML = '<p style="margin:0;color:var(--admin-accent-red,#e07070)">' +
          escapeHtml(err.message || 'No se pudo crear el pasaporte. ¿Redesplegaste Code.gs?') + '</p>';
        resultEl.hidden = false;
      });
    });
  }

  function renderClientesTable(docs) {
    var tableEl = document.getElementById('adminPasClientesTable');
    if (!tableEl) return;

    if (!docs.length) {
      tableEl.innerHTML = '<p class="admin-empty">Aún no hay pasaportes creados.</p>';
      return;
    }

    var html = '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
      '<th>Nombre</th><th>Teléfono</th><th>Nivel</th><th>Puntos</th><th></th></tr></thead><tbody>';
    docs.forEach(function (item) {
      var url = global.Fidelizacion.urlPasaporte(item.id);
      html += '<tr><td>' + escapeHtml(item.nombre) + '</td><td>' + escapeHtml(item.telefono) + '</td>' +
        '<td>' + escapeHtml(item.nivel || 'Bronce') + '</td><td>' + (item.puntos || 0) + '</td>' +
        '<td><a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">Ver</a></td></tr>';
    });
    html += '</tbody></table></div>';
    tableEl.innerHTML = html;
  }

  function listenClientes() {
    var statusEl = document.getElementById('adminPasFirestoreStatus');
    if (unsubClientes) {
      if (typeof unsubClientes === 'function') unsubClientes();
      unsubClientes = null;
    }

    global.Fidelizacion.initBackend().then(function (mode) {
      if (statusEl) {
        statusEl.textContent = mode === 'firestore'
          ? 'Sincronizado con Firestore.'
          : 'Sincronizado con Google Sheets (Apps Script).';
      }
      unsubClientes = global.Fidelizacion.db().collection('fidelizacion_clientes').onSnapshot(function (snap) {
        var items = [];
        snap.forEach(function (doc) {
          var d = doc.data();
          items.push({
            id: doc.id,
            nombre: d.nombre || '',
            telefono: d.telefono || '',
            nivel: d.nivel || 'Bronce',
            puntos: d.puntos || 0
          });
        });
        items.sort(function (a, b) { return String(b.id).localeCompare(String(a.id)); });
        renderClientesTable(items.slice(0, 25));
      });
    }).catch(function (err) {
      if (statusEl) statusEl.textContent = err.message || 'Error de conexión.';
      renderClientesTable([]);
    });
  }

  function onShow() {
    renderShell();
    listenClientes();
  }

  global.AdminPasaportes = {
    mount: renderShell,
    onShow: onShow
  };
})(window);
