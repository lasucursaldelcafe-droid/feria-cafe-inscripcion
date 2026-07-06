#!/usr/bin/env node
/**
 * Carga calificaciones de Preliminar 1 y las publica en el portal de resultados competidores.
 * Usa pasaporte_config (jurado_v60_calificaciones + jurado_v60_bracket).
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
  'https://script.google.com/macros/s/AKfycbwLK8QmiIx5Ud9T1Mao4jTOPwh7htB7S62NpSiwHQVrG-4Xs-cAMBKxtYTvTH4LiapC/exec';

const EVT = String(process.env.JURADO_EVT || '').trim();
const CAL_KEY = EVT ? `jurado_v60_calificaciones__${EVT}` : 'jurado_v60_calificaciones';
const BRACKET_KEY = EVT ? `jurado_v60_bracket__${EVT}` : 'jurado_v60_bracket';
const PLATFORM_KEY = EVT ? `jurado_v60_platform__${EVT}` : 'jurado_v60_platform';

function loadKit() {
  const js = readFileSync(join(ROOT, 'js/preliminar-1-results.js'), 'utf8');
  const ctx = { window: {}, globalThis: {} };
  ctx.globalThis = ctx.window;
  vm.runInNewContext(js, ctx);
  const P = ctx.window.Preliminar1Results;
  if (!P || !P.exportKit) throw new Error('No se pudo cargar Preliminar1Results');
  return P.exportKit();
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

function buildPublishedMap(scores, now) {
  const faseLabel = 'Preliminar 1 — archivo oficial';
  const roundKey = 'preliminar-1|archivo';
  const out = {};
  let published = 0;
  Object.keys(scores).forEach(function (id) {
    const row = scores[id];
    if (!row || row.sumaTotal == null) return;
    out[id] = {
      judges: JSON.parse(JSON.stringify(row.judges || {})),
      notas: String(row.notas || '').trim(),
      sumaTotal: row.sumaTotal,
      promedio: row.promedio != null ? row.promedio : null,
      roundKey: roundKey,
      faseLabel: faseLabel,
      publicadoAt: now
    };
    published++;
  });
  return { map: out, published: published, faseLabel: faseLabel };
}

async function main() {
  const kit = loadKit();
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
    source: 'publish_preliminar1_resultados.mjs'
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

  const published = buildPublishedMap(scores, now);
  const existingBracket = await getConfig(BRACKET_KEY);
  const bracketData = Object.assign({}, existingBracket, {
    fase: 'final',
    rondaEnFase: 1,
    activos: ids.slice(),
    eliminados: Array.isArray(existingBracket.eliminados) ? existingBracket.eliminados : [],
    resultadosCompetidor: Object.assign(
      {},
      existingBracket.resultadosCompetidor || {},
      published.map
    ),
    preliminar1Archivo: { at: now, published: published.published, faseLabel: published.faseLabel },
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
  console.log('[OK] Resultados publicados para competidores:', published.published);

  if (kit.platformConfig) {
    const platformSave = await postJson({
      action: 'pasaporte_config_save',
      key: PLATFORM_KEY,
      data: Object.assign({}, await getConfig(PLATFORM_KEY), kit.platformConfig)
    });
    if (platformSave.ok) console.log('[OK] Plataforma/branding actualizado');
  }

  const sample = ids[0];
  const login = await postJson({
    action: 'jurado_resultados_login',
    nombre: scores[sample].nombre || 'test',
    documento: '0000000000',
    evt: EVT || undefined
  });
  if (login.ok && login.resultadosPublicados) {
    console.log('[OK] Portal resultados responde con puntajes publicados (muestra ID', sample + ')');
  } else if (login.ok && !login.resultadosPublicados) {
    console.log('[WARN] Login OK pero sin publicar para muestra — verifica nombre/documento en Sheets');
  }

  const andreina = await postJson({
    action: 'jurado_resultados_login',
    nombre: 'andreina',
    documento: '1026308764',
    evt: EVT || undefined
  });
  if (andreina.ok && andreina.resultadosPublicados && andreina.calificacion) {
    console.log('[OK] Andreina ve resultados — total:', andreina.calificacion.sumaTotal);
  } else {
    console.log('[WARN] Andreina:', andreina.error || andreina.mensajeBloqueo || 'sin publicar');
  }

  console.log('\nListo. Portal: https://la-sucursal-del-cafe.web.app/jurado/resultados');
}

main().catch((err) => {
  console.error('[FAIL]', err.message || err);
  process.exit(99);
});
