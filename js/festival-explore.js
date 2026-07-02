/**
 * Home: pestañas de exploración y patrocinadores unificados.
 */
(function (global) {
  'use strict';

  function href(key) {
    if (global.SiteLinks && global.SiteLinks.href) {
      return global.SiteLinks.href(key);
    }
    return '#';
  }

  function initTabs(root, options) {
    if (!root) return;
    var tablist = root.querySelector('[role="tablist"]');
    var tabs = root.querySelectorAll('[role="tab"]');
    var panels = root.querySelectorAll('[role="tabpanel"]');
    if (!tablist || !tabs.length || !panels.length) return;

    function activate(id) {
      tabs.forEach(function (tab) {
        var selected = tab.getAttribute('data-tab') === id;
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
        tab.tabIndex = selected ? 0 : -1;
        tab.classList.toggle('is-active', selected);
      });
      panels.forEach(function (panel) {
        var show = panel.getAttribute('data-panel') === id;
        panel.hidden = !show;
        panel.classList.toggle('is-active', show);
      });
      if (options && options.onChange) options.onChange(id);
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        activate(tab.getAttribute('data-tab'));
      });
      tab.addEventListener('keydown', function (event) {
        var idx = Array.prototype.indexOf.call(tabs, tab);
        var next = -1;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          next = (idx + 1) % tabs.length;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          next = (idx - 1 + tabs.length) % tabs.length;
        } else if (event.key === 'Home') {
          next = 0;
        } else if (event.key === 'End') {
          next = tabs.length - 1;
        } else {
          return;
        }
        event.preventDefault();
        tabs[next].focus();
        activate(tabs[next].getAttribute('data-tab'));
      });
    });

    var initial = root.getAttribute('data-initial-tab') || tabs[0].getAttribute('data-tab');
    activate(initial);
  }

  function renderExplore() {
    var mount = document.getElementById('festivalExplore');
    if (!mount) return;

    var cfg = global.EVENT_CONFIG || {};
    var fest = cfg.festival || {};
    var items = fest.explore || [];
    if (!items.length) return;

    var intro = document.getElementById('festivalExploreIntro');
    if (intro && fest.exploreIntro) intro.textContent = fest.exploreIntro;

    var tabsHtml = '';
    var panelsHtml = '';
    items.forEach(function (item, index) {
      var tabId = 'explore-tab-' + item.id;
      var panelId = 'explore-panel-' + item.id;
      var selected = index === 0;
      tabsHtml +=
        '<button type="button" role="tab" class="festival-explore__tab" id="' + tabId + '" ' +
        'data-tab="' + item.id + '" aria-controls="' + panelId + '" ' +
        'aria-selected="' + (selected ? 'true' : 'false') + '" tabindex="' + (selected ? '0' : '-1') + '">' +
        '<span class="festival-explore__tab-icon" aria-hidden="true">' + (item.icon || '') + '</span>' +
        '<span>' + item.label + '</span></button>';

      panelsHtml +=
        '<div role="tabpanel" class="festival-explore__panel" id="' + panelId + '" ' +
        'data-panel="' + item.id + '" aria-labelledby="' + tabId + '" ' +
        (selected ? '' : 'hidden') + '>' +
        '<p class="festival-explore__text">' + item.text + '</p>' +
        '<a class="festival-explore__cta" data-link="' + item.link + '" href="' + href(item.link) + '">' +
        (item.cta || 'Ver más') + ' →</a></div>';
    });

    mount.innerHTML =
      '<div class="festival-explore__tabs" role="tablist" aria-label="Explorar el festival">' +
      tabsHtml +
      '</div><div class="festival-explore__panels">' + panelsHtml + '</div>';

    if (global.SiteLinks && global.SiteLinks.apply) {
      global.SiteLinks.apply(mount);
    }

    initTabs(mount);
  }

  function renderQuickLinks() {
    var nav = document.getElementById('festivalQuickLinks');
    if (!nav) return;

    var links = [
      { key: 'patrocinadores', label: 'Patrocinadores' },
      { key: 'stands', label: 'Stands' },
      { key: 'fidelizacion', label: 'Pasaporte' },
      { key: 'comoFunciona', label: 'Cómo funciona' }
    ];

    nav.innerHTML = links
      .map(function (item) {
        return (
          '<a class="festival-quick-link" data-link="' + item.key + '" href="' + href(item.key) + '">' +
          item.label +
          '</a>'
        );
      })
      .join('');

    if (global.SiteLinks && global.SiteLinks.apply) {
      global.SiteLinks.apply(nav);
    }
  }

  function initSponsorTabs() {
    var root = document.getElementById('festivalSponsorsUnified');
    if (!root) return;
    initTabs(root, {
      onChange: function (id) {
        var feriaPanel = root.querySelector('[data-panel="feria"]');
        var compPanel = root.querySelector('[data-panel="competencia"]');
        if (feriaPanel) feriaPanel.hidden = id !== 'feria';
        if (compPanel) compPanel.hidden = id !== 'competencia';
      }
    });
  }

  function init() {
    renderExplore();
    renderQuickLinks();
    initSponsorTabs();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.FestivalExplore = { init: init };
})(window);
