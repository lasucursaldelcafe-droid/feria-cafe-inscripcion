/**
 * Rutas canónicas del sitio (local .html vs URLs limpias en Firebase Hosting).
 * Generado por tools/sync_routes.py desde tools/routes.json.
 */
(function (global) {
  'use strict';

  var LOCAL = {
    festival: 'index.html',
    evento: 'el-evento.html',
    actividades: 'actividades.html',
    patrocinadores: 'patrocinadores.html',
    marcas: 'marcas.html',
    marcaPerfil: 'marca-perfil.html',
    stands: 'stands.html',
    feria: 'inscripcion.html',
    competencia: 'competencia.html',
    reglas: 'reglas-v60-championship.html',
    reglasPdf: 'assets/reglas-v60-championship.pdf',
    comoFunciona: 'como-funciona-evento.html',
    privacidad: 'privacidad.html',
    qr: 'qr-inscripcion.html',
    admin: 'admin.html',
    expositor: 'expositor.html',
    miStand: 'expositor.html',
    fidelizacion: 'fidelizacion.html',
    fidelizacionRegistro: 'fidelizacion-registro.html',
    miTarjeta: 'pasaporte-cafetero.html',
    pasaporte: 'pasaporte-cafetero.html',
    escanearPasaporte: 'escanear-pasaporte.html',
    juradoV60: 'jurado-v60.html',
    juradoOrganizador: 'jurado-organizador.html',
    juradoConfig: 'jurado-config.html',
    juradoJuez: 'jurado-juez.html',
    juradoResultados: 'jurado-resultados.html',
    panelFidelizacion: 'dashboard-fidelizacion.html'
  };

  var HOSTED = {
    festival: '/',
    evento: '/el-evento',
    actividades: '/actividades',
    patrocinadores: '/patrocinadores',
    marcas: '/marcas',
    marcaPerfil: '/marcas',
    stands: '/stands',
    feria: '/inscripcion',
    competencia: '/competencia',
    reglas: '/reglas',
    reglasPdf: '/assets/reglas-v60-championship.pdf',
    comoFunciona: '/como-funciona',
    privacidad: '/privacidad',
    qr: '/qr',
    admin: '/admin',
    expositor: '/expositor',
    miStand: '/mi-stand',
    fidelizacion: '/fidelizacion',
    fidelizacionRegistro: '/registro-fidelizacion',
    miTarjeta: '/pasaporte',
    pasaporte: '/pasaporte',
    escanearPasaporte: '/escanear-pasaporte',
    juradoV60: '/jurado-v60',
    juradoOrganizador: '/jurado/organizador',
    juradoConfig: '/jurado/config',
    juradoJuez: '/jurado/juez',
    juradoResultados: '/jurado/resultados',
    panelFidelizacion: '/panel-fidelizacion'
  };

  /** Alias legibles (p. ej. data-link="como-funciona"). */
  var ALIASES = {
    'como-funciona': 'comoFunciona'
  };

  function resolveKey(key) {
    return ALIASES[key] || key;
  }

  function useHostedPaths() {
    var protocol = global.location.protocol;
    if (protocol === 'file:') return false;
    var host = global.location.hostname;
    return host !== 'localhost' && host !== '127.0.0.1';
  }

  function href(key) {
    var map = useHostedPaths() ? HOSTED : LOCAL;
    return map[resolveKey(key)] || '#';
  }

  function absUrl(key) {
    var base = (global.EVENT_CONFIG && global.EVENT_CONFIG.siteUrl) || global.location.origin;
    base = String(base).replace(/\/$/, '');
    var resolved = resolveKey(key);
    var path = HOSTED[resolved] || LOCAL[resolved];
    if (path === '/') return base + '/';
    if (path.charAt(0) === '/') return base + path;
    return base + '/' + path;
  }

  function juradoJudgeCount() {
    var cfg = global.EVENT_CONFIG && global.EVENT_CONFIG.juradoV60;
    var n = cfg && cfg.jueces != null ? parseInt(cfg.jueces, 10) : 3;
    if (isNaN(n) || n < 1) n = 1;
    if (n > 5) n = 5;
    return n;
  }

  function buildJuradoUrls(opts) {
    opts = opts || {};
    var cfg = global.EVENT_CONFIG && global.EVENT_CONFIG.juradoV60;
    var pinOrg = opts.pinOrganizador || (cfg && cfg.pinOrganizador) || 'v60organizador';
    var pinJuez = opts.pinJuez || (cfg && cfg.pinJuez) || 'v60sensorial';
    var jueces = opts.jueces != null ? opts.jueces : juradoJudgeCount();
    jueces = Math.max(1, Math.min(5, parseInt(jueces, 10) || 3));
    var hub = opts.hubBase || absUrl('juradoV60');
    var orgBase = opts.organizadorBase || absUrl('juradoOrganizador');
    var cfgBase = opts.configBase || absUrl('juradoConfig');
    var juezBase = opts.juezBase || absUrl('juradoJuez');
    var urls = {
      hub: hub,
      config: cfgBase + '?pin=' + encodeURIComponent(pinOrg),
      organizador: orgBase + '?pin=' + encodeURIComponent(pinOrg),
      resultados: absUrl('juradoResultados'),
      competencia: absUrl('competencia')
    };
    for (var j = 1; j <= jueces; j++) {
      urls['juez' + j] = juezBase + '?pin=' + encodeURIComponent(pinJuez) + '&juez=' + j;
    }
    return urls;
  }

  function juradoUrl(role) {
    if (global.EVENT_CONFIG && global.EVENT_CONFIG.juradoV60 && global.EVENT_CONFIG.juradoV60.links) {
      var links = global.EVENT_CONFIG.juradoV60.links;
      if (role === 'organizador') return links.organizador;
      if (role === 'config') return links.config;
      if (role === 'resultados') return links.resultados;
      if (role === 'hub') return links.hub;
      var n = parseInt(role, 10);
      if (n >= 1 && links['juez' + n]) return links['juez' + n];
    }
    var built = buildJuradoUrls();
    if (role === 'organizador') return built.organizador;
    if (role === 'config') return built.config;
    if (role === 'resultados') return built.resultados;
    if (role === 'hub') return built.hub;
    return built['juez' + parseInt(role, 10)] || built.organizador;
  }

  function allJuradoUrls() {
    return buildJuradoUrls();
  }

  function applyLinkElements(root) {
    (root || document).querySelectorAll('[data-link]').forEach(function (el) {
      var key = resolveKey(el.getAttribute('data-link'));
      if (!key) return;
      var url = href(key);
      var hash = el.getAttribute('data-hash');
      if (hash) url += '#' + hash.replace(/^#/, '');
      el.setAttribute('href', url);
    });
  }

  global.SiteLinks = {
    href: href,
    absUrl: absUrl,
    juradoUrl: juradoUrl,
    allJuradoUrls: allJuradoUrls,
    buildJuradoUrls: buildJuradoUrls,
    juradoJudgeCount: juradoJudgeCount,
    apply: applyLinkElements,
    LOCAL: LOCAL,
    HOSTED: HOSTED
  };

  function initLinks() {
    applyLinkElements(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLinks);
  } else {
    initLinks();
  }
})(window);
