#!/usr/bin/env node
/**
 * Vista previa y envío del correo de agradecimiento — Preliminar 1.
 *
 * Uso:
 *   node tools/send_preliminar1_thankyou.mjs --dry-run
 *   node tools/send_preliminar1_thankyou.mjs --send --pin v60organizador
 *   node tools/send_preliminar1_thankyou.mjs --send --pin v60organizador --solo apernia2412@gmail.com
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const WEB =
  process.env.SHEETS_WEB_APP_URL ||
  readFileSync(join(ROOT, 'tools/CANONICAL_SHEETS_URL.txt'), 'utf8').trim();

const SITE = 'https://la-sucursal-del-cafe.web.app';

function loadKitRecipients() {
  const kit = JSON.parse(readFileSync(join(ROOT, 'tools/PRELIMINAR-1-KIT.json'), 'utf8'));
  const seen = new Set();
  return (kit.inscritos || [])
    .filter((i) => i.correo && String(i.correo).includes('@'))
    .filter((i) => {
      const e = String(i.correo).trim().toLowerCase();
      if (seen.has(e)) return false;
      seen.add(e);
      return true;
    })
    .map((i) => ({
      nombre: i.nombre,
      correo: String(i.correo).trim().toLowerCase(),
      documento: i.documento || '',
      id: i.id || ''
    }));
}

function previewText(nombre) {
  return [
    `Hola ${nombre},`,
    '',
    'Gracias por competir en la 1.ª preliminar del V60 Championship.',
    '',
    `Resultados: ${SITE}/jurado/resultados`,
    '(Ingresa con tu cédula)',
    '',
    `Inscripción Preliminar 2: ${SITE}/competencia`,
    `Guía: ${SITE}/como-funciona`,
    `Reglamento: ${SITE}/reglas`,
  'Contacto: lasucursaldelcafe@gmail.com'
  ].join('\n');
}

async function postSend({ dryRun, pin, soloCorreo }) {
  const body = {
    action: 'preliminar1_agradecimiento',
    pin,
    dryRun: !!dryRun
  };
  if (soloCorreo) body.soloCorreo = soloCorreo;

  const res = await fetch(WEB, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    redirect: 'follow'
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Respuesta no JSON (${res.status}): ${text.slice(0, 300)}`);
  }
}

function parseArgs(argv) {
  const args = { dryRun: false, send: false, pin: '', solo: '' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--send') args.send = true;
    else if (a === '--pin' && argv[i + 1]) args.pin = argv[++i];
    else if (a === '--solo' && argv[i + 1]) args.solo = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const local = loadKitRecipients();

  console.log('Destinatarios locales (kit P1):', local.length);
  local.forEach((p) => console.log(`  - ${p.nombre} <${p.correo}>`));
  console.log('');
  console.log('--- Vista previa (texto) ---');
  console.log(previewText(local[0]?.nombre || 'Competidor/a'));
  console.log('');

  if (!args.send && !args.dryRun) {
    console.log('Modo solo vista previa. Opciones:');
    console.log('  node tools/send_preliminar1_thankyou.mjs --dry-run --pin v60organizador');
    console.log('  node tools/send_preliminar1_thankyou.mjs --send --pin v60organizador');
    return;
  }

  if (!args.pin) {
    console.error('Falta --pin v60organizador');
    process.exit(1);
  }

  const data = await postSend({
    dryRun: args.dryRun || !args.send,
    pin: args.pin,
    soloCorreo: args.solo
  });

  console.log(JSON.stringify(data, null, 2));
  if (!data.ok) process.exit(2);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
