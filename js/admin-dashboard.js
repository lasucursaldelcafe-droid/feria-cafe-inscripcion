/**
 * Panel admin — carga directa sin autenticación (Apps Script + Sheets).
 */
(function (global) {
  'use strict';

  var lastDashboardData = null;
  var exportInFlight = false;

  var DEFAULT_FERIA_COLS = [
    'Fecha registro', 'ID', 'Nombre', 'Edad', 'Celular', 'Correo', 'Intereses',
    'Estado registro', 'Habilitado', 'Notas admin'
  ];

  var DEFAULT_COMP_COLS = [
    'Fecha registro', 'ID', 'Nombre', 'Correo', 'Celular', 'Ciudad',
    'Estado pago', 'Cupo confirmado', 'Habilitado', 'Comprobante enlace Drive'
  ];

  var DEFAULT_STANDS_COLS = [
    'Fecha registro', 'ID', 'Stand ID', 'Marca o negocio', 'Persona contacto', 'Celular', 'Correo',
    'Plan stand', 'Ciudad', 'Tipo participante', 'Estado solicitud', 'Habilitado'
  ];

  var activeAdminTab = 'expositores';
  var activeAdminSection = 'resumen';
  var ADMIN_TAB_KEY = 'feria_admin_tab';
  var ADMIN_SECTION_KEY = 'feria_admin_section';
  var ADMIN_COMPETENCIA_EDITION_KEY = 'lsc_admin_competencia_edition';
  var activeCompetenciaEdition = 'evento2';

  var ADMIN_SECTIONS = [
    'resumen', 'analiticas', 'competidores', 'stands', 'visitantes', 'sitio', 'pasaportes', 'operadores'
  ];

  function getWebAppUrl() {
    var cfg = global.SHEETS_CONFIG || {};
    var url = (cfg.WEB_APP_URL || '').trim();
    if (!url || url.indexOf('TU_ID_DE_DEPLOYMENT') !== -1) return '';
    return url;
  }

  function buildAdminUrl(action, extraParams) {
    var url = getWebAppUrl();
    if (!url) return '';
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    var qs = 'action=' + encodeURIComponent(action);
    if (extraParams) {
      Object.keys(extraParams).forEach(function (key) {
        var val = extraParams[key];
        if (val !== undefined && val !== null && val !== '') {
          qs += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(val);
        }
      });
    }
    return url + sep + qs;
  }

  function fetchJson(url) {
    return fetch(url, { method: 'GET', mode: 'cors', cache: 'no-store' })
      .then(function (res) {
        return res.json().catch(function () {
          return { ok: false, error: 'Respuesta inválida del servidor (HTTP ' + res.status + ').' };
        });
      })
      .catch(function (err) {
        return { ok: false, error: err.message || String(err) };
      });
  }

  function fetchDashboard() {
    var requestUrl = buildAdminUrl('admin_dashboard');
    if (!requestUrl) {
      return Promise.resolve({ ok: false, error: 'URL de Apps Script no configurada.' });
    }
    return fetchJson(requestUrl).then(function (data) {
      if (data.ok && data.message && !data.stats) {
        return {
          ok: false,
          error: 'Apps Script desactualizado: falta action=admin_dashboard. Ejecuta py tools/setup_admin.py'
        };
      }
      if (!data.ok && (data.error || '').indexOf('autorizado') !== -1) {
        return {
          ok: false,
          error: 'Backend bloquea el panel. Ejecuta py tools/setup_admin.py para redeploy con acceso público.'
        };
      }
      return data;
    });
  }

  function fetchExport(dataset) {
    return fetchJson(buildAdminUrl('admin_export', { dataset: dataset }));
  }

  function formatNumber(n) {
    return typeof n === 'number' ? n.toLocaleString('es-CO') : String(n || '0');
  }

  function competenciaEventKey(val) {
    var s = String(val || '').trim();
    if (!s) return '';
    if (/preliminar\s*2/i.test(s) || /evento\s*2/i.test(s) || /2\.ª/i.test(s)) return 'V60 Championship — Preliminar 2';
    if (/preliminar\s*1/i.test(s) || /evento\s*1/i.test(s) || /1\.ª/i.test(s)) return 'V60 Championship — Preliminar 1';
    if (s === 'V60 Championship') return 'V60 Championship — Preliminar 1';
    return s;
  }

  function getCompetenciaEditionLabel(editionKey) {
    if (editionKey === 'evento1') return 'Preliminar 1';
    if (editionKey === 'evento2') return 'Preliminar 2';
    if (editionKey === 'all') return 'Todas las ediciones';
    return editionKey || 'Preliminar 2';
  }

  function getCompetenciaEditionEventId(editionKey) {
    if (!editionKey || editionKey === 'all') return '';
    var cfg = global.EVENT_CONFIG || {};
    var ev = cfg[editionKey] || (editionKey === 'evento2' ? cfg.evento2 : cfg.evento1) || {};
    return String(ev.eventoId || ev.nombre || '').trim();
  }

  function getStoredCompetenciaEdition() {
    try {
      var stored = sessionStorage.getItem(ADMIN_COMPETENCIA_EDITION_KEY);
      if (stored === 'evento1' || stored === 'evento2' || stored === 'all') return stored;
    } catch (e) { /* ignore */ }
    var cfg = global.EVENT_CONFIG || {};
    return cfg.torneoActivo === 'evento1' ? 'evento1' : 'evento2';
  }

  function saveCompetenciaEdition(editionKey) {
    activeCompetenciaEdition = editionKey;
    try {
      sessionStorage.setItem(ADMIN_COMPETENCIA_EDITION_KEY, editionKey);
    } catch (e) { /* ignore */ }
  }

  function filterCompetenciaByEdition(rows, editionKey) {
    if (!editionKey || editionKey === 'all') return (rows || []).slice();
    var target = competenciaEventKey(getCompetenciaEditionEventId(editionKey));
    if (!target) return (rows || []).slice();
    return (rows || []).filter(function (row) {
      return competenciaEventKey(row.Evento || row.evento) === target;
    });
  }

  function filterValidCompetenciaRows(rows) {
    return (rows || []).filter(function (row) {
      return String(row['ID'] || '').trim() && String(row['Nombre'] || '').trim();
    });
  }

  function countCompetenciaEditionRows(rows, editionKey) {
    return filterCompetenciaByEdition(filterValidCompetenciaRows(rows), editionKey).length;
  }

  function ensureCompetenciaEditionVisible(data) {
    var all = filterValidCompetenciaRows(pickRows(data || {}, 'allCompetencia'));
    if (!all.length) return false;
    var visible = filterCompetenciaByEdition(all, activeCompetenciaEdition);
    if (visible.length || activeCompetenciaEdition === 'all') return false;
    var prev = activeCompetenciaEdition;
    if (countCompetenciaEditionRows(all, 'evento2') > 0) {
      saveCompetenciaEdition('evento2');
    } else if (countCompetenciaEditionRows(all, 'evento1') > 0) {
      saveCompetenciaEdition('evento1');
    } else {
      saveCompetenciaEdition('all');
    }
    syncCompetenciaEditionUi();
    return prev !== activeCompetenciaEdition;
  }

  function pickCompetenciaRows(data) {
    return filterCompetenciaByEdition(
      filterValidCompetenciaRows(pickRows(data || lastDashboardData || {}, 'allCompetencia')),
      activeCompetenciaEdition
    );
  }

  function getCompetenciaCupoMax() {
    var cfg = global.EVENT_CONFIG || {};
    var max = parseInt(cfg.cupoCompetencia, 10);
    return max > 0 ? max : 36;
  }

  function computeCompetenciaEditionCupo(rows, editionKey) {
    var key = editionKey === 'all' ? 'evento2' : editionKey;
    var filtered = filterCompetenciaByEdition(rows, key);
    var max = getCompetenciaCupoMax();
    var count = filtered.length;
    return {
      count: count,
      max: max,
      disponibles: Math.max(0, max - count),
      completo: count >= max
    };
  }

  function syncCompetenciaEditionUi() {
    var sel = document.getElementById('adminCompetenciaEdition');
    if (sel && sel.value !== activeCompetenciaEdition) sel.value = activeCompetenciaEdition;

    var rows = pickCompetenciaRows(lastDashboardData || {});
    var meta = document.getElementById('adminCompetenciaEditionMeta');
    if (meta) {
      meta.textContent = rows.length + ' competidores · ' + getCompetenciaEditionLabel(activeCompetenciaEdition);
    }

    var cupoEl = document.getElementById('adminCompetenciaCupoMeta');
    if (cupoEl && lastDashboardData) {
      var allValid = filterValidCompetenciaRows(pickRows(lastDashboardData, 'allCompetencia'));
      var cupo = computeCompetenciaEditionCupo(allValid, activeCompetenciaEdition);
      if (activeCompetenciaEdition === 'all') {
        var p1 = countCompetenciaEditionRows(allValid, 'evento1');
        var p2 = countCompetenciaEditionRows(allValid, 'evento2');
        cupoEl.textContent = 'P1: ' + p1 + ' · P2: ' + p2 + ' · Total: ' + allValid.length;
      } else {
        cupoEl.textContent = 'Cupo: ' + formatNumber(cupo.count) + ' / ' + formatNumber(cupo.max) +
          (cupo.completo ? ' (completo)' : '');
      }
    }

    var editionHint = document.getElementById('adminCompetenciaEditionHint');
    if (editionHint && lastDashboardData) {
      var allRows = filterValidCompetenciaRows(pickRows(lastDashboardData, 'allCompetencia'));
      var visibleCount = pickCompetenciaRows(lastDashboardData).length;
      if (!visibleCount && allRows.length && activeCompetenciaEdition !== 'all') {
        editionHint.innerHTML = 'No hay inscritos en esta edición. ' +
          '<button type="button" class="admin-btn admin-btn--secondary admin-btn--sm" data-edition-switch="evento1">Ver Preliminar 1</button> ' +
          '<button type="button" class="admin-btn admin-btn--secondary admin-btn--sm" data-edition-switch="all">Ver todas</button>';
        editionHint.hidden = false;
      } else {
        editionHint.hidden = true;
        editionHint.textContent = '';
      }
    }
  }

  function bindCompetenciaEditionHintActions() {
    document.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-edition-switch]');
      if (!btn) return;
      var edition = btn.getAttribute('data-edition-switch');
      if (!edition) return;
      var sel = document.getElementById('adminCompetenciaEdition');
      if (sel) sel.value = edition;
      saveCompetenciaEdition(edition);
      closeCompetidorEditor();
      syncCompetenciaEditionUi();
      if (lastDashboardData) renderAdminTabPanels(lastDashboardData);
    });
  }

  function bindCompetenciaEditionSelector() {
    var sel = document.getElementById('adminCompetenciaEdition');
    if (!sel || sel.getAttribute('data-bound') === '1') return;
    sel.setAttribute('data-bound', '1');
    activeCompetenciaEdition = getStoredCompetenciaEdition();
    sel.value = activeCompetenciaEdition;
    sel.addEventListener('change', function () {
      saveCompetenciaEdition(sel.value || 'evento2');
      closeCompetidorEditor();
      syncCompetenciaEditionUi();
      if (lastDashboardData) renderAdminTabPanels(lastDashboardData);
    });
  }

  function getActiveCompetenciaEventoForCreate() {
    var key = activeCompetenciaEdition === 'all' ? 'evento2' : activeCompetenciaEdition;
    return getCompetenciaEditionEventId(key) || 'V60 Championship — Preliminar 2';
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isLinkColumn(col) {
    return col.toLowerCase().indexOf('enlace') !== -1;
  }

  function isVisiblePublicoValue(val) {
    var v = String(val || '').trim().toLowerCase();
    if (!v) return true;
    return v === 'sí' || v === 'si' || v === 'yes' || v === 'true' || v === '1';
  }

  function isHabilitadoValue(val) {
    var v = String(val || '').trim().toLowerCase();
    if (!v) return true;
    return v === 'sí' || v === 'si' || v === 'yes' || v === 'true' || v === '1';
  }

  function postAdminAction(body) {
    var url = getWebAppUrl();
    if (!url) {
      return Promise.resolve({ ok: false, error: 'URL de Apps Script no configurada.' });
    }
    return fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () {
        return { ok: false, error: 'Respuesta inválida del servidor.' };
      });
    }).catch(function (err) {
      return { ok: false, error: err.message || String(err) };
    });
  }

  function toggleRecordStatus(dataset, id, enabled) {
    return postAdminAction({
      action: 'admin_toggle_status',
      dataset: dataset,
      id: id,
      enabled: enabled
    });
  }

  function adminCreateStand(payload) {
    return postAdminAction(Object.assign({ action: 'admin_create_stand' }, payload || {}));
  }

  function adminCreateCompetidor(payload) {
    return postAdminAction(Object.assign({ action: 'admin_create_competitor' }, payload || {}));
  }

  function adminSaveCompetidor(payload) {
    return postAdminAction(Object.assign({ action: 'admin_save_competidor' }, payload || {}));
  }

  function adminCreateVisitante(payload) {
    return postAdminAction(Object.assign({ action: 'admin_create_feria' }, payload || {}));
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  var MARCA_PLAN_BY_TAB = {
    expositores: 'Zona Origen',
    aliados: 'Aliado Patrocinador',
    patrocinadores: 'Zona Gran Reserva'
  };

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function inferStandSection(row) {
    var tipo = String(row['Tipo participante'] || '').trim().toLowerCase();
    var plan = String(row['Plan stand'] || '').trim();
    if (tipo === 'aliado' || plan === 'Aliado Patrocinador') return 'aliados';
    if (tipo === 'patrocinador' || plan === 'Zona Gran Reserva') return 'patrocinadores';
    if (tipo === 'expositor' || plan === 'Zona Origen') return 'expositores';
    return 'expositores';
  }

  function filterStandsBySection(rows, section) {
    return (rows || []).filter(function (row) {
      return inferStandSection(row) === section;
    });
  }

  function saveAdminUiState() {
    try {
      sessionStorage.setItem(ADMIN_TAB_KEY, activeAdminTab);
      sessionStorage.setItem(ADMIN_SECTION_KEY, activeAdminSection);
    } catch (e) { /* ignore */ }
  }

  function restoreAdminTabFromStorage() {
    try {
      var tab = sessionStorage.getItem(ADMIN_TAB_KEY);
      if (tab && MARCA_PLAN_BY_TAB[tab]) activeAdminTab = tab;
    } catch (e) { /* ignore */ }
  }

  function syncAdminTabUi() {
    document.querySelectorAll('[data-admin-tab]').forEach(function (tab) {
      var key = tab.getAttribute('data-admin-tab') || 'expositores';
      var active = key === activeAdminTab;
      tab.classList.toggle('admin-tab--active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function syncMarcaPlanFromTab() {
    var planSelect = document.getElementById('adminMarcaPlan');
    var defaultPlan = MARCA_PLAN_BY_TAB[activeAdminTab];
    if (planSelect && defaultPlan) planSelect.value = defaultPlan;
  }

  function resetAdminCreateMarcaForm() {
    var form = document.getElementById('formAdminCreateMarca');
    var result = document.getElementById('adminCreateMarcaResult');
    if (form) form.reset();
    var hab = document.getElementById('adminMarcaHabilitado');
    var vis = document.getElementById('adminMarcaVisible');
    if (hab) hab.checked = true;
    if (vis) vis.checked = true;
    if (result) {
      result.hidden = true;
      result.innerHTML = '';
    }
    clearAdminMarcaLogoPreview();
    syncMarcaPlanFromTab();
  }

  function clearAdminMarcaLogoPreview() {
    var preview = document.getElementById('adminMarcaLogoPreview');
    var logoInput = document.getElementById('adminMarcaLogo');
    if (logoInput) logoInput.value = '';
    if (preview) {
      preview.classList.remove('visible');
      preview.innerHTML = '';
    }
  }

  function bindAdminMarcaLogoPreview() {
    var logoInput = document.getElementById('adminMarcaLogo');
    var preview = document.getElementById('adminMarcaLogoPreview');
    if (!logoInput || !preview) return;

    logoInput.addEventListener('change', function () {
      var file = logoInput.files && logoInput.files[0];
      if (!file) {
        clearAdminMarcaLogoPreview();
        return;
      }
      if (!file.type || file.type.indexOf('image/') !== 0) {
        clearAdminMarcaLogoPreview();
        showError('El logo debe ser una imagen (JPG, PNG o WebP).');
        return;
      }
      readFileAsDataUrl(file).then(function (dataUrl) {
        preview.innerHTML =
          '<img src="' + dataUrl + '" alt="Vista previa del logo">' +
          '<button type="button" class="admin-btn admin-btn--secondary admin-btn--sm" id="adminMarcaLogoClear">Quitar</button>';
        preview.classList.add('visible');
        var clearBtn = document.getElementById('adminMarcaLogoClear');
        if (clearBtn) {
          clearBtn.addEventListener('click', function () {
            clearAdminMarcaLogoPreview();
          });
        }
      }).catch(function () {
        clearAdminMarcaLogoPreview();
        showError('No se pudo leer el logo.');
      });
    });
  }

  function showAdminCreateMarcaResult(html) {
    var result = document.getElementById('adminCreateMarcaResult');
    if (!result) return;
    result.innerHTML = html;
    result.hidden = false;
  }

  function tipoFromPlan(plan) {
    if (plan === 'Aliado Patrocinador') return 'aliado';
    if (plan === 'Zona Gran Reserva') return 'patrocinador';
    return 'expositor';
  }

  function bindAdminCreateMarcaForm() {
    var form = document.getElementById('formAdminCreateMarca');
    if (!form) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      showError('');

      var marca = document.getElementById('adminMarcaNombre').value.trim();
      var correo = document.getElementById('adminMarcaCorreo').value.trim().toLowerCase();
      if (!marca || !correo) {
        showError('Marca y correo son obligatorios.');
        return;
      }

      var plan = document.getElementById('adminMarcaPlan').value;
      var payload = {
        marca: marca,
        correo: correo,
        contacto: document.getElementById('adminMarcaContacto').value.trim(),
        celular: document.getElementById('adminMarcaCelular').value.trim(),
        plan: plan,
        tipoParticipante: tipoFromPlan(plan),
        standId: document.getElementById('adminMarcaStandId').value.trim(),
        ciudad: document.getElementById('adminMarcaCiudad').value.trim(),
        descripcion: document.getElementById('adminMarcaDescripcion').value.trim(),
        redSocial: document.getElementById('adminMarcaRedSocial').value,
        redEnlace: document.getElementById('adminMarcaRedUrl').value.trim(),
        habilitado: document.getElementById('adminMarcaHabilitado').checked,
        visiblePublico: document.getElementById('adminMarcaVisible').checked
      };

      var submitBtn = document.getElementById('adminMarcaSubmit');
      var logoInput = document.getElementById('adminMarcaLogo');
      var logoFile = logoInput && logoInput.files && logoInput.files[0];

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Subiendo…';
      }

      var logoPromise = logoFile
        ? readFileAsDataUrl(logoFile).then(function (dataUrl) {
          payload.logoStand = {
            nombreArchivo: logoFile.name,
            tipoArchivo: logoFile.type,
            base64: dataUrl
          };
        })
        : Promise.resolve();

      logoPromise.then(function () {
        return adminCreateStand(payload);
      }).then(function (result) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Crear marca y publicar';
        }
        if (!result || !result.ok) {
          showError((result && result.error) || 'No se pudo crear la marca. ¿Redesplegaste Code.gs con admin_create_stand?');
          return;
        }

        var perfilLink = result.perfilUrl || '';
        var panelLink = result.expositorPanelUrl || '';
        var code = result.accessCode || '';
        var html = '<p><strong>Marca creada:</strong> ' + escapeHtml(result.marca || marca) +
          ' <span class="admin-badge admin-badge--on">ID ' + escapeHtml(result.id || '') + '</span></p>';
        if (code) {
          html += '<p>Código de acceso panel expositor: <code>' + escapeHtml(code) +
            '</code> (enviado también por correo al expositor).</p>';
        }
        if (perfilLink) {
          html += '<p><a href="' + escapeHtml(perfilLink) + '" target="_blank" rel="noopener">Ver página pública</a>';
          if (panelLink) {
            html += ' · <a href="' + escapeHtml(panelLink) + '" target="_blank" rel="noopener">Panel expositor</a>';
          }
          html += '</p>';
        }
        showAdminCreateMarcaResult(html);
        resetAdminCreateMarcaForm();
        loadDashboard();
      }).catch(function (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Crear marca y publicar';
        }
        showError(err.message || 'Error al crear la marca.');
      });
    });
  }

  function patchStandVisibility(id, visible) {
    return postAdminAction({
      action: 'admin_patch_stand',
      id: id,
      visiblePublico: visible
    });
  }

  function togglePatrocinadorCompetencia(id, habilitado) {
    return postAdminAction({
      action: 'admin_toggle_patrocinador_competencia',
      id: id,
      habilitado: habilitado
    });
  }

  function savePatrocinadorCompetencia(payload) {
    return postAdminAction(Object.assign({ action: 'admin_save_patrocinador_competencia' }, payload));
  }

  function renderStatusBadge(enabled) {
    var cls = enabled ? 'admin-badge admin-badge--on' : 'admin-badge admin-badge--off';
    var label = enabled ? 'Habilitado' : 'Deshabilitado';
    return '<span class="' + cls + '">' + label + '</span>';
  }

  function renderManageableTable(rows, columns, options) {
    options = options || {};
    var dataset = options.dataset || 'stands';
    var meta = options.metaText ? '<p class="admin-table-meta">' + escapeHtml(options.metaText) + '</p>' : '';
    if (!rows || !rows.length) {
      return meta + '<p class="admin-empty">Sin registros todavía.</p>';
    }
    var cols = columns || [];
    var html = meta + '<div class="admin-table-wrap"><table class="admin-table admin-table--manage"><thead><tr>';
    cols.forEach(function (col) {
      html += '<th>' + escapeHtml(col) + '</th>';
    });
    html += '<th>Estado</th><th>Acción</th></tr></thead><tbody>';
    rows.forEach(function (row) {
      var id = row['ID'] || '';
      var enabled = isHabilitadoValue(row['Habilitado']);
      html += '<tr data-record-id="' + escapeHtml(id) + '" data-dataset="' + escapeHtml(dataset) + '">';
      cols.forEach(function (col) {
        var val = row[col] || '';
        if (isLinkColumn(col) && val && val.indexOf('http') === 0) {
          html += '<td><a href="' + escapeHtml(val) + '" target="_blank" rel="noopener">Ver</a></td>';
        } else {
          html += '<td>' + escapeHtml(val) + '</td>';
        }
      });
      html += '<td>' + renderStatusBadge(enabled) + '</td>';
      html += '<td><button type="button" class="admin-btn admin-btn--sm ' +
        (enabled ? 'admin-btn--danger' : 'admin-btn--success') +
        ' admin-toggle-status-btn" data-record-id="' + escapeHtml(id) +
        '" data-dataset="' + escapeHtml(dataset) + '" data-enabled="' + (enabled ? '0' : '1') + '">' +
        (enabled ? 'Deshabilitar' : 'Habilitar') + '</button></td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    html += '<p class="admin-table-meta">Deshabilitado: no aparece en mapa público, /marcas ni conteos públicos.</p>';
    return html;
  }

  function bindToggleStatusButtons() {
    if (document.body.getAttribute('data-admin-toggle-bound') === '1') return;
    document.body.setAttribute('data-admin-toggle-bound', '1');
    document.addEventListener('click', function (event) {
      var btn = event.target.closest('.admin-toggle-status-btn');
      if (!btn || btn.disabled) return;
      var id = btn.getAttribute('data-record-id');
      var dataset = btn.getAttribute('data-dataset');
      var enable = btn.getAttribute('data-enabled') === '1';
      if (!id || !dataset) return;
      btn.disabled = true;
      toggleRecordStatus(dataset, id, enable).then(function (result) {
        btn.disabled = false;
        if (!result.ok) {
          showError(result.error || 'No se pudo actualizar el estado.');
          return;
        }
        showError('');
        updateLocalHabilitado(dataset, id, result.habilitado || (enable ? 'Sí' : 'No'));
        renderAdminTabPanels(lastDashboardData);
        syncCompetenciaEditionUi();
      }).catch(function (err) {
        btn.disabled = false;
        showError(err.message || 'Error al actualizar el estado.');
      });
    });
  }

  function updateLocalHabilitado(dataset, id, label) {
    if (!lastDashboardData) return;
    var key = dataset === 'feria' ? 'allFeria' :
      dataset === 'competencia' ? 'allCompetencia' : 'allStands';
    var rows = lastDashboardData[key] || [];
    rows.forEach(function (row) {
      if (row['ID'] === id) row['Habilitado'] = label;
    });
  }

  function driveThumb(url, size) {
    var raw = String(url || '').trim();
    if (!raw) return '';
    var match = raw.match(/\/file\/d\/([^/]+)/) || raw.match(/[?&]id=([^&]+)/);
    if (match) return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(match[1]) + '&sz=w' + (size || 1200);
    return raw;
  }

  function driveFileId(url) {
    var raw = String(url || '').trim();
    if (!raw) return '';
    var match = raw.match(/\/file\/d\/([^/]+)/) || raw.match(/[?&]id=([^&]+)/);
    if (match && match[1]) return match[1];
    return /^[a-zA-Z0-9_-]{20,}$/.test(raw) ? raw : '';
  }

  function val(row, keys) {
    for (var i = 0; i < keys.length; i++) {
      var value = row[keys[i]];
      if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
    }
    return '';
  }

  function competitorDescription(row) {
    var parts = [];
    var representa = val(row, ['Representa']);
    var rol = val(row, ['Rol']);
    var experienciaCafe = val(row, ['Experiencia café', 'Experiencia cafe']);
    var experienciaSwitch = val(row, ['Experiencia Switch', 'Experiencia V60']);
    var ciudad = val(row, ['Ciudad']);
    var torneos = val(row, ['Torneos previos']);

    if (representa) parts.push('Representa: ' + representa);
    if (rol) parts.push('Rol: ' + rol);
    if (experienciaCafe) parts.push('Experiencia en café: ' + experienciaCafe);
    if (experienciaSwitch) parts.push('Experiencia V60: ' + experienciaSwitch);
    if (torneos) parts.push('Torneos previos: ' + torneos);
    if (ciudad) parts.push('Ciudad: ' + ciudad);
    return parts.join(' · ');
  }

  function competitorProfileLines(row) {
    var lines = [];
    var representa = val(row, ['Representa']);
    var rol = val(row, ['Rol']);
    var experienciaCafe = val(row, ['Experiencia café', 'Experiencia cafe']);
    var experienciaSwitch = val(row, ['Experiencia Switch', 'Experiencia V60']);
    var torneos = val(row, ['Torneos previos']);
    var ciudad = val(row, ['Ciudad']);

    if (rol || representa) {
      lines.push((rol || 'Competidor/a') + (representa ? ' · Representa: ' + representa : ''));
    }
    if (experienciaCafe || experienciaSwitch) {
      lines.push('Experiencia: ' + [
        experienciaCafe ? 'café ' + experienciaCafe : '',
        experienciaSwitch ? 'V60 ' + experienciaSwitch : ''
      ].filter(Boolean).join(' · '));
    }
    if (torneos) lines.push('Torneos previos: ' + torneos);
    if (ciudad) lines.push('Ciudad: ' + ciudad);

    return lines.length ? lines : ['Perfil barista registrado para el Reto V60.'];
  }

  function sanitizeFilename(name) {
    return String(name || 'competidor')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'competidor';
  }

  function loadCanvasImage(url, options) {
    options = options || {};
    return new Promise(function (resolve) {
      if (!url) {
        resolve(null);
        return;
      }
      var img = new Image();
      var objectUrl = options.revokeObjectUrl || '';
      var src = String(url);
      var isInline = src.indexOf('data:') === 0 || src.indexOf('blob:') === 0;

      img.onload = function () {
        if (objectUrl) {
          setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 2000);
        }
        resolve(img);
      };
      img.onerror = function () {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        resolve(null);
      };

      if (!isInline) img.crossOrigin = 'anonymous';
      img.src = src;
    });
  }



  function isValidFotoDataResponse(res) {
    return !!(res && res.ok && res.dataUrl && String(res.dataUrl).indexOf('base64,') > 0);
  }

  function fetchCompetitorPhotoBlobById(fileId) {
    var photoUrl = buildAdminUrl('competidor_foto', { id: fileId });
    if (!photoUrl) return Promise.resolve(null);
    return fetch(photoUrl, { method: 'GET', mode: 'cors', cache: 'no-store', redirect: 'follow' })
      .then(function (res) {
        if (!res.ok) return null;
        var type = (res.headers.get('content-type') || '').toLowerCase();
        if (type.indexOf('image/') !== 0) return null;
        return res.blob();
      })
      .catch(function () { return null; })
      .then(function (blob) {
        if (!blob || !blob.size) return null;
        var objectUrl = URL.createObjectURL(blob);
        return loadCanvasImage(objectUrl, { revokeObjectUrl: objectUrl });
      });
  }

  function loadCompetitorPhotoForCanvas(row) {
    var driveUrl = val(row, ['Foto participante enlace Drive']);
    var fileId = driveFileId(driveUrl);
    if (!fileId) return Promise.resolve(null);

    var dataUrlEndpoint = buildAdminUrl('competidor_foto_data', { id: fileId });
    if (dataUrlEndpoint) {
      return fetchJson(dataUrlEndpoint).then(function (res) {
        if (isValidFotoDataResponse(res)) {
          return loadCanvasImage(res.dataUrl);
        }
        return fetchCompetitorPhotoBlobById(fileId).then(function (img) {
          if (img) return img;
          return loadCompetitorPhotoDriveFallback(fileId, driveUrl);
        });
      });
    }
    return fetchCompetitorPhotoBlobById(fileId).then(function (img) {
      if (img) return img;
      return loadCompetitorPhotoDriveFallback(fileId, driveUrl);
    });
  }

  function loadCompetitorPhotoDriveFallback(fileId, driveUrl) {
    var urls = [
      driveThumb(driveUrl, 1600),
      'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(fileId),
      'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w1600'
    ];
    return tryLoadCanvasImageUrls(urls, 0);
  }

  function tryLoadCanvasImageUrls(urls, index) {
    if (index >= urls.length) return Promise.resolve(null);
    return loadCanvasImage(urls[index]).then(function (img) {
      if (img && img.width > 0) return img;
      return tryLoadCanvasImageUrls(urls, index + 1);
    });
  }

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawPortraitPhoto(ctx, img, x, y, w, h) {
    roundedRect(ctx, x, y, w, h, 28);
    ctx.save();
    ctx.clip();

    var bg = ctx.createLinearGradient(x, y, x + w, y + h);
    bg.addColorStop(0, '#3b291f');
    bg.addColorStop(1, '#14100d');
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);

    if (!img) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '700 40px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Foto del competidor', x + w / 2, y + h / 2);
      ctx.restore();
      return;
    }

    var scale = Math.min(w / img.width, h / img.height);
    var dw = img.width * scale;
    var dh = img.height * scale;
    var dx = x + (w - dw) / 2;
    var dy = y + (h - dh) / 2;

    if (img.height >= img.width) {
      dy = y + Math.max(0, (h - dh) * 0.28);
    }

    ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, dw, dh);
    ctx.restore();
  }

  function wrapTextCentered(ctx, text, centerX, y, maxWidth, lineHeight, maxLines) {
    var words = String(text || '').split(/\s+/).filter(Boolean);
    var line = '';
    var lines = [];
    for (var n = 0; n < words.length; n++) {
      var testLine = line ? line + ' ' + words[n] : words[n];
      if (ctx.measureText(testLine).width > maxWidth && line) {
        lines.push(line);
        line = words[n];
      } else {
        line = testLine;
      }
      if (lines.length === maxLines) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (words.length && lines.length === maxLines && lines[lines.length - 1].length > 3) {
      lines[lines.length - 1] = lines[lines.length - 1].replace(/[.,;:]?$/, '') + '…';
    }
    ctx.textAlign = 'center';
    lines.forEach(function (l, idx) {
      ctx.fillText(l, centerX, y + idx * lineHeight);
    });
    return y + lines.length * lineHeight;
  }

  function drawCover(ctx, img, x, y, w, h) {
    roundedRect(ctx, x, y, w, h, 34);
    ctx.save();
    ctx.clip();
    if (!img) {
      var grd = ctx.createLinearGradient(x, y, x + w, y + h);
      grd.addColorStop(0, '#6b4423');
      grd.addColorStop(1, '#1f130e');
      ctx.fillStyle = grd;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '700 44px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Foto del competidor', x + w / 2, y + h / 2);
    } else {
      var scale = Math.max(w / img.width, h / img.height);
      var sw = w / scale;
      var sh = h / scale;
      var sx = (img.width - sw) / 2;
      var sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    }
    ctx.restore();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    var words = String(text || '').split(/\s+/).filter(Boolean);
    var line = '';
    var lines = [];
    for (var n = 0; n < words.length; n++) {
      var testLine = line ? line + ' ' + words[n] : words[n];
      if (ctx.measureText(testLine).width > maxWidth && line) {
        lines.push(line);
        line = words[n];
      } else {
        line = testLine;
      }
      if (lines.length === maxLines) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (words.length && lines.length === maxLines && lines[lines.length - 1].length > 3) {
      lines[lines.length - 1] = lines[lines.length - 1].replace(/[.,;:]?$/, '') + '…';
    }
    lines.forEach(function (l, idx) {
      ctx.fillText(l, x, y + idx * lineHeight);
    });
    return y + lines.length * lineHeight;
  }

  var selectedCompetidorId = '';
  var dashboardCompetidorRows = [];
  var pngLayoutEditorHandle = null;

  function createCompetitorCardCanvas(row) {
    if (global.AdminCompetidorPng && global.AdminCompetidorPng.renderCanvas) {
      var layout = global.AdminCompetidorPng.loadLayout();
      return global.AdminCompetidorPng.renderCanvas(row, layout);
    }
    return loadCompetitorPhotoForCanvas(row).then(function (img) {
      var W = 1080;
      var H = 1440;
      var PAD = 48;
      var CONTENT_W = W - PAD * 2;
      var CX = W / 2;

      var canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      var ctx = canvas.getContext('2d');
      var name = val(row, ['Nombre']) || 'Competidor';
      var id = val(row, ['ID']);

      var bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#2a1a12');
      bg.addColorStop(0.5, '#4a2f18');
      bg.addColorStop(1, '#120d0a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.arc(W - 60, 100, 220, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(70, H - 80, 200, 0, Math.PI * 2);
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#f6ead8';
      ctx.font = '800 42px Inter, Arial, sans-serif';
      ctx.fillText('RETO V60', CX, 72);

      ctx.font = '600 26px Inter, Arial, sans-serif';
      ctx.fillStyle = 'rgba(246,234,216,0.78)';
      ctx.fillText('Edición Purist Marbella', CX, 108);

      ctx.fillStyle = '#e8a84c';
      ctx.font = '700 22px Inter, Arial, sans-serif';
      ctx.fillText(id || 'Competidor', CX, 138);

      var photoY = 158;
      var photoH = 920;
      drawPortraitPhoto(ctx, img, PAD, photoY, CONTENT_W, photoH);

      var textY = photoY + photoH + 44;
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 62px Inter, Arial, sans-serif';
      var afterName = wrapTextCentered(ctx, name, CX, textY, CONTENT_W, 66, 2);

      ctx.fillStyle = '#f5d9a8';
      ctx.font = '700 28px Inter, Arial, sans-serif';
      ctx.fillText('Competidor oficial', CX, afterName + 20);

      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.font = '600 24px Inter, Arial, sans-serif';
      ctx.fillText('Perfil del barista', CX, afterName + 64);

      var profileY = afterName + 98;
      competitorProfileLines(row).slice(0, 4).forEach(function (line) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = '500 24px Inter, Arial, sans-serif';
        profileY = wrapTextCentered(ctx, line, CX, profileY, CONTENT_W - 40, 32, 2) + 8;
      });

      var footerY = H - 68;
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      roundedRect(ctx, PAD, footerY - 36, CONTENT_W, 56, 18);
      ctx.fill();
      ctx.fillStyle = '#f6ead8';
      ctx.font = '700 24px Inter, Arial, sans-serif';
      ctx.fillText('Café filtrado · Plaza Marbella · Purist', CX, footerY);

      return canvas;
    });
  }

  function getCompetidorPreviewRow() {
    var id = selectedCompetidorId;
    if (!id) {
      var idEl = document.getElementById('competidorEditId');
      id = idEl ? idEl.value.trim() : '';
    }
    if (id) {
      var row = findCompetidorRowById(id);
      if (row) return row;
    }
    var rows = pickCompetenciaRows(lastDashboardData || {});
    for (var i = 0; i < rows.length; i++) {
      if (isHabilitadoValue(rows[i]['Habilitado']) && val(rows[i], ['Foto participante enlace Drive'])) {
        return rows[i];
      }
    }
    if (rows.length) return rows[0];
    if (global.AdminCompetidorPng && global.AdminCompetidorPng.sampleRow) {
      return global.AdminCompetidorPng.sampleRow();
    }
    return null;
  }

  function paintCompetidorEditorPngCanvas(row, layout) {
    var canvasEl = document.getElementById('competidorEditorPngCanvas');
    if (!canvasEl || !row || !global.AdminCompetidorPng) return;
    var activeLayout = layout ||
      (pngLayoutEditorHandle && pngLayoutEditorHandle.getLayout
        ? pngLayoutEditorHandle.getLayout()
        : null);
    global.AdminCompetidorPng.renderCanvas(row, activeLayout).then(function (source) {
      var ctx = canvasEl.getContext('2d');
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      ctx.drawImage(source, 0, 0, canvasEl.width, canvasEl.height);
    }).catch(function () { /* sin foto */ });
  }

  function updateCompetidorPngPreview(row) {
    if (!row || !global.AdminCompetidorPng) return;
    if (pngLayoutEditorHandle && pngLayoutEditorHandle.setPreviewRow) {
      pngLayoutEditorHandle.setPreviewRow(row);
    }
    paintCompetidorEditorPngCanvas(row);
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function downloadAllCompetitorPngsSequential() {
    var rowsNow = pickCompetenciaRows(lastDashboardData || {}).filter(function (row) {
      return isHabilitadoValue(row['Habilitado']);
    });
    if (!rowsNow.length) {
      return Promise.reject(new Error('No hay competidores habilitados para generar PNG.'));
    }
    return rowsNow.reduce(function (chain, row) {
      return chain.then(function () {
        return createCompetitorCardCanvas(row).then(function (canvas) {
          var name = sanitizeFilename(val(row, ['Nombre']));
          downloadCanvas(canvas, 'reto-v60-purist-marbella-' + name + '.png');
        });
      }).then(function () {
        return new Promise(function (resolve) { setTimeout(resolve, 400); });
      });
    }, Promise.resolve()).then(function () {
      return rowsNow.length;
    });
  }

  function downloadAllCompetitorPngsAsZip() {
    if (typeof global.JSZip === 'undefined') {
      return Promise.reject(new Error('JSZip no cargó. Recarga el admin (Ctrl+Shift+R).'));
    }
    var rowsNow = pickCompetenciaRows(lastDashboardData || {}).filter(function (row) {
      return isHabilitadoValue(row['Habilitado']);
    });
    if (!rowsNow.length) {
      return Promise.reject(new Error('No hay competidores habilitados para generar PNG.'));
    }
    var zip = new global.JSZip();
    var withPhoto = 0;
    return rowsNow.reduce(function (chain, row) {
      return chain.then(function () {
        return createCompetitorCardCanvas(row).then(function (canvas) {
          return new Promise(function (resolve, reject) {
            canvas.toBlob(function (blob) {
              if (!blob) {
                reject(new Error('No se pudo generar PNG para ' + (val(row, ['Nombre']) || 'competidor')));
                return;
              }
              if (val(row, ['Foto participante enlace Drive'])) withPhoto += 1;
              var name = sanitizeFilename(val(row, ['Nombre']));
              zip.file('reto-v60-minimal-' + name + '.png', blob);
              resolve();
            }, 'image/png', 0.95);
          });
        });
      });
    }, Promise.resolve()).then(function () {
      return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    }).then(function (zipBlob) {
      var stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(zipBlob, 'competidores-v60-minimal-' + stamp + '.zip');
      return { count: rowsNow.length, withPhoto: withPhoto };
    }).then(function (stats) {
      return stats.count;
    });
  }

  function applyMinimalTemplateAndDownloadZip(button) {
    if (!global.AdminCompetidorPng) {
      return Promise.reject(new Error('Editor PNG no disponible.'));
    }
    var layout = global.AdminCompetidorPng.getTemplate('minimal-center');
    layout.templateId = 'minimal-center';
    global.AdminCompetidorPng.saveLayout(layout);
    if (pngLayoutEditorHandle && pngLayoutEditorHandle.applyTemplate) {
      pngLayoutEditorHandle.applyTemplate('minimal-center');
    }
    if (button) {
      button.disabled = true;
      button.textContent = 'Generando ZIP…';
    }
    return downloadAllCompetitorPngsAsZip().finally(function () {
      if (button) {
        button.disabled = false;
        button.textContent = 'Minimal: descargar ZIP todas';
      }
    });
  }

  function mountCompetidorPngLayoutEditor() {
    var root = document.getElementById('competidorPngLayoutRoot');
    if (!root || !global.AdminCompetidorPng || root.getAttribute('data-mounted') === '1') return;
    root.setAttribute('data-mounted', '1');
    global.AdminCompetidorPng.init({
      buildAdminUrl: buildAdminUrl,
      fetchJson: fetchJson,
      loadPhoto: loadCompetitorPhotoForCanvas
    });
    pngLayoutEditorHandle = global.AdminCompetidorPng.mountEditor(root, {
      getPreviewRow: getCompetidorPreviewRow,
      onGenerateAll: downloadAllCompetitorPngsSequential,
      onDownloadZip: downloadAllCompetitorPngsAsZip,
      onLayoutChange: function (layout, row) {
        paintCompetidorEditorPngCanvas(row || getCompetidorPreviewRow(), layout);
      }
    });
  }

  function bindCompetidorMinimalZipButton() {
    function onClick(btn) {
      applyMinimalTemplateAndDownloadZip(btn).catch(function (err) {
        alert(err.message || 'No se pudo generar el ZIP.');
      });
    }
    ['competidorMinimalZipBtn', 'competidorMinimalZipBtnQuick'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn || btn.getAttribute('data-bound') === '1') return;
      btn.setAttribute('data-bound', '1');
      btn.addEventListener('click', function () { onClick(btn); });
    });
  }

  function downloadCanvas(canvas, filename) {
    try {
      canvas.toBlob(function (blob) {
        if (!blob) {
          alert('No se pudo generar la imagen. Si la foto de Drive bloquea la descarga, abre la foto en Drive y vuelve a intentar.');
          return;
        }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      }, 'image/png', 0.95);
    } catch (err) {
      alert('No se pudo descargar el PNG por permisos de la foto. Prueba con una foto pública en Drive.');
    }
  }

  function downloadCompetitorCard(row, button) {
    if (button) {
      button.disabled = true;
      button.textContent = 'Generando…';
    }
    createCompetitorCardCanvas(row).then(function (canvas) {
      var name = sanitizeFilename(val(row, ['Nombre']));
      downloadCanvas(canvas, 'reto-v60-purist-marbella-' + name + '.png');
    }).catch(function (err) {
      console.error(err);
      alert('No se pudo generar el PNG con foto. Recarga el admin e intenta de nuevo.');
    }).finally(function () {
      if (button) {
        button.disabled = false;
        button.textContent = 'PNG';
      }
    });
  }

  function renderCompetidorHeroInner(row) {
    var photo = driveThumb(val(row, ['Foto participante enlace Drive']), 900);
    var name = val(row, ['Nombre']) || 'Competidor';
    var id = val(row, ['ID']);
    var rol = val(row, ['Rol']);
    var representa = val(row, ['Representa']);
    var desc = competitorDescription(row) || 'Perfil barista del Reto V60.';
    var enabled = isHabilitadoValue(row['Habilitado']);
    var roleLine = (rol || 'Competidor/a') + (representa ? ' · ' + representa : '');

    return '<div class="admin-competidor-hero__head admin-competidor-hero__head--center">' +
        '<p class="admin-competidor-hero__kicker">Reto V60</p>' +
        '<p class="admin-competidor-hero__edition">Edición Purist Marbella · Instagram 3:4</p>' +
        '<p class="admin-competidor-hero__id">' + escapeHtml(id || '') + '</p>' +
      '</div>' +
      '<div class="admin-competidor-hero__photo-wrap">' +
        (photo
          ? '<img class="admin-competidor-hero__photo" src="' + escapeHtml(photo) + '" alt="Foto de ' + escapeHtml(name) + '" loading="lazy" referrerpolicy="no-referrer">'
          : '<div class="admin-competidor-hero__photo admin-competidor-hero__photo--empty">Sin foto</div>') +
      '</div>' +
      '<div class="admin-competidor-hero__body">' +
        '<h3 class="admin-competidor-hero__name">' + escapeHtml(name) + '</h3>' +
        '<p class="admin-competidor-hero__role">' + escapeHtml(roleLine) + '</p>' +
        '<p class="admin-competidor-hero__desc">' + escapeHtml(desc) + '</p>' +
        '<p class="admin-competidor-hero__status">' +
          renderStatusBadge(enabled) +
          '<span>' + escapeHtml(val(row, ['Estado pago']) || 'Sin estado de pago') + '</span>' +
        '</p>' +
      '</div>';
  }

  function findCompetidorRowById(id) {
    if (!id || !lastDashboardData) return null;
    var rows = lastDashboardData.allCompetencia || pickRows(lastDashboardData, 'allCompetencia');
    for (var i = 0; i < rows.length; i++) {
      if (rows[i]['ID'] === id) return rows[i];
    }
    return null;
  }

  function updateLocalCompetidor(updatedRow) {
    if (!lastDashboardData || !updatedRow || !updatedRow['ID']) return;
    var rows = lastDashboardData.allCompetencia || [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i]['ID'] === updatedRow['ID']) {
        rows[i] = Object.assign({}, rows[i], updatedRow);
        break;
      }
    }
  }

  function renderCompetidorDashboard(rows) {
    var root = document.getElementById('competidorDashboardRoot');
    if (!root) return;

    dashboardCompetidorRows = (rows || []).slice().sort(function (a, b) {
      var an = String(a['Nombre'] || '');
      var bn = String(b['Nombre'] || '');
      return an.localeCompare(bn, 'es');
    });

    if (!dashboardCompetidorRows.length) {
      root.innerHTML = '<p class="admin-empty">Aún no hay competidores registrados. Crea uno arriba o espera inscripciones del formulario.</p>';
      return;
    }

    root.innerHTML = dashboardCompetidorRows.map(function (row) {
      var id = val(row, ['ID']);
      var selected = id && id === selectedCompetidorId ? ' admin-competidor-hero--selected' : '';
      return '<button type="button" class="admin-competidor-hero' + selected + '" data-competidor-id="' + escapeHtml(id) + '">' +
        renderCompetidorHeroInner(row) +
        '<div class="admin-competidor-hero__actions">' +
          '<span class="admin-btn admin-btn--primary admin-btn--sm">Editar perfil</span>' +
        '</div>' +
      '</button>';
    }).join('');

    root.querySelectorAll('.admin-competidor-hero[data-competidor-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-competidor-id');
        var row = findCompetidorRowById(id);
        if (row) openCompetidorEditor(row);
      });
    });
  }

  function updateCompetidorEditorPreview(row) {
    var preview = document.getElementById('competidorEditorPreview');
    if (!preview || !row) return;
    preview.innerHTML = renderCompetidorHeroInner(row);
    preview.className = 'admin-competidor-hero admin-competidor-hero--editor';
    preview.hidden = false;
    updateCompetidorPngPreview(row);
  }

  function fillCompetidorEditorForm(row) {
    if (!row) return;
    document.getElementById('competidorEditId').value = row['ID'] || '';
    document.getElementById('competidorEditNombre').value = row['Nombre'] || '';
    document.getElementById('competidorEditDocumento').value = row['Documento'] || '';
    document.getElementById('competidorEditEdad').value = row['Edad'] || '';
    document.getElementById('competidorEditCorreo').value = row['Correo'] || '';
    document.getElementById('competidorEditCelular').value = row['Celular'] || '';
    document.getElementById('competidorEditCiudad').value = row['Ciudad'] || '';
    document.getElementById('competidorEditRepresenta').value = row['Representa'] || '';
    document.getElementById('competidorEditRol').value = row['Rol'] || '';
    document.getElementById('competidorEditExpCafe').value = val(row, ['Experiencia café', 'Experiencia cafe']);
    document.getElementById('competidorEditExpV60').value = val(row, ['Experiencia Switch', 'Experiencia V60']);
    document.getElementById('competidorEditTorneos').value = row['Torneos previos'] || '';
    document.getElementById('competidorEditFotoEnlace').value = row['Foto participante enlace Drive'] || '';
    document.getElementById('competidorEditEstadoPago').value = row['Estado pago'] || 'Confirmado por admin';
    document.getElementById('competidorEditCupoConfirmado').checked = isHabilitadoValue(row['Cupo confirmado']);
    document.getElementById('competidorEditHabilitado').checked = isHabilitadoValue(row['Habilitado']);
    document.getElementById('competidorEditObservaciones').value = row['Observaciones'] || '';
    document.getElementById('competidorEditNotas').value = row['Notas admin'] || '';
    var fileInput = document.getElementById('competidorEditFotoFile');
    if (fileInput) fileInput.value = '';

    var meta = document.getElementById('competidorEditorMeta');
    if (meta) {
      meta.textContent = 'Editando: ' + (row['Nombre'] || 'Competidor') + ' · ID ' + (row['ID'] || '');
    }
  }

  function openCompetidorEditor(row) {
    if (!row) return;
    selectedCompetidorId = row['ID'] || '';
    renderCompetidorDashboard(pickCompetenciaRows(lastDashboardData || {}));

    var panel = document.getElementById('competidorEditorPanel');
    if (panel) panel.hidden = false;
    if (global.AdminDisclosures && global.AdminDisclosures.openFold) {
      global.AdminDisclosures.openFold('competidorEditorPanel');
    }

    fillCompetidorEditorForm(row);
    updateCompetidorEditorPreview(row);

    var resultEl = document.getElementById('competidorEditorResult');
    if (resultEl) resultEl.hidden = true;

    scrollToAdminTarget('competidorEditorPanel');
  }

  function closeCompetidorEditor() {
    selectedCompetidorId = '';
    var panel = document.getElementById('competidorEditorPanel');
    if (panel) panel.hidden = true;
    renderCompetidorDashboard(pickCompetenciaRows(lastDashboardData || {}));
  }

  function bindCompetidorEditorForm() {
    var form = document.getElementById('formAdminEditCompetidor');
    if (!form || form.getAttribute('data-bound') === '1') return;
    form.setAttribute('data-bound', '1');

    var closeBtn = document.getElementById('competidorEditorClose');
    if (closeBtn) closeBtn.addEventListener('click', closeCompetidorEditor);

    var pngBtn = document.querySelector('.admin-competidor-png-editor');
    if (pngBtn) {
      pngBtn.addEventListener('click', function () {
        var id = document.getElementById('competidorEditId').value.trim();
        var row = findCompetidorRowById(id);
        if (row) downloadCompetitorCard(row, pngBtn);
      });
    }

    var previewFields = [
      'competidorEditNombre', 'competidorEditRepresenta', 'competidorEditRol',
      'competidorEditExpCafe', 'competidorEditExpV60', 'competidorEditTorneos',
      'competidorEditCiudad', 'competidorEditFotoEnlace'
    ];
    previewFields.forEach(function (fieldId) {
      var el = document.getElementById(fieldId);
      if (!el) return;
      el.addEventListener('input', function () {
        var id = document.getElementById('competidorEditId').value.trim();
        if (!id) return;
        var base = findCompetidorRowById(id);
        if (!base) return;
        var draft = Object.assign({}, base, {
          'Nombre': document.getElementById('competidorEditNombre').value.trim(),
          'Representa': document.getElementById('competidorEditRepresenta').value.trim(),
          'Rol': document.getElementById('competidorEditRol').value.trim(),
          'Experiencia café': document.getElementById('competidorEditExpCafe').value.trim(),
          'Experiencia Switch': document.getElementById('competidorEditExpV60').value.trim(),
          'Torneos previos': document.getElementById('competidorEditTorneos').value.trim(),
          'Ciudad': document.getElementById('competidorEditCiudad').value.trim(),
          'Foto participante enlace Drive': document.getElementById('competidorEditFotoEnlace').value.trim()
        });
        updateCompetidorEditorPreview(draft);
      });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      showError('');

      var id = document.getElementById('competidorEditId').value.trim();
      if (!id) {
        showError('Selecciona un competidor en el dashboard.');
        return;
      }

      var nombre = document.getElementById('competidorEditNombre').value.trim();
      var correo = document.getElementById('competidorEditCorreo').value.trim().toLowerCase();
      var celular = document.getElementById('competidorEditCelular').value.trim();
      if (!nombre || !correo || !celular) {
        showError('Nombre, correo y celular son obligatorios.');
        return;
      }

      var submitBtn = document.getElementById('competidorEditSubmit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando…';
      }

      var payload = {
        id: id,
        nombre: nombre,
        documento: document.getElementById('competidorEditDocumento').value.trim(),
        edad: document.getElementById('competidorEditEdad').value.trim(),
        correo: correo,
        celular: celular,
        ciudad: document.getElementById('competidorEditCiudad').value.trim(),
        representa: document.getElementById('competidorEditRepresenta').value.trim(),
        rol: document.getElementById('competidorEditRol').value.trim(),
        experienciaCafe: document.getElementById('competidorEditExpCafe').value.trim(),
        experienciaSwitch: document.getElementById('competidorEditExpV60').value.trim(),
        torneosPrevios: document.getElementById('competidorEditTorneos').value.trim(),
        fotoEnlace: document.getElementById('competidorEditFotoEnlace').value.trim(),
        estadoPago: document.getElementById('competidorEditEstadoPago').value,
        cupoConfirmado: document.getElementById('competidorEditCupoConfirmado').checked,
        habilitado: document.getElementById('competidorEditHabilitado').checked,
        observaciones: document.getElementById('competidorEditObservaciones').value.trim(),
        notasAdmin: document.getElementById('competidorEditNotas').value.trim()
      };

      var fileInput = document.getElementById('competidorEditFotoFile');
      var file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
      var saveFlow = file
        ? readFileAsDataUrl(file).then(function (dataUrl) {
            payload.fotoBase64 = dataUrl;
            payload.fotoNombre = file.name;
            payload.fotoTipo = file.type || 'image/jpeg';
            return adminSaveCompetidor(payload);
          })
        : Promise.resolve(adminSaveCompetidor(payload));

      saveFlow.then(function (result) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Guardar perfil';
        }
        if (!result || !result.ok) {
          var err = (result && result.error) || 'No se pudo guardar el competidor.';
          if (err.indexOf('admin_save_competidor') !== -1 || err.indexOf('formType') !== -1) {
            showError('Redespliega Apps Script con la acción admin_save_competidor (py tools/setup_admin.py).');
          } else {
            showError(err);
          }
          return;
        }

        var updated = result.competidor || null;
        if (updated) {
          updateLocalCompetidor(updated);
          openCompetidorEditor(updated);
        } else {
          loadDashboard();
        }

        var resultEl = document.getElementById('competidorEditorResult');
        if (resultEl) {
          resultEl.innerHTML = '<p><strong>Perfil actualizado:</strong> ' + escapeHtml(nombre) + '</p>';
          resultEl.hidden = false;
        }

        renderAdminTabPanels(lastDashboardData);
        showError('');
      }).catch(function (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Guardar perfil';
        }
        showError(err.message || 'Error al guardar el competidor.');
      });
    });
  }

  function renderCompetitorCards(rows) {
    var root = document.getElementById('competidorCardsRoot');
    if (!root) return;
    var enabledRows = (rows || []).filter(function (row) {
      return isHabilitadoValue(row['Habilitado']);
    });
    if (!enabledRows.length) {
      root.innerHTML = '<p class="admin-empty">Aún no hay competidores habilitados para generar imágenes.</p>';
      return;
    }
    root.innerHTML = enabledRows.map(function (row, idx) {
      var photo = driveThumb(val(row, ['Foto participante enlace Drive']), 600);
      var name = val(row, ['Nombre']) || 'Competidor';
      var desc = competitorDescription(row) || 'Participante del reto de café filtrado.';
      return '<article class="admin-competitor-card">' +
        (photo
          ? '<img class="admin-competitor-card__photo" src="' + escapeHtml(photo) + '" alt="Foto de ' + escapeHtml(name) + '" loading="lazy" referrerpolicy="no-referrer">'
          : '<div class="admin-competitor-card__photo" aria-hidden="true"></div>') +
        '<div class="admin-competitor-card__body">' +
          '<h5>' + escapeHtml(name) + '</h5>' +
          '<p>' + escapeHtml(desc) + '</p>' +
          '<div class="admin-competitor-card__actions">' +
            '<button type="button" class="admin-btn admin-btn--primary admin-competitor-png" data-competitor-idx="' + idx + '">PNG</button>' +
            (photo ? '<a class="admin-btn admin-btn--secondary" href="' + escapeHtml(val(row, ['Foto participante enlace Drive'])) + '" target="_blank" rel="noopener">Foto</a>' : '') +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');

    root.querySelectorAll('.admin-competitor-png').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-competitor-idx'), 10);
        downloadCompetitorCard(enabledRows[idx], btn);
      });
    });

    var allBtn = document.getElementById('downloadCompetitorCardsBtn');
    if (allBtn && allBtn.getAttribute('data-bound') !== '1') {
      allBtn.setAttribute('data-bound', '1');
      allBtn.addEventListener('click', function () {
        allBtn.disabled = true;
        allBtn.textContent = 'Generando…';
        downloadAllCompetitorPngsSequential().catch(function (err) {
          alert(err.message || 'No se pudieron generar los PNG.');
        }).finally(function () {
          allBtn.disabled = false;
          allBtn.textContent = 'Descargar todas';
        });
      });
    }
  }

  function renderAdminTabPanels(data) {
    if (!data) return;

    var feriaRows = pickRows(data, 'allFeria');
    var compRows = pickCompetenciaRows(data);
    var standsRows = pickRows(data, 'allStands');

    var panelComp = document.getElementById('adminTabPanelsCompetencia');
    if (panelComp) {
      panelComp.innerHTML = '<div class="admin-tab-panel" role="tabpanel">' +
        renderManageableTable(compRows, data.competenciaColumns || DEFAULT_COMP_COLS, {
          dataset: 'competencia',
          metaText: compRows.length + ' competidores · ' + getCompetenciaEditionLabel(activeCompetenciaEdition) + ' — más recientes primero.'
        }) + '</div>';
    }

    renderCompetidorDashboard(compRows);
    renderCompetitorCards(compRows);
    if (pngLayoutEditorHandle && pngLayoutEditorHandle.setPreviewRow) {
      var previewRow = getCompetidorPreviewRow();
      if (previewRow) pngLayoutEditorHandle.setPreviewRow(previewRow);
    }

    var panelFeria = document.getElementById('adminTabPanelsFeria');
    if (panelFeria) {
      panelFeria.innerHTML = '<div class="admin-tab-panel" role="tabpanel">' +
        renderManageableTable(feriaRows, data.feriaColumns || DEFAULT_FERIA_COLS, {
          dataset: 'feria',
          metaText: feriaRows.length + ' visitantes registrados.'
        }) + '</div>';
    }

    var panelStands = document.getElementById('adminTabPanels');
    if (panelStands) {
      var sectionRows = filterStandsBySection(standsRows, activeAdminTab);
      var sectionLabels = {
        expositores: 'Stands / expositores (Zona Origen)',
        aliados: 'Aliados (Aliado Patrocinador)',
        patrocinadores: 'Patrocinadores (Zona Gran Reserva)'
      };
      panelStands.innerHTML = '<div class="admin-tab-panel" role="tabpanel">' +
        renderManageableTable(sectionRows, data.standsColumns || DEFAULT_STANDS_COLS, {
          dataset: 'stands',
          metaText: sectionRows.length + ' registros — ' + (sectionLabels[activeAdminTab] || activeAdminTab)
        }) + '</div>';
    }

    var directorio = document.getElementById('tableDirectorio');
    if (directorio) {
      directorio.innerHTML = renderDirectorioTable(standsRows);
      bindDirectorioToggles();
    }

    bindToggleStatusButtons();
  }

  function bindAdminTabs() {
    document.querySelectorAll('[data-admin-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        activeAdminTab = tab.getAttribute('data-admin-tab') || 'expositores';
        syncAdminTabUi();
        saveAdminUiState();
        renderAdminTabPanels(lastDashboardData);
        syncMarcaPlanFromTab();
      });
    });
  }

  function showAdminSection(section) {
    if (ADMIN_SECTIONS.indexOf(section) === -1) section = 'resumen';
    activeAdminSection = section;

    document.querySelectorAll('[data-admin-section]').forEach(function (btn) {
      var active = btn.getAttribute('data-admin-section') === section;
      btn.classList.toggle('admin-nav__item--active', active);
    });

    document.querySelectorAll('[data-admin-section-panel]').forEach(function (panel) {
      var show = panel.getAttribute('data-admin-section-panel') === section;
      panel.hidden = !show;
    });

    if (section === 'stands') {
      syncAdminTabUi();
      syncMarcaPlanFromTab();
    }

    if (section === 'pasaportes' && global.AdminPasaportes && global.AdminPasaportes.onShow) {
      global.AdminPasaportes.onShow();
      loadFidEmbed();
    }
    if (section === 'operadores' && global.AdminOperadores && global.AdminOperadores.onShow) {
      global.AdminOperadores.onShow();
    }

    saveAdminUiState();

    var main = document.querySelector('.admin-main');
    if (main && typeof main.scrollTo === 'function') {
      main.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (global.history && global.history.replaceState) {
      var nextHash = section === 'resumen' ? '#resumen' : '#' + section;
      global.history.replaceState(null, '', nextHash);
    }
  }

  function scrollToAdminTarget(targetId) {
    if (!targetId) return;
    var target = document.getElementById(targetId);
    if (!target) return;
    setTimeout(function () {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.classList.add('admin-highlight-target');
      setTimeout(function () { target.classList.remove('admin-highlight-target'); }, 1400);
    }, 80);
  }

  function downloadAllCompetitorCardsFromToolbar() {
    var btn = document.getElementById('downloadCompetitorCardsBtn');
    if (btn) {
      btn.click();
      return;
    }
    showAdminSection('competidores');
    setTimeout(function () {
      var delayed = document.getElementById('downloadCompetitorCardsBtn');
      if (delayed) delayed.click();
    }, 200);
  }

  function readHashSection() {
    var hash = (global.location.hash || '').replace(/^#/, '').trim().toLowerCase();
    if (hash && ADMIN_SECTIONS.indexOf(hash) !== -1) return hash;
    try {
      var stored = sessionStorage.getItem(ADMIN_SECTION_KEY);
      if (stored && ADMIN_SECTIONS.indexOf(stored) !== -1) return stored;
    } catch (e) { /* ignore */ }
    return 'resumen';
  }

  function loadFidEmbed() {
    var iframe = document.getElementById('adminFidIframe');
    var hint = document.getElementById('adminPasBackendHint');
    if (!iframe) return;
    var src = global.SiteLinks ? global.SiteLinks.href('panelFidelizacion') : 'dashboard-fidelizacion.html';
    if (iframe.getAttribute('data-loaded') !== '1') {
      iframe.src = src;
      iframe.setAttribute('data-loaded', '1');
    }
    if (global.Fidelizacion && global.Fidelizacion.probePasaportesBackend) {
      global.Fidelizacion.probePasaportesBackend().then(function (probe) {
        if (hint) {
          hint.textContent = probe.ready
            ? probe.message
            : probe.message + ' El panel embebido puede mostrar datos vacíos hasta el redeploy.';
        }
      });
    } else if (global.Fidelizacion && global.Fidelizacion.initBackend) {
      global.Fidelizacion.initBackend().then(function (mode) {
        if (hint) {
          hint.textContent = mode === 'firestore'
            ? 'Backend: Firestore (tiempo real).'
            : 'Backend: Google Sheets (respaldo automático — redepliega Code.gs para sincronizar).';
        }
      });
    }
  }

  function bindAdminNav() {
    document.querySelectorAll('[data-admin-section]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showAdminSection(btn.getAttribute('data-admin-section') || 'resumen');
      });
    });

    document.querySelectorAll('.admin-goto-section').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showAdminSection(btn.getAttribute('data-goto') || 'resumen');
        scrollToAdminTarget(btn.getAttribute('data-scroll-target') || '');
      });
    });

    document.querySelectorAll('.admin-scroll-target').forEach(function (btn) {
      btn.addEventListener('click', function () {
        scrollToAdminTarget(btn.getAttribute('data-scroll-target') || '');
      });
    });

    document.querySelectorAll('.admin-download-competitor-cards').forEach(function (btn) {
      btn.addEventListener('click', downloadAllCompetitorCardsFromToolbar);
    });

    global.addEventListener('hashchange', function () {
      showAdminSection(readHashSection());
    });
  }

  function renderDirectorioTable(rows) {
    if (!rows || !rows.length) {
      return '<p class="admin-empty">Sin solicitudes de stand todavía.</p>';
    }

    var html = '<div class="admin-table-wrap"><table class="admin-table admin-table--directorio"><thead><tr>';
    html += '<th>Marca</th><th>Tipo</th><th>Stand</th><th>Red social</th><th>Habilitado</th><th>Visible en /marcas</th>';
    html += '</tr></thead><tbody>';

    rows.forEach(function (row) {
      var id = row['ID'] || '';
      var visible = isVisiblePublicoValue(row['Visible directorio público']);
      var habilitado = isHabilitadoValue(row['Habilitado']);
      var redUrl = row['Red social enlace'] || '';
      var redSocial = row['Red social preferida'] || '';
      html += '<tr data-stand-id="' + escapeHtml(id) + '">';
      html += '<td>' + escapeHtml(row['Marca o negocio'] || '');
      if (id && global.SiteLinks) {
        html += ' <a class="admin-table__link" href="' + escapeHtml(global.SiteLinks.absUrl('marcas') + '/' + encodeURIComponent(id)) +
          '" target="_blank" rel="noopener">Ver perfil</a>';
      }
      html += '</td>';
      html += '<td>' + escapeHtml(row['Tipo participante'] || '') + '</td>';
      html += '<td>' + escapeHtml(row['Stand ID'] || '—') + '</td>';
      html += '<td>';
      if (redUrl && redUrl.indexOf('http') === 0) {
        html += '<a href="' + escapeHtml(redUrl) + '" target="_blank" rel="noopener">' +
          escapeHtml(redSocial || 'Ver') + '</a>';
      } else {
        html += escapeHtml(redSocial || '—');
      }
      html += '</td>';
      html += '<td>' + renderStatusBadge(habilitado);
      if (id) {
        html += ' <button type="button" class="admin-btn admin-btn--sm ' +
          (habilitado ? 'admin-btn--danger' : 'admin-btn--success') +
          ' admin-toggle-status-btn" data-record-id="' + escapeHtml(id) +
          '" data-dataset="stands" data-enabled="' + (habilitado ? '0' : '1') + '">' +
          (habilitado ? 'Deshabilitar' : 'Habilitar') + '</button>';
      }
      html += '</td>';
      html += '<td><label class="admin-toggle"><input type="checkbox" class="admin-visibility-toggle" data-stand-id="' +
        escapeHtml(id) + '"' + (visible ? ' checked' : '') + '> Mostrar</label></td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    html += '<p class="admin-table-meta">Habilitado controla mapa y conteos públicos. Visible controla solo el directorio /marcas.</p>';
    return html;
  }

  function bindDirectorioToggles() {
    document.querySelectorAll('.admin-visibility-toggle').forEach(function (input) {
      input.addEventListener('change', function () {
        var id = input.getAttribute('data-stand-id');
        if (!id) return;
        input.disabled = true;
        patchStandVisibility(id, input.checked).then(function (result) {
          input.disabled = false;
          if (!result.ok) {
            input.checked = !input.checked;
            showError(result.error || 'No se pudo actualizar la visibilidad.');
            return;
          }
          showError('');
          if (lastDashboardData && lastDashboardData.allStands) {
            lastDashboardData.allStands.forEach(function (row) {
              if (row['ID'] === id) {
                row['Visible directorio público'] = result.visiblePublico || (input.checked ? 'Sí' : 'No');
              }
            });
          }
        });
      });
    });
  }

  function renderPatrocinadoresCompetenciaTable(rows) {
    if (!rows || !rows.length) {
      return '<p class="admin-empty">Sin patrocinadores de competencia. Usa el formulario para añadir el primero.</p>';
    }

    var sorted = rows.slice().sort(function (a, b) {
      var oa = parseInt(a['Orden'], 10) || 9999;
      var ob = parseInt(b['Orden'], 10) || 9999;
      if (oa !== ob) return oa - ob;
      return String(a['Nombre'] || '').localeCompare(String(b['Nombre'] || ''), 'es');
    });

    var html = '<div class="admin-table-wrap"><table class="admin-table admin-table--patrocinadores-comp"><thead><tr>';
    html += '<th>Logo</th><th>Nombre</th><th>Instagram</th><th>Enlace</th><th>Orden</th><th>Habilitado</th><th></th>';
    html += '</tr></thead><tbody>';

    sorted.forEach(function (row) {
      var id = row['ID'] || '';
      var enabled = isHabilitadoValue(row['Habilitado']);
      var logo = row['Logo enlace'] || '';
      var redUrl = row['Red social enlace'] || '';
      html += '<tr data-patrocinador-id="' + escapeHtml(id) + '">';
      html += '<td>';
      if (logo && logo.indexOf('http') === 0) {
        html += '<img class="admin-table__logo-thumb" src="' + escapeHtml(logo) + '" alt="" loading="lazy">';
      } else if (logo) {
        html += '<span class="admin-table-meta">' + escapeHtml(logo) + '</span>';
      } else {
        html += '—';
      }
      html += '</td>';
      html += '<td>' + escapeHtml(row['Nombre'] || '') + '</td>';
      html += '<td>' + escapeHtml(row['Instagram handle'] || '—') + '</td>';
      html += '<td>';
      if (redUrl && redUrl.indexOf('http') === 0) {
        html += '<a href="' + escapeHtml(redUrl) + '" target="_blank" rel="noopener">Ver</a>';
      } else {
        html += '—';
      }
      html += '</td>';
      html += '<td>' + escapeHtml(row['Orden'] || '') + '</td>';
      html += '<td><label class="admin-toggle"><input type="checkbox" class="admin-patrocinador-toggle" data-patrocinador-id="' +
        escapeHtml(id) + '"' + (enabled ? ' checked' : '') + '> Mostrar</label></td>';
      html += '<td><button type="button" class="admin-btn admin-btn--secondary admin-btn--sm admin-patrocinador-edit" data-patrocinador-id="' +
        escapeHtml(id) + '">Editar</button></td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    html += '<p class="admin-table-meta">Los habilitados aparecen en inicio (/) y competencia. Purist y Palmetto se crean al ejecutar sincronizarEncabezados().</p>';
    return html;
  }

  function resetPatrocinadorCompetenciaForm() {
    var editId = document.getElementById('patrocinadorCompetenciaEditId');
    var form = document.getElementById('formPatrocinadorCompetencia');
    var resetBtn = document.getElementById('patrocinadorCompetenciaReset');
    var submitBtn = document.getElementById('patrocinadorCompetenciaSubmit');
    if (editId) editId.value = '';
    if (form) form.reset();
    var hab = document.getElementById('patrocinadorCompetenciaHabilitado');
    if (hab) hab.checked = true;
    if (resetBtn) resetBtn.hidden = true;
    if (submitBtn) submitBtn.textContent = 'Guardar patrocinador';
  }

  function fillPatrocinadorCompetenciaForm(row) {
    document.getElementById('patrocinadorCompetenciaEditId').value = row['ID'] || '';
    document.getElementById('patrocinadorCompetenciaNombre').value = row['Nombre'] || '';
    document.getElementById('patrocinadorCompetenciaHandle').value = row['Instagram handle'] || '';
    document.getElementById('patrocinadorCompetenciaUrl').value = row['Red social enlace'] || '';
    document.getElementById('patrocinadorCompetenciaLogo').value = row['Logo enlace'] || '';
    document.getElementById('patrocinadorCompetenciaOrden').value = row['Orden'] || '';
    document.getElementById('patrocinadorCompetenciaHabilitado').checked = isHabilitadoValue(row['Habilitado']);
    document.getElementById('patrocinadorCompetenciaReset').hidden = false;
    document.getElementById('patrocinadorCompetenciaSubmit').textContent = 'Actualizar patrocinador';
  }

  function bindPatrocinadoresCompetenciaControls(rows) {
    document.querySelectorAll('.admin-patrocinador-toggle').forEach(function (input) {
      input.addEventListener('change', function () {
        var id = input.getAttribute('data-patrocinador-id');
        if (!id) return;
        input.disabled = true;
        togglePatrocinadorCompetencia(id, input.checked).then(function (result) {
          input.disabled = false;
          if (!result.ok) {
            input.checked = !input.checked;
            showError(result.error || 'No se pudo actualizar el patrocinador.');
            return;
          }
          showError('');
          if (lastDashboardData && lastDashboardData.allPatrocinadoresCompetencia) {
            lastDashboardData.allPatrocinadoresCompetencia.forEach(function (row) {
              if (row['ID'] === id) {
                row['Habilitado'] = result.habilitado || (input.checked ? 'Sí' : 'No');
              }
            });
          }
        });
      });
    });

    document.querySelectorAll('.admin-patrocinador-edit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-patrocinador-id');
        var row = (rows || []).find(function (item) { return item['ID'] === id; });
        if (row) fillPatrocinadorCompetenciaForm(row);
      });
    });
  }

  function bindPatrocinadorCompetenciaForm() {
    var form = document.getElementById('formPatrocinadorCompetencia');
    var resetBtn = document.getElementById('patrocinadorCompetenciaReset');
    if (resetBtn) {
      resetBtn.addEventListener('click', resetPatrocinadorCompetenciaForm);
    }
    if (!form) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var editId = document.getElementById('patrocinadorCompetenciaEditId').value.trim();
      var nombre = document.getElementById('patrocinadorCompetenciaNombre').value.trim();
      if (!nombre) {
        showError('El nombre del patrocinador es obligatorio.');
        return;
      }

      var submitBtn = document.getElementById('patrocinadorCompetenciaSubmit');
      if (submitBtn) submitBtn.disabled = true;

      savePatrocinadorCompetencia({
        id: editId,
        nombre: nombre,
        instagramHandle: document.getElementById('patrocinadorCompetenciaHandle').value.trim(),
        redEnlace: document.getElementById('patrocinadorCompetenciaUrl').value.trim(),
        logoEnlace: document.getElementById('patrocinadorCompetenciaLogo').value.trim(),
        orden: document.getElementById('patrocinadorCompetenciaOrden').value.trim(),
        habilitado: document.getElementById('patrocinadorCompetenciaHabilitado').checked
      }).then(function (result) {
        if (submitBtn) submitBtn.disabled = false;
        if (!result.ok) {
          showError(result.error || 'No se pudo guardar el patrocinador.');
          return;
        }
        showError('');
        resetPatrocinadorCompetenciaForm();
        loadDashboard();
      });
    });
  }

  function renderTable(rows, columns, metaText) {
    var cols = columns || [];
    var meta = metaText ? '<p class="admin-table-meta">' + escapeHtml(metaText) + '</p>' : '';
    if (!rows || !rows.length) {
      return meta + '<p class="admin-empty">Sin registros todavía.</p>';
    }
    var html = meta + '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>';
    cols.forEach(function (col) {
      html += '<th>' + escapeHtml(col) + '</th>';
    });
    html += '</tr></thead><tbody>';
    rows.forEach(function (row) {
      html += '<tr>';
      cols.forEach(function (col) {
        var val = row[col] || '';
        if (isLinkColumn(col) && val && val.indexOf('http') === 0) {
          html += '<td><a href="' + escapeHtml(val) + '" target="_blank" rel="noopener">Ver</a></td>';
        } else {
          html += '<td>' + escapeHtml(val) + '</td>';
        }
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderTopPages(topPages, limit) {
    var max = limit || 10;
    if (!topPages || !Object.keys(topPages).length) {
      return '<p class="admin-empty">Sin visitas registradas.</p>';
    }
    var entries = Object.keys(topPages).map(function (k) {
      return { path: k, count: topPages[k] };
    }).sort(function (a, b) { return b.count - a.count; }).slice(0, max);

    var html = '<ul class="admin-top-pages">';
    entries.forEach(function (e) {
      html += '<li><span class="admin-top-pages__path">' + escapeHtml(e.path) + '</span>';
      html += '<span class="admin-top-pages__count">' + formatNumber(e.count) + '</span></li>';
    });
    html += '</ul>';
    return html;
  }

  function rowsToCsv(headers, rows) {
    function esc(val) {
      var s = val === null || val === undefined ? '' : String(val);
      if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    var lines = [headers.map(esc).join(',')];
    (rows || []).forEach(function (row) {
      lines.push(headers.map(function (h) { return esc(row[h] || ''); }).join(','));
    });
    return '\uFEFF' + lines.join('\r\n');
  }

  function downloadCsvText(filename, csvText) {
    var blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename || 'export.csv';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function stampFilename(prefix) {
    var d = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    return prefix + '-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.csv';
  }

  function setExportButtonsDisabled(disabled) {
    document.querySelectorAll('[data-export], #downloadAllBtn, #refreshBtn').forEach(function (btn) {
      btn.disabled = disabled;
    });
  }

  function exportFromCache(dataset) {
    if (!lastDashboardData) return false;
    var data = lastDashboardData;

    if (dataset === 'feria') {
      downloadCsvText(
        stampFilename('feria-inscritos'),
        rowsToCsv(data.feriaColumns || DEFAULT_FERIA_COLS, data.allFeria || data.recentFeria || [])
      );
      return true;
    }
    if (dataset === 'competencia') {
      var compExportRows = pickCompetenciaRows(data);
      downloadCsvText(
        stampFilename('v60-championship-' + (activeCompetenciaEdition === 'all' ? 'todas' : activeCompetenciaEdition)),
        rowsToCsv(data.competenciaColumns || DEFAULT_COMP_COLS, compExportRows)
      );
      return true;
    }
    if (dataset === 'stands') {
      downloadCsvText(
        stampFilename('stands-expositores'),
        rowsToCsv(data.standsColumns || DEFAULT_STANDS_COLS, data.allStands || data.recentStands || [])
      );
      return true;
    }
    return false;
  }

  function triggerExport(dataset) {
    if (exportInFlight) return;
    exportInFlight = true;
    setExportButtonsDisabled(true);

    if (dataset !== 'analytics' && dataset !== 'all' && exportFromCache(dataset)) {
      exportInFlight = false;
      setExportButtonsDisabled(false);
      showError('');
      return;
    }

    fetchExport(dataset).then(function (result) {
      exportInFlight = false;
      setExportButtonsDisabled(false);
      if (!result.ok) {
        showError(result.error || 'No se pudo exportar.');
        return;
      }
      showError('');
      if (result.files && result.files.length) {
        result.files.forEach(function (file) {
          downloadCsvText(file.filename, file.csv);
        });
        return;
      }
      if (result.csv) {
        downloadCsvText(result.filename || stampFilename(result.dataset || 'export'), result.csv);
      }
    }).catch(function (err) {
      exportInFlight = false;
      setExportButtonsDisabled(false);
      showError(err.message || 'Error al exportar.');
    });
  }

  function setLoading(isLoading) {
    var el = document.getElementById('adminLoading');
    if (el) el.hidden = !isLoading;
  }

  function showError(msg) {
    var el = document.getElementById('adminError');
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.hidden = false;
    } else {
      el.hidden = true;
      el.textContent = '';
    }
  }

  function showBackendWarn(html) {
    var el = document.getElementById('adminBackendWarn');
    if (!el) return;
    if (html) {
      el.innerHTML = html;
      el.hidden = false;
    } else {
      el.hidden = true;
      el.innerHTML = '';
    }
  }

  function checkAppsScriptFeatures() {
    var url = getWebAppUrl();
    if (!url) return;

    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    var warnings = [];

    Promise.all([
      fetchJson(url + sep + 'action=participante_publico&id=__probe__'),
      fetchJson(url + sep + 'action=pasaporte_list&limit=1'),
      fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'admin_create_competitor', nombre: '' })
      }).then(function (res) { return res.json(); }).catch(function () { return {}; })
    ]).then(function (results) {
      var participante = results[0] || {};
      var pasaportes = results[1] || {};
      var competitor = results[2] || {};

      var participanteOk = participante.formType === 'participante_publico' ||
        (participante.error && String(participante.error).toLowerCase().indexOf('no encontrada') !== -1);
      var pasaportesOk = pasaportes.ok && Array.isArray(pasaportes.clientes);
      var competitorOk = competitor.error && String(competitor.error).indexOf('formType inválido') === -1;

      if (!participanteOk) {
        warnings.push('Perfiles de marca (<code>participante_publico</code>) y alta de stands no están en el deploy.');
      }
      if (!pasaportesOk) {
        warnings.push('Pasaportes Cafetero (<code>pasaporte_*</code>) no están en el deploy.');
      }
      if (!competitorOk) {
        warnings.push('Gestión de competidores (<code>admin_create_*</code> y <code>admin_save_competidor</code>) no está en el deploy.');
      }

      if (!warnings.length) {
        showBackendWarn('');
        return;
      }

      showBackendWarn(
        '<strong>Apps Script desactualizado.</strong> ' + warnings.join(' ') +
        ' Ejecuta <code>py tools/setup_admin.py</code>, redepliega la Web App y corre ' +
        '<code>sincronizarEncabezados()</code> en el editor de Apps Script.'
      );
    }).catch(function () { /* ignore probe errors */ });
  }

  function pickRows(data, key) {
    if (data[key]) return data[key];
    if (key === 'allFeria' && data.recentFeria) return data.recentFeria;
    if (key === 'allCompetencia' && data.recentCompetencia) return data.recentCompetencia;
    if (key === 'allStands' && data.recentStands) return data.recentStands;
    if (key === 'allPatrocinadoresCompetencia') return data.allPatrocinadoresCompetencia;
    return [];
  }

  function renderDashboard(data) {
    lastDashboardData = data;
    var stats = data.stats || {};

    setText('statVisitsToday', formatNumber(stats.visitsToday));
    setText('statVisitsTotal', formatNumber(stats.visitsTotal));
    setText('statVisitsTodayAnalytics', formatNumber(stats.visitsToday));
    setText('statVisitsTotalAnalytics', formatNumber(stats.visitsTotal));
    setText('statUniquePathsToday', formatNumber(stats.uniquePathsToday));
    setText('statUniquePathsTotal', formatNumber(stats.uniquePathsTotal));
    setText('statFeria', formatNumber(stats.feriaRegistrations));
    setText('statCompetencia', formatNumber(stats.competenciaRegistrations));
    setText('statStands', formatNumber(stats.standsRegistrations));
    setText('statLista', formatNumber(stats.listaEspera));

    var cupo = stats.competenciaCupo || {};
    setText('statCupo',
      formatNumber(cupo.count) + ' / ' + formatNumber(cupo.max || 36) +
      (cupo.completo ? ' (completo)' : ''));

    setText('statConvFeria', (stats.conversionFeriaPct || 0) + '%');
    setText('statConvComp', (stats.conversionCompetenciaPct || 0) + '%');

    var topToday = document.getElementById('topPagesToday');
    if (topToday) topToday.innerHTML = renderTopPages(stats.topPagesToday, 10);
    var topAllEl = document.getElementById('topPagesAll');
    if (topAllEl) topAllEl.innerHTML = renderTopPages(stats.topPagesAll, 10);
    var sourceEl = document.getElementById('analyticsSource');
    if (sourceEl) {
      sourceEl.textContent = stats.analyticsSource === 'sheet_pageviews'
        ? 'Analítica propia (pageviews en Google Sheets)'
        : 'Analítica propia (pageviews)';
    }

    var patrocRows = pickRows(data, 'allPatrocinadoresCompetencia');
    var patrocTitle = document.getElementById('patrocinadoresCompetenciaTitle');
    if (patrocTitle) {
      patrocTitle.textContent = 'Patrocinadores competencia — V60 Championship — ' + formatNumber(patrocRows.length) + ' total';
    }
    var tablePatroc = document.getElementById('tablePatrocinadoresCompetencia');
    if (tablePatroc) {
      tablePatroc.innerHTML = renderPatrocinadoresCompetenciaTable(patrocRows);
      bindPatrocinadoresCompetenciaControls(patrocRows);
    }

    renderAdminTabPanels(data);
    if (ensureCompetenciaEditionVisible(data)) {
      renderAdminTabPanels(data);
    }
    syncCompetenciaEditionUi();
    syncAdminJuradoPublishUi();

    var updated = document.getElementById('dashboardUpdated');
    if (updated && data.generatedAt) {
      updated.textContent = 'Actualizado: ' + new Date(data.generatedAt).toLocaleString('es-CO');
    }
  }

  function loadDashboard() {
    setLoading(true);
    showError('');

    fetchDashboard().then(function (data) {
      setLoading(false);
      if (!data.ok) {
        showError(data.error || 'No se pudo cargar el panel.');
        return;
      }
      renderDashboard(data);
    }).catch(function (err) {
      setLoading(false);
      showError(err.message || 'Error al cargar el panel.');
    });
  }

  function bindAdminCreateCompetidorForm() {
    var form = document.getElementById('formAdminCreateCompetidor');
    if (!form) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      showError('');

      var nombre = document.getElementById('adminCompNombre').value.trim();
      var correo = document.getElementById('adminCompCorreo').value.trim().toLowerCase();
      var celular = document.getElementById('adminCompCelular').value.trim();
      if (!nombre || !correo || !celular) {
        showError('Nombre, correo y celular son obligatorios.');
        return;
      }

      var submitBtn = document.getElementById('adminCompSubmit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creando…';
      }

      adminCreateCompetidor({
        nombre: nombre,
        documento: document.getElementById('adminCompDocumento').value.trim(),
        correo: correo,
        celular: celular,
        ciudad: document.getElementById('adminCompCiudad').value.trim(),
        estadoPago: document.getElementById('adminCompEstadoPago').value,
        cupoConfirmado: document.getElementById('adminCompCupoConfirmado').checked,
        forzarCupo: document.getElementById('adminCompForzarCupo').checked,
        evento: getActiveCompetenciaEventoForCreate()
      }).then(function (result) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Crear competidor';
        }
        if (!result || !result.ok) {
          showError((result && result.error) || 'No se pudo crear el competidor.');
          return;
        }
        var resultEl = document.getElementById('adminCreateCompResult');
        if (resultEl) {
          resultEl.innerHTML = '<p><strong>Competidor creado:</strong> ' + escapeHtml(nombre) +
            ' <span class="admin-badge admin-badge--on">ID ' + escapeHtml(result.id || '') + '</span></p>';
          resultEl.hidden = false;
        }
        form.reset();
        document.getElementById('adminCompCupoConfirmado').checked = true;
        loadDashboard();
      }).catch(function (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Crear competidor';
        }
        showError(err.message || 'Error al crear competidor.');
      });
    });
  }

  function bindAdminCreateVisitanteForm() {
    var form = document.getElementById('formAdminCreateVisitante');
    if (!form) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      showError('');

      var nombre = document.getElementById('adminFeriaNombre').value.trim();
      var celular = document.getElementById('adminFeriaCelular').value.trim();
      if (!nombre || !celular) {
        showError('Nombre y celular son obligatorios.');
        return;
      }

      var crearPasaporte = document.getElementById('adminFeriaCrearPasaporte').checked;
      var submitBtn = document.getElementById('adminFeriaSubmit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = crearPasaporte ? 'Registrando y creando pasaporte…' : 'Registrando…';
      }

      function registrarEnSheets(pasaporteId) {
        return adminCreateVisitante({
          nombre: nombre,
          edad: document.getElementById('adminFeriaEdad').value.trim(),
          celular: celular,
          correo: document.getElementById('adminFeriaCorreo').value.trim().toLowerCase(),
          intereses: document.getElementById('adminFeriaIntereses').value.trim(),
          pasaporteId: pasaporteId || ''
        });
      }

      var flow = Promise.resolve(null);
      if (crearPasaporte && global.Fidelizacion && global.Fidelizacion.crearORecuperarCliente) {
        flow = global.Fidelizacion.crearORecuperarCliente({
          nombre: nombre,
          telefono: celular,
          email: document.getElementById('adminFeriaCorreo').value.trim(),
          origen: 'admin-feria'
        }).then(function (res) { return res.id; })
          .catch(function (err) {
            throw new Error('Pasaporte: ' + (err.message || 'Redespliega Code.gs con py tools/setup_admin.py'));
          });
      }

      flow.then(function (pasaporteId) {
        return registrarEnSheets(pasaporteId).then(function (result) {
          return { result: result, pasaporteId: pasaporteId };
        });
      }).then(function (payload) {
        var result = payload.result;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Registrar visitante';
        }
        if (!result || !result.ok) {
          showError((result && result.error) || 'No se pudo registrar el visitante.');
          return;
        }
        var html = '<p><strong>Visitante registrado:</strong> ' + escapeHtml(nombre) +
          ' <span class="admin-badge admin-badge--on">ID ' + escapeHtml(result.id || '') + '</span></p>';
        if (payload.pasaporteId && global.Fidelizacion) {
          html += '<p><a href="' + escapeHtml(global.Fidelizacion.urlPasaporte(payload.pasaporteId)) +
            '" target="_blank" rel="noopener">Abrir Pasaporte Cafetero</a></p>';
        }
        var resultEl = document.getElementById('adminCreateFeriaResult');
        if (resultEl) {
          resultEl.innerHTML = html;
          resultEl.hidden = false;
        }
        form.reset();
        document.getElementById('adminFeriaCrearPasaporte').checked = true;
        loadDashboard();
      }).catch(function (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Registrar visitante';
        }
        showError(err.message || 'Error al registrar visitante.');
      });
    });
  }

  function bindEvents() {
    var refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadDashboard);

    var downloadAllBtn = document.getElementById('downloadAllBtn');
    if (downloadAllBtn) {
      downloadAllBtn.addEventListener('click', function () { triggerExport('all'); });
    }

    document.querySelectorAll('[data-export]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        triggerExport(btn.getAttribute('data-export'));
      });
    });
  }

  function preMountAdminModules() {
    if (global.AdminPasaportes && global.AdminPasaportes.mount) {
      global.AdminPasaportes.mount();
    }
    if (global.AdminOperadores && global.AdminOperadores.mount) {
      global.AdminOperadores.mount();
    }
  }

  function fetchJuradoPlatformConfig() {
    var requestUrl = buildAdminUrl('pasaporte_config', { key: 'jurado_v60_platform' });
    if (!requestUrl) return Promise.resolve(null);
    return fetchJson(requestUrl).then(function (data) {
      return data.ok && data.data ? data.data : null;
    });
  }

  function fetchJuradoPasaporteConfig(key) {
    var requestUrl = buildAdminUrl('pasaporte_config', { key: key });
    if (!requestUrl) return Promise.resolve(null);
    return fetchJson(requestUrl).then(function (data) {
      return data.ok && data.data ? data.data : null;
    });
  }

  function publishJuradoResultados() {
    return postAdminAction({ action: 'jurado_publish_resultados', evt: '' });
  }

  function syncAdminJuradoPublishUi() {
    var meta = document.getElementById('adminJuradoPublishMeta');
    if (!meta) return;
    Promise.all([
      fetchJuradoPasaporteConfig('jurado_v60_bracket'),
      fetchJuradoPasaporteConfig('jurado_v60_calificaciones')
    ]).then(function (results) {
      var bracket = results[0] || {};
      var cal = results[1] || {};
      var activos = Array.isArray(bracket.activos) && bracket.activos.length
        ? bracket.activos
        : pickCompetenciaRows(lastDashboardData || {}).map(function (row) { return row['ID']; }).filter(Boolean);
      var map = bracket.resultadosCompetidor && typeof bracket.resultadosCompetidor === 'object'
        ? bracket.resultadosCompetidor
        : {};
      var scores = cal.scores && typeof cal.scores === 'object' ? cal.scores : {};
      var pubCount = activos.filter(function (id) { return !!map[id]; }).length;
      var readyCount = activos.filter(function (id) {
        return scores[id] && scores[id].sumaTotal != null;
      }).length;
      if (pubCount > 0) {
        meta.textContent = '✓ ' + pubCount + ' competidor(es) ya pueden ver sus puntajes en el portal. ' +
          readyCount + ' con calificación completa en la ronda actual.';
      } else {
        meta.textContent = readyCount
          ? readyCount + ' competidor(es) listos para publicar. Los puntajes no son visibles hasta que pulses el botón.'
          : 'Aún no hay calificaciones completas para publicar en esta ronda.';
      }
    }).catch(function () {
      meta.textContent = 'Los competidores no ven sus puntajes en el portal hasta que publiques la ronda actual.';
    });
  }

  function bindAdminJuradoPublish() {
    var btn = document.getElementById('adminJuradoPublishBtn');
    var resultEl = document.getElementById('adminJuradoPublishResult');
    var portalLink = document.getElementById('adminJuradoResultadosLink');
    if (portalLink && global.SiteLinks && global.SiteLinks.buildJuradoUrls) {
      var urls = global.SiteLinks.buildJuradoUrls({});
      if (urls.resultados) portalLink.href = urls.resultados;
    }
    if (!btn || btn.getAttribute('data-bound') === '1') return;
    btn.setAttribute('data-bound', '1');
    btn.addEventListener('click', function () {
      if (!confirm('¿Publicar los resultados de la ronda actual para que los competidores los vean en el portal?\n\nSolo verán sus puntajes después de esta acción.')) return;
      btn.disabled = true;
      btn.textContent = 'Publicando…';
      if (resultEl) resultEl.hidden = true;
      publishJuradoResultados().then(function (data) {
        if (!data || !data.ok) {
          showError((data && data.error) || 'No se pudieron publicar los resultados.');
          return;
        }
        showError('');
        if (resultEl) {
          resultEl.innerHTML = '<p><strong>✓ Publicados:</strong> ' + formatNumber(data.published || 0) +
            ' competidor(es)' + (data.faseLabel ? ' · ' + escapeHtml(data.faseLabel) : '') + '</p>';
          resultEl.hidden = false;
        }
        syncAdminJuradoPublishUi();
      }).catch(function (err) {
        showError(err.message || 'Error al publicar resultados.');
      }).finally(function () {
        btn.disabled = false;
        btn.textContent = 'Publicar resultados a competidores';
      });
    });
  }

  function juradoScoringSummary(platformCfg) {
    var sc = platformCfg && platformCfg.scoring;
    if (!sc) return 'Duelos 1v1 · 3 jueces · escala 1–5';
    var disciplina = sc.disciplina ? String(sc.disciplina).replace(/_/g, ' ') : 'filtrado';
    var modo = sc.modo === 'puntaje_general' ? 'Puntaje general' : 'Duelos 1v1';
    var jueces = sc.jueces || 3;
    var scale = (sc.scaleMin != null ? sc.scaleMin : 1) + '–' + (sc.scaleMax != null ? sc.scaleMax : 5);
    var crit = Array.isArray(sc.criteria) ? sc.criteria.length : 7;
    return disciplina + ' · ' + modo + ' · ' + jueces + ' juez' + (jueces === 1 ? '' : 'es') +
      ' · escala ' + scale + ' · ' + crit + ' criterios';
  }

  function renderAdminJuradoLinks(platformCfg) {
    var root = document.getElementById('adminJuradoLinksRoot');
    var orgQuick = document.getElementById('adminJuradoOrganizadorLink');
    var meta = document.getElementById('adminJuradoLinksMeta');
    if (!root) return;

    var sc = platformCfg && platformCfg.scoring;
    var jueces = sc && sc.jueces ? sc.jueces : (global.SiteLinks && global.SiteLinks.juradoJudgeCount
      ? global.SiteLinks.juradoJudgeCount() : 3);
    var pinOrg = (platformCfg && platformCfg.pinOrganizador) ||
      (global.EVENT_CONFIG && global.EVENT_CONFIG.juradoV60 && global.EVENT_CONFIG.juradoV60.pinOrganizador) ||
      'v60organizador';
    var pinJuez = (platformCfg && platformCfg.pinJuez) ||
      (global.EVENT_CONFIG && global.EVENT_CONFIG.juradoV60 && global.EVENT_CONFIG.juradoV60.pinJuez) ||
      'v60sensorial';

    var urls = global.SiteLinks && global.SiteLinks.buildJuradoUrls
      ? global.SiteLinks.buildJuradoUrls({ pinOrganizador: pinOrg, pinJuez: pinJuez, jueces: jueces })
      : (global.EVENT_CONFIG && global.EVENT_CONFIG.juradoV60 && global.EVENT_CONFIG.juradoV60.links) || {};

    if (orgQuick && urls.organizador) orgQuick.href = urls.organizador;

    if (meta) {
      meta.textContent = juradoScoringSummary(platformCfg) +
        '. Paneles separados: config, torneo, resultados (nombre + cédula) y jurados.';
    }

    var roles = [
      { key: 'hub', label: 'Consola principal' },
      { key: 'config', label: '1. Configuración' },
      { key: 'inscripcion', label: '2. Inscripción' },
      { key: 'organizador', label: '3. Torneo en vivo' },
      { key: 'resultados', label: '4. Resultados competidor' }
    ];
    for (var j = 1; j <= jueces; j++) {
      roles.push({ key: 'juez' + j, label: 'Juez ' + j });
    }

    root.innerHTML = roles.map(function (role) {
      var url = urls[role.key] || '#';
      return '<div class="admin-jurado-link-row">' +
        '<div class="admin-jurado-link-label"><strong>' + escapeHtml(role.label) + '</strong></div>' +
        '<a class="admin-jurado-link-url" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(url) + '</a>' +
        '<div class="admin-jurado-link-actions">' +
        '<button type="button" class="admin-btn admin-btn--secondary admin-btn--small" data-admin-copy-link="' + escapeHtml(url) + '">Copiar</button>' +
        '<a class="admin-btn admin-btn--secondary admin-btn--small" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">Abrir</a>' +
        '</div></div>';
    }).join('');
  }

  function buildJuradoTenantConfigUrl(slug, pinOrg) {
    var site = String((global.EVENT_CONFIG && global.EVENT_CONFIG.siteUrl) || global.location.origin).replace(/\/$/, '');
    var path = (global.SiteLinks && global.SiteLinks.HOSTED && global.SiteLinks.HOSTED.juradoConfig) ||
      '/jurado/config';
    return site + path + '?evt=' + encodeURIComponent(slug) + '&pin=' + encodeURIComponent(pinOrg);
  }

  function fetchJuradoInstances() {
    return fetch(buildAdminUrl('jurado_instances'), { cache: 'no-store', redirect: 'follow' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || data.ok === false) throw new Error((data && data.error) || 'No se pudieron cargar clientes.');
        return data.instances || [];
      });
  }

  function renderJuradoClientsList(instances) {
    var root = document.getElementById('adminJuradoClientsList');
    if (!root) return;
    if (!instances.length) {
      root.innerHTML = '<p class="admin-table-meta">Aún no hay clientes. Crea el primer apartado arriba.</p>';
      return;
    }
    root.innerHTML = instances.slice().reverse().map(function (inst) {
      var cfgUrl = buildJuradoTenantConfigUrl(inst.slug, inst.pinOrganizador);
      var site = String((global.EVENT_CONFIG && global.EVENT_CONFIG.siteUrl) || global.location.origin).replace(/\/$/, '');
      var inscUrl = inst.inscripcionUrl || (site + '/competencia/torneo?evt=' + encodeURIComponent(inst.slug));
      var hubUrl = site + ((global.SiteLinks && global.SiteLinks.HOSTED && global.SiteLinks.HOSTED.juradoV60) || '/jurado-v60') +
        '?evt=' + encodeURIComponent(inst.slug);
      var urls = global.SiteLinks && global.SiteLinks.buildJuradoUrls
        ? global.SiteLinks.buildJuradoUrls({
          evt: inst.slug,
          pinOrganizador: inst.pinOrganizador,
          pinJuez: inst.pinJuez,
          jueces: inst.jueces || 3
        })
        : {};
      var created = '';
      try {
        created = new Date(inst.createdAt).toLocaleString('es-CO', { dateStyle: 'short' });
      } catch (e) { created = inst.createdAt || ''; }
      var judgeCount = inst.jueces || 3;
      var linkBlocks = [
        { label: '1. Configuración (envía esto al cliente)', url: cfgUrl },
        { label: '2. Inscripción en línea', url: inscUrl },
        { label: '3. Torneo en vivo', url: urls.organizador || '' },
        { label: '4. Resultados competidor', url: urls.resultados || '' },
        { label: '5. Consola principal (jurados según config)', url: hubUrl }
      ].filter(function (item) { return item.url; }).map(function (item) {
        return '<p class="admin-jurado-client-config"><span class="admin-table-meta">' + escapeHtml(item.label) + ':</span><br>' +
          '<a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(item.url) + '</a></p>';
      }).join('');
      var judgeLinks = [];
      for (var jn = 1; jn <= judgeCount; jn++) {
        if (urls['juez' + jn]) judgeLinks.push('<a href="' + escapeHtml(urls['juez' + jn]) + '" target="_blank" rel="noopener noreferrer">Juez ' + jn + '</a>');
      }
      return '<article class="admin-jurado-client-row">' +
        '<div class="admin-jurado-client-head">' +
        '<strong>' + escapeHtml(inst.clientName) + '</strong>' +
        '<span class="admin-table-meta">' + escapeHtml(inst.eventName) + ' · ' + escapeHtml(inst.slug) + '</span>' +
        '</div>' +
        linkBlocks +
        (judgeLinks.length ? '<p class="admin-jurado-client-config"><span class="admin-table-meta">Jurados (según config del torneo):</span><br>' + judgeLinks.join(' · ') + ' · <a href="' + escapeHtml(hubUrl) + '" target="_blank" rel="noopener noreferrer">Consola</a></p>' : '') +
        '<div class="admin-jurado-link-actions">' +
        '<button type="button" class="admin-btn admin-btn--secondary admin-btn--small" data-admin-copy-link="' + escapeHtml(cfgUrl) + '">Copiar config</button>' +
        (inscUrl ? '<button type="button" class="admin-btn admin-btn--secondary admin-btn--small" data-admin-copy-link="' + escapeHtml(inscUrl) + '">Copiar inscripción</button>' : '') +
        (urls.organizador ? '<button type="button" class="admin-btn admin-btn--secondary admin-btn--small" data-admin-copy-link="' + escapeHtml(urls.organizador) + '">Copiar torneo</button>' : '') +
        '</div>' +
        '<p class="admin-table-meta">Creado ' + escapeHtml(created) +
        (inst.contactEmail ? ' · ' + escapeHtml(inst.contactEmail) : '') + '</p>' +
        '</article>';
    }).join('');
  }

  function refreshJuradoClientsCard() {
    return fetchJuradoInstances().then(renderJuradoClientsList).catch(function (err) {
      var root = document.getElementById('adminJuradoClientsList');
      if (root) root.innerHTML = '<p class="admin-error">' + escapeHtml(err.message || 'Error al cargar clientes') + '</p>';
    });
  }

  function bindJuradoClientsForm() {
    var form = document.getElementById('adminJuradoClientForm');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = document.getElementById('adminJuradoClientMsg');
      var err = document.getElementById('adminJuradoClientError');
      if (msg) msg.hidden = true;
      if (err) err.hidden = true;
      var clientName = (document.getElementById('adminJuradoClientName') || {}).value || '';
      var eventName = (document.getElementById('adminJuradoEventName') || {}).value || '';
      var contactEmail = (document.getElementById('adminJuradoClientEmail') || {}).value || '';
      postAdminAction({
        action: 'jurado_instance_create',
        clientName: clientName.trim(),
        eventName: eventName.trim(),
        contactEmail: contactEmail.trim()
      }).then(function (data) {
        if (!data || data.ok === false) throw new Error((data && data.error) || 'No se pudo crear el apartado.');
        var inst = data.instance;
        var cfgUrl = buildJuradoTenantConfigUrl(inst.slug, inst.pinOrganizador);
        var inscUrl = data.inscripcionUrl || inst.inscripcionUrl || '';
        if (msg) {
          msg.textContent = 'Apartado creado. Config: ' + cfgUrl +
            (inscUrl ? ' · Inscripción: ' + inscUrl : '');
          msg.hidden = false;
        }
        form.reset();
        return refreshJuradoClientsCard();
      }).catch(function (error) {
        if (err) {
          err.textContent = error.message || 'Error al crear apartado';
          err.hidden = false;
        }
      });
    });
  }

  function bindAdminJuradoLinkCopy() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-admin-copy-link]');
      if (!btn) return;
      var url = btn.getAttribute('data-admin-copy-link');
      if (!url) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          btn.textContent = 'Copiado';
          setTimeout(function () { btn.textContent = 'Copiar'; }, 1500);
        });
      }
    });
  }

  function init() {
    bindEvents();
    bindAdminNav();
    bindAdminTabs();
    bindPatrocinadorCompetenciaForm();
    bindAdminCreateMarcaForm();
    bindCompetenciaEditionSelector();
    bindCompetenciaEditionHintActions();
    bindAdminJuradoPublish();
    bindAdminCreateCompetidorForm();
    bindCompetidorEditorForm();
    mountCompetidorPngLayoutEditor();
    bindCompetidorMinimalZipButton();
    bindAdminCreateVisitanteForm();
    bindAdminMarcaLogoPreview();
    bindAdminJuradoLinkCopy();
    bindJuradoClientsForm();
    fetchJuradoPlatformConfig().then(renderAdminJuradoLinks).catch(function () {
      renderAdminJuradoLinks(null);
    });
    refreshJuradoClientsCard();
    restoreAdminTabFromStorage();
    syncAdminTabUi();
    syncMarcaPlanFromTab();
    showAdminSection(readHashSection());
    preMountAdminModules();
    if (global.AdminDisclosures && global.AdminDisclosures.init) {
      global.AdminDisclosures.init();
    }

    if (!getWebAppUrl()) {
      showError('Configura js/sheets-config.js con la URL de Apps Script.');
      setLoading(false);
      return;
    }

    checkAppsScriptFeatures();
    loadDashboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
