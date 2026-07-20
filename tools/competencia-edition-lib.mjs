/** Lógica compartida P1/P2 — mantener alineada con js/competencia-edition.js */

export const PRELIMINAR_1_EVENTO = 'V60 Championship — Preliminar 1';
export const PRELIMINAR_2_EVENTO = 'V60 Championship — Preliminar 2';

export function competenciaEventKey(val) {
  const raw = String(val || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();

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

export function isSameCompetenciaEvento(rowEvento, targetEvento) {
  const rowKey = competenciaEventKey(rowEvento);
  const targetKey = competenciaEventKey(targetEvento || PRELIMINAR_2_EVENTO);
  return !!rowKey && !!targetKey && rowKey === targetKey;
}

export function filterValidCompetenciaRows(rows) {
  return (rows || []).filter(
    (row) => String(row.ID || '').trim() && String(row.Nombre || '').trim()
  );
}

export function getEditionEventId(editionKey, eventConfig) {
  if (!editionKey || editionKey === 'all') return '';
  if (editionKey === 'evento1') return PRELIMINAR_1_EVENTO;
  if (editionKey === 'evento2') return PRELIMINAR_2_EVENTO;
  const cfg = eventConfig || {};
  const ev = cfg[editionKey] || {};
  return String(ev.eventoId || ev.nombre || '').trim();
}

export function filterCompetenciaByEdition(rows, editionKey, eventConfig) {
  if (!editionKey || editionKey === 'all') return (rows || []).slice();
  const target = competenciaEventKey(getEditionEventId(editionKey, eventConfig));
  if (!target) return [];
  return (rows || []).filter(
    (row) => competenciaEventKey(row.Evento || row.evento) === target
  );
}

export function dedupeCompetenciaRowsByIdentity(rows) {
  const seen = {};
  const out = [];
  (rows || []).forEach((row) => {
    const doc = String(row.Documento || row.documento || '').replace(/\D/g, '');
    const email = String(row.Correo || row.correo || '').trim().toLowerCase();
    const key = doc || email;
    if (key && seen[key]) return;
    if (key) seen[key] = true;
    out.push(row);
  });
  return out;
}

export function countCompetenciaEditionRows(rows, editionKey, eventConfig) {
  return dedupeCompetenciaRowsByIdentity(
    filterCompetenciaByEdition(filterValidCompetenciaRows(rows), editionKey, eventConfig)
  ).length;
}

export function getListaEsperaFormularioId(eventConfig) {
  const cfg = eventConfig || {};
  const n = Number(
    cfg.circuito && cfg.circuito.preliminarActual
      ? cfg.circuito.preliminarActual
      : cfg.torneoActivo === 'evento1'
        ? 1
        : 2
  );
  return 'competencia-preliminar-' + (n > 0 ? n : 2);
}
