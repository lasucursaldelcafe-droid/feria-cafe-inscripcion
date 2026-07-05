/**
 * Portal de resultados — competidor ingresa con nombre + documento (cédula).
 */
(function () {
  'use strict';

  var SESSION_KEY = 'lsc_jurado_resultados_session';
  var REFRESH_MS = 8000;
  var tenantSlug = '';

  var refreshTimer = null;
  var currentData = null;

  function $(id) {
    return document.getElementById(id);
  }

  function initTenantFromUrl() {
    try {
      var raw = String(new URLSearchParams(window.location.search).get('evt') || '').trim().toLowerCase();
      if (raw && /^[a-z0-9][a-z0-9-]{0,48}$/.test(raw)) tenantSlug = raw;
    } catch (e) { tenantSlug = ''; }
  }

  function webAppUrl() {
    var cfg = window.SHEETS_CONFIG || {};
    return String(cfg.WEB_APP_URL || '').trim();
  }

  function sheetsPost(body) {
    var url = webAppUrl();
    if (!url) return Promise.reject(new Error('Backend no configurado.'));
    return fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    }).then(function (res) { return res.json(); });
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function readSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeSession(sess) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    } catch (e) { /* ignore */ }
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function applyBranding(evento) {
    if (!evento) return;
    if (evento.nombre) {
      var title = $('headerTitle');
      if (title) title.textContent = evento.nombre;
      document.title = evento.nombre + ' — Mis resultados';
    }
    if (evento.subtitulo) {
      var sub = $('headerSubtitle');
      if (sub) sub.textContent = evento.subtitulo;
    }
    if (evento.logoUrl) {
      var logo = $('headerLogo');
      if (logo) logo.src = evento.logoUrl;
    }
    if (evento.accentColor) {
      document.documentElement.style.setProperty('--jurado-accent', evento.accentColor);
    }
    if (evento.primaryColor) {
      document.documentElement.style.setProperty('--jurado-primary', evento.primaryColor);
    }
  }

  function estadoLabel(estado) {
    if (estado === 'activo') return 'En competencia';
    if (estado === 'eliminado') return 'Eliminado';
    if (estado === 'inscrito') return 'Inscrito';
    return 'Pendiente';
  }

  function estadoClass(estado) {
    if (estado === 'activo') return 'jurado-result-estado--activo';
    if (estado === 'eliminado') return 'jurado-result-estado--out';
    return 'jurado-result-estado--pending';
  }

  function judgeDone(judges, num) {
    var g = judges && judges['j' + num];
    return !!(g && g.subtotal != null);
  }

  function renderResults(data) {
    currentData = data;
    applyBranding(data.evento);

    var comp = data.competidor || {};
    var torneo = data.torneo || {};
    var cal = data.calificacion;
    var scoring = data.scoring || {};
    var jmax = scoring.jueces || 3;
    var criteria = scoring.criteria && scoring.criteria.length
      ? scoring.criteria
      : [
        { key: 'aroma', label: 'Aroma' },
        { key: 'dulzor', label: 'Dulzor' },
        { key: 'acidez', label: 'Acidez' },
        { key: 'sabor', label: 'Sabor' },
        { key: 'balance', label: 'Balance' },
        { key: 'cuerpo', label: 'Cuerpo' },
        { key: 'limpieza_taza', label: 'Limpieza de taza' }
      ];

    $('resultCompetidorNombre').textContent = comp.nombre || '—';
    $('resultCompetidorMeta').textContent = [
      comp.ciudad ? 'Ciudad: ' + comp.ciudad : '',
      comp.representa ? 'Representa: ' + comp.representa : ''
    ].filter(Boolean).join(' · ');

    var estadoEl = $('resultEstadoBadge');
    estadoEl.textContent = estadoLabel(torneo.estado);
    estadoEl.className = 'jurado-result-estado ' + estadoClass(torneo.estado);
    $('resultFaseLabel').textContent = torneo.faseLabel || 'Torneo';

    var total = cal && cal.sumaTotal != null ? cal.sumaTotal + ' pts' : '—';
    $('resultTotalPts').textContent = total;
    $('resultPromedio').textContent = cal && cal.promedio != null
      ? 'Promedio jueces: ' + cal.promedio
      : 'Aún sin puntaje completo';

    var judgesHtml = '';
    for (var j = 1; j <= jmax; j++) {
      var judge = cal && cal.judges ? cal.judges['j' + j] : null;
      var done = judgeDone(cal && cal.judges, j);
      judgesHtml += '<article class="jurado-result-judge-card' + (done ? ' jurado-result-judge-card--done' : '') + '">';
      judgesHtml += '<h3>Juez ' + j + (done ? ' ✓' : '') + '</h3>';
      if (!done) {
        judgesHtml += '<p class="jurado-hint">Calificación pendiente</p>';
      } else {
        judgesHtml += '<p class="jurado-result-subtotal">Subtotal: <strong>' + judge.subtotal + ' pts</strong></p>';
        judgesHtml += '<ul class="jurado-result-criteria">';
        criteria.forEach(function (c) {
          var val = judge.scores && judge.scores[c.key] != null ? judge.scores[c.key] : '—';
          judgesHtml += '<li><span>' + escapeHtml(c.label) + '</span><strong>' + val + '</strong></li>';
        });
        judgesHtml += '</ul>';
      }
      judgesHtml += '</article>';
    }
    $('resultJudgesGrid').innerHTML = judgesHtml;

    var notasBox = $('resultNotasBox');
    var notas = cal && cal.notas ? cal.notas.trim() : '';
    if (notasBox) {
      if (notas) {
        notasBox.hidden = false;
        $('resultNotasText').textContent = notas;
      } else {
        notasBox.hidden = true;
      }
    }

    $('loginSection').hidden = true;
    $('resultsSection').hidden = false;
    $('loadingMsg').hidden = true;
  }

  function showLogin() {
    $('loginSection').hidden = false;
    $('resultsSection').hidden = true;
    $('loadingMsg').hidden = true;
  }

  function showError(msg) {
    var el = $('loginError');
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
  }

  function login(nombre, documento) {
    $('loadingMsg').hidden = false;
    showError('');
    return sheetsPost({
      action: 'jurado_resultados_login',
      nombre: nombre,
      documento: documento,
      evt: tenantSlug || undefined
    }).then(function (data) {
      if (!data || data.ok === false) {
        throw new Error((data && data.error) || 'No se pudo validar el acceso.');
      }
      writeSession({ nombre: nombre, documento: documento });
      renderResults(data);
      return data;
    }).catch(function (err) {
      showLogin();
      showError(err.message || 'Error al ingresar.');
      throw err;
    }).finally(function () {
      $('loadingMsg').hidden = true;
    });
  }

  function refreshResults() {
    var sess = readSession();
    if (!sess || !sess.nombre || !sess.documento) return Promise.resolve();
    return login(sess.nombre, sess.documento).catch(function () { /* silencioso */ });
  }

  function bindEvents() {
    var form = $('resultadosLoginForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var nombre = ($('loginNombre') && $('loginNombre').value) || '';
        var documento = ($('loginDocumento') && $('loginDocumento').value) || '';
        login(nombre.trim(), documento.trim());
      });
    }

    var logout = $('resultLogoutBtn');
    if (logout) {
      logout.addEventListener('click', function () {
        clearSession();
        currentData = null;
        showLogin();
        showError('');
      });
    }

    var refreshBtn = $('resultRefreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        refreshResults();
      });
    }
  }

  function init() {
    initTenantFromUrl();
    bindEvents();
    var sess = readSession();
    if (sess && sess.nombre && sess.documento) {
      login(sess.nombre, sess.documento).finally(function () {
        if (refreshTimer) clearInterval(refreshTimer);
        refreshTimer = setInterval(refreshResults, REFRESH_MS);
      });
    } else {
      showLogin();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
