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
    preliminarActual: 1,
    principal: {
      fecha: '29 y 30 de agosto de 2026',
      fechaCorta: '29–30 ago 2026',
      fechaIso: '2026-08-29',
      sede: 'Palmetto Plaza',
      ciudad: 'Cali'
    }
  },
  evento1: {
    nombre: 'V60 Championship — Preliminar 1',
    preliminar: '1.ª de 2 preliminares',
    fecha: 'Por confirmar',
    fechaCorta: 'Por confirmar',
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
