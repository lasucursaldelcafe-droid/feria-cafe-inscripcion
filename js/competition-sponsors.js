/**
 * Patrocinadores V60 Championship — GET ?action=patrocinadores_competencia_publico
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

  function resolveImageUrl(image) {
    var src = String(image || '').trim();
    if (!src) return '';
    if (/^https?:\/\//i.test(src)) return src;
    var cfg = global.EVENT_CONFIG || {};
    var base = String(cfg.siteUrl || '').replace(/\/$/, '');
    if (!base && global.location) {
      base = global.location.origin;
    }
    if (src.charAt(0) === '/') return base + src;
    return base ? base + '/' + src : src;
  }

  function renderCard(sponsor) {
    var name = escapeHtml(sponsor.name || '');
    var handle = sponsor.instagramHandle ? escapeHtml(sponsor.instagramHandle) : '';
    var url = sponsor.instagramUrl || '';
    var imageUrl = resolveImageUrl(sponsor.image);
    var alt = escapeHtml(sponsor.imageAlt || sponsor.name || 'Patrocinador');
    var avatar;

    if (imageUrl) {
      avatar =
        '<img class="festival-sponsor-card__avatar" src="' +
        escapeHtml(imageUrl) +
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

  function renderInto(selector, sponsors) {
    var el = document.querySelector(selector);
    if (!el) return;
    if (!sponsors.length) {
      el.innerHTML = '';
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.innerHTML = sponsors.map(renderCard).join('');
  }

  function setSectionVisible(hasSponsors) {
    var section = document.getElementById('patrocinadores-competencia');
    if (section) section.hidden = !hasSponsors;
  }

  function loadSponsors() {
    var grids = document.querySelectorAll('[data-competition-sponsors-grid], [data-competition-sponsors-strip]');
    if (!grids.length) return;

    function apply(list) {
      renderInto('[data-competition-sponsors-grid]', list);
      renderInto('[data-competition-sponsors-strip]', list);
      setSectionVisible(list.length > 0);
    }

    if (!global.FormSubmit || typeof global.FormSubmit.fetchPatrocinadoresCompetencia !== 'function') {
      apply([]);
      return;
    }

    global.FormSubmit.fetchPatrocinadoresCompetencia().then(function (data) {
      if (!data.ok) {
        apply([]);
        return;
      }
      apply(data.patrocinadores || []);
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
