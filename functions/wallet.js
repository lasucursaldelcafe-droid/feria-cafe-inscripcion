/**
 * Google Wallet — tarjetas de fidelización (Loyalty).
 * Modo A: JSON de cuenta de servicio (wallet.service_account).
 * Modo B: IAM signJwt sin clave JSON (wallet.service_account_email) — ver GOOGLE-WALLET-SETUP.md.
 */

const functions = require('firebase-functions');
const jwt = require('jsonwebtoken');
const { GoogleAuth } = require('google-auth-library');

const HOSTING_ORIGIN = 'https://la-sucursal-del-cafe.web.app';
const LOGO_URL = `${HOSTING_ORIGIN}/assets/logo-la-sucursal-del-cafe.png`;
const CLASS_SUFFIX = 'la_sucursal_fidelizacion';

function walletEnv() {
  const cfg = functions.config().wallet || {};
  const serviceAccountRaw =
    process.env.GOOGLE_WALLET_SERVICE_ACCOUNT || cfg.service_account || '';
  let serviceAccountEmail = (
    process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL ||
    cfg.service_account_email ||
    ''
  ).trim();

  if (!serviceAccountEmail && serviceAccountRaw) {
    try {
      const parsed =
        typeof serviceAccountRaw === 'string' ? JSON.parse(serviceAccountRaw) : serviceAccountRaw;
      serviceAccountEmail = (parsed.client_email || '').trim();
    } catch (_) {
      /* usar solo email explícito */
    }
  }

  return {
    issuerId: (process.env.GOOGLE_WALLET_ISSUER_ID || cfg.issuer_id || '').trim(),
    classSuffix: (process.env.GOOGLE_WALLET_CLASS_SUFFIX || cfg.class_suffix || CLASS_SUFFIX).trim(),
    serviceAccountRaw,
    serviceAccountEmail,
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

function buildSaveToWalletClaims(serviceAccountEmail, issuerId, classSuffix, clienteId, data) {
  const iat = Math.floor(Date.now() / 1000);
  return {
    iss: serviceAccountEmail,
    aud: 'google',
    typ: 'savetowallet',
    iat,
    origins: [HOSTING_ORIGIN, 'http://localhost:3000', 'http://localhost:5000'],
    payload: {
      loyaltyClasses: [buildLoyaltyClass(issuerId, classSuffix)],
      loyaltyObjects: [buildLoyaltyObject(issuerId, classSuffix, clienteId, data)],
    },
  };
}

async function signJwtWithIam(serviceAccountEmail, claims) {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const url =
    'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/' +
    encodeURIComponent(serviceAccountEmail) +
    ':signJwt';

  const response = await client.request({
    url,
    method: 'POST',
    data: { payload: JSON.stringify(claims) },
  });

  if (!response.data || !response.data.signedJwt) {
    throw new Error('IAM signJwt no devolvió signedJwt. ¿API IAM Credentials habilitada?');
  }
  return response.data.signedJwt;
}

async function signSaveToWalletJwt(walletConfig, issuerId, classSuffix, clienteId, data) {
  if (walletConfig.serviceAccountRaw) {
    try {
      const serviceAccount = loadServiceAccount(walletConfig.serviceAccountRaw);
      const claims = buildSaveToWalletClaims(
        serviceAccount.client_email,
        issuerId,
        classSuffix,
        clienteId,
        data
      );
      return jwt.sign(claims, serviceAccount.private_key, { algorithm: 'RS256' });
    } catch (err) {
      if (!walletConfig.serviceAccountEmail) {
        throw err;
      }
      console.warn('Wallet: JSON inválido, usando IAM signJwt:', err.message);
    }
  }

  const serviceAccountEmail = walletConfig.serviceAccountEmail;
  if (!serviceAccountEmail) {
    throw new Error(
      'Configura wallet.service_account_email o wallet.service_account. Ver GOOGLE-WALLET-SETUP.md'
    );
  }

  const claims = buildSaveToWalletClaims(
    serviceAccountEmail,
    issuerId,
    classSuffix,
    clienteId,
    data
  );
  return signJwtWithIam(serviceAccountEmail, claims);
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
      const walletConfig = walletEnv();
      const { issuerId, classSuffix } = walletConfig;
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

      const token = await signSaveToWalletJwt(walletConfig, issuerId, classSuffix, clienteId, {
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

module.exports = {
  createGenerateWalletPassHandler,
  walletEnv,
  signSaveToWalletJwt,
};
