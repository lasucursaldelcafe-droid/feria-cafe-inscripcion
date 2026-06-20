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
      'Dos días para descubrir, probar y conectar con la comunidad cafetera de Cali. Productores, tostadores y baristas comparten lo mejor del café colombiano — y tú puedes ser parte.',
    modal: {
      eyebrow: 'Cupos limitados · Entrada gratis',
      title: '¡Reserva tu lugar en la feria!',
      cta: 'Quiero inscribirme',
      dismiss: 'Explorar primero',
      note: '¿Compites en café filtrado? También puedes inscribirte al Switch Championship (evento aparte).'
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
    notaIndependencia:
      'Organizado por el mismo equipo de La Sucursal del Café. La inscripción a la feria es independiente de la del Switch Championship.'
  },
  evento1: {
    nombre: 'Switch Championship — Evento 1',
    clasificatoria: '1.ª de 3 clasificatorias',
    fecha: '4 de julio de 2026',
    fechaCorta: '4 jul 2026',
    fechaIso: '2026-07-04',
    sede: 'Purist Marbella',
    ciudad: 'Ciudad Jardín',
    mapsQuery: '',
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
