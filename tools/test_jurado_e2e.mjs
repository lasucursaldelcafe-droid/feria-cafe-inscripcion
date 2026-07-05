#!/usr/bin/env node
/**
 * Prueba E2E del panel jurado V60 (Apps Script en producción).
 */
const WEB =
  'https://script.google.com/macros/s/AKfycbxYz-qUCyXqrcroEzE9-1DRNarXmA9-lYeF5PCJ2pPmwQOpV3pmpuhbW4dog8p9w5ig/exec';
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

  const pageOrg = await fetch(SITE + '/jurado-v60?pin=v60organizador', { redirect: 'follow' });
  console.log(pageOrg.ok ? '[OK]' : '[FAIL]', 'Página organizador HTTP', pageOrg.status);
  if (!pageOrg.ok) failed++;

  const page = await fetch(SITE + '/jurado-v60?pin=v60sensorial', { redirect: 'follow' });
  console.log(page.ok ? '[OK]' : '[FAIL]', 'Página jurado HTTP', page.status);
  if (!page.ok) failed++;

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

  console.log(failed ? '\nFALLÓ: ' + failed + ' prueba(s)' : '\nTodas las pruebas OK');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('[FAIL]', err.message);
  process.exit(1);
});
