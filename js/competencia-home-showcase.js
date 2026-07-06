/**
 * V60 Championship — carrusel de competidores y podio en el inicio.
 * Configurable desde admin (competencia_home_showcase en Apps Script).
 */
(function (global) {
  'use strict';

  var ROOT_ID = 'competenciaHomeShowcase';
  var SECTION_ID = 'competencia-showcase';

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getWebAppUrl() {
    var cfg = global.SHEETS_CONFIG || {};
    return String(cfg.WEB_APP_URL || '').trim();
  }

  function driveThumbUrl(url, size) {
    if (!url) return '';
    var s = String(url).trim();
    var m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w' + (size || 320);
    if (/^https?:\/\//i.test(s)) return s;
    return '';
  }

  function resolveHref(href) {
    var path = String(href || '').trim();
    if (!path) return '#';
    if (/^https?:\/\//i.test(path)) return path;
    if (global.SiteLinks && global.SiteLinks.resolve) {
      return global.SiteLinks.resolve(path);
    }
    return path;
  }

  function photoHtml(fotoUrl, alt, sizeClass) {
    var thumb = driveThumbUrl(fotoUrl, 400);
    var cls = 'comp-showcase__photo' + (sizeClass ? ' ' + sizeClass : '');
    if (!thumb) {
      var initials = String(alt || '?')
        .split(/\s+/)
        .slice(0, 2)
        .map(function (p) { return p.charAt(0); })
        .join('')
        .toUpperCase();
      return '<span class="' + cls + ' comp-showcase__photo--empty" aria-hidden="true">' +
        escapeHtml(initials) + '</span>';
    }
    return '<img class="' + cls + '" src="' + escapeHtml(thumb) + '" alt="' +
      escapeHtml(alt || '') + '" loading="lazy" decoding="async" referrerpolicy="no-referrer">';
  }

  function medalClass(pos) {
    if (pos === 1) return 'comp-showcase__podium-slot--gold';
    if (pos === 2) return 'comp-showcase__podium-slot--silver';
    if (pos === 3) return 'comp-showcase__podium-slot--bronze';
    return '';
  }

  function podiumOrder(podio) {
    if (!podio || podio.length < 2) return podio || [];
    if (podio.length >= 3) {
      var byPos = {};
      podio.forEach(function (p) { byPos[p.posicion] = p; });
      return [byPos[2], byPos[1], byPos[3]].filter(Boolean);
    }
    return podio.slice();
  }

  function renderPodium(podio) {
    if (!podio || !podio.length) return '';
    var slots = podiumOrder(podio).map(function (row) {
      var meta = row.representa || row.ciudad || '';
      var pts = row.puntos != null && row.puntos !== '' ? '<span class="comp-showcase__podium-pts">' +
        escapeHtml(String(row.puntos)) + ' pts</span>' : '';
      var elevate = row.posicion === 1 ? ' comp-showcase__podium-slot--first' : '';
      return '<article class="comp-showcase__podium-slot ' + medalClass(row.posicion) + elevate + '">' +
        '<span class="comp-showcase__podium-medal" aria-hidden="true">' + row.posicion + '°</span>' +
        '<div class="comp-showcase__podium-photo-wrap">' + photoHtml(row.fotoUrl, row.nombre, 'comp-showcase__photo--podium') + '</div>' +
        '<h3 class="comp-showcase__podium-name">' + escapeHtml(row.nombre) + '</h3>' +
        (meta ? '<p class="comp-showcase__podium-meta">' + escapeHtml(meta) + '</p>' : '') +
        pts +
        '</article>';
    }).join('');
    return '<section class="comp-showcase__podium" aria-label="Podio oficial">' +
      '<h3 class="comp-showcase__section-title">Podio oficial</h3>' +
      '<div class="comp-showcase__podium-map">' + slots + '</div>' +
      '</section>';
  }

  function renderCarousel(carrusel) {
    if (!carrusel || !carrusel.length) return '';
    var cards = carrusel.map(function (row) {
      var meta = row.representa || row.ciudad || '';
      return '<article class="comp-showcase__card">' +
        '<div class="comp-showcase__card-photo">' + photoHtml(row.fotoUrl, row.nombre) + '</div>' +
        '<div class="comp-showcase__card-body">' +
        '<h4 class="comp-showcase__card-name">' + escapeHtml(row.nombre) + '</h4>' +
        (meta ? '<p class="comp-showcase__card-meta">' + escapeHtml(meta) + '</p>' : '') +
        '</div></article>';
    }).join('');
    var dup = cards;
    return '<section class="comp-showcase__carousel-wrap" aria-label="Competidores">' +
      '<h3 class="comp-showcase__section-title">Competidores</h3>' +
      '<div class="comp-showcase__carousel-viewport">' +
      '<div class="comp-showcase__carousel-track" data-comp-carousel-track>' +
      cards + dup +
      '</div></div></section>';
  }

  function renderShowcase(data) {
    if (!data || data.enabled === false) return '';
    var badge = data.badge
      ? '<span class="comp-showcase__badge">' + escapeHtml(data.badge) + '</span>'
      : '';
    var desc = data.descripcion
      ? '<p class="comp-showcase__desc">' + escapeHtml(data.descripcion) + '</p>'
      : '';
    var podio = data.mostrarPodio !== false ? renderPodium(data.podio) : '';
    var carousel = data.mostrarCarrusel !== false ? renderCarousel(data.carrusel) : '';
    if (!podio && !carousel) return '';

    var actions = '';
    if (data.ctaLabel || data.resultadosLabel) {
      actions = '<div class="comp-showcase__actions">';
      if (data.ctaLabel) {
        actions += '<a class="btn-submit comp-showcase__cta" href="' +
          escapeHtml(resolveHref(data.ctaHref)) + '">' + escapeHtml(data.ctaLabel) + '</a>';
      }
      if (data.resultadosLabel) {
        actions += '<a class="btn-secondary comp-showcase__cta-secondary" href="' +
          escapeHtml(resolveHref(data.resultadosHref)) + '">' + escapeHtml(data.resultadosLabel) + '</a>';
      }
      actions += '</div>';
    }

    return '<div class="comp-showcase">' +
      '<header class="comp-showcase__header">' +
      badge +
      '<h2 class="comp-showcase__title">' + escapeHtml(data.titulo || 'V60 Championship') + '</h2>' +
      (data.subtitulo ? '<p class="comp-showcase__subtitle">' + escapeHtml(data.subtitulo) + '</p>' : '') +
      desc +
      '</header>' +
      carousel +
      podio +
      actions +
      '</div>';
  }

  function fallbackFromPreliminar1() {
    var P = global.Preliminar1Results;
    if (!P || !P.exportKit) return null;
    var kit = P.exportKit();
    var inscritos = kit.inscritos || [];
    var carrusel = inscritos.map(function (ins) {
      return {
        id: ins.id,
        nombre: ins.nombre,
        ciudad: ins.ciudad || '',
        representa: ins.representa || '',
        fotoUrl: ins.fotoUrl || ''
      };
    });
    var podio = (P.getPodioFinal ? P.getPodioFinal() : []).map(function (row) {
      return {
        id: row.competidorId || '',
        nombre: row.nombreInscrito || row.participante || '',
        representa: row.representa || '',
        ciudad: row.ciudad || '',
        fotoUrl: row.fotoUrl || '',
        posicion: row.posicion,
        puntos: row.total
      };
    });
    return {
      ok: true,
      enabled: true,
      titulo: 'V60 Championship',
      subtitulo: 'Primera Preliminar — Resultados oficiales',
      descripcion: '12 baristas en duelos 1v1. Podio oficial de la primera preliminar del circuito V60.',
      badge: 'Reto V60',
      mostrarPodio: true,
      mostrarCarrusel: true,
      carrusel: carrusel,
      podio: podio,
      ctaLabel: 'Inscripción V60',
      ctaHref: 'competencia.html',
      resultadosLabel: 'Ver resultados',
      resultadosHref: 'jurado/resultados',
      source: 'preliminar-1-fallback'
    };
  }

  function mergeApiWithFallback(apiData) {
    var fb = fallbackFromPreliminar1();
    if (!apiData || !apiData.ok) return fb;
    if (apiData.enabled === false) return null;
    var merged = Object.assign({}, apiData);
    if ((!merged.podio || !merged.podio.length) && fb && fb.podio && fb.podio.length) {
      merged.podio = fb.podio;
    }
    if ((!merged.carrusel || !merged.carrusel.length) && fb && fb.carrusel && fb.carrusel.length) {
      merged.carrusel = fb.carrusel;
    }
    return merged;
  }

  function mountCarouselMotion(root) {
    var track = root.querySelector('[data-comp-carousel-track]');
    if (!track || track.children.length < 2) return;
    var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    track.classList.add('comp-showcase__carousel-track--animate');
  }

  function mount(data) {
    var root = document.getElementById(ROOT_ID);
    var section = document.getElementById(SECTION_ID);
    if (!root) return;

    var payload = mergeApiWithFallback(data);
    if (!payload) {
      if (section) section.hidden = true;
      root.innerHTML = '';
      return;
    }

    var html = renderShowcase(payload);
    if (!html) {
      if (section) section.hidden = true;
      root.innerHTML = '';
      return;
    }

    root.innerHTML = html;
    if (section) section.hidden = false;
    mountCarouselMotion(root);
  }

  function load() {
    var url = getWebAppUrl();
    if (!url) {
      mount(fallbackFromPreliminar1());
      return;
    }
    var requestUrl = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'action=competencia_resumen_publico';
    fetch(requestUrl, { cache: 'no-store', mode: 'cors' })
      .then(function (res) { return res.json(); })
      .then(function (data) { mount(data); })
      .catch(function () { mount(fallbackFromPreliminar1()); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }

  global.CompetenciaHomeShowcase = {
    mount: mount,
    load: load,
    fallbackFromPreliminar1: fallbackFromPreliminar1,
    renderShowcase: renderShowcase
  };
})(typeof window !== 'undefined' ? window : this);
