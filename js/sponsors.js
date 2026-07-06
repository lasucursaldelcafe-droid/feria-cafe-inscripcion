/**
 * Renderiza patrocinadores desde EVENT_CONFIG.sponsors.
 */
(function (global) {
  'use strict';

  var shared = global.SponsorCardShared || {};
  var escapeHtml = shared.escapeHtml || function (s) { return String(s); };
  var renderLogoWrap = shared.renderLogoWrap;
  var bindLogoFallbacks = shared.bindLogoFallbacks;

  var cfg = global.EVENT_CONFIG || {};
  var sponsors = cfg.sponsors || [];

  function renderCard(sponsor) {
    var name = escapeHtml(sponsor.name || '');
    var handle = sponsor.instagramHandle ? escapeHtml(sponsor.instagramHandle) : '';
    var url = sponsor.instagramUrl || '';
    var alt = escapeHtml(sponsor.imageAlt || sponsor.name || 'Patrocinador');
    var badge = sponsor.badge ? escapeHtml(sponsor.badge) : '';
    var tagline = sponsor.tagline ? escapeHtml(sponsor.tagline) : '';
    var description = sponsor.description ? escapeHtml(sponsor.description) : '';
    var classes = 'festival-sponsor-card' + (sponsor.featured ? ' festival-sponsor-card--featured' : '');

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
      (description ? '<p class="festival-sponsor-card__desc">' + description + '</p>' : '') +
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

  function renderInto(selector) {
    var el = document.querySelector(selector);
    if (!el || !sponsors.length) return;
    el.innerHTML = sponsors.map(renderCard).join('');
    if (bindLogoFallbacks) bindLogoFallbacks(el);
  }

  function init() {
    renderInto('[data-sponsors-grid]');
    renderInto('[data-sponsors-strip]');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
