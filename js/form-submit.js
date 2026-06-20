/**
 * Envío de formularios a Google Sheets (Apps Script) con respaldo opcional en localStorage.
 * Alertas al equipo: al guardar una fila, Code.gs envía correo a ORGANIZER_EMAIL (ver event-config.alerts).
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
    if (copy.fotoParticipante && copy.fotoParticipante.base64) {
      copy.fotoParticipante = {
        nombreArchivo: copy.fotoParticipante.nombreArchivo,
        tipoArchivo: copy.fotoParticipante.tipoArchivo,
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

  function postJson(formType, data) {
    var url = getWebAppUrl();
    if (!url) {
      return Promise.resolve({ ok: false, skipped: true, reason: 'no_url' });
    }

    return fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ formType: formType, data: data })
    }).then(function (res) {
      return res.json().then(function (body) {
        return {
          ok: body && body.ok === true,
          remote: true,
          id: body && body.id,
          error: body && body.error,
          duplicate: !!(body && body.duplicate),
          cupoCompleto: !!(body && body.cupoCompleto),
          whatsappGrupoUrl: body && body.whatsappGrupoUrl,
          fotoEnlace: body && body.fotoEnlace,
          status: res.status
        };
      }).catch(function () {
        return { ok: false, remote: true, error: 'Respuesta inválida del servidor.' };
      });
    }).catch(function (err) {
      return { ok: false, remote: false, error: err.message || String(err) };
    });
  }

  function submitForm(formType, storageKey, entry) {
    return postJson(formType, entry).then(function (remoteResult) {
      if (remoteResult.skipped) {
        var localOk = saveLocal(storageKey, entry);
        return {
          ok: localOk,
          local: localOk,
          remote: false,
          skipped: true
        };
      }

      if (remoteResult.ok) {
        saveLocal(storageKey, entry);
      }

      return {
        ok: remoteResult.ok,
        local: remoteResult.ok,
        remote: remoteResult.remote && remoteResult.ok,
        skipped: false,
        error: remoteResult.error,
        duplicate: remoteResult.duplicate,
        cupoCompleto: remoteResult.cupoCompleto,
        id: remoteResult.id,
        whatsappGrupoUrl: remoteResult.whatsappGrupoUrl,
        fotoEnlace: remoteResult.fotoEnlace
      };
    });
  }

  function submitWaitlist(entry) {
    return postJson('lista_espera', entry);
  }

  function fetchCupoCount() {
    var url = getWebAppUrl();
    if (!url) {
      return Promise.resolve({ ok: false, reason: 'no_url' });
    }

    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return fetch(url + sep + 'action=cupo', {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store'
    }).then(function (res) {
      return res.json();
    }).catch(function (err) {
      return { ok: false, error: err.message || String(err) };
    });
  }

  global.FormSubmit = {
    isConfigured: isConfigured,
    submitForm: submitForm,
    submitWaitlist: submitWaitlist,
    fetchCupoCount: fetchCupoCount
  };
})(window);
