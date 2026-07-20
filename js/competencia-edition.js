/**
 * Filtro de edición V60 (Preliminar 1 / Preliminar 2) — admin, jurado, formulario.
 * Mantener alineado con tools/competencia-edition-lib.mjs
 */
(function (global) {
  'use strict';

  var PRELIMINAR_1_EVENTO = 'V60 Championship — Preliminar 1';
  var PRELIMINAR_2_EVENTO = 'V60 Championship — Preliminar 2';

  function competenciaEventKey(val) {
    var raw = String(val || '').trim();
    if (!raw) return '';
    var lower = raw.toLowerCase();

    if (/^preliminar-2$|^evento2$|^evt-?2$|^p2$|^competencia-2$/.test(lower)) {
      return PRELIMINAR_2_EVENTO;
    }
    if (/^preliminar-1$|^evento1$|^evt-?1$|^p1$/.test(lower)) {
      return PRELIMINAR_1_EVENTO;
    }
    if (/preliminar\s*2|evento\s*2|2\.ª|segunda\s*preliminar|8 de agosto|mas\s*caf[eé]/i.test(raw)) {
      return PRELIMINAR_2_EVENTO;
    }
    if (/preliminar\s*1|evento\s*1|1\.ª|primera\s*preliminar|4 de julio|plaza marbella|marbella/i.test(raw)) {
      return PRELIMINAR_1_EVENTO;
    }
    if (lower === 'v60 championship') return PRELIMINAR_1_EVENTO;
    if (raw === PRELIMINAR_1_EVENTO || raw === PRELIMINAR_2_EVENTO) return raw;
    return '';
  }

  function isSameCompetenciaEvento(rowEvento, targetEvento) {
    var rowKey = competenciaEventKey(rowEvento);
    var targetKey = competenciaEventKey(targetEvento || PRELIMINAR_2_EVENTO);
    return !!rowKey && !!targetKey && rowKey === targetKey;
  }

  function filterValidCompetenciaRows(rows) {
    return (rows || []).filter(function (row) {
      return String(row.ID || '').trim() && String(row.Nombre || '').trim();
    });
  }

  function getEditionEventId(editionKey, eventConfig) {
    if (!editionKey || editionKey === 'all') return '';
    if (editionKey === 'evento1') return PRELIMINAR_1_EVENTO;
    if (editionKey === 'evento2') return PRELIMINAR_2_EVENTO;
    var cfg = eventConfig || global.EVENT_CONFIG || {};
    var ev = cfg[editionKey] || {};
    return String(ev.eventoId || ev.nombre || '').trim();
  }

  function filterCompetenciaByEdition(rows, editionKey, eventConfig) {
    if (!editionKey || editionKey === 'all') return (rows || []).slice();
    var target = competenciaEventKey(getEditionEventId(editionKey, eventConfig));
    if (!target) return [];
    return (rows || []).filter(function (row) {
      return competenciaEventKey(row.Evento || row.evento) === target;
    });
  }

  function dedupeCompetenciaRowsByIdentity(rows) {
    var seen = {};
    var out = [];
    (rows || []).forEach(function (row) {
      var doc = String(row.Documento || row.documento || '').replace(/\D/g, '');
      var email = String(row.Correo || row.correo || '').trim().toLowerCase();
      var key = doc || email;
      if (key && seen[key]) return;
      if (key) seen[key] = true;
      out.push(row);
    });
    return out;
  }

  function countCompetenciaEditionRows(rows, editionKey, eventConfig) {
    return dedupeCompetenciaRowsByIdentity(
      filterCompetenciaByEdition(filterValidCompetenciaRows(rows), editionKey, eventConfig)
    ).length;
  }

  function getListaEsperaFormularioId(eventConfig) {
    var cfg = eventConfig || global.EVENT_CONFIG || {};
    var n = Number(
      cfg.circuito && cfg.circuito.preliminarActual
        ? cfg.circuito.preliminarActual
        : cfg.torneoActivo === 'evento1'
          ? 1
          : 2
    );
    return 'competencia-preliminar-' + (n > 0 ? n : 2);
  }

  function getActiveEditionKey(eventConfig) {
    var cfg = eventConfig || global.EVENT_CONFIG || {};
    return cfg.torneoActivo === 'evento1' ? 'evento1' : 'evento2';
  }

  global.CompetenciaEdition = {
    PRELIMINAR_1_EVENTO: PRELIMINAR_1_EVENTO,
    PRELIMINAR_2_EVENTO: PRELIMINAR_2_EVENTO,
    competenciaEventKey: competenciaEventKey,
    isSameCompetenciaEvento: isSameCompetenciaEvento,
    filterValidCompetenciaRows: filterValidCompetenciaRows,
    getEditionEventId: getEditionEventId,
    filterCompetenciaByEdition: filterCompetenciaByEdition,
    dedupeCompetenciaRowsByIdentity: dedupeCompetenciaRowsByIdentity,
    countCompetenciaEditionRows: countCompetenciaEditionRows,
    getListaEsperaFormularioId: getListaEsperaFormularioId,
    getActiveEditionKey: getActiveEditionKey
  };
})(typeof window !== 'undefined' ? window : this);
