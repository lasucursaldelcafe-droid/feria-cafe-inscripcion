/**
 * Modal de bienvenida — invita a inscribirse en la feria (una vez por sesión).
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'lsc_feria_modal_seen';

  function init() {
    var modal = document.getElementById('feriaModal');
    if (!modal) return;

    var panel = modal.querySelector('.feria-modal__panel');
    var closeBtns = modal.querySelectorAll('[data-modal-close]');
    var cta = modal.querySelector('[data-modal-cta]');
    var lastFocus = null;

    function trapFocus(event) {
      if (!modal.classList.contains('is-open')) return;
      if (event.key !== 'Tab' || !panel) return;
      var focusable = panel.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function openModal() {
      lastFocus = document.activeElement;
      modal.hidden = false;
      modal.classList.add('is-open');
      document.body.classList.add('modal-open');
      var closeBtn = modal.querySelector('.feria-modal__close');
      if (closeBtn) closeBtn.focus();
      document.addEventListener('keydown', onKeydown);
      document.addEventListener('keydown', trapFocus);
    }

    function closeModal(markSeen) {
      modal.classList.remove('is-open');
      modal.hidden = true;
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('keydown', trapFocus);
      if (markSeen) {
        try {
          sessionStorage.setItem(STORAGE_KEY, '1');
        } catch (e) { /* ignore */ }
      }
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    function onKeydown(event) {
      if (event.key === 'Escape') closeModal(true);
    }

    closeBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        closeModal(true);
      });
    });

    if (cta) {
      cta.addEventListener('click', function () {
        closeModal(true);
      });
    }

    function isHomePage() {
      var page = document.body.getAttribute('data-festival-page');
      if (page === 'home') return true;
      var path = (location.pathname || '').toLowerCase();
      return path === '/' || path === '' ||
        path.endsWith('/index.html') ||
        path.endsWith('/festival') ||
        path.endsWith('/festival.html');
    }

    function hasSeenModal() {
      try {
        return sessionStorage.getItem(STORAGE_KEY) === '1';
      } catch (e) {
        return false;
      }
    }

    if (isHomePage() && !hasSeenModal()) {
      setTimeout(function () {
        if (!hasSeenModal()) openModal();
      }, 1500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.FestivalModal = { init: init };
})(window);
