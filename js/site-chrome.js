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
  var INSTAGRAM_URL = 'https://www.instagram.com/lasucursal.delcafe/';
  var INSTAGRAM_HANDLE = '@lasucursal.delcafe';

  function instagramFromConfig() {
    var fest = cfg.festival || {};
    return {
      url: fest.instagramUrl || INSTAGRAM_URL,
      handle: fest.instagram || INSTAGRAM_HANDLE
    };
  }

  function applyInstagramLink() {
    var igData = instagramFromConfig();
    if (!igData.url) return;
    var ig = document.getElementById('igLink');
    if (!ig) return;
    ig.href = igData.url;
    ig.textContent = igData.handle;
    ig.setAttribute('target', '_blank');
    ig.setAttribute('rel', 'noopener noreferrer');
    ig.setAttribute('aria-label', 'Instagram ' + igData.handle);
  }

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

    var igData = instagramFromConfig();
    if (email || waDisplay || igData.url) {
      html += '<p class="site-footer-contact">';
      if (email) {
        html += '<a href="mailto:' + email + '">' + email + '</a>';
      }
      if (email && waDisplay) html += ' · ';
      if (waDisplay) {
        html += '<a href="' + waLink + '" target="_blank" rel="noopener noreferrer">WhatsApp ' + waDisplay + '</a>';
      }
      if (igData.url) {
        if (email || waDisplay) html += ' · ';
        html += '<a href="' + igData.url + '" target="_blank" rel="noopener noreferrer" aria-label="Instagram ' +
          igData.handle + '">' + igData.handle + '</a>';
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

  function isAdminPage() {
    var path = (global.location.pathname || '').toLowerCase();
    return path.indexOf('admin') !== -1;
  }

  var WHATSAPP_FLOAT_ICON =
    '<svg class="whatsapp-float__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.883 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>' +
    '</svg>';

  function renderWhatsappFloat() {
    if (isAdminPage()) return;
    if (document.getElementById('whatsappFloat')) return;

    var href = whatsappUrl('Hola, me interesa La Sucursal del Café.');
    var btn = document.createElement('a');
    btn.id = 'whatsappFloat';
    btn.className = 'whatsapp-float';
    btn.href = href;
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
    btn.setAttribute('aria-label', 'Contactar por WhatsApp');
    btn.innerHTML = WHATSAPP_FLOAT_ICON;
    document.body.appendChild(btn);
  }

  function ensureAnalytics() {
    if (isAdminPage()) return;

    function loadAnalyticsScript() {
      if (document.querySelector('script[data-page-analytics]')) return;
      var a = document.createElement('script');
      a.src = 'js/analytics-tracker.js?v=20260621a';
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
    applyInstagramLink();
    ensureOgMeta();
    renderSiteFooter();
    renderWhatsappFloat();
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
    torneoLugar: torneoLugar,
    applyInstagramLink: applyInstagramLink,
    instagramFromConfig: instagramFromConfig
  };
})(window);
