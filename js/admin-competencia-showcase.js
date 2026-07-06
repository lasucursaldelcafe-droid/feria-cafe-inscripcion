/**
 * Admin — configuración del resumen V60 en la página de inicio.
 */
(function (global) {
  'use strict';

  var CONFIG_KEY = 'competencia_home_showcase';
  var cachedConfig = null;

  function getWebAppUrl() {
    var cfg = global.SHEETS_CONFIG || {};
    return String(cfg.WEB_APP_URL || '').trim();
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildUrl(action, params) {
    var base = getWebAppUrl();
    if (!base) return '';
    var q = 'action=' + encodeURIComponent(action);
    Object.keys(params || {}).forEach(function (key) {
      q += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    });
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + q;
  }

  function postAction(body) {
    var url = getWebAppUrl();
    if (!url) return Promise.resolve({ ok: false, error: 'URL de Apps Script no configurada.' });
    return fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () {
        return { ok: false, error: 'Respuesta inválida.' };
      });
    });
  }

  function defaultConfig() {
    return {
      enabled: true,
      titulo: 'V60 Championship',
      subtitulo: 'Primera Preliminar — Resultados oficiales',
      descripcion: '12 baristas en duelos 1v1. Conoce al podio y a quienes disputaron la final en la primera preliminar del circuito.',
      badge: 'Reto V60',
      edicionEvento: 'V60 Championship — Preliminar 1',
      mostrarPodio: true,
      mostrarCarrusel: true,
      carruselIds: [],
      podio: [],
      ctaLabel: 'Inscripción V60',
      ctaHref: 'competencia.html',
      resultadosLabel: 'Ver resultados',
      resultadosHref: 'jurado/resultados'
    };
  }

  function podioFromPreliminar1() {
    var P = global.Preliminar1Results;
    if (!P || !P.getPodioFinal) return [];
    return P.getPodioFinal().map(function (row) {
      return {
        posicion: row.posicion,
        competidorId: row.competidorId || '',
        puntos: row.total
      };
    });
  }

  function carruselIdsFromPreliminar1() {
    var P = global.Preliminar1Results;
    if (!P || !P.exportKit) return [];
    var kit = P.exportKit();
    return (kit.inscritos || []).map(function (ins) { return ins.id; }).filter(Boolean);
  }

  function competidorOptions(rows) {
    return (rows || []).map(function (row) {
      var id = String(row['ID'] || '').trim();
      var nombre = String(row['Nombre'] || '').trim();
      var evento = String(row['Evento'] || '').trim();
      if (!id || !nombre) return '';
      return '<option value="' + escapeHtml(id) + '">' +
        escapeHtml(nombre) + (evento ? ' · ' + escapeHtml(evento) : '') +
        '</option>';
    }).join('');
  }

  function getPodioSlot(cfg, pos) {
    var podio = Array.isArray(cfg.podio) ? cfg.podio : [];
    for (var i = 0; i < podio.length; i++) {
      if (parseInt(podio[i].posicion, 10) === pos) return podio[i];
    }
    return { posicion: pos, competidorId: '', puntos: '' };
  }

  function readFormConfig() {
    function val(id) {
      var el = document.getElementById(id);
      return el ? String(el.value || '').trim() : '';
    }
    function checked(id) {
      var el = document.getElementById(id);
      return el ? !!el.checked : false;
    }
    var podio = [1, 2, 3].map(function (pos) {
      return {
        posicion: pos,
        competidorId: val('compShowcasePodio' + pos + 'Id'),
        puntos: val('compShowcasePodio' + pos + 'Pts') || null
      };
    }).filter(function (slot) { return slot.competidorId; });

    var carruselIds = [];
    document.querySelectorAll('#compShowcaseCarruselList input[type="checkbox"]:checked').forEach(function (cb) {
      var id = cb.getAttribute('data-comp-id');
      if (id) carruselIds.push(id);
    });

    return {
      enabled: checked('compShowcaseEnabled'),
      titulo: val('compShowcaseTitulo'),
      subtitulo: val('compShowcaseSubtitulo'),
      descripcion: val('compShowcaseDescripcion'),
      badge: val('compShowcaseBadge'),
      edicionEvento: val('compShowcaseEdicion'),
      mostrarPodio: checked('compShowcaseMostrarPodio'),
      mostrarCarrusel: checked('compShowcaseMostrarCarrusel'),
      carruselIds: carruselIds,
      podio: podio,
      ctaLabel: val('compShowcaseCtaLabel'),
      ctaHref: val('compShowcaseCtaHref'),
      resultadosLabel: val('compShowcaseResultadosLabel'),
      resultadosHref: val('compShowcaseResultadosHref')
    };
  }

  function fillForm(cfg, rows) {
    cfg = cfg || defaultConfig();
    var options = competidorOptions(rows);
    [1, 2, 3].forEach(function (pos) {
      var slot = getPodioSlot(cfg, pos);
      var sel = document.getElementById('compShowcasePodio' + pos + 'Id');
      if (sel) {
        sel.innerHTML = '<option value="">— Seleccionar —</option>' + options;
        sel.value = slot.competidorId || '';
      }
      var pts = document.getElementById('compShowcasePodio' + pos + 'Pts');
      if (pts) pts.value = slot.puntos != null && slot.puntos !== '' ? slot.puntos : '';
    });

    var list = document.getElementById('compShowcaseCarruselList');
    if (list) {
      var selected = Array.isArray(cfg.carruselIds) ? cfg.carruselIds : [];
      list.innerHTML = (rows || []).map(function (row) {
        var id = String(row['ID'] || '').trim();
        var nombre = String(row['Nombre'] || '').trim();
        if (!id || !nombre) return '';
        var checked = selected.indexOf(id) >= 0 ? ' checked' : '';
        return '<label class="admin-comp-showcase-check">' +
          '<input type="checkbox" data-comp-id="' + escapeHtml(id) + '"' + checked + '>' +
          '<span>' + escapeHtml(nombre) + '</span></label>';
      }).join('') || '<p class="admin-table-meta">Sin competidores en Sheets.</p>';
    }

    function setVal(id, v) {
      var el = document.getElementById(id);
      if (el) el.value = v != null ? v : '';
    }
    function setCheck(id, v) {
      var el = document.getElementById(id);
      if (el) el.checked = !!v;
    }

    setCheck('compShowcaseEnabled', cfg.enabled !== false);
    setVal('compShowcaseTitulo', cfg.titulo);
    setVal('compShowcaseSubtitulo', cfg.subtitulo);
    setVal('compShowcaseDescripcion', cfg.descripcion);
    setVal('compShowcaseBadge', cfg.badge);
    setVal('compShowcaseEdicion', cfg.edicionEvento);
    setCheck('compShowcaseMostrarPodio', cfg.mostrarPodio !== false);
    setCheck('compShowcaseMostrarCarrusel', cfg.mostrarCarrusel !== false);
    setVal('compShowcaseCtaLabel', cfg.ctaLabel);
    setVal('compShowcaseCtaHref', cfg.ctaHref);
    setVal('compShowcaseResultadosLabel', cfg.resultadosLabel);
    setVal('compShowcaseResultadosHref', cfg.resultadosHref);
    cachedConfig = cfg;
  }

  function showResult(msg, ok) {
    var el = document.getElementById('compShowcaseAdminResult');
    if (!el) return;
    el.hidden = false;
    el.className = 'admin-create-result' + (ok ? ' admin-create-result--ok' : ' admin-create-result--error');
    el.textContent = msg;
  }

  function loadConfig() {
    var url = buildUrl('pasaporte_config', { key: CONFIG_KEY });
    if (!url) return Promise.resolve(defaultConfig());
    return fetch(url, { cache: 'no-store', mode: 'cors' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.ok && data.data) return data.data;
        return defaultConfig();
      })
      .catch(function () { return defaultConfig(); });
  }

  function saveConfig(cfg) {
    return postAction({
      action: 'admin_save_competencia_resumen',
      data: cfg
    });
  }

  function renderPreview(cfg) {
    var preview = document.getElementById('compShowcaseAdminPreview');
    if (!preview || !global.CompetenciaHomeShowcase) return;
    var rows = (global.AdminCompetenciaShowcase && global.AdminCompetenciaShowcase.lastRows) || [];
    var byId = {};
    rows.forEach(function (row) {
      var id = String(row['ID'] || '').trim();
      if (!id) return;
      byId[id] = {
        id: id,
        nombre: String(row['Nombre'] || '').trim(),
        ciudad: String(row['Ciudad'] || '').trim(),
        representa: String(row['Representa'] || '').trim(),
        fotoUrl: String(row['Foto participante enlace Drive'] || '').trim()
      };
    });
    var carrusel = (cfg.carruselIds || []).map(function (id) { return byId[id]; }).filter(Boolean);
    if (!carrusel.length) carrusel = rows.map(function (row) { return byId[String(row['ID'] || '').trim()]; }).filter(Boolean);
    var podio = (cfg.podio || []).map(function (slot) {
      var item = byId[slot.competidorId];
      if (!item) return null;
      return Object.assign({}, item, { posicion: slot.posicion, puntos: slot.puntos });
    }).filter(Boolean);
    var payload = Object.assign({}, cfg, { carrusel: carrusel, podio: podio, ok: true });
    preview.innerHTML = global.CompetenciaHomeShowcase.renderShowcase(payload);
    preview.hidden = false;
  }

  function bindForm() {
    var form = document.getElementById('formCompShowcaseAdmin');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';

    document.getElementById('compShowcaseFillP1Btn').addEventListener('click', function () {
      var cfg = readFormConfig();
      cfg.podio = podioFromPreliminar1();
      cfg.carruselIds = carruselIdsFromPreliminar1();
      cfg.edicionEvento = 'V60 Championship — Preliminar 1';
      cfg.subtitulo = 'Primera Preliminar — Resultados oficiales';
      fillForm(cfg, global.AdminCompetenciaShowcase.lastRows || []);
      showResult('Datos de Preliminar 1 cargados en el formulario (guarda para publicar).', true);
    });

    document.getElementById('compShowcasePreviewBtn').addEventListener('click', function () {
      renderPreview(readFormConfig());
    });

    document.getElementById('compShowcaseSelectAllBtn').addEventListener('click', function () {
      document.querySelectorAll('#compShowcaseCarruselList input[type="checkbox"]').forEach(function (cb) {
        cb.checked = true;
      });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var cfg = readFormConfig();
      saveConfig(cfg).then(function (data) {
        if (data && data.ok) {
          cachedConfig = cfg;
          showResult('Resumen guardado. Visible en el inicio tras desplegar Apps Script.', true);
        } else {
          showResult((data && data.error) || 'No se pudo guardar.', false);
        }
      });
    });
  }

  function mount(rows) {
    global.AdminCompetenciaShowcase = global.AdminCompetenciaShowcase || {};
    global.AdminCompetenciaShowcase.lastRows = rows || [];
    bindForm();
    loadConfig().then(function (cfg) {
      fillForm(cfg, rows || []);
    });
  }

  global.AdminCompetenciaShowcase = {
    mount: mount,
    loadConfig: loadConfig,
    saveConfig: saveConfig
  };
})(typeof window !== 'undefined' ? window : this);
