/**
 * Panel de administración — autenticación y datos vía Apps Script.
 * Credenciales NUNCA en este archivo; se validan en el servidor.
 */
(function (global) {
  'use strict';

  var TOKEN_KEY = 'lsc_admin_token';
  var USER_KEY = 'lsc_admin_user';

  function getWebAppUrl() {
    var cfg = global.SHEETS_CONFIG || {};
    var url = (cfg.WEB_APP_URL || '').trim();
    if (!url || url.indexOf('TU_ID_DE_DEPLOYMENT') !== -1) return '';
    return url;
  }

  function getToken() {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function setSession(token, username) {
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(USER_KEY, username || '');
    } catch (e) { /* noop */ }
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    } catch (e) { /* noop */ }
  }

  function postJson(payload) {
    var url = getWebAppUrl();
    if (!url) {
      return Promise.resolve({ ok: false, error: 'URL de Apps Script no configurada.' });
    }
    return fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () {
        return { ok: false, error: 'Respuesta inválida del servidor.' };
      });
    }).catch(function (err) {
      return { ok: false, error: err.message || String(err) };
    });
  }

  function fetchDashboard(token) {
    var url = getWebAppUrl();
    if (!url) {
      return Promise.resolve({ ok: false, error: 'URL de Apps Script no configurada.' });
    }
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return fetch(url + sep + 'action=admin_dashboard&token=' + encodeURIComponent(token), {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store'
    }).then(function (res) {
      return res.json().catch(function () {
        return { ok: false, error: 'Respuesta inválida del servidor.' };
      });
    }).catch(function (err) {
      return { ok: false, error: err.message || String(err) };
    });
  }

  function login(username, password) {
    return postJson({ action: 'admin_login', username: username, password: password });
  }

  function logout() {
    var token = getToken();
    clearSession();
    if (token) {
      return postJson({ action: 'admin_logout', token: token });
    }
    return Promise.resolve({ ok: true });
  }

  function formatNumber(n) {
    return typeof n === 'number' ? n.toLocaleString('es-CO') : String(n || '0');
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderTable(headers, rows, columns) {
    if (!rows || !rows.length) {
      return '<p class="admin-empty">Sin registros todavía.</p>';
    }
    var cols = columns || headers;
    var html = '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>';
    cols.forEach(function (col) {
      html += '<th>' + escapeHtml(col) + '</th>';
    });
    html += '</tr></thead><tbody>';
    rows.forEach(function (row) {
      html += '<tr>';
      cols.forEach(function (col) {
        var val = row[col] || '';
        if (col.indexOf('enlace') !== -1 && val && val.indexOf('http') === 0) {
          html += '<td><a href="' + escapeHtml(val) + '" target="_blank" rel="noopener">Ver</a></td>';
        } else {
          html += '<td>' + escapeHtml(val) + '</td>';
        }
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderTopPages(topPages) {
    if (!topPages || !Object.keys(topPages).length) {
      return '<p class="admin-empty">Sin visitas hoy.</p>';
    }
    var entries = Object.keys(topPages).map(function (k) {
      return { path: k, count: topPages[k] };
    }).sort(function (a, b) { return b.count - a.count; }).slice(0, 8);

    var html = '<ul class="admin-top-pages">';
    entries.forEach(function (e) {
      html += '<li><span class="admin-top-pages__path">' + escapeHtml(e.path) + '</span>';
      html += '<span class="admin-top-pages__count">' + formatNumber(e.count) + '</span></li>';
    });
    html += '</ul>';
    return html;
  }

  function showLogin() {
    document.getElementById('adminLogin').hidden = false;
    document.getElementById('adminDashboard').hidden = true;
  }

  function showDashboard() {
    document.getElementById('adminLogin').hidden = true;
    document.getElementById('adminDashboard').hidden = false;
  }

  function setLoading(isLoading) {
    var el = document.getElementById('adminLoading');
    if (el) el.hidden = !isLoading;
  }

  function showError(msg) {
    var el = document.getElementById('adminError');
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.hidden = false;
    } else {
      el.hidden = true;
      el.textContent = '';
    }
  }

  function renderDashboard(data) {
    var stats = data.stats || {};
    document.getElementById('statVisitsToday').textContent = formatNumber(stats.visitsToday);
    document.getElementById('statVisitsTotal').textContent = formatNumber(stats.visitsTotal);
    document.getElementById('statFeria').textContent = formatNumber(stats.feriaRegistrations);
    document.getElementById('statCompetencia').textContent = formatNumber(stats.competenciaRegistrations);
    document.getElementById('statLista').textContent = formatNumber(stats.listaEspera);

    var cupo = stats.competenciaCupo || {};
    document.getElementById('statCupo').textContent =
      formatNumber(cupo.count) + ' / ' + formatNumber(cupo.max) +
      (cupo.completo ? ' (completo)' : '');

    document.getElementById('statConvFeria').textContent =
      (stats.conversionFeriaPct || 0) + '%';
    document.getElementById('statConvComp').textContent =
      (stats.conversionCompetenciaPct || 0) + '%';

    document.getElementById('topPagesToday').innerHTML = renderTopPages(stats.topPagesToday);

    var feriaCols = ['Fecha registro', 'ID', 'Nombre', 'Correo', 'Celular', 'Intereses', 'Estado registro'];
    document.getElementById('tableFeria').innerHTML =
      renderTable([], data.recentFeria || [], feriaCols);

    var compCols = [
      'Fecha registro', 'ID', 'Nombre', 'Correo', 'Celular', 'Ciudad',
      'Estado pago', 'Cupo confirmado', 'Comprobante enlace Drive'
    ];
    document.getElementById('tableCompetencia').innerHTML =
      renderTable([], data.recentCompetencia || [], compCols);

    var updated = document.getElementById('dashboardUpdated');
    if (updated && data.generatedAt) {
      updated.textContent = 'Actualizado: ' + new Date(data.generatedAt).toLocaleString('es-CO');
    }

    var userEl = document.getElementById('adminUserLabel');
    if (userEl) {
      try {
        userEl.textContent = sessionStorage.getItem(USER_KEY) || 'Admin';
      } catch (e) {
        userEl.textContent = 'Admin';
      }
    }
  }

  function loadDashboard() {
    var token = getToken();
    if (!token) {
      showLogin();
      return;
    }

    setLoading(true);
    showError('');
    fetchDashboard(token).then(function (data) {
      setLoading(false);
      if (!data.ok) {
        if (data.error && data.error.indexOf('Sesión') !== -1) {
          clearSession();
          showLogin();
        }
        showError(data.error || 'No se pudo cargar el panel.');
        return;
      }
      showDashboard();
      renderDashboard(data);
    });
  }

  function bindEvents() {
    var form = document.getElementById('loginForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        showError('');
        var username = (document.getElementById('loginUsername').value || '').trim();
        var password = document.getElementById('loginPassword').value || '';
        if (!username || !password) {
          showError('Ingresa usuario y contraseña.');
          return;
        }
        setLoading(true);
        login(username, password).then(function (result) {
          setLoading(false);
          if (!result.ok) {
            showError(result.error || 'No se pudo iniciar sesión.');
            return;
          }
          setSession(result.token, result.username);
          loadDashboard();
        });
      });
    }

    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        logout().then(function () {
          showLogin();
          showError('');
        });
      });
    }

    var refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        loadDashboard();
      });
    }
  }

  function init() {
    if (!getWebAppUrl()) {
      showError('Configura js/sheets-config.js con la URL de Apps Script.');
      showLogin();
      return;
    }
    bindEvents();
    if (getToken()) {
      loadDashboard();
    } else {
      showLogin();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
