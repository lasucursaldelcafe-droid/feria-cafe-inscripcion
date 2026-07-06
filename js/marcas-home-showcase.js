/**
 * Patrocinadores y marcas inscritas — carrusel en el inicio (estilo V60 showcase).
 */
(function (global) {
  'use strict';

  var ROOT_ID = 'marcasHomeShowcase';
  var SECTION_ID = 'marcas-showcase';

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
    var m = s.match(/\/file\/d\/([^/]+)/) ||
      s.match(/[?&]id=([^&]+)/) ||
      s.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m && m[1]) {
      return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(m[1]) + '&sz=w' + (size || 320);
    }
    if (/^https?:\/\//i.test(s)) return s;
    return '';
  }

  function resolveLocalImage(image) {
    var src = String(image || '').trim();
    if (!src) return '';
    if (/^https?:\/\//i.test(src)) return src;
    var cfg = global.EVENT_CONFIG || {};
    var base = String(cfg.siteUrl || '').replace(/\/$/, '');
    if (!base && global.location) base = global.location.origin;
    if (src.charAt(0) === '/') return base + src;
    return base ? base + '/' + src : src;
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

  function initials(name) {
    return String(name || '')
      .split(/\s+/)
      .slice(0, 2)
      .map(function (p) { return p.charAt(0); })
      .join('')
      .toUpperCase();
  }

  function logoHtml(imageUrl, alt, variant) {
    var cls = 'marcas-showcase__logo' + (variant ? ' ' + variant : '');
    if (!imageUrl) {
      return '<span class="' + cls + ' marcas-showcase__logo--empty" aria-hidden="true">' +
        escapeHtml(initials(alt)) + '</span>';
    }
    return '<img class="' + cls + '" src="' + escapeHtml(imageUrl) + '" alt="' +
      escapeHtml(alt || '') + '" loading="lazy" decoding="async" referrerpolicy="no-referrer">';
  }

  function renderBrandCard(item) {
    var link = item.url ? '<a class="marcas-showcase__card-link" href="' +
      escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer" aria-label="' +
      escapeHtml(item.name) + '">' : '<div class="marcas-showcase__card-link">';
    var linkEnd = item.url ? '</a>' : '</div>';
    var badge = item.badge
      ? '<span class="marcas-showcase__card-badge">' + escapeHtml(item.badge) + '</span>'
      : '';
    var meta = item.meta
      ? '<p class="marcas-showcase__card-meta">' + escapeHtml(item.meta) + '</p>'
      : '';
    return '<article class="marcas-showcase__card">' +
      link +
      '<div class="marcas-showcase__card-logo-wrap">' + logoHtml(item.imageUrl, item.name) + '</div>' +
      badge +
      '<h4 class="marcas-showcase__card-name">' + escapeHtml(item.name) + '</h4>' +
      meta +
      linkEnd +
      '</article>';
  }

  function renderCarousel(items, label) {
    if (!items || !items.length) {
      return '<section class="marcas-showcase__carousel-wrap" aria-label="' + escapeHtml(label) + '">' +
        '<p class="marcas-showcase__empty">Próximamente más marcas confirmadas.</p></section>';
    }
    var cards = items.map(renderBrandCard).join('');
    return '<section class="marcas-showcase__carousel-wrap" aria-label="' + escapeHtml(label) + '">' +
      '<div class="marcas-showcase__carousel-viewport">' +
      '<div class="marcas-showcase__carousel-track" data-marcas-carousel-track>' +
      cards + cards +
      '</div></div></section>';
  }

  function renderTabs(activeTab) {
    var tabs = [
      { id: 'marcas', label: 'Marcas inscritas' },
      { id: 'patrocinadores', label: 'Patrocinadores' }
    ];
    return '<div class="marcas-showcase__tabs" role="tablist" aria-label="Marcas y patrocinadores">' +
      tabs.map(function (tab) {
        var active = tab.id === activeTab;
        return '<button type="button" role="tab" class="marcas-showcase__tab' +
          (active ? ' is-active' : '') + '" data-marcas-tab="' + tab.id + '"' +
          ' aria-selected="' + (active ? 'true' : 'false') + '"' +
          ' tabindex="' + (active ? '0' : '-1') + '">' + escapeHtml(tab.label) + '</button>';
      }).join('') +
      '</div>';
  }

  function renderShowcase(data) {
    if (!data) return '';
    var activeTab = data.activeTab || 'marcas';
    var marcasPanel = activeTab === 'marcas' ? '' : ' hidden';
    var patrocPanel = activeTab === 'patrocinadores' ? '' : ' hidden';

    return '<div class="marcas-showcase comp-showcase marcas-showcase--light">' +
      '<header class="comp-showcase__header marcas-showcase__header">' +
      '<span class="comp-showcase__badge marcas-showcase__badge">Ecosistema feria</span>' +
      '<h2 class="comp-showcase__title marcas-showcase__title">Marcas y patrocinadores</h2>' +
      '<p class="comp-showcase__subtitle marcas-showcase__subtitle">Quienes hacen posible La Sucursal del Café</p>' +
      '<p class="comp-showcase__desc marcas-showcase__desc">Expositores confirmados, aliados del festival y marcas que respaldan el V60 Championship.</p>' +
      '</header>' +
      renderTabs(activeTab) +
      '<div role="tabpanel" class="marcas-showcase__panel" data-marcas-panel="marcas"' + marcasPanel + '>' +
      renderCarousel(data.marcas, 'Marcas inscritas en la feria') +
      '</div>' +
      '<div role="tabpanel" class="marcas-showcase__panel" data-marcas-panel="patrocinadores"' + patrocPanel + '>' +
      renderCarousel(data.patrocinadores, 'Patrocinadores del festival y V60') +
      '</div>' +
      '<div class="comp-showcase__actions marcas-showcase__actions">' +
      '<a class="btn-submit comp-showcase__cta marcas-showcase__cta" href="' +
      escapeHtml(resolveHref('marcas.html')) + '">Ver marcas</a>' +
      '<a class="btn-secondary comp-showcase__cta-secondary marcas-showcase__cta-secondary" href="' +
      escapeHtml(resolveHref('patrocinadores.html')) + '">Planes de patrocinio</a>' +
      '</div></div>';
  }

  function mapParticipante(p) {
    var logos = p.logos || [];
    var logo = logos[0] || {};
    var imageUrl = driveThumbUrl(logo.url, 400);
    var tipo = String(p.tipo || '').trim();
    var badge = tipo === 'expositor' ? 'Expositor' :
      tipo === 'patrocinador' ? 'Patrocinador' :
      tipo === 'aliado' ? 'Aliado' : 'Marca';
    return {
      name: p.marca || 'Marca',
      imageUrl: imageUrl,
      url: p.redUrl || '',
      badge: badge,
      meta: p.standId ? 'Stand ' + p.standId : (p.descripcion || '').slice(0, 48)
    };
  }

  function mapFeriaSponsor(s) {
    return {
      name: s.name || 'Patrocinador',
      imageUrl: resolveLocalImage(s.image),
      url: s.instagramUrl || '',
      badge: s.badge || 'Feria',
      meta: s.tagline || s.instagramHandle || ''
    };
  }

  function mapCompSponsor(s) {
    return {
      name: s.name || 'Patrocinador',
      imageUrl: resolveLocalImage(s.image),
      url: s.instagramUrl || '',
      badge: 'V60',
      meta: s.instagramHandle || ''
    };
  }

  function feriaSponsorsFallback() {
    var cfg = global.EVENT_CONFIG || {};
    return (cfg.sponsors || []).map(mapFeriaSponsor);
  }

  function loadMarcas() {
    if (global.FormSubmit && typeof global.FormSubmit.fetchParticipantesPublico === 'function') {
      return global.FormSubmit.fetchParticipantesPublico().then(function (data) {
        if (!data.ok) return [];
        return (data.participantes || []).map(mapParticipante);
      }).catch(function () { return []; });
    }
    return Promise.resolve([]);
  }

  function loadPatrocinadores() {
    var feria = feriaSponsorsFallback();
    if (!global.FormSubmit || typeof global.FormSubmit.fetchPatrocinadoresCompetencia !== 'function') {
      return Promise.resolve(feria);
    }
    return global.FormSubmit.fetchPatrocinadoresCompetencia().then(function (data) {
      var comp = data.ok ? (data.patrocinadores || []).map(mapCompSponsor) : [];
      var seen = {};
      var merged = feria.concat(comp).filter(function (item) {
        var key = String(item.name || '').toLowerCase();
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
      return merged.length ? merged : feria;
    }).catch(function () { return feria; });
  }

  function mountCarouselMotion(root) {
    root.querySelectorAll('[data-marcas-carousel-track]').forEach(function (track) {
      if (track.children.length < 2) return;
      var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) return;
      track.classList.add('marcas-showcase__carousel-track--animate');
    });
  }

  function bindTabs(root) {
    var tabs = root.querySelectorAll('[data-marcas-tab]');
    if (!tabs.length) return;
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var id = tab.getAttribute('data-marcas-tab');
        tabs.forEach(function (t) {
          var active = t === tab;
          t.classList.toggle('is-active', active);
          t.setAttribute('aria-selected', active ? 'true' : 'false');
          t.setAttribute('tabindex', active ? '0' : '-1');
        });
        root.querySelectorAll('[data-marcas-panel]').forEach(function (panel) {
          var show = panel.getAttribute('data-marcas-panel') === id;
          panel.hidden = !show;
        });
        mountCarouselMotion(root);
      });
    });
  }

  function bindLogoFallbacks(root) {
    root.querySelectorAll('img.marcas-showcase__logo').forEach(function (img) {
      img.addEventListener('error', function onErr() {
        img.removeEventListener('error', onErr);
        var span = document.createElement('span');
        span.className = 'marcas-showcase__logo marcas-showcase__logo--empty';
        span.setAttribute('aria-hidden', 'true');
        span.textContent = initials(img.getAttribute('alt') || '');
        img.replaceWith(span);
      });
    });
  }

  function mount(payload) {
    var root = document.getElementById(ROOT_ID);
    var section = document.getElementById(SECTION_ID);
    if (!root) return;

    var marcas = payload.marcas || [];
    var patrocinadores = payload.patrocinadores || [];
    if (!marcas.length && !patrocinadores.length) {
      if (section) section.hidden = true;
      root.innerHTML = '';
      return;
    }

    var html = renderShowcase({
      marcas: marcas,
      patrocinadores: patrocinadores,
      activeTab: marcas.length ? 'marcas' : 'patrocinadores'
    });
    root.innerHTML = html;
    if (section) section.hidden = false;
    bindTabs(root);
    bindLogoFallbacks(root);
    mountCarouselMotion(root);
  }

  function load() {
    Promise.all([loadMarcas(), loadPatrocinadores()]).then(function (results) {
      mount({ marcas: results[0], patrocinadores: results[1] });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }

  global.MarcasHomeShowcase = {
    mount: mount,
    load: load,
    renderShowcase: renderShowcase
  };
})(typeof window !== 'undefined' ? window : this);
