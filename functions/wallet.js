/**
 * Google Wallet — tarjetas de fidelización (Loyalty).
 * Requiere variables de entorno (ver GOOGLE-WALLET-SETUP.md).
 */

const functions = require('firebase-functions');
const jwt = require('jsonwebtoken');

const HOSTING_ORIGIN = 'https://la-sucursal-del-cafe.web.app';
const LOGO_URL = `${HOSTING_ORIGIN}/assets/logo-la-sucursal-del-cafe.png`;
const CLASS_SUFFIX = 'la_sucursal_fidelizacion';

function walletEnv() {
  const cfg = functions.config().wallet || {};
  return {
    issuerId: (process.env.GOOGLE_WALLET_ISSUER_ID || cfg.issuer_id || '').trim(),
    classSuffix: (process.env.GOOGLE_WALLET_CLASS_SUFFIX || cfg.class_suffix || CLASS_SUFFIX).trim(),
    serviceAccountRaw:
      process.env.GOOGLE_WALLET_SERVICE_ACCOUNT || cfg.service_account || '',
  };
}

function loadServiceAccount(raw) {
  if (!raw) {
    throw new Error('GOOGLE_WALLET_SERVICE_ACCOUNT no configurado en Firebase Functions.');
  }
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('JSON de cuenta de servicio incompleto (client_email / private_key).');
  }
  return parsed;
}

function sanitizeIdPart(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .slice(0, 64);
}

function buildLoyaltyClass(issuerId, classSuffix) {
  const classId = `${issuerId}.${classSuffix}`;
  return {
    id: classId,
    issuerName: 'La Sucursal del Café',
    programName: 'Fidelización',
    programLogo: {
      sourceUri: { uri: LOGO_URL },
    },
    hexBackgroundColor: '#4B352A',
    reviewStatus: 'UNDER_REVIEW',
  };
}

function buildLoyaltyObject(issuerId, classSuffix, clienteId, data) {
  const objectId = `${issuerId}.${sanitizeIdPart(clienteId)}`;
  const classId = `${issuerId}.${classSuffix}`;
  const puntos = Number(data.puntos) || 0;
  const nivel = data.nivel || 'Bronce';

  return {
    id: objectId,
    classId,
    state: 'ACTIVE',
    accountId: clienteId,
    accountName: data.nombre || 'Cliente',
    heroImage: {
      sourceUri: { uri: LOGO_URL },
    },
    logo: {
      sourceUri: { uri: LOGO_URL },
    },
    textModulesData: [
      {
        id: 'nivel',
        header: nivel,
        body: 'Nivel actual',
      },
      {
        id: 'puntos',
        header: String(puntos),
        body: 'Puntos disponibles',
      },
    ],
    loyaltyPoints: {
      label: 'Puntos',
      balance: { int: puntos },
    },
    barcode: {
      type: 'QR_CODE',
      value: clienteId,
      alternateText: clienteId.slice(0, 12),
    },
  };
}

function signSaveToWalletJwt(serviceAccount, issuerId, classSuffix, clienteId, data) {
  const iat = Math.floor(Date.now() / 1000);
  const loyaltyClass = buildLoyaltyClass(issuerId, classSuffix);
  const loyaltyObject = buildLoyaltyObject(issuerId, classSuffix, clienteId, data);

  const claims = {
    iss: serviceAccount.client_email,
    aud: 'google',
    typ: 'savetowallet',
    iat,
    origins: [HOSTING_ORIGIN, 'http://localhost:3000', 'http://localhost:5000'],
    payload: {
      loyaltyClasses: [loyaltyClass],
      loyaltyObjects: [loyaltyObject],
    },
  };

  return jwt.sign(claims, serviceAccount.private_key, { algorithm: 'RS256' });
}

function setCors(res) {
  res.set('Access-Control-Allow-Origin', HOSTING_ORIGIN);
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * POST { clienteId, nombre?, puntos?, nivel? }
 * → { success, walletUrl, passId }
 */
function createGenerateWalletPassHandler() {
  return functions.https.onRequest(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Usa POST' });
    }

    try {
      const { issuerId, classSuffix, serviceAccountRaw } = walletEnv();
      if (!issuerId) {
        return res.status(503).json({
          error: 'GOOGLE_WALLET_ISSUER_ID no configurado. Ver GOOGLE-WALLET-SETUP.md',
        });
      }

      const body = req.body || {};
      const clienteId = (body.clienteId || '').trim();
      if (!clienteId) {
        return res.status(400).json({ error: 'clienteId es requerido' });
      }

      const serviceAccount = loadServiceAccount(serviceAccountRaw);
      const token = signSaveToWalletJwt(serviceAccount, issuerId, classSuffix, clienteId, {
        nombre: body.nombre,
        puntos: body.puntos,
        nivel: body.nivel,
      });

      const walletUrl = `https://pay.google.com/gp/v/save/${token}`;
      const passId = `${issuerId}.${sanitizeIdPart(clienteId)}`;

      return res.json({ success: true, walletUrl, passId });
    } catch (err) {
      console.error('generateWalletPass:', err);
      return res.status(500).json({ error: err.message || 'Error interno' });
    }
  });
}

module.exports = { createGenerateWalletPassHandler, walletEnv, signSaveToWalletJwt };
