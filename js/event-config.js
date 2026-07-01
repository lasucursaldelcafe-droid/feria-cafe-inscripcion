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
    slogan: 'Café que conecta',
    lema: 'La Sucursal es de los cafeteros',
    instagram: '@lasucursal.delcafe',
    instagramUrl: 'https://www.instagram.com/lasucursal.delcafe/',
    mensaje:
      'Dos días para descubrir, probar y conectar con la comunidad cafetera de Cali. La feria no tiene precio de ingreso. El registro como visitante es opcional; si te registras, participas por premios exclusivos para visitantes registrados.',
    modal: {
      eyebrow: 'Entrada sin costo · Registro opcional',
      title: 'Registro de visitante (opcional)',
      cta: 'Registrarme como visitante',
      dismiss: 'Explorar primero',
      note: '¿Compites en café filtrado? Eso es aparte: inscripción de pago al V60 Championship.'
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
        'Solo quienes completan el registro gratuito como visitante participan en sorteos y dinámicas exclusivas de la feria. Entrar sin registrarte no excluye de disfrutar la feria, pero sí de estos premios.',
      items: [
        'Sorteos y dinámicas con aliados del festival (marcas expositoras y patrocinadores)',
        'Premios en productos de café: kits de degustación, equipos y experiencias de marcas aliadas',
        'Beneficios sorpresa anunciados antes y durante el evento en Palmetto Plaza'
      ],
      nota:
        'El detalle de cada premio, fechas de sorteo y mecánica se comunicará a visitantes registrados por correo y redes oficiales. No aplica a quienes solo asistan sin registro.'
    },
    notaIndependencia:
      'Organizado por el mismo equipo de La Sucursal del Café. El registro de visitante en la feria es independiente de la inscripción al V60 Championship.'
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
    preliminarActual: 1,
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
  evento1: {
    nombre: 'V60 Championship — Preliminar 1',
    preliminar: '1.ª de 2 preliminares',
    clasificatoria: '1.ª de 2 preliminares',
    fecha: 'Por confirmar',
    fechaCorta: 'Por confirmar',
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
    horarioNota: 'La 1.ª edición inicia a las 5:30 p. m.; el juez principal confirmará tiempos exactos el día del evento.',
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
    { num: 2, label: 'Preliminar 2', estado: 'Por confirmar', fecha: 'Por confirmar', sede: 'Por confirmar' },
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
      image: 'assets/sponsors/purist.webp',
      imageAlt: 'Purist — café de especialidad y pan masa madre'
    },
    {
      name: 'Palmetto Plaza',
      instagramUrl: 'https://www.instagram.com/palmettoplaza/',
      instagramHandle: '@palmettoplaza',
      image: 'assets/sponsors/palmetto-plaza.png',
      imageAlt: 'Palmetto Plaza — centro comercial, sede del evento'
    },
    {
      name: 'Ghost Specialty Coffee',
      instagramUrl: 'https://www.instagram.com/ghost_specialty_coffee/',
      instagramHandle: '@ghost_specialty_coffee'
    },
    {
      name: 'Medium Café',
      instagramUrl: 'https://www.instagram.com/medium_cafe/',
      instagramHandle: '@medium_cafe'
    },
    {
      name: 'Elixir Café'
    },
    {
      name: 'Black Coffee Design & Souvenirs'
    }
  ]
};
