/**
 * Portal de resultados — cédula + nombre desde lista de inscritos.
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
  var inscritosList = [];
  var docToNombreMap = {};

  function normalizeDoc(doc) {
    return String(doc || '').replace(/\D/g, '');
  }

  function sheetsGet(params) {
    var url = webAppUrl();
    if (!url) return Promise.reject(new Error('Backend no configurado.'));
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    var qs = Object.keys(params || {}).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');
    return fetch(url + sep + qs, { method: 'GET', redirect: 'follow', cache: 'no-store' })
      .then(function (res) { return res.json(); });
  }

  function mergeInscritosLists(apiList, localList) {
    var byId = {};
    (localList || []).forEach(function (item) {
      if (item && item.id) byId[item.id] = item;
    });
    (apiList || []).forEach(function (item) {
      if (item && item.id) byId[item.id] = Object.assign({}, byId[item.id] || {}, item);
    });
    return Object.keys(byId).map(function (k) { return byId[k]; }).sort(function (a, b) {
      return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
    });
  }

  function buildDocToNombreMap(list) {
    var map = {};
    (list || []).forEach(function (item) {
      var doc = normalizeDoc(item.documento);
      if (doc && item.nombre) map[doc] = item.nombre;
    });
    return map;
  }

  function getLocalInscritos() {
    var p1 = window.Preliminar1Results;
    if (!p1 || !p1.getInscritosList) return [];
    return p1.getInscritosList().map(function (ins) {
      return {
        id: ins.id,
        nombre: ins.nombre,
        documento: ins.documento || '',
        ciudad: ins.ciudad || '',
        representa: ins.representa || ''
      };
    });
  }

  function loadInscritosList() {
    var local = getLocalInscritos();
    docToNombreMap = buildDocToNombreMap(local);
    inscritosList = local.slice();
    populateLoginSelect();

    var params = { action: 'jurado_resultados_inscritos' };
    if (tenantSlug) params.evt = tenantSlug;

    return sheetsGet(params).then(function (data) {
      if (data && data.ok && Array.isArray(data.inscritos)) {
        inscritosList = mergeInscritosLists(data.inscritos, local);
        populateLoginSelect();
      }
    }).catch(function () { /* kit local como respaldo */ });
  }

  function populateLoginSelect() {
    var select = $('loginNombre');
    if (!select) return;
    var current = select.value;
    var html = '<option value="">— Se detecta con tu cédula o elige aquí —</option>';
    inscritosList.forEach(function (item) {
      if (!item || !item.nombre) return;
      var label = item.nombre;
      if (item.representa) label += ' · ' + item.representa;
      else if (item.ciudad) label += ' · ' + item.ciudad;
      html += '<option value="' + String(item.nombre).replace(/"/g, '&quot;') + '">' + escapeHtml(label) + '</option>';
    });
    select.innerHTML = html;
    if (current) select.value = current;
  }

  function autoSelectNombreByDocumento() {
    var docInput = $('loginDocumento');
    var select = $('loginNombre');
    var hint = $('loginNombreHint');
    if (!docInput || !select) return;
    var doc = normalizeDoc(docInput.value);
    if (doc.length < 6) {
      if (hint) hint.hidden = true;
      return;
    }
    var nombre = docToNombreMap[doc] || '';
    if (!nombre && inscritosList.length) {
      var match = inscritosList.find(function (item) {
        return normalizeDoc(item.documento) === doc;
      });
      if (match) nombre = match.nombre;
    }
    if (nombre) {
      select.value = nombre;
      if (hint) {
        hint.textContent = 'Nombre detectado: ' + nombre;
        hint.hidden = false;
      }
    } else if (hint) {
      hint.textContent = 'Elige tu nombre en la lista si la cédula no se reconoce sola.';
      hint.hidden = false;
    }
  }

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

  function mergeRoundFields(apiRound, localRound) {
    if (!localRound) return apiRound;
    if (!apiRound) return localRound;
    var out = Object.assign({}, apiRound);
    var apiJudges = out.judges || {};
    var hasApiJudges = !!(
      (apiJudges.j1 && apiJudges.j1.scores) ||
      (apiJudges.j2 && apiJudges.j2.scores) ||
      (apiJudges.j3 && apiJudges.j3.scores)
    );
    if (!hasApiJudges && localRound.judges) out.judges = localRound.judges;
    out.meta = Object.assign({}, localRound.meta || {}, out.meta || {});
    if (out.sumaTotal == null && localRound.sumaTotal != null) out.sumaTotal = localRound.sumaTotal;
    if (out.promedio == null && localRound.promedio != null) out.promedio = localRound.promedio;
    if (!out.faseLabel && localRound.faseLabel) out.faseLabel = localRound.faseLabel;
    if (!out.notas && localRound.notas) out.notas = localRound.notas;
    if ((!out.notasPorJuez || !Object.keys(out.notasPorJuez).length) && localRound.notasPorJuez) {
      out.notasPorJuez = localRound.notasPorJuez;
    }
    return out;
  }

  function mergeRondas(data) {
    var apiRondas = Array.isArray(data.rondas) ? data.rondas.slice() : [];
    if (!apiRondas.length && data.calificacion) apiRondas.push(data.calificacion);

    var p1 = window.Preliminar1Results;
    if (p1 && p1.getRoundsForCompetidor && data.competidor) {
      var comp = data.competidor;
      var p1Rounds = p1.getRoundsForCompetidor(comp.id, comp.documento, comp.nombre) || [];
      var byKey = {};
      apiRondas.forEach(function (r, idx) {
        if (r && r.roundKey) byKey[r.roundKey] = idx;
      });
      p1Rounds.forEach(function (localRound) {
        if (!localRound || !localRound.roundKey) return;
        if (byKey[localRound.roundKey] != null) {
          apiRondas[byKey[localRound.roundKey]] = mergeRoundFields(
            apiRondas[byKey[localRound.roundKey]],
            localRound
          );
        } else {
          apiRondas.push(localRound);
          byKey[localRound.roundKey] = apiRondas.length - 1;
        }
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

  function driveThumbUrl(url, size) {
    if (!url) return '';
    var s = String(url).trim();
    var m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w' + (size || 200);
    if (/^https?:\/\//i.test(s)) return s;
    return '';
  }

  function resolveCompetidorPhoto(comp) {
    if (!comp) return '';
    if (comp.fotoUrl) return driveThumbUrl(comp.fotoUrl, 160);
    var p1 = window.Preliminar1Results;
    if (p1 && p1.getCompetidorProfile) {
      var profile = p1.getCompetidorProfile(comp.id, comp.documento, comp.nombre);
      if (profile && profile.fotoUrl) return driveThumbUrl(profile.fotoUrl, 160);
    }
    return '';
  }

  function resolveRoundOpponent(round, comp) {
    if (!round) return null;
    if (round.meta && round.meta.oponente) return round.meta.oponente;

    var planilla = round.meta && round.meta.planilla;
    var entrada = round.meta && round.meta.entrada;
    var p1 = window.Preliminar1Results;

    if ((!planilla || !entrada) && p1 && p1.getRoundsForCompetidor && comp) {
      var localRounds = p1.getRoundsForCompetidor(comp.id, comp.documento, comp.nombre) || [];
      var match = localRounds.find(function (lr) {
        return lr.roundKey && lr.roundKey === round.roundKey;
      });
      if (match && match.meta) {
        planilla = match.meta.planilla || planilla;
        entrada = match.meta.entrada != null ? match.meta.entrada : entrada;
        if (match.meta.oponente) return match.meta.oponente;
      }
    }

    if (!p1 || !p1.getRoundOpponent || !planilla || !entrada) return null;
    return p1.getRoundOpponent(planilla, entrada);
  }

  function opponentLineText(oponente, entrada) {
    if (!oponente) {
      if (entrada === 3) return 'Clasificación por mejor tanda (sin duelo 1v1)';
      return '';
    }
    if (oponente.tipo === 'final') {
      return 'Compitió con: ' + oponente.nombre;
    }
    return 'Enfrentamiento vs ' + (oponente.nombre || oponente.planilla || 'rival');
  }

  function hasJudgeObservations(round) {
    if (!round) return false;
    if (String(round.notas || '').trim()) return true;
    var np = round.notasPorJuez || {};
    return !!(String(np.j1 || '').trim() || String(np.j2 || '').trim() || String(np.j3 || '').trim());
  }

  function collectJudgeObservations(round) {
    var items = [];
    var notas = String(round.notas || '').trim();
    if (notas) items.push({ label: 'Jurado', text: notas });
    var np = round.notasPorJuez || {};
    for (var j = 1; j <= 3; j++) {
      var txt = String(np['j' + j] || '').trim();
      if (txt) items.push({ label: 'Juez ' + j, text: txt });
    }
    return items;
  }

  function hasJudgesData(round) {
    var judges = round && round.judges;
    if (!judges) return false;
    return !!(
      (judges.j1 && judges.j1.scores) ||
      (judges.j2 && judges.j2.scores) ||
      (judges.j3 && judges.j3.scores)
    );
  }

  function judgeCount(scoring) {
    return Math.max(1, Math.min(5, parseInt(scoring && scoring.jueces, 10) || 3));
  }

  function resolveRankingLabel(comp) {
    var p1 = window.Preliminar1Results;
    if (!p1 || !p1.getRankingConsolidado || !comp) return '';
    var doc = normalizeDoc(comp.documento);
    var list = p1.getRankingConsolidado() || [];
    for (var i = 0; i < list.length; i++) {
      var row = list[i];
      if (comp.id && row.competidorId === comp.id) {
        return row.posicion + '° lugar en Preliminar 1';
      }
      if (doc && row.inscrito && normalizeDoc(row.inscrito.documento) === doc) {
        return row.posicion + '° lugar en Preliminar 1';
      }
    }
    return '';
  }

  function renderJudgesGrid(round, scoring) {
    var jmax = judgeCount(scoring);
    var html = '<div class="jurado-result-judges-grid">';
    for (var j = 1; j <= jmax; j++) {
      var judge = round.judges && round.judges['j' + j];
      var done = judge && judge.scores;
      html += '<article class="jurado-result-judge-card' +
        (done ? ' jurado-result-judge-card--done' : ' jurado-result-judge-card--pending') + '">';
      html += '<h3>Juez ' + j + '</h3>';
      if (done && judge.subtotal != null) {
        html += '<p class="jurado-result-subtotal">Subtotal: <strong>' + judge.subtotal + '</strong></p>';
      } else {
        html += '<span class="jurado-result-judge-badge jurado-result-judge-badge--pending">Sin detalle</span>';
      }
      html += '</article>';
    }
    html += '</div>';
    return html;
  }

  function renderCriteriaTable(round, criteria, scoring) {
    var std = getStandards();
    if (!hasJudgesData(round)) return '';
    var jmax = judgeCount(scoring);
    var scaleMin = scoring.scaleMin || 1;
    var scaleMax = scoring.scaleMax || 5;

    var html = '<div class="jurado-result-criteria-table-wrap"><table class="jurado-result-criteria-table"><thead><tr>';
    html += '<th>Parámetro</th>';
    for (var jh = 1; jh <= jmax; jh++) html += '<th>J' + jh + '</th>';
    html += '<th>Prom.</th><th>Nivel</th></tr></thead><tbody>';

    criteria.forEach(function (c) {
      var avg = std && std.averageCriterionScores
        ? std.averageCriterionScores(round.judges, c.key, jmax)
        : null;
      var obs = std && std.criterionObservation && avg != null
        ? std.criterionObservation(avg, c, scaleMin, scaleMax)
        : null;
      var bandClass = obs && obs.band ? ' jurado-result-crit-obs--' + obs.band.level : '';
      html += '<tr><td><strong>' + escapeHtml(c.label) + '</strong>';
      if (c.desc) {
        html += '<br><span class="jurado-result-crit-desc">' + escapeHtml(c.desc) + '</span>';
      }
      html += '</td>';
      for (var j = 1; j <= jmax; j++) {
        var g = round.judges && round.judges['j' + j];
        var val = g && g.scores ? g.scores[c.key] : '—';
        html += '<td class="jurado-result-crit-num">' + (val != null && val !== '' ? val : '—') + '</td>';
      }
      html += '<td class="jurado-result-crit-num">' + (avg != null ? avg.toFixed(1) : '—') + '</td>';
      html += '<td class="jurado-result-crit-obs' + bandClass + '">';
      if (obs && obs.band) {
        html += '<span class="jurado-result-crit-band">' + escapeHtml(obs.band.label) + '</span>';
      }
      html += '</td></tr>';
    });

    html += '</tbody><tfoot><tr><th>Subtotal</th>';
    for (var s = 1; s <= jmax; s++) {
      var gj = round.judges && round.judges['j' + s];
      html += '<td><strong>' + (gj && gj.subtotal != null ? gj.subtotal : '—') + '</strong></td>';
    }
    html += '<td colspan="2"><strong>' + (round.sumaTotal != null ? round.sumaTotal + ' pts' : '—') + '</strong></td>';
    html += '</tr></tfoot></table></div>';
    return html;
  }

  function renderRoundSummaryText(round, criteria, scoring) {
    var std = getStandards();
    if (!std || !std.roundSummaryObservation || !hasJudgesData(round)) return '';
    var text = std.roundSummaryObservation(round, criteria, scoring.scaleMin, scoring.scaleMax);
    if (!text) return '';
    return '<div class="jurado-card jurado-result-round-summary"><h3>Resumen del jurado</h3><p>' +
      escapeHtml(text) + '</p></div>';
  }

  function buildRoundDetailInner(round, criteria, scoring, comp) {
    var entrada = round.meta && round.meta.entrada;
    var oponente = resolveRoundOpponent(round, comp);
    var vsText = opponentLineText(oponente, entrada);
    var html = '';

    if (vsText) {
      html += '<div class="jurado-card jurado-result-vs-card"><p class="jurado-result-vs-line">' +
        escapeHtml(vsText) + '</p></div>';
    }

    if (hasJudgesData(round)) {
      html += '<div class="jurado-card"><div class="jurado-card-head"><h2>Puntajes por juez</h2></div>' +
        renderJudgesGrid(round, scoring) + '</div>';
      html += '<div class="jurado-card"><div class="jurado-card-head"><h2>Desglose por parámetro</h2>' +
        '<p class="jurado-hint">Escala ' + (scoring.scaleMin || 1) + '–' + (scoring.scaleMax || 5) +
        ' por criterio SCA / WBrC.</p></div>' +
        renderCriteriaTable(round, criteria, scoring) + '</div>';
      html += renderRoundSummaryText(round, criteria, scoring);
    }

    var bands = renderBandSummary(round, criteria, scoring);
    if (bands) {
      html += '<div class="jurado-card"><div class="jurado-card-head"><h2>Perfil sensorial</h2>' +
        '<p class="jurado-hint">Resumen por estándar V60 según el promedio de jueces.</p></div>' +
        bands + '</div>';
    }

    if (hasJudgeObservations(round)) {
      var obsItems = collectJudgeObservations(round);
      html += '<div class="jurado-card"><div class="jurado-card-head"><h2>Observaciones del jurado</h2></div>' +
        '<ul class="jurado-result-obs-list">';
      obsItems.forEach(function (item) {
        html += '<li><strong>' + escapeHtml(item.label) + ':</strong> ' + escapeHtml(item.text) + '</li>';
      });
      html += '</ul></div>';
    }

    return html;
  }

  function renderBandSummary(round, criteria, scoring) {
    var std = getStandards();
    if (!std || !std.roundBandSummary) return '';
    var groups = std.roundBandSummary(round, criteria, scoring.scaleMin, scoring.scaleMax);
    var defs = [
      { key: 'competitivo', label: 'Competitivo', hint: 'Dentro del estándar esperado en competencia V60.' },
      { key: 'en_desarrollo', label: 'En desarrollo', hint: 'Atributos por reforzar en entrenamiento.' },
      { key: 'por_fortalecer', label: 'Por fortalecer', hint: 'Alejados del estándar sensorial para esta fase.' }
    ];
    var html = '<div class="jurado-result-bands">';
    defs.forEach(function (def) {
      var list = groups[def.key] || [];
      if (!list.length) return;
      html += '<article class="jurado-result-band jurado-result-band--' + def.key + '">' +
        '<h3>' + escapeHtml(def.label) + '</h3>' +
        '<p class="jurado-result-band-params">' + escapeHtml(list.join(' · ')) + '</p>' +
        '<p class="jurado-meta">' + escapeHtml(def.hint) + '</p></article>';
    });
    html += '</div>';
    return html;
  }

  function renderCompetidorPhoto(comp) {
    var img = $('resultCompetidorFoto');
    if (!img) return;
    var url = resolveCompetidorPhoto(comp);
    if (url) {
      img.src = url;
      img.alt = 'Foto de ' + (comp.nombre || 'competidor');
      img.hidden = false;
      img.onerror = function () { img.hidden = true; };
    } else {
      img.removeAttribute('src');
      img.hidden = true;
    }
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
        var block = document.getElementById('round-block-' + selectedRoundIdx);
        if (block && block.scrollIntoView) block.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function renderRoundDetail(rondas, criteria, scoring, comp) {
    var wrap = $('resultRoundDetailWrap');
    if (!wrap) return;
    if (!rondas || !rondas.length) {
      wrap.innerHTML = '<p class="jurado-hint">Aún no hay calificaciones publicadas.</p>';
      return;
    }

    if (rondas.length === 1) {
      wrap.innerHTML = buildRoundDetailInner(rondas[0], criteria, scoring, comp);
      return;
    }

    var html = '<div class="jurado-result-all-rounds">';
    rondas.forEach(function (round, idx) {
      var isActive = idx === selectedRoundIdx;
      html += '<section class="jurado-result-round-block' +
        (isActive ? ' jurado-result-round-block--active' : '') + '" id="round-block-' + idx + '">';
      html += '<header class="jurado-result-round-block-head">';
      html += '<h2>' + escapeHtml(round.faseLabel || roundShortLabel(round, idx)) + '</h2>';
      html += '<span class="jurado-result-round-block-total">' +
        (round.sumaTotal != null ? round.sumaTotal + ' pts' : '—') + '</span>';
      html += '</header>';
      html += '<div class="jurado-result-round-inner">' +
        buildRoundDetailInner(round, criteria, scoring, comp) + '</div>';
      html += '</section>';
    });
    html += '</div>';
    wrap.innerHTML = html;
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
    var metaParts = [
      comp.ciudad ? 'Ciudad: ' + comp.ciudad : '',
      comp.representa ? 'Representa: ' + comp.representa : '',
      resolveRankingLabel(comp)
    ].filter(Boolean);
    $('resultCompetidorMeta').textContent = metaParts.join(' · ');
    renderCompetidorPhoto(comp);

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
    renderRoundDetail(rondas, criteria, scoring, comp);

    var roundsCount = $('resultRoundsCount');
    if (roundsCount) {
      roundsCount.textContent = rondas.length > 1
        ? rondas.length + ' rondas publicadas — desplázate para ver cada fase'
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

  function login(nombre, documento, options) {
    options = options || {};
    setLoading(true);
    showError('');
    var body = {
      action: 'jurado_resultados_login',
      documento: documento,
      evt: tenantSlug || undefined,
      source: options.source || 'login'
    };
    if (nombre) body.nombre = nombre;
    return sheetsPost(body).then(function (data) {
      if (!data || data.ok === false) {
        throw new Error((data && data.error) || 'No se pudo validar el acceso.');
      }
      var resolvedNombre = (data.competidor && data.competidor.nombre) || nombre || '';
      if (data.competidor) data.competidor.documento = documento;
      writeSession({ nombre: resolvedNombre, documento: documento });
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
    return login(sess.nombre, sess.documento, { source: 'refresh' }).catch(function () { /* silencioso */ });
  }

  function bindEvents() {
    var form = $('resultadosLoginForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var nombre = ($('loginNombre') && $('loginNombre').value) || '';
        var documento = ($('loginDocumento') && $('loginDocumento').value) || '';
        login(nombre.trim(), documento.trim(), { source: 'login' });
      });
    }

    var docInput = $('loginDocumento');
    if (docInput) {
      docInput.addEventListener('input', autoSelectNombreByDocumento);
      docInput.addEventListener('change', autoSelectNombreByDocumento);
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
    loadInscritosList();
    var sess = readSession();
    if (sess && sess.nombre && sess.documento) {
      login(sess.nombre, sess.documento, { source: 'session' }).finally(function () {
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
