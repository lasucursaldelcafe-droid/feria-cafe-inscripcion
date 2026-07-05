#!/usr/bin/env node
/**
 * Prueba E2E del panel jurado V60 (Apps Script en producción).
 */
const WEB =
  'https://script.google.com/macros/s/AKfycbzpxE3fFv-mS9hai146Mo-LOWRf3KaRYwyZf_S9wk-iB7X-8Ke09eMx2-KftQQV1yfz/exec';
const CONFIG_KEY = 'jurado_v60_calificaciones';
const SITE = 'https://la-sucursal-del-cafe.web.app';

async function getJson(url) {
  const res = await fetch(url, { redirect: 'follow', cache: 'no-store' });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Respuesta no JSON: ' + text.slice(0, 120));
  }
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
    throw new Error('POST no JSON: ' + text.slice(0, 120));
  }
}

async function main() {
  let failed = 0;

  const pageOrg = await fetch(SITE + '/jurado/organizador?pin=v60organizador', { redirect: 'follow' });
  if (pageOrg.ok) {
    console.log('[OK]', 'Página organizador HTTP', pageOrg.status);
  } else {
    const legacyOrg = await fetch(SITE + '/jurado-v60?pin=v60organizador', { redirect: 'follow' });
    console.log(legacyOrg.ok ? '[OK]' : '[FAIL]', 'Página organizador (legacy) HTTP', legacyOrg.status);
    if (!legacyOrg.ok) failed++;
  }

  const pageRes = await fetch(SITE + '/jurado/resultados', { redirect: 'follow' });
  console.log(pageRes.ok ? '[OK]' : '[WARN]', 'Página resultados HTTP', pageRes.status, pageRes.ok ? '' : '(tras deploy)');

  const page = await fetch(SITE + '/jurado/juez?pin=v60sensorial&juez=1', { redirect: 'follow' });
  if (page.ok) {
    console.log('[OK]', 'Página jurado HTTP', page.status);
  } else {
    const legacyJ = await fetch(SITE + '/jurado-v60?pin=v60sensorial&juez=1', { redirect: 'follow' });
    console.log(legacyJ.ok ? '[OK]' : '[FAIL]', 'Página jurado (legacy) HTTP', legacyJ.status);
    if (!legacyJ.ok) failed++;
  }

  const dash = await getJson(WEB + '?action=admin_dashboard');
  const comps = (dash.allCompetencia || []).filter((r) => {
    const v = String(r.Habilitado || '').toLowerCase();
    return !v || v === 'sí' || v === 'si' || v === 'yes' || v === 'true' || v === '1';
  });
  console.log(comps.length ? '[OK]' : '[FAIL]', 'Competidores habilitados:', comps.length);
  if (!comps.length) failed++;

  const cfg = await getJson(WEB + '?action=pasaporte_config&key=' + CONFIG_KEY);
  console.log(cfg.ok ? '[OK]' : '[FAIL]', 'pasaporte_config jurado');
  if (!cfg.ok) failed++;

  const testId = '_e2e_test_' + Date.now();
  const scores = cfg.data && cfg.data.scores ? { ...cfg.data.scores } : {};
  scores[testId] = {
    competidorId: testId,
    nombre: 'E2E Test',
    judges: {
      j1: { scores: { aroma: 4, dulzor: 4, acidez: 4, sabor: 4, balance: 4, cuerpo: 4, limpieza_taza: 4 }, subtotal: 28 },
      j2: { scores: { aroma: 5, dulzor: 5, acidez: 5, sabor: 5, balance: 5, cuerpo: 5, limpieza_taza: 5 }, subtotal: 35 },
      j3: { scores: { aroma: 3, dulzor: 3, acidez: 3, sabor: 3, balance: 3, cuerpo: 3, limpieza_taza: 3 }, subtotal: 21 }
    },
    sumaTotal: 84,
    promedio: 28,
    notas: 'e2e',
    actualizado: new Date().toISOString()
  };

  const save = await postJson({
    action: 'pasaporte_config_save',
    key: CONFIG_KEY,
    data: { scores, actualizado: new Date().toISOString() }
  });
  console.log(save.ok ? '[OK]' : '[FAIL]', 'Guardar calificación test');
  if (!save.ok) failed++;

  const cfg2 = await getJson(WEB + '?action=pasaporte_config&key=' + CONFIG_KEY);
  const okRead = cfg2.data && cfg2.data.scores && cfg2.data.scores[testId];
  console.log(okRead ? '[OK]' : '[FAIL]', 'Leer calificación test');
  if (!okRead) failed++;

  delete scores[testId];
  await postJson({
    action: 'pasaporte_config_save',
    key: CONFIG_KEY,
    data: { scores, actualizado: new Date().toISOString() }
  });

  // Prueba merge: juez 1 y juez 2 no se pisan
  const mergeId = '_e2e_merge_' + Date.now();
  const cfgBase = await getJson(WEB + '?action=pasaporte_config&key=' + CONFIG_KEY);
  const scoresBase = cfgBase.data?.scores || {};
  scoresBase[mergeId] = {
    competidorId: mergeId,
    nombre: 'E2E Merge',
    judges: {
      j1: { scores: { aroma: 3, dulzor: 3, acidez: 3, sabor: 3, balance: 3, cuerpo: 3, limpieza_taza: 3 }, subtotal: 21 }
    }
  };
  await postJson({ action: 'pasaporte_config_save', key: CONFIG_KEY, data: { scores: scoresBase, actualizado: new Date().toISOString() } });

  const cfgMid = await getJson(WEB + '?action=pasaporte_config&key=' + CONFIG_KEY);
  const scoresMid = cfgMid.data?.scores || {};
  const existing = scoresMid[mergeId] || { competidorId: mergeId, nombre: 'E2E Merge', judges: {} };
  existing.judges = existing.judges || {};
  existing.judges.j2 = { scores: { aroma: 5, dulzor: 5, acidez: 5, sabor: 5, balance: 5, cuerpo: 5, limpieza_taza: 5 }, subtotal: 35 };
  scoresMid[mergeId] = existing;
  await postJson({ action: 'pasaporte_config_save', key: CONFIG_KEY, data: { scores: scoresMid, actualizado: new Date().toISOString() } });

  const cfgMerge = await getJson(WEB + '?action=pasaporte_config&key=' + CONFIG_KEY);
  const merged = cfgMerge.data?.scores?.[mergeId];
  const okMerge = merged?.judges?.j1?.subtotal === 21 && merged?.judges?.j2?.subtotal === 35;
  console.log(okMerge ? '[OK]' : '[FAIL]', 'Merge jueces j1+j2 conservados');
  if (!okMerge) failed++;

  delete scoresMid[mergeId];
  await postJson({ action: 'pasaporte_config_save', key: CONFIG_KEY, data: { scores: scoresMid, actualizado: new Date().toISOString() } });

  console.log(failed ? '\nFALLÓ: ' + failed + ' prueba(s)' : '\nTodas las pruebas OK');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  process.exit(1);
});
