/**
 * Jurado V60 — jueces 1/2/3 en móvil + panel organizador.
 * URLs:
 *   Organizador: ?pin=v60organizador
 *   Juez N:      ?pin=v60sensorial&juez=1|2|3
 */
(function () {
  'use strict';

  var CRITERIA = [
    { key: 'aroma', label: 'Aroma', desc: 'Intensidad y calidad en seco y húmedo' },
    { key: 'dulzor', label: 'Dulzor', desc: 'Percepción de dulzor natural' },
    { key: 'acidez', label: 'Acidez', desc: 'Calidad, intensidad y tipo' },
    { key: 'sabor', label: 'Sabor', desc: 'Amplitud y complejidad del perfil' },
    { key: 'balance', label: 'Balance', desc: 'Integración armónica de atributos' },
    { key: 'cuerpo', label: 'Cuerpo', desc: 'Textura y sensación en boca' },
    { key: 'limpieza_taza', label: 'Limpieza de taza', desc: 'Ausencia de defectos u off-flavors' }
  ];

  var PIN_JUEZ = 'v60sensorial';
  var PIN_ORGANIZADOR = 'v60organizador';
  var CONFIG_KEY = 'jurado_v60_calificaciones';
  var SESSION_KEY = 'lsc_jurado_v60_session';
  var REFRESH_MS = 3000;

  var WEB_APP_URL_CANONICAL =
    'https://script.google.com/macros/s/AKfycbxYz-qUCyXqrcroEzE9-1DRNarXmA9-lYeF5PCJ2pPmwQOpV3pmpuhbW4dog8p9w5ig/exec';

  var pin = '';
  var mode = ''; // 'judge' | 'organizer'
  var judgeNum = 0;
  var competidores = [];
  var calificacionesMap = {};
  var guardando = false;
  var refreshTimer = null;
  var organizerUiBound = false;
  var selectedRoundNum = 0;

  function webAppUrl() {
    var cfg = window.SHEETS_CONFIG || {};
    var url = (cfg.WEB_APP_URL || '').trim();
    if (!url || url.indexOf('TU_ID_DE_DEPLOYMENT') !== -1) url = WEB_APP_URL_CANONICAL;
    return url;
  }

  function $(id) { return document.getElementById(id); }

  function getParams() {
    try { return new URLSearchParams(window.location.search); } catch (e) { return new URLSearchParams(); }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function isHabilitado(val) {
    var v = String(val || '').trim().toLowerCase();
    if (!v) return true;
    return v === 'sí' || v === 'si' || v === 'yes' || v === 'true' || v === '1';
  }

  function sheetsGet(action, params) {
    var url = webAppUrl();
    var qs = 'action=' + encodeURIComponent(action);
    Object.keys(params || {}).forEach(function (key) {
      if (params[key] != null && params[key] !== '') {
        qs += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
      }
    });
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return fetch(url + sep + qs, { method: 'GET', mode: 'cors', cache: 'no-store', redirect: 'follow' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || data.ok === false) throw new Error((data && data.error) || 'Error del servidor.');
        return data;
      });
  }

  function sheetsPost(body) {
    return fetch(webAppUrl(), {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    }).then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || data.ok === false) throw new Error((data && data.error) || 'Error al guardar.');
        return data;
      });
  }

  function loadCompetidores() {
    return sheetsGet('admin_dashboard', {}).then(function (data) {
      return (data.allCompetencia || [])
        .filter(function (row) { return isHabilitado(row.Habilitado); })
        .map(function (row) {
          return {
            id: String(row.ID || '').trim(),
            nombre: String(row.Nombre || '').trim(),
            ciudad: String(row.Ciudad || '').trim(),
            representa: String(row.Representa || '').trim()
          };
        })
        .filter(function (c) { return c.id && c.nombre; })
        .sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
    });
  }

  function loadCalificacionesStore() {
    return sheetsGet('pasaporte_config', { key: CONFIG_KEY }).then(function (res) {
      var data = res.data || {};
      var scores = data.scores && typeof data.scores === 'object' ? data.scores : {};
      var list = Object.keys(scores).map(function (id) {
        return normalizeCalificacion(scores[id], id);
      }).filter(Boolean);
      list.sort(function (a, b) { return (b.promedio || 0) - (a.promedio || 0); });
      calificacionesMap = {};
      list.forEach(function (row) {
        if (row && row.competidorId) calificacionesMap[row.competidorId] = row;
      });
      return list;
    });
  }

  function saveCalificacionStore(calificacion, judgeKey) {
    var jKey = judgeKey || ('j' + judgeNum);
    return sheetsGet('pasaporte_config', { key: CONFIG_KEY }).then(function (res) {
      var data = res.data || {};
      if (!data.scores || typeof data.scores !== 'object') data.scores = {};

      var existing = normalizeCalificacion(data.scores[calificacion.competidorId], calificacion.competidorId) || {
        competidorId: calificacion.competidorId,
        nombre: calificacion.nombre,
        judges: {},
        notasPorJuez: {}
      };
      existing.nombre = calificacion.nombre || existing.nombre;
      existing.judges = existing.judges || {};
      existing.notasPorJuez = existing.notasPorJuez || {};

      if (calificacion.judges && calificacion.judges[jKey]) {
        existing.judges[jKey] = calificacion.judges[jKey];
      }
      if (calificacion.notasPorJuez) {
        if (calificacion.notasPorJuez[jKey]) existing.notasPorJuez[jKey] = calificacion.notasPorJuez[jKey];
        else delete existing.notasPorJuez[jKey];
      }

      var t = computeTotals(existing.judges);
      existing.sumaTotal = t.sumaTotal;
      existing.promedio = t.promedio;
      existing.actualizado = new Date().toISOString();
      data.scores[calificacion.competidorId] = existing;
      data.actualizado = new Date().toISOString();
      return sheetsPost({
        action: 'pasaporte_config_save',
        key: CONFIG_KEY,
        data: data
      }).then(function () { return existing; });
    });
  }

  function judgeSubtotal(scores) {
    if (!scores) return null;
    var sub = 0;
    var complete = true;
    CRITERIA.forEach(function (crit) {
      var v = parseInt(scores[crit.key], 10);
      if (isNaN(v) || v < 1 || v > 5) complete = false;
      else sub += v;
    });
    return complete ? sub : null;
  }

  function computeTotals(judges) {
    var subs = [];
    for (var j = 1; j <= 3; j++) {
      var g = judges && judges['j' + j];
      if (g && g.subtotal != null) subs.push(g.subtotal);
    }
    if (subs.length === 3) {
      var suma = subs[0] + subs[1] + subs[2];
      return { sumaTotal: suma, promedio: Math.round((suma / 3) * 100) / 100 };
    }
    return { sumaTotal: null, promedio: null };
  }

  function normalizeCalificacion(raw, competidorIdFallback) {
    if (!raw) return null;
    var cal = Object.assign({}, raw);
    if (!cal.competidorId && competidorIdFallback) cal.competidorId = competidorIdFallback;
    if (!cal.judges) cal.judges = {};
    for (var j = 1; j <= 3; j++) {
      var key = 'j' + j;
      if (cal.judges[key] && cal.judges[key].scores && cal.judges[key].subtotal == null) {
        cal.judges[key].subtotal = judgeSubtotal(cal.judges[key].scores);
      }
    }
    var t = computeTotals(cal.judges);
    cal.sumaTotal = t.sumaTotal;
    cal.promedio = t.promedio;
    return cal;
  }

  function judgeScoreValue(row, j) {
    var g = row.judges && row.judges['j' + j];
    if (g && g.subtotal != null) return g.subtotal;
    return null;
  }

  function judgeDone(judges, num) {
    var g = judges && judges['j' + num];
    return !!(g && g.subtotal != null);
  }

  function judgesStatusHtml(judges) {
    var parts = [];
    for (var j = 1; j <= 3; j++) {
      var done = judgeDone(judges, j);
      parts.push('<span class="jurado-judge-pill' + (done ? ' jurado-judge-pill--done' : '') + '">J' + j + (done ? ' ✓' : '') + '</span>');
    }
    return parts.join(' ');
  }

  function readSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeSession(sess) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(sess)); } catch (e) { /* ignore */ }
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function hideAll() {
    $('pinSection').hidden = true;
    $('roleSection').hidden = true;
    $('judgeSection').hidden = true;
    $('organizerSection').hidden = true;
    $('loadingMsg').hidden = true;
  }

  function showPinError(msg) {
    hideAll();
    $('pinSection').hidden = false;
    $('pinError').textContent = msg;
    $('pinError').hidden = false;
  }

  function fillCompetidorSelect(selectEl, includeEmpty) {
    selectEl.innerHTML = includeEmpty !== false
      ? '<option value="">— Selecciona competidor —</option>'
      : '';
    competidores.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nombre;
      selectEl.appendChild(opt);
    });
  }

  function competidorMeta(found) {
    var parts = [];
    if (found.ciudad) parts.push(found.ciudad);
    if (found.representa) parts.push(found.representa);
    return parts.join(' · ');
  }

  /* ——— Selector de rol ——— */
  function showRolePicker() {
    hideAll();
    $('headerSubtitle').textContent = 'Elige tu perfil para continuar';
    var grid = $('roleGrid');
    grid.innerHTML = '';

    if (pin === PIN_ORGANIZADOR) {
      var orgBtn = document.createElement('button');
      orgBtn.type = 'button';
      orgBtn.className = 'jurado-role-btn jurado-role-btn--org';
      orgBtn.innerHTML = '<strong>Organizador</strong><span>Panel general y clasificación</span>';
      orgBtn.addEventListener('click', function () { enterOrganizer(); });
      grid.appendChild(orgBtn);
    }

    if (pin === PIN_JUEZ) {
      [1, 2, 3].forEach(function (n) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'jurado-role-btn';
        btn.innerHTML = '<strong>Juez ' + n + '</strong><span>Calificar desde tu celular</span>';
        btn.addEventListener('click', function () { enterJudge(n); });
        grid.appendChild(btn);
      });
    }

    $('roleSection').hidden = false;
  }

  /* ——— Vista juez ——— */
  function buildJudgeScoreRow(crit, value) {
    var row = document.createElement('div');
    row.className = 'jurado-judge-row';
    row.innerHTML =
      '<div class="jurado-judge-row-label">' +
        '<strong>' + escapeHtml(crit.label) + '</strong>' +
        '<span>' + escapeHtml(crit.desc) + '</span>' +
      '</div>';

    var select = document.createElement('select');
    select.dataset.crit = crit.key;
    select.setAttribute('aria-label', crit.label);
    var empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '—';
    select.appendChild(empty);
    for (var n = 1; n <= 5; n++) {
      var opt = document.createElement('option');
      opt.value = String(n);
      opt.textContent = String(n);
      if (String(value) === String(n)) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', onJudgeScoreChange);
    row.appendChild(select);
    return row;
  }

  function renderJudgeForm(existing) {
    var list = $('judgeScoresList');
    list.innerHTML = '';
    var judgeKey = 'j' + judgeNum;
    var existingScores = existing && existing.judges && existing.judges[judgeKey]
      ? existing.judges[judgeKey].scores : null;

    CRITERIA.forEach(function (crit) {
      var val = existingScores ? existingScores[crit.key] : '';
      list.appendChild(buildJudgeScoreRow(crit, val));
    });

    var notas = '';
    if (existing && existing.notasPorJuez && existing.notasPorJuez[judgeKey]) {
      notas = existing.notasPorJuez[judgeKey];
    }
    $('judgeNotasInput').value = notas;
    recalcJudgeSubtotal();
  }

  function readJudgeFormScores() {
    var scores = {};
    var complete = true;
    CRITERIA.forEach(function (crit) {
      var sel = document.querySelector('#judgeScoresList select[data-crit="' + crit.key + '"]');
      var v = sel ? parseInt(sel.value, 10) : NaN;
      if (isNaN(v) || v < 1 || v > 5) complete = false;
      else scores[crit.key] = v;
    });
    return { scores: scores, complete: complete };
  }

  function recalcJudgeSubtotal() {
    var form = readJudgeFormScores();
    if (form.complete) {
      var sub = 0;
      CRITERIA.forEach(function (c) { sub += form.scores[c.key]; });
      $('judgeSubtotal').textContent = String(sub);
    } else {
      $('judgeSubtotal').textContent = '—';
    }
    $('judgeSaveBtn').disabled = !$('judgeCompetidorSelect').value || !form.complete || guardando;
  }

  function onJudgeScoreChange() {
    $('judgeSaveSuccess').hidden = true;
    $('judgeSaveError').hidden = true;
    recalcJudgeSubtotal();
  }

  function onJudgeCompetidorChange() {
    $('judgeSaveSuccess').hidden = true;
    $('judgeSaveError').hidden = true;
    var id = $('judgeCompetidorSelect').value;
    var found = competidores.find(function (c) { return c.id === id; });
    var meta = $('judgeCompetidorMeta');
    if (!found) {
      meta.hidden = true;
      renderJudgeForm(null);
      return;
    }
    meta.textContent = competidorMeta(found);
    meta.hidden = !meta.textContent;
    loadCalificacionesStore().then(function () {
      renderJudgeForm(calificacionesMap[id] || null);
    }).catch(function () {
      renderJudgeForm(calificacionesMap[id] || null);
    });
  }

  function mergeJudgeSave(competidorId, nombre, judgeData, notas) {
    var existing = calificacionesMap[competidorId] || {
      competidorId: competidorId,
      nombre: nombre,
      judges: {},
      notasPorJuez: {}
    };
    existing.nombre = nombre;
    existing.judges = existing.judges || {};
    existing.notasPorJuez = existing.notasPorJuez || {};
    var key = 'j' + judgeNum;
    existing.judges[key] = {
      scores: judgeData.scores,
      subtotal: judgeSubtotal(judgeData.scores),
      actualizado: new Date().toISOString()
    };
    if (notas) existing.notasPorJuez[key] = notas;
    else delete existing.notasPorJuez[key];
    var t = computeTotals(existing.judges);
    existing.sumaTotal = t.sumaTotal;
    existing.promedio = t.promedio;
    existing.actualizado = new Date().toISOString();
    return existing;
  }

  function onJudgeSave() {
    if (guardando) return;
    var competidorId = $('judgeCompetidorSelect').value;
    var found = competidores.find(function (c) { return c.id === competidorId; });
    if (!found) return;

    var form = readJudgeFormScores();
    if (!form.complete) {
      $('judgeSaveError').textContent = 'Completa los 7 criterios (1–5).';
      $('judgeSaveError').hidden = false;
      return;
    }

    guardando = true;
    $('judgeSaveBtn').disabled = true;
    $('judgeSaveBtn').textContent = 'Guardando…';
    $('judgeSaveError').hidden = true;
    $('judgeSaveSuccess').hidden = true;

    var cal = mergeJudgeSave(
      competidorId,
      found.nombre,
      form,
      $('judgeNotasInput').value.trim()
    );

    saveCalificacionStore(cal, 'j' + judgeNum)
      .then(function (saved) {
        calificacionesMap[saved.competidorId] = saved;
        $('judgeSaveSuccess').textContent =
          '✓ Guardado — ' + found.nombre + ' · Tu subtotal: ' + saved.judges['j' + judgeNum].subtotal;
        $('judgeSaveSuccess').hidden = false;
      })
      .catch(function (err) {
        $('judgeSaveError').textContent = err.message || 'No se pudo guardar.';
        $('judgeSaveError').hidden = false;
      })
      .finally(function () {
        guardando = false;
        $('judgeSaveBtn').textContent = 'Guardar mi calificación';
        recalcJudgeSubtotal();
      });
  }

  function enterJudge(num) {
    judgeNum = num;
    mode = 'judge';
    writeSession({ mode: 'judge', judgeNum: num, pin: pin });
    showJudgeUI();
  }

  function showJudgeUI() {
    hideAll();
    $('headerTitle').textContent = 'Juez ' + judgeNum;
    $('headerSubtitle').textContent = 'Califica 7 criterios · escala 1–5';
    $('judgeBadge').textContent = 'Juez ' + judgeNum;

    fillCompetidorSelect($('judgeCompetidorSelect'));
    renderJudgeForm(null);

    $('judgeSection').hidden = false;
    $('judgeCompetidorSelect').addEventListener('change', onJudgeCompetidorChange);
    $('judgeSaveBtn').addEventListener('click', onJudgeSave);
    $('judgeLogoutBtn').addEventListener('click', function () {
      clearSession();
      if (pin === PIN_JUEZ) showRolePicker();
      else showPinError('Sesión cerrada.');
    });
  }

  function calificacionesList() {
    return Object.keys(calificacionesMap).map(function (id) { return calificacionesMap[id]; });
  }

  function showOrganizerError(msg) {
    var el = $('organizerLoadError');
    if (!el) return;
    el.textContent = msg || 'Error al cargar el panel.';
    el.hidden = false;
  }

  function clearOrganizerError() {
    var el = $('organizerLoadError');
    if (el) el.hidden = true;
  }

  function renderOrganizerViews(list) {
    renderOrganizerBracket();
    renderOrganizerScoresTable();
    renderOrganizerDetail($('organizerCompetidorSelect').value);
  }

  function getRowById(id) {
    var cal = calificacionesMap[id] || null;
    var found = competidores.find(function (c) { return c.id === id; });
    return {
      competidorId: id,
      nombre: found ? found.nombre : (cal ? cal.nombre : id),
      judges: cal && cal.judges ? cal.judges : {},
      sumaTotal: cal ? cal.sumaTotal : null
    };
  }

  function puntajeTotal(row) {
    if (!row) return null;
    if (row.sumaTotal != null && judgeDone(row.judges, 1) && judgeDone(row.judges, 2) && judgeDone(row.judges, 3)) {
      return row.sumaTotal;
    }
    return null;
  }

  function puntajeEstado(row) {
    var n = countJudgesDone(row);
    if (n === 3) return 'listo';
    if (n > 0) return 'parcial';
    return 'pendiente';
  }

  function getParticipantsForRound(roundNum) {
    if (roundNum === 1) return competidores.map(function (c) { return c.id; });
    return getRoundWinners(roundNum - 1);
  }

  function resolveMatch(aId, bId) {
    var rowA = getRowById(aId);
    var rowB = bId ? getRowById(bId) : null;
    var scoreA = puntajeTotal(rowA);
    var scoreB = rowB ? puntajeTotal(rowB) : null;
    if (!bId) {
      return { winnerId: aId, scoreA: scoreA, scoreB: null, status: 'bye' };
    }
    if (scoreA == null || scoreB == null) {
      return { winnerId: null, scoreA: scoreA, scoreB: scoreB, status: 'pending' };
    }
    if (scoreA > scoreB) return { winnerId: aId, scoreA: scoreA, scoreB: scoreB, status: 'a' };
    if (scoreB > scoreA) return { winnerId: bId, scoreA: scoreA, scoreB: scoreB, status: 'b' };
    return { winnerId: null, scoreA: scoreA, scoreB: scoreB, status: 'tie' };
  }

  function getRoundWinners(roundNum) {
    var participants = getParticipantsForRound(roundNum);
    var winners = [];
    for (var i = 0; i < participants.length; i += 2) {
      var aId = participants[i];
      var bId = participants[i + 1] || null;
      var match = resolveMatch(aId, bId);
      if (match.winnerId) winners.push(match.winnerId);
    }
    return winners;
  }

  function buildRoundsStructure() {
    var rounds = [];
    var roundNum = 1;
    while (true) {
      var participants = getParticipantsForRound(roundNum);
      if (participants.length <= 1) break;
      var matches = [];
      for (var i = 0; i < participants.length; i += 2) {
        matches.push({
          duelNum: Math.floor(i / 2) + 1,
          aId: participants[i],
          bId: participants[i + 1] || null
        });
      }
      rounds.push({ roundNum: roundNum, matches: matches });
      roundNum++;
      if (roundNum > 20) break;
    }
    return rounds;
  }

  function getActiveRoundNum(rounds) {
    for (var i = 0; i < rounds.length; i++) {
      var pending = rounds[i].matches.some(function (m) {
        if (!m.bId) return false;
        return resolveMatch(m.aId, m.bId).status === 'pending';
      });
      if (pending) return rounds[i].roundNum;
    }
    return rounds.length ? rounds[rounds.length - 1].roundNum : 1;
  }

  function roundLabel(roundNum, totalRounds) {
    if (roundNum === totalRounds && totalRounds > 1) return 'Final';
    if (roundNum === totalRounds - 1 && totalRounds > 2) return 'Semifinal';
    return 'Ronda ' + roundNum;
  }

  function renderMatchCompetitor(row, isWinner, isLoser) {
    var s = formatJudgeScores(row);
    var total = puntajeTotal(row);
    var cls = 'jurado-duel-player';
    if (isWinner) cls += ' jurado-duel-player--winner';
    if (isLoser) cls += ' jurado-duel-player--loser';
    return '<div class="' + cls + '">' +
      '<div class="jurado-duel-name">' + escapeHtml(row.nombre) + (isWinner ? ' <span class="jurado-duel-badge">Pasa</span>' : '') + '</div>' +
      '<div class="jurado-duel-scores">' +
      '<span>J1 ' + s.j1 + '</span><span>J2 ' + s.j2 + '</span><span>J3 ' + s.j3 + '</span>' +
      '</div>' +
      '<div class="jurado-duel-total">' + (total != null ? total + ' pts' : '—') + '</div>' +
      '</div>';
  }

  function renderOrganizerBracket() {
    var nav = $('organizerRoundsNav');
    var box = $('organizerBracket');
    var champ = $('organizerChampionStrip');
    if (!nav || !box) return;

    var rounds = buildRoundsStructure();
    if (!rounds.length) {
      nav.innerHTML = '';
      box.innerHTML = '<p class="jurado-hint">Se necesitan al menos 2 competidores para armar rondas.</p>';
      if (champ) champ.hidden = true;
      return;
    }

    var activeRound = selectedRoundNum || getActiveRoundNum(rounds);
    var totalRounds = rounds.length;

    nav.innerHTML = rounds.map(function (r) {
      var label = roundLabel(r.roundNum, totalRounds);
      var isActive = r.roundNum === activeRound;
      var pending = r.matches.some(function (m) {
        return m.bId && resolveMatch(m.aId, m.bId).status === 'pending';
      });
      return '<button type="button" class="jurado-round-tab' + (isActive ? ' jurado-round-tab--active' : '') +
        (pending ? ' jurado-round-tab--live' : '') + '" data-round="' + r.roundNum + '">' + label + '</button>';
    }).join('');

    nav.querySelectorAll('.jurado-round-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedRoundNum = parseInt(btn.dataset.round, 10);
        renderOrganizerBracket();
      });
    });

    var current = rounds.find(function (r) { return r.roundNum === activeRound; });
    if (!current) current = rounds[0];

    box.innerHTML = current.matches.map(function (m) {
      var rowA = getRowById(m.aId);
      var rowB = m.bId ? getRowById(m.bId) : null;
      var result = resolveMatch(m.aId, m.bId);
      var statusHtml = '';
      if (result.status === 'bye') {
        statusHtml = '<p class="jurado-duel-status jurado-duel-status--bye">Pasa directo (sin rival en este duelo)</p>';
      } else if (result.status === 'pending') {
        statusHtml = '<p class="jurado-duel-status jurado-duel-status--pending">Esperando puntaje total de ambos (3 jueces)</p>';
      } else if (result.status === 'tie') {
        statusHtml = '<p class="jurado-duel-status jurado-duel-status--tie">Empate · ' + result.scoreA + ' = ' + result.scoreB + ' · define el organizador</p>';
      } else {
        statusHtml = '<p class="jurado-duel-status jurado-duel-status--done">Gana mayor puntaje total</p>';
      }

      var html = '<article class="jurado-duel' + (result.status === 'pending' ? ' jurado-duel--pending' : '') + '">';
      html += '<header class="jurado-duel-head">Duelo ' + m.duelNum + ' · ' + roundLabel(current.roundNum, totalRounds) + '</header>';
      html += '<div class="jurado-duel-body">';
      html += renderMatchCompetitor(rowA, result.winnerId === m.aId, result.winnerId && result.winnerId !== m.aId);
      if (rowB) {
        html += '<div class="jurado-duel-vs">VS</div>';
        html += renderMatchCompetitor(rowB, result.winnerId === m.bId, result.winnerId && result.winnerId !== m.bId);
      }
      html += '</div>' + statusHtml + '</article>';
      return html;
    }).join('');

    if (champ) {
      var finalists = getRoundWinners(totalRounds);
      if (finalists.length === 1 && rounds[totalRounds - 1].matches.every(function (m) {
        return !m.bId || resolveMatch(m.aId, m.bId).winnerId;
      })) {
        var winner = getRowById(finalists[0]);
        var wt = puntajeTotal(winner);
        champ.innerHTML = '🏆 <strong>Clasificado: ' + escapeHtml(winner.nombre) + '</strong>' +
          (wt != null ? ' · ' + wt + ' pts' : '');
        champ.hidden = false;
      } else {
        champ.hidden = true;
        champ.innerHTML = '';
      }
    }
  }

  function countJudgesDone(row) {
    var n = 0;
    for (var j = 1; j <= 3; j++) {
      if (judgeDone(row.judges, j)) n++;
    }
    return n;
  }

  function buildUnifiedOrganizerRows() {
    return competidores.map(function (c) { return getRowById(c.id); });
  }

  function renderOrganizerScoresTable() {
    var tbody = $('organizerRankingBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    var rows = buildUnifiedOrganizerRows().slice().sort(function (a, b) {
      var ta = puntajeTotal(a) != null ? puntajeTotal(a) : -1;
      var tb = puntajeTotal(b) != null ? puntajeTotal(b) : -1;
      if (tb !== ta) return tb - ta;
      return (a.nombre || '').localeCompare(b.nombre || '', 'es');
    });

    rows.forEach(function (row) {
      var total = puntajeTotal(row);
      var estado = puntajeEstado(row);
      var estadoLabel = estado === 'listo' ? 'Listo' : estado === 'parcial' ? 'Parcial' : 'Pendiente';
      var estadoCls = estado === 'listo' ? 'jurado-estado--listo' : estado === 'parcial' ? 'jurado-estado--parcial' : 'jurado-estado--pendiente';
      var tr = document.createElement('tr');
      tr.className = 'jurado-score-row';
      tr.innerHTML =
        '<td class="jurado-td-name">' + escapeHtml(row.nombre) + '</td>' +
        '<td class="jurado-td-score jurado-td-judge">' + notaJuezDisplay(row, 1) + '</td>' +
        '<td class="jurado-td-score jurado-td-judge">' + notaJuezDisplay(row, 2) + '</td>' +
        '<td class="jurado-td-score jurado-td-judge">' + notaJuezDisplay(row, 3) + '</td>' +
        '<td class="jurado-td-total"><strong>' + (total != null ? total : '—') + '</strong></td>' +
        '<td class="' + estadoCls + '">' + estadoLabel + '</td>';
      tr.addEventListener('click', function () {
        var sel = $('organizerCompetidorSelect');
        if (sel) {
          sel.value = row.competidorId;
          renderOrganizerDetail(row.competidorId);
        }
      });
      tbody.appendChild(tr);
    });

    var updated = $('organizerUpdated');
    if (updated) updated.textContent = 'Actualizado: ' + new Date().toLocaleTimeString('es-CO') + ' · cada 3 s';
  }

  function notaJuezDisplay(row, j) {
    var score = judgeScoreValue(row, j);
    if (score != null) return '<span class="jurado-score-done">' + score + '</span>';
    return '<span class="jurado-score-pending">—</span>';
  }

  function formatJudgeScores(row) {
    var j1 = judgeScoreValue(row, 1);
    var j2 = judgeScoreValue(row, 2);
    var j3 = judgeScoreValue(row, 3);
    return {
      j1: j1 != null ? j1 : '—',
      j2: j2 != null ? j2 : '—',
      j3: j3 != null ? j3 : '—'
    };
  }

  function hasAnyJudgeScore(row) {
    return judgeDone(row.judges, 1) || judgeDone(row.judges, 2) || judgeDone(row.judges, 3);
  }

  function judgeSubtotalDisplay(cal, j) {
    var g = cal.judges && cal.judges['j' + j];
    if (g && g.subtotal != null) return g.subtotal;
    return '—';
  }

  function renderJudgeDetailCard(j, judge) {
    var html = '<article class="jurado-judge-card' + (judge && judge.scores ? ' jurado-judge-card--done' : ' jurado-judge-card--pending') + '">';
    html += '<header class="jurado-judge-card-head"><span class="jurado-judge-card-num">Juez ' + j + '</span>';
    if (judge && judge.subtotal != null) {
      html += '<span class="jurado-judge-card-total">' + judge.subtotal + ' <small>/ 35</small></span>';
    } else {
      html += '<span class="jurado-judge-card-total jurado-score-pending">Pendiente</span>';
    }
    html += '</header>';
    if (!judge || !judge.scores) {
      html += '<p class="jurado-hint">Este juez aún no ha calificado.</p></article>';
      return html;
    }
    html += '<ul class="jurado-detail-scores">';
    CRITERIA.forEach(function (c) {
      html += '<li><span>' + escapeHtml(c.label) + '</span><strong>' + (judge.scores[c.key] || '—') + '</strong></li>';
    });
    html += '</ul></article>';
    return html;
  }

  function renderOrganizerDetail(competidorId) {
    var box = $('organizerDetail');
    if (!competidorId) {
      box.innerHTML = '<p class="jurado-hint">Elige un competidor arriba para ver las notas de los 3 jueces y el resultado final.</p>';
      box.hidden = false;
      return;
    }

    var cal = calificacionesMap[competidorId];
    var found = competidores.find(function (c) { return c.id === competidorId; });
    var nombre = found ? found.nombre : competidorId;

    if (!cal) {
      box.innerHTML =
        '<h3 class="jurado-detail-title">' + escapeHtml(nombre) + '</h3>' +
        '<p class="jurado-hint">Sin calificaciones registradas para este competidor.</p>' +
        '<div class="jurado-judges-grid">' +
        renderJudgeDetailCard(1, null) + renderJudgeDetailCard(2, null) + renderJudgeDetailCard(3, null) +
        '</div>';
      box.hidden = false;
      return;
    }

    var j1 = judgeSubtotalDisplay(cal, 1);
    var j2 = judgeSubtotalDisplay(cal, 2);
    var j3 = judgeSubtotalDisplay(cal, 3);

    var html = '<h3 class="jurado-detail-title">' + escapeHtml(cal.nombre || nombre) + '</h3>';
    html += '<div class="jurado-scores-together">';
    html += '<div class="jurado-scores-together-item' + (j1 !== '—' ? ' jurado-scores-together-item--done' : '') + '"><span>Juez 1</span><strong>' + j1 + '</strong></div>';
    html += '<div class="jurado-scores-together-item' + (j2 !== '—' ? ' jurado-scores-together-item--done' : '') + '"><span>Juez 2</span><strong>' + j2 + '</strong></div>';
    html += '<div class="jurado-scores-together-item' + (j3 !== '—' ? ' jurado-scores-together-item--done' : '') + '"><span>Juez 3</span><strong>' + j3 + '</strong></div>';
    html += '</div>';

    html += '<div class="jurado-table-wrap"><table class="jurado-table"><thead><tr><th>Criterio</th><th>J1</th><th>J2</th><th>J3</th></tr></thead><tbody>';
    CRITERIA.forEach(function (crit) {
      html += '<tr><th style="text-align:left">' + escapeHtml(crit.label) + '</th>';
      for (var j = 1; j <= 3; j++) {
        var g = cal.judges && cal.judges['j' + j];
        var val = g && g.scores ? g.scores[crit.key] : '—';
        html += '<td>' + (val !== undefined && val !== '' ? val : '—') + '</td>';
      }
      html += '</tr>';
    });
    html += '</tbody><tfoot><tr class="jurado-subtotal-row"><th>Subtotal</th>';
    for (var s = 1; s <= 3; s++) {
      html += '<td>' + judgeSubtotalDisplay(cal, s) + '</td>';
    }
    html += '</tr></tfoot></table></div>';

    html += '<div class="jurado-judges-grid">';
    [1, 2, 3].forEach(function (j) {
      html += renderJudgeDetailCard(j, cal.judges && cal.judges['j' + j]);
    });
    html += '</div>';

    if (puntajeTotal(cal) != null) {
      var total = puntajeTotal(cal);
      html += '<div class="jurado-detail-final-box">' +
        '<div class="jurado-detail-final-label">Puntaje total</div>' +
        '<div class="jurado-detail-final-prom">' + total + '</div>' +
        '<div class="jurado-detail-final-meta">Suma de los 3 jueces · máx. 105 pts</div>' +
        '<div class="jurado-detail-final-breakdown">J1: ' + j1 + ' + J2: ' + j2 + ' + J3: ' + j3 + ' = ' + total + '</div>' +
        '</div>';
    } else {
      var faltan = [1, 2, 3].filter(function (j) { return !judgeDone(cal.judges, j); });
      html += '<div class="jurado-detail-final-box jurado-detail-final-box--pending">' +
        '<div class="jurado-detail-final-label">Puntaje total</div>' +
        '<p class="jurado-hint">Falta' + (faltan.length > 1 ? 'n' : '') + ' juez' + (faltan.length > 1 ? 'es' : '') + ': ' +
        faltan.map(function (j) { return 'J' + j; }).join(', ') + '</p></div>';
    }

    box.innerHTML = html;
    box.hidden = false;
  }

  function refreshOrganizer() {
    var updated = $('organizerUpdated');
    if (updated) updated.textContent = 'Actualizando…';
    return loadCalificacionesStore().then(function (list) {
      clearOrganizerError();
      renderOrganizerViews(list);
      return list;
    });
  }

  function enterOrganizer() {
    mode = 'organizer';
    writeSession({ mode: 'organizer', pin: pin });
    showOrganizerUI();
  }

  function showOrganizerUI() {
    hideAll();
    $('headerTitle').textContent = 'Panel jurado V60';
    $('headerSubtitle').textContent = 'Duelos por rondas · pasa el mayor puntaje total';

    $('organizerSection').hidden = false;
    clearOrganizerError();

    fillCompetidorSelect($('organizerCompetidorSelect'));

    try {
      renderOrganizerViews(calificacionesList());
    } catch (err) {
      showOrganizerError(err.message || 'Error al mostrar el panel.');
    }

    refreshOrganizer().catch(function (err) {
      showOrganizerError(err.message || 'No se pudieron actualizar las calificaciones.');
    });

    if (!organizerUiBound) {
      organizerUiBound = true;
      $('organizerCompetidorSelect').addEventListener('change', function () {
        renderOrganizerDetail(this.value);
      });
      $('organizerRefreshBtn').addEventListener('click', function () {
        refreshOrganizer().catch(function (err) {
          showOrganizerError(err.message || 'Error al actualizar');
        });
      });
    }

    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(function () {
      refreshOrganizer().catch(function () { /* silencioso */ });
    }, REFRESH_MS);

    document.addEventListener('visibilitychange', onOrganizerVisibility);
  }

  function onOrganizerVisibility() {
    if (mode === 'organizer' && !document.hidden) {
      refreshOrganizer().catch(function () { /* silencioso */ });
    }
  }

  function resolvePin(value) {
    var p = String(value || '').trim().toLowerCase();
    if (p === PIN_ORGANIZADOR) return PIN_ORGANIZADOR;
    if (p === PIN_JUEZ) return PIN_JUEZ;
    return '';
  }

  function init() {
    var params = getParams();
    pin = resolvePin(params.get('pin') || '');

    if (!pin) {
      showPinError('Falta el PIN en la URL. Pide el enlace al organizador.');
      return;
    }

    var sess = readSession();
    if (sess && sess.pin === pin && sess.mode === 'organizer' && pin === PIN_ORGANIZADOR) {
      mode = 'organizer';
    } else if (sess && sess.pin === pin && sess.mode === 'judge' && pin === PIN_JUEZ) {
      mode = 'judge';
      judgeNum = sess.judgeNum;
    }

    var juezParam = parseInt(params.get('juez') || '', 10);
    if (!mode && pin === PIN_JUEZ && juezParam >= 1 && juezParam <= 3) {
      judgeNum = juezParam;
      mode = 'judge';
      writeSession({ mode: 'judge', judgeNum: juezParam, pin: pin });
    }
    if (!mode && pin === PIN_ORGANIZADOR) {
      mode = 'organizer';
      writeSession({ mode: 'organizer', pin: pin });
    }

    Promise.all([loadCompetidores(), loadCalificacionesStore()])
      .then(function (results) {
        competidores = results[0];
        if (!competidores.length) {
          showPinError('No hay competidores habilitados.');
          return;
        }

        $('loadingMsg').hidden = true;

        if (mode === 'organizer') {
          showOrganizerUI();
        } else if (mode === 'judge' && judgeNum) {
          showJudgeUI();
        } else {
          showRolePicker();
        }
      })
      .catch(function (err) {
        showPinError(err.message || 'No se pudo cargar el panel.');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
