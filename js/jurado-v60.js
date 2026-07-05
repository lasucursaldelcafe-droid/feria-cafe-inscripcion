/**
 * Jurado V60 — panel jueces (móvil) + organizador configurable.
 * URLs:
 *   Organizador: ?pin=v60organizador
 *   Juez N:      ?pin=v60sensorial&juez=N (N según config, 1–5)
 */
(function () {
  'use strict';

  var DEFAULT_CRITERIA = [
    { key: 'aroma', label: 'Aroma', desc: 'Intensidad y calidad en seco y húmedo' },
    { key: 'dulzor', label: 'Dulzor', desc: 'Percepción de dulzor natural' },
    { key: 'acidez', label: 'Acidez', desc: 'Calidad, intensidad y tipo' },
    { key: 'sabor', label: 'Sabor', desc: 'Amplitud y complejidad del perfil' },
    { key: 'balance', label: 'Balance', desc: 'Integración armónica de atributos' },
    { key: 'cuerpo', label: 'Cuerpo', desc: 'Textura y sensación en boca' },
    { key: 'limpieza_taza', label: 'Limpieza de taza', desc: 'Ausencia de defectos u off-flavors' }
  ];

  var DEFAULT_FORM_FIELDS = [
    { key: 'nombre', label: 'Nombre completo', type: 'text', required: true, enabled: true, placeholder: 'Nombre y apellido' },
    { key: 'documento', label: 'Documento de identidad', type: 'text', required: true, enabled: true, placeholder: '' },
    { key: 'celular', label: 'Celular', type: 'tel', required: true, enabled: true, placeholder: '+57 300…' },
    { key: 'correo', label: 'Correo electrónico', type: 'email', required: true, enabled: true, placeholder: 'correo@ejemplo.com' },
    { key: 'edad', label: 'Edad', type: 'number', required: false, enabled: false, placeholder: '' },
    { key: 'ciudad', label: 'Ciudad', type: 'text', required: false, enabled: true, placeholder: '' },
    { key: 'representa', label: 'Representa (marca/finca)', type: 'text', required: false, enabled: true, placeholder: '' },
    { key: 'rol', label: 'Rol en la cadena del café', type: 'text', required: false, enabled: false, placeholder: '' },
    { key: 'experiencia', label: 'Experiencia en café', type: 'textarea', required: false, enabled: false, placeholder: '' },
    { key: 'observaciones', label: 'Notas / alergias', type: 'textarea', required: false, enabled: true, placeholder: '' }
  ];

  var PIN_JUEZ = 'v60sensorial';
  var PIN_ORGANIZADOR = 'v60organizador';
  var CONFIG_KEY = 'jurado_v60_calificaciones';
  var BRACKET_KEY = 'jurado_v60_bracket';
  var PLATFORM_KEY = 'jurado_v60_platform';
  var tenantSlug = '';
  var SESSION_KEY = 'lsc_jurado_v60_session';
  var JUDGE_PROFILE_LS = 'lsc_jurado_juez_profile';
  var REFRESH_MS = 3000;

  var WEB_APP_URL_CANONICAL =
    'https://script.google.com/macros/s/AKfycbxEVH5x6x8xj5vBFlwbkQjkEtpVNnfBoaeOwRDSk9FbF9K9_vuQFfwNBR9Kghtn2i6u/exec';

  var pin = '';
  var mode = ''; // 'judge' | 'organizer'
  var judgeNum = 0;
  var competidores = [];
  var calificacionesMap = {};
  var bracketState = null;
  var guardando = false;
  var refreshTimer = null;
  var organizerUiBound = false;
  var organizerAdminBound = false;
  var organizerManualBound = false;
  var selectedRoundNum = 0;
  var manualEditCompetidorId = '';
  var manualEditDirty = false;
  var platformConfig = null;
  var dashboardTabsBound = false;
  var platformConfigBound = false;
  var inscripcionesBound = false;
  var activeDashTab = 'vista';
  var autoAdvancing = false;
  var autoAdvanceCooldownUntil = 0;
  var pendingPanelImageDataUrl = null;
  var PAGE_MODE = (document.body && document.body.getAttribute('data-jurado-page')) || 'all';
  var HUB_MAIN_KEY = 'lsc_jurado_hub_main';
  var hubMainTournament = false;

  function isHubMode() {
    return PAGE_MODE === 'hub';
  }

  function hasHubTournamentContext() {
    return !!tenantSlug || hubMainTournament;
  }

  function readHubMainSelection() {
    try {
      return sessionStorage.getItem(HUB_MAIN_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function writeHubMainSelection(active) {
    try {
      if (active) sessionStorage.setItem(HUB_MAIN_KEY, '1');
      else sessionStorage.removeItem(HUB_MAIN_KEY);
    } catch (e) { /* ignore */ }
  }

  function initHubTournamentContext() {
    hubMainTournament = false;
    if (!isHubMode()) return;
    if (tenantSlug) return;
    hubMainTournament = readHubMainSelection();
  }

  function storageKey(base) {
    if (!tenantSlug) return base;
    return base + '__' + tenantSlug;
  }

  function initTenantFromUrl() {
    var params = getParams();
    var raw = String(params.get('evt') || '').trim().toLowerCase();
    if (raw && /^[a-z0-9][a-z0-9-]{0,48}$/.test(raw)) tenantSlug = raw;
    else tenantSlug = '';
  }

  function tenantQueryString() {
    return tenantSlug ? ('evt=' + encodeURIComponent(tenantSlug)) : '';
  }

  function appendTenantToUrl(url) {
    var q = tenantQueryString();
    if (!q) return url;
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + q;
  }

  function getAllowedDashTabs() {
    var map = {
      config: ['config', 'inscripciones', 'enlaces', 'historial', 'export'],
      organizador: ['vista', 'enlaces', 'recorrido', 'torneo', 'puntajes', 'control', 'historial'],
      all: ['vista', 'enlaces', 'recorrido', 'torneo', 'puntajes', 'control', 'config', 'inscripciones', 'historial', 'export']
    };
    return map[PAGE_MODE] || map.all;
  }

  var SETUP_WIZARD_STEPS = [
    { id: 'config', num: 1, label: 'Configurar', short: 'Marca y reglas' },
    { id: 'inscripciones', num: 2, label: 'Inscripciones', short: 'Formulario público' },
    { id: 'enlaces', num: 3, label: 'Enlaces', short: 'Compartir links' },
    { id: 'export', num: 4, label: 'Exportar', short: 'Kit del evento' }
  ];

  var setupStepperBound = false;
  var configSavedOnce = false;

  function getLinkVisual(roleKey) {
    if (roleKey === 'config') return { icon: '⚙️', tone: 'config' };
    if (roleKey === 'inscripcion') return { icon: '📝', tone: 'public' };
    if (roleKey === 'organizador') return { icon: '🏆', tone: 'live' };
    if (roleKey === 'resultados') return { icon: '📊', tone: 'results' };
    if (roleKey === 'historial') return { icon: '📚', tone: 'history' };
    if (String(roleKey).indexOf('juez') === 0) return { icon: '👨‍⚖️', tone: 'judge' };
    return { icon: '🔗', tone: 'config' };
  }

  function renderSetupStepper() {
    var nav = $('setupStepper');
    if (!nav || PAGE_MODE !== 'config') return;
    var stepOrder = ['config', 'inscripciones', 'enlaces', 'export'];
    var activeIdx = stepOrder.indexOf(activeDashTab);
    nav.innerHTML = SETUP_WIZARD_STEPS.map(function (s) {
      var idx = stepOrder.indexOf(s.id);
      var isActive = s.id === activeDashTab;
      var isDone = activeIdx > idx || (configSavedOnce && s.id === 'config');
      var cls = 'jurado-setup-step' +
        (isActive ? ' jurado-setup-step--active' : '') +
        (isDone && !isActive ? ' jurado-setup-step--done' : '');
      return '<button type="button" class="' + cls + '" data-goto-tab="' + s.id + '">' +
        '<span class="jurado-setup-step__num">' + (isDone && !isActive ? '✓' : s.num) + '</span>' +
        '<span class="jurado-setup-step__label">' + escapeHtml(s.label) + '</span>' +
        '<span class="jurado-setup-step__short">' + escapeHtml(s.short) + '</span>' +
        '</button>';
    }).join('');
    if (!setupStepperBound) {
      setupStepperBound = true;
      nav.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-goto-tab]');
        if (!btn) return;
        switchDashTab(btn.getAttribute('data-goto-tab'));
      });
    }
  }

  function updateSetupStepper() {
    if (PAGE_MODE !== 'config') return;
    renderSetupStepper();
  }

  function applyConfigModeVisuals() {
    if (PAGE_MODE !== 'config') return;
    document.body.classList.add('jurado-page--setup');
    var wizard = $('setupWizardHeader');
    if (wizard) wizard.hidden = false;
    var meta = $('setupWizardMeta');
    if (meta) {
      if (tenantSlug) {
        meta.textContent = 'ID del torneo: ' + tenantSlug;
        meta.hidden = false;
      } else {
        meta.hidden = true;
      }
    }
    renderSetupStepper();
  }

  function getEventLinkRoles() {
    var urls = getJuradoShareUrls();
    var roles = [
      { step: 5, key: 'historial', label: 'Historial de competencias', desc: 'Ediciones anteriores, rankings archivados y kits JSON.', tag: 'Archivo', url: urls.historial }
    ];

    if (!hasHubTournamentContext() && isHubMode()) {
      return roles.filter(function (r) { return r.url; });
    }

    roles = [
      { step: 1, key: 'config', label: 'Configuración del torneo', desc: 'Marca, reglas, criterios, jueces y formulario.', tag: 'Organizador', url: urls.config },
      { step: 2, key: 'inscripcion', label: 'Inscripción en línea', desc: tenantSlug ? 'Formulario público de este torneo.' : 'Formulario de registro de competidores.', tag: 'Público', url: urls.inscripcion || urls.competencia },
      { step: 3, key: 'organizador', label: 'Torneo en vivo', desc: 'Vista general, rondas, puntajes y control del día.', tag: 'Organizador', url: urls.organizador },
      { step: 4, key: 'resultados', label: 'Resultados por competidor', desc: 'Portal público: nombre + documento.', tag: 'Competidor', url: urls.resultados },
      { step: 5, key: 'historial', label: 'Historial de competencias', desc: 'Ediciones anteriores, rankings archivados y kits JSON.', tag: 'Archivo', url: urls.historial }
    ];
    for (var j = 1; j <= getJudgeCount(); j++) {
      roles.push({
        step: 5,
        key: 'juez' + j,
        label: 'Juez ' + j,
        desc: 'Calificación móvil · enlace individual.',
        tag: 'Jurado',
        url: urls['juez' + j]
      });
    }
    roles.push({
      step: 0,
      key: 'hub',
      label: 'Consola principal',
      desc: 'Mapa con todos los enlaces del torneo.',
      tag: 'Referencia',
      url: urls.hub
    });
    return roles.filter(function (r) { return r.url; });
  }

  function competenciaTorneoUrl() {
    var ev = window.EVENT_CONFIG || {};
    var site = String(ev.siteUrl || window.location.origin).replace(/\/$/, '');
    var isLocal = window.location.protocol === 'file:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
    if (isLocal) return appendTenantToUrl('competencia-torneo.html');
    return appendTenantToUrl(site + '/competencia/torneo');
  }

  function juradoPageUrl(pageKey, extraQuery) {
    var ev = window.EVENT_CONFIG || {};
    var j = ev.juradoV60 || {};
    var paths = j.paths || {};
    var site = String(ev.siteUrl || window.location.origin).replace(/\/$/, '');
    var pathMap = {
      hub: paths.hub || j.path || '/jurado-v60',
      config: paths.config || '/jurado/config',
      organizador: paths.organizador || '/jurado/organizador',
      juez: paths.juez || '/jurado/juez',
      resultados: paths.resultados || '/jurado/resultados',
      historial: paths.historial || '/jurado/historial'
    };
    var path = pathMap[pageKey] || pathMap.hub;
    if (path.indexOf('http') === 0) return path + (extraQuery || '');
    var isLocal = window.location.protocol === 'file:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
    var localFiles = {
      hub: 'jurado-v60.html',
      config: 'jurado-config.html',
      organizador: 'jurado-organizador.html',
      juez: 'jurado-juez.html',
      resultados: 'jurado-resultados.html',
      historial: 'jurado-historial.html'
    };
    if (isLocal && localFiles[pageKey]) {
      return appendTenantToUrl(localFiles[pageKey] + (extraQuery || ''));
    }
    return appendTenantToUrl(site + path + (extraQuery || ''));
  }

  function ensureEnlacesPane() {
    if ($('enlacesPaneRoot')) return;
    var organizer = $('organizerSection');
    if (!organizer) return;
    var pane = document.createElement('div');
    pane.className = 'jurado-dash-pane';
    pane.setAttribute('data-dash-pane', 'enlaces');
    pane.hidden = true;
    pane.innerHTML =
      '<div class="jurado-card jurado-card--links">' +
      '<div class="jurado-card-head">' +
      '<h2>' + (PAGE_MODE === 'config' ? '3. Enlaces del evento' : 'Enlaces del evento') + '</h2>' +
      '<p class="jurado-hint">Tras guardar la configuración, copia y comparte cada enlace con quien corresponda. Se regeneran solos si cambias PINs o número de jueces.</p>' +
      '</div>' +
      '<ol class="jurado-setup-steps">' +
      '<li><strong>Configura</strong> marca, reglas, criterios y formulario.</li>' +
      '<li><strong>Comparte inscripción</strong> con competidores.</li>' +
      '<li><strong>Día del evento:</strong> organizador + un enlace por juez.</li>' +
      '<li><strong>Resultados:</strong> portal para competidores.</li>' +
      '</ol>' +
      '<div id="enlacesPaneRoot" class="jurado-links-list"></div>' +
      '<p id="enlacesPaneCopied" class="jurado-success" hidden></p>' +
      '</div>';
    organizer.appendChild(pane);
  }

  function ensureDashTab(tabId, label, insertAfter) {
    var nav = $('dashboardNav');
    if (!nav) return;
    var btn = nav.querySelector('[data-dash-tab="' + tabId + '"]');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'jurado-dash-tab';
      btn.setAttribute('data-dash-tab', tabId);
      btn.addEventListener('click', function () {
        switchDashTab(tabId);
      });
      var anchor = insertAfter ? nav.querySelector('[data-dash-tab="' + insertAfter + '"]') : null;
      if (anchor && anchor.nextSibling) nav.insertBefore(btn, anchor.nextSibling);
      else if (anchor) nav.appendChild(btn);
      else nav.appendChild(btn);
    }
    if (label) btn.textContent = label;
  }

  function applyOrganizerDashboardNav() {
    if (PAGE_MODE !== 'organizador') return;
    ensureDashTab('enlaces', 'Enlaces', 'vista');
    ensureEnlacesPane();
    ensureHistorialPane();
  }

  function applyConfigDashboardNav() {
    if (PAGE_MODE !== 'config') return;
    var nav = $('dashboardNav');
    if (!nav) return;
    var labels = {
      config: '1. Configurar torneo',
      inscripciones: '2. Inscripciones',
      enlaces: '3. Enlaces del evento',
      export: '4. Exportar kit'
    };
    ['config', 'inscripciones', 'enlaces', 'export'].forEach(function (tabId, idx) {
      var btn = nav.querySelector('[data-dash-tab="' + tabId + '"]');
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'jurado-dash-tab';
        btn.setAttribute('data-dash-tab', tabId);
        btn.addEventListener('click', function () {
          switchDashTab(tabId);
        });
        nav.appendChild(btn);
      }
      btn.textContent = labels[tabId] || tabId;
      btn.hidden = false;
      btn.classList.toggle('jurado-dash-tab--active', tabId === activeDashTab);
      if (idx === 0 && PAGE_MODE === 'config') btn.classList.add('jurado-dash-tab--active');
    });
    ensureEnlacesPane();
    ensureHistorialPane();
  }

  function applyPageModeUI() {
    if (PAGE_MODE === 'hub') return;
    ensureEnlacesPane();
    ensureHistorialPane();
    if (PAGE_MODE === 'config') applyConfigDashboardNav();
    if (PAGE_MODE === 'organizador') applyOrganizerDashboardNav();
    var allowed = getAllowedDashTabs();
    document.querySelectorAll('.jurado-dash-tab').forEach(function (btn) {
      var tab = btn.getAttribute('data-dash-tab');
      btn.hidden = allowed.indexOf(tab) < 0;
    });
    if (allowed.indexOf(activeDashTab) < 0) {
      activeDashTab = allowed[0] || 'vista';
    }
    var nav = $('dashboardNav');
    if (nav && PAGE_MODE === 'organizador') {
      var existing = $('juradoCrossLinks');
      if (!existing) {
        existing = document.createElement('p');
        existing.id = 'juradoCrossLinks';
        existing.className = 'jurado-cross-links jurado-hint';
        nav.parentNode.insertBefore(existing, nav.nextSibling);
      }
      var cfgUrl = juradoPageUrl('config', '?pin=' + encodeURIComponent(pinOrganizadorEffective()));
      existing.innerHTML = 'Paneles: <a href="' + escapeHtml(cfgUrl) + '">Configuración</a> · ' +
        '<a href="' + escapeHtml(juradoPageUrl('resultados')) + '">Resultados competidores</a> · ' +
        '<a href="' + escapeHtml(juradoPageUrl('historial')) + '">Historial</a> · ' +
        '<a href="' + escapeHtml(juradoPageUrl('hub')) + '">Consola principal</a>';
    }
    if (nav && PAGE_MODE === 'config') {
      var existingCfg = $('juradoCrossLinks');
      if (!existingCfg) {
        existingCfg = document.createElement('p');
        existingCfg.id = 'juradoCrossLinks';
        existingCfg.className = 'jurado-cross-links jurado-hint';
        nav.parentNode.insertBefore(existingCfg, nav.nextSibling);
      }
      var orgUrl = juradoPageUrl('organizador', '?pin=' + encodeURIComponent(pinOrganizadorEffective()));
      existingCfg.innerHTML = 'Paneles: <a href="' + escapeHtml(orgUrl) + '">Torneo en vivo</a> · ' +
        '<a href="' + escapeHtml(juradoPageUrl('resultados')) + '">Resultados competidores</a> · ' +
        '<a href="' + escapeHtml(juradoPageUrl('historial')) + '">Historial</a> · ' +
        '<a href="' + escapeHtml(juradoPageUrl('hub')) + '">Consola principal</a>';
      if (tenantSlug) {
        var welcome = $('tenantSetupBanner');
        if (!welcome) {
          welcome = document.createElement('div');
          welcome.id = 'tenantSetupBanner';
          welcome.className = 'jurado-card jurado-card--tenant-welcome';
          nav.parentNode.insertBefore(welcome, nav);
        }
        welcome.innerHTML = '<h2>Configura tu torneo</h2>' +
          '<p class="jurado-hint">Personaliza marca, reglas, criterios, campos del formulario y PINs. Comparte el enlace de la pestaña <strong>Inscripciones</strong> con los competidores.</p>' +
          '<p class="jurado-meta">ID del torneo: <code>' + escapeHtml(tenantSlug) + '</code></p>';
        welcome.hidden = false;
      }
      applyConfigModeVisuals();
    }
  }

  function showHubUI() {
    hideAll();
    var hub = $('hubSection');
    if (!hub) return;
    hub.hidden = false;
    applyPlatformBranding();
    renderHubTournamentPicker();
    renderHubLinks();
    renderHubHistorialPreview();
  }

  function renderHubTournamentPicker() {
    var box = $('hubTournamentPicker');
    if (!box || !isHubMode()) return;

    if (hasHubTournamentContext()) {
      box.hidden = true;
      var active = $('hubTournamentActive');
      if (active) {
        active.hidden = false;
        var name = (platformConfig && platformConfig.eventName) || 'Torneo seleccionado';
        var slug = tenantSlug || 'principal';
        active.innerHTML =
          '<p class="jurado-hint">Mostrando enlaces de <strong>' + escapeHtml(name) + '</strong>' +
          (tenantSlug ? ' · <code>' + escapeHtml(slug) + '</code>' : ' · circuito principal') +
          ' · ' + getJudgeCount() + ' juez(es) según configuración.</p>' +
          '<button type="button" class="jurado-btn jurado-btn--secondary jurado-btn--small" id="hubChangeTournamentBtn">Cambiar torneo</button>';
        var changeBtn = $('hubChangeTournamentBtn');
        if (changeBtn && !changeBtn.dataset.bound) {
          changeBtn.dataset.bound = '1';
          changeBtn.addEventListener('click', function () {
            writeHubMainSelection(false);
            hubMainTournament = false;
            tenantSlug = '';
            var url = juradoPageUrl('hub');
            window.location.href = url.split('?')[0];
          });
        }
      }
      return;
    }

    box.hidden = false;
    var activeHide = $('hubTournamentActive');
    if (activeHide) activeHide.hidden = true;
    var list = $('hubTournamentList');
    if (!list) return;
    list.innerHTML = '<p class="jurado-hint">Cargando torneos…</p>';

    sheetsGet('jurado_instances', {}).then(function (data) {
      var instances = (data && data.instances) || [];
      var items = [];

      items.push(
        '<button type="button" class="jurado-hub-tournament" data-hub-tournament="main">' +
        '<strong>V60 Championship — La Sucursal</strong>' +
        '<span class="jurado-hint">Torneo principal del festival · sin cliente white-label</span>' +
        '</button>'
      );

      instances.slice().reverse().forEach(function (inst) {
        if (!inst || !inst.slug) return;
        items.push(
          '<button type="button" class="jurado-hub-tournament" data-hub-tournament="' + escapeHtml(inst.slug) + '">' +
          '<strong>' + escapeHtml(inst.clientName || inst.eventName || inst.slug) + '</strong>' +
          '<span class="jurado-hint">' + escapeHtml(inst.eventName || '') + ' · ' + escapeHtml(inst.slug) + '</span>' +
          '</button>'
        );
      });

      if (!instances.length) {
        list.innerHTML =
          '<p class="jurado-hint">Aún no hay torneos white-label creados en el panel admin. Puedes usar el torneo principal o crear uno nuevo desde Admin → Jurado.</p>' +
          items.join('');
      } else {
        list.innerHTML =
          '<p class="jurado-hint">Los enlaces de jurados aparecen solo después de elegir el torneo. El número de jueces sale de la configuración guardada de cada uno.</p>' +
          items.join('');
      }

      list.querySelectorAll('[data-hub-tournament]').forEach(function (btn) {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', function () {
          var slug = btn.getAttribute('data-hub-tournament');
          if (slug === 'main') {
            writeHubMainSelection(true);
            hubMainTournament = true;
            loadPlatformConfig().then(function () {
              renderHubTournamentPicker();
              renderHubLinks();
            });
            return;
          }
          var hubUrl = juradoPageUrl('hub');
          var sep = hubUrl.indexOf('?') >= 0 ? '&' : '?';
          window.location.href = hubUrl + sep + 'evt=' + encodeURIComponent(slug);
        });
      });
    }).catch(function () {
      list.innerHTML =
        '<p class="jurado-hint">No se pudo cargar la lista de torneos. Usa el torneo principal o abre con <code>?evt=slug</code> en la URL.</p>' +
        '<button type="button" class="jurado-hub-tournament" data-hub-tournament="main">' +
        '<strong>V60 Championship — La Sucursal</strong></button>';
      var fallback = list.querySelector('[data-hub-tournament="main"]');
      if (fallback) {
        fallback.addEventListener('click', function () {
          writeHubMainSelection(true);
          hubMainTournament = true;
          loadPlatformConfig().then(function () {
            renderHubTournamentPicker();
            renderHubLinks();
          });
        });
      }
    });
  }

  function renderHubHistorialPreview() {
    var box = $('hubHistorialPreview');
    if (!box || !window.CompetitionHistory) return;
    var editions = window.CompetitionHistory.getEditions();
    var historialUrl = juradoPageUrl('historial');
    box.innerHTML =
      '<div class="jurado-card-head">' +
      '<h2>Historial de competencias</h2>' +
      '<p class="jurado-hint">Consulta ediciones realizadas, podios y resultados archivados del circuito.</p>' +
      '</div>' +
      window.CompetitionHistory.renderEditionsList(editions.slice(0, 2), {
        detailBaseUrl: historialUrl + '?',
        showActions: true
      }) +
      '<p style="margin-top:14px"><a class="jurado-btn jurado-btn--secondary" href="' + escapeHtml(historialUrl) + '">Ver historial completo</a></p>';
    bindHistoryDownloadButtons(box);
  }

  function bindHistoryDownloadButtons(root) {
    if (!root || !window.CompetitionHistory) return;
    root.querySelectorAll('[data-history-download]').forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        window.CompetitionHistory.downloadEditionKit(btn.getAttribute('data-history-download'));
      });
    });
  }

  function ensureHistorialPane() {
    if ($('historialPaneRoot')) return;
    var organizer = $('organizerSection');
    if (!organizer) return;
    var pane = document.createElement('div');
    pane.className = 'jurado-dash-pane';
    pane.setAttribute('data-dash-pane', 'historial');
    pane.hidden = true;
    pane.innerHTML =
      '<div class="jurado-card jurado-card--history">' +
      '<div class="jurado-card-head jurado-card-head--toolbar">' +
      '<div>' +
      '<h2>Historial de competencias</h2>' +
      '<p class="jurado-hint">Archivo del circuito V60: preliminares, final y kits de resultados.</p>' +
      '</div>' +
      '<a class="jurado-btn jurado-btn--secondary jurado-btn--small" href="' + escapeHtml(juradoPageUrl('historial')) + '" target="_blank" rel="noopener">Abrir en página</a>' +
      '</div>' +
      '<div id="historialPaneRoot" class="jurado-history-page-list"></div>' +
      '<div id="historialPaneDetail" class="jurado-history-pane-detail" hidden></div>' +
      '</div>';
    organizer.appendChild(pane);
    var insertAfter = PAGE_MODE === 'config' ? 'inscripciones' : 'control';
    ensureDashTab('historial', 'Historial', insertAfter);
  }

  function renderCompetitionHistoryPanel() {
    ensureHistorialPane();
    var root = $('historialPaneRoot');
    if (!root || !window.CompetitionHistory) return;
    var editions = window.CompetitionHistory.getEditions();
    root.innerHTML = window.CompetitionHistory.renderEditionsList(editions, {
      detailBaseUrl: juradoPageUrl('historial') + '?',
      showActions: true
    });
    bindHistoryDownloadButtons(root);
    root.querySelectorAll('a[href*="edicion="]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var match = (link.getAttribute('href') || '').match(/edicion=([^&]+)/);
        if (!match) return;
        e.preventDefault();
        var detail = $('historialPaneDetail');
        if (!detail) return;
        var edition = window.CompetitionHistory.getEdition(decodeURIComponent(match[1]));
        detail.hidden = !edition;
        detail.innerHTML = edition ? window.CompetitionHistory.renderEditionDetail(edition) : '';
        if (edition) detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function renderHubLinks() {
    var box = $('hubLinksGrid');
    if (!box) return;
    if (!hasHubTournamentContext()) {
      box.innerHTML = '<p class="jurado-hint">Selecciona un torneo arriba para ver configuración, organizador y enlaces de cada juez.</p>';
      return;
    }
    box.innerHTML = getEventLinkRoles().filter(function (c) { return c.key !== 'hub'; }).map(function (c) {
      var vis = getLinkVisual(c.key);
      return '<a class="jurado-hub-card jurado-hub-card--' + escapeHtml(vis.tone) + '" href="' + escapeHtml(c.url) + '">' +
        '<span class="jurado-hub-tag">' + escapeHtml(c.tag) + '</span>' +
        '<span class="jurado-hub-icon" aria-hidden="true">' + vis.icon + '</span>' +
        '<strong>' + escapeHtml(c.label) + '</strong>' +
        '<p class="jurado-hint">' + escapeHtml(c.desc) + '</p></a>';
    }).join('');
  }

  function defaultPlatformConfig() {
    var ev = window.EVENT_CONFIG || {};
    var j = ev.juradoV60 || {};
    var torneo = ev.torneo || {};
    return {
      eventName: 'Jurado sensorial V60',
      eventSubtitle: 'Calificación sensorial en vivo',
      organizerName: ev.organizerName || 'La Sucursal del Café',
      logoUrl: '/assets/logo-la-sucursal-del-cafe.png',
      accentColor: '#c9a227',
      primaryColor: '#3d281c',
      pinOrganizador: j.pinOrganizador || PIN_ORGANIZADOR,
      pinJuez: j.pinJuez || PIN_JUEZ,
      tenantSlug: tenantSlug || '',
      eventId: tenantSlug || '',
      clientName: '',
      sheetName: '',
      formFields: DEFAULT_FORM_FIELDS.map(function (f) { return Object.assign({}, f); }),
      registration: {
        title: 'Inscripción competencia',
        fee: torneo.precio || '$90.000 COP',
        cupo: torneo.cupo || 36,
        fecha: torneo.fecha || 'Por confirmar',
        hora: torneo.hora || '5:30 p. m.',
        lugar: torneo.lugar || 'Por confirmar',
        contactEmail: (ev.alerts && ev.alerts.email) || '',
        whatsapp: (ev.contact && ev.contact.whatsapp) || '',
        reglamentoUrl: (ev.links && ev.links.reglas) || ''
      },
      scoring: {
        disciplina: 'filtrado',
        modo: 'duelos',
        scaleMin: 1,
        scaleMax: 5,
        jueces: 3,
        avancePorRonda: 0,
        autoAvance: true,
        competidoresEsperados: 16,
        mostrarFotos: true,
        criteria: DEFAULT_CRITERIA.map(function (c) { return Object.assign({}, c); })
      },
      panelImageDataUrl: '',
      actualizado: ''
    };
  }

  function criteriaKeyFromLabel(label, usedKeys) {
    var base = String(label || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'criterio';
    var key = base;
    var n = 2;
    while (usedKeys[key]) {
      key = base + '_' + n;
      n++;
    }
    usedKeys[key] = true;
    return key;
  }

  function normalizeCriteriaList(rawList) {
    var used = {};
    var list = Array.isArray(rawList) ? rawList : [];
    var out = list.map(function (c) {
      var label = String((c && c.label) || '').trim();
      if (!label) return null;
      var key = String((c && c.key) || '').trim();
      if (!key) key = criteriaKeyFromLabel(label, used);
      else used[key] = true;
      return {
        key: key,
        label: label,
        desc: String((c && c.desc) || '').trim()
      };
    }).filter(Boolean);
    if (!out.length) {
      return DEFAULT_CRITERIA.map(function (c) { return Object.assign({}, c); });
    }
    return out;
  }

  function normalizeFormFieldsList(rawList) {
    var defaults = DEFAULT_FORM_FIELDS;
    var byKey = {};
    defaults.forEach(function (f) { byKey[f.key] = f; });
    if (!Array.isArray(rawList) || !rawList.length) {
      return defaults.map(function (f) { return Object.assign({}, f); });
    }
    return rawList.map(function (f) {
      if (!f || !f.key) return null;
      var base = byKey[f.key] || { key: f.key, label: f.key, type: 'text', required: false, enabled: true, placeholder: '' };
      return {
        key: String(f.key || base.key).trim(),
        label: String(f.label || base.label).trim() || base.label,
        type: String(f.type || base.type).trim() || 'text',
        required: f.required === true || f.required === 'true',
        enabled: f.enabled !== false && f.enabled !== 'false',
        placeholder: String(f.placeholder != null ? f.placeholder : base.placeholder || '').trim()
      };
    }).filter(Boolean);
  }

  function normalizeScoringConfig(raw, base) {
    base = base || defaultPlatformConfig().scoring;
    var s = raw && typeof raw === 'object' ? raw : {};
    var scaleMin = parseInt(s.scaleMin, 10);
    var scaleMax = parseInt(s.scaleMax, 10);
    if (isNaN(scaleMin)) scaleMin = base.scaleMin;
    if (isNaN(scaleMax)) scaleMax = base.scaleMax;
    if (scaleMin >= scaleMax) {
      scaleMin = 1;
      scaleMax = 5;
    }
    var jueces = parseInt(s.jueces, 10);
    if (isNaN(jueces) || jueces < 1 || jueces > 5) jueces = 3;
    var modo = s.modo === 'puntaje_general' ? 'puntaje_general' : 'duelos';
    var disciplinas = ['filtrado', 'catacion', 'arte_latte', 'tostion', 'aeropress', 'personalizado'];
    var disciplina = disciplinas.indexOf(s.disciplina) >= 0 ? s.disciplina : (base.disciplina || 'filtrado');
    var competidoresEsperados = parseInt(s.competidoresEsperados, 10);
    if (isNaN(competidoresEsperados) || competidoresEsperados < 2) {
      competidoresEsperados = base.competidoresEsperados || 16;
    }
    return {
      disciplina: disciplina,
      modo: modo,
      scaleMin: scaleMin,
      scaleMax: scaleMax,
      jueces: jueces,
      avancePorRonda: Math.max(0, parseInt(s.avancePorRonda, 10) || 0),
      autoAvance: s.autoAvance !== false,
      competidoresEsperados: competidoresEsperados,
      mostrarFotos: s.mostrarFotos !== false,
      criteria: normalizeCriteriaList(s.criteria || base.criteria)
    };
  }

  function getCriteria() {
    var cfg = platformConfig && platformConfig.scoring;
    if (cfg && cfg.criteria && cfg.criteria.length) return cfg.criteria;
    return DEFAULT_CRITERIA;
  }

  function getScaleMin() {
    return (platformConfig && platformConfig.scoring && platformConfig.scoring.scaleMin != null)
      ? platformConfig.scoring.scaleMin : 1;
  }

  function getScaleMax() {
    return (platformConfig && platformConfig.scoring && platformConfig.scoring.scaleMax != null)
      ? platformConfig.scoring.scaleMax : 5;
  }

  function getJudgeCount() {
    return (platformConfig && platformConfig.scoring && platformConfig.scoring.jueces)
      ? platformConfig.scoring.jueces : 3;
  }

  function getScoringMode() {
    return (platformConfig && platformConfig.scoring && platformConfig.scoring.modo === 'puntaje_general')
      ? 'puntaje_general' : 'duelos';
  }

  function getDisciplina() {
    return (platformConfig && platformConfig.scoring && platformConfig.scoring.disciplina) || 'filtrado';
  }

  function getCompetidoresEsperados() {
    var n = platformConfig && platformConfig.scoring && platformConfig.scoring.competidoresEsperados;
    return Math.max(2, parseInt(n, 10) || 16);
  }

  function shouldShowCompetitorPhotos() {
    return !(platformConfig && platformConfig.scoring && platformConfig.scoring.mostrarFotos === false);
  }

  function driveThumbUrl(url, size) {
    if (!url) return '';
    var s = String(url).trim();
    var m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w' + (size || 200);
    if (/^https?:\/\//i.test(s)) return s;
    return '';
  }

  function disciplinaLabel(id) {
    if (window.TournamentPresets && window.TournamentPresets.get) {
      return window.TournamentPresets.get(id || getDisciplina()).label;
    }
    return id || 'Torneo';
  }

  function renderScoringModoHint() {
    var hint = $('cfgScoringModoHint');
    if (!hint || !window.TournamentPresets) return;
    var modo = $('cfgScoringModo') ? $('cfgScoringModo').value : getScoringMode();
    var modes = window.TournamentPresets.classificationModes();
    var found = modes.find(function (m) { return m.id === modo; });
    hint.textContent = found ? (found.desc + ' · ' + found.entities) : '';
  }

  function renderTournamentRecommendations(disciplina) {
    var box = $('cfgTournamentRecommendations');
    if (!box || !window.TournamentPresets) return;
    box.innerHTML = window.TournamentPresets.summaryHtml(disciplina || getDisciplina());
  }

  function applyDisciplinePresetToForm(disciplina) {
    if (!window.TournamentPresets || disciplina === 'personalizado') {
      renderTournamentRecommendations(disciplina);
      renderScoringModoHint();
      updateConfigPreview();
      return;
    }
    var preset = window.TournamentPresets.get(disciplina);
    var current = readPlatformConfigForm();
    var scoring = window.TournamentPresets.applyToScoring(disciplina, current.scoring);
    var registration = window.TournamentPresets.applyToRegistration
      ? window.TournamentPresets.applyToRegistration(disciplina, current.registration)
      : current.registration;
    var el;
    el = $('cfgScoringModo'); if (el) el.value = scoring.modo;
    el = $('cfgScaleMin'); if (el) el.value = scoring.scaleMin;
    el = $('cfgScaleMax'); if (el) el.value = scoring.scaleMax;
    el = $('cfgJueces'); if (el) el.value = scoring.jueces;
    el = $('cfgAvanceRonda'); if (el) el.value = scoring.avancePorRonda || 0;
    el = $('cfgCompetidoresEsperados'); if (el) el.value = scoring.competidoresEsperados;
    el = $('cfgRegCupo'); if (el && scoring.competidoresEsperados) el.value = scoring.competidoresEsperados;
    el = $('cfgRegReglamento'); if (el && registration.reglamentoUrl) el.value = registration.reglamentoUrl;
    el = $('cfgEventSubtitle'); if (el && preset.eventSubtitle) el.value = preset.eventSubtitle;
    var autoEl = $('cfgAutoAvance');
    if (autoEl) autoEl.checked = scoring.autoAvance !== false;
    renderCriteriaEditor(scoring.criteria);
    renderTournamentRecommendations(disciplina);
    renderScoringModoHint();
    updateConfigPreview();
  }

  function compressPanelImageFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || file.type.indexOf('image/') !== 0) {
        reject(new Error('Selecciona una imagen válida.'));
        return;
      }
      if (file.size > 1024 * 1024) {
        reject(new Error('La imagen debe pesar menos de 1 MB.'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var maxW = 1200;
          var w = img.width;
          var h = img.height;
          if (w > maxW) {
            h = Math.round(h * (maxW / w));
            w = maxW;
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = function () { reject(new Error('No se pudo leer la imagen.')); };
        img.src = reader.result;
      };
      reader.onerror = function () { reject(new Error('No se pudo cargar el archivo.')); };
      reader.readAsDataURL(file);
    });
  }

  function renderPanelImagePreview(dataUrl) {
    var preview = $('cfgPanelImagePreview');
    var clearBtn = $('cfgPanelImageClearBtn');
    if (!preview) return;
    if (dataUrl) {
      preview.innerHTML = '<img src="' + escapeHtml(dataUrl) + '" alt="Vista previa panel">';
      preview.hidden = false;
      if (clearBtn) clearBtn.hidden = false;
    } else {
      preview.innerHTML = '';
      preview.hidden = true;
      if (clearBtn) clearBtn.hidden = true;
    }
  }

  function renderFifaPanelBrand() {
    var box = $('fifaPanelBrand');
    if (!box) return;
    var dataUrl = platformConfig && platformConfig.panelImageDataUrl;
    if (dataUrl) {
      box.innerHTML = '<img src="' + escapeHtml(dataUrl) + '" alt="Panel de calificación" class="jurado-panel-brand__img">';
      box.hidden = false;
    } else {
      box.innerHTML = '';
      box.hidden = true;
    }
  }

  function competitorPhotoHtml(competidor, size) {
    if (!shouldShowCompetitorPhotos() || !competidor) return '';
    var url = driveThumbUrl(competidor.fotoUrl, size || 120);
    if (!url) {
      return '<span class="jurado-fifa-photo jurado-fifa-photo--empty" aria-hidden="true"></span>';
    }
    return '<img class="jurado-fifa-photo" src="' + escapeHtml(url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" width="40" height="40">';
  }

  function scoringModeLabel() {
    return isPuntajeGeneralMode() ? 'Puntaje general' : 'Duelos 1v1';
  }

  function scoringSummaryLine() {
    return scoringModeLabel() + ' · ' + scoringSubtitle();
  }

  function isPuntajeGeneralMode() {
    return getScoringMode() === 'puntaje_general';
  }

  function isAutoAdvanceEnabled() {
    return !(platformConfig && platformConfig.scoring && platformConfig.scoring.autoAvance === false);
  }

  function competitorName(id) {
    var c = competidores.find(function (x) { return x.id === id; });
    return c ? c.nombre : id;
  }

  function roundProgressKey() {
    if (!bracketState) return '';
    return bracketState.fase + '|' + (bracketState.rondaEnFase || 1) + '|' +
      getActiveCompetitorIds().slice().sort().join(',');
  }

  function allActiveScoresReady() {
    var activos = getActiveCompetitorIds();
    if (!activos.length) return false;
    return activos.every(function (id) {
      return puntajeEstado(getRowById(id)) === 'listo';
    });
  }

  function pushHistorialEntry(entry) {
    if (!bracketState) return;
    if (!bracketState.historial) bracketState.historial = [];
    entry.id = entry.id || ('h' + Date.now() + '-' + bracketState.historial.length);
    entry.at = entry.at || new Date().toISOString();
    bracketState.historial.push(entry);
  }

  function groupsSnapshotForHistory() {
    if (!bracketState || !bracketState.grupos || !bracketState.grupos.length) return null;
    return bracketState.grupos.map(function (g, idx) {
      return {
        nombre: g.nombre,
        avance: g.avance || 2,
        cerrado: !!g.cerrado,
        activo: isGruposPhase() && bracketState.grupoIndex === idx,
        miembros: g.ids.map(function (id) {
          var row = getRowById(id);
          return {
            id: id,
            nombre: competitorName(id),
            puntaje: puntajeTotal(row),
            listo: puntajeEstado(row) === 'listo'
          };
        })
      };
    });
  }

  function recordSorteoHistory() {
    pushHistorialEntry({
      tipo: 'sorteo',
      titulo: 'Sorteo inicial',
      fase: bracketState.fase,
      rondaEnFase: 1,
      modo: getScoringMode(),
      orden: bracketState.sorteo ? bracketState.sorteo.orden.slice() : [],
      grupos: groupsSnapshotForHistory(),
      participantes: (bracketState.sorteo && bracketState.sorteo.orden
        ? bracketState.sorteo.orden
        : getActiveCompetitorIds()).map(function (id, idx) {
        return { id: id, nombre: competitorName(id), posicion: idx + 1, clasifica: null };
      }),
      clasificados: getActiveCompetitorIds().slice(),
      eliminados: []
    });
  }

  function recordGrupoRoundHistory(grupo, winners, losers, members) {
    pushHistorialEntry({
      tipo: 'grupo',
      titulo: 'Grupo ' + grupo.nombre,
      fase: 'grupos',
      rondaEnFase: bracketState.rondaEnFase,
      modo: getScoringMode(),
      roundKey: roundProgressKey(),
      participantes: members.map(function (m, idx) {
        return {
          id: m.competidorId,
          nombre: m.nombre || competitorName(m.competidorId),
          puntaje: puntajeTotal(m),
          posicion: idx + 1,
          clasifica: winners.indexOf(m.competidorId) >= 0
        };
      }),
      clasificados: winners.slice(),
      eliminados: losers.slice(),
      grupos: groupsSnapshotForHistory()
    });
  }

  function recordDuelosRoundHistory(current, winners, previousActivos) {
    var participantes = [];
    current.matches.forEach(function (m) {
      var rowA = getRowById(m.aId);
      var rowB = m.bId ? getRowById(m.bId) : null;
      var r = resolveMatch(m.aId, m.bId, 1, m.duelNum);
      participantes.push({
        id: m.aId,
        nombre: rowA.nombre,
        puntaje: puntajeTotal(rowA),
        rivalId: m.bId || null,
        rivalNombre: rowB ? rowB.nombre : null,
        duelo: m.duelNum,
        clasifica: r.winnerId === m.aId
      });
      if (m.bId && rowB) {
        participantes.push({
          id: m.bId,
          nombre: rowB.nombre,
          puntaje: puntajeTotal(rowB),
          rivalId: m.aId,
          rivalNombre: rowA.nombre,
          duelo: m.duelNum,
          clasifica: r.winnerId === m.bId
        });
      }
    });
    pushHistorialEntry({
      tipo: 'duelos',
      titulo: current.phaseTitle,
      fase: bracketState.fase,
      rondaEnFase: bracketState.rondaEnFase,
      modo: 'duelos',
      roundKey: roundProgressKey(),
      participantes: participantes,
      clasificados: winners.slice(),
      eliminados: previousActivos.filter(function (id) { return winners.indexOf(id) < 0; })
    });
  }

  function recordRankingRoundHistory(ranked, winners, previousActivos) {
    pushHistorialEntry({
      tipo: 'ranking',
      titulo: currentPhaseTitle(),
      fase: bracketState.fase,
      rondaEnFase: bracketState.rondaEnFase,
      modo: 'puntaje_general',
      roundKey: roundProgressKey(),
      participantes: ranked.map(function (p, idx) {
        return {
          id: p.competidorId,
          nombre: p.nombre,
          puntaje: puntajeTotal(p),
          posicion: idx + 1,
          clasifica: idx < winners.length
        };
      }),
      clasificados: winners.slice(),
      eliminados: previousActivos.filter(function (id) { return winners.indexOf(id) < 0; })
    });
  }

  function maxJudgeSubtotal() {
    return getCriteria().length * getScaleMax();
  }

  function maxTotalScore() {
    return maxJudgeSubtotal() * getJudgeCount();
  }

  function scoringSubtitle() {
    var c = getCriteria().length;
    return 'Escala ' + getScaleMin() + '–' + getScaleMax() + ' · ' + c + ' criterio' + (c === 1 ? '' : 's') +
      ' · ' + getJudgeCount() + ' jueces';
  }

  function judgeSumLabel() {
    var jmax = getJudgeCount();
    if (jmax <= 1) return 'J1';
    if (jmax === 2) return 'J1 + J2';
    return 'J1 + J2 + … + J' + jmax;
  }

  function fifaColspan() {
    return getJudgeCount() + 5 + (shouldShowCompetitorPhotos() ? 1 : 0);
  }

  function rankingColspan() {
    return getJudgeCount() + 4;
  }

  function renderFifaTableHead() {
    var row = document.querySelector('#fifaStandingsTable thead tr');
    if (!row) return;
    var html = '<th class="jurado-fifa-pos">#</th>';
    if (shouldShowCompetitorPhotos()) html += '<th class="jurado-fifa-photo-col">Foto</th>';
    html += '<th class="jurado-fifa-team">Competidor</th>' +
      '<th>Cat.</th>';
    for (var j = 1; j <= getJudgeCount(); j++) html += '<th>J' + j + '</th>';
    html += '<th class="jurado-fifa-pts">Pts</th><th>Estado</th>';
    row.innerHTML = html;
  }

  function renderRankingTableHead() {
    var table = $('organizerRankingTable');
    if (!table) return;
    var jmax = getJudgeCount();
    var row1 = table.querySelector('thead tr:first-child');
    var row2 = table.querySelector('thead tr.jurado-subhead');
    if (row1) {
      row1.innerHTML = '<th>Competidor</th>' +
        '<th colspan="' + jmax + '" class="jurado-th-group">Jueces</th>' +
        '<th>Total</th><th>Estado</th><th>Acciones</th>';
    }
    if (row2) {
      var html = '<th></th>';
      for (var j = 1; j <= jmax; j++) html += '<th class="jurado-th-judge">J' + j + '</th>';
      html += '<th></th><th></th><th></th>';
      row2.innerHTML = html;
    }
  }

  function updateScoringHints() {
    var jmax = getJudgeCount();
    var scale = getScaleMin() + '–' + getScaleMax();
    var maxTotal = maxTotalScore();
    var torneo = $('torneoModeHint');
    if (torneo) {
      torneo.innerHTML = isPuntajeGeneralMode()
        ? 'Modo puntaje general · ranking por puntaje total (' + judgeSumLabel() + ').'
        : 'Duelos de 2 competidores · pasa quien tenga mayor <strong>puntaje total</strong> (' + judgeSumLabel() + ').';
    }
    var puntajes = $('puntajesModeHint');
    if (puntajes) {
      puntajes.textContent = (jmax === 1 ? 'J1' : 'J1 a J' + jmax) +
        ' · puntaje total cuando ' + (jmax === 1 ? 'el juez calificó' : 'los ' + jmax + ' jueces calificaron') +
        ' (máx. ' + maxTotal + ' pts).';
    }
    var manual = $('manualModeHint');
    if (manual) {
      manual.textContent = 'Corrige o ingresa las notas de J1 a J' + jmax + ' (escala ' + scale + ' por criterio).';
    }
    var fifa = $('fifaModeHint');
    if (fifa) fifa.textContent = 'Tabla por puntaje total · ' + scoringSubtitle() + ' · se actualiza cada 3 s';
    updateControlHint();
    updateDashboardScoringChip();
    updateJudgeUiHints();
    updateRoleSectionHint();
  }

  function updateControlHint() {
    var el = $('controlModeHint');
    if (!el) return;
    if (isGruposPhase()) {
      el.textContent = 'Fase de grupos: califica a todos; clasifican los mejores por puntaje total.';
    } else if (isPuntajeGeneralMode()) {
      el.textContent = 'Modo puntaje general: cuando todos tengan nota completa, usa «Clasificar por puntaje» abajo.';
    } else {
      el.textContent = 'Modo duelos: tras cada ronda usa «Avanzar ganadores»; pasa el mayor puntaje total.';
    }
  }

  function updateDashboardScoringChip() {
    var el = $('dashboardScoringChip');
    if (!el) return;
    if (mode === 'organizer') {
      el.textContent = scoringSummaryLine();
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  function updateJudgeUiHints() {
    var scaleHint = $('judgeScaleHint');
    if (scaleHint) {
      scaleHint.textContent = 'Escala ' + getScaleMin() + ' (bajo) a ' + getScaleMax() +
        ' (excelente) · ' + getCriteria().length + ' criterio' + (getCriteria().length === 1 ? '' : 's') +
        '. Solo llenas tu columna (Juez ' + (judgeNum || '—') + ').';
    }
    var maxHint = $('judgeMaxHint');
    if (maxHint) maxHint.textContent = 'Máx. ' + maxJudgeSubtotal() + ' pts';
  }

  function updateRoleSectionHint() {
    var el = $('roleSectionHint');
    if (!el) return;
    var jmax = getJudgeCount();
    el.textContent = 'Hay ' + jmax + ' juez' + (jmax === 1 ? '' : 'es') +
      ' (' + scoringModeLabel().toLowerCase() + '). Cada uno abre su enlace desde el celular.';
  }

  function isScoreInScale(v) {
    var n = parseInt(v, 10);
    return !isNaN(n) && n >= getScaleMin() && n <= getScaleMax();
  }

  function getAdvanceCount(activeCount) {
    var n = parseInt(activeCount, 10) || 0;
    if (n < 1) return 0;
    var custom = platformConfig && platformConfig.scoring && platformConfig.scoring.avancePorRonda;
    if (custom > 0) return Math.min(custom, n);
    if (n <= 2) return 1;
    if (isGruposPhase()) {
      var g = getCurrentGrupo();
      return g ? (g.avance || 2) : Math.ceil(n / 2);
    }
    if (isPuntajeGeneralMode()) return Math.ceil(n / 2);
    return Math.ceil(n / 2);
  }

  function normalizePlatformConfig(raw) {
    var base = defaultPlatformConfig();
    if (!raw || typeof raw !== 'object') return base;
    var reg = raw.registration && typeof raw.registration === 'object' ? raw.registration : {};
    return {
      eventName: String(raw.eventName || base.eventName).trim() || base.eventName,
      eventSubtitle: String(raw.eventSubtitle || base.eventSubtitle).trim() || base.eventSubtitle,
      organizerName: String(raw.organizerName || base.organizerName).trim() || base.organizerName,
      logoUrl: String(raw.logoUrl || base.logoUrl).trim() || base.logoUrl,
      accentColor: String(raw.accentColor || base.accentColor).trim() || base.accentColor,
      primaryColor: String(raw.primaryColor || base.primaryColor).trim() || base.primaryColor,
      pinOrganizador: String(raw.pinOrganizador || base.pinOrganizador).trim().toLowerCase() || base.pinOrganizador,
      pinJuez: String(raw.pinJuez || base.pinJuez).trim().toLowerCase() || base.pinJuez,
      tenantSlug: String(raw.tenantSlug || raw.eventId || tenantSlug || base.tenantSlug || '').trim(),
      eventId: String(raw.eventId || raw.tenantSlug || tenantSlug || base.eventId || '').trim(),
      clientName: String(raw.clientName || base.clientName || '').trim(),
      sheetName: String(raw.sheetName || base.sheetName || '').trim(),
      formFields: normalizeFormFieldsList(raw.formFields),
      registration: {
        title: String(reg.title || base.registration.title).trim() || base.registration.title,
        fee: String(reg.fee || base.registration.fee).trim() || base.registration.fee,
        cupo: parseInt(reg.cupo, 10) || base.registration.cupo,
        fecha: String(reg.fecha || base.registration.fecha).trim() || base.registration.fecha,
        hora: String(reg.hora || base.registration.hora).trim() || base.registration.hora,
        lugar: String(reg.lugar || base.registration.lugar).trim() || base.registration.lugar,
        contactEmail: String(reg.contactEmail || base.registration.contactEmail).trim(),
        whatsapp: String(reg.whatsapp || base.registration.whatsapp).trim(),
        reglamentoUrl: String(reg.reglamentoUrl || base.registration.reglamentoUrl).trim()
      },
      scoring: normalizeScoringConfig(raw.scoring, base.scoring),
      panelImageDataUrl: String(raw.panelImageDataUrl || '').trim(),
      judgeProfiles: normalizeJudgeProfiles(raw.judgeProfiles),
      actualizado: raw.actualizado || ''
    };
  }

  function normalizeJudgeProfiles(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).forEach(function (key) {
      var p = raw[key];
      if (!p || typeof p !== 'object') return;
      var num = parseInt(p.num != null ? p.num : key, 10);
      if (isNaN(num) || num < 1) return;
      out[String(num)] = {
        num: num,
        nombre: String(p.nombre || '').trim(),
        fotoUrl: String(p.fotoUrl || '').trim(),
        updatedAt: String(p.updatedAt || '').trim()
      };
    });
    return out;
  }

  function judgeProfileStorageKey(num) {
    return JUDGE_PROFILE_LS + '__' + (tenantSlug || 'main') + '__' + num;
  }

  function readJudgeProfileLocal(num) {
    try {
      var raw = localStorage.getItem(judgeProfileStorageKey(num));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeJudgeProfileLocal(num, profile) {
    try {
      localStorage.setItem(judgeProfileStorageKey(num), JSON.stringify(profile || {}));
    } catch (e) { /* ignore quota */ }
  }

  function getJudgeProfile(num) {
    var key = String(num);
    var fromCfg = platformConfig && platformConfig.judgeProfiles
      ? platformConfig.judgeProfiles[key]
      : null;
    if (fromCfg && fromCfg.fotoUrl) return fromCfg;
    var local = readJudgeProfileLocal(num);
    if (local && local.fotoUrl) return local;
    return fromCfg || local || null;
  }

  function hasJudgeProfile(num) {
    var p = getJudgeProfile(num);
    return !!(p && p.fotoUrl);
  }

  function mergeJudgeProfileIntoConfig(num, profile) {
    if (!platformConfig) platformConfig = defaultPlatformConfig();
    if (!platformConfig.judgeProfiles) platformConfig.judgeProfiles = {};
    platformConfig.judgeProfiles[String(num)] = {
      num: num,
      nombre: String(profile.nombre || '').trim(),
      fotoUrl: String(profile.fotoUrl || '').trim(),
      updatedAt: profile.updatedAt || new Date().toISOString()
    };
  }

  function loadPlatformConfig() {
    return sheetsGet('pasaporte_config', { key: storageKey(PLATFORM_KEY) }).then(function (res) {
      platformConfig = normalizePlatformConfig(res.data);
      applyPlatformBranding();
      return platformConfig;
    }).catch(function () {
      platformConfig = defaultPlatformConfig();
      applyPlatformBranding();
      return platformConfig;
    });
  }

  function savePlatformConfig(cfg) {
    if (tenantSlug) {
      cfg.tenantSlug = tenantSlug;
      cfg.eventId = tenantSlug;
    }
    cfg.actualizado = new Date().toISOString();
    return sheetsPost({
      action: 'pasaporte_config_save',
      key: storageKey(PLATFORM_KEY),
      data: cfg
    }).then(function () {
      platformConfig = normalizePlatformConfig(cfg);
      applyPlatformBranding();
      if (mode === 'organizer') {
        return refreshOrganizer().then(function () { return platformConfig; });
      }
      return platformConfig;
    });
  }

  function pinOrganizadorEffective() {
    return (platformConfig && platformConfig.pinOrganizador) || PIN_ORGANIZADOR;
  }

  function pinJuezEffective() {
    return (platformConfig && platformConfig.pinJuez) || PIN_JUEZ;
  }

  function applyPlatformBranding() {
    var cfg = platformConfig || defaultPlatformConfig();
    var root = document.documentElement;
    root.style.setProperty('--jurado-accent', cfg.accentColor || '#c9a227');
    root.style.setProperty('--jurado-primary', cfg.primaryColor || '#3d281c');

    var logo = $('headerLogo');
    if (logo && cfg.logoUrl) {
      logo.src = cfg.logoUrl;
      logo.alt = cfg.organizerName || cfg.eventName;
    }
    var fav = $('faviconLink');
    if (fav && cfg.logoUrl) fav.href = cfg.logoUrl;

    if (PAGE_MODE === 'hub') {
      $('headerTitle').textContent = 'Consola principal';
      $('headerSubtitle').textContent = 'Mapa de todos los paneles del torneo';
      var hubKicker = $('headerKicker');
      if (hubKicker) hubKicker.textContent = cfg.organizerName || 'Torneo sensorial';
      document.title = 'Consola principal — Jurado sensorial';
    } else if (mode === 'organizer') {
      $('headerTitle').textContent = cfg.eventName;
      $('headerSubtitle').textContent = cfg.eventSubtitle || scoringSummaryLine();
      var dashName = $('dashboardEventName');
      if (dashName) dashName.textContent = cfg.eventName;
      var kicker = $('headerKicker');
      if (kicker) kicker.textContent = cfg.organizerName;
      var live = $('livePill');
      if (live) live.hidden = false;
    } else if (mode === 'judge') {
      $('headerTitle').textContent = 'Juez ' + judgeNum;
      $('headerSubtitle').textContent = scoringSummaryLine();
    } else {
      $('headerTitle').textContent = cfg.eventName;
      $('headerSubtitle').textContent = scoringSummaryLine();
    }

    if (PAGE_MODE !== 'hub') {
      document.title = cfg.eventName + ' — Jurado en vivo';
    }
    updateDashboardScoringChip();
    updateJudgeUiHints();
    updateRoleSectionHint();
    renderFifaPanelBrand();
  }

  function webAppUrl() {
    var cfg = window.SHEETS_CONFIG || {};
    var url = (cfg.WEB_APP_URL || '').trim();
    if (!url || url.indexOf('TU_ID_DE_DEPLOYMENT') !== -1) url = WEB_APP_URL_CANONICAL;
    return url;
  }

  function $(id) { return document.getElementById(id); }

  function getParams() {
    try { return new URLSearchParams(window.location.search); } catch (e) { return new URLSearchParams(); }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function isHabilitado(val) {
    var v = String(val || '').trim().toLowerCase();
    if (!v) return true;
    return v === 'sí' || v === 'si' || v === 'yes' || v === 'true' || v === '1';
  }

  function sheetsGet(action, params) {
    var url = webAppUrl();
    var qs = 'action=' + encodeURIComponent(action);
    Object.keys(params || {}).forEach(function (key) {
      if (params[key] != null && params[key] !== '') {
        qs += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
      }
    });
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return fetch(url + sep + qs, { method: 'GET', mode: 'cors', cache: 'no-store', redirect: 'follow' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || data.ok === false) throw new Error((data && data.error) || 'Error del servidor.');
        return data;
      });
  }

  function sheetsPost(body) {
    return fetch(webAppUrl(), {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    }).then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || data.ok === false) throw new Error((data && data.error) || 'Error al guardar.');
        return data;
      });
  }

  function competenciaEventKey(val) {
    var s = String(val || '').trim();
    if (!s) return '';
    if (/preliminar\s*2/i.test(s) || /evento\s*2/i.test(s) || /2\.ª/i.test(s)) return 'V60 Championship — Preliminar 2';
    if (/preliminar\s*1/i.test(s) || /evento\s*1/i.test(s) || /1\.ª/i.test(s)) return 'V60 Championship — Preliminar 1';
    if (s === 'V60 Championship') return 'V60 Championship — Preliminar 1';
    return s;
  }

  function loadCompetidores() {
    return sheetsGet('admin_dashboard', {}).then(function (data) {
      var eventFilter = tenantSlug || (platformConfig && (platformConfig.eventId || platformConfig.tenantSlug)) || '';
      if (!eventFilter && window.EVENT_CONFIG) {
        var activeEv = window.EVENT_CONFIG.getEventoActivo
          ? window.EVENT_CONFIG.getEventoActivo()
          : (window.EVENT_CONFIG.evento2 || window.EVENT_CONFIG.evento1 || {});
        eventFilter = String(activeEv.eventoId || activeEv.nombre || '').trim();
      }
      return (data.allCompetencia || [])
        .filter(function (row) { return isHabilitado(row.Habilitado); })
        .filter(function (row) {
          if (!eventFilter) return true;
          return competenciaEventKey(row.Evento) === competenciaEventKey(eventFilter);
        })
        .map(function (row) {
          return {
            id: String(row.ID || '').trim(),
            nombre: String(row.Nombre || '').trim(),
            ciudad: String(row.Ciudad || '').trim(),
            representa: String(row.Representa || '').trim(),
            fotoUrl: String(row['Foto participante enlace Drive'] || row.FotoParticipante || '').trim()
          };
        })
        .filter(function (c) { return c.id && c.nombre; })
        .sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
    });
  }

  function loadCalificacionesStore() {
    return sheetsGet('pasaporte_config', { key: storageKey(CONFIG_KEY) }).then(function (res) {
      var data = res.data || {};
      var scores = data.scores && typeof data.scores === 'object' ? data.scores : {};
      var list = Object.keys(scores).map(function (id) {
        return normalizeCalificacion(scores[id], id);
      }).filter(Boolean);
      list.sort(function (a, b) { return (b.promedio || 0) - (a.promedio || 0); });
      calificacionesMap = {};
      list.forEach(function (row) {
        if (row && row.competidorId) calificacionesMap[row.competidorId] = row;
      });
      return list;
    });
  }

  function normalizeBracketState(raw) {
    if (!raw || !raw.fase) return null;
    var fase = raw.fase;
    if (fase === 'clasificatoria') fase = '8avos';
    return {
      fase: fase,
      rondaEnFase: parseInt(raw.rondaEnFase, 10) || 1,
      activos: Array.isArray(raw.activos) ? raw.activos.slice() : [],
      eliminados: Array.isArray(raw.eliminados) ? raw.eliminados.slice() : [],
      overrides: raw.overrides && typeof raw.overrides === 'object' ? Object.assign({}, raw.overrides) : {},
      plan: Array.isArray(raw.plan) ? raw.plan.slice() : [],
      sorteo: raw.sorteo && typeof raw.sorteo === 'object' ? Object.assign({}, raw.sorteo) : null,
      grupos: Array.isArray(raw.grupos) ? raw.grupos.map(function (g) {
        return {
          nombre: g.nombre || 'A',
          ids: Array.isArray(g.ids) ? g.ids.slice() : [],
          avance: parseInt(g.avance, 10) || 2,
          cerrado: !!g.cerrado
        };
      }) : [],
      grupoIndex: parseInt(raw.grupoIndex, 10) || 0,
      clasificadosGrupos: Array.isArray(raw.clasificadosGrupos) ? raw.clasificadosGrupos.slice() : [],
      historial: Array.isArray(raw.historial) ? raw.historial.map(function (h) {
        return h && typeof h === 'object' ? Object.assign({}, h) : null;
      }).filter(Boolean) : [],
      resultadosCompetidor: normalizeResultadosCompetidor(raw.resultadosCompetidor),
      actualizado: raw.actualizado || ''
    };
  }

  function normalizeResultadosCompetidor(raw) {
    if (!raw || typeof raw !== 'object') return {};
    var out = {};
    Object.keys(raw).forEach(function (id) {
      var entry = raw[id];
      if (!entry || typeof entry !== 'object') return;
      out[id] = {
        roundKey: String(entry.roundKey || ''),
        faseLabel: String(entry.faseLabel || ''),
        publicadoAt: String(entry.publicadoAt || ''),
        judges: entry.judges && typeof entry.judges === 'object' ? entry.judges : {},
        notas: String(entry.notas || ''),
        sumaTotal: entry.sumaTotal != null ? entry.sumaTotal : null,
        promedio: entry.promedio != null ? entry.promedio : null
      };
    });
    return out;
  }

  function snapshotCalificacionForPublish(row) {
    if (!row) return null;
    return {
      judges: JSON.parse(JSON.stringify(row.judges || {})),
      notas: String(row.notas || '').trim(),
      sumaTotal: row.sumaTotal != null ? row.sumaTotal : null,
      promedio: row.promedio != null ? row.promedio : null
    };
  }

  function clearPublishedResultsForIds(ids) {
    if (!bracketState || !bracketState.resultadosCompetidor) return;
    ids.forEach(function (id) {
      delete bracketState.resultadosCompetidor[id];
    });
  }

  function publishResultsToCompetitors() {
    if (!bracketState) return Promise.reject(new Error('No hay torneo iniciado.'));
    var activos = getActiveCompetitorIds();
    if (!activos.length) return Promise.reject(new Error('No hay participantes activos en esta ronda.'));

    if (!bracketState.resultadosCompetidor) bracketState.resultadosCompetidor = {};
    var roundKey = roundProgressKey();
    var faseLabel = currentPhaseTitle();
    var now = new Date().toISOString();
    var published = 0;

    activos.forEach(function (id) {
      var row = getRowById(id);
      var snap = snapshotCalificacionForPublish(row);
      if (!snap || snap.sumaTotal == null) return;
      bracketState.resultadosCompetidor[id] = Object.assign({}, snap, {
        roundKey: roundKey,
        faseLabel: faseLabel,
        publicadoAt: now
      });
      published++;
    });

    if (!published) {
      return Promise.reject(new Error('No hay calificaciones completas para publicar. Espera a que los jueces terminen.'));
    }

    return saveBracketStore(bracketState).then(function () {
      return published;
    });
  }

  function defaultBracketState() {
    var ids = competidores.map(function (c) { return c.id; });
    var plan = computeTournamentPlan(ids.length);
    return {
      fase: plan[0] || 'semifinal',
      rondaEnFase: 1,
      activos: ids.slice(),
      eliminados: [],
      overrides: {},
      plan: plan,
      sorteo: null,
      grupos: [],
      grupoIndex: 0,
      clasificadosGrupos: [],
      historial: [],
      resultadosCompetidor: {},
      actualizado: new Date().toISOString()
    };
  }

  var FASE_LABELS = {
    grupos: 'Fase de grupos',
    '16avos': 'Dieciseisavos de final',
    '8avos': 'Octavos de final',
    '4tos': 'Cuartos de final',
    semifinal: 'Semifinal',
    final: 'Final'
  };

  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function nextPowerOf2(n) {
    var p = 1;
    while (p < n) p *= 2;
    return p;
  }

  function knockoutPlanForCount(n) {
    if (n <= 2) return ['final'];
    if (n <= 4) return ['semifinal', 'final'];
    if (n <= 8) return ['4tos', 'semifinal', 'final'];
    if (n <= 16) return ['8avos', '4tos', 'semifinal', 'final'];
    return ['16avos', '8avos', '4tos', 'semifinal', 'final'];
  }

  function estimateGroupQualifiers(n) {
    var numGroups = Math.ceil(n / 4);
    return numGroups * 2;
  }

  function computeTournamentPlan(participantCount) {
    var n = Math.max(0, parseInt(participantCount, 10) || 0);
    if (n < 2) return ['final'];
    if (n > 32) {
      var q = estimateGroupQualifiers(n);
      var ko = knockoutPlanForCount(Math.min(q, 32));
      return ['grupos'].concat(ko);
    }
    return knockoutPlanForCount(n);
  }

  function phaseForActiveCount(count) {
    var n = parseInt(count, 10) || 0;
    if (n <= 2) return 'final';
    if (n <= 4) return 'semifinal';
    if (n <= 8) return '4tos';
    if (n <= 16) return '8avos';
    if (n <= 32) return '16avos';
    return 'grupos';
  }

  function buildGroupsFromOrder(orderedIds) {
    var groups = [];
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var i = 0;
    var g = 0;
    while (i < orderedIds.length) {
      var remaining = orderedIds.length - i;
      var size = remaining <= 5 ? remaining : 4;
      if (remaining === 5) size = 3;
      groups.push({
        nombre: letters[g] || String(g + 1),
        ids: orderedIds.slice(i, i + size),
        avance: size >= 4 ? 2 : 1,
        cerrado: false
      });
      i += size;
      g++;
    }
    return groups;
  }

  function runSorteoAutomatico(forceReshuffle) {
    if (!competidores.length) {
      return Promise.reject(new Error('No hay competidores inscritos habilitados.'));
    }
    var ids = competidores.map(function (c) { return c.id; });
    var shuffled = shuffleArray(ids);
    var plan = computeTournamentPlan(ids.length);
    if (!bracketState) bracketState = defaultBracketState();

    bracketState.plan = plan;
    bracketState.sorteo = {
      at: new Date().toISOString(),
      orden: shuffled,
      total: ids.length,
      reshuffle: !!forceReshuffle
    };
    bracketState.eliminados = [];
    bracketState.overrides = {};
    bracketState.clasificadosGrupos = [];
    bracketState.grupoIndex = 0;
    bracketState.rondaEnFase = 1;
    bracketState.historial = [];
    bracketState.resultadosCompetidor = {};

    if (plan[0] === 'grupos') {
      bracketState.grupos = buildGroupsFromOrder(shuffled);
      bracketState.fase = 'grupos';
      bracketState.activos = bracketState.grupos[0] ? bracketState.grupos[0].ids.slice() : shuffled;
    } else {
      bracketState.grupos = [];
      bracketState.fase = plan[0];
      bracketState.activos = shuffled.slice();
    }

    recordSorteoHistory();

    return saveBracketStore(bracketState).then(function () {
      return resetAllScoresStore();
    });
  }

  function getCurrentGrupo() {
    if (!bracketState || !bracketState.grupos || !bracketState.grupos.length) return null;
    return bracketState.grupos[bracketState.grupoIndex] || null;
  }

  function isGruposPhase() {
    return bracketState && bracketState.fase === 'grupos';
  }

  function closeCurrentGrupo() {
    var grupo = getCurrentGrupo();
    if (!grupo) return Promise.reject(new Error('No hay grupo activo.'));
    var members = grupo.ids.map(getRowById).sort(function (a, b) {
      var ta = puntajeTotal(a) != null ? puntajeTotal(a) : partialScore(a);
      var tb = puntajeTotal(b) != null ? puntajeTotal(b) : partialScore(b);
      if (tb !== ta) return tb - ta;
      return (a.nombre || '').localeCompare(b.nombre || '', 'es');
    });
    var advance = grupo.avance || 2;
    var notReady = members.filter(function (m) { return puntajeEstado(m) !== 'listo'; });
    if (notReady.length) {
      return Promise.reject(new Error('Faltan calificaciones completas en el grupo ' + grupo.nombre + ' (' + notReady.length + ' pendiente(s)).'));
    }
    var winners = members.slice(0, advance).map(function (m) { return m.competidorId; });
    var losers = members.slice(advance).map(function (m) { return m.competidorId; });

    recordGrupoRoundHistory(grupo, winners, losers, members);

    grupo.cerrado = true;
    winners.forEach(function (id) {
      if (bracketState.clasificadosGrupos.indexOf(id) < 0) bracketState.clasificadosGrupos.push(id);
    });
    losers.forEach(function (id) {
      if (bracketState.eliminados.indexOf(id) < 0) bracketState.eliminados.push(id);
    });

    var nextIndex = bracketState.grupoIndex + 1;
    if (nextIndex < bracketState.grupos.length) {
      bracketState.grupoIndex = nextIndex;
      bracketState.activos = bracketState.grupos[nextIndex].ids.slice();
      bracketState.rondaEnFase = 1;
      bracketState.overrides = {};
      clearPublishedResultsForIds(bracketState.activos);
      return saveBracketStore(bracketState).then(function () {
        return resetScoresForIds(bracketState.activos);
      });
    }

    var qualified = shuffleArray(bracketState.clasificadosGrupos.slice());
    var plan = bracketState.plan || computeTournamentPlan(qualified.length);
    var koStart = plan.indexOf('grupos') >= 0 ? plan[plan.indexOf('grupos') + 1] : plan[0];
    if (!koStart) koStart = phaseForActiveCount(qualified.length);

    bracketState.fase = koStart;
    bracketState.activos = qualified;
    bracketState.grupos = bracketState.grupos;
    bracketState.rondaEnFase = 1;
    bracketState.overrides = {};
    clearPublishedResultsForIds(qualified);

    return saveBracketStore(bracketState).then(function () {
      return resetScoresForIds(qualified);
    });
  }

  function renderTournamentPlanPanel() {
    var box = $('tournamentPlanBox');
    if (!box) return;
    var n = competidores.length;
    var plan = (bracketState && bracketState.plan && bracketState.plan.length)
      ? bracketState.plan
      : computeTournamentPlan(n);

    var planHtml = plan.map(function (f, i) {
      var active = bracketState && bracketState.fase === f;
      return '<span class="jurado-plan-chip' + (active ? ' jurado-plan-chip--active' : '') + '">' +
        (i + 1) + '. ' + escapeHtml(faseLabel(f)) + '</span>';
    }).join('');

    var sorteoInfo = '';
    if (bracketState && bracketState.sorteo && bracketState.sorteo.at) {
      sorteoInfo = '<p class="jurado-meta">Último sorteo: ' +
        new Date(bracketState.sorteo.at).toLocaleString('es-CO') +
        ' · ' + bracketState.sorteo.total + ' participantes</p>';
    }

    var modoLabel = isPuntajeGeneralMode()
      ? 'Puntaje general (ranking)'
      : 'Duelos 1v1';
    var modoHtml = '<p class="jurado-meta">Modo: <strong>' + modoLabel + '</strong> · ' + scoringSubtitle() + '</p>';

    box.innerHTML =
      '<p><strong>' + n + '</strong> inscrito(s) habilitado(s)' +
      (getCompetidoresEsperados() ? ' · objetivo <strong>' + getCompetidoresEsperados() + '</strong>' : '') + '</p>' +
      '<p class="jurado-meta">Disciplina: <strong>' + escapeHtml(disciplinaLabel(getDisciplina())) + '</strong></p>' +
      modoHtml +
      '<p class="jurado-hint">Formato sugerido para este cupo:</p>' +
      '<div class="jurado-plan-chips">' + planHtml + '</div>' +
      sorteoInfo;

    var reshuffle = $('reshuffleSorteoBtn');
    if (reshuffle) reshuffle.hidden = !(bracketState && bracketState.sorteo);

    var closeGrupo = $('closeGrupoBtn');
    if (closeGrupo) closeGrupo.hidden = !isGruposPhase();

    renderSorteoResult();
    renderGruposPanel();
  }

  function renderSorteoResult() {
    var box = $('sorteoResultBox');
    if (!box) return;
    if (!bracketState || !bracketState.sorteo || !bracketState.sorteo.orden) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.hidden = false;
    var orden = bracketState.sorteo.orden;
    var html = '<h3 class="jurado-admin-subtitle">Orden del sorteo</h3><ol class="jurado-sorteo-list">';
    orden.forEach(function (id, idx) {
      var c = competidores.find(function (x) { return x.id === id; });
      html += '<li><span class="jurado-sorteo-seed">#' + (idx + 1) + '</span> ' +
        escapeHtml(c ? c.nombre : id) + '</li>';
    });
    html += '</ol>';
    box.innerHTML = html;
  }

  function renderGruposPanel() {
    var panel = $('gruposPanel');
    if (!panel) return;
    if (!bracketState || !bracketState.grupos || !bracketState.grupos.length) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    panel.hidden = false;
    var html = '<h3 class="jurado-admin-subtitle">Grupos</h3><div class="jurado-grupos-grid">';
    bracketState.grupos.forEach(function (g, idx) {
      var isCurrent = isGruposPhase() && bracketState.grupoIndex === idx;
      html += '<article class="jurado-grupo-card' + (g.cerrado ? ' jurado-grupo-card--done' : '') +
        (isCurrent ? ' jurado-grupo-card--active' : '') + '">';
      html += '<header>Grupo ' + escapeHtml(g.nombre) +
        (g.cerrado ? ' ✓' : isCurrent ? ' · en juego' : '') + '</header><ul>';
      g.ids.forEach(function (id) {
        var c = competidores.find(function (x) { return x.id === id; });
        var row = getRowById(id);
        var pts = puntajeTotal(row);
        html += '<li>' + escapeHtml(c ? c.nombre : id) +
          (pts != null ? ' <em>' + pts + ' pts</em>' : '') + '</li>';
      });
      html += '</ul><p class="jurado-hint">Clasifican ' + (g.avance || 2) + '</p></article>';
    });
    html += '</div>';
    panel.innerHTML = html;
  }

  function showSorteoMsg(msg, isError) {
    var ok = $('sorteoMsg');
    var err = $('sorteoError');
    if (ok) ok.hidden = true;
    if (err) err.hidden = true;
    if (isError) {
      if (err) { err.textContent = msg; err.hidden = false; }
    } else if (ok) {
      ok.textContent = msg;
      ok.hidden = false;
    }
  }

  function loadBracketStore() {
    return sheetsGet('pasaporte_config', { key: storageKey(BRACKET_KEY) }).then(function (res) {
      var normalized = normalizeBracketState(res.data);
      if (normalized) {
        bracketState = normalized;
        if (!bracketState.plan || !bracketState.plan.length) {
          bracketState.plan = computeTournamentPlan(competidores.length || bracketState.activos.length);
        }
        if (!bracketState.activos.length && competidores.length) {
          bracketState.activos = competidores.map(function (c) { return c.id; });
        }
        return bracketState;
      }
      bracketState = defaultBracketState();
      return saveBracketStore(bracketState);
    }).catch(function () {
      bracketState = defaultBracketState();
      return bracketState;
    });
  }

  function saveBracketStore(state) {
    state.actualizado = new Date().toISOString();
    return sheetsPost({
      action: 'pasaporte_config_save',
      key: storageKey(BRACKET_KEY),
      data: state
    }).then(function () {
      bracketState = state;
      return state;
    });
  }

  function resetAllScoresStore() {
    return sheetsPost({
      action: 'pasaporte_config_save',
      key: storageKey(CONFIG_KEY),
      data: { scores: {}, actualizado: new Date().toISOString() }
    }).then(function () {
      calificacionesMap = {};
    });
  }

  function resetScoresForIds(ids) {
    return sheetsGet('pasaporte_config', { key: storageKey(CONFIG_KEY) }).then(function (res) {
      var data = res.data || {};
      if (!data.scores || typeof data.scores !== 'object') data.scores = {};
      ids.forEach(function (id) {
        delete data.scores[id];
        delete calificacionesMap[id];
      });
      data.actualizado = new Date().toISOString();
      return sheetsPost({
        action: 'pasaporte_config_save',
        key: storageKey(CONFIG_KEY),
        data: data
      });
    });
  }

  function faseLabel(fase) {
    return FASE_LABELS[fase] || fase;
  }

  function currentPhaseTitle() {
    if (!bracketState) return 'Ronda 1';
    var base = faseLabel(bracketState.fase);
    if (bracketState.fase === 'grupos') {
      var g = getCurrentGrupo();
      if (g) return base + ' · Grupo ' + g.nombre;
    }
    return base + ' · Ronda ' + (bracketState.rondaEnFase || 1);
  }

  function getActiveCompetitorIds() {
    if (!bracketState || !bracketState.activos || !bracketState.activos.length) {
      return competidores.map(function (c) { return c.id; });
    }
    return bracketState.activos.filter(function (id) {
      return competidores.some(function (c) { return c.id === id; });
    });
  }

  function eliminateParticipant(id) {
    if (!bracketState) bracketState = defaultBracketState();
    bracketState.activos = bracketState.activos.filter(function (x) { return x !== id; });
    if (bracketState.eliminados.indexOf(id) < 0) bracketState.eliminados.push(id);
    return saveBracketStore(bracketState);
  }

  function restoreParticipant(id) {
    if (!bracketState) bracketState = defaultBracketState();
    bracketState.eliminados = bracketState.eliminados.filter(function (x) { return x !== id; });
    if (bracketState.activos.indexOf(id) < 0) bracketState.activos.push(id);
    return saveBracketStore(bracketState);
  }

  function showAdminMsg(msg, isError) {
    var ok = $('organizerAdminMsg');
    var err = $('organizerAdminError');
    if (ok) ok.hidden = true;
    if (err) err.hidden = true;
    if (isError) {
      if (err) { err.textContent = msg; err.hidden = false; }
    } else if (ok) {
      ok.textContent = msg;
      ok.hidden = false;
    }
  }

  function saveCalificacionStore(calificacion, judgeKey) {
    var jKey = judgeKey || ('j' + judgeNum);
    return sheetsGet('pasaporte_config', { key: storageKey(CONFIG_KEY) }).then(function (res) {
      var data = res.data || {};
      if (!data.scores || typeof data.scores !== 'object') data.scores = {};

      var existing = normalizeCalificacion(data.scores[calificacion.competidorId], calificacion.competidorId) || {
        competidorId: calificacion.competidorId,
        nombre: calificacion.nombre,
        judges: {},
        notasPorJuez: {}
      };
      existing.nombre = calificacion.nombre || existing.nombre;
      existing.judges = existing.judges || {};
      existing.notasPorJuez = existing.notasPorJuez || {};

      if (calificacion.judges && calificacion.judges[jKey]) {
        existing.judges[jKey] = calificacion.judges[jKey];
      }
      if (calificacion.notasPorJuez) {
        if (calificacion.notasPorJuez[jKey]) existing.notasPorJuez[jKey] = calificacion.notasPorJuez[jKey];
        else delete existing.notasPorJuez[jKey];
      }

      var t = computeTotals(existing.judges);
      existing.sumaTotal = t.sumaTotal;
      existing.promedio = t.promedio;
      existing.actualizado = new Date().toISOString();
      data.scores[calificacion.competidorId] = existing;
      data.actualizado = new Date().toISOString();
      return sheetsPost({
        action: 'pasaporte_config_save',
        key: storageKey(CONFIG_KEY),
        data: data
      }).then(function () { return existing; });
    });
  }

  function saveOrganizerFullCalificacion(calificacion) {
    return sheetsGet('pasaporte_config', { key: storageKey(CONFIG_KEY) }).then(function (res) {
      var data = res.data || {};
      if (!data.scores || typeof data.scores !== 'object') data.scores = {};

      var existing = normalizeCalificacion(data.scores[calificacion.competidorId], calificacion.competidorId) || {
        competidorId: calificacion.competidorId,
        nombre: calificacion.nombre,
        judges: {},
        notasPorJuez: {}
      };
      existing.nombre = calificacion.nombre || existing.nombre;
      existing.judges = existing.judges || {};
      existing.notasPorJuez = existing.notasPorJuez || {};

      for (var j = 1; j <= getJudgeCount(); j++) {
        var key = 'j' + j;
        if (!calificacion.judges || !calificacion.judges[key] || !calificacion.judges[key].scores) continue;
        var sub = judgeSubtotal(calificacion.judges[key].scores);
        if (sub != null) {
          existing.judges[key] = {
            scores: calificacion.judges[key].scores,
            subtotal: sub,
            actualizado: new Date().toISOString(),
            manual: true
          };
        }
      }

      var t = computeTotals(existing.judges);
      existing.sumaTotal = t.sumaTotal;
      existing.promedio = t.promedio;
      existing.actualizado = new Date().toISOString();
      data.scores[calificacion.competidorId] = existing;
      data.actualizado = new Date().toISOString();
      return sheetsPost({
        action: 'pasaporte_config_save',
        key: storageKey(CONFIG_KEY),
        data: data
      }).then(function () {
        calificacionesMap[existing.competidorId] = existing;
        return existing;
      });
    });
  }

  function judgeSubtotal(scores) {
    if (!scores) return null;
    var sub = 0;
    var complete = true;
    getCriteria().forEach(function (crit) {
      var v = parseInt(scores[crit.key], 10);
      if (!isScoreInScale(v)) complete = false;
      else sub += v;
    });
    return complete ? sub : null;
  }

  function computeTotals(judges) {
    var subs = [];
    var need = getJudgeCount();
    for (var j = 1; j <= need; j++) {
      var g = judges && judges['j' + j];
      if (g && g.subtotal != null) subs.push(g.subtotal);
    }
    if (subs.length === need) {
      var suma = subs.reduce(function (a, b) { return a + b; }, 0);
      return { sumaTotal: suma, promedio: Math.round((suma / need) * 100) / 100 };
    }
    return { sumaTotal: null, promedio: null };
  }

  function normalizeCalificacion(raw, competidorIdFallback) {
    if (!raw) return null;
    var cal = Object.assign({}, raw);
    if (!cal.competidorId && competidorIdFallback) cal.competidorId = competidorIdFallback;
    if (!cal.judges) cal.judges = {};
    var jmax = getJudgeCount();
    for (var j = 1; j <= jmax; j++) {
      var key = 'j' + j;
      if (cal.judges[key] && cal.judges[key].scores && cal.judges[key].subtotal == null) {
        cal.judges[key].subtotal = judgeSubtotal(cal.judges[key].scores);
      }
    }
    var t = computeTotals(cal.judges);
    cal.sumaTotal = t.sumaTotal;
    cal.promedio = t.promedio;
    return cal;
  }

  function judgeScoreValue(row, j) {
    var g = row.judges && row.judges['j' + j];
    if (g && g.subtotal != null) return g.subtotal;
    return null;
  }

  function judgeDone(judges, num) {
    var g = judges && judges['j' + num];
    return !!(g && g.subtotal != null);
  }

  function judgesStatusHtml(judges) {
    var parts = [];
    var jmax = getJudgeCount();
    for (var j = 1; j <= jmax; j++) {
      var done = judgeDone(judges, j);
      parts.push('<span class="jurado-judge-pill' + (done ? ' jurado-judge-pill--done' : '') + '">J' + j + (done ? ' ✓' : '') + '</span>');
    }
    return parts.join(' ');
  }

  function readSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeSession(sess) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(sess)); } catch (e) { /* ignore */ }
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function hideAll() {
    $('pinSection').hidden = true;
    $('roleSection').hidden = true;
    if ($('judgeOnboardingSection')) $('judgeOnboardingSection').hidden = true;
    $('judgeSection').hidden = true;
    $('organizerSection').hidden = true;
    if ($('hubSection')) $('hubSection').hidden = true;
    $('loadingMsg').hidden = true;
  }

  function showPinError(msg) {
    hideAll();
    $('pinSection').hidden = false;
    $('pinError').textContent = msg;
    $('pinError').hidden = false;
  }

  function fillCompetidorSelect(selectEl, includeEmpty, sourceList) {
    var list = sourceList || competidores;
    selectEl.innerHTML = includeEmpty !== false
      ? '<option value="">— Selecciona competidor —</option>'
      : '';
    list.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nombre;
      selectEl.appendChild(opt);
    });
  }

  function competidoresActivos() {
    var ids = getActiveCompetitorIds();
    return competidores.filter(function (c) { return ids.indexOf(c.id) >= 0; });
  }

  function isActiveParticipant(id) {
    return getActiveCompetitorIds().indexOf(id) >= 0;
  }

  function renderOrganizerDetailAdminActions(competidorId) {
    var html = '<div class="jurado-detail-admin">';
    html += '<button type="button" class="jurado-btn jurado-btn--secondary jurado-btn--small" data-edit-scores="' + escapeHtml(competidorId) + '">Editar puntajes</button> ';
    html += '<button type="button" class="jurado-btn jurado-btn--secondary jurado-btn--small" data-reset-one="' + escapeHtml(competidorId) + '">Reiniciar puntajes</button> ';
    if (isActiveParticipant(competidorId)) {
      html += '<button type="button" class="jurado-btn jurado-btn--danger jurado-btn--small" data-eliminar="' + escapeHtml(competidorId) + '">Eliminar de la ronda</button>';
    } else {
      html += '<button type="button" class="jurado-btn jurado-btn--secondary jurado-btn--small" data-restaurar="' + escapeHtml(competidorId) + '">Restaurar en la ronda</button>';
    }
    html += '</div>';
    return html;
  }

  function competidorMeta(found) {
    var parts = [];
    if (found.ciudad) parts.push(found.ciudad);
    if (found.representa) parts.push(found.representa);
    return parts.join(' · ');
  }

  /* ——— Selector de rol ——— */
  function showRolePicker() {
    hideAll();
    $('headerSubtitle').textContent = 'Elige tu perfil para continuar';
    var grid = $('roleGrid');
    grid.innerHTML = '';

    if (pin === pinOrganizadorEffective()) {
      var orgBtn = document.createElement('button');
      orgBtn.type = 'button';
      orgBtn.className = 'jurado-role-btn jurado-role-btn--org';
      orgBtn.innerHTML = '<strong>Organizador</strong><span>Panel general y clasificación</span>';
      orgBtn.addEventListener('click', function () { enterOrganizer(); });
      grid.appendChild(orgBtn);
    }

    if (pin === pinJuezEffective()) {
      for (var n = 1; n <= getJudgeCount(); n++) {
        (function (num) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'jurado-role-btn';
          btn.innerHTML = '<strong>Juez ' + num + '</strong><span>Calificar desde tu celular</span>';
          btn.addEventListener('click', function () { enterJudge(num); });
          grid.appendChild(btn);
        })(n);
      }
    }

    $('roleSection').hidden = false;
    updateRoleSectionHint();
  }

  /* ——— Vista juez ——— */
  function buildJudgeScoreRow(crit, value) {
    var row = document.createElement('div');
    row.className = 'jurado-judge-row';
    row.innerHTML =
      '<div class="jurado-judge-row-label">' +
        '<strong>' + escapeHtml(crit.label) + '</strong>' +
        '<span>' + escapeHtml(crit.desc) + '</span>' +
      '</div>';

    var select = document.createElement('select');
    select.dataset.crit = crit.key;
    select.setAttribute('aria-label', crit.label);
    var empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '—';
    select.appendChild(empty);
    var smin = getScaleMin();
    var smax = getScaleMax();
    for (var n = smin; n <= smax; n++) {
      var opt = document.createElement('option');
      opt.value = String(n);
      opt.textContent = String(n);
      if (String(value) === String(n)) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', onJudgeScoreChange);
    row.appendChild(select);
    return row;
  }

  function renderJudgeForm(existing) {
    var list = $('judgeScoresList');
    list.innerHTML = '';
    var judgeKey = 'j' + judgeNum;
    var existingScores = existing && existing.judges && existing.judges[judgeKey]
      ? existing.judges[judgeKey].scores : null;

    getCriteria().forEach(function (crit) {
      var val = existingScores ? existingScores[crit.key] : '';
      list.appendChild(buildJudgeScoreRow(crit, val));
    });

    var notas = '';
    if (existing && existing.notasPorJuez && existing.notasPorJuez[judgeKey]) {
      notas = existing.notasPorJuez[judgeKey];
    }
    $('judgeNotasInput').value = notas;
    recalcJudgeSubtotal();
  }

  function readJudgeFormScores() {
    var scores = {};
    var complete = true;
    getCriteria().forEach(function (crit) {
      var sel = document.querySelector('#judgeScoresList select[data-crit="' + crit.key + '"]');
      var v = sel ? parseInt(sel.value, 10) : NaN;
      if (!isScoreInScale(v)) complete = false;
      else scores[crit.key] = v;
    });
    return { scores: scores, complete: complete };
  }

  function recalcJudgeSubtotal() {
    var form = readJudgeFormScores();
    if (form.complete) {
      var sub = 0;
      getCriteria().forEach(function (c) { sub += form.scores[c.key]; });
      $('judgeSubtotal').textContent = String(sub);
    } else {
      $('judgeSubtotal').textContent = '—';
    }
    $('judgeSaveBtn').disabled = !$('judgeCompetidorSelect').value || !form.complete || guardando;
  }

  function onJudgeScoreChange() {
    $('judgeSaveSuccess').hidden = true;
    $('judgeSaveError').hidden = true;
    recalcJudgeSubtotal();
  }

  function onJudgeCompetidorChange() {
    $('judgeSaveSuccess').hidden = true;
    $('judgeSaveError').hidden = true;
    var id = $('judgeCompetidorSelect').value;
    var found = competidores.find(function (c) { return c.id === id; });
    var meta = $('judgeCompetidorMeta');
    if (!found) {
      meta.hidden = true;
      meta.textContent = '';
      renderJudgeForm(null);
      return;
    }
    var metaParts = competidorMeta(found);
    if (shouldShowCompetitorPhotos()) {
      var photoUrl = driveThumbUrl(found.fotoUrl, 160);
      if (photoUrl) {
        meta.innerHTML = '<span class="judge-competitor-meta">' +
          '<img class="judge-competitor-photo" src="' + escapeHtml(photoUrl) + '" alt="" loading="lazy" referrerpolicy="no-referrer" width="56" height="56">' +
          '<span>' + escapeHtml(metaParts || found.nombre) + '</span></span>';
        meta.hidden = false;
      } else {
        meta.textContent = metaParts || found.nombre;
        meta.hidden = !meta.textContent;
      }
    } else {
      meta.textContent = metaParts;
      meta.hidden = !meta.textContent;
    }
    loadCalificacionesStore().then(function () {
      renderJudgeForm(calificacionesMap[id] || null);
    }).catch(function () {
      renderJudgeForm(calificacionesMap[id] || null);
    });
  }

  function mergeJudgeSave(competidorId, nombre, judgeData, notas) {
    var existing = calificacionesMap[competidorId] || {
      competidorId: competidorId,
      nombre: nombre,
      judges: {},
      notasPorJuez: {}
    };
    existing.nombre = nombre;
    existing.judges = existing.judges || {};
    existing.notasPorJuez = existing.notasPorJuez || {};
    var key = 'j' + judgeNum;
    existing.judges[key] = {
      scores: judgeData.scores,
      subtotal: judgeSubtotal(judgeData.scores),
      actualizado: new Date().toISOString()
    };
    if (notas) existing.notasPorJuez[key] = notas;
    else delete existing.notasPorJuez[key];
    var t = computeTotals(existing.judges);
    existing.sumaTotal = t.sumaTotal;
    existing.promedio = t.promedio;
    existing.actualizado = new Date().toISOString();
    return existing;
  }

  function onJudgeSave() {
    if (guardando) return;
    var competidorId = $('judgeCompetidorSelect').value;
    var found = competidores.find(function (c) { return c.id === competidorId; });
    if (!found) return;

    var form = readJudgeFormScores();
    if (!form.complete) {
      $('judgeSaveError').textContent = 'Completa todos los criterios (escala ' + getScaleMin() + '–' + getScaleMax() + ').';
      $('judgeSaveError').hidden = false;
      return;
    }

    guardando = true;
    $('judgeSaveBtn').disabled = true;
    $('judgeSaveBtn').textContent = 'Guardando…';
    $('judgeSaveError').hidden = true;
    $('judgeSaveSuccess').hidden = true;

    var cal = mergeJudgeSave(
      competidorId,
      found.nombre,
      form,
      $('judgeNotasInput').value.trim()
    );

    saveCalificacionStore(cal, 'j' + judgeNum)
      .then(function (saved) {
        calificacionesMap[saved.competidorId] = saved;
        $('judgeSaveSuccess').textContent =
          '✓ Guardado — ' + found.nombre + ' · Tu subtotal: ' + saved.judges['j' + judgeNum].subtotal;
        $('judgeSaveSuccess').hidden = false;
      })
      .catch(function (err) {
        $('judgeSaveError').textContent = err.message || 'No se pudo guardar.';
        $('judgeSaveError').hidden = false;
      })
      .finally(function () {
        guardando = false;
        $('judgeSaveBtn').textContent = 'Guardar mi calificación';
        recalcJudgeSubtotal();
      });
  }

  function enterJudge(num) {
    if (num < 1 || num > getJudgeCount()) {
      showRolePicker();
      return;
    }
    judgeNum = num;
    mode = 'judge';
    writeSession({ mode: 'judge', judgeNum: num, pin: pin });
    maybeShowJudgeUI();
  }

  function ensureJudgeOnboardingSection() {
    if ($('judgeOnboardingSection')) return;
    var judgeSection = $('judgeSection');
    if (!judgeSection || !judgeSection.parentNode) return;
    var section = document.createElement('section');
    section.id = 'judgeOnboardingSection';
    section.hidden = true;
    section.innerHTML =
      '<div class="jurado-card jurado-card--judge-onboarding">' +
      '<div class="jurado-card-head">' +
      '<h2>Tu perfil de juez</h2>' +
      '<p class="jurado-hint">La primera vez que entras debes subir una foto tuya. Así el organizador te identifica en el panel.</p>' +
      '</div>' +
      '<div class="jurado-field">' +
      '<label for="judgeProfileNombre">Tu nombre</label>' +
      '<input type="text" id="judgeProfileNombre" required autocomplete="name" placeholder="Nombre completo">' +
      '</div>' +
      '<div class="jurado-field">' +
      '<label for="judgeProfilePhotoFile">Tu foto</label>' +
      '<input type="file" id="judgeProfilePhotoFile" accept="image/*" capture="user">' +
      '<p class="jurado-field-hint">Selfie o retrato claro · máx. 2 MB</p>' +
      '<div id="judgeProfilePhotoPreview" class="judge-profile-photo-preview" hidden></div>' +
      '</div>' +
      '<p id="judgeProfileError" class="jurado-error" hidden></p>' +
      '<button type="button" id="judgeProfileSaveBtn" class="jurado-btn">Continuar al panel de calificación</button>' +
      '</div>';
    judgeSection.parentNode.insertBefore(section, judgeSection);
  }

  var judgeProfilePhotoDataUrl = '';

  function compressJudgePhotoFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || file.type.indexOf('image/') !== 0) {
        reject(new Error('Selecciona una imagen válida.'));
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        reject(new Error('La imagen debe pesar menos de 2 MB.'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var maxW = 1024;
          var w = img.width;
          var h = img.height;
          if (w > maxW) {
            h = Math.round(h * (maxW / w));
            w = maxW;
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve({
            dataUrl: canvas.toDataURL('image/jpeg', 0.85),
            nombreArchivo: file.name || 'juez-foto.jpg',
            tipoArchivo: 'image/jpeg'
          });
        };
        img.onerror = function () { reject(new Error('No se pudo leer la imagen.')); };
        img.src = reader.result;
      };
      reader.onerror = function () { reject(new Error('No se pudo cargar el archivo.')); };
      reader.readAsDataURL(file);
    });
  }

  function renderJudgeProfilePreview(dataUrl) {
    var preview = $('judgeProfilePhotoPreview');
    if (!preview) return;
    if (dataUrl) {
      preview.innerHTML = '<img src="' + escapeHtml(dataUrl) + '" alt="Vista previa de tu foto" class="judge-profile-photo-preview__img">';
      preview.hidden = false;
    } else {
      preview.innerHTML = '';
      preview.hidden = true;
    }
  }

  function bindJudgeOnboardingOnce() {
    var fileInput = $('judgeProfilePhotoFile');
    var saveBtn = $('judgeProfileSaveBtn');
    if (!fileInput || !saveBtn || saveBtn.dataset.bound) return;
    saveBtn.dataset.bound = '1';

    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) {
        judgeProfilePhotoDataUrl = '';
        renderJudgeProfilePreview('');
        return;
      }
      compressJudgePhotoFile(file).then(function (payload) {
        judgeProfilePhotoDataUrl = payload.dataUrl;
        renderJudgeProfilePreview(payload.dataUrl);
        var err = $('judgeProfileError');
        if (err) err.hidden = true;
      }).catch(function (err) {
        judgeProfilePhotoDataUrl = '';
        renderJudgeProfilePreview('');
        var errEl = $('judgeProfileError');
        if (errEl) {
          errEl.textContent = err.message || 'No se pudo procesar la imagen.';
          errEl.hidden = false;
        }
      });
    });

    saveBtn.addEventListener('click', onJudgeProfileSave);
  }

  function saveJudgeProfileRemote(nombre, fotoPayload) {
    return sheetsPost({
      action: 'jurado_juez_profile_save',
      evt: tenantSlug || undefined,
      tenantSlug: tenantSlug || undefined,
      pin: pin,
      judgeNum: judgeNum,
      nombre: nombre,
      foto: {
        base64: fotoPayload.dataUrl,
        nombreArchivo: fotoPayload.nombreArchivo,
        tipoArchivo: fotoPayload.tipoArchivo
      }
    });
  }

  function onJudgeProfileSave() {
    var nombre = ($('judgeProfileNombre') && $('judgeProfileNombre').value || '').trim();
    var errEl = $('judgeProfileError');
    var saveBtn = $('judgeProfileSaveBtn');
    if (!nombre || nombre.length < 2) {
      if (errEl) {
        errEl.textContent = 'Ingresa tu nombre completo.';
        errEl.hidden = false;
      }
      return;
    }
    if (!judgeProfilePhotoDataUrl) {
      if (errEl) {
        errEl.textContent = 'Sube una foto tuya para continuar.';
        errEl.hidden = false;
      }
      return;
    }
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Guardando…';
    }
    if (errEl) errEl.hidden = true;

    var fotoPayload = {
      dataUrl: judgeProfilePhotoDataUrl,
      nombreArchivo: 'juez-' + judgeNum + '.jpg',
      tipoArchivo: 'image/jpeg'
    };

    saveJudgeProfileRemote(nombre, fotoPayload).then(function (res) {
      var profile = {
        num: judgeNum,
        nombre: res.nombre || nombre,
        fotoUrl: res.fotoUrl || '',
        updatedAt: new Date().toISOString()
      };
      mergeJudgeProfileIntoConfig(judgeNum, profile);
      writeJudgeProfileLocal(judgeNum, profile);
      showJudgeUI();
    }).catch(function (err) {
      if (errEl) {
        errEl.textContent = err.message || 'No se pudo guardar tu perfil.';
        errEl.hidden = false;
      }
    }).finally(function () {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Continuar al panel de calificación';
      }
    });
  }

  function showJudgeOnboarding() {
    ensureJudgeOnboardingSection();
    bindJudgeOnboardingOnce();
    hideAll();
    document.body.classList.remove('jurado-page--organizer');
    applyPlatformBranding();
    var badge = $('judgeBadge');
    if (badge) badge.textContent = 'Juez ' + judgeNum;
    var existing = getJudgeProfile(judgeNum);
    var nombreInput = $('judgeProfileNombre');
    if (nombreInput && existing && existing.nombre) nombreInput.value = existing.nombre;
    judgeProfilePhotoDataUrl = '';
    renderJudgeProfilePreview('');
    var fileInput = $('judgeProfilePhotoFile');
    if (fileInput) fileInput.value = '';
    var errEl = $('judgeProfileError');
    if (errEl) errEl.hidden = true;
    $('judgeOnboardingSection').hidden = false;
    if ($('headerSubtitle')) {
      $('headerSubtitle').textContent = 'Completa tu perfil para empezar a calificar';
    }
  }

  function maybeShowJudgeUI() {
    if (hasJudgeProfile(judgeNum)) {
      showJudgeUI();
    } else {
      showJudgeOnboarding();
    }
  }

  function renderJudgeBadge() {
    var badge = $('judgeBadge');
    if (!badge) return;
    var profile = getJudgeProfile(judgeNum);
    var photoUrl = profile && profile.fotoUrl ? driveThumbUrl(profile.fotoUrl, 80) : '';
    if (photoUrl) {
      badge.innerHTML =
        '<img class="judge-badge-photo" src="' + escapeHtml(photoUrl) + '" alt="" width="32" height="32" loading="lazy" referrerpolicy="no-referrer">' +
        '<span>Juez ' + judgeNum + (profile.nombre ? ' · ' + escapeHtml(profile.nombre) : '') + '</span>';
      badge.classList.add('jurado-badge--with-photo');
    } else {
      badge.textContent = 'Juez ' + judgeNum;
      badge.classList.remove('jurado-badge--with-photo');
    }
  }

  function showJudgeUI() {
    hideAll();
    document.body.classList.remove('jurado-page--organizer');
    applyPlatformBranding();
    renderJudgeBadge();

    fillCompetidorSelect($('judgeCompetidorSelect'), true, competidoresActivos());
    renderJudgeForm(null);

    $('judgeSection').hidden = false;
    $('judgeCompetidorSelect').addEventListener('change', onJudgeCompetidorChange);
    $('judgeSaveBtn').addEventListener('click', onJudgeSave);
    $('judgeLogoutBtn').addEventListener('click', function () {
      clearSession();
      if (pin === pinJuezEffective()) showRolePicker();
      else showPinError('Sesión cerrada.');
    });
  }

  function calificacionesList() {
    return Object.keys(calificacionesMap).map(function (id) { return calificacionesMap[id]; });
  }

  function showOrganizerError(msg) {
    var el = $('organizerLoadError');
    if (!el) return;
    el.textContent = msg || 'Error al cargar el panel.';
    el.hidden = false;
  }

  function clearOrganizerError() {
    var el = $('organizerLoadError');
    if (el) el.hidden = true;
  }

  function renderOrganizerViews(list) {
    renderFifaTableHead();
    renderRankingTableHead();
    updateScoringHints();
    renderFifaPanelBrand();
    renderOrganizerStats();
    renderFifaStandings();
    renderOrganizerLinksPanel();
    renderTournamentPlanPanel();
    renderTournamentJourney();
    renderJourneySummaryMini();
    renderOrganizerAdminPanel();
    renderOrganizerBracket();
    renderOrganizerScoresTable();
    renderPlatformConfigForm();
    renderExportPreview();
    renderInscripcionesPanel();
    var detailId = $('organizerCompetidorSelect') ? $('organizerCompetidorSelect').value : '';
    if (!(manualEditDirty && detailId && detailId === manualEditCompetidorId)) {
      renderOrganizerDetail(detailId);
    }
    if (detailId) renderOrganizerManualEdit(detailId);
    else hideOrganizerManualEdit();
  }

  function switchDashTab(tabId) {
    activeDashTab = tabId;
    document.querySelectorAll('.jurado-dash-tab').forEach(function (btn) {
      var on = btn.getAttribute('data-dash-tab') === tabId;
      btn.classList.toggle('jurado-dash-tab--active', on);
    });
    document.querySelectorAll('.jurado-dash-pane').forEach(function (pane) {
      var match = pane.getAttribute('data-dash-pane') === tabId;
      pane.hidden = !match;
      pane.classList.toggle('jurado-dash-pane--active', match);
    });
    if (tabId === 'export') renderExportPreview();
    if (tabId === 'historial') renderCompetitionHistoryPanel();
    if (tabId === 'enlaces') renderEventLinksPanel();
    if (tabId === 'inscripciones') {
      renderInscripcionesPanel();
      loadInscripcionesTable();
    }
    updateSetupStepper();
  }

  function bindDashboardTabs() {
    if (dashboardTabsBound) return;
    dashboardTabsBound = true;
    document.querySelectorAll('.jurado-dash-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchDashTab(btn.getAttribute('data-dash-tab') || 'vista');
      });
    });
    var gotoRecorrido = $('gotoRecorridoBtn');
    if (gotoRecorrido) {
      gotoRecorrido.addEventListener('click', function () {
        switchDashTab('recorrido');
      });
    }
  }

  function formatHistorialDate(iso) {
    try {
      return new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
      return iso || '';
    }
  }

  function renderCurrentRoundProgress() {
    var activos = getActiveCompetitorIds();
    var total = activos.length;
    var listos = activos.filter(function (id) {
      return puntajeEstado(getRowById(id)) === 'listo';
    }).length;
    var pct = total ? Math.round((listos / total) * 100) : 0;
    var autoHint = isAutoAdvanceEnabled()
      ? (canAutoAdvanceNow() ? 'Listo para avanzar automáticamente' : listos + '/' + total + ' calificados')
      : 'Avance manual (activa en Marca y reglas)';
    return '<div class="jurado-progress-card">' +
      '<div class="jurado-progress-head"><strong>' + escapeHtml(currentPhaseTitle()) + '</strong>' +
      '<span class="jurado-meta">' + autoHint + '</span></div>' +
      '<div class="jurado-progress-bar" role="progressbar" aria-valuenow="' + pct + '">' +
      '<div class="jurado-progress-fill" style="width:' + pct + '%"></div></div>' +
      '<p class="jurado-hint">' + listos + ' de ' + total + ' con puntaje completo' +
      (isAutoAdvanceEnabled() ? ' · avance automático activo' : '') + '</p></div>';
  }

  function renderGroupsOverview() {
    var grupos = bracketState && bracketState.grupos && bracketState.grupos.length
      ? groupsSnapshotForHistory()
      : null;
    if (!grupos || !grupos.length) {
      var hist = (bracketState && bracketState.historial) ? bracketState.historial : [];
      for (var i = hist.length - 1; i >= 0; i--) {
        if (hist[i].grupos && hist[i].grupos.length) {
          grupos = hist[i].grupos;
          break;
        }
      }
    }
    if (!grupos || !grupos.length) return '';

    var html = '<h3 class="jurado-admin-subtitle">Grupos del torneo</h3><div class="jurado-grupos-grid jurado-grupos-grid--recorrido">';
    grupos.forEach(function (g) {
      var cls = 'jurado-grupo-card';
      if (g.cerrado) cls += ' jurado-grupo-card--done';
      if (g.activo) cls += ' jurado-grupo-card--active';
      html += '<article class="' + cls + '"><h4>Grupo ' + escapeHtml(g.nombre) + '</h4><ul class="jurado-grupo-members">';
      (g.miembros || []).forEach(function (m) {
        html += '<li>' + escapeHtml(m.nombre) +
          (m.puntaje != null ? ' <span class="jurado-grupo-pts">' + m.puntaje + ' pts</span>' : '') +
          (m.listo ? ' ✓' : '') + '</li>';
      });
      html += '</ul><p class="jurado-hint">Clasifican ' + (g.avance || 2) +
        (g.cerrado ? ' · cerrado' : (g.activo ? ' · en juego' : '')) + '</p></article>';
    });
    html += '</div>';
    return html;
  }

  function renderHistorialTimeline() {
    var hist = (bracketState && bracketState.historial) ? bracketState.historial.slice() : [];
    if (!hist.length) {
      return '<p class="jurado-hint">Aún no hay rondas registradas. Ejecuta el sorteo para iniciar el recorrido.</p>';
    }
    var tipoLabels = { sorteo: 'Sorteo', grupo: 'Grupo', duelos: 'Duelos', ranking: 'Ranking' };
    var html = '<h3 class="jurado-admin-subtitle">Historial de rondas</h3><div class="jurado-history-timeline">';
    hist.slice().reverse().forEach(function (entry) {
      html += '<article class="jurado-history-entry jurado-history-entry--' + escapeHtml(entry.tipo || '') + '">';
      html += '<header class="jurado-history-head">';
      html += '<span class="jurado-history-badge">' + escapeHtml(tipoLabels[entry.tipo] || entry.tipo || '') + '</span>';
      html += '<strong>' + escapeHtml(entry.titulo || '') + '</strong>';
      html += '<time class="jurado-meta">' + formatHistorialDate(entry.at) + '</time>';
      html += '</header>';
      if (entry.participantes && entry.participantes.length) {
        html += '<ol class="jurado-history-list">';
        entry.participantes.forEach(function (p) {
          var cls = p.clasifica ? ' jurado-history-player--pass' :
            (p.clasifica === false ? ' jurado-history-player--out' : '');
          html += '<li class="jurado-history-player' + cls + '">';
          if (p.posicion) html += '<span class="jurado-history-pos">' + p.posicion + '</span>';
          html += '<span class="jurado-history-name">' + escapeHtml(p.nombre) + '</span>';
          if (p.rivalNombre) html += '<span class="jurado-history-vs">vs ' + escapeHtml(p.rivalNombre) + '</span>';
          if (p.puntaje != null) html += '<span class="jurado-history-score">' + p.puntaje + ' pts</span>';
          if (p.clasifica) html += '<span class="jurado-duel-badge">Pasa</span>';
          else if (p.clasifica === false) html += '<span class="jurado-history-out">Eliminado</span>';
          html += '</li>';
        });
        html += '</ol>';
      }
      if (entry.clasificados && entry.clasificados.length) {
        html += '<p class="jurado-meta">Avanzan: ' + entry.clasificados.map(function (id) {
          return escapeHtml(competitorName(id));
        }).join(', ') + '</p>';
      }
      html += '</article>';
    });
    html += '</div>';
    return html;
  }

  function renderTournamentJourney() {
    var box = $('tournamentJourneyPanel');
    if (!box) return;
    box.innerHTML = renderCurrentRoundProgress() + renderGroupsOverview() + renderHistorialTimeline();
    renderJourneySummaryMini();
  }

  function renderJourneySummaryMini() {
    var box = $('journeySummaryMini');
    if (!box) return;
    var hist = bracketState && bracketState.historial ? bracketState.historial : [];
    var last = hist.length ? hist[hist.length - 1] : null;
    var html = '';
    var activos = getActiveCompetitorIds();
    var listos = activos.filter(function (id) {
      return puntajeEstado(getRowById(id)) === 'listo';
    }).length;
    html += '<p class="jurado-hint">' + listos + '/' + activos.length + ' calificados en ' +
      escapeHtml(currentPhaseTitle()) + (isAutoAdvanceEnabled() ? ' · auto-avance ON' : '') + '</p>';
    if (last) {
      html += '<p class="jurado-meta">Última ronda registrada: <strong>' + escapeHtml(last.titulo) +
        '</strong> · ' + formatHistorialDate(last.at) + '</p>';
    } else {
      html += '<p class="jurado-hint">Sin historial aún. Usa el sorteo automático en Control.</p>';
    }
    box.innerHTML = html;
  }

  function renderOrganizerStats() {
    var box = $('organizerStatsRow');
    if (!box) return;
    var activos = getActiveCompetitorIds().length;
    var elim = (bracketState && bracketState.eliminados) ? bracketState.eliminados.length : 0;
    var listos = competidores.filter(function (c) {
      if (getActiveCompetitorIds().indexOf(c.id) < 0) return false;
      var row = getRowById(c.id);
      return puntajeEstado(row) === 'listo';
    }).length;
    var phase = currentPhaseTitle();
    box.innerHTML =
      '<div class="jurado-stat-card"><span class="jurado-stat-value">' + activos + '</span><span class="jurado-stat-label">Activos</span></div>' +
      '<div class="jurado-stat-card"><span class="jurado-stat-value">' + listos + '</span><span class="jurado-stat-label">Calificados</span></div>' +
      '<div class="jurado-stat-card"><span class="jurado-stat-value">' + elim + '</span><span class="jurado-stat-label">Eliminados</span></div>' +
      '<div class="jurado-stat-card jurado-stat-card--phase"><span class="jurado-stat-value jurado-stat-value--text">' + escapeHtml(phase) + '</span><span class="jurado-stat-label">Fase actual</span></div>';
  }

  function fifaPosClass(pos) {
    if (pos === 1) return 'jurado-fifa-pos--gold';
    if (pos === 2) return 'jurado-fifa-pos--silver';
    if (pos === 3) return 'jurado-fifa-pos--bronze';
    return '';
  }

  function renderFifaStandings() {
    var tbody = $('fifaStandingsBody');
    if (!tbody) return;

    var rows = buildUnifiedOrganizerRows().filter(function (row) {
      return getActiveCompetitorIds().indexOf(row.competidorId) >= 0;
    }).slice().sort(function (a, b) {
      var ta = puntajeTotal(a) != null ? puntajeTotal(a) : partialScore(a);
      var tb = puntajeTotal(b) != null ? puntajeTotal(b) : partialScore(b);
      if (tb !== ta) return tb - ta;
      return (a.nombre || '').localeCompare(b.nombre || '', 'es');
    });

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="' + fifaColspan() + '" class="jurado-empty">Sin participantes activos en esta ronda.</td></tr>';
      return;
    }

    var need = getJudgeCount();
    var showPhotos = shouldShowCompetitorPhotos();
    tbody.innerHTML = rows.map(function (row, idx) {
      var pos = idx + 1;
      var total = puntajeTotal(row);
      var partial = partialScore(row);
      var pts = total != null ? total : (partial > 0 ? partial + '*' : '—');
      var estado = puntajeEstado(row);
      var estadoLabel = estado === 'listo' ? '✓ Listo' : estado === 'parcial' ? 'En curso' : 'Pendiente';
      var estadoCls = estado === 'listo' ? 'jurado-fifa-estado--ok' : estado === 'parcial' ? 'jurado-fifa-estado--partial' : '';
      var cat = countJudgesDone(row);
      var judgeCells = formatJudgeScores(row).map(function (v) { return '<td>' + v + '</td>'; }).join('');
      var comp = competidores.find(function (c) { return c.id === row.competidorId; });
      var photoCell = showPhotos
        ? '<td class="jurado-fifa-photo-col">' + competitorPhotoHtml(comp, 120) + '</td>'
        : '';
      return '<tr class="jurado-fifa-row' + (pos <= 3 ? ' jurado-fifa-row--top' : '') + '">' +
        '<td class="jurado-fifa-pos ' + fifaPosClass(pos) + '">' + pos + '</td>' +
        photoCell +
        '<td class="jurado-fifa-team"><span class="jurado-fifa-name">' + escapeHtml(row.nombre) + '</span></td>' +
        '<td>' + cat + '/' + need + '</td>' +
        judgeCells +
        '<td class="jurado-fifa-pts"><strong>' + pts + '</strong></td>' +
        '<td class="' + estadoCls + '">' + estadoLabel + '</td>' +
        '</tr>';
    }).join('');
  }

  function partialScore(row) {
    var sum = 0;
    var any = false;
    var jmax = getJudgeCount();
    for (var j = 1; j <= jmax; j++) {
      var v = judgeScoreValue(row, j);
      if (v != null) { sum += v; any = true; }
    }
    return any ? sum : -1;
  }

  function advanceByGeneralScore() {
    var activos = getActiveCompetitorIds();
    if (activos.length < 2) {
      return Promise.reject(new Error('Se necesitan al menos 2 participantes activos.'));
    }
    var ranked = activos.map(getRowById).sort(function (a, b) {
      var ta = puntajeTotal(a) != null ? puntajeTotal(a) : partialScore(a);
      var tb = puntajeTotal(b) != null ? puntajeTotal(b) : partialScore(b);
      if (tb !== ta) return tb - ta;
      return (a.nombre || '').localeCompare(b.nombre || '', 'es');
    });
    var notReady = ranked.filter(function (p) { return puntajeEstado(p) !== 'listo'; });
    if (notReady.length) {
      return Promise.reject(new Error('Faltan calificaciones completas de ' + notReady.length + ' competidor(es).'));
    }
    var advance = getAdvanceCount(activos.length);
    var winners = ranked.slice(0, advance).map(function (p) { return p.competidorId; });
    var previousActivos = activos.slice();
    recordRankingRoundHistory(ranked, winners, previousActivos);
    bracketState.activos = winners;
    bracketState.fase = phaseForActiveCount(winners.length);
    bracketState.rondaEnFase = (bracketState.rondaEnFase || 1) + 1;
    bracketState.overrides = {};
    previousActivos.forEach(function (id) {
      if (winners.indexOf(id) < 0 && bracketState.eliminados.indexOf(id) < 0) {
        bracketState.eliminados.push(id);
      }
    });
    clearPublishedResultsForIds(winners);
    return saveBracketStore(bracketState).then(function () {
      return resetScoresForIds(winners);
    });
  }

  function advanceDuelWinners() {
    var current = buildCurrentDuelRound();
    if (!current || current.matches.length < 1) {
      return Promise.reject(new Error('No hay duelos en esta ronda.'));
    }
    var winners = [];
    var pending = false;
    current.matches.forEach(function (m) {
      var r = resolveMatch(m.aId, m.bId, 1, m.duelNum);
      if (r.winnerId) winners.push(r.winnerId);
      else if (m.bId) pending = true;
    });
    if (pending) {
      return Promise.reject(new Error('Aún hay duelos sin ganador (faltan puntajes, empate o declara ganador).'));
    }
    if (!winners.length) {
      return Promise.reject(new Error('No hay ganadores para avanzar.'));
    }
    var previousActivos = getActiveCompetitorIds();
    recordDuelosRoundHistory(current, winners, previousActivos);
    bracketState.activos = winners;
    bracketState.fase = phaseForActiveCount(winners.length);
    bracketState.rondaEnFase = (bracketState.rondaEnFase || 1) + 1;
    bracketState.overrides = {};
    previousActivos.forEach(function (id) {
      if (winners.indexOf(id) < 0 && bracketState.eliminados.indexOf(id) < 0) {
        bracketState.eliminados.push(id);
      }
    });
    clearPublishedResultsForIds(winners);
    return saveBracketStore(bracketState).then(function () {
      return resetScoresForIds(winners);
    });
  }

  function canAutoAdvanceNow() {
    if (!isAutoAdvanceEnabled() || autoAdvancing) return false;
    if (Date.now() < autoAdvanceCooldownUntil) return false;
    if (!bracketState || !getActiveCompetitorIds().length) return false;
    if (!allActiveScoresReady()) return false;

    var last = bracketState.historial && bracketState.historial.length
      ? bracketState.historial[bracketState.historial.length - 1]
      : null;
    if (last && last.roundKey === roundProgressKey()) return false;

    if (isGruposPhase()) return true;
    if (isPuntajeGeneralMode()) return getActiveCompetitorIds().length >= 2;

    var current = buildCurrentDuelRound();
    if (!current || !current.matches.length) return false;
    return current.matches.every(function (m) {
      return !!resolveMatch(m.aId, m.bId, 1, m.duelNum).winnerId;
    });
  }

  function maybeAutoAdvance() {
    if (mode !== 'organizer' || !canAutoAdvanceNow()) return Promise.resolve(false);
    autoAdvancing = true;
    var action;
    if (isGruposPhase()) action = closeCurrentGrupo();
    else if (isPuntajeGeneralMode()) action = advanceByGeneralScore();
    else action = advanceDuelWinners();

    return action.then(function () {
      autoAdvanceCooldownUntil = Date.now() + 5000;
      showAdminMsg('✓ Avance automático · ' + currentPhaseTitle());
      return true;
    }).catch(function () {
      return false;
    }).finally(function () {
      autoAdvancing = false;
    });
  }

  function renderRankedActivePanel(opts) {
    opts = opts || {};
    var activos = getActiveCompetitorIds();
    var advance = getAdvanceCount(activos.length);
    var ranked = activos.map(getRowById).sort(function (a, b) {
      var ta = puntajeTotal(a) != null ? puntajeTotal(a) : partialScore(a);
      var tb = puntajeTotal(b) != null ? puntajeTotal(b) : partialScore(b);
      if (tb !== ta) return tb - ta;
      return (a.nombre || '').localeCompare(b.nombre || '', 'es');
    });
    var intro = opts.intro || 'Clasificación por puntaje total (todos los jueces).';
    var html = '<div class="jurado-grupo-play">';
    html += '<p class="jurado-hint">' + intro + ' Avanzan los <strong>' + advance + '</strong> mejores.</p>';
    html += '<ol class="jurado-round-rank">';
    ranked.forEach(function (p, idx) {
      var t = puntajeTotal(p);
      var passes = idx < advance;
      html += '<li class="jurado-round-rank-item' + (passes ? ' jurado-round-rank-item--pass' : '') + '">';
      html += '<span class="jurado-round-rank-pos">' + (idx + 1) + '</span>';
      html += '<span class="jurado-round-rank-name">' + escapeHtml(p.nombre) + '</span>';
      html += '<span class="jurado-round-rank-score">' + (t != null ? t + ' pts' : '—') + '</span>';
      if (passes) html += '<span class="jurado-duel-badge">Clasifica</span>';
      html += '</li>';
    });
    html += '</ol></div>';
    return html;
  }

  function readFormFieldsFromEditor() {
    var rows = document.querySelectorAll('.jurado-form-field-row');
    var list = [];
    rows.forEach(function (row) {
      var key = row.getAttribute('data-field-key') || '';
      var labelEl = row.querySelector('[data-field-label]');
      var enabledEl = row.querySelector('[data-field-enabled]');
      var requiredEl = row.querySelector('[data-field-required]');
      var typeEl = row.querySelector('[data-field-type]');
      var phEl = row.querySelector('[data-field-placeholder]');
      if (!key || !labelEl) return;
      list.push({
        key: key,
        label: labelEl.value.trim(),
        type: typeEl ? typeEl.value : 'text',
        enabled: enabledEl ? enabledEl.checked : true,
        required: requiredEl ? requiredEl.checked : false,
        placeholder: phEl ? phEl.value.trim() : ''
      });
    });
    return normalizeFormFieldsList(list);
  }

  function renderFormFieldsEditor(fields) {
    var box = $('formFieldsEditorList');
    if (!box) return;
    var list = normalizeFormFieldsList(fields);
    box.innerHTML = list.map(function (f) {
      return '<div class="jurado-form-field-row" data-field-key="' + escapeHtml(f.key) + '">' +
        '<label class="jurado-checkbox-label"><input type="checkbox" data-field-enabled' + (f.enabled ? ' checked' : '') + '> Activo</label>' +
        '<input type="text" data-field-label value="' + escapeHtml(f.label) + '" maxlength="80" placeholder="Etiqueta">' +
        '<select data-field-type>' +
        ['text', 'email', 'tel', 'number', 'textarea'].map(function (t) {
          return '<option value="' + t + '"' + (f.type === t ? ' selected' : '') + '>' + t + '</option>';
        }).join('') +
        '</select>' +
        '<label class="jurado-checkbox-label"><input type="checkbox" data-field-required' + (f.required ? ' checked' : '') + '> Obligatorio</label>' +
        '<input type="text" data-field-placeholder value="' + escapeHtml(f.placeholder || '') + '" maxlength="80" placeholder="Placeholder">' +
        '</div>';
    }).join('');
    bindFormFieldsEditorActions();
  }

  function bindFormFieldsEditorActions() {
    var box = $('formFieldsEditorList');
    if (!box || box.dataset.bound) return;
    box.dataset.bound = '1';
    box.addEventListener('input', function () { updateConfigPreview(); });
    box.addEventListener('change', function () { updateConfigPreview(); });
  }

  function renderInscripcionesPanel() {
    var urlEl = $('inscripcionPublicUrl');
    var hint = $('inscripcionPublicHint');
    if (!urlEl) return;
    if (!tenantSlug) {
      urlEl.textContent = '—';
      if (hint) hint.textContent = 'Disponible solo en torneos white-label (URL con ?evt=slug).';
      return;
    }
    var url = competenciaTorneoUrl();
    urlEl.textContent = url;
    urlEl.setAttribute('data-url', url);
    var openLink = $('inscripcionOpenLink');
    if (openLink) openLink.href = url;
    if (hint) {
      hint.textContent = 'Comparte este enlace en redes, QR o correo. Los datos se guardan en la hoja del torneo.';
    }
  }

  function inscripcionesDisplayColumns() {
    var fields = (platformConfig && platformConfig.formFields) || DEFAULT_FORM_FIELDS;
    return normalizeFormFieldsList(fields).filter(function (f) { return f.enabled; }).map(function (f) {
      var colMap = {
        nombre: 'Nombre',
        documento: 'Documento',
        celular: 'Celular',
        correo: 'Correo',
        edad: 'Edad',
        ciudad: 'Ciudad',
        representa: 'Representa',
        rol: 'Rol',
        experiencia: 'Experiencia café',
        observaciones: 'Observaciones'
      };
      return { key: f.key, label: f.label, col: colMap[f.key] || f.label };
    });
  }

  function renderInscripcionesTable(rows) {
    var head = $('inscripcionesTableHead');
    var tbody = $('inscripcionesTableBody');
    if (!tbody) return;
    var cols = inscripcionesDisplayColumns();
    if (head) {
      head.innerHTML = '<tr>' +
        cols.map(function (c) { return '<th>' + escapeHtml(c.label) + '</th>'; }).join('') +
        '<th>Fecha</th><th>Habilitado</th></tr>';
    }
    if (!rows || !rows.length) {
      tbody.innerHTML = '<tr><td colspan="' + (cols.length + 2) + '" class="jurado-empty">Aún no hay inscripciones en línea.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (row) {
      var cells = cols.map(function (c) {
        return '<td>' + escapeHtml(row[c.col] != null ? row[c.col] : '') + '</td>';
      }).join('');
      return '<tr>' + cells +
        '<td>' + escapeHtml(row['Fecha registro'] || '') + '</td>' +
        '<td>' + escapeHtml(row.Habilitado || '—') + '</td></tr>';
    }).join('');
  }

  function loadInscripcionesTable() {
    var tbody = $('inscripcionesTableBody');
    var meta = $('inscripcionesMeta');
    if (!tbody) return;
    if (!tenantSlug) {
      tbody.innerHTML = '<tr><td colspan="99" class="jurado-empty">Abre este panel con un torneo (?evt=slug en la URL).</td></tr>';
      if (meta) meta.textContent = '';
      return;
    }
    tbody.innerHTML = '<tr><td colspan="99" class="jurado-empty">Cargando inscripciones…</td></tr>';
    sheetsGet('competencia_torneo_inscripciones', {
      evt: tenantSlug,
      pin: pinOrganizadorEffective()
    }).then(function (data) {
      var rows = data.rows || [];
      renderInscripcionesTable(rows);
      if (meta && data.registration) {
        var reg = data.registration;
        meta.textContent = rows.length + ' inscripción(es) · cupo ' +
          (reg.inscritos != null ? reg.inscritos : rows.length) + '/' + (reg.cupo || '—');
      }
    }).catch(function (err) {
      tbody.innerHTML = '<tr><td colspan="99" class="jurado-error">' +
        escapeHtml(err.message || 'No se pudieron cargar las inscripciones.') + '</td></tr>';
      if (meta) meta.textContent = '';
    });
  }

  function bindInscripcionesPanel() {
    if (inscripcionesBound) return;
    var copyBtn = $('inscripcionCopyBtn');
    var refreshBtn = $('inscripcionesRefreshBtn');
    if (!copyBtn && !refreshBtn) return;
    inscripcionesBound = true;
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var urlEl = $('inscripcionPublicUrl');
        var url = urlEl ? (urlEl.getAttribute('data-url') || urlEl.textContent) : '';
        if (!url || url === '—') return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            copyBtn.textContent = 'Copiado';
            setTimeout(function () { copyBtn.textContent = 'Copiar enlace'; }, 1500);
          });
        }
      });
    }
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        loadInscripcionesTable();
      });
    }
  }

  function readCriteriaFromEditor() {
    var rows = document.querySelectorAll('.jurado-criterion-row');
    var list = [];
    rows.forEach(function (row) {
      var labelEl = row.querySelector('[data-crit-label]');
      var descEl = row.querySelector('[data-crit-desc]');
      if (labelEl && labelEl.value.trim()) {
        list.push({
          label: labelEl.value.trim(),
          desc: descEl ? descEl.value.trim() : ''
        });
      }
    });
    return normalizeCriteriaList(list);
  }

  function renderCriteriaEditor(criteria) {
    var box = $('criteriaEditorList');
    if (!box) return;
    var list = (criteria && criteria.length) ? criteria : getCriteria();
    box.innerHTML = list.map(function (c, i) {
      return '<div class="jurado-criterion-row" data-crit-idx="' + i + '">' +
        '<input type="text" data-crit-label placeholder="Nombre del criterio" value="' + escapeHtml(c.label) + '" maxlength="80">' +
        '<input type="text" data-crit-desc placeholder="Descripción breve" value="' + escapeHtml(c.desc || '') + '" maxlength="160">' +
        '<button type="button" class="jurado-btn-inline jurado-btn-inline--danger" data-remove-crit aria-label="Quitar">✕</button>' +
        '</div>';
    }).join('');
    bindCriteriaEditorPreview();
  }

  function bindCriteriaEditorPreview() {
    var box = $('criteriaEditorList');
    if (!box || box.dataset.previewBound) return;
    box.dataset.previewBound = '1';
    box.addEventListener('input', function () { updateConfigPreview(); });
  }

  function readPlatformConfigForm() {
    function val(id) {
      var el = $(id);
      return el ? el.value : '';
    }
    var scoring = {
      disciplina: val('cfgDisciplina') || 'filtrado',
      modo: val('cfgScoringModo') === 'puntaje_general' ? 'puntaje_general' : 'duelos',
      scaleMin: val('cfgScaleMin'),
      scaleMax: val('cfgScaleMax'),
      jueces: val('cfgJueces'),
      avancePorRonda: val('cfgAvanceRonda'),
      autoAvance: $('cfgAutoAvance') ? $('cfgAutoAvance').checked : true,
      competidoresEsperados: val('cfgCompetidoresEsperados'),
      mostrarFotos: $('cfgMostrarFotos') ? $('cfgMostrarFotos').checked : true,
      criteria: readCriteriaFromEditor()
    };
    return normalizePlatformConfig({
      eventName: val('cfgEventName'),
      eventSubtitle: val('cfgEventSubtitle'),
      organizerName: val('cfgOrganizerName'),
      logoUrl: val('cfgLogoUrl'),
      accentColor: val('cfgAccentColor'),
      primaryColor: val('cfgPrimaryColor'),
      pinOrganizador: val('cfgPinOrganizador'),
      pinJuez: val('cfgPinJuez'),
      panelImageDataUrl: pendingPanelImageDataUrl != null
        ? pendingPanelImageDataUrl
        : ((platformConfig && platformConfig.panelImageDataUrl) || ''),
      registration: {
        title: val('cfgRegTitle'),
        fee: val('cfgRegFee'),
        cupo: val('cfgRegCupo'),
        fecha: val('cfgRegFecha'),
        hora: val('cfgRegHora'),
        lugar: val('cfgRegLugar'),
        contactEmail: val('cfgRegEmail'),
        whatsapp: val('cfgRegWhatsapp'),
        reglamentoUrl: val('cfgRegReglamento')
      },
      formFields: readFormFieldsFromEditor(),
      scoring: scoring
    });
  }

  function fillPlatformConfigForm(cfg) {
    cfg = cfg || platformConfig || defaultPlatformConfig();
    var reg = cfg.registration || {};
    var sc = cfg.scoring || defaultPlatformConfig().scoring;
    var fields = {
      cfgEventName: cfg.eventName || '',
      cfgEventSubtitle: cfg.eventSubtitle || '',
      cfgOrganizerName: cfg.organizerName || '',
      cfgLogoUrl: cfg.logoUrl || '',
      cfgAccentColor: cfg.accentColor || '#c9a227',
      cfgPrimaryColor: cfg.primaryColor || '#3d281c',
      cfgPinOrganizador: cfg.pinOrganizador || '',
      cfgPinJuez: cfg.pinJuez || '',
      cfgScoringModo: sc.modo || 'duelos',
      cfgDisciplina: sc.disciplina || 'filtrado',
      cfgCompetidoresEsperados: sc.competidoresEsperados || 16,
      cfgScaleMin: sc.scaleMin != null ? sc.scaleMin : 1,
      cfgScaleMax: sc.scaleMax != null ? sc.scaleMax : 5,
      cfgJueces: sc.jueces || 3,
      cfgAvanceRonda: sc.avancePorRonda || 0,
      cfgRegTitle: reg.title || '',
      cfgRegFee: reg.fee || '',
      cfgRegCupo: reg.cupo || '',
      cfgRegFecha: reg.fecha || '',
      cfgRegHora: reg.hora || '',
      cfgRegLugar: reg.lugar || '',
      cfgRegEmail: reg.contactEmail || '',
      cfgRegWhatsapp: reg.whatsapp || '',
      cfgRegReglamento: reg.reglamentoUrl || ''
    };
    Object.keys(fields).forEach(function (id) {
      var el = $(id);
      if (el) el.value = fields[id];
    });
    var autoEl = $('cfgAutoAvance');
    if (autoEl) autoEl.checked = sc.autoAvance !== false;
    var fotosEl = $('cfgMostrarFotos');
    if (fotosEl) fotosEl.checked = sc.mostrarFotos !== false;
    pendingPanelImageDataUrl = cfg.panelImageDataUrl || '';
    renderPanelImagePreview(cfg.panelImageDataUrl || '');
    renderCriteriaEditor(sc.criteria);
    renderFormFieldsEditor(cfg.formFields);
    renderTournamentRecommendations(sc.disciplina || 'filtrado');
    renderScoringModoHint();
    updateConfigPreview(cfg);
  }

  function renderInscripcionPreviewMock(cfg) {
    cfg = cfg || readPlatformConfigForm();
    var reg = cfg.registration || {};
    var title = $('previewRegTitle');
    if (title) title.textContent = reg.title || cfg.eventName || 'Inscripción competencia';
    var meta = $('previewRegMeta');
    if (meta) {
      var parts = [];
      if (reg.fecha) parts.push(reg.fecha);
      if (reg.hora) parts.push(reg.hora);
      if (reg.lugar) parts.push(reg.lugar);
      if (reg.cupo) parts.push('Cupo ' + reg.cupo);
      meta.textContent = parts.length ? parts.join(' · ') : 'Fecha · Lugar · Cupo';
    }
    var fee = $('previewRegFee');
    if (fee) fee.textContent = reg.fee || 'Tarifa del evento';
    var reglamento = $('previewRegReglamento');
    if (reglamento) {
      if (reg.reglamentoUrl) {
        reglamento.innerHTML = 'Al enviar aceptas el <a href="' + escapeHtml(reg.reglamentoUrl) +
          '" target="_blank" rel="noopener noreferrer">reglamento del torneo</a>.';
        reglamento.hidden = false;
      } else {
        reglamento.textContent = 'Sin URL de reglamento configurada.';
        reglamento.hidden = false;
      }
    }
    var fieldsBox = $('previewRegFields');
    if (fieldsBox) {
      var fields = (cfg.formFields && cfg.formFields.length)
        ? cfg.formFields.filter(function (f) { return f.enabled !== false; })
        : readFormFieldsFromEditor().filter(function (f) { return f.enabled; });
      fieldsBox.innerHTML = fields.map(function (f) {
        var area = f.type === 'textarea' ? ' jurado-inscripcion-mock__field--area' : '';
        var req = f.required ? ' *' : '';
        return '<div class="jurado-inscripcion-mock__field' + area + '">' +
          '<label>' + escapeHtml(f.label || f.key) + req + '</label><span></span></div>';
      }).join('') || '<p class="jurado-hint">Sin campos activos</p>';
    }
    var mock = $('inscripcionPreviewMock');
    if (mock) mock.hidden = false;
    var previewCard = $('configPreview');
    if (previewCard && cfg.accentColor) {
      previewCard.style.setProperty('--preview-accent', cfg.accentColor);
    }
  }

  function updateConfigPreview(cfg) {
    cfg = cfg || readPlatformConfigForm();
    var img = $('configPreviewLogo');
    if (img) img.src = cfg.logoUrl || '/assets/logo-la-sucursal-del-cafe.png';
    var name = $('configPreviewName');
    if (name) name.textContent = cfg.eventName || 'Mi torneo';
    var sc = cfg.scoring || {};
    var modo = sc.modo === 'puntaje_general' ? 'Puntaje general' : 'Duelos 1v1';
    var scaleMin = sc.scaleMin != null ? sc.scaleMin : 1;
    var scaleMax = sc.scaleMax != null ? sc.scaleMax : 5;
    var critN = (sc.criteria && sc.criteria.length) || getCriteria().length;
    var juecesN = sc.jueces || getJudgeCount();
    var summary = modo + ' · Escala ' + scaleMin + '–' + scaleMax + ' · ' + critN +
      ' criterio' + (critN === 1 ? '' : 's') + ' · ' + juecesN + ' jueces';
    var sub = $('configPreviewSub');
    if (sub) sub.textContent = cfg.eventSubtitle || summary;
    var scoringLine = $('configPreviewScoring');
    if (scoringLine) scoringLine.textContent = summary;
    var disciplineLine = $('configPreviewDiscipline');
    if (disciplineLine) {
      disciplineLine.textContent = disciplinaLabel(sc.disciplina || 'filtrado') +
        ' · ' + (sc.competidoresEsperados || 16) + ' competidores objetivo';
    }
    renderInscripcionPreviewMock(cfg);
  }

  function bindCriteriaEditorActions() {
    var addBtn = $('addCriterionBtn');
    if (addBtn && !addBtn.dataset.bound) {
      addBtn.dataset.bound = '1';
      addBtn.addEventListener('click', function () {
        var list = readCriteriaFromEditor();
        list.push({ key: '', label: '', desc: '' });
        renderCriteriaEditor(list);
      });
    }
    var listBox = $('criteriaEditorList');
    if (listBox && !listBox.dataset.bound) {
      listBox.dataset.bound = '1';
      listBox.addEventListener('click', function (e) {
        var rm = e.target.closest('[data-remove-crit]');
        if (!rm) return;
        var row = rm.closest('.jurado-criterion-row');
        if (!row) return;
        var list = readCriteriaFromEditor();
        var idx = parseInt(row.getAttribute('data-crit-idx'), 10);
        if (!isNaN(idx)) list.splice(idx, 1);
        else row.remove();
        if (!list.length) list = [{ label: '', desc: '' }];
        renderCriteriaEditor(list);
      });
    }
  }

  function renderPlatformConfigForm() {
    fillPlatformConfigForm(platformConfig);
    bindCriteriaEditorActions();
    bindInscripcionesPanel();
  }

  function bindPlatformConfigForm() {
    if (platformConfigBound) return;
    var saveBtn = $('platformConfigSaveBtn');
    var exportJson = $('exportJsonBtn');
    var exportHtml = $('exportHtmlBtn');
    if (!saveBtn || !exportJson || !exportHtml) return;
    platformConfigBound = true;

    var inputs = document.querySelectorAll('#platformConfigForm input, #platformConfigForm select');
    inputs.forEach(function (inp) {
      inp.addEventListener('input', function () { updateConfigPreview(); });
      inp.addEventListener('change', function () { updateConfigPreview(); });
    });

    var disciplinaSel = $('cfgDisciplina');
    if (disciplinaSel && !disciplinaSel.dataset.bound) {
      disciplinaSel.dataset.bound = '1';
      disciplinaSel.addEventListener('change', function () {
        applyDisciplinePresetToForm(disciplinaSel.value);
      });
    }
    var modoSel = $('cfgScoringModo');
    if (modoSel && !modoSel.dataset.bound) {
      modoSel.dataset.bound = '1';
      modoSel.addEventListener('change', function () {
        renderScoringModoHint();
        updateConfigPreview();
      });
    }
    var panelFile = $('cfgPanelImageFile');
    if (panelFile && !panelFile.dataset.bound) {
      panelFile.dataset.bound = '1';
      panelFile.addEventListener('change', function () {
        var file = panelFile.files && panelFile.files[0];
        if (!file) return;
        $('platformConfigError').hidden = true;
        compressPanelImageFile(file).then(function (dataUrl) {
          pendingPanelImageDataUrl = dataUrl;
          renderPanelImagePreview(dataUrl);
          updateConfigPreview();
        }).catch(function (err) {
          var errEl = $('platformConfigError');
          if (errEl) {
            errEl.textContent = err.message || 'No se pudo cargar la imagen.';
            errEl.hidden = false;
          }
          panelFile.value = '';
        });
      });
    }
    var panelClear = $('cfgPanelImageClearBtn');
    if (panelClear && !panelClear.dataset.bound) {
      panelClear.dataset.bound = '1';
      panelClear.addEventListener('click', function () {
        pendingPanelImageDataUrl = '';
        var panelFileInput = $('cfgPanelImageFile');
        if (panelFileInput) panelFileInput.value = '';
        renderPanelImagePreview('');
        updateConfigPreview();
      });
    }

    var compInput = $('cfgCompetidoresEsperados');
    if (compInput && !compInput.dataset.bound) {
      compInput.dataset.bound = '1';
      compInput.addEventListener('change', function () {
        var cupoEl = $('cfgRegCupo');
        if (cupoEl && compInput.value) cupoEl.value = compInput.value;
        updateConfigPreview();
      });
    }

    $('platformConfigSaveBtn').addEventListener('click', function () {
      var cfg = readPlatformConfigForm();
      $('platformConfigError').hidden = true;
      $('platformConfigSuccess').hidden = true;
      $('platformConfigSaveBtn').disabled = true;
      $('platformConfigSaveBtn').textContent = 'Guardando…';
      savePlatformConfig(cfg).then(function () {
        configSavedOnce = true;
        $('platformConfigSuccess').textContent = '✓ Configuración guardada. Modo: ' + scoringModeLabel() +
          ' · ' + getJudgeCount() + ' juez(es). Revisa la pestaña «Enlaces del evento».';
        $('platformConfigSuccess').hidden = false;
        renderOrganizerLinksPanel();
        renderEventLinksPanel();
        renderInscripcionesPanel();
        if (window.SiteLinks && window.SiteLinks.syncJuradoV60Links) {
          window.SiteLinks.syncJuradoV60Links();
        }
        if (PAGE_MODE === 'config') switchDashTab('enlaces');
        if (activeDashTab === 'inscripciones') loadInscripcionesTable();
        applyPlatformBranding();
        updateScoringHints();
        if (mode === 'judge') {
          var judgeSel = $('judgeCompetidorSelect');
          var judgeId = judgeSel && judgeSel.value ? judgeSel.value : '';
          renderJudgeForm(judgeId ? (calificacionesMap[judgeId] || null) : null);
        }
      }).catch(function (err) {
        $('platformConfigError').textContent = err.message || 'No se pudo guardar.';
        $('platformConfigError').hidden = false;
      }).finally(function () {
        $('platformConfigSaveBtn').disabled = false;
        $('platformConfigSaveBtn').textContent = 'Guardar y generar enlaces';
      });
    });

    var gotoEnlaces = $('gotoEnlacesBtn');
    if (gotoEnlaces && !gotoEnlaces.dataset.bound) {
      gotoEnlaces.dataset.bound = '1';
      gotoEnlaces.addEventListener('click', function () {
        switchDashTab('enlaces');
      });
    }

    $('exportJsonBtn').addEventListener('click', downloadPlatformJson);
    $('exportHtmlBtn').addEventListener('click', downloadRegistrationHtml);

    var exportPreliminar1 = $('exportPreliminar1Btn');
    if (exportPreliminar1 && !exportPreliminar1.dataset.bound) {
      exportPreliminar1.dataset.bound = '1';
      exportPreliminar1.addEventListener('click', downloadPreliminar1Kit);
    }
    var importPreliminar1 = $('importPreliminar1Btn');
    if (importPreliminar1 && !importPreliminar1.dataset.bound) {
      importPreliminar1.dataset.bound = '1';
      importPreliminar1.addEventListener('click', function () {
        var kit = getPreliminar1Kit();
        var count = kit && kit.ranking ? kit.ranking.length : 0;
        if (!count) {
          var errBox = $('exportMsg');
          if (errBox) { errBox.textContent = 'Kit Preliminar 1 no disponible.'; errBox.hidden = false; }
          return;
        }
        if (!window.confirm('¿Cargar ' + count + ' calificaciones de Preliminar 1 en la consola? Se fusionarán con las existentes.')) return;
        importPreliminar1.disabled = true;
        importPreliminar1.textContent = 'Cargando…';
        importPreliminar1Results().then(function (result) {
          var msg = $('exportMsg');
          var txt = '✓ Preliminar 1 cargada: ' + result.imported + ' competidor(es). Revisa la pestaña «Vista general».';
          if (result.unmatched && result.unmatched.length) {
            txt += ' Sin coincidencia en inscripciones: ' + result.unmatched.join(', ') + '.';
          }
          if (msg) { msg.textContent = txt; msg.hidden = false; }
          renderOrganizerViews(calificacionesList());
          if (activeDashTab === 'export') renderPreliminar1ExportPreview();
        }).catch(function (err) {
          var msgErr = $('exportMsg');
          if (msgErr) {
            msgErr.textContent = err.message || 'No se pudo importar Preliminar 1.';
            msgErr.hidden = false;
          }
        }).finally(function () {
          importPreliminar1.disabled = false;
          importPreliminar1.textContent = 'Cargar calificaciones Preliminar 1';
        });
      });
    }
  }

  function slugifyFilename(str) {
    return String(str || 'evento').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'evento';
  }

  function downloadBlob(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'application/octet-stream' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadPlatformJson() {
    var cfg = platformConfig || defaultPlatformConfig();
    var kit = {
      platform: 'jurado-v60',
      version: 1,
      exportedAt: new Date().toISOString(),
      config: cfg,
      criteria: getCriteria(),
      scoring: platformConfig ? platformConfig.scoring : defaultPlatformConfig().scoring,
      links: getJuradoShareUrls()
    };
    var name = slugifyFilename(cfg.eventName) + '-kit.json';
    downloadBlob(name, JSON.stringify(kit, null, 2), 'application/json');
    var msg = $('exportMsg');
    if (msg) { msg.textContent = '✓ Descargado: ' + name; msg.hidden = false; }
  }

  function buildRegistrationHtml(cfg) {
    cfg = cfg || platformConfig || defaultPlatformConfig();
    var reg = cfg.registration || {};
    var accent = cfg.accentColor || '#c9a227';
    var primary = cfg.primaryColor || '#3d281c';
    return '<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' +
      escapeHtml(reg.title || cfg.eventName) + '</title>\n' +
      '<style>\n:root{--accent:' + accent + ';--primary:' + primary + '}\n' +
      'body{margin:0;font-family:Inter,system-ui,sans-serif;background:linear-gradient(165deg,' + primary + ',#1a1008);color:#f8f4ef;min-height:100dvh}\n' +
      '.wrap{max-width:640px;margin:0 auto;padding:24px 16px 48px}\n' +
      '.hero{text-align:center;margin-bottom:24px}\n.hero img{max-height:64px;margin-bottom:12px}\n.hero h1{margin:0 0 8px;font-size:1.5rem}\n' +
      '.card{background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:20px;margin-bottom:16px}\n' +
      '.field{margin-bottom:14px}label{display:block;font-size:.85rem;font-weight:600;margin-bottom:6px}\n' +
      'input,textarea,select{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;border:1px solid rgba(0,0,0,.15);font:inherit}\n' +
      '.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:520px){.row{grid-template-columns:1fr}}\n' +
      '.btn{width:100%;padding:14px;border:none;border-radius:12px;background:linear-gradient(135deg,var(--accent),#e8c547);color:#1a1008;font:inherit;font-weight:700;cursor:pointer}\n' +
      '.meta{font-size:.85rem;opacity:.8;margin:0 0 12px}.badge{display:inline-block;padding:4px 10px;border-radius:20px;background:rgba(255,255,255,.1);font-size:.8rem;margin:4px 4px 0 0}\n' +
      '</style>\n</head>\n<body>\n<div class="wrap">\n<div class="hero">\n' +
      (cfg.logoUrl ? '<img src="' + escapeHtml(cfg.logoUrl) + '" alt="' + escapeHtml(cfg.organizerName) + '">\n' : '') +
      '<p class="meta">' + escapeHtml(cfg.organizerName) + '</p>\n<h1>' + escapeHtml(reg.title || cfg.eventName) + '</h1>\n' +
      '<p class="meta">' + escapeHtml(cfg.eventSubtitle) + '</p>\n' +
      '<span class="badge">📅 ' + escapeHtml(reg.fecha) + '</span>\n' +
      '<span class="badge">🕠 ' + escapeHtml(reg.hora) + '</span>\n' +
      '<span class="badge">📍 ' + escapeHtml(reg.lugar) + '</span>\n' +
      '<span class="badge">' + escapeHtml(reg.fee) + '</span>\n' +
      '<span class="badge">Cupo: ' + escapeHtml(String(reg.cupo)) + '</span>\n</div>\n' +
      '<form class="card" id="inscripcionForm" onsubmit="return false">\n<h2 style="margin:0 0 16px;font-size:1.1rem">Datos del competidor</h2>\n' +
      '<div class="field"><label>Nombre completo *</label><input name="nombre" required minlength="2" placeholder="Nombre y apellido"></div>\n' +
      '<div class="row"><div class="field"><label>Documento *</label><input name="documento" required></div>\n' +
      '<div class="field"><label>Celular *</label><input name="celular" type="tel" required></div></div>\n' +
      '<div class="field"><label>Correo *</label><input name="correo" type="email" required></div>\n' +
      '<div class="row"><div class="field"><label>Ciudad</label><input name="ciudad"></div>\n' +
      '<div class="field"><label>Representa (marca/finca)</label><input name="representa"></div></div>\n' +
      '<div class="field"><label>Notas / alergias</label><textarea name="notas" rows="2"></textarea></div>\n' +
      '<p class="meta">Al enviar aceptas el reglamento del torneo.' +
      (reg.reglamentoUrl ? ' <a href="' + escapeHtml(reg.reglamentoUrl) + '" style="color:var(--accent)">Ver reglamento</a>.' : '') + '</p>\n' +
      '<button type="submit" class="btn">Enviar inscripción</button>\n</form>\n' +
      '<p class="meta" style="text-align:center;margin-top:20px">Contacto: ' + escapeHtml(reg.contactEmail || '') +
      (reg.whatsapp ? ' · WhatsApp ' + escapeHtml(reg.whatsapp) : '') + '</p>\n' +
      '<p class="meta" style="text-align:center;font-size:.75rem">Plantilla generada por Jurado V60 · ' + new Date().toISOString().slice(0, 10) + '</p>\n</div>\n</body>\n</html>';
  }

  function downloadRegistrationHtml() {
    var cfg = platformConfig || defaultPlatformConfig();
    var html = buildRegistrationHtml(cfg);
    var name = slugifyFilename(cfg.eventName) + '-inscripcion.html';
    downloadBlob(name, html, 'text/html;charset=utf-8');
    var msg = $('exportMsg');
    if (msg) { msg.textContent = '✓ Descargado: ' + name; msg.hidden = false; }
  }

  function renderExportPreview() {
    var box = $('exportPreview');
    if (!box) return;
    var cfg = platformConfig || defaultPlatformConfig();
    var reg = cfg.registration || {};
    box.innerHTML =
      '<div class="jurado-export-card">' +
      '<strong>' + escapeHtml(cfg.eventName) + '</strong>' +
      '<p>' + escapeHtml(cfg.organizerName) + ' · ' + escapeHtml(reg.fecha) + ' · ' + escapeHtml(reg.lugar) + '</p>' +
      '<p class="jurado-meta">' + escapeHtml(scoringSummaryLine()) + '</p>' +
      '<p class="jurado-hint">El JSON incluye criterios, escala y enlaces. El HTML es plantilla de inscripción con tu marca.</p>' +
      '</div>';
    renderPreliminar1ExportPreview();
  }

  function slugifyCompetidorName(name) {
    return String(name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function findCompetidorIdForPreliminar(nombreOrId) {
    if (window.Preliminar1Results && window.Preliminar1Results.resolveInscritoId) {
      var fromKit = window.Preliminar1Results.resolveInscritoId(nombreOrId);
      if (fromKit) return fromKit;
    }
    var slug = slugifyCompetidorName(nombreOrId);
    for (var i = 0; i < competidores.length; i++) {
      var c = competidores[i];
      if (c.id === nombreOrId || slugifyCompetidorName(c.nombre) === slug) return c.id;
      if (String(c.id || '').toLowerCase() === slug) return c.id;
    }
    return slug;
  }

  function getPreliminar1Kit() {
    if (!window.Preliminar1Results || !window.Preliminar1Results.exportKit) return null;
    return window.Preliminar1Results.exportKit();
  }

  function renderPreliminar1ExportPreview() {
    var box = $('preliminar1Preview');
    if (!box) return;
    var kit = getPreliminar1Kit();
    if (!kit) {
      box.innerHTML = '';
      return;
    }
    var P = window.Preliminar1Results;
    var ranking = kit.ranking || [];
    var rawCount = (kit.rawRows || []).length;
    var inscritosCount = (kit.inscritos || []).length;
    var methodNote = (P && P.scoringMethodNote) ? P.scoringMethodNote() : (kit.scoringMethodNote || '');
    var rows = ranking.map(function (row, idx) {
      var label = row.nombreInscrito || row.participante;
      var sub = row.participante !== label
        ? '<span class="jurado-preliminar-planilla">' + escapeHtml(row.participante) + '</span>'
        : '';
      var detailId = 'preliminarDetail' + idx;
      var breakdown = (P && P.renderBreakdownTableHtml)
        ? P.renderBreakdownTableHtml(row, { compact: true })
        : '';
      return '<tr class="jurado-preliminar-row">' +
        '<td class="jurado-preliminar-rank">' + row.posicion + '</td>' +
        '<td><code class="jurado-preliminar-id">' + escapeHtml(row.competidorId) + '</code></td>' +
        '<td><strong>' + escapeHtml(label) + '</strong>' + sub + '</td>' +
        '<td class="jurado-preliminar-num">' + (P && P.entradaLabel ? P.entradaLabel(row.entrada) : ('T' + row.entrada)) + '</td>' +
        '<td class="jurado-preliminar-num">' + row.j1 + '</td>' +
        '<td class="jurado-preliminar-num">' + row.j2 + '</td>' +
        '<td class="jurado-preliminar-num">' + row.j3 + '</td>' +
        '<td class="jurado-preliminar-total"><strong>' + row.total + '</strong></td>' +
        '<td class="jurado-preliminar-expand">' +
        '<button type="button" class="jurado-btn-inline" data-preliminar-toggle="' + detailId + '" aria-expanded="false">Ver parámetros</button>' +
        '</td></tr>' +
        '<tr id="' + detailId + '" class="jurado-preliminar-detail-row" hidden><td colspan="9">' + breakdown + '</td></tr>';
    }).join('');

    var phaseBlocks = '';
    if (P && P.getRowsByEntrada) {
      [1, 2, 3].forEach(function (entrada) {
        var phaseRows = P.getRowsByEntrada(entrada);
        if (!phaseRows.length) return;
        var phaseHtml = phaseRows.map(function (row) {
          return '<details class="jurado-preliminar-phase-item">' +
            '<summary><strong>' + escapeHtml(row.participante) + '</strong> · ' + row.j1 + '+' + row.j2 + '+' + row.j3 + ' = ' + row.total + '</summary>' +
            P.renderBreakdownTableHtml(row) +
            '</details>';
        }).join('');
        phaseBlocks +=
          '<div class="jurado-preliminar-phase">' +
          '<h4>' + escapeHtml(P.entradaLabel(entrada)) + ' (' + phaseRows.length + ')</h4>' +
          phaseHtml + '</div>';
      });
    }

    box.innerHTML =
      '<div class="jurado-preliminar-card">' +
      '<div class="jurado-preliminar-head">' +
      '<h3>Preliminar 1 — cruzado con inscritos</h3>' +
      '<p class="jurado-hint">' + escapeHtml(kit.event.nombre) + ' · ' + inscritosCount + ' inscritos · ' +
      rawCount + ' tandas · ' + ranking.length + ' en ranking (mejor tanda) · IDs <code>SC-*</code></p>' +
      '<p class="jurado-hint jurado-preliminar-method">' + escapeHtml(methodNote) + '</p>' +
      '</div>' +
      '<div class="jurado-preliminar-table-wrap">' +
      '<table class="jurado-preliminar-table">' +
      '<thead><tr>' +
      '<th>#</th><th>ID</th><th>Competidor</th><th>Fase</th><th>J1</th><th>J2</th><th>J3</th><th>Total</th><th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>' +
      '</div>' +
      (phaseBlocks ? '<div class="jurado-preliminar-phases"><h4>Desglose por fase y parámetro</h4>' + phaseBlocks + '</div>' : '') +
      '<p class="jurado-hint jurado-preliminar-foot">Importar carga la mejor tanda por competidor. Descarga el JSON para el desglose completo en Markdown.</p>' +
      '</div>';

    box.querySelectorAll('[data-preliminar-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-preliminar-toggle');
        var row = document.getElementById(id);
        if (!row) return;
        var open = row.hidden;
        row.hidden = !open;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.textContent = open ? 'Ocultar' : 'Ver parámetros';
      });
    });
  }

  function downloadPreliminar1Kit() {
    var kit = getPreliminar1Kit();
    if (!kit) {
      var msgErr = $('exportMsg');
      if (msgErr) {
        msgErr.textContent = 'No se encontró el módulo Preliminar 1.';
        msgErr.hidden = false;
      }
      return;
    }
    var name = 'v60-preliminar-1-calificaciones.json';
    downloadBlob(name, JSON.stringify(kit, null, 2), 'application/json');
    var msg = $('exportMsg');
    if (msg) {
      msg.textContent = '✓ Descargado: ' + name + ' (' + (kit.ranking || []).length + ' competidores, ' + (kit.rawRows || []).length + ' tandas)';
      msg.hidden = false;
    }
  }

  function importPreliminar1Results() {
    var kit = getPreliminar1Kit();
    if (!kit || !kit.calificaciones || !kit.calificaciones.scores) {
      return Promise.reject(new Error('No se encontró el kit de Preliminar 1.'));
    }
    var sourceScores = kit.calificaciones.scores;
    var mapped = [];
    var unmatched = [];
    Object.keys(sourceScores).forEach(function (srcId) {
      var row = sourceScores[srcId];
      var targetId = row.competidorId || findCompetidorIdForPreliminar(row.nombre);
      var matched = false;
      for (var i = 0; i < competidores.length; i++) {
        if (competidores[i].id === targetId) { matched = true; break; }
      }
      if (!matched && competidores.length) unmatched.push((row.nombre || targetId) + ' (' + targetId + ')');
      mapped.push({
        competidorId: targetId,
        nombre: row.nombre,
        judges: JSON.parse(JSON.stringify(row.judges || {})),
        notasPorJuez: row.notasPorJuez || {},
        meta: row.meta || {},
        actualizado: new Date().toISOString()
      });
    });

    return sheetsGet('pasaporte_config', { key: storageKey(CONFIG_KEY) }).then(function (res) {
      var data = res.data || {};
      if (!data.scores || typeof data.scores !== 'object') data.scores = {};
      mapped.forEach(function (row) {
        var normalized = normalizeCalificacion(row, row.competidorId);
        if (normalized) data.scores[row.competidorId] = normalized;
      });
      data.actualizado = new Date().toISOString();
      data.preliminar1Import = {
        at: new Date().toISOString(),
        evento: kit.event && kit.event.nombre ? kit.event.nombre : 'Preliminar 1',
        count: mapped.length
      };
      return sheetsPost({
        action: 'pasaporte_config_save',
        key: storageKey(CONFIG_KEY),
        data: data
      }).then(function () {
        calificacionesMap = {};
        Object.keys(data.scores).forEach(function (id) {
          var cal = normalizeCalificacion(data.scores[id], id);
          if (cal) calificacionesMap[id] = cal;
        });
        return { imported: mapped.length, unmatched: unmatched };
      });
    });
  }

  function getJuradoShareUrls() {
    var judgeCount = hasHubTournamentContext() ? getJudgeCount() : 0;
    if (window.SiteLinks && window.SiteLinks.buildJuradoUrls) {
      return window.SiteLinks.buildJuradoUrls({
        evt: tenantSlug || undefined,
        pinOrganizador: pinOrganizadorEffective(),
        pinJuez: pinJuezEffective(),
        jueces: judgeCount
      });
    }
    var pinOrg = pinOrganizadorEffective();
    var pinJ = pinJuezEffective();
    var urls = {
      hub: juradoPageUrl('hub'),
      config: juradoPageUrl('config', '?pin=' + encodeURIComponent(pinOrg)),
      organizador: juradoPageUrl('organizador', '?pin=' + encodeURIComponent(pinOrg)),
      resultados: juradoPageUrl('resultados'),
      historial: juradoPageUrl('historial'),
      inscripcion: tenantSlug ? competenciaTorneoUrl() : ((window.SiteLinks && SiteLinks.absUrl) ? SiteLinks.absUrl('competencia') : 'competencia.html'),
      competencia: tenantSlug ? competenciaTorneoUrl() : ((window.SiteLinks && SiteLinks.absUrl) ? SiteLinks.absUrl('competencia') : 'competencia.html')
    };
    for (var j = 1; j <= judgeCount; j++) {
      urls['juez' + j] = juradoPageUrl('juez', '?pin=' + encodeURIComponent(pinJ) + '&juez=' + j);
    }
    return urls;
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  function renderEventLinksPanel(targetId) {
    var list = $(targetId || 'enlacesPaneRoot') || $('organizerLinksList');
    if (!list) return;
    var roles = getEventLinkRoles().filter(function (r) { return r.key !== 'hub'; });
    list.innerHTML = roles.map(function (role) {
      var vis = getLinkVisual(role.key);
      var step = role.step > 0 ? '<span class="jurado-link-step">Paso ' + role.step + '</span>' : '';
      var iconHtml = '<div class="jurado-link-item__icon" aria-hidden="true">' + vis.icon + '</div>';
      var jMatch = String(role.key).match(/^juez(\d+)$/);
      if (jMatch) {
        var jp = getJudgeProfile(parseInt(jMatch[1], 10));
        if (jp && jp.fotoUrl) {
          var thumb = driveThumbUrl(jp.fotoUrl, 96);
          if (thumb) {
            iconHtml = '<div class="jurado-link-item__icon jurado-link-item__icon--photo">' +
              '<img src="' + escapeHtml(thumb) + '" alt="" width="40" height="40" loading="lazy" referrerpolicy="no-referrer"></div>';
          }
        }
      }
      var judgeName = '';
      if (jMatch) {
        var profile = getJudgeProfile(parseInt(jMatch[1], 10));
        if (profile && profile.nombre) {
          judgeName = ' · ' + escapeHtml(profile.nombre);
        }
      }
      return '<div class="jurado-link-item jurado-link-item--' + vis.tone + '">' +
        iconHtml +
        '<div class="jurado-link-meta">' + step +
        '<strong>' + escapeHtml(role.label) + judgeName + '</strong>' +
        '<span class="jurado-hub-tag jurado-hub-tag--inline">' + escapeHtml(role.tag) + '</span>' +
        '<span>' + escapeHtml(role.desc) + '</span>' +
        '</div>' +
        '<a class="jurado-link-url" href="' + escapeHtml(role.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(role.url) + '</a>' +
        '<div class="jurado-link-actions">' +
        '<button type="button" class="jurado-btn-inline" data-copy-link="' + escapeHtml(role.url) + '">Copiar</button>' +
        '<a class="jurado-btn-inline jurado-btn-inline--open" href="' + escapeHtml(role.url) + '" target="_blank" rel="noopener noreferrer">Abrir</a>' +
        '</div></div>';
    }).join('');
  }

  function renderOrganizerLinksPanel() {
    renderEventLinksPanel('organizerLinksList');
  }

  function renderOrganizerAdminPanel() {
    if (!bracketState) bracketState = defaultBracketState();

    var faseSel = $('bracketFaseSelect');
    var rondaSel = $('bracketRondaSelect');
    var phaseLabel = $('bracketPhaseLabel');
    if (faseSel) faseSel.value = bracketState.fase || 'semifinal';
    if (rondaSel) rondaSel.value = String(bracketState.rondaEnFase || 1);
    if (phaseLabel) phaseLabel.textContent = 'Fase actual: ' + currentPhaseTitle() +
      ' · ' + getActiveCompetitorIds().length + ' activo(s)';

    var pubStatus = $('resultadosPublishStatus');
    if (pubStatus) {
      var activosPub = getActiveCompetitorIds();
      var map = (bracketState && bracketState.resultadosCompetidor) ? bracketState.resultadosCompetidor : {};
      var pubCount = activosPub.filter(function (id) { return !!map[id]; }).length;
      if (pubCount > 0) {
        pubStatus.textContent = '✓ Resultados visibles para ' + pubCount + ' competidor(es) en ' + currentPhaseTitle() + '.';
        pubStatus.className = 'jurado-success';
        pubStatus.hidden = false;
      } else {
        pubStatus.textContent = 'Los competidores no pueden ver sus puntajes hasta que publiques esta ronda.';
        pubStatus.className = 'jurado-hint';
        pubStatus.hidden = false;
      }
    }

    var advanceBtn = $('advanceWinnersBtn');
    if (advanceBtn) {
      if (isPuntajeGeneralMode() && !isGruposPhase()) {
        advanceBtn.textContent = 'Clasificar por puntaje (top ' + getAdvanceCount(getActiveCompetitorIds().length) + ')';
      } else {
        advanceBtn.textContent = 'Avanzar ganadores + limpiar puntajes';
      }
    }

    var activosBox = $('bracketActivosList');
    var elimWrap = $('bracketEliminadosWrap');
    var elimBox = $('bracketEliminadosList');
    if (!activosBox) return;

    var activos = getActiveCompetitorIds();
    if (!activos.length) {
      activosBox.innerHTML = '<p class="jurado-hint">No hay participantes activos. Restaura alguno desde eliminados.</p>';
    } else {
      activosBox.innerHTML = activos.map(function (id) {
        var c = competidores.find(function (x) { return x.id === id; });
        return '<div class="jurado-activo-item">' +
          '<span>' + escapeHtml(c ? c.nombre : id) + '</span>' +
          '<button type="button" class="jurado-btn-inline jurado-btn-inline--danger" data-eliminar="' + escapeHtml(id) + '">Eliminar</button>' +
          '</div>';
      }).join('');
    }

    var eliminados = (bracketState.eliminados || []).filter(function (id) {
      return competidores.some(function (c) { return c.id === id; });
    });
    if (elimWrap && elimBox) {
      if (!eliminados.length) {
        elimWrap.hidden = true;
        elimBox.innerHTML = '';
      } else {
        elimWrap.hidden = false;
        elimBox.innerHTML = eliminados.map(function (id) {
          var c = competidores.find(function (x) { return x.id === id; });
          return '<div class="jurado-activo-item jurado-activo-item--out">' +
            '<span>' + escapeHtml(c ? c.nombre : id) + '</span>' +
            '<button type="button" class="jurado-btn-inline" data-restaurar="' + escapeHtml(id) + '">Restaurar</button>' +
            '</div>';
        }).join('');
      }
    }
  }

  function bindOrganizerAdminActions() {
    if (organizerAdminBound) return;
    organizerAdminBound = true;

    var applyBtn = $('bracketApplyBtn');
    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        if (!bracketState) bracketState = defaultBracketState();
        bracketState.fase = $('bracketFaseSelect').value;
        bracketState.rondaEnFase = parseInt($('bracketRondaSelect').value, 10) || 1;
        saveBracketStore(bracketState).then(function () {
          showAdminMsg('Fase aplicada: ' + currentPhaseTitle());
          refreshOrganizer();
        }).catch(function (err) {
          showAdminMsg(err.message || 'Error al guardar fase', true);
        });
      });
    }

    var resetActivos = $('resetActivosScoresBtn');
    if (resetActivos) {
      resetActivos.addEventListener('click', function () {
        if (!confirm('¿Reiniciar puntajes de todos los participantes ACTIVOS en esta ronda?')) return;
        var ids = getActiveCompetitorIds();
        resetScoresForIds(ids).then(function () {
          showAdminMsg('Puntajes reiniciados para ' + ids.length + ' participante(s) activo(s).');
          refreshOrganizer();
        }).catch(function (err) {
          showAdminMsg(err.message || 'Error al reiniciar', true);
        });
      });
    }

    var resetAll = $('resetAllScoresBtn');
    if (resetAll) {
      resetAll.addEventListener('click', function () {
        if (!confirm('¿Reiniciar TODOS los puntajes de TODOS los competidores? Esta acción no se puede deshacer.')) return;
        resetAllScoresStore().then(function () {
          showAdminMsg('Todos los puntajes fueron reiniciados.');
          refreshOrganizer();
        }).catch(function (err) {
          showAdminMsg(err.message || 'Error al reiniciar', true);
        });
      });
    }

    var publishBtn = $('publishResultadosBtn');
    if (publishBtn) {
      publishBtn.addEventListener('click', function () {
        var fase = currentPhaseTitle();
        if (!confirm('¿Publicar los resultados de «' + fase + '» para que los competidores los vean en el portal?\n\nSolo verán sus puntajes después de esta acción.')) return;
        publishBtn.disabled = true;
        publishResultsToCompetitors().then(function (count) {
          showAdminMsg('✓ Resultados publicados para ' + count + ' competidor(es). Ya pueden consultarlos.');
          refreshOrganizer();
        }).catch(function (err) {
          showAdminMsg(err.message || 'No se pudieron publicar los resultados.', true);
        }).finally(function () {
          publishBtn.disabled = false;
        });
      });
    }

    var advanceBtn = $('advanceWinnersBtn');
    if (advanceBtn) {
      advanceBtn.addEventListener('click', function () {
        if (isGruposPhase()) {
          showAdminMsg('En fase de grupos usa «Cerrar grupo actual» cuando todos estén calificados.', true);
          return;
        }
        if (isPuntajeGeneralMode()) {
          var advanceN = getAdvanceCount(getActiveCompetitorIds().length);
          if (!confirm('¿Clasificar por puntaje general y avanzar los ' + advanceN + ' mejores?')) return;
          advanceByGeneralScore().then(function () {
            showAdminMsg('Clasificados los ' + advanceN + ' mejores · ' + currentPhaseTitle());
            refreshOrganizer();
          }).catch(function (err) {
            showAdminMsg(err.message || 'Error al clasificar', true);
          });
          return;
        }
        var current = buildCurrentDuelRound();
        if (!current || current.matches.length < 1) {
          showAdminMsg('No hay duelos en esta ronda.', true);
          return;
        }
        var winners = [];
        var pending = false;
        current.matches.forEach(function (m) {
          var r = resolveMatch(m.aId, m.bId, 1, m.duelNum);
          if (r.winnerId) winners.push(r.winnerId);
          else if (m.bId) pending = true;
        });
        if (pending) {
          showAdminMsg('Aún hay duelos sin ganador (faltan puntajes, empate o declara ganador).', true);
          return;
        }
        if (!winners.length) {
          showAdminMsg('No hay ganadores para avanzar.', true);
          return;
        }
        if (!confirm('¿Avanzar ' + winners.length + ' ganador(es) a la siguiente ronda, limpiar puntajes y eliminar perdedores?')) return;
        advanceDuelWinners().then(function () {
          selectedRoundNum = 0;
          showAdminMsg('Avanzaron a ' + currentPhaseTitle() + ' (' + faseLabel(bracketState.fase) + '). Puntajes limpiados.');
          refreshOrganizer();
        }).catch(function (err) {
          showAdminMsg(err.message || 'Error al avanzar', true);
        });
      });
    }

    var closeGrupoBtn = $('closeGrupoBtn');
    if (closeGrupoBtn) {
      closeGrupoBtn.addEventListener('click', function () {
        var g = getCurrentGrupo();
        if (!g) {
          showAdminMsg('No hay grupo activo.', true);
          return;
        }
        if (!confirm('¿Cerrar grupo ' + g.nombre + ' y clasificar los ' + (g.avance || 2) + ' mejores por puntaje?')) return;
        closeCurrentGrupo().then(function () {
          if (isGruposPhase()) {
            showAdminMsg('Grupo cerrado. Activo: Grupo ' + (getCurrentGrupo() ? getCurrentGrupo().nombre : '?'));
          } else {
            showAdminMsg('Fase de grupos terminada. Inicia ' + faseLabel(bracketState.fase) + ' con ' + bracketState.activos.length + ' clasificados.');
          }
          showSorteoMsg('Grupo clasificado correctamente.');
          refreshOrganizer();
        }).catch(function (err) {
          showAdminMsg(err.message || 'Error al cerrar grupo', true);
        });
      });
    }

    var sorteoBtn = $('runSorteoBtn');
    if (sorteoBtn) {
      sorteoBtn.addEventListener('click', function () {
        var msg = '¿Sorteo automático de ' + competidores.length + ' inscrito(s)? Se reiniciarán puntajes y el cuadro.';
        if (bracketState && bracketState.sorteo) msg = '¿Rehacer el sorteo? Se perderán puntajes y posiciones actuales.';
        if (!confirm(msg)) return;
        sorteoBtn.disabled = true;
        sorteoBtn.textContent = 'Sorteando…';
        runSorteoAutomatico(!!(bracketState && bracketState.sorteo)).then(function () {
          showSorteoMsg('✓ Sorteo listo · ' + faseLabel(bracketState.fase) + ' · ' + getActiveCompetitorIds().length + ' activo(s)');
          showAdminMsg('Sorteo aplicado: ' + currentPhaseTitle());
          refreshOrganizer();
        }).catch(function (err) {
          showSorteoMsg(err.message || 'Error en sorteo', true);
        }).finally(function () {
          sorteoBtn.disabled = false;
          sorteoBtn.textContent = '🎲 Sorteo automático';
        });
      });
    }

    var reshuffleBtn = $('reshuffleSorteoBtn');
    if (reshuffleBtn) {
      reshuffleBtn.addEventListener('click', function () {
        if (!confirm('¿Re-sortear posiciones? Se reinician puntajes.')) return;
        runSorteoAutomatico(true).then(function () {
          showSorteoMsg('✓ Nuevo orden de sorteo aplicado.');
          refreshOrganizer();
        }).catch(function (err) {
          showSorteoMsg(err.message || 'Error', true);
        });
      });
    }

    document.addEventListener('click', function (e) {
      if (mode !== 'organizer') return;
      var elim = e.target.closest('[data-eliminar]');
      if (elim) {
        var id = elim.getAttribute('data-eliminar');
        if (!confirm('¿Eliminar a este participante de la ronda actual?')) return;
        eliminateParticipant(id).then(function () {
          showAdminMsg('Participante eliminado de la ronda.');
          refreshOrganizer();
        }).catch(function (err) {
          showAdminMsg(err.message || 'Error', true);
        });
      }
      var rest = e.target.closest('[data-restaurar]');
      if (rest) {
        var rid = rest.getAttribute('data-restaurar');
        restoreParticipant(rid).then(function () {
          showAdminMsg('Participante restaurado.');
          refreshOrganizer();
        }).catch(function (err) {
          showAdminMsg(err.message || 'Error', true);
        });
      }
      var resetOne = e.target.closest('[data-reset-one]');
      if (resetOne) {
        var sid = resetOne.getAttribute('data-reset-one');
        if (!confirm('¿Reiniciar puntajes de este competidor?')) return;
        resetScoresForIds([sid]).then(function () {
          showAdminMsg('Puntajes reiniciados.');
          manualEditDirty = false;
          refreshOrganizer();
        }).catch(function (err) {
          showAdminMsg(err.message || 'Error', true);
        });
      }
      var forceWin = e.target.closest('[data-forzar-gana]');
      if (forceWin) {
        var winnerId = forceWin.getAttribute('data-forzar-gana');
        var roundNum = parseInt(forceWin.getAttribute('data-round'), 10);
        var duelNum = parseInt(forceWin.getAttribute('data-duel'), 10);
        if (!confirm('¿Declarar a este competidor como ganador del duelo?')) return;
        forceDuelWinner(roundNum, duelNum, winnerId).then(function () {
          showAdminMsg('Ganador declarado manualmente.');
          refreshOrganizer();
        }).catch(function (err) {
          showAdminMsg(err.message || 'Error', true);
        });
      }
      var editBtn = e.target.closest('[data-edit-scores]');
      if (editBtn) {
        var editId = editBtn.getAttribute('data-edit-scores');
        var sel = $('organizerCompetidorSelect');
        if (sel) sel.value = editId;
        manualEditDirty = false;
        renderOrganizerManualEdit(editId);
        var card = $('organizerManualCard');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      var copyBtn = e.target.closest('[data-copy-link]');
      if (copyBtn) {
        var linkUrl = copyBtn.getAttribute('data-copy-link');
        copyTextToClipboard(linkUrl).then(function () {
          var ok = $('organizerLinksCopied');
          if (ok) {
            ok.textContent = '✓ Enlace copiado al portapapeles';
            ok.hidden = false;
          }
        }).catch(function () {
          showAdminMsg('No se pudo copiar el enlace', true);
        });
      }
    });
  }

  function matchOverrideKey(roundNum, duelNum) {
    return 'r' + roundNum + '-d' + duelNum;
  }

  function forceDuelWinner(roundNum, duelNum, winnerId) {
    if (!bracketState) bracketState = defaultBracketState();
    if (!bracketState.overrides) bracketState.overrides = {};
    bracketState.overrides[matchOverrideKey(roundNum, duelNum)] = winnerId;
    return saveBracketStore(bracketState);
  }

  function getForcedWinner(roundNum, duelNum) {
    if (!bracketState || !bracketState.overrides) return null;
    return bracketState.overrides[matchOverrideKey(roundNum, duelNum)] || null;
  }

  function getRowById(id) {
    var cal = calificacionesMap[id] || null;
    var found = competidores.find(function (c) { return c.id === id; });
    return {
      competidorId: id,
      nombre: found ? found.nombre : (cal ? cal.nombre : id),
      judges: cal && cal.judges ? cal.judges : {},
      sumaTotal: cal ? cal.sumaTotal : null
    };
  }

  function allJudgesDone(row) {
    if (!row || !row.judges) return false;
    var need = getJudgeCount();
    for (var j = 1; j <= need; j++) {
      if (!judgeDone(row.judges, j)) return false;
    }
    return true;
  }

  function puntajeTotal(row) {
    if (!row) return null;
    if (row.sumaTotal != null && allJudgesDone(row)) {
      return row.sumaTotal;
    }
    return null;
  }

  function puntajeEstado(row) {
    var n = countJudgesDone(row);
    var need = getJudgeCount();
    if (n === need) return 'listo';
    if (n > 0) return 'parcial';
    return 'pendiente';
  }

  function getParticipantsForRound(roundNum) {
    if (roundNum === 1) return getActiveCompetitorIds();
    return getRoundWinners(roundNum - 1);
  }

  /** Solo la ronda en curso (activos actuales en duelos de 2). */
  function buildCurrentDuelRound() {
    var participants = getActiveCompetitorIds();
    if (participants.length < 1) return null;
    var matches = [];
    for (var i = 0; i < participants.length; i += 2) {
      matches.push({
        duelNum: Math.floor(i / 2) + 1,
        aId: participants[i],
        bId: participants[i + 1] || null
      });
    }
    return {
      roundNum: 1,
      phaseTitle: currentPhaseTitle(),
      matches: matches
    };
  }

  function getCurrentDuelWinners() {
    var current = buildCurrentDuelRound();
    if (!current) return [];
    var winners = [];
    current.matches.forEach(function (m) {
      var r = resolveMatch(m.aId, m.bId, 1, m.duelNum);
      if (r.winnerId) winners.push(r.winnerId);
    });
    return winners;
  }

  function resolveMatch(aId, bId, roundNum, duelNum) {
    var forced = roundNum && duelNum ? getForcedWinner(roundNum, duelNum) : null;
    if (forced && (forced === aId || forced === bId)) {
      var rowAf = getRowById(aId);
      var rowBf = bId ? getRowById(bId) : null;
      return {
        winnerId: forced,
        scoreA: puntajeTotal(rowAf),
        scoreB: rowBf ? puntajeTotal(rowBf) : null,
        status: 'forced'
      };
    }
    var rowA = getRowById(aId);
    var rowB = bId ? getRowById(bId) : null;
    var scoreA = puntajeTotal(rowA);
    var scoreB = rowB ? puntajeTotal(rowB) : null;
    if (!bId) {
      return { winnerId: aId, scoreA: scoreA, scoreB: null, status: 'bye' };
    }
    if (scoreA == null || scoreB == null) {
      return { winnerId: null, scoreA: scoreA, scoreB: scoreB, status: 'pending' };
    }
    if (scoreA > scoreB) return { winnerId: aId, scoreA: scoreA, scoreB: scoreB, status: 'a' };
    if (scoreB > scoreA) return { winnerId: bId, scoreA: scoreA, scoreB: scoreB, status: 'b' };
    return { winnerId: null, scoreA: scoreA, scoreB: scoreB, status: 'tie' };
  }

  function getRoundWinners(roundNum) {
    var participants = getParticipantsForRound(roundNum);
    var winners = [];
    for (var i = 0; i < participants.length; i += 2) {
      var aId = participants[i];
      var bId = participants[i + 1] || null;
      var match = resolveMatch(aId, bId, roundNum, Math.floor(i / 2) + 1);
      if (match.winnerId) winners.push(match.winnerId);
    }
    return winners;
  }

  function buildRoundsStructure() {
    var rounds = [];
    var roundNum = 1;
    while (true) {
      var participants = getParticipantsForRound(roundNum);
      if (participants.length <= 1) break;
      var matches = [];
      for (var i = 0; i < participants.length; i += 2) {
        matches.push({
          duelNum: Math.floor(i / 2) + 1,
          aId: participants[i],
          bId: participants[i + 1] || null
        });
      }
      rounds.push({ roundNum: roundNum, matches: matches });
      roundNum++;
      if (roundNum > 20) break;
    }
    return rounds;
  }

  function getActiveRoundNum(rounds) {
    for (var i = 0; i < rounds.length; i++) {
      var pending = rounds[i].matches.some(function (m) {
        if (!m.bId) return false;
        return resolveMatch(m.aId, m.bId, rounds[i].roundNum, m.duelNum).status === 'pending';
      });
      if (pending) return rounds[i].roundNum;
    }
    return rounds.length ? rounds[rounds.length - 1].roundNum : 1;
  }

  function roundLabel(roundNum, totalRounds) {
    if (roundNum === 1) return currentPhaseTitle();
    if (roundNum === totalRounds && totalRounds > 1) return 'Duelo final';
    return 'Duelo fase · ' + roundNum;
  }

  function roundIsComplete(round) {
    return round.matches.every(function (m) {
      return !!resolveMatch(m.aId, m.bId, 1, m.duelNum).winnerId;
    });
  }

  function renderRoundSummaryPanel(round) {
    var summary = $('organizerRoundSummary');
    if (!summary || !round) return;

    var participantIds = round.matches.reduce(function (acc, m) {
      acc.push(m.aId);
      if (m.bId) acc.push(m.bId);
      return acc;
    }, []);
    var participants = participantIds.map(getRowById).sort(function (a, b) {
      var ta = puntajeTotal(a) != null ? puntajeTotal(a) : -1;
      var tb = puntajeTotal(b) != null ? puntajeTotal(b) : -1;
      if (tb !== ta) return tb - ta;
      return (a.nombre || '').localeCompare(b.nombre || '', 'es');
    });

    var winners = getCurrentDuelWinners();
    var winnerRows = winners.map(getRowById);
    var loserRows = participants.filter(function (p) {
      return winners.indexOf(p.competidorId) < 0;
    });
    var complete = roundIsComplete(round);
    var label = round.phaseTitle || currentPhaseTitle();

    var html = '<div class="jurado-round-panel">';
    html += '<header class="jurado-round-panel-head"><h3>' + escapeHtml(label) + '</h3>';
    html += '<span class="jurado-round-panel-meta">' + participants.length + ' en competencia';
    if (complete) html += ' · ' + winners.length + ' clasifican por mayor puntaje';
    html += '</span></header>';

    html += '<div class="jurado-round-panel-grid">';
    html += '<section class="jurado-round-col"><h4>Ranking de la ronda</h4><ol class="jurado-round-rank">';
    participants.forEach(function (p, idx) {
      var t = puntajeTotal(p);
      var passes = complete && winners.indexOf(p.competidorId) >= 0;
      html += '<li class="jurado-round-rank-item' + (passes ? ' jurado-round-rank-item--pass' : '') + '">';
      html += '<span class="jurado-round-rank-pos">' + (idx + 1) + '</span>';
      html += '<span class="jurado-round-rank-name">' + escapeHtml(p.nombre) + '</span>';
      html += '<span class="jurado-round-rank-score">' + (t != null ? t + ' pts' : '—') + '</span>';
      if (passes) html += '<span class="jurado-duel-badge">Pasa</span>';
      html += '</li>';
    });
    html += '</ol></section>';

    if (complete && winners.length) {
      html += '<section class="jurado-round-col jurado-round-col--pass"><h4>Clasifican (' + winners.length + ')</h4><ul class="jurado-round-pass-list">';
      winnerRows.forEach(function (p) {
        var t = puntajeTotal(p);
        html += '<li><strong>' + escapeHtml(p.nombre) + '</strong>' + (t != null ? ' · ' + t + ' pts' : '') + '</li>';
      });
      html += '</ul></section>';
      if (loserRows.length) {
        html += '<section class="jurado-round-col jurado-round-col--out"><h4>Quedan fuera (' + loserRows.length + ')</h4><ul class="jurado-round-out-list">';
        loserRows.forEach(function (p) {
          var t = puntajeTotal(p);
          html += '<li>' + escapeHtml(p.nombre) + (t != null ? ' · ' + t + ' pts' : '') + '</li>';
        });
        html += '</ul></section>';
      }
    } else {
      html += '<section class="jurado-round-col jurado-round-col--pending"><h4>Pendiente</h4>';
      html += '<p class="jurado-hint">En cada duelo pasa quien tenga mayor puntaje total (J1+J2+J3). Puedes editar puntajes manualmente o declarar ganador en empates.</p></section>';
    }

    html += '</div></div>';
    summary.innerHTML = html;
    summary.hidden = false;
  }

  function buildManualScoreSelect(critKey, judgeNum, value) {
    var html = '<select class="jurado-manual-select" data-manual-judge="' + judgeNum + '" data-manual-crit="' + critKey + '">';
    html += '<option value="">—</option>';
    for (var n = getScaleMin(); n <= getScaleMax(); n++) {
      html += '<option value="' + n + '"' + (String(value) === String(n) ? ' selected' : '') + '>' + n + '</option>';
    }
    html += '</select>';
    return html;
  }

  function hideOrganizerManualEdit() {
    var card = $('organizerManualCard');
    if (card) card.hidden = true;
    manualEditCompetidorId = '';
    manualEditDirty = false;
  }

  function recalcManualSubtotals() {
    for (var j = 1; j <= getJudgeCount(); j++) {
      var scores = {};
      var complete = true;
      getCriteria().forEach(function (crit) {
        var sel = document.querySelector('.jurado-manual-select[data-manual-judge="' + j + '"][data-manual-crit="' + crit.key + '"]');
        var v = sel ? parseInt(sel.value, 10) : NaN;
        if (!isScoreInScale(v)) complete = false;
        else scores[crit.key] = v;
      });
      var el = $('manualSubJ' + j);
      if (el) el.textContent = complete ? String(judgeSubtotal(scores)) : '—';
    }
    var saveBtn = $('organizerManualSaveBtn');
    if (saveBtn) saveBtn.disabled = guardando || !manualEditCompetidorId;
  }

  function readManualFormJudges() {
    var judges = {};
    for (var j = 1; j <= getJudgeCount(); j++) {
      var scores = {};
      var complete = true;
      getCriteria().forEach(function (crit) {
        var sel = document.querySelector('.jurado-manual-select[data-manual-judge="' + j + '"][data-manual-crit="' + crit.key + '"]');
        if (!sel || sel.value === '') {
          complete = false;
          return;
        }
        var v = parseInt(sel.value, 10);
        if (!isScoreInScale(v)) complete = false;
        else scores[crit.key] = v;
      });
      var sub = judgeSubtotal(scores);
      if (complete && sub != null) {
        judges['j' + j] = { scores: scores, subtotal: sub };
      }
    }
    return judges;
  }

  function renderOrganizerManualEdit(competidorId) {
    var card = $('organizerManualCard');
    var form = $('organizerManualForm');
    var target = $('organizerManualTarget');
    if (!card || !form || !competidorId) {
      hideOrganizerManualEdit();
      return;
    }

    manualEditCompetidorId = competidorId;
    var found = competidores.find(function (c) { return c.id === competidorId; });
    var cal = calificacionesMap[competidorId];
    var nombre = found ? found.nombre : (cal ? cal.nombre : competidorId);
    if (target) target.textContent = 'Competidor: ' + nombre;
    card.hidden = false;

    if (!manualEditDirty) {
      var html = '';
      for (var j = 1; j <= getJudgeCount(); j++) {
        var judgeKey = 'j' + j;
        var judge = cal && cal.judges ? cal.judges[judgeKey] : null;
        var scores = judge && judge.scores ? judge.scores : {};
        var sub = judge && judge.subtotal != null ? judge.subtotal : '—';
        html += '<details class="jurado-manual-judge" open>';
        html += '<summary>Juez ' + j + ' · subtotal <strong id="manualSubJ' + j + '">' + sub + '</strong> / ' + maxJudgeSubtotal() + '</summary>';
        html += '<div class="jurado-manual-grid">';
        getCriteria().forEach(function (crit) {
          html += '<label class="jurado-manual-field"><span>' + escapeHtml(crit.label) + '</span>';
          html += buildManualScoreSelect(crit.key, j, scores[crit.key]);
          html += '</label>';
        });
        html += '</div></details>';
      }
      form.innerHTML = html;
    }

    recalcManualSubtotals();
  }

  function onOrganizerManualSave() {
    if (guardando || !manualEditCompetidorId) return;
    var found = competidores.find(function (c) { return c.id === manualEditCompetidorId; });
    if (!found) return;

    var judges = readManualFormJudges();
    var errEl = $('organizerManualError');
    var okEl = $('organizerManualSuccess');
    if (errEl) errEl.hidden = true;
    if (okEl) okEl.hidden = true;

    if (!Object.keys(judges).length) {
      if (errEl) {
        errEl.textContent = 'Completa todos los criterios (escala ' + getScaleMin() + '–' + getScaleMax() + ') de al menos un juez.';
        errEl.hidden = false;
      }
      return;
    }

    guardando = true;
    $('organizerManualSaveBtn').disabled = true;
    $('organizerManualSaveBtn').textContent = 'Guardando…';

    saveOrganizerFullCalificacion({
      competidorId: manualEditCompetidorId,
      nombre: found.nombre,
      judges: judges
    }).then(function (saved) {
      calificacionesMap[saved.competidorId] = saved;
      manualEditDirty = false;
      if (okEl) {
        okEl.textContent = '✓ Puntajes guardados' + (saved.sumaTotal != null ? ' · Total ' + saved.sumaTotal + ' pts' : '');
        okEl.hidden = false;
      }
      renderOrganizerDetail(manualEditCompetidorId);
      renderOrganizerBracket();
      renderOrganizerScoresTable();
      renderOrganizerManualEdit(manualEditCompetidorId);
    }).catch(function (err) {
      if (errEl) {
        errEl.textContent = err.message || 'No se pudo guardar.';
        errEl.hidden = false;
      }
    }).finally(function () {
      guardando = false;
      $('organizerManualSaveBtn').textContent = 'Guardar puntajes manuales';
      recalcManualSubtotals();
    });
  }

  function bindOrganizerManualEdit() {
    if (organizerManualBound) return;
    organizerManualBound = true;
    document.addEventListener('change', function (e) {
      if (!e.target.classList || !e.target.classList.contains('jurado-manual-select')) return;
      manualEditDirty = true;
      recalcManualSubtotals();
    });
    var saveBtn = $('organizerManualSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', onOrganizerManualSave);
  }

  function renderMatchCompetitor(row, isWinner, isLoser, showAdmin, roundNum, duelNum, result) {
    var total = puntajeTotal(row);
    var cls = 'jurado-duel-player';
    if (isWinner) cls += ' jurado-duel-player--winner';
    if (isLoser) cls += ' jurado-duel-player--loser';
    var adminHtml = '';
    if (showAdmin) {
      adminHtml = '<div class="jurado-duel-admin">' +
        '<button type="button" class="jurado-btn-inline" data-edit-scores="' + escapeHtml(row.competidorId) + '">Editar pts</button>' +
        '<button type="button" class="jurado-btn-inline" data-reset-one="' + escapeHtml(row.competidorId) + '">Reiniciar</button>';
      if (roundNum && duelNum && result && (result.status === 'tie' || result.status === 'pending') && !isWinner) {
        adminHtml += '<button type="button" class="jurado-btn-inline jurado-btn-inline--win" data-forzar-gana="' + escapeHtml(row.competidorId) + '" data-round="' + roundNum + '" data-duel="' + duelNum + '">Declarar ganador</button>';
      }
      adminHtml += '<button type="button" class="jurado-btn-inline jurado-btn-inline--danger" data-eliminar="' + escapeHtml(row.competidorId) + '">Eliminar</button>' +
        '</div>';
    }
    return '<div class="' + cls + '">' +
      '<div class="jurado-duel-name">' + escapeHtml(row.nombre) + (isWinner ? ' <span class="jurado-duel-badge">Pasa</span>' : '') + '</div>' +
      '<div class="jurado-duel-scores">' +
      formatJudgeScores(row).map(function (v, i) {
        return '<span>J' + (i + 1) + ' ' + v + '</span>';
      }).join('') +
      '</div>' +
      '<div class="jurado-duel-total">' + (total != null ? total + ' pts' : '—') + '</div>' +
      adminHtml +
      '</div>';
  }

  function renderOrganizerBracket() {
    var nav = $('organizerRoundsNav');
    var box = $('organizerBracket');
    var champ = $('organizerChampionStrip');
    var summary = $('organizerRoundSummary');
    if (!nav || !box) return;

    if (isGruposPhase()) {
      var grupo = getCurrentGrupo();
      nav.innerHTML = '<span class="jurado-round-tab jurado-round-tab--active">' + escapeHtml(currentPhaseTitle()) + '</span>';
      if (!grupo) {
        box.innerHTML = '<p class="jurado-hint">Sin grupo activo. Ejecuta el sorteo en Control.</p>';
        return;
      }
      box.innerHTML = renderRankedActivePanel({
        intro: 'Fase de grupos · Grupo ' + grupo.nombre + ': califica a todos. Clasifican los ' + (grupo.avance || 2) + ' mejores.'
      });
      if (summary) { summary.hidden = true; summary.innerHTML = ''; }
      if (champ) champ.hidden = true;
      return;
    }

    if (isPuntajeGeneralMode()) {
      nav.innerHTML = '<span class="jurado-round-tab jurado-round-tab--active">' + escapeHtml(currentPhaseTitle()) + ' · Puntaje general</span>';
      box.innerHTML = renderRankedActivePanel({
        intro: 'Modo puntaje general: todos compiten por ranking. Usa «Clasificar por puntaje» en Control cuando todos tengan nota completa.'
      });
      if (summary) { summary.hidden = true; summary.innerHTML = ''; }
      if (champ) champ.hidden = true;
      return;
    }

    var current = buildCurrentDuelRound();
    if (!current || current.matches.length < 1) {
      nav.innerHTML = '';
      box.innerHTML = '<p class="jurado-hint">Agrega al menos 2 participantes activos para armar duelos en ' + escapeHtml(currentPhaseTitle()) + '.</p>';
      if (champ) champ.hidden = true;
      if (summary) { summary.hidden = true; summary.innerHTML = ''; }
      return;
    }

    nav.innerHTML = '<span class="jurado-round-tab jurado-round-tab--active">' + escapeHtml(current.phaseTitle) + '</span>';

    renderRoundSummaryPanel(current);

    box.innerHTML = current.matches.map(function (m) {
      var rowA = getRowById(m.aId);
      var rowB = m.bId ? getRowById(m.bId) : null;
      var result = resolveMatch(m.aId, m.bId, 1, m.duelNum);
      var statusHtml = '';
      if (result.status === 'bye') {
        statusHtml = '<p class="jurado-duel-status jurado-duel-status--bye">Pasa directo (sin rival en este duelo)</p>';
      } else if (result.status === 'forced') {
        statusHtml = '<p class="jurado-duel-status jurado-duel-status--done">Ganador declarado por organizador</p>';
      } else if (result.status === 'pending') {
        statusHtml = '<p class="jurado-duel-status jurado-duel-status--pending">Esperando puntaje total de ambos (' + getJudgeCount() + ' jueces)</p>';
      } else if (result.status === 'tie') {
        statusHtml = '<p class="jurado-duel-status jurado-duel-status--tie">Empate · ' + result.scoreA + ' = ' + result.scoreB + ' · declara ganador abajo</p>';
      } else {
        statusHtml = '<p class="jurado-duel-status jurado-duel-status--done">Gana mayor puntaje total</p>';
      }

      var html = '<article class="jurado-duel' + (result.status === 'pending' || result.status === 'tie' ? ' jurado-duel--pending' : '') + '">';
      html += '<header class="jurado-duel-head">Duelo ' + m.duelNum + ' · ' + escapeHtml(current.phaseTitle) + '</header>';
      html += '<div class="jurado-duel-body">';
      html += renderMatchCompetitor(rowA, result.winnerId === m.aId, result.winnerId && result.winnerId !== m.aId, true, 1, m.duelNum, result);
      if (rowB) {
        html += '<div class="jurado-duel-vs">VS</div>';
        html += renderMatchCompetitor(rowB, result.winnerId === m.bId, result.winnerId && result.winnerId !== m.bId, true, 1, m.duelNum, result);
      }
      html += '</div>' + statusHtml + '</article>';
      return html;
    }).join('');

    if (champ) {
      var activos = getActiveCompetitorIds();
      if (activos.length === 1) {
        var winner = getRowById(activos[0]);
        var wt = puntajeTotal(winner);
        champ.innerHTML = '🏆 <strong>Clasificado en ' + escapeHtml(currentPhaseTitle()) + ': ' + escapeHtml(winner.nombre) + '</strong>' +
          (wt != null ? ' · ' + wt + ' pts' : '');
        champ.hidden = false;
      } else {
        var allDone = current.matches.every(function (m) {
          return resolveMatch(m.aId, m.bId, 1, m.duelNum).winnerId;
        });
        if (allDone && getCurrentDuelWinners().length === 1 && activos.length <= 2) {
          var w = getRowById(getCurrentDuelWinners()[0]);
          champ.innerHTML = '🏆 <strong>Pasa: ' + escapeHtml(w.nombre) + '</strong> — usa «Avanzar ganadores» para la siguiente ronda';
          champ.hidden = false;
        } else {
          champ.hidden = true;
          champ.innerHTML = '';
        }
      }
    }
  }

  function countJudgesDone(row) {
    var n = 0;
    var jmax = getJudgeCount();
    for (var j = 1; j <= jmax; j++) {
      if (judgeDone(row.judges, j)) n++;
    }
    return n;
  }

  function buildUnifiedOrganizerRows() {
    return competidores.map(function (c) { return getRowById(c.id); });
  }

  function renderOrganizerScoresTable() {
    var tbody = $('organizerRankingBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    var rows = buildUnifiedOrganizerRows().filter(function (row) {
      return getActiveCompetitorIds().indexOf(row.competidorId) >= 0;
    }).slice().sort(function (a, b) {
      var ta = puntajeTotal(a) != null ? puntajeTotal(a) : -1;
      var tb = puntajeTotal(b) != null ? puntajeTotal(b) : -1;
      if (tb !== ta) return tb - ta;
      return (a.nombre || '').localeCompare(b.nombre || '', 'es');
    });

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="' + rankingColspan() + '" class="jurado-empty">Sin participantes activos en esta ronda.</td></tr>';
      return;
    }

    rows.forEach(function (row) {
      var total = puntajeTotal(row);
      var estado = puntajeEstado(row);
      var estadoLabel = estado === 'listo' ? 'Listo' : estado === 'parcial' ? 'Parcial' : 'Pendiente';
      var estadoCls = estado === 'listo' ? 'jurado-estado--listo' : estado === 'parcial' ? 'jurado-estado--parcial' : 'jurado-estado--pendiente';
      var judgeCells = '';
      for (var j = 1; j <= getJudgeCount(); j++) {
        judgeCells += '<td class="jurado-td-score jurado-td-judge">' + notaJuezDisplay(row, j) + '</td>';
      }
      var tr = document.createElement('tr');
      tr.className = 'jurado-score-row';
      tr.innerHTML =
        '<td class="jurado-td-name">' + escapeHtml(row.nombre) + '</td>' +
        judgeCells +
        '<td class="jurado-td-total"><strong>' + (total != null ? total : '—') + '</strong></td>' +
        '<td class="' + estadoCls + '">' + estadoLabel + '</td>' +
        '<td class="jurado-td-actions">' +
        '<button type="button" class="jurado-btn-inline" data-edit-scores="' + escapeHtml(row.competidorId) + '">Editar</button> ' +
        '<button type="button" class="jurado-btn-inline" data-reset-one="' + escapeHtml(row.competidorId) + '">Reiniciar</button> ' +
        '<button type="button" class="jurado-btn-inline jurado-btn-inline--danger" data-eliminar="' + escapeHtml(row.competidorId) + '">Eliminar</button>' +
        '</td>';
      tr.querySelectorAll('button').forEach(function (btn) {
        btn.addEventListener('click', function (e) { e.stopPropagation(); });
      });
      tr.addEventListener('click', function () {
        var sel = $('organizerCompetidorSelect');
        if (sel) {
          sel.value = row.competidorId;
          renderOrganizerDetail(row.competidorId);
        }
      });
      tbody.appendChild(tr);
    });

    var updated = $('organizerUpdated');
    if (updated) updated.textContent = 'Actualizado: ' + new Date().toLocaleTimeString('es-CO') + ' · cada 3 s';
  }

  function notaJuezDisplay(row, j) {
    var score = judgeScoreValue(row, j);
    if (score != null) return '<span class="jurado-score-done">' + score + '</span>';
    return '<span class="jurado-score-pending">—</span>';
  }

  function formatJudgeScores(row) {
    var out = [];
    for (var j = 1; j <= getJudgeCount(); j++) {
      var v = judgeScoreValue(row, j);
      out.push(v != null ? v : '—');
    }
    return out;
  }

  function hasAnyJudgeScore(row) {
    for (var j = 1; j <= getJudgeCount(); j++) {
      if (judgeDone(row.judges, j)) return true;
    }
    return false;
  }

  function judgeSubtotalDisplay(cal, j) {
    var g = cal.judges && cal.judges['j' + j];
    if (g && g.subtotal != null) return g.subtotal;
    return '—';
  }

  function renderJudgeDetailCard(j, judge) {
    var html = '<article class="jurado-judge-card' + (judge && judge.scores ? ' jurado-judge-card--done' : ' jurado-judge-card--pending') + '">';
    html += '<header class="jurado-judge-card-head"><span class="jurado-judge-card-num">Juez ' + j + '</span>';
    if (judge && judge.subtotal != null) {
      html += '<span class="jurado-judge-card-total">' + judge.subtotal + ' <small>/ ' + maxJudgeSubtotal() + '</small></span>';
    } else {
      html += '<span class="jurado-judge-card-total jurado-score-pending">Pendiente</span>';
    }
    html += '</header>';
    if (!judge || !judge.scores) {
      html += '<p class="jurado-hint">Este juez aún no ha calificado.</p></article>';
      return html;
    }
    html += '<ul class="jurado-detail-scores">';
    getCriteria().forEach(function (c) {
      html += '<li><span>' + escapeHtml(c.label) + '</span><strong>' + (judge.scores[c.key] || '—') + '</strong></li>';
    });
    html += '</ul></article>';
    return html;
  }

  function renderOrganizerDetail(competidorId) {
    var box = $('organizerDetail');
    if (!competidorId) {
      box.innerHTML = '<p class="jurado-hint">Elige un competidor arriba para ver las notas de los jueces y el resultado final.</p>';
      box.hidden = false;
      return;
    }

    var cal = calificacionesMap[competidorId];
    var found = competidores.find(function (c) { return c.id === competidorId; });
    var nombre = found ? found.nombre : competidorId;

    if (!cal) {
      box.innerHTML =
        '<h3 class="jurado-detail-title">' + escapeHtml(nombre) + '</h3>' +
        '<p class="jurado-hint">Sin calificaciones registradas para este competidor.</p>' +
        '<div class="jurado-judges-grid">' +
        (function () {
          var cards = '';
          for (var j = 1; j <= getJudgeCount(); j++) cards += renderJudgeDetailCard(j, null);
          return cards;
        })() +
        '</div>' +
        (mode === 'organizer' ? renderOrganizerDetailAdminActions(competidorId) : '');
      box.hidden = false;
      return;
    }

    var html = '<h3 class="jurado-detail-title">' + escapeHtml(cal.nombre || nombre) + '</h3>';
    html += '<div class="jurado-scores-together">';
    for (var ji = 1; ji <= getJudgeCount(); ji++) {
      var jv = judgeSubtotalDisplay(cal, ji);
      html += '<div class="jurado-scores-together-item' + (jv !== '—' ? ' jurado-scores-together-item--done' : '') + '"><span>Juez ' + ji + '</span><strong>' + jv + '</strong></div>';
    }
    html += '</div>';

    html += '<div class="jurado-table-wrap"><table class="jurado-table"><thead><tr><th>Criterio</th>';
    for (var jh = 1; jh <= getJudgeCount(); jh++) html += '<th>J' + jh + '</th>';
    html += '</tr></thead><tbody>';
    getCriteria().forEach(function (crit) {
      html += '<tr><th style="text-align:left">' + escapeHtml(crit.label) + '</th>';
      for (var j = 1; j <= getJudgeCount(); j++) {
        var g = cal.judges && cal.judges['j' + j];
        var val = g && g.scores ? g.scores[crit.key] : '—';
        html += '<td>' + (val !== undefined && val !== '' ? val : '—') + '</td>';
      }
      html += '</tr>';
    });
    html += '</tbody><tfoot><tr class="jurado-subtotal-row"><th>Subtotal</th>';
    for (var s = 1; s <= getJudgeCount(); s++) {
      html += '<td>' + judgeSubtotalDisplay(cal, s) + '</td>';
    }
    html += '</tr></tfoot></table></div>';

    html += '<div class="jurado-judges-grid">';
    for (var jc = 1; jc <= getJudgeCount(); jc++) {
      html += renderJudgeDetailCard(jc, cal.judges && cal.judges['j' + jc]);
    }
    html += '</div>';

    if (puntajeTotal(cal) != null) {
      var total = puntajeTotal(cal);
      var parts = [];
      for (var jb = 1; jb <= getJudgeCount(); jb++) {
        parts.push('J' + jb + ': ' + judgeSubtotalDisplay(cal, jb));
      }
      html += '<div class="jurado-detail-final-box">' +
        '<div class="jurado-detail-final-label">Puntaje total</div>' +
        '<div class="jurado-detail-final-prom">' + total + '</div>' +
        '<div class="jurado-detail-final-meta">Suma de ' + getJudgeCount() + ' jueces · máx. ' + maxTotalScore() + ' pts</div>' +
        '<div class="jurado-detail-final-breakdown">' + parts.join(' + ') + ' = ' + total + '</div>' +
        '</div>';
    } else {
      var faltan = [];
      for (var fj = 1; fj <= getJudgeCount(); fj++) {
        if (!judgeDone(cal.judges, fj)) faltan.push(fj);
      }
      html += '<div class="jurado-detail-final-box jurado-detail-final-box--pending">' +
        '<div class="jurado-detail-final-label">Puntaje total</div>' +
        '<p class="jurado-hint">Falta' + (faltan.length > 1 ? 'n' : '') + ' juez' + (faltan.length > 1 ? 'es' : '') + ': ' +
        faltan.map(function (j) { return 'J' + j; }).join(', ') + '</p></div>';
    }

    if (mode === 'organizer') {
      html += renderOrganizerDetailAdminActions(competidorId);
    }

    box.innerHTML = html;
    box.hidden = false;
  }

  function refreshOrganizer() {
    var updated = $('organizerUpdated');
    if (updated) updated.textContent = 'Actualizando…';
    return Promise.all([loadBracketStore(), loadCalificacionesStore()]).then(function (results) {
      clearOrganizerError();
      return maybeAutoAdvance().then(function (didAdvance) {
        if (didAdvance) {
          return loadBracketStore().then(function () {
            renderOrganizerViews(results[1]);
            return results[1];
          });
        }
        renderOrganizerViews(results[1]);
        return results[1];
      });
    });
  }

  function enterOrganizer() {
    mode = 'organizer';
    writeSession({ mode: 'organizer', pin: pin });
    showOrganizerUI();
  }

  function showOrganizerUI() {
    hideAll();
    document.body.classList.add('jurado-page--organizer');
    applyPlatformBranding();

    $('organizerSection').hidden = false;
    clearOrganizerError();

    fillCompetidorSelect($('organizerCompetidorSelect'), true, competidores);

    bindOrganizerAdminActions();
    bindOrganizerManualEdit();
    bindDashboardTabs();
    bindPlatformConfigForm();
    applyPageModeUI();
    switchDashTab(activeDashTab);

    try {
      renderOrganizerViews(calificacionesList());
    } catch (err) {
      showOrganizerError(err.message || 'Error al mostrar el panel.');
    }

    refreshOrganizer().catch(function (err) {
      showOrganizerError(err.message || 'No se pudieron actualizar las calificaciones.');
    });

    if (!organizerUiBound) {
      organizerUiBound = true;
      $('organizerCompetidorSelect').addEventListener('change', function () {
        manualEditDirty = false;
        renderOrganizerDetail(this.value);
        renderOrganizerManualEdit(this.value);
      });
      $('organizerRefreshBtn').addEventListener('click', function () {
        refreshOrganizer().catch(function (err) {
          showOrganizerError(err.message || 'Error al actualizar');
        });
      });
    }

    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(function () {
      refreshOrganizer().catch(function () { /* silencioso */ });
    }, REFRESH_MS);

    document.addEventListener('visibilitychange', onOrganizerVisibility);
  }

  function onOrganizerVisibility() {
    if (mode === 'organizer' && !document.hidden) {
      refreshOrganizer().catch(function () { /* silencioso */ });
    }
  }

  function resolvePin(value) {
    var p = String(value || '').trim().toLowerCase();
    var org = pinOrganizadorEffective();
    var juez = pinJuezEffective();
    if (p === PIN_ORGANIZADOR || p === org) return org;
    if (p === PIN_JUEZ || p === juez) return juez;
    return '';
  }

  function init() {
    initTenantFromUrl();
    initHubTournamentContext();

    if (PAGE_MODE === 'hub') {
      $('loadingMsg').hidden = false;
      return loadPlatformConfig().then(function () {
        $('loadingMsg').hidden = true;
        showHubUI();
      }).catch(function (err) {
        showPinError(err.message || 'No se pudo cargar la configuración.');
      });
    }

    var params = getParams();
    var rawPin = String(params.get('pin') || '').trim().toLowerCase();

    $('loadingMsg').hidden = false;

    loadPlatformConfig().then(function () {
      pin = resolvePin(rawPin);

      if (PAGE_MODE === 'juez') {
        if (!pin || pin !== pinJuezEffective()) {
          showPinError('Enlace de juez inválido. Pide el enlace completo al organizador.');
          return;
        }
        var juezParam = parseInt(params.get('juez') || '', 10);
        if (juezParam < 1 || juezParam > getJudgeCount()) {
          showPinError('Falta el número de juez en la URL (?juez=1…' + getJudgeCount() + ').');
          return;
        }
        judgeNum = juezParam;
        mode = 'judge';
        pin = pinJuezEffective();
        writeSession({ mode: 'judge', judgeNum: juezParam, pin: pin });
      } else if (PAGE_MODE === 'config' || PAGE_MODE === 'organizador') {
        if (!pin || pin !== pinOrganizadorEffective()) {
          showPinError('PIN de organizador inválido. Usa el enlace con ?pin=…');
          return;
        }
        mode = 'organizer';
        pin = pinOrganizadorEffective();
        writeSession({ mode: 'organizer', pin: pin });
        if (PAGE_MODE === 'config') activeDashTab = 'config';
      } else {
        if (!pin) {
          showPinError('Falta el PIN en la URL o no es válido. Pide el enlace al organizador.');
          return;
        }

        var sess = readSession();
        if (sess && sess.pin === pin && sess.mode === 'organizer' && pin === pinOrganizadorEffective()) {
          mode = 'organizer';
        } else if (sess && sess.pin === pin && sess.mode === 'judge' && pin === pinJuezEffective()) {
          if (sess.judgeNum >= 1 && sess.judgeNum <= getJudgeCount()) {
            mode = 'judge';
            judgeNum = sess.judgeNum;
          }
        }

        var juezParamLegacy = parseInt(params.get('juez') || '', 10);
        if (!mode && pin === pinJuezEffective() && juezParamLegacy >= 1 && juezParamLegacy <= getJudgeCount()) {
          judgeNum = juezParamLegacy;
          mode = 'judge';
          writeSession({ mode: 'judge', judgeNum: juezParamLegacy, pin: pin });
        }
        if (!mode && pin === pinOrganizadorEffective()) {
          mode = 'organizer';
          writeSession({ mode: 'organizer', pin: pin });
        }
      }

      return Promise.all([loadCompetidores(), loadCalificacionesStore()])
        .then(function (results) {
          competidores = results[0];
          if (!competidores.length && PAGE_MODE !== 'config') {
            showPinError('No hay competidores habilitados.');
            return;
          }
          if (PAGE_MODE === 'config' && !competidores.length) {
            $('loadingMsg').hidden = true;
            showOrganizerUI();
            return;
          }
          return loadBracketStore().then(function () {
            if (!bracketState.activos.length) {
              bracketState.activos = competidores.map(function (c) { return c.id; });
            }

            $('loadingMsg').hidden = true;

            if (mode === 'organizer') {
              showOrganizerUI();
            } else if (mode === 'judge' && judgeNum) {
              applyPlatformBranding();
              maybeShowJudgeUI();
            } else {
              applyPlatformBranding();
              showRolePicker();
            }
          });
        });
    }).catch(function (err) {
      showPinError(err.message || 'No se pudo cargar el panel.');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
