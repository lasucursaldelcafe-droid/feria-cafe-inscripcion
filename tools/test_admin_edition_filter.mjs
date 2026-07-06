#!/usr/bin/env node
/**
 * Prueba filtro de edición admin + filas válidas de competencia (Apps Script producción).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const WEB =
  'https://script.google.com/macros/s/AKfycbxF8N6mhH2pvzTK9_nxPd2aoiYk0fHN0oszbnxe18HEIu0wHiLU7qyZAPfOAvkyZ-JU/exec';
const SITE = 'https://la-sucursal-del-cafe.web.app';

function competenciaEventKey(val) {
  const s = String(val || '').trim();
  if (!s) return '';
  if (/preliminar\s*2/i.test(s) || /evento\s*2/i.test(s) || /2\.ª/i.test(s)) return 'V60 Championship — Preliminar 2';
  if (/preliminar\s*1/i.test(s) || /evento\s*1/i.test(s) || /1\.ª/i.test(s)) return 'V60 Championship — Preliminar 1';
  if (s === 'V60 Championship') return 'V60 Championship — Preliminar 1';
  return s;
}

function filterValidCompetenciaRows(rows) {
  return (rows || []).filter((row) => String(row.ID || '').trim() && String(row.Nombre || '').trim());
}

function filterCompetenciaByEdition(rows, editionKey) {
  const targets = {
    evento1: 'V60 Championship — Preliminar 1',
    evento2: 'V60 Championship — Preliminar 2'
  };
  if (!editionKey || editionKey === 'all') return (rows || []).slice();
  const target = targets[editionKey] || '';
  if (!target) return (rows || []).slice();
  return (rows || []).filter((row) => competenciaEventKey(row.Evento || row.evento) === target);
}

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
  const hasHint = adminHtml.includes('adminCompetenciaEditionHint');
  const hasEdition = adminHtml.includes('adminCompetenciaEdition');
  const hasFilter = adminJs.includes('filterValidCompetenciaRows') && adminJs.includes('ensureCompetenciaEditionVisible');
  console.log(hasHint && hasEdition && hasFilter ? '[OK]' : '[FAIL]', 'Código local: selector edición + hint + filtros');
  if (!hasHint || !hasEdition || !hasFilter) failed++;

  const liveAdmin = await fetch(SITE + '/admin', { redirect: 'follow' });
  const liveHtml = await liveAdmin.text();
  const liveDeployed = liveHtml.includes('adminCompetenciaEditionHint');
  console.log(liveDeployed ? '[OK]' : '[WARN]', 'Producción /admin con hint (deploy pendiente si WARN)');

  const dash = await getJson(WEB + '?action=admin_dashboard');
  if (!dash.ok) {
    console.log('[FAIL]', 'admin_dashboard:', dash.error || dash);
    process.exit(2);
  }

  const raw = dash.allCompetencia || [];
  const invalid = raw.filter((r) => !String(r.ID || '').trim() || !String(r.Nombre || '').trim());
  const valid = filterValidCompetenciaRows(raw);
  console.log(invalid.length === 0 ? '[OK]' : '[WARN]', `Filas inválidas en API: ${invalid.length} (cliente las filtra: ${valid.length} válidas)`);

  const p1 = filterCompetenciaByEdition(valid, 'evento1');
  const p2 = filterCompetenciaByEdition(valid, 'evento2');
  const porEdicion = dash.stats && dash.stats.competenciaPorEdicion;
  console.log('[OK]', `P1=${p1.length} P2=${p2.length} total=${valid.length}`);
  if (porEdicion) {
    const match =
      Number(porEdicion.preliminar1) === p1.length && Number(porEdicion.preliminar2) === p2.length;
    console.log(match ? '[OK]' : '[WARN]', 'stats.competenciaPorEdicion vs filtro cliente', porEdicion);
  }

  if (valid.length && p2.length === 0 && p1.length > 0) {
    console.log('[OK]', 'Fallback esperado: P2 vacío, P1 tiene inscritos (admin auto-cambia a P1)');
  } else if (valid.length && p1.length === 0 && p2.length > 0) {
    console.log('[OK]', 'P2 activo con inscritos');
  } else if (!valid.length) {
    console.log('[WARN]', 'Sin competidores válidos en Sheets');
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
