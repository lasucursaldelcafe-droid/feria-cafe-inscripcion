/**
 * Envío de formularios a Google Sheets (Apps Script) con respaldo en localStorage.
 */
(function (global) {
  'use strict';

  function getWebAppUrl() {
    var cfg = global.SHEETS_CONFIG || {};
    var url = (cfg.WEB_APP_URL || '').trim();
    if (!url || url.indexOf('TU_ID_DE_DEPLOYMENT') !== -1) {
      return '';
    }
    return url;
  }

  function isConfigured() {
    return !!getWebAppUrl();
  }

  function stripHeavyFields(entry) {
    var copy = JSON.parse(JSON.stringify(entry));
    if (copy.comprobanteArchivo && copy.comprobanteArchivo.base64) {
      copy.comprobanteArchivo = {
        tieneComprobante: copy.comprobanteArchivo.tieneComprobante,
        nombreArchivo: copy.comprobanteArchivo.nombreArchivo,
        tipoArchivo: copy.comprobanteArchivo.tipoArchivo,
        base64OmitidoEnLocal: true
      };
    }
    return copy;
  }

  function saveLocal(storageKey, entry) {
    try {
      var list = JSON.parse(localStorage.getItem(storageKey) || '[]');
      list.push(stripHeavyFields(entry));
      localStorage.setItem(storageKey, JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
  }

  function submitToSheets(formType, data) {
    var url = getWebAppUrl();
    if (!url) {
      return Promise.resolve({ ok: false, skipped: true, reason: 'no_url' });
    }

    return fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ formType: formType, data: data })
    }).then(function () {
      return { ok: true, remote: true };
    }).catch(function (err) {
      return { ok: false, remote: false, error: err.message || String(err) };
    });
  }

  /**
   * Envía al backend remoto si está configurado; siempre guarda copia local.
   * @returns {Promise<{ok: boolean, local: boolean, remote?: boolean, skipped?: boolean}>}
   */
  function submitForm(formType, storageKey, entry) {
    var localOk = saveLocal(storageKey, entry);

    return submitToSheets(formType, entry).then(function (remoteResult) {
      return {
        ok: localOk || remoteResult.ok,
        local: localOk,
        remote: remoteResult.ok && remoteResult.remote,
        skipped: remoteResult.skipped,
        error: remoteResult.error
      };
    });
  }

  global.FormSubmit = {
    isConfigured: isConfigured,
    submitForm: submitForm
  };
})(window);
