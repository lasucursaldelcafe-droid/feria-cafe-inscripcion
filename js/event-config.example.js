/** Copia a event-config.js y ajusta contacto / URLs públicas. */
window.EVENT_CONFIG = {
  siteUrl: 'https://la-sucursal-del-cafe.web.app',
  brandName: 'La Sucursal del Café',
  contact: {
    email: 'tu-correo@gmail.com',
    whatsapp: '573116699638',
    whatsappDisplay: '+57 311 669 9638'
  },
  /** Copia alerts.email en ORGANIZER_EMAIL de tools/google-apps-script/Code.gs */
  alerts: {
    email: 'tu-correo@gmail.com'
  },
  circuito: {
    preliminaresTotal: 2,
    preliminarActual: 2,
    principal: {
      fecha: '29 y 30 de agosto de 2026',
      fechaCorta: '29–30 ago 2026',
      fechaIso: '2026-08-29',
      sede: 'Palmetto Plaza',
      ciudad: 'Cali'
    }
  },
  tiemposRonda: {
    preparacionMin: 5,
    preparacionLabel: '5 min',
    competenciaMin: 6,
    competenciaLabel: '6 min',
    catacionMin: 5,
    catacionLabel: '5 min'
  },
  torneoActivo: 'evento2',
  evento1: {
    estado: 'realizada',
    eventoId: 'V60 Championship — Preliminar 1',
    nombre: 'V60 Championship — Preliminar 1',
    preliminar: '1.ª de 2 preliminares',
    fecha: 'Por confirmar',
    fechaCorta: 'Por confirmar',
    horaInicio: '5:30 p. m.',
    sede: 'Por confirmar',
    ciudad: 'Cali',
    whatsappGrupoUrl: 'https://chat.whatsapp.com/GUFGVoaP8X81zWbBjZfIW9',
    whatsappGrupoNombre: 'V60 Championship — competidores'
  },
  evento2: {
    estado: 'activa',
    eventoId: 'V60 Championship — Preliminar 2',
    nombre: 'V60 Championship — Preliminar 2',
    preliminar: '2.ª de 2 preliminares',
    fecha: 'Por confirmar',
    fechaCorta: 'Por confirmar',
    horaInicio: '5:30 p. m.',
    sede: 'Por confirmar',
    ciudad: 'Cali',
    whatsappGrupoUrl: 'https://chat.whatsapp.com/GUFGVoaP8X81zWbBjZfIW9',
    whatsappGrupoNombre: 'V60 Championship — competidores'
  },
  pago: {
    monto: 90000,
    moneda: 'COP',
    metodo: 'Nubank (@mbl616) — Manuel Barraza'
  },
  cupoCompetencia: 36
};
