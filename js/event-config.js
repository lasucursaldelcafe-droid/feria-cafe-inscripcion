/**
 * Configuración pública del evento — editable sin tocar cada HTML.
 * Feria y V60 Championship son organizados por el mismo equipo,
 * pero tienen fechas, sedes e inscripciones independientes.
 */
window.EVENT_CONFIG = {
  siteUrl: 'https://la-sucursal-del-cafe.web.app',
  brandName: 'La Sucursal del Café',
  contact: {
    email: 'lasucursaldelcafe@gmail.com',
    whatsapp: '573116699638',
    whatsappDisplay: '+57 311 669 9638'
  },
  /** Alertas al equipo: copia este correo en ORGANIZER_EMAIL de tools/google-apps-script/Code.gs */
  alerts: {
    email: 'lasucursaldelcafe@gmail.com'
  },
  festival: {
    slogan: 'El festival del café especial en Cali',
    lema: 'La Sucursal es de los cafeteros',
    heroBandKicker: 'Cata · Origen · Barismo · Comunidad',
    instagram: '@lasucursal.delcafe',
    instagramUrl: 'https://www.instagram.com/lasucursal.delcafe/',
    heroLead:
      'Dos días para oler, catar y celebrar lo mejor del grano vallecaucano: productores, tostadores y baristas ' +
      'en un solo lugar. Entrada libre — solo traes las ganas de probar.',
    mensaje:
      'Palmetto Plaza se convierte en el punto de encuentro del café especial: prueba tazas, conoce fincas, ' +
      'aprende en talleres y vive el V60 Championship en vivo. Sin boleto de entrada.',
    mensajeEvento:
      'Un fin de semana para descubrir quién hace el café que tomas, cómo se cata y qué lo hace especial.',
    exploreIntro:
      'Cuatro formas de vivir la feria — elige por dónde empezar.',
    highlights: [
      {
        icon: '☕',
        title: 'Stands y cata',
        text: 'Recorre expositores, prueba perfiles de taza y habla directo con quien tosta y sirve.'
      },
      {
        icon: '🌱',
        title: 'Del grano al origen',
        text: 'Fincas y productores cuentan la historia detrás de cada café — variedad, proceso y territorio.'
      },
      {
        icon: '🏆',
        title: 'V60 en vivo',
        text: 'Baristas compiten frente a ti: técnica, duelos y podio en el circuito V60 Championship.'
      },
      {
        icon: '📚',
        title: 'Talleres y formación',
        text: 'Sesiones para entrenar paladar, métodos de extracción y cultura cafetera sin complicarte.'
      }
    ],
    explore: [
      {
        id: 'actividades',
        label: 'Actividades',
        icon: '📋',
        text: 'Stands, fincas, cata guiada, talleres y la competencia V60 — todo el programa en un vistazo.',
        link: 'actividades',
        cta: 'Ver qué hay'
      },
      {
        id: 'visita',
        label: 'Tu visita',
        icon: '✓',
        text: 'Entras gratis. Regístrate solo si quieres premios de visitante y novedades antes del evento.',
        link: 'feria',
        cta: 'Registro visitante'
      },
      {
        id: 'competencia',
        label: 'V60',
        icon: '🏆',
        text: 'El reto de filtrado más emocionante de la ciudad — inscripción aparte, cupos limitados.',
        link: 'competencia',
        cta: 'V60 Championship'
      }
    ],
    modal: {
      eyebrow: 'Entrada gratis · Registro opcional',
      title: '¿Te registras como visitante?',
      texto:
        'El <strong>29 y 30 de agosto de 2026</strong> en <strong>Palmetto Plaza, Cali</strong>. ' +
        'Puedes entrar sin registrarte. Si lo haces (gratis), participas por premios de visitante.',
      cta: 'Registrarme',
      dismiss: 'Explorar primero',
      note: '¿Compites en V60? Eso es aparte: inscripción de pago.'
    }
  },
  feria: {
    nombre: 'Feria de café especial',
    fecha: '29 y 30 de agosto de 2026',
    fechaCorta: '29–30 ago 2026',
    fechaIso: '2026-08-29',
    sede: 'Palmetto Plaza',
    ciudad: 'Cali',
    mapsQuery: 'Palmetto Plaza Cali',
    visitante: {
      nav: 'Registro visitante',
      titulo: 'Registro de visitante',
      cta: 'Registrarme como visitante',
      resumen: 'Entrada sin costo · registro opcional · premios si te registras',
      entradaSinCosto:
        'La feria no tiene precio de ingreso: la entrada es gratuita para todo el mundo, sin límite de aforo.',
      registroOpcional:
        'Registrarte como visitante es opcional. Puedes entrar el día del evento sin completar este formulario.',
      premiosRegistro:
        'Si te registras como visitante (gratis), participas por premios exclusivos para visitantes registrados en la feria y recibes novedades del programa.',
      noEsCompetencia:
        'Este registro es solo para asistir a la feria como visitante. No es la inscripción al V60 Championship (competencia de pago, formulario aparte).'
    },
    premiosVisitante: {
      titulo: 'Premios para visitantes registrados',
      intro:
        'Con registro gratuito participas en sorteos de la feria. Entrar sin registrarte no quita acceso al evento.',
      items: [
        'Sorteos y dinámicas con aliados del festival (marcas expositoras y patrocinadores)',
        'Premios en productos de café: kits de degustación, equipos y experiencias de marcas aliadas',
        'Beneficios sorpresa anunciados antes y durante el evento en Palmetto Plaza'
      ],
      nota:
        'El detalle de cada premio, fechas de sorteo y mecánica se comunicará a visitantes registrados por correo y redes oficiales. No aplica a quienes solo asistan sin registro.'
    },
    notaIndependencia:
      'Organizado por el mismo equipo de La Sucursal del Café. El registro de visitante en la feria es independiente de la inscripción al V60 Championship.',
    programaCorto: [
      {
        icono: '☕',
        tag: 'Stands',
        titulo: 'Café tostado y cata',
        texto: 'Recorre expositores, prueba perfiles de taza y conoce tostadores.'
      },
      {
        icono: '🌱',
        tag: 'Origen',
        titulo: 'Fincas cafeteras',
        texto: 'Productores comparten proceso, variedades e historias del grano.'
      },
      {
        icono: '🏆',
        tag: 'Competencia',
        titulo: 'V60 Championship',
        texto: 'Baristas compiten en café filtrado — técnica y emoción en vivo.'
      },
      {
        icono: '📚',
        tag: 'Talleres',
        titulo: 'Cata y formación',
        texto: 'Sesiones guiadas para entrenar paladar y métodos de extracción.'
      }
    ]
  },
  fidelizacion: {
    nav: 'Pasaporte Cafetero',
    titulo: 'Pasaporte Cafetero',
    resumen: 'Acumula sellos en la feria y canjea beneficios con marcas aliadas.'
  },
  stands: {
    nav: 'Adquiere tu stand',
    titulo: 'Adquiere tu stand',
    resumen: 'Exhibe tu marca en la feria de café especial · solicitud en línea',
    cta: 'Enviar solicitud de stand',
    intro:
      'Reserva o solicita un stand como expositor en Palmetto Plaza. Planes Zona Origen, Zona Gran Reserva o Aliado Patrocinador.',
    noEsVisitante:
      'Este formulario es para expositores y marcas. Si solo asistes como visitante, usa el registro de visitante (opcional, sin costo).',
    noEsCompetencia:
      'No es la inscripción al V60 Championship (competencia de pago, formulario aparte).',
    /** Mapa interactivo — reemplaza image por el plano real del venue cuando lo tengas. */
    map: {
      image: '/assets/stands-map-placeholder.svg',
      replaceHint:
        'Plano guía activo. Sube el plano real como assets/stands-map.jpg para reemplazarlo automáticamente.',
      logoMaxBytes: 5 * 1024 * 1024,
      logoTypes: ['image/jpeg', 'image/png', 'image/webp'],
      /** Posiciones en % del contenedor del mapa (left, top, width, height). */
      positions: [
        { id: 'P1', zone: 'Aliado Patrocinador', label: 'P1', left: 36, top: 12, width: 9, height: 11 },
        { id: 'P2', zone: 'Aliado Patrocinador', label: 'P2', left: 55, top: 12, width: 9, height: 11 },
        { id: 'O1', zone: 'Zona Origen', label: 'O1', left: 5, top: 34, width: 7, height: 9 },
        { id: 'O2', zone: 'Zona Origen', label: 'O2', left: 14, top: 34, width: 7, height: 9 },
        { id: 'O3', zone: 'Zona Origen', label: 'O3', left: 23, top: 34, width: 7, height: 9 },
        { id: 'O4', zone: 'Zona Origen', label: 'O4', left: 32, top: 34, width: 7, height: 9 },
        { id: 'O5', zone: 'Zona Origen', label: 'O5', left: 5, top: 46, width: 7, height: 9 },
        { id: 'O6', zone: 'Zona Origen', label: 'O6', left: 14, top: 46, width: 7, height: 9 },
        { id: 'O7', zone: 'Zona Origen', label: 'O7', left: 23, top: 46, width: 7, height: 9 },
        { id: 'O8', zone: 'Zona Origen', label: 'O8', left: 32, top: 46, width: 7, height: 9 },
        { id: 'O9', zone: 'Zona Origen', label: 'O9', left: 5, top: 58, width: 7, height: 9 },
        { id: 'O10', zone: 'Zona Origen', label: 'O10', left: 14, top: 58, width: 7, height: 9 },
        { id: 'O11', zone: 'Zona Origen', label: 'O11', left: 23, top: 58, width: 7, height: 9 },
        { id: 'O12', zone: 'Zona Origen', label: 'O12', left: 32, top: 58, width: 7, height: 9 },
        { id: 'G1', zone: 'Zona Gran Reserva', label: 'G1', left: 52, top: 34, width: 12, height: 14 },
        { id: 'G2', zone: 'Zona Gran Reserva', label: 'G2', left: 66, top: 34, width: 12, height: 14 },
        { id: 'G3', zone: 'Zona Gran Reserva', label: 'G3', left: 80, top: 34, width: 12, height: 14 },
        { id: 'G4', zone: 'Zona Gran Reserva', label: 'G4', left: 52, top: 52, width: 12, height: 14 },
        { id: 'G5', zone: 'Zona Gran Reserva', label: 'G5', left: 66, top: 52, width: 12, height: 14 },
        { id: 'G6', zone: 'Zona Gran Reserva', label: 'G6', left: 80, top: 52, width: 12, height: 14 }
      ]
    }
  },
  circuito: {
    preliminaresTotal: 2,
    preliminarActual: 2,
    resumen:
      'Dos ediciones preliminares antes de la gran final (29 y 30 de agosto de 2026). En cada una compites por cupo a la competencia principal, reconocimientos de patrocinadores y experiencia de fogueo bajo presión real.',
    motivoPreliminares:
      'Las preliminares son tu escenario de práctica oficial: mismo formato, mismos jueces, misma exigencia que la competencia principal. Ganas confianza, cupos y experiencia para llegar más fuerte a la final.',
    cupoDirecto:
      'También puedes inscribirte con cupo directo a la competencia principal — la cita donde se disputan los premios más importantes, incluido el viaje a World of Coffee Panamá.',
    principal: {
      nombre: 'Competencia principal — La Sucursal del Café',
      fecha: '29 y 30 de agosto de 2026',
      fechaCorta: '29–30 ago 2026',
      fechaIso: '2026-08-29',
      sede: 'Palmetto Plaza',
      ciudad: 'Cali',
      mapsQuery: 'Palmetto Plaza Cali',
      premioDestacado: 'Plata + viaje a World of Coffee Panamá (noviembre) + premios de patrocinadores',
      wcpPanama: {
        nombre: 'World of Coffee Panamá',
        mes: 'noviembre de 2026',
        url: 'https://panama.worldofcoffee.org/',
        descripcion:
          'El encuentro global del café especial en Panamá: tostadores, productores, competencias y la comunidad internacional en un solo lugar.'
      }
    }
  },
  /** Tiempos oficiales por ronda (V60 Championship) — única fuente para copy dinámico. */
  tiemposRonda: {
    preparacionMin: 5,
    preparacionLabel: '5 min',
    competenciaMin: 6,
    competenciaLabel: '6 min',
    catacionMin: 5,
    catacionLabel: '5 min'
  },
  /** Clave del evento activo para inscripción, copy público y filtro del jurado festival. */
  torneoActivo: 'evento2',
  evento1: {
    estado: 'realizada',
    eventoId: 'V60 Championship — Preliminar 1',
    nombre: 'V60 Championship — Preliminar 1',
    preliminar: '1.ª de 2 preliminares',
    clasificatoria: '1.ª de 2 preliminares',
    fecha: 'Realizada',
    fechaCorta: 'Realizada',
    horaInicio: '5:30 p. m.',
    sede: 'Por confirmar',
    ciudad: 'Cali',
    mapsQuery: 'Cali Valle del Cauca',
    horario: [
      { hora: '5:30 p. m.', actividad: 'Registro, bienvenida y entrega de café de ronda' },
      { hora: '6:00 p. m.', actividad: 'Sorteo de método y explicación del protocolo' },
      { hora: '6:30 p. m.', actividad: 'Ronda clasificatoria — estaciones en competencia' },
      { hora: '7:45 p. m.', actividad: 'Catación / evaluación de jueces (estimado)' },
      { hora: '8:30 p. m.', actividad: 'Resultados y cierre de la edición' }
    ],
    horarioNota: 'Edición realizada. Los resultados permanecen en el sistema interno del organizador.',
    whatsappGrupoUrl: 'https://chat.whatsapp.com/GUFGVoaP8X81zWbBjZfIW9',
    whatsappGrupoNombre: 'V60 Championship — competidores'
  },
  evento2: {
    estado: 'activa',
    eventoId: 'V60 Championship — Preliminar 2',
    nombre: 'V60 Championship — Preliminar 2',
    preliminar: '2.ª de 2 preliminares',
    clasificatoria: '2.ª de 2 preliminares',
    fecha: '8 de agosto de 2026',
    fechaCorta: '8 ago 2026',
    fechaIso: '2026-08-08',
    horaInicio: '3:30 p. m.',
    sede: 'Mas Café',
    ciudad: 'Cali',
    mapsQuery: 'Mas Café Cali',
    horario: [
      { hora: '3:30 p. m.', actividad: 'Registro, bienvenida y entrega de café de ronda' },
      { hora: '4:00 p. m.', actividad: 'Sorteo de método y explicación del protocolo' },
      { hora: '4:30 p. m.', actividad: 'Ronda clasificatoria — estaciones en competencia' },
      { hora: '5:45 p. m.', actividad: 'Catación / evaluación de jueces (estimado)' },
      { hora: '6:30 p. m.', actividad: 'Resultados y cierre de la edición' }
    ],
    horarioNota: 'La 2.ª edición inicia a las 3:30 p. m.; el juez principal confirmará tiempos exactos el día del evento.',
    whatsappGrupoUrl: 'https://chat.whatsapp.com/GUFGVoaP8X81zWbBjZfIW9',
    whatsappGrupoNombre: 'V60 Championship — competidores'
  },
  pago: {
    monto: 90000,
    moneda: 'COP',
    metodo: 'Nubank (@mbl616) — Manuel Barraza',
    nubank: '@mbl616',
    titular: 'Manuel Barraza'
  },
  proximosEventos: [
    { num: 1, label: 'Primera Preliminar', estado: 'Realizada', fecha: 'Edición cerrada', sede: '—' },
    { num: 2, label: 'Preliminar 2', estado: 'Inscripción abierta', fecha: '8 de agosto de 2026 · 3:30 p. m.', sede: 'Mas Café, Cali' },
    {
      num: 3,
      label: 'Competencia principal',
      estado: 'Confirmado',
      fecha: '29 y 30 de agosto de 2026',
      sede: 'Palmetto Plaza, Cali'
    }
  ],
  cupoCompetencia: 36,
  /** Patrocinadores confirmados — imagen local o remota; Instagram opcional. */
  sponsors: [
    {
      name: 'Purist',
      instagramUrl: 'https://www.instagram.com/purist.cafe/',
      instagramHandle: '@purist.cafe',
      image: '/assets/sponsors/purist.webp',
      imageAlt: 'Purist — café de especialidad y pan masa madre'
    },
    {
      name: 'Palmetto Plaza',
      instagramUrl: 'https://www.instagram.com/palmettoplaza/',
      instagramHandle: '@palmettoplaza',
      image: '/assets/sponsors/palmetto-plaza.png',
      imageAlt: 'Palmetto Plaza — centro comercial, sede del evento'
    },
    {
      name: 'Ghost Specialty Coffee',
      instagramUrl: 'https://www.instagram.com/ghost_specialty_coffee/',
      instagramHandle: '@ghost_specialty_coffee',
      image: '/assets/sponsors/ghost-specialty-coffee.svg',
      imageAlt: 'Ghost Specialty Coffee',
      badge: 'Café invitado',
      featured: true,
      tagline: 'Café especial con identidad propia',
      description: 'Una marca referente para conectar a visitantes y competidores con perfiles de taza, cultura barista y experiencias alrededor del café.'
    },
    {
      name: 'Medium Café',
      instagramUrl: 'https://www.instagram.com/medium_cafe/',
      instagramHandle: '@medium_cafe',
      image: '/assets/sponsors/medium-cafe.svg',
      imageAlt: 'Medium Café',
      badge: 'Coffee Shop',
      featured: true,
      tagline: 'Café de especialidad para descubrir en feria',
      description: 'Espacio para vivir café, conversación y producto local; una vitrina ideal para visitantes que quieren llevarse una experiencia de la feria.'
    },
    {
      name: 'Elixir Café',
      image: '/assets/sponsors/elixir-cafe.svg',
      imageAlt: 'Elixir Café'
    },
    {
      name: 'Black Coffee Design & Souvenirs',
      image: '/assets/sponsors/black-coffee-design.svg',
      imageAlt: 'Black Coffee Design & Souvenirs'
    }
  ],
  /** Panel jurado sensorial V60 — enlaces con PIN (no indexados públicamente). */
  juradoV60: {
    path: '/jurado-v60',
    paths: {
      hub: '/jurado-v60',
      organizador: '/jurado/organizador',
      config: '/jurado/config',
      juez: '/jurado/juez',
      resultados: '/jurado/resultados',
      historial: '/jurado/historial'
    },
    pinOrganizador: 'v60organizador',
    pinJuez: 'v60sensorial',
    jueces: 3,
    cacheVersion: '20260705jurado25',
    roles: []
  }
};

