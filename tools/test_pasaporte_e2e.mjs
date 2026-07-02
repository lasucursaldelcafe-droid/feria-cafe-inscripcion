/**
 * Prueba E2E Pasaporte Cafetero: Firestore + páginas en producción.
 * Uso: node tools/test_pasaporte_e2e.mjs
 */
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  getDoc,
  doc,
  query,
  where,
  getDocs,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import { createHash } from 'crypto';

const SITE = 'https://la-sucursal-del-cafe.web.app';
const TEST_TAG = 'e2e-' + Date.now().toString(36);
const TEST_PHONE = '3999' + String(Date.now()).slice(-6);
const TEST_EMAIL = `e2e+${TEST_TAG}@lasucursal.test`;
const PIN_SALT = 'LSC-Pasaporte2026';

const firebaseConfig = {
  apiKey: 'AIzaSyDOvRlb20zY9OOjXYYuwEphMrV1npMXsKg',
  authDomain: 'la-sucursal-del-cafe.firebaseapp.com',
  projectId: 'la-sucursal-del-cafe',
  storageBucket: 'la-sucursal-del-cafe.firebasestorage.app',
  messagingSenderId: '181906685290',
  appId: '1:181906685290:web:53341ba1a00e25f8587913',
};

function hashPin(pin) {
  return createHash('sha256').update(String(pin).trim() + PIN_SALT).digest('hex');
}

async function httpStatus(path) {
  const res = await fetch(SITE + path, { redirect: 'follow' });
  return res.status;
}

async function main() {
  const results = [];
  const fail = (id, detail) => {
    results.push({ id, ok: false, detail });
    console.error(`FAIL ${id}: ${detail}`);
  };
  const pass = (id, detail) => {
    results.push({ id, ok: true, detail });
    console.log(`OK   ${id}: ${detail}`);
  };

  for (const path of [
    '/pasaporte',
    '/escanear-pasaporte',
    '/registro-fidelizacion',
    '/panel-fidelizacion',
    '/inscripcion',
  ]) {
    const code = await httpStatus(path);
    if (code === 200) pass(`route${path}`, `HTTP ${code}`);
    else fail(`route${path}`, `HTTP ${code}`);
  }

  let db;
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    pass('firebase_init', 'SDK inicializado');
  } catch (e) {
    fail('firebase_init', e.message);
    process.exit(1);
  }

  let clienteId;
  try {
    const ref = await addDoc(collection(db, 'fidelizacion_clientes'), {
      nombre: 'Visitante E2E ' + TEST_TAG,
      telefono: TEST_PHONE,
      email: TEST_EMAIL,
      puntos: 0,
      puntosHistoricos: 0,
      nivel: 'Bronce',
      activo: true,
      origen: 'e2e_test',
      fechaRegistro: serverTimestamp(),
      ultimaVisita: serverTimestamp(),
    });
    clienteId = ref.id;
    pass('create_cliente', clienteId);
  } catch (e) {
    fail('create_cliente', e.message);
    printSummary(results);
    process.exit(1);
  }

  try {
    const snap = await getDoc(doc(db, 'fidelizacion_clientes', clienteId));
    if (snap.exists()) pass('read_cliente', snap.data().nombre || 'ok');
    else fail('read_cliente', 'documento no existe');
  } catch (e) {
    fail('read_cliente', e.message);
  }

  const pasaporteCode = await httpStatus(`/pasaporte?id=${encodeURIComponent(clienteId)}`);
  if (pasaporteCode === 200) pass('pasaporte_page', `HTTP ${pasaporteCode} con id`);
  else fail('pasaporte_page', `HTTP ${pasaporteCode}`);

  const testUsuario = 'e2e-stand-' + TEST_TAG.slice(-8);
  const testPin = '4242';
  let operadorId;
  try {
    const dup = await getDocs(
      query(collection(db, 'fidelizacion_operadores'), where('usuario', '==', testUsuario))
    );
    if (!dup.empty) {
      operadorId = dup.docs[0].id;
      pass('create_operador', `ya existe ${operadorId}`);
    } else {
      const opRef = await addDoc(collection(db, 'fidelizacion_operadores'), {
        standNombre: 'Stand E2E QA',
        usuario: testUsuario,
        pinHash: hashPin(testPin),
        puntosPorEscaneo: 10,
        activo: true,
        fechaCreacion: serverTimestamp(),
      });
      operadorId = opRef.id;
      pass('create_operador', `${testUsuario} / PIN ${testPin} → ${operadorId}`);
    }
  } catch (e) {
    fail('create_operador', e.message);
  }

  // Apps Script feria (con pasaporteId)
  const sheetsUrl =
    process.env.SHEETS_WEB_APP_URL ||
    'https://script.google.com/macros/s/AKfycbxDZ-gXRSVpgVaMewOclstexVemlWk-tYUOqWTd57cK7a3D4tjT4DMErbYxcg67YTZN/exec';

  try {
    const payload = {
      formType: 'feria',
      data: {
        id: 'F-E2E-' + TEST_TAG.toUpperCase(),
        fecha: new Date().toISOString(),
        nombre: 'Visitante E2E ' + TEST_TAG,
        edad: 30,
        celular: TEST_PHONE,
        correo: TEST_EMAIL,
        intereses: ['Catación'],
        pasaporteId: clienteId,
        aceptacionesLegales: {
          aceptaVoluntaria: true,
          aceptaPertenencias: true,
          aceptaDatos: true,
          aceptaImagen: true,
        },
      },
    };
    const res = await fetch(sheetsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (body.ok && body.pasaporteUrl) {
      pass('feria_submit', `id=${body.id} pasaporteUrl=${body.pasaporteUrl}`);
    } else if (body.duplicate) {
      pass('feria_submit', 'duplicado (esperado si re-ejecutas)');
    } else {
      fail('feria_submit', JSON.stringify(body).slice(0, 200));
    }
  } catch (e) {
    fail('feria_submit', e.message);
  }

  console.log('\n--- Credenciales de prueba (operador escáner) ---');
  console.log('URL escáner:', SITE + '/escanear-pasaporte');
  console.log('Usuario:', testUsuario);
  console.log('PIN:', testPin);
  console.log('Pasaporte:', SITE + '/pasaporte?id=' + clienteId);
  console.log('QR payload: LSCPAS:' + clienteId);

  printSummary(results);
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

function printSummary(results) {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== Resumen E2E: ${results.length - failed.length}/${results.length} OK ===`);
  if (failed.length) {
    console.log('Fallos:', failed.map((f) => f.id).join(', '));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
