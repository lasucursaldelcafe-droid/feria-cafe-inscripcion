#!/usr/bin/env node
/**
 * Prueba filtro de edición admin + cupo P2 (Apps Script producción).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  competenciaEventKey,
  countCompetenciaEditionRows,
  dedupeCompetenciaRowsByIdentity,
  filterCompetenciaByEdition,
  filterValidCompetenciaRows,
  PRELIMINAR_2_EVENTO
} from './competencia-edition-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const WEB =
  'https://script.google.com/macros/s/AKfycbyiLN6ms5dSbm6f1ZmZsR7ktqWLFGxGJd5zAnhZlmX3d0lpKFx1AhLXMXWfnF8txsp0/exec';
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

async function main() {
  let failed = 0;

  const adminHtml = readFileSync(join(ROOT, 'admin.html'), 'utf8');
  const adminJs = readFileSync(join(ROOT, 'js', 'admin-dashboard.js'), 'utf8');
  const editionJs = readFileSync(join(ROOT, 'js', 'competencia-edition.js'), 'utf8');
  const hasHint = adminHtml.includes('adminCompetenciaEditionHint');
  const hasEdition = adminHtml.includes('adminCompetenciaEdition');
  const hasFilter = adminJs.includes('CompetenciaEdition') && adminJs.includes('ensureCompetenciaEditionVisible');
  const hasSharedLib = editionJs.includes('competencia-edition-lib') || editionJs.includes('PRELIMINAR_2_EVENTO');
  console.log(hasHint && hasEdition && hasFilter && hasSharedLib ? '[OK]' : '[FAIL]', 'Código local: selector + lib compartida');
  if (!hasHint || !hasEdition || !hasFilter || !hasSharedLib) failed++;

  // Regresión: slugs y fechas ambiguas
  const keyTests = [
    ['preliminar-2', PRELIMINAR_2_EVENTO],
    ['V60 Championship — Evento 1 · 4 de julio de 2026 · Plaza Marbella', 'V60 Championship — Preliminar 1'],
    ['V60 Championship — Preliminar 2', PRELIMINAR_2_EVENTO],
    ['Mas Café Cali', PRELIMINAR_2_EVENTO]
  ];
  for (const [input, expected] of keyTests) {
    const got = competenciaEventKey(input);
    const ok = got === expected;
    console.log(ok ? '[OK]' : '[FAIL]', `competenciaEventKey("${String(input).slice(0, 40)}…") → ${got}`);
    if (!ok) failed++;
  }

  const liveAdmin = await fetch(SITE + '/admin', { redirect: 'follow' });
  const liveHtml = await liveAdmin.text();
  const liveDeployed = liveHtml.includes('competencia-edition.js');
  console.log(liveDeployed ? '[OK]' : '[WARN]', 'Producción /admin con competencia-edition.js (deploy pendiente si WARN)');

  const cupo = await getJson(WEB + '?action=cupo');
  if (!cupo.ok) {
    console.log('[FAIL]', 'cupo:', cupo.error || cupo);
    failed++;
  } else {
    console.log('[OK]', `cupo P2=${cupo.count}/${cupo.max} (filas hoja=${cupo.totalFilasHoja ?? '?'})`);
    if (typeof cupo.totalFilasHoja === 'number' && cupo.count > cupo.totalFilasHoja) {
      console.log('[FAIL]', 'count mayor que filas totales');
      failed++;
    }
  }

  const dash = await getJson(WEB + '?action=admin_dashboard');
  if (!dash.ok) {
    console.log('[FAIL]', 'admin_dashboard:', dash.error || dash);
    process.exit(2);
  }

  const raw = dash.allCompetencia || [];
  const invalid = raw.filter((r) => !String(r.ID || '').trim() || !String(r.Nombre || '').trim());
  const valid = filterValidCompetenciaRows(raw);
  console.log(invalid.length === 0 ? '[OK]' : '[WARN]', `Filas inválidas en API: ${invalid.length} (válidas: ${valid.length})`);

  const p1 = countCompetenciaEditionRows(valid, 'evento1');
  const p2 = countCompetenciaEditionRows(valid, 'evento2');
  const p2Dedup = dedupeCompetenciaRowsByIdentity(filterCompetenciaByEdition(valid, 'evento2')).length;
  console.log('[OK]', `P1=${p1} P2=${p2} (dedupe P2=${p2Dedup})`);

  const porEdicion = dash.stats && dash.stats.competenciaPorEdicion;
  if (porEdicion) {
    const match =
      Number(porEdicion.preliminar1) === p1 && Number(porEdicion.preliminar2) === p2;
    console.log(match ? '[OK]' : '[WARN]', 'stats.competenciaPorEdicion vs filtro cliente', porEdicion);
    if (cupo.ok && Number(porEdicion.preliminar2) !== cupo.count) {
      console.log('[WARN]', `cupo API (${cupo.count}) ≠ stats P2 (${porEdicion.preliminar2}) — redeploy Code.gs pendiente`);
    }
  }

  const sinEdicion = valid.filter((r) => !competenciaEventKey(r.Evento || r.evento)).length;
  if (sinEdicion > 0) {
    console.log('[WARN]', `${sinEdicion} fila(s) sin edición clara — ejecutar Normalizar en admin`);
  }

  const sample = valid.find((r) => String(r.ID || '').trim());
  if (sample) {
    const toggle = await fetch(WEB, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'admin_toggle_status',
        dataset: 'competencia',
        id: sample.ID,
        enabled: false
      }),
      redirect: 'follow'
    });
    const t1 = await toggle.json();
    const okOff = t1.ok === true;
    console.log(okOff ? '[OK]' : '[FAIL]', 'admin_toggle_status deshabilitar', sample.ID);
    if (!okOff) failed++;

    const restore = await fetch(WEB, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'admin_toggle_status',
        dataset: 'competencia',
        id: sample.ID,
        enabled: true
      }),
      redirect: 'follow'
    });
    const t2 = await restore.json();
    const okOn = t2.ok === true;
    console.log(okOn ? '[OK]' : '[FAIL]', 'admin_toggle_status habilitar', sample.ID);
    if (!okOn) failed++;
  }

  console.log(failed ? `\n${failed} fallo(s)` : '\nTodas las pruebas OK');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('[FAIL]', err.message || err);
  process.exit(2);
});
