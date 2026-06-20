/**
 * Panel admin — Apps Script (modo público sin login mientras OAuth esté roto).
 */
(function (global) {
  'use strict';

  var PUBLIC_ADMIN = true;
  var lastDashboardData = null;
  var exportInFlight = false;

  var DEFAULT_FERIA_COLS = [
    'Fecha registro', 'ID', 'Nombre', 'Edad', 'Celular', 'Correo', 'Intereses',
    'Estado registro', 'Notas admin'
  ];

  var DEFAULT_COMP_COLS = [
    'Fecha registro', 'ID', 'Nombre', 'Correo', 'Celular', 'Ciudad',
    'Estado pago', 'Cupo confirmado', 'Comprobante enlace Drive'
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

  function renderTopPages(topPages) {
    if (!topPages || !Object.keys(topPages).length) {
      return '<p class="admin-empty">Sin visitas hoy.</p>';
    }
    var entries = Object.keys(topPages).map(function (k) {
      return { path: k, count: topPages[k] };
    }).sort(function (a, b) { return b.count - a.count; }).slice(0, 8);

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
    document.querySelectorAll('[data-export], #downloadAllBtn').forEach(function (btn) {
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
        stampFilename('switch-championship'),
        rowsToCsv(data.competenciaColumns || DEFAULT_COMP_COLS, data.allCompetencia || data.recentCompetencia || [])
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

  function showStart() {
    var start = document.getElementById('adminStart');
    var dash = document.getElementById('adminDashboard');
    if (start) start.hidden = false;
    if (dash) dash.hidden = true;
  }

  function showDashboardView() {
    var start = document.getElementById('adminStart');
    var dash = document.getElementById('adminDashboard');
    if (start) start.hidden = true;
    if (dash) dash.hidden = false;
  }

  function setLoading(isLoading) {
    var el = document.getElementById('adminLoading');
    if (el) el.hidden = !isLoading;
    var btn = document.getElementById('loadDashboardBtn');
    if (btn) btn.disabled = isLoading;
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
    if (data[key]) return data[key];
    if (key === 'allFeria' && data.recentFeria) return data.recentFeria;
    if (key === 'allCompetencia' && data.recentCompetencia) return data.recentCompetencia;
    return [];
  }

  function renderDashboard(data) {
    lastDashboardData = data;
    var stats = data.stats || {};

    document.getElementById('statVisitsToday').textContent = formatNumber(stats.visitsToday);
    document.getElementById('statVisitsTotal').textContent = formatNumber(stats.visitsTotal);
    document.getElementById('statFeria').textContent = formatNumber(stats.feriaRegistrations);
    document.getElementById('statCompetencia').textContent = formatNumber(stats.competenciaRegistrations);
    document.getElementById('statLista').textContent = formatNumber(stats.listaEspera);

    var cupo = stats.competenciaCupo || {};
    document.getElementById('statCupo').textContent =
      formatNumber(cupo.count) + ' / ' + formatNumber(cupo.max) +
      (cupo.completo ? ' (completo)' : '');

    document.getElementById('statConvFeria').textContent = (stats.conversionFeriaPct || 0) + '%';
    document.getElementById('statConvComp').textContent = (stats.conversionCompetenciaPct || 0) + '%';

    document.getElementById('topPagesToday').innerHTML = renderTopPages(stats.topPagesToday);

    var feriaRows = pickRows(data, 'allFeria');
    var feriaCols = data.feriaColumns || DEFAULT_FERIA_COLS;
    var feriaTitle = document.getElementById('feriaTableTitle');
    if (feriaTitle) {
      feriaTitle.textContent = 'Inscritos — Feria (visitantes) — ' + formatNumber(feriaRows.length) + ' total';
    }
    document.getElementById('tableFeria').innerHTML = renderTable(
      feriaRows,
      feriaCols,
      feriaRows.length ? 'Todos los registros, más recientes primero.' : ''
    );

    var compRows = pickRows(data, 'allCompetencia');
    var compCols = data.competenciaColumns || DEFAULT_COMP_COLS;
    var compTitle = document.getElementById('competenciaTableTitle');
    if (compTitle) {
      compTitle.textContent = 'Inscritos — Switch Championship — ' + formatNumber(compRows.length) + ' total';
    }
    document.getElementById('tableCompetencia').innerHTML = renderTable(
      compRows,
      compCols,
      compRows.length ? 'Todos los registros, más recientes primero.' : ''
    );

    var updated = document.getElementById('dashboardUpdated');
    if (updated && data.generatedAt) {
      updated.textContent = 'Actualizado: ' + new Date(data.generatedAt).toLocaleString('es-CO');
    }

    var userEl = document.getElementById('adminUserLabel');
    if (userEl) userEl.textContent = 'Panel interno';
  }

  function loadDashboard() {
    setLoading(true);
    showError('');

    fetchDashboard().then(function (data) {
      setLoading(false);
      if (!data.ok) {
        showError(data.error || 'No se pudo cargar el panel.');
        showStart();
        return;
      }
      showDashboardView();
      renderDashboard(data);
    }).catch(function (err) {
      setLoading(false);
      showError(err.message || 'Error al cargar el panel.');
      showStart();
    });
  }

  function bindEvents() {
    var loadBtn = document.getElementById('loadDashboardBtn');
    if (loadBtn) loadBtn.addEventListener('click', loadDashboard);

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
      showStart();
      return;
    }
    bindEvents();
    if (PUBLIC_ADMIN) loadDashboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
