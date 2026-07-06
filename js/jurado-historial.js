/**
 * Página Historial de competencias — Consola principal V60.
 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function historialPageUrl(extra) {
    if (window.SiteLinks && window.SiteLinks.buildJuradoUrls) {
      return window.SiteLinks.buildJuradoUrls().historial + (extra || '');
    }
    var ev = window.EVENT_CONFIG || {};
    var site = String(ev.siteUrl || window.location.origin).replace(/\/$/, '');
    var isLocal = window.location.protocol === 'file:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
    var base = isLocal ? 'jurado-historial.html' : site + '/jurado/historial';
    return base + (extra || '');
  }

  function hubUrl() {
    if (window.SiteLinks && window.SiteLinks.buildJuradoUrls) {
      return window.SiteLinks.buildJuradoUrls().hub;
    }
    return historialPageUrl().replace('jurado-historial.html', 'jurado-v60.html').replace('/jurado/historial', '/jurado-v60');
  }

  function bindDownloadButtons(root) {
    if (!root) return;
    root.querySelectorAll('[data-history-download]').forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-history-download');
        if (window.CompetitionHistory && window.CompetitionHistory.downloadEditionKit(id)) return;
        alert('Kit no disponible para esta edición.');
      });
    });
  }

  function renderList() {
    var listBox = $('historialList');
    var detailBox = $('historialDetail');
    if (!listBox || !window.CompetitionHistory) return;

    var editions = window.CompetitionHistory.getEditions();
    listBox.innerHTML = window.CompetitionHistory.renderEditionsList(editions, {
      detailBaseUrl: historialPageUrl('?'),
      showActions: true
    });
    bindDownloadButtons(listBox);

    var params = new URLSearchParams(window.location.search);
    var editionId = params.get('edicion');
    if (editionId && detailBox) {
      var edition = window.CompetitionHistory.getEdition(editionId);
      detailBox.hidden = false;
      detailBox.innerHTML = window.CompetitionHistory.renderEditionDetail(edition);
      if ($('historialDetailTitle')) {
        $('historialDetailTitle').textContent = edition ? edition.nombre : 'Detalle';
      }
      detailBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (detailBox) {
      detailBox.hidden = true;
      detailBox.innerHTML = '';
    }
  }

  function applyBranding() {
    var ev = window.EVENT_CONFIG || {};
    var logo = $('headerLogo');
    if (logo) logo.src = ev.logoUrl || 'assets/logo-la-sucursal-del-cafe.png';
    var sub = $('headerSubtitle');
    if (sub) sub.textContent = 'Archivo de ediciones y resultados del circuito V60';
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyBranding();
    renderList();
    var back = $('historialBackBtn');
    if (back) back.href = hubUrl();
  });
})();
