/**
 * Meta OG dinámica y utilidades de contacto.
 */
(function (global) {
  'use strict';

  var cfg = global.EVENT_CONFIG || {};
  var contact = cfg.contact || {};
  var feria = cfg.feria || {};
  var ev = cfg.evento1 || {};
  var siteUrl = (cfg.siteUrl || '').replace(/\/$/, '');

  function detectPage() {
    var path = (global.location.pathname || '').toLowerCase();
    if (path.indexOf('festival') !== -1 || path === '/' || path === '' ||
        path.indexOf('el-evento') !== -1 || path.indexOf('actividades') !== -1 ||
        path.indexOf('patrocinadores') !== -1) return 'festival';
    if (path.indexOf('competencia') !== -1) return 'torneo';
    if (path.indexOf('inscripcion') !== -1) return 'feria';
    return 'general';
  }

  function whatsappUrl(text) {
    var phone = String(contact.whatsapp || '').replace(/\D/g, '');
    var msg = encodeURIComponent(text || 'Hola, tengo una consulta sobre La Sucursal del Café.');
    if (!phone) return 'mailto:' + (contact.email || '');
    return 'https://wa.me/' + phone + '?text=' + msg;
  }

  function feriaLugar() {
    if (!feria.sede) return feria.ciudad || '';
    return feria.ciudad ? feria.sede + ', ' + feria.ciudad : feria.sede;
  }

  function torneoLugar() {
    return ev.ciudad ? ev.sede + ', ' + ev.ciudad : ev.sede;
  }

  function applyPageCopy() {
    var page = detectPage();

    function setText(id, text) {
      var el = document.getElementById(id);
      if (el && text) el.textContent = text;
    }

    function setHtml(id, html) {
      var el = document.getElementById(id);
      if (el && html) el.innerHTML = html;
    }

    if (page === 'feria') {
      var visitante = feria.visitante || {};
      setText(
        'heroSubtitle',
        (visitante.resumen || 'Entrada sin costo · registro opcional · premios si te registras') +
          ' · ' +
          feria.fecha +
          ' · ' +
          feriaLugar()
      );
      setText('badgeFeriaFecha', '📅 ' + (feria.fechaCorta || feria.fecha));
      setText('badgeFeriaSede', '📍 ' + feriaLugar());
      setHtml(
        'infoFeriaDetalle',
        '<strong>' + (feria.fecha || '') + '</strong> · <strong>' + feriaLugar() + '</strong>'
      );
      setHtml(
        'successLeadFeria',
        'Gracias por registrarte como <strong>visitante</strong> en la feria de <strong>La Sucursal del Café</strong>. ' +
          'Quedas en la lista para <strong>premios exclusivos de visitantes registrados</strong>. ' +
          'Recuerda: la entrada no tiene costo y no era obligatorio registrarse para asistir. Te esperamos el <strong>' +
          feria.fecha +
          '</strong> (' +
          feriaLugar() +
          ').'
      );
      var formTitle = document.getElementById('form-title');
      if (formTitle && visitante.titulo) formTitle.textContent = visitante.titulo;
      var btnSubmit = document.getElementById('btnSubmit');
      if (btnSubmit) btnSubmit.textContent = 'Enviar registro de visitante';
    }

    document.querySelectorAll('[data-bind]').forEach(function (el) {
      var key = el.getAttribute('data-bind');
      if (key === 'feria.fecha' && feria.fecha) el.textContent = feria.fecha;
      if (key === 'torneo.fecha' && ev.fecha) el.textContent = ev.fecha;
      if (key === 'torneo.lugar' && ev.sede) el.textContent = torneoLugar();
      if (key === 'feria.lugar') el.textContent = feriaLugar();
    });
  }

  function pageKeyFromPath() {
    var path = (global.location.pathname || '').toLowerCase();
    if (path.indexOf('festival') !== -1 || path === '/' || path === '') return 'festival';
    if (path.indexOf('el-evento') !== -1) return 'evento';
    if (path.indexOf('actividades') !== -1) return 'actividades';
    if (path.indexOf('patrocinadores') !== -1) return 'patrocinadores';
    if (path.indexOf('competencia') !== -1) return 'competencia';
    if (path.indexOf('reglas') !== -1) return 'reglas';
    if (path.indexOf('como-funciona') !== -1) return 'comoFunciona';
    if (path.indexOf('privacidad') !== -1) return 'privacidad';
    if (path.indexOf('qr') !== -1) return 'qr';
    if (path.indexOf('inscripcion') !== -1) return 'feria';
    return 'festival';
  }

  function ensureOgMeta() {
    if (!siteUrl) return;
    var pageUrl = (global.SiteLinks && global.SiteLinks.absUrl)
      ? global.SiteLinks.absUrl(pageKeyFromPath())
      : siteUrl + '/';

    var title = document.title || cfg.brandName;
    var desc = document.querySelector('meta[name="description"]');
    var description = desc ? desc.getAttribute('content') : cfg.brandName;

    function setMeta(attr, key, value) {
      if (!value) return;
      var el = document.querySelector('meta[' + attr + '="' + key + '"]');
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', value);
    }

    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', pageUrl);
    setMeta('property', 'og:type', 'website');

    var canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', pageUrl);
    setMeta('property', 'og:locale', 'es_CO');
    setMeta('property', 'og:image', siteUrl + '/assets/logo-la-sucursal-del-cafe.png');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
  }

  function renderSiteFooter() {
    var shell = document.querySelector('.site-shell');
    if (!shell || document.querySelector('.site-footer') || document.querySelector('.festival-footer')) return;
    if (document.body.classList.contains('page-festival')) return;

    var links = global.SiteLinks || {};
    var local = links.LOCAL || {};
    var href = links.href || function (key) {
      return local[key] || '#';
    };

    var page = detectPage();
    var brand = cfg.brandName || 'La Sucursal del Café';
    var email = contact.email || '';
    var waDisplay = contact.whatsappDisplay || '';
    var waLink = whatsappUrl('Hola, tengo una consulta sobre La Sucursal del Café.');
    var crosslink = '';

    if (page === 'festival') {
      crosslink =
        '<a href="' + href('feria') + '">Registro visitante</a> · ' +
        '<a href="' + href('competencia') + '">Switch Championship</a>' +
        '<span class="site-footer-dates">' + (feria.fechaCorta || feria.fecha || '') +
        ' · ' + feriaLugar() + '</span>';
    } else if (page === 'feria') {
      crosslink =
        '¿Compites en café filtrado? <a href="' + href('competencia') + '">Inscripción Switch Championship</a>' +
        '<span class="site-footer-dates">' + (ev.fechaCorta || ev.fecha || '') +
        ' · ' + torneoLugar() + '</span>';
    } else if (page === 'torneo') {
      crosslink =
        '¿Vienes a la feria? <a href="' + href('feria') + '">Registro de visitante (opcional)</a>' +
        '<span class="site-footer-dates">' + (feria.fechaCorta || feria.fecha || '') +
        ' · ' + feriaLugar() + '</span>';
    } else {
      crosslink =
        '<a href="' + href('festival') + '">Inicio</a> · ' +
        '<a href="' + href('feria') + '">Feria</a> · ' +
        '<a href="' + href('competencia') + '">Switch Championship</a>' +
        '<span class="site-footer-dates">Dos eventos · inscripciones independientes</span>';
    }

    var html =
      '<footer class="site-footer" role="contentinfo">' +
      '<div class="site-footer-inner">' +
      '<p class="site-footer-event">' + brand + '</p>' +
      '<p class="site-footer-crosslink">' + crosslink + '</p>' +
      '<p class="site-footer-note">Feria y competencia organizadas por el mismo equipo. Cada evento tiene fechas, sede e inscripción propias.</p>';

    if (email || waDisplay) {
      html += '<p class="site-footer-contact">';
      if (email) {
        html += '<a href="mailto:' + email + '">' + email + '</a>';
      }
      if (email && waDisplay) html += ' · ';
      if (waDisplay) {
        html += '<a href="' + waLink + '" target="_blank" rel="noopener noreferrer">WhatsApp ' + waDisplay + '</a>';
      }
      html += '</p>';
    }

    html +=
      '<p class="site-footer-links">' +
      '<a href="' + href('festival') + '">Inicio</a> · ' +
      '<a href="' + href('privacidad') + '">Privacidad</a> · ' +
      '<a href="' + href('comoFunciona') + '">¿Cómo funciona?</a> · ' +
      '<a href="' + href('qr') + '">QR inscripción</a>' +
      '</p>' +
      '</div></footer>';

    shell.insertAdjacentHTML('beforeend', html);
  }

  function applyFeriaVisitanteNav() {
    var visitante = (cfg.feria && cfg.feria.visitante) || {};
    var label = visitante.nav || 'Registro visitante';
    document.querySelectorAll('[data-nav="inscripcion"]').forEach(function (el) {
      el.textContent = label;
    });
    document.querySelectorAll('.festival-footer__nav a[data-link="feria"]').forEach(function (el) {
      el.textContent = label;
    });
  }

  function ensureAnalytics() {
    var path = (global.location.pathname || '').toLowerCase();
    if (path.indexOf('admin') !== -1) return;

    function loadAnalyticsScript() {
      if (document.querySelector('script[data-page-analytics]')) return;
      var a = document.createElement('script');
      a.src = 'js/analytics-tracker.js';
      a.setAttribute('data-page-analytics', '1');
      document.body.appendChild(a);
    }

    if (global.SHEETS_CONFIG && global.SHEETS_CONFIG.WEB_APP_URL) {
      loadAnalyticsScript();
      return;
    }

    var existing = document.querySelector('script[src*="sheets-config"]');
    if (existing) {
      if (global.SHEETS_CONFIG && global.SHEETS_CONFIG.WEB_APP_URL) {
        loadAnalyticsScript();
      } else {
        existing.addEventListener('load', loadAnalyticsScript);
      }
      return;
    }

    var s = document.createElement('script');
    s.src = 'js/sheets-config.js';
    s.onload = loadAnalyticsScript;
    document.body.appendChild(s);
  }

  function init() {
    if (global.SiteLinks && global.SiteLinks.apply) {
      global.SiteLinks.apply(document);
    }
    applyFeriaVisitanteNav();
    applyPageCopy();
    ensureOgMeta();
    renderSiteFooter();
    ensureAnalytics();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.SiteChrome = {
    whatsappUrl: whatsappUrl,
    feriaLugar: feriaLugar,
    torneoLugar: torneoLugar
  };
})(window);
