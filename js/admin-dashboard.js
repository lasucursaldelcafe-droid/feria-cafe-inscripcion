/**
 * Panel de administración — Firebase Auth (Google) + datos vía Apps Script.
 * Solo lasucursaldelcafe@gmail.com puede acceder (validado en cliente y servidor).
 */
(function (global) {
  'use strict';

  var auth = null;
  var currentUser = null;

  function getAllowedEmail() {
    return String(global.ALLOWED_ADMIN_EMAIL || 'lasucursaldelcafe@gmail.com').trim().toLowerCase();
  }

  function getWebAppUrl() {
    var cfg = global.SHEETS_CONFIG || {};
    var url = (cfg.WEB_APP_URL || '').trim();
    if (!url || url.indexOf('TU_ID_DE_DEPLOYMENT') !== -1) return '';
    return url;
  }

  function initFirebase() {
    var cfg = global.FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey || cfg.apiKey === 'TU_API_KEY') {
      throw new Error('Configura js/firebase-config.js con tu app web de Firebase.');
    }
    if (!global.firebase || !global.firebase.apps) {
      throw new Error('Firebase SDK no cargado.');
    }
    if (!global.firebase.apps.length) {
      global.firebase.initializeApp(cfg);
    }
    auth = global.firebase.auth();
    return auth;
  }

  function isAuthorizedEmail(email) {
    return String(email || '').trim().toLowerCase() === getAllowedEmail();
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

  function fetchDashboard(idToken) {
    var url = getWebAppUrl();
    if (!url) {
      return Promise.resolve({ ok: false, error: 'URL de Apps Script no configurada.' });
    }
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return fetch(
      url + sep + 'action=admin_dashboard&idToken=' + encodeURIComponent(idToken),
      { method: 'GET', mode: 'cors', cache: 'no-store' }
    ).then(function (res) {
      return res.json().catch(function () {
        return { ok: false, error: 'Respuesta inválida del servidor.' };
      });
    }).catch(function (err) {
      return { ok: false, error: err.message || String(err) };
    });
  }

  function signOutUser() {
    currentUser = null;
    if (!auth) return Promise.resolve();
    return auth.signOut().catch(function () { /* noop */ });
  }

  function rejectUnauthorizedUser(user) {
    currentUser = null;
    return signOutUser().then(function () {
      showLogin();
      showError('No autorizado. Solo ' + getAllowedEmail() + ' puede acceder al panel.');
    });
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
      userEl.textContent = currentUser && currentUser.email ? currentUser.email : 'Admin';
    }
  }

  function loadDashboard(user) {
    if (!user) {
      showLogin();
      return;
    }

    if (!isAuthorizedEmail(user.email)) {
      return rejectUnauthorizedUser(user);
    }

    setLoading(true);
    showError('');

    user.getIdToken(true).then(function (idToken) {
      return fetchDashboard(idToken);
    }).then(function (data) {
      setLoading(false);
      if (!data.ok) {
        if (data.error && (data.error.indexOf('autorizado') !== -1 || data.error.indexOf('inválida') !== -1)) {
          return rejectUnauthorizedUser(user);
        }
        showError(data.error || 'No se pudo cargar el panel.');
        return;
      }
      currentUser = user;
      showDashboard();
      renderDashboard(data);
    }).catch(function (err) {
      setLoading(false);
      showError(err.message || 'Error al cargar el panel.');
    });
  }

  function signInWithGoogle() {
    if (!auth) return;
    showError('');
    setLoading(true);
    var provider = new global.firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then(function (result) {
      var user = result.user;
      if (!isAuthorizedEmail(user.email)) {
        setLoading(false);
        return rejectUnauthorizedUser(user);
      }
      return loadDashboard(user);
    }).catch(function (err) {
      setLoading(false);
      if (err.code === 'auth/popup-closed-by-user') {
        showError('');
        return;
      }
      if (err.code === 'auth/unauthorized-domain') {
        showError('Dominio no autorizado en Firebase. Agrega este sitio en Authentication → Dominios autorizados.');
        return;
      }
      showError(err.message || 'No se pudo iniciar sesión con Google.');
    });
  }

  function bindEvents() {
    var googleBtn = document.getElementById('googleSignInBtn');
    if (googleBtn) {
      googleBtn.addEventListener('click', signInWithGoogle);
    }

    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        signOutUser().then(function () {
          showLogin();
          showError('');
        });
      });
    }

    var refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        if (currentUser) loadDashboard(currentUser);
      });
    }
  }

  function init() {
    if (!getWebAppUrl()) {
      showError('Configura js/sheets-config.js con la URL de Apps Script.');
      showLogin();
      return;
    }

    try {
      initFirebase();
    } catch (err) {
      showError(err.message || String(err));
      showLogin();
      return;
    }

    bindEvents();

    auth.onAuthStateChanged(function (user) {
      if (!user) {
        currentUser = null;
        showLogin();
        setLoading(false);
        return;
      }
      if (!isAuthorizedEmail(user.email)) {
        rejectUnauthorizedUser(user);
        return;
      }
      loadDashboard(user);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
