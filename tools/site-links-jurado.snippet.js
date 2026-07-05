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
