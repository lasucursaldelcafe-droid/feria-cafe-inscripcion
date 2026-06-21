/**
 * Renderiza patrocinadores desde EVENT_CONFIG.sponsors.
 */
(function (global) {
  'use strict';

  var cfg = global.EVENT_CONFIG || {};
  var sponsors = cfg.sponsors || [];

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function initials(name) {
    return String(name || '')
      .split(/\s+/)
      .slice(0, 2)
      .map(function (part) {
        return part.charAt(0);
      })
      .join('')
      .toUpperCase();
  }

  function renderCard(sponsor) {
    var name = escapeHtml(sponsor.name || '');
    var handle = sponsor.instagramHandle ? escapeHtml(sponsor.instagramHandle) : '';
    var url = sponsor.instagramUrl || '';
    var alt = escapeHtml(sponsor.imageAlt || sponsor.name || 'Patrocinador');
    var avatar;

    if (sponsor.image) {
      avatar =
        '<img class="festival-sponsor-card__avatar" src="' +
        escapeHtml(sponsor.image) +
        '" alt="' +
        alt +
        '" width="72" height="72" loading="lazy">';
    } else {
      avatar =
        '<span class="festival-sponsor-card__avatar festival-sponsor-card__avatar--placeholder" aria-hidden="true">' +
        escapeHtml(initials(sponsor.name)) +
        '</span>';
    }

    var inner =
      avatar +
      '<span class="festival-sponsor-card__name">' +
      name +
      '</span>' +
      (handle ? '<span class="festival-sponsor-card__handle">' + handle + '</span>' : '');

    if (url) {
      return (
        '<li class="festival-sponsor-card">' +
        '<a class="festival-sponsor-card__link" href="' +
        escapeHtml(url) +
        '" target="_blank" rel="noopener noreferrer" aria-label="Instagram ' +
        name +
        '">' +
        inner +
        '</a></li>'
      );
    }

    return '<li class="festival-sponsor-card"><div class="festival-sponsor-card__link">' + inner + '</div></li>';
  }

  function renderInto(selector) {
    var el = document.querySelector(selector);
    if (!el || !sponsors.length) return;
    el.innerHTML = sponsors.map(renderCard).join('');
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
