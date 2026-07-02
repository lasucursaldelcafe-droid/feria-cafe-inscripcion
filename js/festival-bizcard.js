/**
 * Aplica layout bizcard (tarjeta de presentación) a páginas page-festival legacy.
 * index.html con data-bizcard-native="1" se omite (ya tiene markup nativo).
 */
(function (global) {
  'use strict';

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function moveChildren(from, to) {
    while (from.firstChild) {
      to.appendChild(from.firstChild);
    }
  }

  function extractPageTitle(section) {
    var title =
      section.querySelector('.section-title, .bizcard__heading, h2, h1.festival-sub-hero__title');
    if (!title) return '';
    var text = title.textContent.replace(/\s+/g, ' ').trim();
    title.remove();
    return text;
  }

  function sectionToBizcard(section) {
    var article = document.createElement('article');
    article.className = 'bizcard';

    var body = document.createElement('div');
    body.className = 'bizcard__body';

    var headingText = extractPageTitle(section);
    if (headingText) {
      var h2 = document.createElement('h2');
      h2.className = 'bizcard__heading';
      h2.textContent = headingText;
      body.appendChild(h2);
    }

    var wrap = section.querySelector('.festival-wrap') || section;
    moveChildren(wrap, body);

    article.appendChild(body);
    return article;
  }

  function heroToPagehead(hero) {
    var article = document.createElement('article');
    article.className = 'bizcard bizcard--pagehead';

    var body = document.createElement('div');
    body.className = 'bizcard__body bizcard__body--center';

    qsa('.festival-kicker, .hero-eyebrow', hero).forEach(function (el) {
      var p = document.createElement('p');
      p.className = 'bizcard__kicker';
      if (el.id) p.id = el.id;
      p.textContent = el.textContent.trim();
      body.appendChild(p);
      el.remove();
    });

    var titleEl = qs('.festival-sub-hero__title, .hero-title, h1', hero);
    if (titleEl) {
      var h1 = document.createElement('h1');
      h1.className = 'bizcard__title';
      if (titleEl.id) h1.id = titleEl.id;
      h1.textContent = titleEl.textContent.trim();
      body.appendChild(h1);
      titleEl.remove();
    }

    var leadEl = qs('.festival-sub-hero__lead, .hero-subtitle', hero);
    if (leadEl) {
      var lead = document.createElement('p');
      lead.className = 'bizcard__lead';
      if (leadEl.id) lead.id = leadEl.id;
      lead.textContent = leadEl.textContent.trim();
      body.appendChild(lead);
      leadEl.remove();
    }

    var meta = qs('.hero-meta', hero);
    if (meta) {
      var ul = document.createElement('ul');
      ul.className = 'bizcard__meta';
      ul.setAttribute('aria-label', 'Datos del evento');
      qsa('.badge, .bizcard__chip', meta).forEach(function (chip) {
        var li = document.createElement('li');
        if (chip.parentElement && chip.parentElement.tagName === 'LI') {
          li = chip.parentElement.cloneNode(true);
        } else {
          var span = document.createElement('span');
          span.className = chip.classList.contains('badge--green')
            ? 'bizcard__chip bizcard__chip--accent'
            : 'bizcard__chip';
          if (chip.id) span.id = chip.id;
          span.textContent = chip.textContent.trim();
          li.appendChild(span);
        }
        ul.appendChild(li);
      });
      if (ul.children.length) body.appendChild(ul);
      meta.remove();
    }

    var cta = qs('.festival-sub-cta, .festival-hero-cta', hero);
    if (cta) {
      var actions = document.createElement('div');
      actions.className = 'bizcard__actions';
      moveChildren(cta, actions);
      body.appendChild(actions);
      cta.remove();
    }

    article.appendChild(body);
    return article;
  }

  function buildContactBizcard(footer) {
    var article = document.createElement('article');
    article.className = 'bizcard bizcard--contact';
    article.id = footer.id || 'contacto';

    var body = document.createElement('div');
    body.className = 'bizcard__body bizcard__body--center';

    var h2 = document.createElement('h2');
    h2.className = 'bizcard__heading';
    h2.textContent = 'Contacto';
    body.appendChild(h2);

    var dates = footer.querySelector('.festival-footer__dates');
    if (dates) {
      var p = document.createElement('p');
      p.className = 'bizcard__text bizcard__text--center';
      p.innerHTML = dates.innerHTML;
      body.appendChild(p);
    } else {
      var fallback = document.createElement('p');
      fallback.className = 'bizcard__text bizcard__text--center';
      fallback.innerHTML =
        '<span data-bind="feria.fecha">29 y 30 de agosto de 2026</span><br>' +
        '<span data-bind="feria.lugar">Palmetto Plaza, Cali</span>';
      body.appendChild(fallback);
    }

    var ig = footer.querySelector('#festivalInstagram, .festival-social');
    if (ig) {
      var social = document.createElement('p');
      social.className = 'bizcard__social';
      social.id = ig.id || 'festivalInstagram';
      social.innerHTML = ig.innerHTML;
      body.appendChild(social);
    }

    var actions = document.createElement('div');
    actions.className = 'bizcard__actions bizcard__actions--contact';
    var wa = footer.querySelector('#waContact');
    var em = footer.querySelector('#emailContact');
    if (wa) actions.appendChild(wa.cloneNode(true));
    if (em) actions.appendChild(em.cloneNode(true));
    if (!wa && !em) {
      actions.innerHTML =
        '<a class="btn-submit" id="waContact" href="#">WhatsApp</a>' +
        '<a class="btn-secondary" id="emailContact" href="mailto:lasucursaldelcafe@gmail.com">Correo</a>';
    }
    body.appendChild(actions);

    var copy = footer.querySelector('.festival-footer__copy');
    var copyP = document.createElement('p');
    copyP.className = 'bizcard__copy';
    copyP.textContent = copy
      ? copy.textContent.trim()
      : '© 2026 La Sucursal del Café';
    body.appendChild(copyP);

    article.appendChild(body);
    return article;
  }

  function collapseFestivalCards() {
    qsa('.festival-grid--activities .festival-card, .festival-grid .festival-card').forEach(function (card) {
      if (card.closest('details')) return;

      var h3 = card.querySelector('h3');
      var icon = card.querySelector('.festival-card__icon');
      var title = h3 ? h3.textContent.trim() : 'Detalle';

      var details = document.createElement('details');
      details.className = 'festival-details festival-details--card';

      var summary = document.createElement('summary');
      summary.className = 'festival-details__summary festival-details__summary--card';
      summary.textContent = (icon ? icon.textContent.trim() + ' ' : '') + title;

      var inner = document.createElement('div');
      inner.className = 'festival-details__inner';
      if (icon) icon.remove();
      if (h3) h3.remove();
      moveChildren(card, inner);

      details.appendChild(summary);
      details.appendChild(inner);
      card.parentNode.replaceChild(details, card);
    });
  }

  function wrapInfoBoxes() {
    qsa('.info-box').forEach(function (box, index) {
      if (box.closest('details.festival-details')) return;
      if (box.closest('.feria-modal')) return;

      var strong = box.querySelector('strong');
      var label = strong ? strong.textContent.trim() : 'Más información';

      var details = document.createElement('details');
      details.className = 'festival-details festival-details--info';
      if (index === 0) details.open = true;

      var summary = document.createElement('summary');
      summary.className = 'festival-details__summary';
      summary.textContent = label;

      var inner = document.createElement('div');
      inner.className = 'festival-details__inner';
      if (strong) strong.remove();
      moveChildren(box, inner);

      details.appendChild(summary);
      details.appendChild(inner);
      box.parentNode.replaceChild(details, box);
    });
  }

  function upgradeMainLayout() {
    var shell = qs('.site-shell');
    var hero = qs('.site-hero');
    var main = qs('main.site-main, main.site-main--festival, .site-shell > main');
    if (!shell || !main) return;

    var layout = document.createElement('main');
    layout.className = 'bizcard-layout';
    layout.id = main.id || 'contenido';

    if (hero) {
      layout.appendChild(heroToPagehead(hero));
      hero.remove();
    }

    var sections = qsa(':scope > .festival-section, :scope > article.content-card, :scope > .content-card', main);
    if (sections.length) {
      sections.forEach(function (section) {
        layout.appendChild(sectionToBizcard(section));
      });
    } else {
      var card = document.createElement('article');
      card.className = 'bizcard';
      var body = document.createElement('div');
      body.className = 'bizcard__body';
      moveChildren(main, body);
      card.appendChild(body);
      layout.appendChild(card);
    }

    var footer = qs('.festival-footer');
    if (footer) {
      layout.appendChild(buildContactBizcard(footer));
      footer.remove();
    }

    main.replaceWith(layout);
  }

  function applyShellClasses() {
    var body = document.body;
    body.classList.add('page-festival--bizcard');

    var shell = qs('.site-shell');
    if (shell) shell.classList.add('site-shell--bizcard');

    var header = qs('.site-header');
    if (header) header.classList.add('site-header--bizcard');

    var nav = qs('.festival-nav');
    if (nav) nav.classList.add('festival-nav--bizcard');
  }

  function init() {
    var body = document.body;
    if (!body.classList.contains('page-festival')) return;
    if (body.getAttribute('data-bizcard-native') === '1') return;
    if (body.classList.contains('page-festival--bizcard-ready')) return;
    body.classList.add('page-festival--bizcard-ready');

    applyShellClasses();
    upgradeMainLayout();
    collapseFestivalCards();
    wrapInfoBoxes();

    if (global.SiteLinks && global.SiteLinks.apply) {
      global.SiteLinks.apply(document);
    }
    if (global.FestivalNav && global.FestivalNav.applyCopy) {
      global.FestivalNav.applyCopy();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.FestivalBizcard = { init: init };
})(window);
