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
    if (copy.logoStand && copy.logoStand.base64) {
      copy.logoStand = {
        nombreArchivo: copy.logoStand.nombreArchivo,
        tipoArchivo: copy.logoStand.tipoArchivo,
        base64OmitidoEnLocal: true
      };
    }
    if (Array.isArray(copy.marcasAdicionales)) {
      copy.marcasAdicionales = copy.marcasAdicionales.map(function (item) {
        var out = { nombre: item.nombre };
        if (item.logo && item.logo.base64) {
          out.logo = {
            nombreArchivo: item.logo.nombreArchivo,
            tipoArchivo: item.logo.tipoArchivo,
            base64OmitidoEnLocal: true
          };
        }
        return out;
      });
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
          standOcupado: !!(body && body.standOcupado),
          whatsappGrupoUrl: body && body.whatsappGrupoUrl,
          fotoEnlace: body && body.fotoEnlace,
          logoEnlace: body && body.logoEnlace,
          logos: body && body.logos,
          accessCode: body && body.accessCode,
          expositorPanelUrl: body && body.expositorPanelUrl,
          pasaporteUrl: body && body.pasaporteUrl,
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
        standOcupado: remoteResult.standOcupado,
        id: remoteResult.id,
        whatsappGrupoUrl: remoteResult.whatsappGrupoUrl,
        fotoEnlace: remoteResult.fotoEnlace,
        logoEnlace: remoteResult.logoEnlace,
        logos: remoteResult.logos,
        accessCode: remoteResult.accessCode,
        expositorPanelUrl: remoteResult.expositorPanelUrl,
        pasaporteUrl: remoteResult.pasaporteUrl
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

  function fetchStandsMap() {
    var url = getWebAppUrl();
    if (!url) {
      return Promise.resolve({ ok: false, reason: 'no_url' });
    }

    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return fetch(url + sep + 'action=stands_map', {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store'
    }).then(function (res) {
      return res.json();
    }).catch(function (err) {
      return { ok: false, error: err.message || String(err) };
    });
  }

  function postAction(action, payload) {
    var url = getWebAppUrl();
    if (!url) {
      return Promise.resolve({ ok: false, skipped: true, reason: 'no_url' });
    }

    var body = payload || {};
    body.action = action;

    return fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (data) {
        return Object.assign({ status: res.status }, data || {});
      }).catch(function () {
        return { ok: false, error: 'Respuesta inválida del servidor.' };
      });
    }).catch(function (err) {
      return { ok: false, error: err.message || String(err) };
    });
  }

  function fetchExpositorFeed() {
    var url = getWebAppUrl();
    if (!url) {
      return Promise.resolve({ ok: false, reason: 'no_url' });
    }

    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return fetch(url + sep + 'action=expositor_feed', {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store'
    }).then(function (res) {
      return res.json();
    }).catch(function (err) {
      return { ok: false, error: err.message || String(err) };
    });
  }

  function fetchParticipantesPublico() {
    var url = getWebAppUrl();
    if (!url) {
      return Promise.resolve({ ok: false, reason: 'no_url' });
    }

    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return fetch(url + sep + 'action=participantes_publico&_=' + Date.now(), {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store'
    }).then(function (res) {
      return res.json();
    }).catch(function (err) {
      return { ok: false, error: err.message || String(err) };
    });
  }

  function fetchPatrocinadoresCompetencia() {
    var url = getWebAppUrl();
    if (!url) {
      return Promise.resolve({ ok: false, reason: 'no_url' });
    }

    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return fetch(url + sep + 'action=patrocinadores_competencia_publico&_=' + Date.now(), {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store'
    }).then(function (res) {
      return res.json();
    }).catch(function (err) {
      return { ok: false, error: err.message || String(err) };
    });
  }

  function expositorLogin(email, accessCode) {
    return postAction('expositor_login', {
      email: String(email || '').trim().toLowerCase(),
      accessCode: String(accessCode || '').trim()
    });
  }

  global.FormSubmit = {
    isConfigured: isConfigured,
    submitForm: submitForm,
    submitWaitlist: submitWaitlist,
    fetchCupoCount: fetchCupoCount,
    fetchStandsMap: fetchStandsMap,
    fetchExpositorFeed: fetchExpositorFeed,
    fetchParticipantesPublico: fetchParticipantesPublico,
    fetchPatrocinadoresCompetencia: fetchPatrocinadoresCompetencia,
    expositorLogin: expositorLogin
  };
})(window);
