/**
 * Configuración pública del evento — editable sin tocar cada HTML.
 * Feria y Switch Championship son organizados por el mismo equipo,
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
    instagram: '@lasucursaldelcafe_festival',
    instagramUrl: 'https://www.instagram.com/lasucursaldelcafe_festival',
    mensaje:
      'Dos días para descubrir, probar y conectar con la comunidad cafetera de Cali. La feria no tiene precio de ingreso. El registro como visitante es opcional; si te registras, participas por premios exclusivos para visitantes registrados.',
    modal: {
      eyebrow: 'Entrada sin costo · Registro opcional',
      title: 'Registro de visitante (opcional)',
      cta: 'Registrarme como visitante',
      dismiss: 'Explorar primero',
      note: '¿Compites en café filtrado? Eso es aparte: inscripción de pago al Switch Championship.'
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
        'Este registro es solo para asistir a la feria como visitante. No es la inscripción al Switch Championship (competencia de pago, formulario aparte).'
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
      'Organizado por el mismo equipo de La Sucursal del Café. El registro de visitante en la feria es independiente de la inscripción al Switch Championship.'
  },
  circuito: {
    clasificatoriasTotal: 3,
    clasificatoriaActual: 1,
    resumen:
      'Tres competencias clasificatorias antes de la gran final. En cada una compites por cupo a la competencia principal, reconocimientos de patrocinadores y experiencia de fogueo bajo presión real.',
    motivoClasificatorias:
      'Las clasificatorias son tu escenario de práctica oficial: mismo formato, mismos jueces, misma exigencia que la competencia principal. Ganas confianza, cupos y experiencia para llegar más fuerte a la final.',
    cupoDirecto:
      'También puedes inscribirte con cupo directo a la competencia principal — la cita donde se disputan los premios más importantes, incluido el viaje a World of Coffee Panamá.',
    principal: {
      nombre: 'Competencia principal — La Sucursal del Café',
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
    nombre: 'Switch Championship — Evento 1',
    clasificatoria: '1.ª de 3 clasificatorias',
    fecha: '4 de julio de 2026',
    fechaCorta: '4 jul 2026',
    fechaIso: '2026-07-04',
    sede: 'Plaza Marbella',
    ciudad: 'Centro Comercial (Curis)',
    mapsQuery: 'Plaza Marbella Curis Cali',
    horario: [
      { hora: '08:00', actividad: 'Registro, entrega de café de ronda y sorteo de método (dados)' },
      { hora: '09:00', actividad: 'Ronda clasificatoria — estaciones en competencia' },
      { hora: '12:00', actividad: 'Pausa / catación clasificatoria (estimado)' },
      { hora: '14:00', actividad: 'Semifinal (si aplica el cronograma del día)' },
      { hora: '16:00', actividad: 'Final y premiación (sujeto a avance de rondas)' }
    ],
    horarioNota: 'Horario referencial; el juez principal confirmará tiempos exactos el día del evento.',
    whatsappGrupoUrl: 'https://chat.whatsapp.com/GUFGVoaP8X81zWbBjZfIW9',
    whatsappGrupoNombre: 'Switch Championship — competidores'
  },
  pago: {
    monto: 90000,
    moneda: 'COP',
    metodo: 'Nubank (@mvl616) — Manuel Barraza',
    nubank: '@mvl616',
    titular: 'Manuel Barraza'
  },
  proximosEventos: [
    { num: 2, estado: 'Por confirmar', fecha: 'Por anunciar', sede: 'Por anunciar' },
    { num: 3, estado: 'Por confirmar', fecha: 'Por anunciar', sede: 'Por anunciar' }
  ],
  cupoCompetencia: 36
};
