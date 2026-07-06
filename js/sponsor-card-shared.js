/**
 * Utilidades compartidas para tarjetas de patrocinador/marca (constitución visual).
 * Marco rectangular, object-fit contain, thumbnails Drive, fallback a iniciales.
 */
(function (global) {
  'use strict';

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

  function driveImageUrl(url, size) {
    var raw = String(url || '').trim();
    if (!raw) return '';
    var match =
      raw.match(/\/file\/d\/([^/]+)/) ||
      raw.match(/[?&]id=([^&]+)/) ||
      raw.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return (
        'https://drive.google.com/thumbnail?id=' +
        encodeURIComponent(match[1]) +
        '&sz=w' +
        (size || 400)
      );
    }
    if (/^https?:\/\//i.test(raw)) return raw;
    return raw;
  }

  function resolveImageUrl(image, size) {
    var src = String(image || '').trim();
    if (!src) return '';
    if (/^https?:\/\//i.test(src)) return driveImageUrl(src, size);
    var cfg = global.EVENT_CONFIG || {};
    var base = String(cfg.siteUrl || '').replace(/\/$/, '');
    if (!base && global.location) {
      base = global.location.origin;
    }
    var absolute = src.charAt(0) === '/' ? base + src : base ? base + '/' + src : src;
    return driveImageUrl(absolute, size);
  }

  function renderLogoWrap(options) {
    options = options || {};
    var alt = escapeHtml(options.alt || 'Logo');
    var name = options.name || options.alt || '';
    var imageUrl = options.imageUrl ? resolveImageUrl(options.imageUrl, options.size || 320) : '';
    var width = options.width || 128;
    var height = options.height || 88;

    if (imageUrl) {
      return (
        '<div class="festival-sponsor-card__logo-wrap">' +
        '<img class="festival-sponsor-card__avatar festival-sponsor-card__avatar--logo" src="' +
        escapeHtml(imageUrl) +
        '" alt="' +
        alt +
        '" width="' +
        width +
        '" height="' +
        height +
        '" loading="lazy" decoding="async">' +
        '</div>'
      );
    }

    return (
      '<div class="festival-sponsor-card__logo-wrap">' +
      '<span class="festival-sponsor-card__avatar festival-sponsor-card__avatar--placeholder" aria-hidden="true">' +
      escapeHtml(initials(name)) +
      '</span></div>'
    );
  }

  function bindLogoFallbacks(root) {
    if (!root) return;
    root.querySelectorAll('img.festival-sponsor-card__avatar--logo').forEach(function (img) {
      img.addEventListener('error', function onAvatarError() {
        img.removeEventListener('error', onAvatarError);
        var span = document.createElement('span');
        span.className =
          'festival-sponsor-card__avatar festival-sponsor-card__avatar--placeholder';
        span.setAttribute('aria-hidden', 'true');
        span.textContent = initials(img.getAttribute('alt') || '');
        img.replaceWith(span);
      });
    });
  }

  global.SponsorCardShared = {
    escapeHtml: escapeHtml,
    initials: initials,
    driveImageUrl: driveImageUrl,
    resolveImageUrl: resolveImageUrl,
    renderLogoWrap: renderLogoWrap,
    bindLogoFallbacks: bindLogoFallbacks
  };
})(window);
