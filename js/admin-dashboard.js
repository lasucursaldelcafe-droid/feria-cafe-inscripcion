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

  var activeAdminTab = 'competencia';

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

  function filterStandsBySection(rows, section) {
    return (rows || []).filter(function (row) {
      var tipo = String(row['Tipo participante'] || '').trim().toLowerCase();
      var plan = String(row['Plan stand'] || '').trim();
      if (section === 'expositores') return tipo === 'expositor' || plan === 'Zona Origen';
      if (section === 'aliados') return tipo === 'aliado' || plan === 'Aliado Patrocinador';
      if (section === 'patrocinadores') return tipo === 'patrocinador' && plan !== 'Aliado Patrocinador';
      return true;
    });
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
    document.querySelectorAll('.admin-toggle-status-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
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
        });
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

  function renderAdminTabPanels(data) {
    var panel = document.getElementById('adminTabPanels');
    if (!panel || !data) return;

    var feriaRows = pickRows(data, 'allFeria');
    var compRows = pickRows(data, 'allCompetencia');
    var standsRows = pickRows(data, 'allStands');
    var html = '';

    if (activeAdminTab === 'competencia') {
      html = '<div class="admin-tab-panel" role="tabpanel">' +
        renderManageableTable(compRows, data.competenciaColumns || DEFAULT_COMP_COLS, {
          dataset: 'competencia',
          metaText: compRows.length + ' competidores — más recientes primero.'
        }) + '</div>';
    } else if (activeAdminTab === 'feria') {
      html = '<div class="admin-tab-panel" role="tabpanel">' +
        renderManageableTable(feriaRows, data.feriaColumns || DEFAULT_FERIA_COLS, {
          dataset: 'feria',
          metaText: feriaRows.length + ' visitantes registrados.'
        }) + '</div>';
    } else if (activeAdminTab === 'marcas') {
      html = '<div class="admin-tab-panel" role="tabpanel">' + renderDirectorioTable(standsRows) + '</div>';
    } else {
      var sectionRows = filterStandsBySection(standsRows, activeAdminTab);
      var sectionLabels = {
        expositores: 'Stands / expositores (Zona Origen)',
        aliados: 'Aliados (Aliado Patrocinador)',
        patrocinadores: 'Patrocinadores (Zona Gran Reserva)'
      };
      html = '<div class="admin-tab-panel" role="tabpanel">' +
        renderManageableTable(sectionRows, data.standsColumns || DEFAULT_STANDS_COLS, {
          dataset: 'stands',
          metaText: sectionRows.length + ' registros — ' + (sectionLabels[activeAdminTab] || activeAdminTab)
        }) + '</div>';
    }

    panel.innerHTML = html;
    bindToggleStatusButtons();
    if (activeAdminTab === 'marcas') bindDirectorioToggles();
  }

  function bindAdminTabs() {
    document.querySelectorAll('[data-admin-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        activeAdminTab = tab.getAttribute('data-admin-tab') || 'competencia';
        document.querySelectorAll('[data-admin-tab]').forEach(function (t) {
          var active = t === tab;
          t.classList.toggle('admin-tab--active', active);
          t.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        renderAdminTabPanels(lastDashboardData);
      });
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
      html += '<td>' + escapeHtml(row['Marca o negocio'] || '') + '</td>';
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
      downloadCsvText(
        stampFilename('v60-championship'),
        rowsToCsv(data.competenciaColumns || DEFAULT_COMP_COLS, data.allCompetencia || data.recentCompetencia || [])
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

  function pickRows(data, key) {
    if (Array.isArray(data[key])) return data[key];
    if (key === 'allFeria' && Array.isArray(data.recentFeria)) return data.recentFeria;
    if (key === 'allCompetencia' && Array.isArray(data.recentCompetencia)) return data.recentCompetencia;
    if (key === 'allStands' && Array.isArray(data.recentStands)) return data.recentStands;
    if (key === 'allPatrocinadoresCompetencia' && Array.isArray(data.allPatrocinadoresCompetencia)) {
      return data.allPatrocinadoresCompetencia;
    }
    return [];
  }

  function renderDashboard(data) {
    lastDashboardData = data;
    var stats = data.stats || {};

    document.getElementById('statVisitsToday').textContent = formatNumber(stats.visitsToday);
    document.getElementById('statVisitsTotal').textContent = formatNumber(stats.visitsTotal);
    var uniqueToday = document.getElementById('statUniquePathsToday');
    if (uniqueToday) uniqueToday.textContent = formatNumber(stats.uniquePathsToday);
    var uniqueTotal = document.getElementById('statUniquePathsTotal');
    if (uniqueTotal) uniqueTotal.textContent = formatNumber(stats.uniquePathsTotal);
    document.getElementById('statFeria').textContent = formatNumber(stats.feriaRegistrations);
    document.getElementById('statCompetencia').textContent = formatNumber(stats.competenciaRegistrations);
    var statStands = document.getElementById('statStands');
    if (statStands) statStands.textContent = formatNumber(stats.standsRegistrations);
    document.getElementById('statLista').textContent = formatNumber(stats.listaEspera);

    var cupo = stats.competenciaCupo || {};
    document.getElementById('statCupo').textContent =
      formatNumber(cupo.count) + ' / ' + formatNumber(cupo.max || 36) +
      (cupo.completo ? ' (completo)' : '');

    document.getElementById('statConvFeria').textContent = (stats.conversionFeriaPct || 0) + '%';
    document.getElementById('statConvComp').textContent = (stats.conversionCompetenciaPct || 0) + '%';

    document.getElementById('topPagesToday').innerHTML = renderTopPages(stats.topPagesToday, 10);
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

  function init() {
    if (!getWebAppUrl()) {
      showError('Configura js/sheets-config.js con la URL de Apps Script.');
      setLoading(false);
      return;
    }
    bindEvents();
    bindAdminTabs();
    bindPatrocinadorCompetenciaForm();
    loadDashboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
