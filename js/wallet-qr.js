/**
 * Google Wallet — cliente para tarjetas de fidelización.
 * Llama a la Cloud Function generateWalletPass (Firebase).
 */
window.WalletQR = {
  getFunctionUrl: function () {
    var cfg = window.WALLET_CONFIG || {};
    if (cfg.FUNCTION_URL) {
      return cfg.FUNCTION_URL;
    }
    var fb = window.FIREBASE_FIDELIZACION_CONFIG || {};
    if (fb.projectId) {
      return (
        'https://us-central1-' +
        fb.projectId +
        '.cloudfunctions.net/generateWalletPass'
      );
    }
    return '';
  },

  isEnabled: function () {
    var cfg = window.WALLET_CONFIG || {};
    if (cfg.ENABLED === false) {
      return false;
    }
    return !!this.getFunctionUrl();
  },

  /** Fallback: tarjeta web si Wallet no está configurado */
  generarURLTarjeta: function (clienteId) {
    if (window.Fidelizacion && Fidelizacion.urlPasaporte) {
      return Fidelizacion.urlPasaporte(clienteId);
    }
    return (
      window.location.origin +
      '/pasaporte?id=' +
      encodeURIComponent(clienteId)
    );
  },

  /**
   * Abre Google Wallet con pass firmado por Cloud Function.
   * @param {string} clienteId
   * @param {{ nombre?: string, puntos?: number, nivel?: string }} clienteData
   */
  abrirWallet: async function (clienteId, clienteData) {
    clienteData = clienteData || {};
    var btn = document.getElementById('btnWallet');
    var labelOriginal = btn ? btn.textContent : '';

    if (!this.isEnabled()) {
      window.location.href = this.generarURLTarjeta(clienteId);
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Generando pass…';
    }

    try {
      var response = await fetch(this.getFunctionUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: clienteId,
          nombre: clienteData.nombre || '',
          puntos: clienteData.puntos || 0,
          nivel: clienteData.nivel || 'Bronce',
        }),
      });

      var result = await response.json();
      if (!response.ok || !result.walletUrl) {
        throw new Error(result.error || 'No se pudo generar el pass');
      }

      window.location.href = result.walletUrl;
    } catch (err) {
      console.error('WalletQR:', err);
      var msg =
        err && err.message
          ? err.message
          : 'Error al conectar con Google Wallet';
      if (btn) {
        btn.disabled = false;
        btn.textContent = labelOriginal;
      }
      alert(
        'No se pudo agregar a Google Wallet.\n\n' +
          msg +
          '\n\nPuedes guardar la tarjeta web como acceso directo.'
      );
    }
  },
};
