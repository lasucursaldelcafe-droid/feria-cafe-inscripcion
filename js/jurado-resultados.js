/**
 * Portal de resultados — competidor ingresa con nombre + documento (cédula).
 * Muestra rondas publicadas con selector compacto (lista/pestañas) y detalle bajo demanda.
 */
(function () {
  'use strict';

  var SESSION_KEY = 'lsc_jurado_resultados_session';
  var REFRESH_MS = 8000;
  var tenantSlug = '';
  var selectedRoundIdx = -1;

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

  function estadoLabel(estado, detalle) {
    if (detalle && detalle.estadoLabel) return detalle.estadoLabel;
    if (estado === 'activo') return 'En competencia';
    if (estado === 'eliminado') return 'Eliminado en esta edición';
    if (estado === 'finalizado') return 'Edición finalizada';
    if (estado === 'podio') return 'Podio';
    if (estado === 'finalista') return 'Finalista';
    if (estado === 'semifinalista') return 'Semifinalista';
    if (estado === 'inscrito') return 'Inscrito';
    return 'Pendiente';
  }

  function estadoClass(estado, detalle) {
    if (detalle && detalle.posicion === 1) return 'jurado-result-estado--gold';
    if (detalle && detalle.posicion === 2) return 'jurado-result-estado--silver';
    if (detalle && detalle.posicion === 3) return 'jurado-result-estado--bronze';
    if (estado === 'activo') return 'jurado-result-estado--activo';
    if (estado === 'eliminado') return 'jurado-result-estado--out';
    if (estado === 'podio' || estado === 'finalista') return 'jurado-result-estado--podio';
    if (estado === 'semifinalista' || estado === 'finalizado') return 'jurado-result-estado--done';
    if (estado === 'inscrito') return 'jurado-result-estado--inscrito';
    return 'jurado-result-estado--pending';
  }

  function isPreliminar1Evento(evento) {
    var s = String(evento || '');
    return /preliminar\s*1/i.test(s) || /1\.ª/i.test(s) || s === 'V60 Championship';
  }

  function resolveTorneoEstado(data) {
    var torneo = Object.assign({}, data.torneo || {});
    var comp = data.competidor || {};
    var detalle = null;

    var p1 = window.Preliminar1Results;
    if (p1 && p1.getCompetitorOutcome && (isPreliminar1Evento(comp.evento) || torneo.estado === 'finalizado')) {
      detalle = p1.getCompetitorOutcome(comp.id, comp.documento, comp.nombre);
      if (detalle) {
        torneo.estado = detalle.estado;
        torneo.edicion = detalle.edicion || torneo.edicion;
        torneo.edicionEstado = detalle.edicionEstado || 'realizada';
        torneo.faseLabel = detalle.estadoLabel || torneo.faseLabel;
        torneo.detalle = detalle;
      }
    }

    if (torneo.estado === 'activo' && torneo.edicionEstado === 'realizada') {
      torneo.estado = 'finalizado';
    }

    var cfg = window.EVENT_CONFIG;
    if (cfg && cfg.evento1 && cfg.evento1.estado === 'realizada' && isPreliminar1Evento(comp.evento)) {
      if (!detalle && p1 && p1.getCompetitorOutcome) {
        detalle = p1.getCompetitorOutcome(comp.id, comp.documento, comp.nombre);
      }
      if (detalle) {
        torneo.estado = detalle.estado;
        torneo.faseLabel = detalle.estadoLabel;
        torneo.detalle = detalle;
      } else if (torneo.estado === 'activo') {
        torneo.estado = 'finalizado';
        torneo.faseLabel = 'Preliminar 1 — finalizada';
      }
    }

    torneo.detalle = torneo.detalle || detalle;
    return torneo;
  }

  function getStandards() {
    return window.JuradoStandards || null;
  }

  function getCriteria(scoring) {
    var std = getStandards();
    if (std && std.mergeCriteria) return std.mergeCriteria(scoring && scoring.criteria);
    if (scoring && scoring.criteria && scoring.criteria.length) return scoring.criteria;
    return [
      { key: 'aroma', label: 'Aroma', desc: 'Intensidad y calidad en seco y húmedo' },
      { key: 'dulzor', label: 'Dulzor', desc: 'Percepción de dulzor natural' },
      { key: 'acidez', label: 'Acidez', desc: 'Calidad, intensidad y tipo' },
      { key: 'sabor', label: 'Sabor', desc: 'Amplitud y complejidad del perfil' },
      { key: 'balance', label: 'Balance', desc: 'Integración armónica de atributos' },
      { key: 'cuerpo', label: 'Cuerpo', desc: 'Textura y sensación en boca' },
      { key: 'limpieza_taza', label: 'Limpieza de taza', desc: 'Ausencia de defectos u off-flavors' }
    ];
  }

  function mergeRondas(data) {
    var apiRondas = Array.isArray(data.rondas) ? data.rondas.slice() : [];
    if (!apiRondas.length && data.calificacion) apiRondas.push(data.calificacion);

    var p1 = window.Preliminar1Results;
    if (p1 && p1.getRoundsForCompetidor && data.competidor) {
      var comp = data.competidor;
      var p1Rounds = p1.getRoundsForCompetidor(comp.id, comp.documento, comp.nombre) || [];
      var keys = {};
      apiRondas.forEach(function (r) {
        if (r && r.roundKey) keys[r.roundKey] = true;
      });
      p1Rounds.forEach(function (r) {
        if (!keys[r.roundKey]) apiRondas.push(r);
      });
    }

    var hasEntradaDetail = apiRondas.some(function (r) {
      return /^preliminar1\|entrada/i.test(String(r.roundKey || ''));
    });
    if (hasEntradaDetail) {
      apiRondas = apiRondas.filter(function (r) {
        return String(r.roundKey || '') !== 'preliminar-1|archivo';
      });
    }

    apiRondas.sort(function (a, b) {
      var ea = a.meta && a.meta.entrada != null ? a.meta.entrada : 99;
      var eb = b.meta && b.meta.entrada != null ? b.meta.entrada : 99;
      if (ea !== eb) return ea - eb;
      return String(a.publicadoAt || a.faseLabel || '').localeCompare(String(b.publicadoAt || b.faseLabel || ''));
    });
    return apiRondas;
  }

  function judgeDone(judges, num) {
    var g = judges && judges['j' + num];
    return !!(g && g.subtotal != null);
  }

  function roundShortLabel(r, idx) {
    var entrada = r.meta && r.meta.entrada;
    if (entrada === 1) return 'Grupos';
    if (entrada === 2) return 'Semifinal';
    if (entrada === 3) return 'Final';
    var label = String(r.faseLabel || ('Ronda ' + (idx + 1))).trim();
    return label.replace(/^Preliminar\s*1\s*[—-]\s*/i, '') || label;
  }

  function renderRoundPicker(rondas) {
    var picker = $('resultRoundsPicker');
    if (!picker) return;
    if (!rondas.length || rondas.length <= 1) {
      picker.innerHTML = '';
      picker.hidden = true;
      return;
    }
    if (selectedRoundIdx < 0 || selectedRoundIdx >= rondas.length) {
      selectedRoundIdx = rondas.length - 1;
    }
    picker.hidden = false;
    picker.innerHTML = rondas.map(function (r, idx) {
      var short = roundShortLabel(r, idx);
      var pts = r.sumaTotal != null ? r.sumaTotal + ' pts' : '—';
      var active = idx === selectedRoundIdx ? ' jurado-result-round-pick--active' : '';
      return '<button type="button" class="jurado-result-round-pick' + active + '" role="tab"' +
        ' aria-selected="' + (idx === selectedRoundIdx ? 'true' : 'false') + '"' +
        ' data-round-idx="' + idx + '">' +
        '<span class="jurado-result-round-pick-label">' + escapeHtml(short) + '</span>' +
        '<span class="jurado-result-round-pick-pts">' + escapeHtml(pts) + '</span>' +
        '</button>';
    }).join('');

    picker.querySelectorAll('[data-round-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedRoundIdx = parseInt(btn.getAttribute('data-round-idx'), 10) || 0;
        if (currentData) renderResults(currentData);
      });
    });
  }

  function renderCriteriaTable(round, criteria, scoring) {
    var std = getStandards();
    var scaleMin = (scoring && scoring.scaleMin) || 1;
    var scaleMax = (scoring && scoring.scaleMax) || 5;
    var judges = round.judges || {};
    var jmax = (scoring && scoring.jueces) || 3;

    var html = '<div class="jurado-result-criteria-table-wrap"><table class="jurado-result-criteria-table">' +
      '<thead><tr><th>Parámetro</th><th>Estándar</th>';
    for (var h = 1; h <= jmax; h++) html += '<th>J' + h + '</th>';
    html += '<th>Prom.</th><th>Observación</th></tr></thead><tbody>';

    criteria.forEach(function (c) {
      html += '<tr><td><strong>' + escapeHtml(c.label) + '</strong></td>';
      html += '<td class="jurado-result-crit-desc">' + escapeHtml(c.desc || '') + '</td>';
      for (var j = 1; j <= jmax; j++) {
        var judge = judges['j' + j];
        var val = judge && judge.scores && judge.scores[c.key] != null ? judge.scores[c.key] : '—';
        html += '<td class="jurado-result-crit-num">' + val + '</td>';
      }
      var avg = std && std.averageCriterionScores
        ? std.averageCriterionScores(judges, c.key, jmax)
        : null;
      var avgTxt = avg != null ? avg : '—';
      var obs = std && std.criterionObservation && avg != null
        ? std.criterionObservation(avg, c, scaleMin, scaleMax)
        : { band: { level: 'sin_dato', label: '—' }, text: 'Sin datos suficientes.' };
      html += '<td class="jurado-result-crit-num"><strong>' + avgTxt + '</strong></td>';
      html += '<td class="jurado-result-crit-obs jurado-result-crit-obs--' + obs.band.level + '">' +
        '<span class="jurado-result-crit-band">' + escapeHtml(obs.band.label) + '</span> ' +
        escapeHtml(obs.text) + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderRoundDetail(round, criteria, scoring) {
    var wrap = $('resultRoundDetailWrap');
    if (!wrap) return;
    if (!round) {
      wrap.innerHTML = '<p class="jurado-hint">Aún no hay calificaciones publicadas.</p>';
      return;
    }
    var std = getStandards();
    var summaryHtml = '';
    if (std && std.roundSummaryObservation) {
      summaryHtml = '<div class="jurado-card jurado-result-round-summary">' +
        '<h3>Resumen según estándar V60</h3><p>' +
        escapeHtml(std.roundSummaryObservation(round, criteria, scoring.scaleMin, scoring.scaleMax)) +
        '</p></div>';
    }
    var notas = round.notas ? String(round.notas).trim() : '';
    var notasHtml = notas
      ? '<div class="jurado-card"><div class="jurado-card-head"><h3>Notas del jurado</h3></div>' +
        '<p class="jurado-result-notas">' + escapeHtml(notas) + '</p></div>'
      : '';

    wrap.innerHTML =
      summaryHtml +
      '<div class="jurado-card">' +
      '<div class="jurado-card-head"><h2>Calificación por parámetro</h2>' +
      '<p class="jurado-hint">Desglose según estándares sensoriales V60 (escala 1–5).</p></div>' +
      renderCriteriaTable(round, criteria, scoring) +
      '</div>' +
      '<div class="jurado-card">' +
      '<div class="jurado-card-head"><h2>Calificación por juez</h2>' +
      '<p class="jurado-hint">Subtotales y observaciones de cada juez en esta ronda.</p></div>' +
      '<div class="jurado-result-judges-grid">' + renderJudgesCards(round, criteria, scoring) + '</div>' +
      '</div>' +
      notasHtml;
  }

  function renderJudgesCards(round, criteria, scoring) {
    var jmax = (scoring && scoring.jueces) || 3;
    var judges = round.judges || {};
    var notasPorJuez = round.notasPorJuez || {};
    var html = '';

    for (var j = 1; j <= jmax; j++) {
      var judge = judges['j' + j];
      var done = judgeDone(judges, j);
      var notaJuez = String(notasPorJuez['j' + j] || '').trim();
      html += '<article class="jurado-result-judge-card' + (done ? ' jurado-result-judge-card--done' : ' jurado-result-judge-card--pending') + '">';
      html += '<h3><span>Juez ' + j + '</span>';
      html += done
        ? '<span class="jurado-result-judge-badge">Listo</span>'
        : '<span class="jurado-result-judge-badge jurado-result-judge-badge--pending">Pendiente</span>';
      html += '</h3>';
      if (!done) {
        html += '<p class="jurado-hint">Sin calificación en esta ronda.</p>';
      } else {
        html += '<p class="jurado-result-subtotal">Subtotal: <strong>' + judge.subtotal + ' pts</strong></p>';
        html += '<ul class="jurado-result-criteria">';
        criteria.forEach(function (c) {
          var val = judge.scores && judge.scores[c.key] != null ? judge.scores[c.key] : '—';
          html += '<li><span>' + escapeHtml(c.label) + '</span><strong>' + val + '</strong></li>';
        });
        html += '</ul>';
        if (notaJuez) {
          html += '<p class="jurado-result-judge-note"><strong>Observación del juez:</strong> ' + escapeHtml(notaJuez) + '</p>';
        }
      }
      html += '</article>';
    }
    return html;
  }

  function renderResults(data) {
    currentData = data;
    applyBranding(data.evento);

    var comp = data.competidor || {};
    var torneo = resolveTorneoEstado(data);
    var blocked = data.resultadosPublicados === false && !mergeRondas(data).length;
    var scoring = data.scoring || {};
    var criteria = getCriteria(scoring);
    var rondas = mergeRondas(data);
    if (selectedRoundIdx < 0 || selectedRoundIdx >= rondas.length) {
      selectedRoundIdx = rondas.length ? rondas.length - 1 : -1;
    }
    var cal = blocked ? null : (rondas[selectedRoundIdx >= 0 ? selectedRoundIdx : rondas.length - 1] || null);

    $('resultCompetidorNombre').textContent = comp.nombre || '—';
    $('resultCompetidorMeta').textContent = [
      comp.ciudad ? 'Ciudad: ' + comp.ciudad : '',
      comp.representa ? 'Representa: ' + comp.representa : ''
    ].filter(Boolean).join(' · ');

    var blockedBox = $('resultBlockedBox');
    var scoresWrap = $('resultScoresWrap');
    if (blockedBox) blockedBox.hidden = !blocked;
    if (scoresWrap) scoresWrap.hidden = !!blocked;
    if (blocked) {
      var blockedMsg = $('resultBlockedMsg');
      if (blockedMsg) {
        blockedMsg.textContent = data.mensajeBloqueo ||
          'El organizador publicará tus calificaciones al finalizar la ronda.';
      }
      $('loginSection').hidden = true;
      $('resultsSection').hidden = false;
      $('loadingMsg').hidden = true;
      return;
    }

    var estadoEl = $('resultEstadoBadge');
    var detalle = torneo.detalle || null;
    estadoEl.textContent = estadoLabel(torneo.estado, detalle);
    estadoEl.className = 'jurado-result-estado ' + estadoClass(torneo.estado, detalle);
    $('resultFaseLabel').textContent = cal
      ? (cal.faseLabel || torneo.faseLabel || 'Torneo')
      : (torneo.faseLabel || 'Torneo');

    var edicionMeta = $('resultEdicionMeta');
    if (edicionMeta) {
      var edTxt = torneo.edicion ? String(torneo.edicion) : '';
      if (torneo.edicionEstado === 'realizada' && edTxt) edTxt += ' · finalizada';
      else if (torneo.edicionEstado === 'activa' && edTxt) edTxt += ' · en curso';
      edicionMeta.textContent = edTxt;
      edicionMeta.hidden = !edTxt;
    }

    var total = cal && cal.sumaTotal != null ? cal.sumaTotal + ' pts' : '—';
    $('resultTotalPts').textContent = total;
    var promedioEl = $('resultPromedio');
    if (promedioEl) {
      promedioEl.textContent = cal && cal.promedio != null
        ? 'Promedio jueces: ' + cal.promedio
        : (rondas.length > 1 ? 'Elige una ronda arriba para ver el detalle' : 'Aún sin puntaje completo');
    }

    renderRoundPicker(rondas);
    renderRoundDetail(cal, criteria, scoring);

    var roundsCount = $('resultRoundsCount');
    if (roundsCount) {
      roundsCount.textContent = rondas.length > 1
        ? rondas.length + ' rondas — selecciona una para ver parámetros y jueces'
        : '';
      roundsCount.hidden = rondas.length <= 1;
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

  function setLoading(active) {
    var loading = $('loadingMsg');
    var login = $('loginSection');
    if (loading) loading.hidden = !active;
    if (active && login) login.hidden = true;
  }

  function login(nombre, documento) {
    setLoading(true);
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
      if (data.competidor) data.competidor.documento = documento;
      writeSession({ nombre: nombre, documento: documento });
      renderResults(data);
      return data;
    }).catch(function (err) {
      showLogin();
      showError(err.message || 'Error al ingresar.');
      throw err;
    }).finally(function () {
      setLoading(false);
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
        selectedRoundIdx = -1;
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
