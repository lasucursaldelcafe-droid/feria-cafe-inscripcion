/**
 * Resumen corto de la feria dentro del Pasaporte Cafetero (PWA).
 */
(function (global) {
  'use strict';

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getWebAppUrl() {
    var cfg = global.SHEETS_CONFIG || {};
    return String(cfg.WEB_APP_URL || '').trim();
  }

  function fetchNovedades() {
    var url = getWebAppUrl();
    if (!url) return Promise.resolve({ ok: false, novedades: [] });
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return fetch(url + sep + 'action=feria_resumen&_=' + Date.now(), {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store'
    }).then(function (res) { return res.json(); })
      .catch(function () { return { ok: false, novedades: [] }; });
  }

  function programaFromConfig() {
    var cfg = global.EVENT_CONFIG || {};
    var feria = cfg.feria || {};
    return Array.isArray(feria.programaCorto) ? feria.programaCorto : [];
  }

  function metaFromConfig() {
    var cfg = global.EVENT_CONFIG || {};
    var feria = cfg.feria || {};
    var parts = [];
    if (feria.fechaCorta || feria.fecha) parts.push(feria.fechaCorta || feria.fecha);
    if (feria.sede) parts.push(feria.sede + (feria.ciudad ? ', ' + feria.ciudad : ''));
    return parts.join(' · ');
  }

  function linkHref(key) {
    return global.SiteLinks && SiteLinks.href ? SiteLinks.href(key) : '#';
  }

  function renderPrograma(container) {
    var items = programaFromConfig();
    if (!items.length) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = items.map(function (item) {
      return '<li class="pasaporte-feria__item">' +
        '<span class="pasaporte-feria__icon" aria-hidden="true">' + escapeHtml(item.icono || '•') + '</span>' +
        '<div><strong>' + escapeHtml(item.titulo || '') + '</strong>' +
        '<p>' + escapeHtml(item.texto || '') + '</p></div></li>';
    }).join('');
  }

  function renderNovedades(container, novedades) {
    if (!novedades || !novedades.length) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }
    container.hidden = false;
    container.innerHTML = '<h4 class="pasaporte-feria__sub">Últimas novedades</h4>' +
      novedades.map(function (n) {
        return '<article class="pasaporte-feria__news">' +
          '<strong>' + escapeHtml(n.titulo || 'Aviso') + '</strong>' +
          (n.cuerpo ? '<p>' + escapeHtml(n.cuerpo) + '</p>' : '') +
          '</article>';
      }).join('');
  }

  function mount(rootId) {
    var root = document.getElementById(rootId);
    if (!root) return;

    var metaEl = root.querySelector('[data-feria-meta]');
    var programaEl = root.querySelector('[data-feria-programa]');
    var novedadesEl = root.querySelector('[data-feria-novedades]');
    var marcasLink = root.querySelector('[data-feria-marcas]');
    var actividadesLink = root.querySelector('[data-feria-actividades]');
    var expositorLink = root.querySelector('[data-feria-expositor]');

    if (metaEl) metaEl.textContent = metaFromConfig();
    if (programaEl) renderPrograma(programaEl);
    if (marcasLink) marcasLink.href = linkHref('marcas');
    if (actividadesLink) actividadesLink.href = linkHref('actividades');
    if (expositorLink) expositorLink.href = linkHref('miStand');

    root.hidden = false;

    if (novedadesEl) {
      fetchNovedades().then(function (data) {
        renderNovedades(novedadesEl, (data && data.novedades) || []);
      });
    }
  }

  global.PasaporteFeria = { mount: mount };
})(window);
