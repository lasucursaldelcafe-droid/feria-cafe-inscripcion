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
    competenciaTorneo: 'competencia-torneo.html',
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
    competenciaTorneo: '/competencia/torneo',
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

  function isLocalDev() {
    if (global.location.protocol === 'file:') return true;
    var host = global.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }

  function appendQuery(url, params) {
    var parts = [];
    Object.keys(params || {}).forEach(function (key) {
      var val = params[key];
      if (val === undefined || val === null || val === '') return;
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(val)));
    });
    if (!parts.length) return url;
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + parts.join('&');
  }

  /**
   * Única fuente de enlaces del ecosistema jurado / torneo.
   * opts: { evt?, pinOrganizador?, pinJuez?, jueces? }
   */
  function buildJuradoUrls(opts) {
    opts = opts || {};
    var ev = global.EVENT_CONFIG || {};
    var j = ev.juradoV60 || {};
    var evt = opts.evt ? String(opts.evt).trim().toLowerCase() : '';
    var pinOrg = String(opts.pinOrganizador || j.pinOrganizador || 'v60organizador').trim();
    var pinJuez = String(opts.pinJuez || j.pinJuez || 'v60sensorial').trim();
    var jueces = Math.max(1, Math.min(5, parseInt(opts.jueces, 10) || j.jueces || 3));
    var local = isLocalDev();
    var site = String(ev.siteUrl || global.location.origin).replace(/\/$/, '');

    function pageUrl(hostedKey, localFile, query) {
      var path = local ? (LOCAL[hostedKey] || localFile) : (HOSTED[hostedKey] || '/' + localFile);
      var url = local && path.indexOf('http') !== 0
        ? path
        : (path.charAt(0) === '/' ? site + path : site + '/' + path);
      return appendQuery(url, query);
    }

    var commonEvt = evt ? { evt: evt } : {};
    var urls = {
      hub: pageUrl('juradoV60', 'jurado-v60.html', commonEvt),
      config: pageUrl('juradoConfig', 'jurado-config.html', Object.assign({}, commonEvt, { pin: pinOrg })),
      organizador: pageUrl('juradoOrganizador', 'jurado-organizador.html', Object.assign({}, commonEvt, { pin: pinOrg })),
      resultados: pageUrl('juradoResultados', 'jurado-resultados.html', commonEvt),
      competencia: evt
        ? pageUrl('competenciaTorneo', 'competencia-torneo.html', { evt: evt })
        : pageUrl('competencia', 'competencia.html', {}),
      inscripcion: evt
        ? pageUrl('competenciaTorneo', 'competencia-torneo.html', { evt: evt })
        : pageUrl('competencia', 'competencia.html', {})
    };

    for (var n = 1; n <= jueces; n++) {
      urls['juez' + n] = pageUrl('juradoJuez', 'jurado-juez.html', Object.assign({}, commonEvt, {
        pin: pinJuez,
        juez: n
      }));
    }
    return urls;
  }

  function juradoJudgeCount() {
    var ev = global.EVENT_CONFIG || {};
    var j = ev.juradoV60 || {};
    return Math.max(1, Math.min(5, parseInt(j.jueces, 10) || 3));
  }

  function syncJuradoV60LinksFromConfig() {
    var root = global.EVENT_CONFIG;
    if (!root || !root.juradoV60) return;
    var j = root.juradoV60;
    var urls = buildJuradoUrls({
      pinOrganizador: j.pinOrganizador,
      pinJuez: j.pinJuez,
      jueces: j.jueces
    });
    j.links = urls;
    j.roles = [
      { id: 'hub', label: 'Consola principal', desc: 'Mapa de todos los paneles del torneo' },
      { id: 'config', label: 'Configuración', desc: 'Marca, reglas, criterios y formulario' },
      { id: 'organizador', label: 'Torneo en vivo', desc: 'Rondas, puntajes y control' },
      { id: 'resultados', label: 'Resultados', desc: 'Portal competidor (nombre + cédula)' },
      { id: 'inscripcion', label: 'Inscripción', desc: 'Formulario público de competidores' }
    ];
    for (var n = 1; n <= juradoJudgeCount(); n++) {
      j.roles.push({
        id: 'juez' + n,
        label: 'Juez ' + n,
        desc: 'Calificación móvil · columna J' + n
      });
    }
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
    apply: applyLinkElements,
    buildJuradoUrls: buildJuradoUrls,
    juradoJudgeCount: juradoJudgeCount,
    syncJuradoV60Links: syncJuradoV60LinksFromConfig,
    LOCAL: LOCAL,
    HOSTED: HOSTED
  };

  syncJuradoV60LinksFromConfig();

  function initLinks() {
    applyLinkElements(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLinks);
  } else {
    initLinks();
  }
})(window);
