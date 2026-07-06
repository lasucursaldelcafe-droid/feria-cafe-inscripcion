/**
 * Patrocinadores V60 Championship — GET ?action=patrocinadores_competencia_publico
 */
(function (global) {
  'use strict';

  var shared = global.SponsorCardShared || {};
  var escapeHtml = shared.escapeHtml || function (s) { return String(s); };
  var renderLogoWrap = shared.renderLogoWrap;
  var bindLogoFallbacks = shared.bindLogoFallbacks;

  function renderCard(sponsor) {
    var name = escapeHtml(sponsor.name || '');
    var handle = sponsor.instagramHandle ? escapeHtml(sponsor.instagramHandle) : '';
    var url = sponsor.instagramUrl || '';
    var alt = escapeHtml(sponsor.imageAlt || sponsor.name || 'Patrocinador');
    var lowerName = String(sponsor.name || '').toLowerCase();
    var featured = /ghost|medium|más|mas/.test(lowerName);
    var badge = featured ? (lowerName.indexOf('ghost') !== -1 ? 'Café invitado' : 'Coffee Shop') : '';
    var tagline = featured
      ? lowerName.indexOf('ghost') !== -1
        ? 'Café especial con identidad propia'
        : 'Café de especialidad para descubrir en feria'
      : '';
    var classes = 'festival-sponsor-card' + (featured ? ' festival-sponsor-card--featured' : '');

    var avatar = renderLogoWrap
      ? renderLogoWrap({
          imageUrl: sponsor.image,
          alt: sponsor.imageAlt || sponsor.name || 'Patrocinador',
          name: sponsor.name,
          size: 320,
          width: 128,
          height: 88
        })
      : '';

    var inner =
      avatar +
      (badge ? '<span class="festival-sponsor-card__badge">' + badge + '</span>' : '') +
      '<span class="festival-sponsor-card__name">' +
      name +
      '</span>' +
      (tagline ? '<span class="festival-sponsor-card__tagline">' + tagline + '</span>' : '') +
      (handle ? '<span class="festival-sponsor-card__handle">' + handle + '</span>' : '');

    if (url) {
      return (
        '<li class="' + classes + '">' +
        '<a class="festival-sponsor-card__link" href="' +
        escapeHtml(url) +
        '" target="_blank" rel="noopener noreferrer" aria-label="Instagram ' +
        name +
        '">' +
        inner +
        '</a></li>'
      );
    }

    return '<li class="' + classes + '"><div class="festival-sponsor-card__link">' + inner + '</div></li>';
  }

  function renderInto(selector, sponsors, options) {
    options = options || {};
    var el = document.querySelector(selector);
    if (!el) return;
    if (!sponsors || !sponsors.length) {
      if (options.fallbackHtml) {
        el.innerHTML = options.fallbackHtml;
        el.hidden = false;
      } else {
        el.innerHTML = '';
        el.hidden = true;
      }
      return;
    }
    el.hidden = false;
    el.innerHTML = sponsors.map(renderCard).join('');
    if (bindLogoFallbacks) bindLogoFallbacks(el);
  }

  function setSectionVisible() {
    var section = document.getElementById('patrocinadores-competencia');
    if (section) section.hidden = false;
  }

  function loadSponsors() {
    var grids = document.querySelectorAll('[data-competition-sponsors-grid], [data-competition-sponsors-strip]');
    if (!grids.length) return;

    var fallbackHtml =
      '<li class="festival-sponsors__empty">Patrocinadores del V60 Championship — próximamente.</li>';

    function apply(list, opts) {
      renderInto('[data-competition-sponsors-grid]', list, opts);
      renderInto('[data-competition-sponsors-strip]', list, opts);
      setSectionVisible();
    }

    if (!global.FormSubmit || typeof global.FormSubmit.fetchPatrocinadoresCompetencia !== 'function') {
      apply([], { fallbackHtml: fallbackHtml });
      return;
    }

    global.FormSubmit.fetchPatrocinadoresCompetencia().then(function (data) {
      if (!data.ok) {
        apply([], { fallbackHtml: fallbackHtml });
        return;
      }
      var list = data.patrocinadores || [];
      if (!list.length) {
        apply([], { fallbackHtml: fallbackHtml });
        return;
      }
      apply(list);
    }).catch(function () {
      apply([], { fallbackHtml: fallbackHtml });
    });
  }

  function init() {
    loadSponsors();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