/**
 * Devuelve el evento de torneo activo (inscripción, copy público, jurado festival).
 * Mantiene evento1 archivado con estado "realizada" para datos históricos.
 */
window.EVENT_CONFIG.getEventoActivo = function getEventoActivo() {
  var root = window.EVENT_CONFIG || {};
  var key = root.torneoActivo;
  if (!key && root.circuito && root.circuito.preliminarActual) {
    key = 'evento' + root.circuito.preliminarActual;
  }
  return (key && root[key]) || root.evento2 || root.evento1 || {};
};

/** @deprecated Los enlaces se sincronizan desde js/site-links.js (SiteLinks.syncJuradoV60Links). */
(function initJuradoV60LinksLegacy() {
  if (window.SiteLinks && window.SiteLinks.syncJuradoV60Links) {
    window.SiteLinks.syncJuradoV60Links();
    return;
  }
  var root = window.EVENT_CONFIG;
  if (!root || !root.juradoV60) return;
  var j = root.juradoV60;
  var site = String(root.siteUrl || '').replace(/\/$/, '');
  var paths = j.paths || {};
  var pathHub = paths.hub || j.path || '/jurado-v60';
  var pathOrg = paths.organizador || '/jurado/organizador';
  var pathCfg = paths.config || '/jurado/config';
  var pathJuez = paths.juez || '/jurado/juez';
  var pathRes = paths.resultados || '/jurado/resultados';
  var pathHist = paths.historial || '/jurado/historial';
  var jueces = Math.max(1, Math.min(5, parseInt(j.jueces, 10) || 3));

  function q(pin) {
    return '?pin=' + encodeURIComponent(pin);
  }

  j.links = {
    hub: site + pathHub,
    config: site + pathCfg + q(j.pinOrganizador),
    organizador: site + pathOrg + q(j.pinOrganizador),
    resultados: site + pathRes,
    historial: site + pathHist,
    competencia: site + '/competencia'
  };
  j.roles = [
    { id: 'hub', label: 'Consola principal', desc: 'Enlaces a todos los paneles del torneo' },
    { id: 'config', label: 'Configuración', desc: 'Marca, reglas y criterios' },
    { id: 'organizador', label: 'Torneo en vivo', desc: 'Vista general, rondas y control' },
    { id: 'resultados', label: 'Resultados', desc: 'Portal competidor (nombre + cédula)' }
  ];
  for (var n = 1; n <= jueces; n++) {
    j.links['juez' + n] = site + pathJuez + q(j.pinJuez) + '&juez=' + n;
    j.roles.push({
      id: 'juez' + n,
      label: 'Juez ' + n,
      desc: 'Calificación móvil · columna J' + n
    });
  }
})();
