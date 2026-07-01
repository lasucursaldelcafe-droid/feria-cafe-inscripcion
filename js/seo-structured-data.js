/**
 * JSON-LD (schema.org) para buscadores — feria y V60 Championship.
 */
(function (global) {
  'use strict';

  var cfg = global.EVENT_CONFIG || {};
  var siteUrl = String(cfg.siteUrl || '').replace(/\/$/, '');
  var brand = cfg.brandName || 'La Sucursal del Café';
  var contact = cfg.contact || {};
  var feria = cfg.feria || {};
  var ev = cfg.evento1 || {};
  var pago = cfg.pago || {};

  function pageKind() {
    var path = (global.location.pathname || '').toLowerCase();
    if (path.indexOf('admin') !== -1) return null;
    if (path.indexOf('competencia') !== -1 || path.indexOf('reglas') !== -1 ||
        path.indexOf('como-funciona') !== -1) return 'torneo';
    if (path.indexOf('stands') !== -1) return 'stands';
    if (path.indexOf('privacidad') !== -1 || path.indexOf('qr') !== -1) return 'support';
    return 'feria';
  }

  function absUrl(key) {
    if (global.SiteLinks && global.SiteLinks.absUrl) {
      return global.SiteLinks.absUrl(key);
    }
    return siteUrl + '/';
  }

  function place(sede, ciudad, mapsQuery) {
    return {
      '@type': 'Place',
      name: sede,
      address: {
        '@type': 'PostalAddress',
        addressLocality: ciudad || 'Cali',
        addressRegion: 'Valle del Cauca',
        addressCountry: 'CO'
      },
      hasMap: mapsQuery
        ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(mapsQuery)
        : undefined
    };
  }

  function organizer() {
    return {
      '@type': 'Organization',
      name: brand,
      url: siteUrl + '/',
      email: contact.email || undefined,
      sameAs: (cfg.festival && cfg.festival.instagramUrl) ? [cfg.festival.instagramUrl] : undefined
    };
  }

  function feriaEvent() {
    return {
      '@type': 'Event',
      name: brand + ' — Feria de café especial',
      description:
        (feria.visitante && feria.visitante.entradaSinCosto) ||
        'Feria de café especial en Cali. Entrada gratuita.',
      startDate: feria.fechaIso || '2026-08-29',
      endDate: '2026-08-30',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      isAccessibleForFree: true,
      inLanguage: 'es-CO',
      location: place(feria.sede, feria.ciudad, feria.mapsQuery),
      organizer: organizer(),
      url: absUrl('festival'),
      image: siteUrl + '/assets/logo-la-sucursal-del-cafe.png'
    };
  }

  function torneoEvent() {
    var principal = (cfg.circuito && cfg.circuito.principal) || {};
    var preliminarLabel = ev.preliminar || ev.clasificatoria || 'Preliminar';
    var offer = pago.monto
      ? {
          '@type': 'Offer',
          price: String(pago.monto),
          priceCurrency: pago.moneda || 'COP',
          availability: 'https://schema.org/InStock',
          url: absUrl('competencia')
        }
      : undefined;

    var eventNode = {
      '@type': 'Event',
      name: 'V60 Championship — ' + preliminarLabel,
      alternateName: 'V60 Championship Cali 2026',
      description:
        'Competencia de café filtrado con V60 en Cali. Circuito: 2 preliminares + final ' +
        (principal.fecha || '29 y 30 de agosto de 2026') + '. ' + preliminarLabel + '.',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      isAccessibleForFree: false,
      inLanguage: 'es-CO',
      location: place(ev.sede, ev.ciudad, ev.mapsQuery),
      organizer: organizer(),
      offers: offer,
      url: absUrl('competencia'),
      image: siteUrl + '/assets/logo-la-sucursal-del-cafe.png'
    };
    if (ev.fechaIso) {
      eventNode.startDate = ev.fechaIso;
    }
    if (principal.fechaIso) {
      eventNode.endDate = '2026-08-30';
    }
    return eventNode;
  }

  function standsEvent() {
    return {
      '@type': 'Event',
      name: brand + ' — Stands para expositores',
      description:
        (cfg.stands && cfg.stands.intro) ||
        'Solicitud de stand para expositores en la feria de café especial en Cali.',
      startDate: feria.fechaIso || '2026-08-29',
      endDate: '2026-08-30',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      isAccessibleForFree: false,
      inLanguage: 'es-CO',
      location: place(feria.sede, feria.ciudad, feria.mapsQuery),
      organizer: organizer(),
      url: absUrl('stands'),
      image: siteUrl + '/assets/logo-la-sucursal-del-cafe.png'
    };
  }

  function websiteNode() {
    return {
      '@type': 'WebSite',
      name: brand,
      url: siteUrl + '/',
      inLanguage: 'es-CO',
      publisher: organizer()
    };
  }

  function injectGraph(nodes) {
    if (!siteUrl || !nodes.length) return;
    var payload = {
      '@context': 'https://schema.org',
      '@graph': nodes.filter(Boolean)
    };
    var el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute('data-seo-structured', '1');
    el.textContent = JSON.stringify(payload);
    document.head.appendChild(el);
  }

  function ensureStructuredData() {
    if (document.querySelector('script[data-seo-structured]')) return;
    var kind = pageKind();
    if (!kind) return;

    var nodes = [organizer()];

    if (kind === 'feria') {
      nodes.push(feriaEvent());
      var path = (global.location.pathname || '').toLowerCase();
      if (path === '/' || path === '' || path.indexOf('index') !== -1 || path.indexOf('festival') !== -1) {
        nodes.push(websiteNode());
      }
    } else if (kind === 'stands') {
      nodes.push(standsEvent());
    } else if (kind === 'torneo') {
      nodes.push(torneoEvent());
    }

    injectGraph(nodes);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureStructuredData);
  } else {
    ensureStructuredData();
  }

  global.SeoStructuredData = { ensure: ensureStructuredData };
})(window);
