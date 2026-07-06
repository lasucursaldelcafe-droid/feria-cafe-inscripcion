/**
 * Carrusel infinito automático para showcases del inicio (V60 y marcas).
 */
(function (global) {
  'use strict';

  var MIN_UNIQUE_ITEMS = 4;

  function prefersReducedMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function expandItems(items, minUnique) {
    var list = (items || []).slice();
    if (!list.length) return list;
    var min = minUnique || MIN_UNIQUE_ITEMS;
    while (list.length < min) {
      list = list.concat(items);
    }
    return list;
  }

  function loopHtml(items, renderCard) {
    var expanded = expandItems(items);
    var cards = expanded.map(renderCard).join('');
    return cards + cards;
  }

  function animateClassFor(track) {
    if (track.hasAttribute('data-comp-carousel-track')) {
      return 'comp-showcase__carousel-track--animate';
    }
    if (track.hasAttribute('data-marcas-carousel-track')) {
      return 'marcas-showcase__carousel-track--animate';
    }
    return '';
  }

  function isVisible(el) {
    if (!el) return false;
    if (el.hidden) return false;
    var node = el;
    while (node) {
      if (node.hidden) return false;
      node = node.parentElement;
    }
    return true;
  }

  function restartTrack(track) {
    if (!track || track.children.length < 2) return;
    if (prefersReducedMotion()) return;

    var cls = animateClassFor(track);
    if (!cls) return;

    track.classList.remove(cls);
    void track.offsetWidth;
    track.classList.add(cls);
  }

  function activateTracks(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-comp-carousel-track], [data-marcas-carousel-track]').forEach(function (track) {
      if (!isVisible(track)) return;
      restartTrack(track);
    });
  }

  function bindAutoRestart(root) {
    if (!root || root.__showcaseCarouselBound) return;
    root.__showcaseCarouselBound = true;

    root.addEventListener('click', function (ev) {
      var tab = ev.target && ev.target.closest
        ? ev.target.closest('[data-marcas-tab]')
        : null;
      if (!tab) return;
      global.requestAnimationFrame(function () {
        global.requestAnimationFrame(function () {
          activateTracks(root);
        });
      });
    });

    if (typeof global.IntersectionObserver === 'function') {
      var observer = new global.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var track = entry.target;
          if (track.matches('[data-comp-carousel-track], [data-marcas-carousel-track]')) {
            restartTrack(track);
          } else {
            activateTracks(track);
          }
        });
      }, { threshold: 0.12 });

      root.querySelectorAll('[data-comp-carousel-track], [data-marcas-carousel-track]').forEach(function (track) {
        observer.observe(track);
      });

      var section = root.closest('[id$="-showcase"], .comp-showcase-root, .marcas-showcase-root');
      if (section && section.parentElement) {
        observer.observe(section.parentElement);
      }
    }
  }

  function mount(root) {
    if (!root) return;
    activateTracks(root);
    bindAutoRestart(root);
  }

  global.ShowcaseCarousel = {
    prefersReducedMotion: prefersReducedMotion,
    expandItems: expandItems,
    loopHtml: loopHtml,
    restartTrack: restartTrack,
    activateTracks: activateTracks,
    mount: mount
  };
})(typeof window !== 'undefined' ? window : this);
