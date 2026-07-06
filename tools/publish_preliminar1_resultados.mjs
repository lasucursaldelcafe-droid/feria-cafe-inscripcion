#!/usr/bin/env node
/**
 * Carga calificaciones de Preliminar 1 y las publica en el portal de resultados competidores.
 * Publica TODAS las tandas por competidor (grupos, semifinal, final) en rounds[].
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const WEB =
  process.env.SHEETS_WEB_APP_URL ||
  (readFileSync(join(ROOT, 'tools/CANONICAL_SHEETS_URL.txt'), 'utf8').trim()) ||
  'https://script.google.com/macros/s/AKfycby4AwJA4qvGcI5vpiGXFkBaiJHu4SF48vhbH3i6cdWaB0Za4AXIBMkNoLQ9er4xLJPM/exec';

const EVT = String(process.env.JURADO_EVT || '').trim();
const CAL_KEY = EVT ? `jurado_v60_calificaciones__${EVT}` : 'jurado_v60_calificaciones';
const BRACKET_KEY = EVT ? `jurado_v60_bracket__${EVT}` : 'jurado_v60_bracket';
const PLATFORM_KEY = EVT ? `jurado_v60_platform__${EVT}` : 'jurado_v60_platform';

function loadPreliminar1() {
  const js = readFileSync(join(ROOT, 'js/preliminar-1-results.js'), 'utf8');
  const ctx = { window: {}, globalThis: {} };
  ctx.globalThis = ctx.window;
  vm.runInNewContext(js, ctx);
  const P = ctx.window.Preliminar1Results;
  if (!P || !P.exportKit) throw new Error('No se pudo cargar Preliminar1Results');
  return P;
}

async function postJson(body) {
  const res = await fetch(WEB, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow'
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Respuesta no JSON: ' + text.slice(0, 200));
  }
}

async function getConfig(key) {
  const sep = WEB.includes('?') ? '&' : '?';
  const res = await fetch(WEB + sep + 'action=pasaporte_config&key=' + encodeURIComponent(key), {
    redirect: 'follow',
    cache: 'no-store'
  });
  const data = await res.json();
  return data.ok && data.data && typeof data.data === 'object' ? data.data : {};
}

function cloneRound(round, now) {
  return {
    judges: JSON.parse(JSON.stringify(round.judges || {})),
    notasPorJuez: JSON.parse(JSON.stringify(round.notasPorJuez || { j1: '', j2: '', j3: '' })),
    notas: String(round.notas || '').trim(),
    sumaTotal: round.sumaTotal,
    promedio: round.promedio != null ? round.promedio : null,
    roundKey: String(round.roundKey || '').trim(),
    faseLabel: String(round.faseLabel || '').trim(),
    publicadoAt: round.publicadoAt || now,
    meta: round.meta ? JSON.parse(JSON.stringify(round.meta)) : undefined
  };
}

function buildPublishedMap(P, scores, now) {
  const out = {};
  let published = 0;
  let totalRounds = 0;

  Object.keys(scores).forEach(function (id) {
    const row = scores[id];
    if (!row || row.sumaTotal == null) return;

    const doc = row.meta && row.meta.documento ? row.meta.documento : null;
    const nombre = row.nombre || '';
    let rounds = P.getRoundsForCompetidor(id, doc, nombre) || [];

    if (!rounds.length) {
      rounds = [{
        judges: row.judges || {},
        notasPorJuez: row.notasPorJuez || { j1: '', j2: '', j3: '' },
        notas: String(row.notas || '').trim(),
        sumaTotal: row.sumaTotal,
        promedio: row.promedio != null ? row.promedio : null,
        roundKey: 'preliminar-1|archivo',
        faseLabel: 'Preliminar 1 — archivo oficial',
        publicadoAt: now
      }];
    }

    const normalized = rounds
      .filter(function (r) { return r && r.sumaTotal != null; })
      .map(function (r) { return cloneRound(r, now); })
      .sort(function (a, b) {
        const ea = a.meta && a.meta.entrada != null ? a.meta.entrada : 99;
        const eb = b.meta && b.meta.entrada != null ? b.meta.entrada : 99;
        return ea - eb;
      });

    if (!normalized.length) return;

    out[id] = { rounds: normalized };
    published++;
    totalRounds += normalized.length;
  });

  return { map: out, published: published, totalRounds: totalRounds };
}

async function main() {
  const P = loadPreliminar1();
  const kit = P.exportKit();
  const scores = kit.calificaciones && kit.calificaciones.scores ? kit.calificaciones.scores : {};
  const ids = Object.keys(scores);
  if (!ids.length) {
    console.error('[FAIL] Kit sin calificaciones');
    process.exit(1);
  }

  const now = new Date().toISOString();
  console.log('[INFO] Web App:', WEB);
  console.log('[INFO] Competidores en kit:', ids.length);

  const existingCal = await getConfig(CAL_KEY);
  const calData = Object.assign({}, existingCal);
  calData.scores = Object.assign({}, calData.scores || {}, scores);
  calData.actualizado = now;
  calData.preliminar1Import = {
    at: now,
    evento: (kit.event && kit.event.nombre) || 'Preliminar 1',
    count: ids.length,
    source: 'publish_preliminar1_resultados.mjs',
    allRounds: true
  };

  const calSave = await postJson({
    action: 'pasaporte_config_save',
    key: CAL_KEY,
    data: calData
  });
  if (!calSave.ok) {
    console.error('[FAIL] calificaciones:', calSave.error || calSave);
    process.exit(2);
  }
  console.log('[OK] Calificaciones guardadas:', ids.length);

  const published = buildPublishedMap(P, scores, now);
  const existingBracket = await getConfig(BRACKET_KEY);
  const bracketData = Object.assign({}, existingBracket, {
    fase: 'final',
    rondaEnFase: 1,
    activos: [],
    eliminados: Array.isArray(existingBracket.eliminados) ? existingBracket.eliminados : [],
    finalizado: true,
    edicionEstado: 'realizada',
    resultadosCompetidor: Object.assign(
      {},
      existingBracket.resultadosCompetidor || {},
      published.map
    ),
    preliminar1Archivo: {
      at: now,
      published: published.published,
      totalRounds: published.totalRounds,
      allRounds: true
    },
    actualizado: now
  });

  const bracketSave = await postJson({
    action: 'pasaporte_config_save',
    key: BRACKET_KEY,
    data: bracketData
  });
  if (!bracketSave.ok) {
    console.error('[FAIL] bracket:', bracketSave.error || bracketSave);
    process.exit(3);
  }
  console.log('[OK] Resultados publicados:', published.published, 'competidores,', published.totalRounds, 'rondas');

  if (kit.platformConfig) {
    const platformSave = await postJson({
      action: 'pasaporte_config_save',
      key: PLATFORM_KEY,
      data: Object.assign({}, await getConfig(PLATFORM_KEY), kit.platformConfig)
    });
    if (platformSave.ok) console.log('[OK] Plataforma/branding actualizado');
  }

  const jessica = await postJson({
    action: 'jurado_resultados_login',
    nombre: 'Jessica',
    documento: '1018509921',
    evt: EVT || undefined
  });
  if (jessica.ok && jessica.resultadosPublicados && Array.isArray(jessica.rondas)) {
    console.log('[OK] Jessica ve', jessica.rondas.length, 'rondas en API');
  } else {
    console.log('[WARN] Jessica:', jessica.error || jessica.mensajeBloqueo || 'sin publicar');
  }

  const andreina = await postJson({
    action: 'jurado_resultados_login',
    nombre: 'andreina',
    documento: '1026308764',
    evt: EVT || undefined
  });
  if (andreina.ok && andreina.resultadosPublicados && Array.isArray(andreina.rondas)) {
    console.log('[OK] Andreina ve', andreina.rondas.length, 'rondas — última:', andreina.calificacion && andreina.calificacion.sumaTotal);
  } else {
    console.log('[WARN] Andreina:', andreina.error || andreina.mensajeBloqueo || 'sin publicar');
  }

  console.log('\nListo. Portal: https://la-sucursal-del-cafe.web.app/jurado/resultados');
}

main().catch((err) => {
  console.error('[FAIL]', err.message || err);
  process.exit(99);
});
