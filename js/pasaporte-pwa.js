/**
 * PWA — Pasaporte Cafetero: registro de service worker e instrucciones de instalación.
 */
(function (global) {
  'use strict';

  function registrarServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw-pasaporte.js', { scope: '/' }).catch(function (err) {
      console.warn('SW pasaporte:', err);
    });
  }

  function esIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function esStandalone() {
    return global.matchMedia('(display-mode: standalone)').matches ||
      global.navigator.standalone === true;
  }

  function mostrarBannerInstalar(containerId) {
    if (esStandalone()) return;

    var el = document.getElementById(containerId);
    if (!el) return;

    var html = '';
    if (esIos()) {
      html = '<div class="pasaporte-install">' +
        '<strong>📲 Guarda tu Pasaporte</strong>' +
        '<p>Toca <span aria-hidden="true">Compartir</span> ↗ y luego <strong>Añadir a pantalla de inicio</strong>. Así lo abres como una app sin buscar el enlace.</p>' +
        '</div>';
    } else {
      html = '<div class="pasaporte-install">' +
        '<strong>📲 Instala tu Pasaporte Cafetero</strong>' +
        '<p>Menú del navegador (⋮) → <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>. Guárdalo para abrirlo rápido en la feria.</p>' +
        '</div>';
    }
    el.innerHTML = html;
  }

  global.PasaportePWA = {
    registrarServiceWorker: registrarServiceWorker,
    mostrarBannerInstalar: mostrarBannerInstalar,
    esStandalone: esStandalone
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registrarServiceWorker);
  } else {
    registrarServiceWorker();
  }
})(window);
