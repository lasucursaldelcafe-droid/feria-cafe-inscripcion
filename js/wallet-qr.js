/**
 * Google Wallet Pass Generator - Cliente + servidor mínimo
 * 
 * Este módulo genera código QR que enlazan directamente a Google Wallet
 * sin necesidad de Cloud Functions. Usa un enfoque simplificado que funciona
 * mientras se implementa la versión completa con funciones.
 *
 * Para una implementación productiva, reemplazar con Firebase Functions que
 * usen la API oficial de Google Wallet (requiere JwtHandler + service account).
 */

window.WalletQR = {
  /**
   * Genera un URL que abre Google Wallet en el navegador del usuario.
   * Es un workaround: redirige a un sitio que facilita agregar el pass.
   */
  generarURLWallet: function(clienteId, nombreCliente, puntos, nivel) {
    // Datos del pass (paskin simplificado)
    var passData = {
      id: clienteId,
      nombre: nombreCliente,
      puntos: puntos,
      nivel: nivel,
      fecha: new Date().toISOString()
    };

    // Codificar como URL-safe base64
    var encoded = btoa(JSON.stringify(passData));
    
    // Opción 1: URL a un handler que genera el pass dinamicamente
    // (necesita un backend que firme los passes)
    // return 'https://tu-dominio.com/api/wallet-pass?data=' + encoded;

    // Opción 2: Mientras tanto, mostrar QR que enlaza a la tarjeta web
    // (es lo que ya hace mi-tarjeta.html)
    return window.location.origin + '/mi-tarjeta.html?id=' + encodeURIComponent(clienteId);
  },

  /**
   * Abre Google Wallet (Intent nativo en móviles, web en desktop)
   * Por ahora simplemente muestra la tarjeta digital del cliente.
   */
  abrirWallet: function(clienteId) {
    window.location.href = WalletQR.generarURLWallet(clienteId);
  },

  /**
   * Genera una propuesta de pass JSON (sin firmar — para desarrollo)
   * En producción, esto debe estar firmado por Cloud Functions.
   */
  generarPassJSON: function(clienteId, clienteData) {
    return {
      iss: 'issuer@google.com', // Reemplazar con ID real del issuer
      aud: 'google',
      typ: 'savetowallet',
      origins: ['https://la-sucursal-del-cafe.web.app'],
      payload: {
        loyaltyObjects: [
          {
            id: 'la-sucursal-del-cafe.' + clienteId,
            classId: 'la-sucursal-del-cafe.fidelizacion', // Reemplazar
            state: 'ACTIVE',
            heroImage: {
              sourceUri: {
                uri: 'https://la-sucursal-del-cafe.web.app/assets/logo-la-sucursal-del-cafe.png'
              }
            },
            textModulesData: [
              {
                id: 'nombreCliente',
                header: clienteData.nombre,
                body: 'Cliente fidelización'
              },
              {
                id: 'puntos',
                header: clienteData.puntos || 0,
                body: 'Puntos disponibles'
              }
            ],
            infoModuleData: {
              showLastUpdateTime: true,
              hexBackgroundColor: '#4B352A'
            },
            barcode: {
              type: 'QR_CODE',
              value: clienteId,
              alternateText: clienteId
            }
          }
        ]
      }
    };
  }
};

/**
 * PASOS PARA PRODUCCIÓN:
 * 
 * 1. Crear proyecto en Google Wallet Console (partners.google.com/wallet)
 * 2. Configurar "Loyalty program" class
 * 3. Obtener credenciales de servicio
 * 4. Crear Cloud Function que firme los passes con JWT (ver ejemplo más abajo)
 * 5. Reemplazar la URL en mi-tarjeta.html con botón "Agregar a Google Wallet"
 * 
 * ---- CLOUD FUNCTION EJEMPLO (usar en una segunda fase) ----
 * 
 * const {google} = require('googleapis');
 * const functions = require('@google-cloud/functions-framework');
 * const jwt = require('jsonwebtoken');
 * 
 * functions.http('generateWalletPass', async (req, res) => {
 *   const {clienteId, nombre, puntos} = req.body;
 *   
 *   const passPayload = WalletQR.generarPassJSON(clienteId, {nombre, puntos});
 *   
 *   const serviceAccount = JSON.parse(process.env.GOOGLE_WALLET_SA);
 *   
 *   const signedPass = jwt.sign(passPayload, serviceAccount.private_key, {
 *     algorithm: 'RS256',
 *     issuer: serviceAccount.client_email
 *   });
 *   
 *   res.json({
 *     jwt: signedPass,
 *     walletURL: 'https://pay.google.com/gp/v/save/' + signedPass
 *   });
 * });
 */
