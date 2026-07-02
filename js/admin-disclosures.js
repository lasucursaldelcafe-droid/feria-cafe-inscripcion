/**
 * Convierte bloques .admin-card en <details> plegables para reducir ruido visual.
 */
(function (global) {
  'use strict';

  function foldTitle(card) {
    var head = card.querySelector('.admin-card__head');
    if (head) {
      var title = head.querySelector('.admin-card__title, h4, h5');
      if (title) return title.textContent.replace(/\s+/g, ' ').trim();
    }
    var direct = card.querySelector(':scope > .admin-card__title, :scope > h4, :scope > h5.admin-create-marca__title');
    if (direct) return direct.textContent.replace(/\s+/g, ' ').trim();
    return 'Sección';
  }

  function stripTitleFromCard(card) {
    var head = card.querySelector(':scope > .admin-card__head');
    if (head) {
      var title = head.querySelector('.admin-card__title');
      if (title) title.remove();
      if (!head.textContent.trim() && !head.querySelector('button, a')) {
        head.remove();
      }
      return;
    }
    var direct = card.querySelector(':scope > .admin-card__title, :scope > h4, :scope > h5.admin-create-marca__title');
    if (direct) direct.remove();
  }

  function wrapCard(card, options) {
    if (!card || card.closest('details.admin-fold') || card.classList.contains('admin-fold__inner')) {
      return null;
    }

    var opts = options || {};
    var details = document.createElement('details');
    details.className = 'admin-fold';
    if (card.id) {
      details.id = card.id;
      card.removeAttribute('id');
    }
    if (card.dataset.adminFoldOpen === 'true') {
      details.open = true;
    } else if (opts.open) {
      details.open = true;
    }
    if (card.hasAttribute('hidden')) {
      details.hidden = true;
      card.removeAttribute('hidden');
    }

    var summary = document.createElement('summary');
    summary.className = 'admin-fold__summary';
    summary.textContent = foldTitle(card);

    var inner = document.createElement('div');
    inner.className = 'admin-fold__inner';
    card.classList.forEach(function (cls) {
      if (cls !== 'admin-card') inner.classList.add(cls);
    });
    inner.classList.add('admin-card');

    stripTitleFromCard(card);
    while (card.firstChild) {
      inner.appendChild(card.firstChild);
    }

    details.appendChild(summary);
    details.appendChild(inner);
    card.parentNode.replaceChild(details, card);
    return details;
  }

  function wrapCardsIn(container, options) {
    if (!container) return;
    var cards = Array.prototype.slice.call(container.querySelectorAll(':scope > .admin-card'));
    cards.forEach(function (card, index) {
      var open = false;
      if (options && options.openFirst && index === 0) open = true;
      if (card.dataset.adminFoldOpen === 'true') open = true;
      wrapCard(card, { open: open });
    });
  }

  function init() {
    document.querySelectorAll('[data-admin-section-panel]').forEach(function (section) {
      wrapCardsIn(section, { openFirst: true });
    });

    ['adminPasaportesRoot', 'adminOperadoresRoot'].forEach(function (id) {
      var root = document.getElementById(id);
      wrapCardsIn(root, { openFirst: true });
    });
  }

  function openFold(id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'DETAILS') {
      el.hidden = false;
      el.open = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    var fold = el.closest('details.admin-fold');
    if (fold) {
      fold.hidden = false;
      fold.open = true;
      fold.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  global.AdminDisclosures = {
    init: init,
    openFold: openFold,
    wrapCardsIn: wrapCardsIn
  };
})(window);
