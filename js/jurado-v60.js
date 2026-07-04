/**
 * Panel jurado sensorial V60 — calificación 1–5, 7 criterios, 3 jueces.
 * Acceso solo por URL con ?pin= (sin enlace público en el sitio).
 * Competidores: Google Sheets (admin_dashboard). Calificaciones: Firestore.
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

  var JURADO_PIN_DEFAULT = 'v60sensorial';
  var FIRESTORE_COLLECTION = 'jurado_v60_calificaciones';

  var WEB_APP_URL_CANONICAL =
    'https://script.google.com/macros/s/AKfycbxYz-qUCyXqrcroEzE9-1DRNarXmA9-lYeF5PCJ2pPmwQOpV3pmpuhbW4dog8p9w5ig/exec';

  var pin = '';
  var competidores = [];
  var calificacionesMap = {};
  var guardando = false;
  var db = null;

  function webAppUrl() {
    var cfg = window.SHEETS_CONFIG || {};
    var url = (cfg.WEB_APP_URL || '').trim();
    if (!url || url.indexOf('TU_ID_DE_DEPLOYMENT') !== -1) {
      url = WEB_APP_URL_CANONICAL;
    }
    return url;
  }

  function getPinFromUrl() {
    try {
      return new URLSearchParams(window.location.search).get('pin') || '';
    } catch (e) {
      return '';
    }
  }

  function assertPin(value) {
    return String(value || '').trim() === JURADO_PIN_DEFAULT;
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
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        qs += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
      }
    });
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return fetch(url + sep + qs, { method: 'GET', mode: 'cors', cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || data.ok === false) {
          throw new Error((data && data.error) || 'Error del servidor Sheets.');
        }
        return data;
      });
  }

  function sheetsPost(body) {
    var url = webAppUrl();
    return fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (res) { return res.json(); })
      .catch(function () { return null; });
  }

  function initFirestore() {
    var cfg = window.FIREBASE_FIDELIZACION_CONFIG || {};
    if (!cfg.apiKey || !cfg.projectId) {
      throw new Error('Firebase no configurado (js/firebase-fidelizacion-config.js).');
    }
    if (!firebase.apps.length) {
      firebase.initializeApp(cfg);
    }
    db = firebase.firestore();
    return db;
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

  function buildCalificacionFromJudges(competidorId, nombre, judges, notas) {
    var subtotales = [];
    var judgesOut = {};
    for (var j = 1; j <= 3; j++) {
      var judge = readJudgeScores(j);
      if (!judge.complete) {
        throw new Error('Completa todas las calificaciones (1–5) de los 3 jueces.');
      }
      var sub = 0;
      CRITERIA.forEach(function (crit) { sub += judge.scores[crit.key]; });
      subtotales.push(sub);
      judgesOut['j' + j] = { scores: judge.scores, subtotal: sub };
    }
    var sumaTotal = subtotales[0] + subtotales[1] + subtotales[2];
    return {
      competidorId: competidorId,
      nombre: nombre,
      judges: judgesOut,
      sumaTotal: sumaTotal,
      promedio: Math.round((sumaTotal / 3) * 100) / 100,
      notas: String(notas || '').trim(),
      actualizado: new Date().toISOString()
    };
  }

  function loadCalificacionesFirestore() {
    return db.collection(FIRESTORE_COLLECTION).get().then(function (snap) {
      var list = [];
      calificacionesMap = {};
      snap.forEach(function (doc) {
        var row = doc.data() || {};
        row.competidorId = row.competidorId || doc.id;
        calificacionesMap[row.competidorId] = row;
        list.push(row);
      });
      list.sort(function (a, b) { return (b.promedio || 0) - (a.promedio || 0); });
      return list;
    });
  }

  function saveCalificacionFirestore(calificacion) {
    return db.collection(FIRESTORE_COLLECTION)
      .doc(calificacion.competidorId)
      .set(calificacion, { merge: true })
      .then(function () { return calificacion; });
  }

  function syncSheetsOptional(calificacion) {
    var judgesPayload = {};
    for (var j = 1; j <= 3; j++) {
      judgesPayload['j' + j] = calificacion.judges['j' + j].scores;
    }
    return sheetsPost({
      action: 'jurado_guardar',
      pin: pin,
      competidorId: calificacion.competidorId,
      judges: judgesPayload,
      notas: calificacion.notas
    });
  }

  function $(id) {
    return document.getElementById(id);
  }

  function showPinError(msg) {
    $('loadingMsg').hidden = true;
    $('pinSection').hidden = false;
    $('mainSection').hidden = true;
    var el = $('pinError');
    el.textContent = msg;
    el.hidden = false;
  }

  function buildScoreSelect(critKey, judgeNum, value) {
    var select = document.createElement('select');
    select.dataset.crit = critKey;
    select.dataset.judge = String(judgeNum);
    select.setAttribute('aria-label', CRITERIA.find(function (c) { return c.key === critKey; }).label + ' — Juez ' + judgeNum);

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

    select.addEventListener('change', onScoreChange);
    return select;
  }

  function renderScoresTable(existing) {
    var tbody = $('scoresBody');
    tbody.innerHTML = '';

    CRITERIA.forEach(function (crit) {
      var tr = document.createElement('tr');
      var th = document.createElement('th');
      th.innerHTML = crit.label + '<br><span style="font-weight:400;font-size:0.72rem;color:rgba(255,255,255,0.55)">' + crit.desc + '</span>';
      tr.appendChild(th);

      for (var j = 1; j <= 3; j++) {
        var td = document.createElement('td');
        var val = '';
        if (existing && existing.judges && existing.judges['j' + j] && existing.judges['j' + j].scores) {
          val = existing.judges['j' + j].scores[crit.key];
        }
        td.appendChild(buildScoreSelect(crit.key, j, val));
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });

    $('notasInput').value = existing && existing.notas ? existing.notas : '';
    recalcTotals();
  }

  function readJudgeScores(judgeNum) {
    var scores = {};
    var complete = true;
    CRITERIA.forEach(function (crit) {
      var sel = document.querySelector('select[data-crit="' + crit.key + '"][data-judge="' + judgeNum + '"]');
      var v = sel ? parseInt(sel.value, 10) : NaN;
      if (isNaN(v) || v < 1 || v > 5) {
        complete = false;
      } else {
        scores[crit.key] = v;
      }
    });
    return { scores: scores, complete: complete };
  }

  function recalcTotals() {
    var subtotales = [];
    var allComplete = true;

    for (var j = 1; j <= 3; j++) {
      var judge = readJudgeScores(j);
      if (judge.complete) {
        var sub = 0;
        CRITERIA.forEach(function (crit) { sub += judge.scores[crit.key]; });
        $('subtotalJ' + j).textContent = String(sub);
        subtotales.push(sub);
      } else {
        $('subtotalJ' + j).textContent = '—';
        allComplete = false;
      }
    }

    if (allComplete && subtotales.length === 3) {
      var suma = subtotales[0] + subtotales[1] + subtotales[2];
      $('sumaTotal').textContent = String(suma);
      $('promedioFinal').textContent = String(Math.round((suma / 3) * 100) / 100);
    } else {
      $('sumaTotal').textContent = '—';
      $('promedioFinal').textContent = '—';
    }

    $('saveBtn').disabled = !$('competidorSelect').value || !allComplete || guardando;
  }

  function onScoreChange() {
    $('saveSuccess').hidden = true;
    $('saveError').hidden = true;
    recalcTotals();
  }

  function renderRanking(list) {
    var tbody = $('rankingBody');
    tbody.innerHTML = '';

    if (!list || !list.length) {
      var empty = document.createElement('tr');
      empty.innerHTML = '<td colspan="7" class="jurado-empty">Sin calificaciones aún</td>';
      tbody.appendChild(empty);
      return;
    }

    list.forEach(function (row, idx) {
      var tr = document.createElement('tr');
      var j1 = row.judges && row.judges.j1 ? row.judges.j1.subtotal : '—';
      var j2 = row.judges && row.judges.j2 ? row.judges.j2.subtotal : '—';
      var j3 = row.judges && row.judges.j3 ? row.judges.j3.subtotal : '—';
      tr.innerHTML =
        '<td>' + (idx + 1) + '</td>' +
        '<td style="text-align:left">' + escapeHtml(row.nombre || '') + '</td>' +
        '<td>' + (row.sumaTotal != null ? row.sumaTotal : '—') + '</td>' +
        '<td>' + (row.promedio != null ? row.promedio : '—') + '</td>' +
        '<td>' + j1 + '</td>' +
        '<td>' + j2 + '</td>' +
        '<td>' + j3 + '</td>';
      tbody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function onCompetidorChange() {
    $('saveSuccess').hidden = true;
    $('saveError').hidden = true;
    var id = $('competidorSelect').value;
    var meta = $('competidorMeta');
    var found = competidores.find(function (c) { return c.id === id; });

    if (!found) {
      meta.hidden = true;
      renderScoresTable(null);
      return;
    }

    var parts = [];
    if (found.ciudad) parts.push(found.ciudad);
    if (found.representa) parts.push(found.representa);
    meta.textContent = parts.join(' · ');
    meta.hidden = !parts.length;
    renderScoresTable(calificacionesMap[id] || null);
  }

  function onSave() {
    if (guardando) return;
    var competidorId = $('competidorSelect').value;
    var found = competidores.find(function (c) { return c.id === competidorId; });
    if (!found) return;

    $('saveError').hidden = true;
    $('saveSuccess').hidden = true;
    guardando = true;
    $('saveBtn').disabled = true;
    $('saveBtn').textContent = 'Guardando…';

    var calificacion;
    try {
      calificacion = buildCalificacionFromJudges(
        competidorId,
        found.nombre,
        null,
        $('notasInput').value.trim()
      );
    } catch (err) {
      $('saveError').textContent = err.message;
      $('saveError').hidden = false;
      guardando = false;
      $('saveBtn').textContent = 'Guardar calificación';
      recalcTotals();
      return;
    }

    saveCalificacionFirestore(calificacion)
      .then(function (saved) {
        calificacionesMap[saved.competidorId] = saved;
        syncSheetsOptional(saved);
        $('saveSuccess').textContent =
          '✓ Guardado: ' + saved.nombre + ' — Suma ' + saved.sumaTotal + ' · Promedio ' + saved.promedio;
        $('saveSuccess').hidden = false;
        return loadCalificacionesFirestore().then(renderRanking);
      })
      .catch(function (err) {
        $('saveError').textContent = err.message || 'No se pudo guardar en Firestore.';
        $('saveError').hidden = false;
      })
      .finally(function () {
        guardando = false;
        $('saveBtn').textContent = 'Guardar calificación';
        recalcTotals();
      });
  }

  function init() {
    pin = getPinFromUrl().trim();
    if (!pin) {
      showPinError('Falta el PIN en la URL. Usa el enlace completo que te compartió el organizador (ej. ?pin=…).');
      return;
    }
    if (!assertPin(pin)) {
      showPinError('PIN incorrecto. Verifica el enlace que te compartieron.');
      return;
    }

    try {
      initFirestore();
    } catch (err) {
      showPinError(err.message || 'Firebase no disponible.');
      return;
    }

    Promise.all([loadCompetidores(), loadCalificacionesFirestore()])
      .then(function (results) {
        competidores = results[0];
        var ranking = results[1];

        var select = $('competidorSelect');
        competidores.forEach(function (c) {
          var opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.nombre;
          select.appendChild(opt);
        });

        renderScoresTable(null);
        renderRanking(ranking);

        $('loadingMsg').hidden = true;
        $('mainSection').hidden = false;
        select.addEventListener('change', onCompetidorChange);
        $('saveBtn').addEventListener('click', onSave);
      })
      .catch(function (err) {
        showPinError(err.message || 'No se pudo cargar el panel de jurado.');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
