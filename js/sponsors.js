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
    var badge = sponsor.badge ? escapeHtml(sponsor.badge) : '';
    var tagline = sponsor.tagline ? escapeHtml(sponsor.tagline) : '';
    var description = sponsor.description ? escapeHtml(sponsor.description) : '';
    var classes = 'festival-sponsor-card' + (sponsor.featured ? ' festival-sponsor-card--featured' : '');
    var avatar;

    if (sponsor.image) {
      avatar =
        '<img class="festival-sponsor-card__avatar" src="' +
        escapeHtml(sponsor.image) +
        '" alt="' +
        alt +
        '" width="72" height="72" loading="lazy" decoding="async">';
    } else {
      avatar =
        '<span class="festival-sponsor-card__avatar festival-sponsor-card__avatar--placeholder" aria-hidden="true">' +
        escapeHtml(initials(sponsor.name)) +
        '</span>';
    }

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

  function attachAvatarFallback(root) {
    if (!root) return;
    root.querySelectorAll('img.festival-sponsor-card__avatar').forEach(function (img) {
      img.addEventListener('error', function onAvatarError() {
        img.removeEventListener('error', onAvatarError);
        var span = document.createElement('span');
        span.className = 'festival-sponsor-card__avatar festival-sponsor-card__avatar--placeholder';
        span.setAttribute('aria-hidden', 'true');
        span.textContent = initials(img.getAttribute('alt') || '');
        img.replaceWith(span);
      });
    });
  }

  function renderInto(selector) {
    var el = document.querySelector(selector);
    if (!el || !sponsors.length) return;
    el.innerHTML = sponsors.map(renderCard).join('');
    attachAvatarFallback(el);
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
