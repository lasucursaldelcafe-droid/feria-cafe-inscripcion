/**
 * Panel jurado sensorial V60 — calificación 1–5, 7 criterios, 3 jueces.
 * Acceso solo por URL con ?pin= (sin enlace público en el sitio).
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

  var pin = '';
  var competidores = [];
  var calificacionesMap = {};
  var guardando = false;

  var WEB_APP_URL_CANONICAL =
    'https://script.google.com/macros/s/AKfycbxYz-qUCyXqrcroEzE9-1DRNarXmA9-lYeF5PCJ2pPmwQOpV3pmpuhbW4dog8p9w5ig/exec';

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

  function sheetsGet(action, params) {
    var url = webAppUrl();
    if (!url) return Promise.reject(new Error('URL de Apps Script no configurada (js/sheets-config.js).'));
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
          throw new Error((data && data.error) || 'Error del servidor.');
        }
        if (action === 'jurado_competidores' && !Array.isArray(data.competidores)) {
          throw new Error('Apps Script desactualizado: falta jurado V60. El organizador debe redesplegar Code.gs.');
        }
        if (action === 'jurado_calificaciones' && !Array.isArray(data.calificaciones) && data.calificacion === undefined) {
          throw new Error('Apps Script desactualizado: falta jurado V60. El organizador debe redesplegar Code.gs.');
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
          throw new Error((data && data.error) || 'Error al guardar.');
        }
        return data;
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

    if (existing && existing.notas) {
      $('notasInput').value = existing.notas;
    } else {
      $('notasInput').value = '';
    }

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
      var sub = 0;
      if (judge.complete) {
        CRITERIA.forEach(function (crit) {
          sub += judge.scores[crit.key];
        });
        $('subtotalJ' + j).textContent = String(sub);
        subtotales.push(sub);
      } else {
        $('subtotalJ' + j).textContent = '—';
        allComplete = false;
      }
    }

    if (allComplete && subtotales.length === 3) {
      var suma = subtotales[0] + subtotales[1] + subtotales[2];
      var promedio = Math.round((suma / 3) * 100) / 100;
      $('sumaTotal').textContent = String(suma);
      $('promedioFinal').textContent = String(promedio);
    } else {
      $('sumaTotal').textContent = '—';
      $('promedioFinal').textContent = '—';
    }

    var hasCompetidor = !!$('competidorSelect').value;
    $('saveBtn').disabled = !hasCompetidor || !allComplete || guardando;
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

  function loadCalificaciones() {
    return sheetsGet('jurado_calificaciones', { pin: pin }).then(function (data) {
      calificacionesMap = {};
      (data.calificaciones || []).forEach(function (row) {
        if (row.competidorId) calificacionesMap[row.competidorId] = row;
      });
      renderRanking(data.calificaciones || []);
    });
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

  function collectPayload() {
    var judges = {};
    for (var j = 1; j <= 3; j++) {
      judges['j' + j] = readJudgeScores(j).scores;
    }
    return {
      action: 'jurado_guardar',
      pin: pin,
      competidorId: $('competidorSelect').value,
      judges: judges,
      notas: $('notasInput').value.trim()
    };
  }

  function onSave() {
    if (guardando) return;
    $('saveError').hidden = true;
    $('saveSuccess').hidden = true;
    guardando = true;
    $('saveBtn').disabled = true;
    $('saveBtn').textContent = 'Guardando…';

    sheetsPost(collectPayload())
      .then(function (res) {
        calificacionesMap[res.competidorId] = res.calificacion;
        $('saveSuccess').textContent =
          '✓ Guardado: ' + res.nombre + ' — Suma ' + res.sumaTotal + ' · Promedio ' + res.promedio;
        $('saveSuccess').hidden = false;
        return loadCalificaciones();
      })
      .catch(function (err) {
        $('saveError').textContent = err.message || 'No se pudo guardar.';
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

    if (!webAppUrl()) {
      showPinError('Backend no configurado. Contacta al organizador.');
      return;
    }

    Promise.all([
      sheetsGet('jurado_competidores', { pin: pin }),
      sheetsGet('jurado_calificaciones', { pin: pin })
    ])
      .then(function (results) {
        var compData = results[0];
        var calData = results[1];
        competidores = compData.competidores || [];

        calificacionesMap = {};
        (calData.calificaciones || []).forEach(function (row) {
          if (row.competidorId) calificacionesMap[row.competidorId] = row;
        });

        var select = $('competidorSelect');
        competidores.forEach(function (c) {
          var opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.nombre;
          select.appendChild(opt);
        });

        renderScoresTable(null);
        renderRanking(calData.calificaciones || []);

        $('loadingMsg').hidden = true;
        $('mainSection').hidden = false;

        select.addEventListener('change', onCompetidorChange);
        $('saveBtn').addEventListener('click', onSave);
      })
      .catch(function (err) {
        var msg = err.message || 'No se pudo cargar el panel.';
        if (msg.indexOf('PIN') !== -1 || msg.indexOf('incorrecto') !== -1) {
          showPinError('PIN incorrecto. Verifica el enlace que te compartieron.');
        } else if (msg.indexOf('formType inválido') !== -1 || msg.indexOf('desactualizado') !== -1) {
          showPinError('El backend aún no tiene jurado V60. El organizador debe redesplegar Apps Script.');
        } else {
          showPinError(msg);
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
