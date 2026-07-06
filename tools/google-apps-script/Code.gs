// Web App de Google Apps Script - La Sucursal del Cafe
// IMPORTANTE: pega ESTE ARCHIVO COMPLETO en el editor (borra todo lo anterior).
// Tras guardar sin errores: ejecutar sincronizarEncabezados() y Nueva implementacion Web App.
// Recibe inscripciones JSON y las guarda en hojas Feria, Competencia, Stands y Lista de espera.
// Tras cada inscripcion valida envia confirmacion al participante y alerta a ORGANIZER_EMAIL.
// Redespliega la Web App tras editar este archivo (Implementar > Nueva implementacion).

var SHEET_FERIA = 'Feria';
var SHEET_COMPETENCIA = 'Competencia';
var SHEET_STANDS = 'Stands';
var SHEET_LISTA_ESPERA = 'Lista de espera';
var SHEET_ANALYTICS = 'Analytics';
var SHEET_NOVEDADES = 'Novedades';
var EXPOSITOR_PANEL_PATH = '/mi-stand';

var HEADERS_ANALYTICS = [
  'Timestamp', 'Path', 'Titulo', 'Referrer', 'Session ID', 'User agent'
];
var CUPO_MAX_COMPETENCIA = 36;
/** Evento activo para cupo, duplicados e inscripciones nuevas (Preliminar 2). */
var ACTIVE_COMPETENCIA_EVENTO = 'V60 Championship — Preliminar 2';
/** Fecha y sede oficiales — Preliminar 2 */
var PRELIMINAR2_FECHA = '8 de agosto de 2026';
var PRELIMINAR2_LUGAR = 'Mas Café, Cali';
var COMPROBANTE_PREVIEW_MAX = 1000;
var DRIVE_FOLDER_NAME = 'V60 Championship — Comprobantes';
var DRIVE_FOTOS_FOLDER_NAME = 'V60 Championship — Fotos participantes';
var DRIVE_LOGOS_STANDS_FOLDER_NAME = 'Feria — Logos expositores';
var DRIVE_GALERIA_EXPOSITORES_FOLDER = 'Feria — Galería expositores';
var DRIVE_JUDGES_FOLDER_NAME = 'Jurado — Fotos jueces';
// Correo(s) del equipo para alertas de nueva inscripcion (separar con coma si son varios).
var ORGANIZER_EMAIL = 'lasucursaldelcafe@gmail.com';
var WHATSAPP_GRUPO_COMPETENCIA = 'https://chat.whatsapp.com/GUFGVoaP8X81zWbBjZfIW9';
var WHATSAPP_ORGANIZADOR = '573116699638';
// WhatsApp automático: Apps Script no tiene WhatsApp Business API (Meta) configurada.
// El participante recibe enlaces chat.whatsapp.com (grupo) y wa.me (organizador) en el correo.

var HEADERS_FERIA = [
  'Fecha registro', 'ID', 'Nombre', 'Edad', 'Celular', 'Correo', 'Intereses',
  'Acepta voluntaria', 'Acepta pertenencias', 'Acepta datos', 'Acepta imagen',
  'Estado registro', 'Habilitado', 'Pasaporte ID', 'Notas admin'
];

var HEADERS_COMPETENCIA = [
  'Fecha registro', 'ID', 'Evento', 'Valor inscripción', 'Nombre', 'Documento', 'Edad',
  'Ciudad', 'Celular', 'Correo',
  'Foto participante nombre', 'Foto participante tipo', 'Foto participante enlace Drive',
  'Representa', 'Rol', 'Experiencia café', 'Experiencia Switch',
  'Torneos previos', 'Equipo Switch', 'Equipo gramera', 'Equipo tetera',
  'Dirección envío', 'Ciudad envío', 'Departamento', 'Código postal', 'Receptor', 'Instrucciones envío',
  'Método pago', 'Referencia pago', 'Tiene comprobante', 'Comprobante nombre', 'Comprobante tipo',
  'Comprobante enlace Drive', 'Comprobante base64 (preview)',
  'Acepta voluntaria', 'Acepta pertenencias', 'Acepta datos', 'Acepta no reembolso',
  'Acepta descalificación', 'Acepta reglas', 'Acepta disponibilidad', 'Acepta imagen',
  'Observaciones', 'Estado pago', 'Cupo confirmado', 'Habilitado', 'Notas admin'
];

var HEADERS_COMP_EVENTO = [
  'Fecha registro', 'ID', 'Nombre', 'Documento', 'Edad', 'Celular', 'Correo',
  'Ciudad', 'Representa', 'Rol', 'Experiencia café', 'Observaciones',
  'Acepta datos', 'Acepta reglas', 'Habilitado', 'Notas admin'
];

var HEADERS_STANDS = [
  'Fecha registro', 'ID', 'Stand ID', 'Marca o negocio', 'Persona contacto', 'Celular', 'Correo',
  'Plan stand', 'Ciudad', 'Descripción exhibición',
  'Tipo participante', 'Red social preferida', 'Red social enlace', 'Logos directorio (JSON)', 'Visible directorio público',
  'Logo nombre', 'Logo tipo', 'Logo enlace Drive',
  'Comparte stand', 'Marcas adicionales (JSON)',
  'Acepta voluntaria', 'Acepta pertenencias', 'Acepta datos', 'Acepta imagen',
  'Estado solicitud', 'Habilitado', 'Notas admin', 'Perfil emprendimiento (JSON)', 'Código acceso (hash)'
];

var HEADERS_NOVEDADES = [
  'Timestamp', 'Titulo', 'Cuerpo', 'Audiencia'
];

var HEADERS_LISTA_ESPERA = [
  'Fecha registro', 'ID', 'Formulario', 'Nombre', 'Documento', 'Correo', 'Celular', 'Motivo', 'Notas admin'
];

var SHEET_PATROCINADORES_COMPETENCIA = 'Patrocinadores competencia';
var HEADERS_PATROCINADORES_COMPETENCIA = [
  'ID', 'Nombre', 'Instagram handle', 'Red social enlace', 'Logo enlace', 'Habilitado', 'Orden', 'Notas admin'
];
var SHEET_PASAPORTES = 'Pasaportes';
var SHEET_PASAPORTE_TX = 'Pasaporte transacciones';
var SHEET_PASAPORTE_OPS = 'Pasaporte operadores';
var SHEET_PASAPORTE_ESCANEOS = 'Pasaporte escaneos';
var HEADERS_PASAPORTES = [
  'Fecha registro', 'ID', 'Nombre', 'Teléfono', 'Correo', 'Puntos', 'Puntos históricos', 'Nivel', 'Activo', 'Origen'
];
var HEADERS_PASAPORTE_TX = [
  'Fecha', 'ID', 'Cliente ID', 'Tipo', 'Puntos', 'Descripción', 'Sede', 'Operador ID'
];
var HEADERS_PASAPORTE_OPS = [
  'Fecha creación', 'ID', 'Stand nombre', 'Usuario', 'PIN hash', 'Puntos por escaneo', 'Activo'
];
var HEADERS_PASAPORTE_ESCANEOS = [
  'Fecha', 'ID escaneo', 'Operador ID', 'Cliente ID', 'Stand nombre', 'Puntos', 'Día'
];
var SHEET_JURADO_V60 = 'Jurado V60';
var JURADO_V60_PIN_DEFAULT = 'v60sensorial';
var JURADO_V60_CRITERIA = ['Aroma', 'Dulzor', 'Acidez', 'Sabor', 'Balance', 'Cuerpo', 'Limpieza taza'];
var HEADERS_JURADO_V60 = [
  'Fecha actualización', 'Competidor ID', 'Nombre',
  'J1 Aroma', 'J1 Dulzor', 'J1 Acidez', 'J1 Sabor', 'J1 Balance', 'J1 Cuerpo', 'J1 Limpieza taza', 'J1 Subtotal',
  'J2 Aroma', 'J2 Dulzor', 'J2 Acidez', 'J2 Sabor', 'J2 Balance', 'J2 Cuerpo', 'J2 Limpieza taza', 'J2 Subtotal',
  'J3 Aroma', 'J3 Dulzor', 'J3 Acidez', 'J3 Sabor', 'J3 Balance', 'J3 Cuerpo', 'J3 Limpieza taza', 'J3 Subtotal',
  'Suma total', 'Promedio jueces', 'Notas'
];
var SITE_PUBLIC_BASE_URL = 'https://la-sucursal-del-cafe.web.app';
var PASAPORTE_REGISTRO_PATH = '/registro-fidelizacion';
var PASAPORTE_ESCANER_PATH = '/escanear-pasaporte';

function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  if (params.action === 'cupo') {
    var count = getCompetenciaCount_();
    return jsonResponse({
      ok: true,
      formType: 'competencia',
      count: count,
      max: CUPO_MAX_COMPETENCIA,
      disponibles: Math.max(0, CUPO_MAX_COMPETENCIA - count),
      completo: count >= CUPO_MAX_COMPETENCIA
    });
  }
  if (params.action === 'stands_map') {
    return jsonResponse(getStandsMapData_());
  }
  if (params.action === 'admin_dashboard') {
    return handleAdminDashboard_(params.idToken || '');
  }
  if (params.action === 'admin_export') {
    return handleAdminExport_(params.idToken || '', params.dataset || '');
  }
  if (params.action === 'competidor_foto') {
    var fotoBlob = serveCompetidorFoto_(params.id || params.fileId || params.url || '');
    if (fotoBlob) return fotoBlob;
    return jsonResponse({ ok: false, error: 'No se pudo servir la foto del competidor.' });
  }
  if (params.action === 'competidor_foto_data') {
    return jsonResponse(getCompetidorFotoData_(params.id || params.fileId || params.url || ''));
  }
  if (params.action === 'expositor_feed') {
    return jsonResponse(getExpositorFeed_());
  }
  if (params.action === 'feria_resumen') {
    return jsonResponse(getFeriaResumen_());
  }
  if (params.action === 'participantes_publico') {
    return jsonResponse(getParticipantesPublico_());
  }
  if (params.action === 'participante_publico') {
    return jsonResponse(getParticipantePublicoById_(params.id || ''));
  }
  if (params.action === 'patrocinadores_competencia_publico') {
    return jsonResponse(getPatrocinadoresCompetenciaPublico_());
  }
  if (params.action === 'pasaporte_get') {
    return jsonResponse(getPasaporteCliente_(params.id || ''));
  }
  if (params.action === 'pasaporte_list') {
    return jsonResponse(listPasaportesAdmin_(parseInt(params.limit, 10) || 50));
  }
  if (params.action === 'pasaporte_tx') {
    return jsonResponse(listPasaporteTransacciones_(params.clienteId || '', parseInt(params.limit, 10) || 20));
  }
  if (params.action === 'pasaporte_ops') {
    return jsonResponse(listPasaporteOperadores_());
  }
  if (params.action === 'pasaporte_config') {
    return jsonResponse(getPasaporteConfig_(params.key || 'niveles'));
  }
  if (params.action === 'jurado_competidores') {
    return jsonResponse(handleJuradoCompetidoresGet_(params.pin || '', params.evt || ''));
  }
  if (params.action === 'jurado_calificaciones') {
    return jsonResponse(handleJuradoCalificacionesGet_(params.pin || '', params.competidorId || '', params.evt || ''));
  }
  if (params.action === 'jurado_instances') {
    return jsonResponse(listJuradoInstances_());
  }
  if (params.action === 'competencia_torneo_form') {
    return jsonResponse(handleCompetenciaTorneoFormGet_(params.evt || ''));
  }
  if (params.action === 'competencia_torneo_inscripciones') {
    return jsonResponse(handleCompetenciaTorneoInscripcionesGet_(
      params.evt || '',
      params.pin || ''
    ));
  }
  return jsonResponse({
    ok: true,
    message: 'API de inscripciones — La Sucursal del Café',
    forms: [
      'feria', 'competencia', 'stands', 'lista_espera', 'participantes_publico',
      'patrocinadores_competencia_publico', 'admin', 'analytics', 'pasaportes', 'jurado_v60'
    ],
    pasaportesBackend: true,
    juradoV60Backend: true
  });
}

function doOptions() {
  return jsonResponse({ ok: true, message: 'CORS preflight' });
}

function doPost(e) {
  try {
    var payload = parsePayload_(e);
    var action = String(payload.action || '').toLowerCase();

    if (action === 'admin_login') {
      return jsonResponse({
        ok: false,
        error: 'Login con contraseña deshabilitado. Usa Google Sign-In en /admin.'
      }, 410);
    }
    if (action === 'pageview') {
      return trackPageview_(payload);
    }
    if (action === 'admin_logout') {
      return jsonResponse({ ok: true, message: 'Sesión gestionada por Firebase Auth en el cliente.' });
    }
    if (action === 'expositor_login') {
      return jsonResponse(handleExpositorLogin_(payload.email || '', payload.accessCode || ''));
    }
    if (action === 'admin_patch_stand') {
      return jsonResponse(handleAdminPatchStand_(payload));
    }
    if (action === 'admin_toggle_status') {
      return jsonResponse(handleAdminToggleStatus_(payload));
    }
    if (action === 'admin_toggle_patrocinador_competencia') {
      return jsonResponse(handleAdminTogglePatrocinadorCompetencia_(payload));
    }
    if (action === 'admin_save_patrocinador_competencia') {
      return jsonResponse(handleAdminSavePatrocinadorCompetencia_(payload));
    }
    if (action === 'admin_create_stand') {
      return jsonResponse(handleAdminCreateStand_(payload));
    }
    if (action === 'admin_create_competitor') {
      return jsonResponse(handleAdminCreateCompetitor_(payload));
    }
    if (action === 'competidor_foto_data') {
      return jsonResponse(getCompetidorFotoData_(payload.id || payload.fileId || payload.url || ''));
    }
    if (action === 'admin_create_feria') {
      return jsonResponse(handleAdminCreateFeria_(payload));
    }
    if (action === 'pasaporte_create') {
      return jsonResponse(handlePasaporteCreate_(payload));
    }
    if (action === 'pasaporte_login') {
      return jsonResponse(handlePasaporteLogin_(payload));
    }
    if (action === 'pasaporte_transaccion') {
      return jsonResponse(handlePasaporteTransaccion_(payload));
    }
    if (action === 'pasaporte_operador_create') {
      return jsonResponse(handlePasaporteOperadorCreate_(payload));
    }
    if (action === 'pasaporte_operador_verify') {
      return jsonResponse(handlePasaporteOperadorVerify_(payload));
    }
    if (action === 'pasaporte_operador_toggle') {
      return jsonResponse(handlePasaporteOperadorToggle_(payload));
    }
    if (action === 'pasaporte_escaneo') {
      return jsonResponse(handlePasaporteEscaneo_(payload));
    }
    if (action === 'pasaporte_config_save') {
      return jsonResponse(savePasaporteConfig_(payload));
    }
    if (action === 'jurado_instance_create') {
      return jsonResponse(handleJuradoInstanceCreate_(payload));
    }
    if (action === 'jurado_resultados_login') {
      return jsonResponse(handleJuradoResultadosLogin_(payload));
    }
    if (action === 'competencia_torneo_inscripcion') {
      return jsonResponse(handleCompetenciaTorneoInscripcion_(payload));
    }
    if (action === 'jurado_guardar') {
      return jsonResponse(handleJuradoGuardar_(payload));
    }
    if (action === 'jurado_juez_profile_save') {
      return jsonResponse(handleJuradoJuezProfileSave_(payload));
    }
    if (action === 'jurado_publish_resultados') {
      return jsonResponse(handleJuradoPublishResultados_(payload));
    }
    if (action === 'expositor_update_profile') {
      return jsonResponse(handleExpositorUpdateProfile_(payload));
    }

    var formType = String(payload.formType || '').toLowerCase();
    var data = payload.data || payload;
    var id = '';

    var extra = {};
    if (formType === 'feria') {
      id = appendFeria_(data);
      extra.pasaporteUrl = getPasaporteUrl_(data);
    } else if (formType === 'competencia') {
      var competenciaResult = appendCompetencia_(data);
      id = competenciaResult.id;
      extra.whatsappGrupoUrl = WHATSAPP_GRUPO_COMPETENCIA;
      extra.fotoEnlace = competenciaResult.fotoEnlace || '';
    } else if (formType === 'stands') {
      var standsResult = appendStands_(data);
      id = standsResult.id;
      extra.logoEnlace = standsResult.logoEnlace || '';
      extra.logos = standsResult.logos || [];
      extra.accessCode = standsResult.accessCode || '';
      extra.expositorPanelUrl = standsResult.expositorPanelUrl || '';
    } else if (formType === 'lista_espera') {
      id = appendListaEspera_(data);
    } else {
      return jsonResponse({ ok: false, error: 'formType inválido.' }, 400);
    }

    var response = { ok: true, formType: formType, id: id || data.id || '' };
    Object.keys(extra).forEach(function (key) {
      response[key] = extra[key];
    });
    return jsonResponse(response);
  } catch (err) {
    var msg = String(err.message || err);
    var body = { ok: false, error: msg };
    if (msg.indexOf('Cupo completo') !== -1) body.cupoCompleto = true;
    if (msg.indexOf('Ya existe') !== -1) body.duplicate = true;
    if (msg.indexOf('ya está ocupado') !== -1) body.standOcupado = true;
    return jsonResponse(body, 400);
  }
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Cuerpo de solicitud vacío.');
  }
  return JSON.parse(e.postData.contents);
}

function getOrCreateSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    applyHeaders_(sheet, headers);
  }
  return sheet;
}

// Escribe encabezados en fila 1 (crea columnas si faltan). Ejecutar una vez desde el editor.
function sincronizarEncabezados() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  applyHeaders_(getOrCreateSheet_(SHEET_FERIA, HEADERS_FERIA), HEADERS_FERIA);
  applyHeaders_(getOrCreateSheet_(SHEET_COMPETENCIA, HEADERS_COMPETENCIA), HEADERS_COMPETENCIA);
  applyHeaders_(getOrCreateSheet_(SHEET_STANDS, HEADERS_STANDS), HEADERS_STANDS);
  applyHeaders_(getOrCreateSheet_(SHEET_LISTA_ESPERA, HEADERS_LISTA_ESPERA), HEADERS_LISTA_ESPERA);
  applyHeaders_(getOrCreateSheet_(SHEET_ANALYTICS, HEADERS_ANALYTICS), HEADERS_ANALYTICS);
  applyHeaders_(getOrCreateSheet_(SHEET_NOVEDADES, HEADERS_NOVEDADES), HEADERS_NOVEDADES);
  applyHeaders_(
    getOrCreateSheet_(SHEET_PATROCINADORES_COMPETENCIA, HEADERS_PATROCINADORES_COMPETENCIA),
    HEADERS_PATROCINADORES_COMPETENCIA
  );
  applyHeaders_(getOrCreateSheet_(SHEET_PASAPORTES, HEADERS_PASAPORTES), HEADERS_PASAPORTES);
  applyHeaders_(getOrCreateSheet_(SHEET_PASAPORTE_TX, HEADERS_PASAPORTE_TX), HEADERS_PASAPORTE_TX);
  applyHeaders_(getOrCreateSheet_(SHEET_PASAPORTE_OPS, HEADERS_PASAPORTE_OPS), HEADERS_PASAPORTE_OPS);
  applyHeaders_(getOrCreateSheet_(SHEET_PASAPORTE_ESCANEOS, HEADERS_PASAPORTE_ESCANEOS), HEADERS_PASAPORTE_ESCANEOS);
  applyHeaders_(getOrCreateSheet_(SHEET_JURADO_V60, HEADERS_JURADO_V60), HEADERS_JURADO_V60);
  ensureDefaultPatrocinadoresCompetencia_();
  Logger.log(
    'Encabezados sincronizados: Feria, Competencia, Stands, Lista de espera, Analytics, Novedades, Patrocinadores, Pasaportes, Jurado V60.'
  );
}

function applyHeaders_(sheet, headers) {
  var neededCols = headers.length;
  var currentCols = sheet.getMaxColumns();
  if (currentCols < neededCols) {
    sheet.insertColumnsAfter(currentCols, neededCols - currentCols);
  }
  sheet.getRange(1, 1, 1, neededCols).setValues([headers]);
  sheet.getRange(1, 1, 1, neededCols).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function normalizeEmail_(v) {
  return String(v || '').trim().toLowerCase();
}

function normalizeDoc_(v) {
  return String(v || '').replace(/\D/g, '');
}

function findDuplicateInSheet_(sheet, headers, correo, documento) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  var correoCol = headers.indexOf('Correo') + 1;
  var docCol = headers.indexOf('Documento') + 1;
  var emailNorm = normalizeEmail_(correo);
  var docNorm = documento ? normalizeDoc_(documento) : '';

  if (emailNorm && correoCol > 0) {
    var emails = sheet.getRange(2, correoCol, lastRow - 1, 1).getValues();
    for (var i = 0; i < emails.length; i++) {
      if (normalizeEmail_(emails[i][0]) === emailNorm) return true;
    }
  }

  if (docNorm && docCol > 0) {
    var docs = sheet.getRange(2, docCol, lastRow - 1, 1).getValues();
    for (var j = 0; j < docs.length; j++) {
      if (normalizeDoc_(docs[j][0]) === docNorm) return true;
    }
  }
  return false;
}

function normalizeCompetenciaEvento_(evento) {
  return String(evento || '').trim();
}

function extractCompetenciaPreliminarKey_(evento) {
  var s = normalizeCompetenciaEvento_(evento);
  if (!s) return '';
  if (/preliminar\s*2/i.test(s) || /evento\s*2/i.test(s) || /2\.ª/i.test(s)) return 'V60 Championship — Preliminar 2';
  if (/preliminar\s*1/i.test(s) || /evento\s*1/i.test(s) || /1\.ª/i.test(s)) return 'V60 Championship — Preliminar 1';
  if (s === 'V60 Championship') return 'V60 Championship — Preliminar 1';
  return s;
}

function isSameCompetenciaEvento_(rowEvento, targetEvento) {
  var rowKey = extractCompetenciaPreliminarKey_(rowEvento);
  var targetKey = extractCompetenciaPreliminarKey_(targetEvento || ACTIVE_COMPETENCIA_EVENTO);
  return !!rowKey && rowKey === targetKey;
}

function findDuplicateCompetenciaInEvent_(sheet, headers, correo, documento, evento) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  var eventoCol = headers.indexOf('Evento') + 1;
  var correoCol = headers.indexOf('Correo') + 1;
  var docCol = headers.indexOf('Documento') + 1;
  var emailNorm = normalizeEmail_(correo);
  var docNorm = documento ? normalizeDoc_(documento) : '';
  var targetEvento = normalizeCompetenciaEvento_(evento || ACTIVE_COMPETENCIA_EVENTO);
  var values = sheet.getRange(2, 1, lastRow, headers.length).getValues();

  for (var i = 0; i < values.length; i++) {
    var rowEvento = eventoCol > 0 ? values[i][eventoCol - 1] : '';
    if (!isSameCompetenciaEvento_(rowEvento, targetEvento)) continue;
    if (emailNorm && correoCol > 0 && normalizeEmail_(values[i][correoCol - 1]) === emailNorm) return true;
    if (docNorm && docCol > 0 && normalizeDoc_(values[i][docCol - 1]) === docNorm) return true;
  }
  return false;
}

function getCompetenciaCount_(evento) {
  var sheet = getOrCreateSheet_(SHEET_COMPETENCIA, HEADERS_COMPETENCIA);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  var targetEvento = normalizeCompetenciaEvento_(evento || ACTIVE_COMPETENCIA_EVENTO);
  var eventoCol = HEADERS_COMPETENCIA.indexOf('Evento') + 1;
  if (eventoCol <= 0) return lastRow - 1;

  var values = sheet.getRange(2, eventoCol, lastRow, 1).getValues();
  var count = 0;
  for (var i = 0; i < values.length; i++) {
    if (isSameCompetenciaEvento_(values[i][0], targetEvento)) count++;
  }
  return count;
}

/** Une columnas base + legales + cola (sin .concat anidado dentro de appendRow). */
function joinRowParts_(baseCols, legalCols, tailCols) {
  var row = [];
  var groups = [baseCols, legalCols, tailCols];
  for (var g = 0; g < groups.length; g++) {
    var part = groups[g] || [];
    for (var i = 0; i < part.length; i++) {
      row.push(part[i]);
    }
  }
  return row;
}

function appendFeria_(data) {
  var sheet = getOrCreateSheet_(SHEET_FERIA, HEADERS_FERIA);
  if (findDuplicateInSheet_(sheet, HEADERS_FERIA, data.correo, null)) {
    throw new Error('Ya existe una inscripción de feria con este correo.');
  }

  var intereses = Array.isArray(data.intereses) ? data.intereses.join('; ') : String(data.intereses || '');
  var legalCols = parseFeriaLegalAcceptances_(data);
  var row = joinRowParts_([
    data.fecha || new Date().toISOString(),
    data.id || '',
    data.nombre || '',
    data.edad || '',
    data.celular || '',
    data.correo || '',
    intereses
  ], legalCols, ['Registrado', 'Sí', data.pasaporteId || '', '']);
  sheet.appendRow(row);

  sendConfirmationEmail_('feria', data);
  sendOrganizerNotificationEmail_('feria', data);
  return data.id || '';
}

function getPasaporteRegistroUrl_(data) {
  var base = SITE_PUBLIC_BASE_URL + PASAPORTE_REGISTRO_PATH;
  var params = [];
  if (data && data.nombre) params.push('nombre=' + encodeURIComponent(String(data.nombre)));
  var tel = (data && (data.celular || data.telefono)) || '';
  if (tel) params.push('telefono=' + encodeURIComponent(String(tel)));
  if (data && data.correo) params.push('email=' + encodeURIComponent(String(data.correo)));
  return params.length ? base + '?' + params.join('&') : base;
}

function getPasaporteEscanerUrl_() {
  return SITE_PUBLIC_BASE_URL + PASAPORTE_ESCANER_PATH;
}

function getPasaporteUrl_(data) {
  if (data && data.pasaporteId) {
    return SITE_PUBLIC_BASE_URL + '/pasaporte?id=' + encodeURIComponent(String(data.pasaporteId));
  }
  return getPasaporteRegistroUrl_(data);
}

function normalizeStandId_(v) {
  return String(v || '').trim().toUpperCase();
}

function generateAccessCode_() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  for (var i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function hashAccessCode_(code) {
  var normalized = String(code || '').trim().toUpperCase();
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    normalized,
    Utilities.Charset.UTF_8
  );
  return Utilities.base64Encode(digest);
}

function getExpositorPanelUrl_() {
  var props = PropertiesService.getScriptProperties();
  var base = String(props.getProperty('SITE_URL') || 'https://la-sucursal-del-cafe.web.app').replace(/\/$/, '');
  return base + EXPOSITOR_PANEL_PATH;
}

function findExpositorRowByCredentials_(email, accessCode) {
  var emailNorm = normalizeEmail_(email);
  var codeHash = hashAccessCode_(accessCode);
  if (!emailNorm || !String(accessCode || '').trim()) return null;

  var sheet = getOrCreateSheet_(SHEET_STANDS, HEADERS_STANDS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  var correoCol = HEADERS_STANDS.indexOf('Correo') + 1;
  var hashCol = HEADERS_STANDS.indexOf('Código acceso (hash)') + 1;
  if (correoCol <= 0 || hashCol <= 0) return null;

  var numRows = lastRow - 1;
  var correoVals = sheet.getRange(2, correoCol, lastRow, correoCol).getValues();
  var hashVals = sheet.getRange(2, hashCol, lastRow, hashCol).getValues();

  for (var i = 0; i < correoVals.length; i++) {
    if (normalizeEmail_(correoVals[i][0]) !== emailNorm) continue;
    if (String(hashVals[i][0] || '') !== codeHash) continue;
    return 2 + i;
  }
  return null;
}

function standRowToExpositorData_(sheet, rowNum) {
  var values = sheet.getRange(rowNum, 1, rowNum, HEADERS_STANDS.length).getValues()[0];
  var row = rowObjectFromValues_(HEADERS_STANDS, values);
  var perfil = parsePerfilEmprendimientoJson_(row['Perfil emprendimiento (JSON)']);
  var recordId = row['ID'] || '';
  return {
    id: recordId,
    fecha: row['Fecha registro'] || '',
    standId: row['Stand ID'] || '',
    marca: row['Marca o negocio'] || '',
    contacto: row['Persona contacto'] || '',
    celular: row['Celular'] || '',
    correo: row['Correo'] || '',
    plan: row['Plan stand'] || '',
    ciudad: row['Ciudad'] || '',
    descripcion: row['Descripción exhibición'] || '',
    logoEnlace: row['Logo enlace Drive'] || '',
    redSocial: row['Red social preferida'] || '',
    redUrl: row['Red social enlace'] || '',
    comparteStand: row['Comparte stand'] || 'No',
    marcasAdicionales: parseMarcasAdicionalesJson_(row['Marcas adicionales (JSON)']),
    logos: buildStandLogosFromRow_(
      row['Marca o negocio'],
      row['Logo enlace Drive'],
      row['Marcas adicionales (JSON)']
    ),
    estado: row['Estado solicitud'] || '',
    perfil: perfil,
    perfilUrl: getPublicMarcaUrl_(recordId),
    visiblePublico: isVisiblePublico_(row['Visible directorio público'])
  };
}

function handleExpositorLogin_(email, accessCode) {
  var rowNum = findExpositorRowByCredentials_(email, accessCode);
  if (!rowNum) {
    return { ok: false, error: 'Correo o código de acceso incorrectos.' };
  }
  var sheet = getOrCreateSheet_(SHEET_STANDS, HEADERS_STANDS);
  return {
    ok: true,
    stand: standRowToExpositorData_(sheet, rowNum)
  };
}

function getExpositorFeed_() {
  var sheet = getOrCreateSheet_(SHEET_NOVEDADES, HEADERS_NOVEDADES);
  var lastRow = sheet.getLastRow();
  var items = [];
  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow, HEADERS_NOVEDADES.length).getValues();
    for (var i = values.length - 1; i >= 0; i--) {
      var row = rowObjectFromValues_(HEADERS_NOVEDADES, values[i]);
      var audiencia = String(row['Audiencia'] || 'todos').trim().toLowerCase();
      if (audiencia !== 'todos' && audiencia !== 'expositores') continue;
      items.push({
        timestamp: row['Timestamp'] || '',
        titulo: row['Titulo'] || '',
        cuerpo: row['Cuerpo'] || '',
        audiencia: audiencia || 'todos'
      });
    }
  }
  return { ok: true, items: items };
}

function extractDriveFileId_(raw) {
  var value = String(raw || '').trim();
  if (!value) return '';
  var match = value.match(/\/file\/d\/([^/]+)/) || value.match(/[?&]id=([^&]+)/);
  if (match && match[1]) return String(match[1]).trim();
  if (/^[a-zA-Z0-9_-]{20,}$/.test(value)) return value;
  return '';
}

function getCompetidorFotoBytes_(fileId) {
  if (!fileId) return null;

  try {
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    var contentType = blob.getContentType() || 'image/jpeg';
    if (contentType.indexOf('image/') === 0) {
      return { bytes: blob.getBytes(), contentType: contentType };
    }
  } catch (driveErr) {
    // Fallback vía thumbnail público de Drive
  }

  var thumbUrl = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w1600';
  try {
    var resp = UrlFetchApp.fetch(thumbUrl, { muteHttpExceptions: true, followRedirects: true });
    if (resp.getResponseCode() === 200) {
      var thumbBlob = resp.getBlob();
      var thumbType = thumbBlob.getContentType() || 'image/jpeg';
      if (thumbType.indexOf('image/') === 0) {
        return { bytes: thumbBlob.getBytes(), contentType: thumbType };
      }
    }
  } catch (fetchErr) {
    return null;
  }

  return null;
}

function serveCompetidorFoto_(rawIdOrUrl) {
  var fileId = extractDriveFileId_(rawIdOrUrl);
  if (!fileId) return null;
  var data = getCompetidorFotoBytes_(fileId);
  if (!data || !data.bytes || !data.bytes.length) return null;
  return ContentService.createBlobOutput(data.bytes).setMimeType(data.contentType || 'image/jpeg');
}

function getCompetidorFotoData_(rawIdOrUrl) {
  var fileId = extractDriveFileId_(rawIdOrUrl);
  if (!fileId) {
    return { ok: false, error: 'ID de foto inválido.' };
  }

  var data = getCompetidorFotoBytes_(fileId);
  if (!data || !data.bytes || !data.bytes.length) {
    return {
      ok: false,
      error: 'No se pudo leer la foto desde Drive. Verifica permisos del archivo.'
    };
  }

  var contentType = data.contentType || 'image/jpeg';
  if (contentType.indexOf('image/') !== 0) {
    return { ok: false, error: 'El archivo no es una imagen.' };
  }

  var base64 = Utilities.base64Encode(data.bytes);
  return {
    ok: true,
    fileId: fileId,
    contentType: contentType,
    dataUrl: 'data:' + contentType + ';base64,' + base64
  };
}

function getFeriaResumen_() {
  var sheet = getOrCreateSheet_(SHEET_NOVEDADES, HEADERS_NOVEDADES);
  var lastRow = sheet.getLastRow();
  var novedades = [];
  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow, HEADERS_NOVEDADES.length).getValues();
    for (var i = values.length - 1; i >= 0; i--) {
      var row = rowObjectFromValues_(HEADERS_NOVEDADES, values[i]);
      var audiencia = String(row['Audiencia'] || 'todos').trim().toLowerCase();
      if (audiencia !== 'todos' && audiencia !== 'visitantes') continue;
      novedades.push({
        timestamp: row['Timestamp'] || '',
        titulo: row['Titulo'] || '',
        cuerpo: row['Cuerpo'] || ''
      });
      if (novedades.length >= 6) break;
    }
  }
  return { ok: true, novedades: novedades };
}

function findStandOccupied_(standId) {
  var id = normalizeStandId_(standId);
  if (!id) return false;
  var sheet = getOrCreateSheet_(SHEET_STANDS, HEADERS_STANDS);
  var standCol = HEADERS_STANDS.indexOf('Stand ID') + 1;
  if (standCol <= 0) return false;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var values = sheet.getRange(2, standCol, lastRow, standCol).getValues();
  for (var i = 0; i < values.length; i++) {
    if (normalizeStandId_(values[i][0]) === id) return true;
  }
  return false;
}

function parseMarcasAdicionalesJson_(raw) {
  if (!raw) return [];
  try {
    var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function tipoParticipanteFromPlan_(plan) {
  var p = String(plan || '').trim();
  if (p === 'Zona Origen') return 'expositor';
  if (p === 'Zona Gran Reserva') return 'patrocinador';
  if (p === 'Aliado Patrocinador') return 'aliado';
  return '';
}

function normalizeRedSocialEnlace_(redSocial, raw) {
  var input = String(raw || '').trim();
  if (!input) return '';
  if (/^https?:\/\//i.test(input)) return input;

  var handle = input.replace(/^@/, '');
  var social = String(redSocial || '').trim().toLowerCase();

  if (social === 'instagram') {
    return 'https://www.instagram.com/' + handle.replace(/^@/, '');
  }
  if (social === 'facebook') {
    if (handle.indexOf('facebook.com') >= 0) {
      return handle.indexOf('://') >= 0 ? handle : 'https://' + handle.replace(/^\/\//, '');
    }
    return 'https://www.facebook.com/' + handle;
  }
  if (social === 'tiktok') {
    return 'https://www.tiktok.com/@' + handle.replace(/^@/, '');
  }
  if (social === 'whatsapp') {
    var digits = handle.replace(/\D/g, '');
    return digits ? 'https://wa.me/' + digits : input;
  }
  if (social === 'web') {
    if (input.indexOf(' ') >= 0) return input;
    return input.indexOf('://') >= 0 ? input : 'https://' + input;
  }
  return input;
}

function isVisiblePublico_(val) {
  var v = String(val || '').trim().toLowerCase();
  if (!v) return true;
  return v === 'sí' || v === 'si' || v === 'yes' || v === 'true' || v === '1';
}

function isHabilitado_(val) {
  var v = String(val || '').trim().toLowerCase();
  if (!v) return true;
  return v === 'sí' || v === 'si' || v === 'yes' || v === 'true' || v === '1';
}

function logosDirectorioJsonFromRow_(marca, logoEnlace, marcasJsonRaw) {
  return JSON.stringify(buildStandLogosFromRow_(marca, logoEnlace, marcasJsonRaw));
}

function parseLogosDirectorioJson_(raw, marca, logoEnlace, marcasJsonRaw) {
  var parsed = [];
  try {
    parsed = JSON.parse(String(raw || '[]'));
  } catch (e) {
    parsed = [];
  }
  if (!Array.isArray(parsed) || !parsed.length) {
    parsed = buildStandLogosFromRow_(marca, logoEnlace, marcasJsonRaw);
  }
  return parsed.map(function (item) {
    return {
      marca: String((item && item.marca) || '').trim(),
      url: String((item && (item.logoEnlace || item.url)) || '').trim()
    };
  }).filter(function (item) {
    return item.marca || item.url;
  });
}

function getPublicMarcaUrl_(recordId) {
  var id = String(recordId || '').trim();
  if (!id) return '';
  var base = String(SITE_PUBLIC_BASE_URL || 'https://la-sucursal-del-cafe.web.app').replace(/\/$/, '');
  return base + '/marcas/' + encodeURIComponent(id);
}

function defaultPerfilEmprendimiento_() {
  return {
    tagline: '',
    historia: '',
    fotos: [],
    productos: [],
    publicado: true,
    updatedAt: ''
  };
}

function parsePerfilEmprendimientoJson_(raw) {
  var base = defaultPerfilEmprendimiento_();
  try {
    var parsed = JSON.parse(String(raw || '{}'));
    if (!parsed || typeof parsed !== 'object') return base;
    base.tagline = String(parsed.tagline || '').trim();
    base.historia = String(parsed.historia || '').trim();
    base.publicado = parsed.publicado !== false;
    base.updatedAt = String(parsed.updatedAt || '').trim();
    base.fotos = Array.isArray(parsed.fotos) ? parsed.fotos.map(function (item) {
      return {
        id: String((item && item.id) || '').trim(),
        url: String((item && item.url) || '').trim(),
        caption: String((item && item.caption) || '').trim()
      };
    }).filter(function (item) { return item.url; }) : [];
    base.productos = Array.isArray(parsed.productos) ? parsed.productos.map(function (item) {
      return {
        id: String((item && item.id) || '').trim(),
        nombre: String((item && item.nombre) || '').trim(),
        descripcion: String((item && item.descripcion) || '').trim(),
        precio: String((item && item.precio) || '').trim(),
        fotoUrl: String((item && item.fotoUrl) || '').trim()
      };
    }).filter(function (item) { return item.nombre; }) : [];
  } catch (e) {
    return base;
  }
  return base;
}

function findStandRowById_(recordId) {
  var id = String(recordId || '').trim();
  if (!id) return null;

  var sheet = getOrCreateSheet_(SHEET_STANDS, HEADERS_STANDS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  var idCol = HEADERS_STANDS.indexOf('ID') + 1;
  if (idCol <= 0) return null;

  var ids = sheet.getRange(2, idCol, lastRow, idCol).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '').trim() === id) return 2 + i;
  }
  return null;
}

function participanteResumenFromRow_(row) {
  var marca = String(row['Marca o negocio'] || '').trim();
  if (!marca) return null;

  var perfil = parsePerfilEmprendimientoJson_(row['Perfil emprendimiento (JSON)']);
  var id = String(row['ID'] || '').trim();
  var tienePerfil = !!(perfil.tagline || perfil.historia || perfil.fotos.length || perfil.productos.length);

  return {
    id: id,
    marca: marca,
    tipo: String(row['Tipo participante'] || tipoParticipanteFromPlan_(row['Plan stand']) || '').trim(),
    descripcion: String(row['Descripción exhibición'] || '').trim(),
    redSocial: String(row['Red social preferida'] || '').trim(),
    redUrl: String(row['Red social enlace'] || '').trim(),
    logos: parseLogosDirectorioJson_(
      row['Logos directorio (JSON)'],
      marca,
      row['Logo enlace Drive'],
      row['Marcas adicionales (JSON)']
    ),
    standId: String(row['Stand ID'] || '').trim(),
    ciudad: String(row['Ciudad'] || '').trim(),
    tagline: perfil.tagline,
    tienePerfil: tienePerfil,
    perfilUrl: getPublicMarcaUrl_(id)
  };
}

function participanteDetalleFromRow_(row) {
  var resumen = participanteResumenFromRow_(row);
  if (!resumen) return null;

  var perfil = parsePerfilEmprendimientoJson_(row['Perfil emprendimiento (JSON)']);
  if (perfil.publicado) {
    resumen.perfil = perfil;
  }
  return resumen;
}

function getParticipantePublicoById_(recordId) {
  var rowNum = findStandRowById_(recordId);
  if (!rowNum) {
    return { ok: false, error: 'Marca no encontrada.' };
  }

  var sheet = getOrCreateSheet_(SHEET_STANDS, HEADERS_STANDS);
  var values = sheet.getRange(rowNum, 1, rowNum, HEADERS_STANDS.length).getValues()[0];
  var row = rowObjectFromValues_(HEADERS_STANDS, values);

  if (!isHabilitado_(row['Habilitado'])) {
    return { ok: false, error: 'Esta marca no está publicada.' };
  }
  if (!isVisiblePublico_(row['Visible directorio público'])) {
    return { ok: false, error: 'Esta marca no está visible en el directorio.' };
  }

  var participante = participanteDetalleFromRow_(row);
  if (!participante) {
    return { ok: false, error: 'Marca no encontrada.' };
  }

  return {
    ok: true,
    formType: 'participante_publico',
    participante: participante
  };
}

function uploadExpositorMedia_(recordId, archivo, prefix) {
  if (!archivo || !archivo.base64) return '';
  return saveFileToDriveFolder_(
    recordId || 'sin-id',
    String(archivo.nombreArchivo || prefix + '.jpg'),
    String(archivo.tipoArchivo || ''),
    String(archivo.base64 || ''),
    DRIVE_GALERIA_EXPOSITORES_FOLDER,
    prefix
  );
}

function handleExpositorUpdateProfile_(payload) {
  var rowNum = findExpositorRowByCredentials_(payload.email || '', payload.accessCode || '');
  if (!rowNum) {
    return { ok: false, error: 'Correo o código de acceso incorrectos.' };
  }

  var sheet = getOrCreateSheet_(SHEET_STANDS, HEADERS_STANDS);
  var values = sheet.getRange(rowNum, 1, rowNum, HEADERS_STANDS.length).getValues()[0];
  var row = rowObjectFromValues_(HEADERS_STANDS, values);
  var recordId = String(row['ID'] || '').trim();
  var perfil = parsePerfilEmprendimientoJson_(row['Perfil emprendimiento (JSON)']);
  var profile = payload.profile || {};

  if (profile.tagline !== undefined) {
    perfil.tagline = String(profile.tagline || '').trim().substring(0, 140);
  }
  if (profile.historia !== undefined) {
    perfil.historia = String(profile.historia || '').trim().substring(0, 3000);
  }
  if (profile.publicado !== undefined) {
    perfil.publicado = profile.publicado !== false && profile.publicado !== 'No';
  }
  if (profile.descripcion !== undefined) {
    var descCol = HEADERS_STANDS.indexOf('Descripción exhibición') + 1;
    if (descCol > 0) {
      sheet.getRange(rowNum, descCol).setValue(String(profile.descripcion || '').trim().substring(0, 500));
    }
  }
  if (profile.redSocial !== undefined || profile.redUrl !== undefined) {
    var redCol = HEADERS_STANDS.indexOf('Red social preferida') + 1;
    var urlCol = HEADERS_STANDS.indexOf('Red social enlace') + 1;
    if (redCol > 0 && profile.redSocial !== undefined) {
      sheet.getRange(rowNum, redCol).setValue(String(profile.redSocial || '').trim());
    }
    if (urlCol > 0 && profile.redUrl !== undefined) {
      sheet.getRange(rowNum, urlCol).setValue(normalizeRedSocialEnlace_(profile.redSocial || row['Red social preferida'], profile.redUrl || ''));
    }
  }

  if (Array.isArray(profile.fotosEliminar) && profile.fotosEliminar.length) {
    var eliminar = profile.fotosEliminar.map(function (id) { return String(id || '').trim(); });
    perfil.fotos = perfil.fotos.filter(function (foto) {
      return eliminar.indexOf(String(foto.id || '').trim()) === -1;
    });
  }

  if (Array.isArray(profile.fotosNuevas)) {
    profile.fotosNuevas.forEach(function (archivo, idx) {
      var url = uploadExpositorMedia_(recordId, archivo, 'foto-' + (perfil.fotos.length + idx + 1));
      if (!url) return;
      perfil.fotos.push({
        id: 'f-' + Date.now() + '-' + idx,
        url: url,
        caption: String((archivo && archivo.caption) || '').trim().substring(0, 120)
      });
    });
  }

  if (Array.isArray(profile.productos)) {
    perfil.productos = profile.productos.map(function (item, idx) {
      var producto = {
        id: String((item && item.id) || ('p-' + Date.now() + '-' + idx)).trim(),
        nombre: String((item && item.nombre) || '').trim().substring(0, 80),
        descripcion: String((item && item.descripcion) || '').trim().substring(0, 300),
        precio: String((item && item.precio) || '').trim().substring(0, 40),
        fotoUrl: String((item && item.fotoUrl) || '').trim()
      };
      if (item && item.fotoNueva && item.fotoNueva.base64) {
        var fotoUrl = uploadExpositorMedia_(recordId, item.fotoNueva, 'producto-' + (idx + 1));
        if (fotoUrl) producto.fotoUrl = fotoUrl;
      }
      return producto;
    }).filter(function (item) { return item.nombre; }).slice(0, 24);
  }

  if (profile.logoNuevo && profile.logoNuevo.base64) {
    var logo = parseLogoStand_({
      id: recordId,
      logoStand: profile.logoNuevo
    });
    if (logo.enlace) {
      var logoNombreCol = HEADERS_STANDS.indexOf('Logo nombre') + 1;
      var logoTipoCol = HEADERS_STANDS.indexOf('Logo tipo') + 1;
      var logoEnlaceCol = HEADERS_STANDS.indexOf('Logo enlace Drive') + 1;
      var logosJsonCol = HEADERS_STANDS.indexOf('Logos directorio (JSON)') + 1;
      if (logoNombreCol > 0) sheet.getRange(rowNum, logoNombreCol).setValue(logo.nombre || '');
      if (logoTipoCol > 0) sheet.getRange(rowNum, logoTipoCol).setValue(logo.tipo || '');
      if (logoEnlaceCol > 0) sheet.getRange(rowNum, logoEnlaceCol).setValue(logo.enlace || '');
      if (logosJsonCol > 0) {
        sheet.getRange(rowNum, logosJsonCol).setValue(
          logosDirectorioJsonFromRow_(row['Marca o negocio'], logo.enlace, row['Marcas adicionales (JSON)'])
        );
      }
    }
  }

  perfil.updatedAt = new Date().toISOString();
  var perfilCol = HEADERS_STANDS.indexOf('Perfil emprendimiento (JSON)') + 1;
  if (perfilCol > 0) {
    sheet.getRange(rowNum, perfilCol).setValue(JSON.stringify(perfil));
  }

  return {
    ok: true,
    stand: standRowToExpositorData_(sheet, rowNum),
    perfilUrl: getPublicMarcaUrl_(recordId)
  };
}

function handleAdminCreateStand_(payload) {
  var access = assertAdminAccess_(payload.idToken || '');
  if (!access.ok) {
    return { ok: false, error: access.error };
  }

  var marca = String(payload.marca || '').trim();
  var correo = String(payload.correo || '').trim();
  if (!marca) {
    return { ok: false, error: 'La marca o negocio es obligatoria.' };
  }
  if (!correo || correo.indexOf('@') === -1) {
    return { ok: false, error: 'Correo electrónico válido requerido.' };
  }

  var plan = String(payload.plan || 'Zona Origen').trim();
  var tipoParticipante = String(payload.tipoParticipante || tipoParticipanteFromPlan_(plan) || 'expositor').trim();
  var data = {
    fecha: new Date().toISOString(),
    id: String(payload.id || ('ST-' + Date.now().toString(36).toUpperCase())).trim(),
    standId: payload.standId || '',
    marca: marca,
    contacto: String(payload.contacto || payload.nombre || '').trim(),
    celular: String(payload.celular || '').trim(),
    correo: correo,
    plan: plan,
    ciudad: String(payload.ciudad || '').trim(),
    descripcion: String(payload.descripcion || '').trim(),
    tipoParticipante: tipoParticipante,
    redSocial: String(payload.redSocial || '').trim(),
    redEnlace: String(payload.redEnlace || '').trim(),
    visiblePublico: payload.visiblePublico !== false && payload.visiblePublico !== 'No',
    comparteStand: false,
    logoStand: payload.logoStand || null,
    aceptaVoluntaria: true,
    aceptaPertenencias: true,
    aceptaDatos: true,
    aceptaImagen: true
  };

  var sheet = getOrCreateSheet_(SHEET_STANDS, HEADERS_STANDS);
  if (findDuplicateInSheet_(sheet, HEADERS_STANDS, data.correo, null)) {
    return { ok: false, error: 'Ya existe un registro con este correo.' };
  }

  var standId = normalizeStandId_(data.standId);
  if (standId && findStandOccupied_(standId)) {
    return { ok: false, error: 'El stand ' + standId + ' ya está ocupado.' };
  }

  var logo = { nombre: '', tipo: '', enlace: '' };
  if (data.logoStand && data.logoStand.base64) {
    logo = parseLogoStand_(data);
  }

  var legalCols = ['Sí', 'Sí', 'Sí', 'Sí'];
  var accessCode = generateAccessCode_();
  var accessHash = hashAccessCode_(accessCode);
  var habilitado = payload.habilitado !== false && payload.habilitado !== 'No' ? 'Sí' : 'No';
  var visiblePublico = data.visiblePublico ? 'Sí' : 'No';
  var estado = String(payload.estado || 'Confirmado por admin').trim();
  var logosDirectorioJson = logosDirectorioJsonFromRow_(data.marca, logo.enlace, '[]');
  var redEnlace = normalizeRedSocialEnlace_(data.redSocial, data.redEnlace);

  var standRow = joinRowParts_([
    data.fecha,
    data.id,
    standId,
    data.marca,
    data.contacto,
    data.celular,
    data.correo,
    data.plan,
    data.ciudad,
    data.descripcion,
    tipoParticipante,
    data.redSocial,
    redEnlace,
    logosDirectorioJson,
    visiblePublico,
    logo.nombre,
    logo.tipo,
    logo.enlace,
    'No',
    '[]'
  ], legalCols, [estado, habilitado, String(payload.notasAdmin || 'Creado desde panel admin').trim(), '{}', accessHash]);
  sheet.appendRow(standRow);

  data.accessCode = accessCode;
  data.expositorPanelUrl = getExpositorPanelUrl_();
  data.standId = standId;
  data.esAliadoPatrocinador = isAliadoPatrocinadorPlan_(plan) || isPatrocinadorAliadoTipo_(tipoParticipante, plan);
  sendConfirmationEmail_('stands', data);

  return {
    ok: true,
    id: data.id,
    accessCode: accessCode,
    expositorPanelUrl: data.expositorPanelUrl,
    perfilUrl: getPublicMarcaUrl_(data.id),
    marca: data.marca
  };
}

function handleAdminCreateCompetitor_(payload) {
  var access = assertAdminAccess_(payload.idToken || '');
  if (!access.ok) {
    return { ok: false, error: access.error };
  }

  var nombre = String(payload.nombre || '').trim();
  var correo = String(payload.correo || '').trim().toLowerCase();
  var celular = String(payload.celular || '').trim();
  if (!nombre || !correo || !celular) {
    return { ok: false, error: 'Nombre, correo y celular son obligatorios.' };
  }

  var forzarCupo = payload.forzarCupo === true || payload.forzarCupo === 'true' || payload.forzarCupo === 1;
  var eventoTarget = payload.evento || ACTIVE_COMPETENCIA_EVENTO;
  if (!forzarCupo && getCompetenciaCount_(eventoTarget) >= CUPO_MAX_COMPETENCIA) {
    return { ok: false, error: 'Cupo completo para esta preliminar. Marca "Forzar si cupo lleno" para agregar igual.' };
  }

  var sheet = getOrCreateSheet_(SHEET_COMPETENCIA, HEADERS_COMPETENCIA);
  if (findDuplicateCompetenciaInEvent_(sheet, HEADERS_COMPETENCIA, correo, payload.documento || null, payload.evento || ACTIVE_COMPETENCIA_EVENTO)) {
    return { ok: false, error: 'Ya existe una inscripción con este correo o documento para esta preliminar.' };
  }

  var data = {
    fecha: new Date().toISOString(),
    id: String(payload.id || ('COMP-' + Date.now().toString(36).toUpperCase())).trim(),
    evento: payload.evento || ACTIVE_COMPETENCIA_EVENTO,
    nombre: nombre,
    documento: String(payload.documento || '').trim(),
    celular: celular,
    correo: correo,
    ciudad: String(payload.ciudad || '').trim(),
    estadoPago: String(payload.estadoPago || 'Confirmado por admin').trim(),
    cupoConfirmado: payload.cupoConfirmado !== false && payload.cupoConfirmado !== 'false' ? 'Sí' : 'No',
    aceptaVoluntaria: true,
    aceptaPertenencias: true,
    aceptaDatos: true,
    aceptaNoReembolso: true,
    aceptaDescalificacion: true,
    aceptaReglas: true,
    aceptaDisponibilidad: true,
    aceptaImagen: true
  };

  var legalCols = parseLegalAcceptances_(data);
  var compRow = joinRowParts_([
    data.fecha,
    data.id,
    data.evento,
    '',
    data.nombre,
    data.documento,
    '',
    data.ciudad,
    data.celular,
    data.correo,
    '', '', '',
    '', '', '', '', '', '', '', '',
    '', '', '', '', '', '',
    '', '', 'No', '', '', '', ''
  ], legalCols, [
    'Creado desde panel admin',
    data.estadoPago,
    data.cupoConfirmado,
    'Sí',
    ''
  ]);
  sheet.appendRow(compRow);

  return { ok: true, id: data.id, nombre: data.nombre };
}

function handleAdminCreateFeria_(payload) {
  var access = assertAdminAccess_(payload.idToken || '');
  if (!access.ok) {
    return { ok: false, error: access.error };
  }

  var nombre = String(payload.nombre || '').trim();
  var celular = String(payload.celular || '').trim();
  if (!nombre || !celular) {
    return { ok: false, error: 'Nombre y celular son obligatorios.' };
  }

  var correo = String(payload.correo || '').trim().toLowerCase();
  var sheet = getOrCreateSheet_(SHEET_FERIA, HEADERS_FERIA);
  if (correo && findDuplicateInSheet_(sheet, HEADERS_FERIA, correo, null)) {
    return { ok: false, error: 'Ya existe un visitante con este correo.' };
  }

  var data = {
    fecha: new Date().toISOString(),
    id: String(payload.id || ('FER-' + Date.now().toString(36).toUpperCase())).trim(),
    nombre: nombre,
    edad: String(payload.edad || '').trim(),
    celular: celular,
    correo: correo,
    intereses: String(payload.intereses || '').trim(),
    pasaporteId: String(payload.pasaporteId || '').trim(),
    aceptaVoluntaria: true,
    aceptaPertenencias: true,
    aceptaDatos: true,
    aceptaImagen: true
  };

  var legalCols = parseFeriaLegalAcceptances_(data);
  var row = joinRowParts_([
    data.fecha,
    data.id,
    data.nombre,
    data.edad,
    data.celular,
    data.correo,
    data.intereses
  ], legalCols, ['Registrado por admin', 'Sí', data.pasaporteId, 'Panel admin']);
  sheet.appendRow(row);

  return {
    ok: true,
    id: data.id,
    pasaporteUrl: data.pasaporteId ? getPasaporteUrl_(data) : getPasaporteRegistroUrl_(data)
  };
}

function getParticipantesPublico_() {
  var sheet = getOrCreateSheet_(SHEET_STANDS, HEADERS_STANDS);
  var lastRow = sheet.getLastRow();
  var participantes = [];

  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow, HEADERS_STANDS.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var row = rowObjectFromValues_(HEADERS_STANDS, values[i]);
      if (!isHabilitado_(row['Habilitado'])) continue;
      if (!isVisiblePublico_(row['Visible directorio público'])) continue;

      var item = participanteResumenFromRow_(row);
      if (item) participantes.push(item);
    }
  }

  return {
    ok: true,
    formType: 'participantes_publico',
    participantes: participantes,
    total: participantes.length
  };
}

function handleAdminPatchStand_(payload) {
  var access = assertAdminAccess_(payload.idToken || '');
  if (!access.ok) {
    return { ok: false, error: access.error };
  }

  var id = String(payload.id || '').trim();
  if (!id) {
    return { ok: false, error: 'ID requerido.' };
  }

  var sheet = getOrCreateSheet_(SHEET_STANDS, HEADERS_STANDS);
  var idCol = HEADERS_STANDS.indexOf('ID') + 1;
  var visCol = HEADERS_STANDS.indexOf('Visible directorio público') + 1;
  if (idCol <= 0 || visCol <= 0) {
    return { ok: false, error: 'Columnas de stands no configuradas.' };
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { ok: false, error: 'Sin registros de stands.' };
  }

  var ids = sheet.getRange(2, idCol, lastRow, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '').trim() !== id) continue;
    var visible = payload.visiblePublico === true ||
      payload.visiblePublico === 'Sí' ||
      payload.visiblePublico === 'Si' ||
      payload.visiblePublico === 'si';
    var label = visible ? 'Sí' : 'No';
    sheet.getRange(i + 2, visCol).setValue(label);
    return { ok: true, id: id, visiblePublico: label };
  }

  return { ok: false, error: 'Registro no encontrado.' };
}

function isHabilitadoPatrocinador_(val) {
  var v = String(val || '').trim().toLowerCase();
  if (!v) return true;
  return v === 'sí' || v === 'si' || v === 'yes' || v === 'true' || v === '1';
}

function patrocinadorOrdenNum_(val) {
  var n = parseInt(String(val || '').trim(), 10);
  return isNaN(n) ? 9999 : n;
}

function ensureDefaultPatrocinadoresCompetencia_() {
  var sheet = getOrCreateSheet_(SHEET_PATROCINADORES_COMPETENCIA, HEADERS_PATROCINADORES_COMPETENCIA);
  if (sheet.getLastRow() > 1) return;

  var defaults = [
    [
      'PC-1', 'Purist', '@purist.cafe', 'https://www.instagram.com/purist.cafe/',
      SITE_PUBLIC_BASE_URL + '/assets/sponsors/purist.webp', 'Sí', 1, 'Migrado desde event-config'
    ],
    [
      'PC-2', 'Palmetto Plaza', '@palmettoplaza', 'https://www.instagram.com/palmettoplaza/',
      SITE_PUBLIC_BASE_URL + '/assets/sponsors/palmetto-plaza.png', 'Sí', 2, 'Migrado desde event-config'
    ],
    [
      'PC-3', 'Ghost Specialty Coffee', '@ghost_specialty_coffee', 'https://www.instagram.com/ghost_specialty_coffee/',
      '', 'Sí', 3, 'Café invitado — tarjeta destacada'
    ],
    [
      'PC-4', 'Medium Café', '@medium_cafe', 'https://www.instagram.com/medium_cafe/',
      '', 'Sí', 4, 'Coffee Shop — tarjeta destacada'
    ]
  ];
  defaults.forEach(function (row) {
    sheet.appendRow(row);
  });
}

function readPatrocinadoresCompetenciaRows_() {
  ensureDefaultPatrocinadoresCompetencia_();
  return readAllSheetRows_(SHEET_PATROCINADORES_COMPETENCIA, HEADERS_PATROCINADORES_COMPETENCIA, false);
}

function mapPatrocinadorCompetenciaPublico_(row) {
  var name = String(row['Nombre'] || '').trim();
  if (!name) return null;
  if (!isHabilitadoPatrocinador_(row['Habilitado'])) return null;

  return {
    id: String(row['ID'] || '').trim(),
    name: name,
    instagramHandle: String(row['Instagram handle'] || '').trim(),
    instagramUrl: String(row['Red social enlace'] || '').trim(),
    image: String(row['Logo enlace'] || '').trim(),
    imageAlt: name,
    orden: patrocinadorOrdenNum_(row['Orden'])
  };
}

function sortPatrocinadoresCompetenciaPublico_(items) {
  return items.sort(function (a, b) {
    if (a.orden !== b.orden) return a.orden - b.orden;
    return String(a.name || '').localeCompare(String(b.name || ''), 'es');
  });
}

function getPatrocinadoresCompetenciaPublico_() {
  var rows = readPatrocinadoresCompetenciaRows_();
  var patrocinadores = [];

  rows.forEach(function (row) {
    var item = mapPatrocinadorCompetenciaPublico_(row);
    if (item) patrocinadores.push(item);
  });

  sortPatrocinadoresCompetenciaPublico_(patrocinadores);

  return {
    ok: true,
    formType: 'patrocinadores_competencia_publico',
    patrocinadores: patrocinadores,
    total: patrocinadores.length
  };
}

function generatePatrocinadorCompetenciaId_() {
  var sheet = getOrCreateSheet_(SHEET_PATROCINADORES_COMPETENCIA, HEADERS_PATROCINADORES_COMPETENCIA);
  var lastRow = sheet.getLastRow();
  var maxNum = 0;
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow, 1).getValues();
    ids.forEach(function (row) {
      var id = String(row[0] || '').trim();
      var match = id.match(/^PC-(\d+)$/i);
      if (match) {
        var num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
  }
  return 'PC-' + (maxNum + 1);
}

function findPatrocinadorCompetenciaRowIndex_(sheet, id) {
  var idCol = HEADERS_PATROCINADORES_COMPETENCIA.indexOf('ID') + 1;
  if (idCol <= 0) return -1;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  var ids = sheet.getRange(2, idCol, lastRow, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '').trim() === id) return i + 2;
  }
  return -1;
}

function handleAdminTogglePatrocinadorCompetencia_(payload) {
  var access = assertAdminAccess_(payload.idToken || '');
  if (!access.ok) {
    return { ok: false, error: access.error };
  }

  var id = String(payload.id || '').trim();
  if (!id) {
    return { ok: false, error: 'ID requerido.' };
  }

  var sheet = getOrCreateSheet_(SHEET_PATROCINADORES_COMPETENCIA, HEADERS_PATROCINADORES_COMPETENCIA);
  var rowIndex = findPatrocinadorCompetenciaRowIndex_(sheet, id);
  if (rowIndex < 0) {
    return { ok: false, error: 'Patrocinador no encontrado.' };
  }

  var habCol = HEADERS_PATROCINADORES_COMPETENCIA.indexOf('Habilitado') + 1;
  if (habCol <= 0) {
    return { ok: false, error: 'Columna Habilitado no configurada.' };
  }

  var enabled = payload.habilitado === true ||
    payload.habilitado === 'Sí' ||
    payload.habilitado === 'Si' ||
    payload.habilitado === 'si';
  var label = enabled ? 'Sí' : 'No';
  sheet.getRange(rowIndex, habCol).setValue(label);
  return { ok: true, id: id, habilitado: label };
}

function handleAdminSavePatrocinadorCompetencia_(payload) {
  var access = assertAdminAccess_(payload.idToken || '');
  if (!access.ok) {
    return { ok: false, error: access.error };
  }

  var nombre = String(payload.nombre || payload.name || '').trim();
  if (!nombre) {
    return { ok: false, error: 'Nombre requerido.' };
  }

  var sheet = getOrCreateSheet_(SHEET_PATROCINADORES_COMPETENCIA, HEADERS_PATROCINADORES_COMPETENCIA);
  var id = String(payload.id || '').trim();
  var rowIndex = id ? findPatrocinadorCompetenciaRowIndex_(sheet, id) : -1;
  if (!id) id = generatePatrocinadorCompetenciaId_();

  var handle = String(payload.instagramHandle || payload.instagram || '').trim();
  var redEnlace = String(payload.redEnlace || payload.instagramUrl || '').trim();
  var logoEnlace = String(payload.logoEnlace || payload.image || '').trim();
  var enabled = payload.habilitado === false || payload.habilitado === 'No' ? 'No' : 'Sí';
  var ordenCol = HEADERS_PATROCINADORES_COMPETENCIA.indexOf('Orden') + 1;
  var orden = patrocinadorOrdenNum_(payload.orden);
  if (payload.orden === '' || payload.orden === null || payload.orden === undefined) {
    orden = rowIndex >= 0
      ? patrocinadorOrdenNum_(sheet.getRange(rowIndex, ordenCol).getValue())
      : Math.max(1, sheet.getLastRow());
  }
  var notas = String(payload.notas || payload.notasAdmin || '').trim();

  var rowValues = [id, nombre, handle, redEnlace, logoEnlace, enabled, orden, notas];

  if (rowIndex >= 0) {
    sheet.getRange(rowIndex, 1, rowIndex, HEADERS_PATROCINADORES_COMPETENCIA.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return {
    ok: true,
    id: id,
    patrocinador: {
      ID: id,
      Nombre: nombre,
      'Instagram handle': handle,
      'Red social enlace': redEnlace,
      'Logo enlace': logoEnlace,
      Habilitado: enabled,
      Orden: String(orden),
      'Notas admin': notas
    }
  };
}

function sheetConfigForDataset_(dataset) {
  var ds = String(dataset || '').trim().toLowerCase();
  if (ds === 'feria') {
    return { sheetName: SHEET_FERIA, headers: HEADERS_FERIA };
  }
  if (ds === 'competencia') {
    return { sheetName: SHEET_COMPETENCIA, headers: HEADERS_COMPETENCIA };
  }
  if (ds === 'stands' || ds === 'aliados' || ds === 'patrocinadores' || ds === 'expositores') {
    return { sheetName: SHEET_STANDS, headers: HEADERS_STANDS };
  }
  return null;
}

function handleAdminToggleStatus_(payload) {
  var access = assertAdminAccess_(payload.idToken || '');
  if (!access.ok) {
    return { ok: false, error: access.error };
  }

  var dataset = String(payload.dataset || '').trim().toLowerCase();
  var cfg = sheetConfigForDataset_(dataset);
  if (!cfg) {
    return { ok: false, error: 'dataset inválido. Usa: feria, competencia, stands.' };
  }

  var id = String(payload.id || '').trim();
  if (!id) {
    return { ok: false, error: 'ID requerido.' };
  }

  var enabled = payload.enabled === true ||
    payload.enabled === 'Sí' ||
    payload.enabled === 'Si' ||
    payload.enabled === 'si' ||
    payload.enabled === 'true' ||
    payload.enabled === 1 ||
    payload.enabled === '1';
  var label = enabled ? 'Sí' : 'No';

  var sheet = getOrCreateSheet_(cfg.sheetName, cfg.headers);
  var idCol = cfg.headers.indexOf('ID') + 1;
  var habCol = cfg.headers.indexOf('Habilitado') + 1;
  if (idCol <= 0 || habCol <= 0) {
    return { ok: false, error: 'Columna Habilitado no configurada. Ejecuta sincronizarEncabezados().' };
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { ok: false, error: 'Sin registros.' };
  }

  var ids = sheet.getRange(2, idCol, lastRow, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '').trim() !== id) continue;
    sheet.getRange(i + 2, habCol).setValue(label);
    return { ok: true, dataset: dataset, id: id, enabled: enabled, habilitado: label };
  }

  return { ok: false, error: 'Registro no encontrado.' };
}

function buildStandLogosFromRow_(marca, logoEnlace, marcasJsonRaw) {
  var logos = [];
  var mainMarca = String(marca || '').trim();
  var mainLogo = String(logoEnlace || '').trim();
  if (mainLogo || mainMarca) {
    logos.push({ marca: mainMarca, logoEnlace: mainLogo });
  }
  parseMarcasAdicionalesJson_(marcasJsonRaw).forEach(function (item) {
    var nombre = String((item && item.nombre) || '').trim();
    var enlace = String((item && item.logoEnlace) || '').trim();
    if (!nombre && !enlace) return;
    logos.push({ marca: nombre, logoEnlace: enlace });
  });
  return logos;
}

function parseMarcasAdicionales_(data) {
  if (!data.comparteStand) {
    return { comparte: 'No', json: '[]', items: [] };
  }
  var raw = Array.isArray(data.marcasAdicionales) ? data.marcasAdicionales : [];
  var items = [];
  raw.forEach(function (item, idx) {
    var nombre = String((item && item.nombre) || '').trim();
    if (!nombre) return;
    var logoPayload = item.logo || null;
    var logoEnlace = '';
    var logoNombre = '';
    var logoTipo = '';
    if (logoPayload && logoPayload.base64) {
      logoEnlace = saveFileToDriveFolder_(
        (data.id || 'sin-id') + '-marca-' + (idx + 1),
        String(logoPayload.nombreArchivo || 'logo-marca-' + (idx + 1) + '.jpg'),
        String(logoPayload.tipoArchivo || 'image/jpeg'),
        String(logoPayload.base64),
        DRIVE_LOGOS_STANDS_FOLDER_NAME,
        'logo'
      );
      logoNombre = String(logoPayload.nombreArchivo || '');
      logoTipo = String(logoPayload.tipoArchivo || '');
    }
    items.push({
      nombre: nombre,
      logoNombre: logoNombre,
      logoTipo: logoTipo,
      logoEnlace: logoEnlace
    });
  });
  if (!items.length) {
    throw new Error('Indica al menos una marca adicional si compartes el stand.');
  }
  return {
    comparte: 'Sí',
    json: JSON.stringify(items),
    items: items
  };
}

function getStandsMapData_() {
  var sheet = getOrCreateSheet_(SHEET_STANDS, HEADERS_STANDS);
  var lastRow = sheet.getLastRow();
  var occupied = [];
  if (lastRow >= 2) {
    var standCol = HEADERS_STANDS.indexOf('Stand ID') + 1;
    var marcaCol = HEADERS_STANDS.indexOf('Marca o negocio') + 1;
    var logoCol = HEADERS_STANDS.indexOf('Logo enlace Drive') + 1;
    var marcasJsonCol = HEADERS_STANDS.indexOf('Marcas adicionales (JSON)') + 1;
    var habCol = HEADERS_STANDS.indexOf('Habilitado') + 1;
    var standVals = standCol > 0 ? sheet.getRange(2, standCol, lastRow, standCol).getValues() : [];
    var marcaVals = marcaCol > 0 ? sheet.getRange(2, marcaCol, lastRow, marcaCol).getValues() : [];
    var logoVals = logoCol > 0 ? sheet.getRange(2, logoCol, lastRow, logoCol).getValues() : [];
    var marcasJsonVals = marcasJsonCol > 0 ? sheet.getRange(2, marcasJsonCol, lastRow, marcasJsonCol).getValues() : [];
    var habVals = habCol > 0 ? sheet.getRange(2, habCol, lastRow, habCol).getValues() : [];
    for (var i = 0; i < standVals.length; i++) {
      if (!isHabilitado_(habVals[i] && habVals[i][0])) continue;
      var sid = normalizeStandId_(standVals[i][0]);
      if (!sid) continue;
      var marca = String(marcaVals[i][0] || '');
      var logoEnlace = String(logoVals[i][0] || '');
      var logos = buildStandLogosFromRow_(marca, logoEnlace, marcasJsonVals[i][0]);
      occupied.push({
        standId: sid,
        marca: marca,
        logoEnlace: logoEnlace,
        logos: logos
      });
    }
  }
  return {
    ok: true,
    formType: 'stands',
    occupied: occupied,
    total: occupied.length
  };
}

function planRequiresStand_(plan) {
  var p = String(plan || '').trim();
  return p === 'Zona Origen' || p === 'Zona Gran Reserva';
}

function isAliadoPatrocinadorPlan_(plan) {
  return String(plan || '').trim() === 'Aliado Patrocinador';
}

function isPatrocinadorAliadoTipo_(tipo, plan) {
  var t = String(tipo || '').trim().toLowerCase();
  if (t === 'aliado' || t === 'patrocinador') return true;
  return isAliadoPatrocinadorPlan_(plan);
}

function parseLogoStand_(data) {
  var archivo = data.logoStand || {};
  var nombre = String(archivo.nombreArchivo || '');
  var tipo = String(archivo.tipoArchivo || '');
  var base64 = String(archivo.base64 || '');
  var enlace = '';

  if (base64) {
    enlace = saveFileToDriveFolder_(
      data.id || 'sin-id',
      nombre,
      tipo,
      base64,
      DRIVE_LOGOS_STANDS_FOLDER_NAME,
      'logo'
    );
  }

  return {
    nombre: nombre,
    tipo: tipo,
    enlace: enlace
  };
}

function appendStands_(data) {
  var sheet = getOrCreateSheet_(SHEET_STANDS, HEADERS_STANDS);
  if (findDuplicateInSheet_(sheet, HEADERS_STANDS, data.correo, null)) {
    throw new Error('Ya existe una solicitud de stand con este correo.');
  }

  var standId = normalizeStandId_(data.standId);
  var plan = String(data.plan || '').trim();
  var esAliadoPatrocinador = isAliadoPatrocinadorPlan_(plan) ||
    isPatrocinadorAliadoTipo_(data.tipoParticipante, plan);
  if (planRequiresStand_(plan) && !standId) {
    throw new Error('Debes seleccionar un stand en el mapa.');
  }
  if (standId && findStandOccupied_(standId)) {
    throw new Error('El stand ' + standId + ' ya está ocupado.');
  }

  var logo = parseLogoStand_(data);
  if (planRequiresStand_(plan) && !logo.enlace && !(data.logoStand && data.logoStand.base64)) {
    throw new Error('El logo de tu negocio es obligatorio.');
  }

  var marcasExtra = { comparte: 'No', json: '[]', items: [] };
  if (!esAliadoPatrocinador && data.comparteStand) {
    marcasExtra = parseMarcasAdicionales_(data);
  }
  data.comparteStandLabel = marcasExtra.comparte;
  data.marcasAdicionalesGuardadas = marcasExtra.items;

  var legalCols = parseFeriaLegalAcceptances_(data);
  var estado = 'Solicitud recibida';
  var contacto = data.contacto || data.nombre || '';
  var accessCode = generateAccessCode_();
  var accessHash = hashAccessCode_(accessCode);
  var tipoParticipante = String(data.tipoParticipante || tipoParticipanteFromPlan_(plan) || '').trim();
  var redSocial = String(data.redSocial || '').trim();
  var redEnlace = normalizeRedSocialEnlace_(redSocial, data.redEnlace || '');
  var visiblePublico = data.visiblePublico === false || data.visiblePublico === 'No' ? 'No' : 'Sí';
  var logosDirectorioJson = logosDirectorioJsonFromRow_(data.marca, logo.enlace, marcasExtra.json);
  data.esAliadoPatrocinador = esAliadoPatrocinador;

  var standRow = joinRowParts_([
    data.fecha || new Date().toISOString(),
    data.id || '',
    standId,
    data.marca || '',
    contacto,
    data.celular || '',
    data.correo || '',
    plan,
    data.ciudad || '',
    data.descripcion || '',
    tipoParticipante,
    redSocial,
    redEnlace,
    logosDirectorioJson,
    visiblePublico,
    logo.nombre,
    logo.tipo,
    logo.enlace,
    marcasExtra.comparte,
    marcasExtra.json
  ], legalCols, [estado, 'Sí', '', '{}', accessHash]);
  sheet.appendRow(standRow);

  data.accessCode = accessCode;
  data.expositorPanelUrl = getExpositorPanelUrl_();
  sendConfirmationEmail_('stands', data);
  sendOrganizerNotificationEmail_('stands', data);
  var logosMapa = buildStandLogosFromRow_(data.marca, logo.enlace, marcasExtra.json);
  return {
    id: data.id || '',
    logoEnlace: logo.enlace || '',
    logos: logosMapa,
    accessCode: accessCode,
    expositorPanelUrl: data.expositorPanelUrl
  };
}

function appendListaEspera_(data) {
  var sheet = getOrCreateSheet_(SHEET_LISTA_ESPERA, HEADERS_LISTA_ESPERA);
  var correo = data.correo || '';
  if (findDuplicateInSheet_(sheet, HEADERS_LISTA_ESPERA, correo, data.documento)) {
    throw new Error('Ya estás en la lista de espera con este correo o documento.');
  }

  sheet.appendRow([
    data.fecha || new Date().toISOString(),
    data.id || '',
    data.formulario || 'competencia',
    data.nombre || '',
    data.documento || '',
    correo,
    data.celular || '',
    data.motivo || 'Cupo completo',
    ''
  ]);

  sendConfirmationEmail_('lista_espera', data);
  sendOrganizerNotificationEmail_('lista_espera', data);
  return data.id || '';
}

function appendCompetencia_(data) {
  if (getCompetenciaCount_() >= CUPO_MAX_COMPETENCIA) {
    throw new Error('Cupo completo. No hay cupos disponibles para V60 Championship.');
  }

  var sheet = getOrCreateSheet_(SHEET_COMPETENCIA, HEADERS_COMPETENCIA);
  if (findDuplicateCompetenciaInEvent_(sheet, HEADERS_COMPETENCIA, data.correo, data.documento, data.evento || ACTIVE_COMPETENCIA_EVENTO)) {
    throw new Error('Ya existe una inscripción de competencia con este correo o documento para esta preliminar.');
  }

  var equipo = data.equipoPropio || {};
  var envio = data.envio || {};
  var comp = parseComprobante_(data);
  var foto = parseFotoParticipante_(data);
  var legalCols = parseLegalAcceptances_(data);
  var tieneComprobante = comp.tiene === 'Sí';
  var estadoPago = tieneComprobante ? 'Comprobante recibido' : 'Pendiente pago';
  var cupoConfirmado = 'No';

  var compRow = joinRowParts_([
    data.fecha || new Date().toISOString(),
    data.id || '',
    data.evento || 'V60 Championship — Preliminar 2',
    data.valorInscripcion || '',
    data.nombre || '',
    data.documento || '',
    data.edad || '',
    data.ciudad || '',
    data.celular || '',
    data.correo || '',
    foto.nombre,
    foto.tipo,
    foto.enlace,
    data.representa || '',
    data.rol || '',
    data.experiencia || '',
    data.experienciaSwitch || '',
    data.torneosPrevios || '',
    equipo.harioSwitch ? 'Sí' : 'No',
    equipo.gramera ? 'Sí' : 'No',
    equipo.tetera ? 'Sí' : 'No',
    envio.direccion || '',
    envio.ciudad || '',
    envio.departamento || '',
    envio.codigoPostal || '',
    envio.receptor || '',
    envio.instrucciones || '',
    data.metodoPago || '',
    comp.referencia,
    comp.tiene,
    comp.nombre,
    comp.tipo,
    comp.enlace,
    comp.preview
  ], legalCols, [
    data.observaciones || '',
    estadoPago,
    cupoConfirmado,
    'Sí',
    ''
  ]);
  sheet.appendRow(compRow);

  sendConfirmationEmail_('competencia', data);
  sendOrganizerNotificationEmail_('competencia', data);
  return {
    id: data.id || '',
    fotoEnlace: foto.enlace || ''
  };
}

function parseFotoParticipante_(data) {
  var archivo = data.fotoParticipante || {};
  var nombre = String(archivo.nombreArchivo || '');
  var tipo = String(archivo.tipoArchivo || '');
  var base64 = String(archivo.base64 || '');

  if (!base64) {
    throw new Error('La foto del participante es obligatoria.');
  }

  var enlace = saveFileToDriveFolder_(
    data.id || 'sin-id',
    nombre,
    tipo,
    base64,
    DRIVE_FOTOS_FOLDER_NAME,
    'foto'
  );

  return {
    nombre: nombre,
    tipo: tipo,
    enlace: enlace
  };
}

function parseComprobante_(data) {
  var archivo = data.comprobanteArchivo || {};
  var tiene = !!(archivo.tieneComprobante || archivo.base64);
  var nombre = String(archivo.nombreArchivo || '');
  var tipo = String(archivo.tipoArchivo || '');
  var base64 = String(archivo.base64 || '');
  var referencia = String(data.comprobanteReferencia || data.comprobante || '').trim();
  var enlace = '';
  var preview = '';

  if (base64) {
    preview = base64.length > COMPROBANTE_PREVIEW_MAX
      ? base64.substring(0, COMPROBANTE_PREVIEW_MAX) + '...'
      : base64;
    enlace = saveFileToDriveFolder_(data.id || 'sin-id', nombre, tipo, base64, DRIVE_FOLDER_NAME, 'comprobante');
  }

  return {
    referencia: referencia,
    tiene: tiene ? 'Sí' : 'No',
    nombre: nombre,
    tipo: tipo,
    enlace: enlace,
    preview: preview
  };
}

function saveFileToDriveFolder_(inscripcionId, nombreArchivo, mimeType, dataUrl, folderName, prefix) {
  try {
    var match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return '';
    var mime = mimeType || match[1];
    var bytes = Utilities.base64Decode(match[2]);
    var blob = Utilities.newBlob(bytes, mime, nombreArchivo || prefix);
    var folder = getOrCreateDriveFolder_(folderName);
    var safeName = String(inscripcionId).replace(/[^\w\-]/g, '_');
    var ext = guessExtension_(mime, nombreArchivo);
    var file = folder.createFile(blob.setName(safeName + '_' + prefix + '_' + (nombreArchivo || ('archivo' + ext))));
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {}
    return file.getUrl();
  } catch (err) {
    Logger.log('Error guardando archivo en Drive (' + prefix + '): ' + err);
    return '';
  }
}

function getOrCreateDriveFolder_(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}

function getOrCreateComprobantesFolder_() {
  return getOrCreateDriveFolder_(DRIVE_FOLDER_NAME);
}

function guessExtension_(mime, nombreArchivo) {
  if (nombreArchivo && nombreArchivo.indexOf('.') !== -1) {
    return nombreArchivo.substring(nombreArchivo.lastIndexOf('.'));
  }
  if (mime === 'application/pdf') return '.pdf';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  return '.jpg';
}

function parseFeriaLegalAcceptances_(data) {
  var legal = data.aceptacionesLegales || {};
  function yn(key) { return legal[key] ? 'Sí' : 'No'; }
  return [yn('aceptaVoluntaria'), yn('aceptaPertenencias'), yn('aceptaDatos'), yn('aceptaImagen')];
}

function parseLegalAcceptances_(data) {
  var legal = data.aceptacionesLegales || {};
  function yn(key) { return legal[key] ? 'Sí' : 'No'; }
  return [
    yn('aceptaVoluntaria'), yn('aceptaPertenencias'), yn('aceptaDatos'), yn('aceptaNoReembolso'),
    yn('aceptaDescalificacion'), yn('aceptaReglas'), yn('aceptaDisponibilidad'), yn('aceptaImagen')
  ];
}

function getSiteUrl_() {
  var props = PropertiesService.getScriptProperties();
  return String(props.getProperty('SITE_URL') || 'https://la-sucursal-del-cafe.web.app').replace(/\/$/, '');
}

function getReglasUrl_() {
  return getSiteUrl_() + '/reglas-v60-championship.html';
}

function buildWaMeUrl_(phone, text) {
  var digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  var url = 'https://wa.me/' + digits;
  if (text) url += '?text=' + encodeURIComponent(text);
  return url;
}

function getCompetenciaEventoLabel_(data) {
  var evento = String((data && data.evento) || ACTIVE_COMPETENCIA_EVENTO).trim();
  if (/preliminar\s*2/i.test(evento) || /2\.ª/i.test(evento)) {
    return { corto: '2.ª preliminar', tabla: 'Preliminar 2', evento: evento };
  }
  if (/preliminar\s*1/i.test(evento) || /1\.ª/i.test(evento)) {
    return { corto: '1.ª preliminar', tabla: 'Preliminar 1', evento: evento };
  }
  return { corto: '2.ª preliminar', tabla: 'Preliminar 2', evento: evento };
}

function getCompetenciaEventoFechaLugar_(data) {
  var evLabel = getCompetenciaEventoLabel_(data);
  if (evLabel.tabla === 'Preliminar 1') {
    return 'Edición realizada';
  }
  return PRELIMINAR2_FECHA + ' · ' + PRELIMINAR2_LUGAR;
}

function buildCompetenciaWaOrganizadorUrl_(data) {
  var nombre = String(data.nombre || 'Participante').trim();
  var id = String(data.id || '').trim();
  var label = getCompetenciaEventoLabel_(data).corto;
  var msg = 'Hola, me inscribí al V60 Championship (' + label + '). ' +
    'Nombre: ' + nombre + '. Inscripción: ' + (id || 'pendiente') + '. Confirmo mi participación.';
  return buildWaMeUrl_(WHATSAPP_ORGANIZADOR, msg);
}

function escapeHtml_(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCompetenciaEmailPlain_(data) {
  var id = data.id || '';
  var nombre = data.nombre || '';
  var reglasUrl = getReglasUrl_();
  var waOrganizador = buildCompetenciaWaOrganizadorUrl_(data);
  var tieneComprobante = !!(data.comprobanteArchivo && data.comprobanteArchivo.tieneComprobante);
  var evLabel = getCompetenciaEventoLabel_(data);
  var lines = [
    'Hola ' + nombre + ',',
    '',
    '¡Bienvenido/a al V60 Championship! Recibimos tu inscripción a la ' + evLabel.corto + ' del circuito de café filtrado con V60.',
    '',
    'Número de inscripción: ' + id,
    evLabel.tabla + ': ' + getCompetenciaEventoFechaLugar_(data),
    'Competencia principal: 29 y 30 de agosto de 2026 · Palmetto Plaza, Cali',
    'Pago: $90.000 COP a Nubank @mbl616 (Manuel Barraza)',
    '',
    '—— Reglamento (resumen) ——',
    '• Método obligatorio: V60 (extracción manual).',
    '• Circuito: 2 preliminares + final (29–30 ago 2026).',
    '• Formato por fecha: clasificatoria, semifinal y final.',
    '• Sin reembolso por retiro o no asistencia (salvo cancelación total del evento).',
    '• Tiempos por ronda: preparación 5 min, competencia 6 min, catación 5 min.',
    '• Debes cumplir protocolo y criterios del jurado.',
    'Reglamento completo: ' + reglasUrl,
    '',
    '—— WhatsApp del torneo ——',
    'Únete al grupo para avisos, logística y novedades:',
    WHATSAPP_GRUPO_COMPETENCIA,
    '',
    'Contacto con el organizador (mensaje prellenado):',
    waOrganizador,
    '',
    'Nota: WhatsApp no puede enviarse automáticamente desde este sistema; usa los enlaces anteriores para unirte al grupo o escribirnos.',
    ''
  ];
  if (tieneComprobante) {
    lines.push('Recibimos tu comprobante de pago. Validaremos tu pago y confirmaremos tu cupo.');
  } else {
    lines.push('Pendiente: realiza tu pago de $90.000 COP y envía el comprobante si aún no lo adjuntaste.');
  }
  lines.push('');
  lines.push('Dudas: ' + ORGANIZER_EMAIL);
  lines.push('');
  lines.push('— La Sucursal del Café');
  lines.push('V60 Championship · ' + evLabel.corto);
  return lines.join('\n');
}

function buildCompetenciaEmailHtml_(data) {
  var id = escapeHtml_(data.id || '');
  var nombre = escapeHtml_(data.nombre || '');
  var reglasUrl = escapeHtml_(getReglasUrl_());
  var grupoUrl = escapeHtml_(WHATSAPP_GRUPO_COMPETENCIA);
  var waOrganizador = escapeHtml_(buildCompetenciaWaOrganizadorUrl_(data));
  var organizerEmail = escapeHtml_(ORGANIZER_EMAIL);
  var tieneComprobante = !!(data.comprobanteArchivo && data.comprobanteArchivo.tieneComprobante);
  var evLabel = getCompetenciaEventoLabel_(data);
  var pagoNote = tieneComprobante
    ? 'Recibimos tu comprobante de pago. Validaremos los $90.000 COP en Nubank @mbl616 y te confirmaremos tu cupo.'
    : 'Pendiente: realiza tu pago de $90.000 COP a Nubank @mbl616 (Manuel Barraza) y envía el comprobante si aún no lo adjuntaste.';
  var btnStyle = 'display:inline-block;padding:12px 20px;margin:8px 8px 8px 0;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;';
  var btnGreen = btnStyle + 'background:#25D366;color:#ffffff;';
  var btnBrown = btnStyle + 'background:#5f4a3a;color:#ffffff;';

  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#3d2b1f;max-width:600px;">',
    '<p style="margin:0 0 16px;">Hola <strong>' + nombre + '</strong>,</p>',
    '<p style="margin:0 0 16px;">¡Bienvenido/a al <strong>V60 Championship</strong>! Recibimos tu inscripción a la <strong>' + escapeHtml_(evLabel.corto) + '</strong> del circuito de café filtrado con V60 (2 preliminares + final 29–30 ago 2026), organizado por La Sucursal del Café.</p>',
    '<table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:14px;">',
    '<tr><td style="padding:6px 0;color:#6b5344;width:38%;">Número de inscripción</td><td style="padding:6px 0;"><strong>' + id + '</strong></td></tr>',
    '<tr><td style="padding:6px 0;color:#6b5344;">' + escapeHtml_(evLabel.tabla) + '</td><td style="padding:6px 0;">' + escapeHtml_(getCompetenciaEventoFechaLugar_(data)) + '</td></tr>',
    '<tr><td style="padding:6px 0;color:#6b5344;">Competencia principal</td><td style="padding:6px 0;">29 y 30 de agosto de 2026 · Palmetto Plaza, Cali</td></tr>',
    '<tr><td style="padding:6px 0;color:#6b5344;">Pago</td><td style="padding:6px 0;">$90.000 COP · Nubank <strong>@mbl616</strong> (Manuel Barraza)</td></tr>',
    '</table>',
    '<h2 style="font-size:17px;color:#5f4a3a;margin:24px 0 10px;">Reglamento</h2>',
    '<ul style="margin:0 0 12px;padding-left:20px;">',
    '<li style="margin-bottom:6px;">Método obligatorio: <strong>V60</strong> (extracción manual).</li>',
    '<li style="margin-bottom:6px;">Circuito: 2 preliminares + final (29–30 ago 2026).</li>',
    '<li style="margin-bottom:6px;">Formato por fecha: clasificatoria, semifinal y final.</li>',
    '<li style="margin-bottom:6px;">Sin reembolso por retiro o no asistencia (salvo cancelación total del evento).</li>',
    '<li style="margin-bottom:6px;">Tiempos por ronda: preparación <strong>5 min</strong>, competencia <strong>6 min</strong>, catación <strong>5 min</strong>.</li>',
    '<li style="margin-bottom:6px;">Debes cumplir protocolo y criterios del jurado.</li>',
    '</ul>',
    '<p style="margin:0 0 20px;"><a href="' + reglasUrl + '" style="color:#8b4513;font-weight:600;">Ver reglamento completo en el sitio</a></p>',
    '<h2 style="font-size:17px;color:#5f4a3a;margin:24px 0 10px;">WhatsApp del torneo</h2>',
    '<p style="margin:0 0 12px;">Únete al grupo para recibir avisos, logística y novedades del V60 Championship:</p>',
    '<p style="margin:0 0 16px;"><a href="' + grupoUrl + '" style="' + btnGreen + '">Entrar al grupo de WhatsApp</a></p>',
    '<p style="margin:0 0 8px;font-size:14px;color:#6b5344;">¿Necesitas escribir al organizador? Abre WhatsApp con un mensaje prellenado:</p>',
    '<p style="margin:0 0 16px;"><a href="' + waOrganizador + '" style="' + btnBrown + '">Contactar por WhatsApp</a></p>',
    '<p style="margin:0 0 20px;padding:12px 14px;background:#f5f0ea;border-left:4px solid #bb5e3c;font-size:14px;">' + escapeHtml_(pagoNote) + '</p>',
    '<p style="margin:0 0 8px;font-size:13px;color:#888;">WhatsApp no puede enviarse automáticamente desde este sistema; usa los botones anteriores para unirte al grupo o contactarnos.</p>',
    '<p style="margin:16px 0 0;">Dudas: <a href="mailto:' + organizerEmail + '" style="color:#8b4513;">' + organizerEmail + '</a></p>',
    '<hr style="border:none;border-top:1px solid #e0d5c8;margin:24px 0;">',
    '<p style="margin:0;font-size:13px;color:#888;">— La Sucursal del Café<br>V60 Championship · ' + escapeHtml_(evLabel.corto) + '</p>',
    '</div>'
  ].join('');
}

function buildEmailBody_(formType, data) {
  var id = data.id || '';
  var nombre = data.nombre || '';
  var lines = ['Hola ' + nombre + ',', ''];

  if (formType === 'competencia') {
    return buildCompetenciaEmailPlain_(data);
  } else if (formType === 'lista_espera') {
    lines.push('Te registramos en la lista de espera del V60 Championship.');
    lines.push('Referencia: ' + id);
    lines.push('Te contactaremos si se libera un cupo.');
    lines.push('Dudas: ' + ORGANIZER_EMAIL);
  } else if (formType === 'stands') {
    var contacto = data.contacto || nombre;
    var esAliado = data.esAliadoPatrocinador ||
      isAliadoPatrocinadorPlan_(data.plan) ||
      isPatrocinadorAliadoTipo_(data.tipoParticipante, data.plan);
    if (esAliado) {
      lines.push('Recibimos tu solicitud como aliado o patrocinador de la feria La Sucursal del Café.');
      lines.push('Referencia: ' + id);
      lines.push('Marca: ' + (data.marca || ''));
      lines.push('Plan indicado: ' + (data.plan || 'Aliado Patrocinador'));
      lines.push('');
      lines.push('Tu solicitud será validada por el equipo — te contactaremos sobre el tipo de patrocinio y los siguientes pasos.');
      lines.push('Fechas del evento: 29 y 30 de agosto de 2026 · Palmetto Plaza, Cali');
      lines.push('');
      if (data.accessCode) {
        lines.push('Tu código de acceso al panel expositor: ' + data.accessCode);
        lines.push('Panel: ' + (data.expositorPanelUrl || getExpositorPanelUrl_()));
        lines.push('');
      }
      lines.push('Dudas: ' + ORGANIZER_EMAIL);
    } else {
      lines.push('Recibimos tu solicitud de stand para la feria de La Sucursal del Café.');
      lines.push('Referencia: ' + id);
      lines.push('Marca o negocio: ' + (data.marca || ''));
      if (data.standId) lines.push('Stand seleccionado: ' + data.standId);
      if (data.comparteStandLabel === 'Sí' || data.comparteStand) {
        lines.push('Comparte stand con otras marcas: Sí');
        var extras = data.marcasAdicionalesGuardadas || data.marcasAdicionales || [];
        if (extras.length) {
          lines.push('Marcas adicionales: ' + extras.map(function (m) { return m.nombre; }).join(', '));
        }
      }
      lines.push('Plan solicitado: ' + (data.plan || ''));
      lines.push('Fechas: 29 y 30 de agosto de 2026');
      lines.push('Sede: Palmetto Plaza, Cali');
      lines.push('');
      if (data.accessCode) {
        lines.push('Tu código de acceso al panel expositor: ' + data.accessCode);
        lines.push('Panel: ' + (data.expositorPanelUrl || getExpositorPanelUrl_()));
        lines.push('Ingresa con tu correo y este código para ver tu stand y novedades de la feria.');
        lines.push('');
      }
      lines.push('El equipo organizador revisará disponibilidad y te contactará por correo o WhatsApp para confirmar tu stand.');
      lines.push('Dudas: ' + ORGANIZER_EMAIL);
    }
  } else {
    return buildFeriaEmailPlain_(data);
  }

  lines.push('');
  lines.push('— La Sucursal del Café');
  return lines.join('\n');
}

function buildFeriaEmailPlain_(data) {
  var id = data.id || '';
  var nombre = data.nombre || '';
  var pasaporteUrl = getPasaporteUrl_(data);
  var tienePasaporte = !!(data && data.pasaporteId);
  var lines = [
    'Hola ' + nombre + ',',
    '',
    'Recibimos tu inscripción a la feria de La Sucursal del Café.',
    'Referencia: ' + id,
    'Fechas: 29 y 30 de agosto de 2026',
    'Sede: Palmetto Plaza, Cali',
    'La feria y el V60 Championship son eventos independientes (fechas y sedes distintas).',
    '',
    '☕ PASAPORTE CAFETERO (fidelización)',
    tienePasaporte
      ? 'Tu pasaporte digital ya está listo. Ábrelo, guárdalo en el celular y muestra el QR en cada stand:'
      : 'Crea tu tarjeta digital gratis, guárdala en el celular como app y muestra el QR en cada stand para acumular puntos:',
    pasaporteUrl,
    '',
    'En iPhone: abre el enlace → Compartir → Añadir a pantalla de inicio.',
    'En Android: Menú del navegador → Instalar aplicación o Añadir a pantalla de inicio.',
    '',
    'Dudas: ' + ORGANIZER_EMAIL
  ];
  return lines.join('\n');
}

function buildFeriaEmailHtml_(data) {
  var nombre = escapeHtml_(data.nombre || 'visitante');
  var id = escapeHtml_(data.id || '');
  var pasaporteUrl = getPasaporteUrl_(data);
  var tienePasaporte = !!(data && data.pasaporteId);
  var organizerEmail = escapeHtml_(ORGANIZER_EMAIL);
  var btnRed = 'display:inline-block;background:#C1272D;color:#fff;padding:14px 26px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;';
  return [
    '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#4B352A;line-height:1.55;">',
    '<div style="background:linear-gradient(135deg,#4B352A,#5D3A1A);color:#fff;padding:24px;border-radius:12px 12px 0 0;text-align:center;">',
    '<p style="margin:0 0 6px;font-size:13px;opacity:0.85;">La Sucursal del Café</p>',
    '<h1 style="margin:0;font-size:22px;">¡Inscripción recibida!</h1>',
    '</div>',
    '<div style="background:#f9f7f4;padding:24px;border-radius:0 0 12px 12px;">',
    '<p style="margin:0 0 12px;">Hola <strong>' + nombre + '</strong>,</p>',
    '<p style="margin:0 0 12px;">Quedaste registrado como visitante de la feria (ref. <strong>' + id + '</strong>).</p>',
    '<p style="margin:0 0 16px;font-size:14px;color:#6b5344;">📅 29 y 30 de agosto de 2026 · Palmetto Plaza, Cali</p>',
    '<div style="background:#fff;border:2px solid #D9D4C8;border-radius:12px;padding:18px;margin:0 0 18px;">',
    '<p style="margin:0 0 8px;font-size:18px;font-weight:700;">☕ Tu Pasaporte Cafetero</p>',
    '<p style="margin:0 0 14px;font-size:14px;">' + (tienePasaporte
      ? 'Tu pasaporte ya está activo. Guárdalo en el celular y muestra el QR en cada stand para sumar puntos.'
      : 'Tarjeta digital con QR. Cada stand que visites puede escanearla y sumarte puntos. Guárdala en tu celular como una app.') + '</p>',
    '<p style="margin:0 0 16px;text-align:center;"><a href="' + pasaporteUrl + '" style="' + btnRed + '">' +
      (tienePasaporte ? 'Abrir mi Pasaporte Cafetero' : 'Crear mi Pasaporte Cafetero') + '</a></p>',
    '<p style="margin:0;font-size:12px;color:#888;">iPhone: Compartir → Añadir a pantalla de inicio · Android: Instalar aplicación</p>',
    '</div>',
    '<p style="margin:0 0 8px;font-size:14px;">Dudas: <a href="mailto:' + organizerEmail + '" style="color:#8b4513;">' + organizerEmail + '</a></p>',
    '<hr style="border:none;border-top:1px solid #e0d5c8;margin:20px 0;">',
    '<p style="margin:0;font-size:12px;color:#888;">— La Sucursal del Café · Apoya lo nuestro, toma café colombiano.</p>',
    '</div>',
    '</div>'
  ].join('');
}

function sendConfirmationEmail_(formType, data) {
  var correo = normalizeEmail_(data.correo);
  if (!correo || correo.indexOf('@') === -1) return;

  var subject = 'Inscripción recibida — La Sucursal del Café';
  if (formType === 'competencia') subject = 'V60 Championship — inscripción ' + (data.id || '');
  if (formType === 'lista_espera') subject = 'Lista de espera — V60 Championship';
  if (formType === 'stands') subject = 'Solicitud de stand recibida — ' + (data.marca || data.id || '');
  if (formType === 'feria') subject = 'Tu inscripción + Pasaporte Cafetero — La Sucursal del Café';

  try {
    if (formType === 'competencia') {
      MailApp.sendEmail({
        to: correo,
        subject: subject,
        body: buildCompetenciaEmailPlain_(data),
        htmlBody: buildCompetenciaEmailHtml_(data),
        name: 'La Sucursal del Café'
      });
    } else if (formType === 'feria') {
      MailApp.sendEmail({
        to: correo,
        subject: subject,
        body: buildFeriaEmailPlain_(data),
        htmlBody: buildFeriaEmailHtml_(data),
        name: 'La Sucursal del Café'
      });
    } else {
      MailApp.sendEmail(correo, subject, buildEmailBody_(formType, data));
    }
  } catch (err) {
    Logger.log('No se pudo enviar correo a ' + correo + ': ' + err);
  }
}

function getOrganizerRecipients_() {
  return String(ORGANIZER_EMAIL || '')
    .split(',')
    .map(function (email) { return email.trim(); })
    .filter(function (email) { return email.indexOf('@') !== -1; });
}

function buildOrganizerAlertBody_(formType, data) {
  var id = data.id || '(sin id)';
  var nombre = data.nombre || '(sin nombre)';
  var lines = ['Nueva actividad en el formulario web — La Sucursal del Café', ''];

  if (formType === 'competencia') {
    lines.push('Formulario: V60 Championship (competencia)');
    lines.push('ID: ' + id);
    lines.push('Nombre: ' + nombre);
    lines.push('Documento: ' + (data.documento || ''));
    lines.push('Correo: ' + (data.correo || ''));
    lines.push('Celular: ' + (data.celular || ''));
    lines.push('Ciudad: ' + (data.ciudad || ''));
    lines.push('Representa: ' + (data.representa || ''));
    lines.push('Rol: ' + (data.rol || ''));
    lines.push('Tiene comprobante: ' + (data.comprobanteArchivo && data.comprobanteArchivo.tieneComprobante ? 'Sí' : 'No'));
    lines.push('');
    lines.push('Revisa la hoja "' + SHEET_COMPETENCIA + '" en Google Sheets para el detalle completo.');
  } else if (formType === 'stands') {
    var esAliadoAlert = data.esAliadoPatrocinador ||
      isAliadoPatrocinadorPlan_(data.plan) ||
      isPatrocinadorAliadoTipo_(data.tipoParticipante, data.plan);
    if (esAliadoAlert) {
      lines.push('Formulario: Solicitud aliado / patrocinador (validación pendiente)');
      lines.push('ID: ' + id);
      lines.push('Marca: ' + (data.marca || ''));
      lines.push('Contacto: ' + (data.contacto || nombre));
      lines.push('Correo: ' + (data.correo || ''));
      lines.push('Celular: ' + (data.celular || ''));
      lines.push('Plan: ' + (data.plan || ''));
      lines.push('Tipo participante: ' + (data.tipoParticipante || ''));
      lines.push('Descripción: ' + (data.descripcion || ''));
      lines.push('');
      lines.push('ACCIÓN: Validar tipo de patrocinio y contactar al solicitante. No requiere stand en mapa.');
      lines.push('Revisa la hoja "' + SHEET_STANDS + '" en Google Sheets para el detalle completo.');
    } else {
      lines.push('Formulario: Solicitud de stand (expositor)');
      lines.push('ID: ' + id);
      lines.push('Marca o negocio: ' + (data.marca || ''));
      lines.push('Contacto: ' + (data.contacto || nombre));
      lines.push('Correo: ' + (data.correo || ''));
      lines.push('Celular: ' + (data.celular || ''));
      lines.push('Plan: ' + (data.plan || ''));
      if (data.standId) lines.push('Stand ID: ' + data.standId);
      if (data.comparteStandLabel === 'Sí' || data.comparteStand) {
        lines.push('Comparte stand: Sí');
        var marcasAlert = data.marcasAdicionalesGuardadas || data.marcasAdicionales || [];
        if (marcasAlert.length) {
          lines.push('Marcas adicionales: ' + marcasAlert.map(function (m) { return m.nombre; }).join(', '));
        }
      }
      lines.push('Ciudad: ' + (data.ciudad || ''));
      lines.push('Descripción: ' + (data.descripcion || ''));
      lines.push('');
      lines.push('Revisa la hoja "' + SHEET_STANDS + '" en Google Sheets para el detalle completo.');
    }
  } else if (formType === 'lista_espera') {
    lines.push('Formulario: Lista de espera (V60 Championship)');
    lines.push('ID: ' + id);
    lines.push('Nombre: ' + nombre);
    lines.push('Documento: ' + (data.documento || ''));
    lines.push('Correo: ' + (data.correo || ''));
    lines.push('Celular: ' + (data.celular || ''));
    lines.push('Motivo: ' + (data.motivo || 'Cupo completo'));
    lines.push('');
    lines.push('Revisa la hoja "' + SHEET_LISTA_ESPERA + '" en Google Sheets.');
  } else {
    var intereses = Array.isArray(data.intereses) ? data.intereses.join(', ') : String(data.intereses || '');
    lines.push('Formulario: Feria de café');
    lines.push('ID: ' + id);
    lines.push('Nombre: ' + nombre);
    lines.push('Edad: ' + (data.edad || ''));
    lines.push('Correo: ' + (data.correo || ''));
    lines.push('Celular: ' + (data.celular || ''));
    lines.push('Intereses: ' + (intereses || '(ninguno)'));
    if (data.pasaporteId) {
      lines.push('Pasaporte ID: ' + data.pasaporteId);
      lines.push('Enlace pasaporte: ' + getPasaporteUrl_(data));
    } else {
      lines.push('Pasaporte Cafetero (enlace enviado al visitante): ' + getPasaporteRegistroUrl_(data));
    }
    lines.push('');
    lines.push('Revisa la hoja "' + SHEET_FERIA + '" en Google Sheets para el detalle completo.');
  }

  lines.push('');
  lines.push('— Alerta automática del sitio de inscripciones');
  return lines.join('\n');
}

function buildOrganizerAlertSubject_(formType, data) {
  var nombre = data.nombre || 'Participante';
  var id = data.id || '';
  if (formType === 'competencia') {
    return '[V60 Championship] Nueva inscripción — ' + nombre + (id ? ' (' + id + ')' : '');
  }
  if (formType === 'stands') {
    if (data.esAliadoPatrocinador || isAliadoPatrocinadorPlan_(data.plan)) {
      return '[Aliado/Patrocinador] Validar solicitud — ' + (data.marca || nombre) + (id ? ' (' + id + ')' : '');
    }
    return '[Stand] Nueva solicitud — ' + (data.marca || nombre) + (id ? ' (' + id + ')' : '');
  }
  if (formType === 'lista_espera') {
    return '[Lista de espera] ' + nombre + (id ? ' (' + id + ')' : '');
  }
  return '[Feria] Nueva inscripción — ' + nombre + (id ? ' (' + id + ')' : '');
}

// Notifica al equipo cada vez que se registra alguien (feria, competencia o lista de espera).
function sendOrganizerNotificationEmail_(formType, data) {
  var recipients = getOrganizerRecipients_();
  if (!recipients.length) return;

  var subject = buildOrganizerAlertSubject_(formType, data);
  var body = buildOrganizerAlertBody_(formType, data);

  recipients.forEach(function (to) {
    try {
      MailApp.sendEmail(to, subject, body);
    } catch (err) {
      Logger.log('No se pudo enviar alerta al organizador (' + to + '): ' + err);
    }
  });
}

function jsonResponse(obj, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// —— Admin y analíticas (Firebase ID token + correo autorizado) ——

var ALLOWED_ADMIN_EMAIL = 'lasucursaldelcafe@gmail.com';
var FIREBASE_PROJECT_ID = 'la-sucursal-del-cafe';

function getAllowedAdminEmail_() {
  var props = PropertiesService.getScriptProperties();
  return String(props.getProperty('ALLOWED_ADMIN_EMAIL') || ALLOWED_ADMIN_EMAIL).trim().toLowerCase();
}

/**
 * Configura el correo admin en Propiedades del script (opcional; el valor por defecto ya está en código).
 * configurarAdminEmail('lasucursaldelcafe@gmail.com');
 */
function configurarAdminEmail(email) {
  if (!email) {
    throw new Error('Correo admin requerido.');
  }
  PropertiesService.getScriptProperties().setProperty(
    'ALLOWED_ADMIN_EMAIL',
    String(email).trim().toLowerCase()
  );
  Logger.log('Correo admin configurado: ' + email);
}

/** @deprecated Login con contraseña eliminado — usar Firebase Google Sign-In. */
function configurarCredencialesAdmin(username, password) {
  Logger.log('configurarCredencialesAdmin está obsoleto. Usa Firebase Auth en /admin.');
}

function verifyFirebaseIdToken_(idToken) {
  if (!idToken) return null;
  try {
    var url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) return null;

    var data = JSON.parse(resp.getContentText());
    var aud = String(data.aud || '');
    if (aud !== FIREBASE_PROJECT_ID) return null;

    var email = String(data.email || '').trim().toLowerCase();
    if (email !== getAllowedAdminEmail_()) return null;
    if (String(data.email_verified) !== 'true') return null;

    var now = Math.floor(Date.now() / 1000);
    if (data.exp && Number(data.exp) < now) return null;

    return email;
  } catch (err) {
    Logger.log('verifyFirebaseIdToken_: ' + err);
    return null;
  }
}

/** Alias público — requiere Firebase ID token válido. */
function adminGetDashboard(idToken) {
  return handleAdminDashboard_(idToken);
}

/** Alias público — registra una visita de prueba. */
function trackPageview(path, title) {
  return trackPageview_({ path: path || '/', title: title || '' });
}

function trackPageview_(payload) {
  var sheet = getOrCreateSheet_(SHEET_ANALYTICS, HEADERS_ANALYTICS);
  var path = String(payload.path || '/').substring(0, 200);
  var title = String(payload.title || '').substring(0, 120);
  var referrer = String(payload.referrer || '').substring(0, 300);
  var sessionId = String(payload.sessionId || '').substring(0, 64);
  var ua = String(payload.userAgent || '').substring(0, 120);

  sheet.appendRow([
    new Date().toISOString(),
    path,
    title,
    referrer,
    sessionId,
    ua
  ]);

  return jsonResponse({ ok: true });
}

function rowObjectFromValues_(headers, values) {
  var row = {};
  headers.forEach(function (h, idx) {
    var val = values[idx];
    if (val instanceof Date) {
      row[h] = val.toISOString();
    } else {
      row[h] = val === '' ? '' : String(val);
    }
  });
  return row;
}

function readSheetRows_(sheetName, headers, maxRows) {
  var sheet = getOrCreateSheet_(sheetName, headers);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var startRow = Math.max(2, lastRow - maxRows + 1);
  var values = sheet.getRange(startRow, 1, lastRow, headers.length).getValues();
  var rows = [];

  for (var i = values.length - 1; i >= 0; i--) {
    rows.push(rowObjectFromValues_(headers, values[i]));
  }
  return rows;
}

/** Todas las filas de una hoja (newestFirst = true → más recientes primero). */
function readAllSheetRows_(sheetName, headers, newestFirst) {
  var sheet = getOrCreateSheet_(sheetName, headers);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var values = sheet.getRange(2, 1, lastRow, headers.length).getValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    rows.push(rowObjectFromValues_(headers, values[i]));
  }
  if (newestFirst) rows.reverse();
  return rows;
}

function rowsToCsv_(headers, rows) {
  function esc(val) {
    var s = val === null || val === undefined ? '' : String(val);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  var lines = [headers.map(esc).join(',')];
  rows.forEach(function (row) {
    lines.push(headers.map(function (h) { return esc(row[h] || ''); }).join(','));
  });
  return '\uFEFF' + lines.join('\r\n');
}

function assertAdminAccess_(idToken) {
  if (!idToken) {
    return { ok: true, adminEmail: null };
  }
  var adminEmail = verifyFirebaseIdToken_(idToken);
  if (!adminEmail) {
    return { ok: false, error: 'Token inválido.' };
  }
  return { ok: true, adminEmail: adminEmail };
}

function sanitizeCompetenciaRow_(row) {
  if (row['Comprobante base64 (preview)']) {
    row['Comprobante base64 (preview)'] = '(omitido)';
  }
  return row;
}

function parseAnalyticsTimestamp_(ts) {
  if (ts instanceof Date && !isNaN(ts.getTime())) return ts;
  if (typeof ts === 'number' && !isNaN(ts)) return new Date(ts);
  if (typeof ts === 'string' && ts) {
    var parsed = new Date(ts);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function getAnalyticsStats_() {
  var sheet = getOrCreateSheet_(SHEET_ANALYTICS, HEADERS_ANALYTICS);
  var lastRow = sheet.getLastRow();
  var total = lastRow > 1 ? lastRow - 1 : 0;
  var todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  var visitsToday = 0;
  var visitsFeriaPageToday = 0;
  var visitsCompetenciaPageToday = 0;
  var pageCountsToday = {};
  var pageCountsAll = {};
  var uniquePathsToday = {};
  var uniquePathsAll = {};

  if (lastRow >= 2) {
    var data = sheet.getRange(2, 1, lastRow, 2).getValues();
    for (var i = 0; i < data.length; i++) {
      var ts = parseAnalyticsTimestamp_(data[i][0]);
      var path = String(data[i][1] || '/').toLowerCase();
      var key = path || '/';

      pageCountsAll[key] = (pageCountsAll[key] || 0) + 1;
      uniquePathsAll[key] = true;

      if (!ts || ts < todayStart) continue;

      visitsToday++;
      if (path.indexOf('inscripcion') !== -1) visitsFeriaPageToday++;
      if (path.indexOf('competencia') !== -1) visitsCompetenciaPageToday++;
      pageCountsToday[key] = (pageCountsToday[key] || 0) + 1;
      uniquePathsToday[key] = true;
    }
  }

  return {
    total: total,
    today: visitsToday,
    feriaPageToday: visitsFeriaPageToday,
    competenciaPageToday: visitsCompetenciaPageToday,
    uniquePathsToday: Object.keys(uniquePathsToday).length,
    uniquePathsTotal: Object.keys(uniquePathsAll).length,
    topPagesToday: pageCountsToday,
    topPagesAll: pageCountsAll
  };
}

function isPublicAdminAllowed_() {
  var flag = PropertiesService.getScriptProperties().getProperty('ALLOW_PUBLIC_ADMIN');
  if (flag === 'false') return false;
  return true;
}

/** Activa/desactiva dashboard sin token (fallback cuando OAuth no funciona). */
function configurarAdminPublico(permitir) {
  PropertiesService.getScriptProperties().setProperty(
    'ALLOW_PUBLIC_ADMIN',
    permitir ? 'true' : 'false'
  );
  Logger.log('ALLOW_PUBLIC_ADMIN=' + (permitir ? 'true' : 'false'));
}

function competenciaDisplayHeaders_() {
  return HEADERS_COMPETENCIA.filter(function (h) {
    return h !== 'Comprobante base64 (preview)';
  });
}

function handleAdminDashboard_(idToken) {
  var access = assertAdminAccess_(idToken);
  if (!access.ok) {
    return jsonResponse({ ok: false, error: access.error }, 401);
  }

  var feriaCount = getSheetRowCount_(SHEET_FERIA, HEADERS_FERIA);
  var competenciaCount = getCompetenciaCount_();
  var standsCount = getSheetRowCount_(SHEET_STANDS, HEADERS_STANDS);
  var listaCount = getSheetRowCount_(SHEET_LISTA_ESPERA, HEADERS_LISTA_ESPERA);
  var analytics = getAnalyticsStats_();

  var feriaConv = analytics.feriaPageToday > 0
    ? Math.round((feriaCount / analytics.feriaPageToday) * 100)
    : 0;
  var compConv = analytics.competenciaPageToday > 0
    ? Math.round((competenciaCount / analytics.competenciaPageToday) * 100)
    : 0;

  var allFeria = readAllSheetRows_(SHEET_FERIA, HEADERS_FERIA, true);
  var allCompetencia = readAllSheetRows_(SHEET_COMPETENCIA, HEADERS_COMPETENCIA, true)
    .map(sanitizeCompetenciaRow_);
  var allStands = readAllSheetRows_(SHEET_STANDS, HEADERS_STANDS, true);
  var allPatrocinadoresCompetencia = readPatrocinadoresCompetenciaRows_();

  return jsonResponse({
    ok: true,
    generatedAt: new Date().toISOString(),
    stats: {
      visitsToday: analytics.today,
      visitsTotal: analytics.total,
      feriaRegistrations: feriaCount,
      competenciaRegistrations: competenciaCount,
      standsRegistrations: standsCount,
      listaEspera: listaCount,
      competenciaCupo: {
        count: competenciaCount,
        max: CUPO_MAX_COMPETENCIA,
        disponibles: Math.max(0, CUPO_MAX_COMPETENCIA - competenciaCount),
        completo: competenciaCount >= CUPO_MAX_COMPETENCIA
      },
      competenciaPorEdicion: {
        preliminar1: getCompetenciaCount_('V60 Championship — Preliminar 1'),
        preliminar2: getCompetenciaCount_('V60 Championship — Preliminar 2')
      },
      feriaPageViewsToday: analytics.feriaPageToday,
      competenciaPageViewsToday: analytics.competenciaPageToday,
      conversionFeriaPct: feriaConv,
      conversionCompetenciaPct: compConv,
      uniquePathsToday: analytics.uniquePathsToday,
      uniquePathsTotal: analytics.uniquePathsTotal,
      topPagesToday: analytics.topPagesToday,
      topPagesAll: analytics.topPagesAll,
      analyticsSource: 'sheet_pageviews'
    },
    feriaColumns: HEADERS_FERIA,
    competenciaColumns: competenciaDisplayHeaders_(),
    standsColumns: HEADERS_STANDS,
    patrocinadoresCompetenciaColumns: HEADERS_PATROCINADORES_COMPETENCIA,
    allFeria: allFeria,
    allCompetencia: allCompetencia,
    allStands: allStands,
    allPatrocinadoresCompetencia: allPatrocinadoresCompetencia
  });
}

function handleAdminExport_(idToken, dataset) {
  var access = assertAdminAccess_(idToken);
  if (!access.ok) {
    return jsonResponse({ ok: false, error: access.error }, 401);
  }

  dataset = String(dataset || '').toLowerCase();
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  if (dataset === 'feria') {
    var feriaRows = readAllSheetRows_(SHEET_FERIA, HEADERS_FERIA, false);
    return jsonResponse({
      ok: true,
      dataset: 'feria',
      filename: 'feria-inscritos-' + stamp + '.csv',
      csv: rowsToCsv_(HEADERS_FERIA, feriaRows)
    });
  }

  if (dataset === 'competencia') {
    var compRows = readAllSheetRows_(SHEET_COMPETENCIA, HEADERS_COMPETENCIA, false)
      .map(sanitizeCompetenciaRow_);
    return jsonResponse({
      ok: true,
      dataset: 'competencia',
      filename: 'switch-championship-' + stamp + '.csv',
      csv: rowsToCsv_(HEADERS_COMPETENCIA, compRows)
    });
  }

  if (dataset === 'stands') {
    var standsRows = readAllSheetRows_(SHEET_STANDS, HEADERS_STANDS, false);
    return jsonResponse({
      ok: true,
      dataset: 'stands',
      filename: 'stands-expositores-' + stamp + '.csv',
      csv: rowsToCsv_(HEADERS_STANDS, standsRows)
    });
  }

  if (dataset === 'analytics') {
    var analyticsRows = readAllSheetRows_(SHEET_ANALYTICS, HEADERS_ANALYTICS, false);
    return jsonResponse({
      ok: true,
      dataset: 'analytics',
      filename: 'analytics-' + stamp + '.csv',
      csv: rowsToCsv_(HEADERS_ANALYTICS, analyticsRows)
    });
  }

  if (dataset === 'lista_espera') {
    var listaRows = readAllSheetRows_(SHEET_LISTA_ESPERA, HEADERS_LISTA_ESPERA, false);
    return jsonResponse({
      ok: true,
      dataset: 'lista_espera',
      filename: 'lista-espera-' + stamp + '.csv',
      csv: rowsToCsv_(HEADERS_LISTA_ESPERA, listaRows)
    });
  }

  if (dataset === 'all') {
    return jsonResponse({
      ok: true,
      dataset: 'all',
      files: [
        {
          filename: 'feria-inscritos-' + stamp + '.csv',
          csv: rowsToCsv_(HEADERS_FERIA, readAllSheetRows_(SHEET_FERIA, HEADERS_FERIA, false))
        },
        {
          filename: 'switch-championship-' + stamp + '.csv',
          csv: rowsToCsv_(
            HEADERS_COMPETENCIA,
            readAllSheetRows_(SHEET_COMPETENCIA, HEADERS_COMPETENCIA, false).map(sanitizeCompetenciaRow_)
          )
        },
        {
          filename: 'stands-expositores-' + stamp + '.csv',
          csv: rowsToCsv_(HEADERS_STANDS, readAllSheetRows_(SHEET_STANDS, HEADERS_STANDS, false))
        },
        {
          filename: 'analytics-' + stamp + '.csv',
          csv: rowsToCsv_(HEADERS_ANALYTICS, readAllSheetRows_(SHEET_ANALYTICS, HEADERS_ANALYTICS, false))
        },
        {
          filename: 'lista-espera-' + stamp + '.csv',
          csv: rowsToCsv_(HEADERS_LISTA_ESPERA, readAllSheetRows_(SHEET_LISTA_ESPERA, HEADERS_LISTA_ESPERA, false))
        }
      ]
    });
  }

  return jsonResponse({
    ok: false,
    error: 'dataset inválido. Usa: feria, competencia, stands, analytics, lista_espera, all'
  }, 400);
}

function getSheetRowCount_(sheetName, headers) {
  var sheet = getOrCreateSheet_(sheetName, headers);
  var lastRow = sheet.getLastRow();
  return lastRow > 1 ? lastRow - 1 : 0;
}

// --- Pasaporte Cafetero (respaldo en Google Sheets cuando Firestore no está disponible) ---

function calcularNivelPasaporte_(puntosHistoricos) {
  var pts = parseInt(puntosHistoricos, 10) || 0;
  if (pts >= 1000) return 'Diamante';
  if (pts >= 500) return 'Oro';
  if (pts >= 200) return 'Plata';
  return 'Bronce';
}

function pasaporteRowToClient_(row) {
  if (!row) return null;
  return {
    id: row['ID'] || '',
    nombre: row['Nombre'] || '',
    telefono: row['Teléfono'] || '',
    email: row['Correo'] || '',
    puntos: parseInt(row['Puntos'], 10) || 0,
    puntosHistoricos: parseInt(row['Puntos históricos'], 10) || 0,
    nivel: row['Nivel'] || 'Bronce',
    activo: String(row['Activo'] || 'Sí').toLowerCase() !== 'no',
    origen: row['Origen'] || '',
    fechaRegistro: row['Fecha registro'] || ''
  };
}

function findPasaporteRowById_(id) {
  var sheet = getOrCreateSheet_(SHEET_PASAPORTES, HEADERS_PASAPORTES);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2 || !id) return null;
  var values = sheet.getRange(2, 1, lastRow, HEADERS_PASAPORTES.length).getValues();
  for (var i = 0; i < values.length; i++) {
    var row = rowObjectFromValues_(HEADERS_PASAPORTES, values[i]);
    if (row['ID'] === id) return { sheet: sheet, rowNum: i + 2, row: row };
  }
  return null;
}

function findPasaporteRowByTelefono_(telefono) {
  var tel = normalizePasaporteTelefono_(telefono);
  if (!tel) return null;
  var sheet = getOrCreateSheet_(SHEET_PASAPORTES, HEADERS_PASAPORTES);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var values = sheet.getRange(2, 1, lastRow, HEADERS_PASAPORTES.length).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    var row = rowObjectFromValues_(HEADERS_PASAPORTES, values[i]);
    var rowTel = normalizePasaporteTelefono_(row['Teléfono']);
    if (rowTel && rowTel === tel) return { sheet: sheet, rowNum: i + 2, row: row };
  }
  return null;
}

function normalizePasaporteTelefono_(telefono) {
  return String(telefono || '').replace(/\D/g, '');
}

function normalizePasaporteNombre_(nombre) {
  return String(nombre || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isPasaporteEmailValido_(email) {
  var e = String(email || '').trim().toLowerCase();
  return !!e && e.indexOf('@') !== -1 && e.indexOf('.') !== -1;
}

function findPasaporteRowByCredentials_(nombre, telefono) {
  var found = findPasaporteRowByTelefono_(telefono);
  if (!found) return null;
  var nombreNorm = normalizePasaporteNombre_(nombre);
  var rowNombre = normalizePasaporteNombre_(found.row['Nombre']);
  if (!nombreNorm || nombreNorm !== rowNombre) return null;
  if (String(found.row['Activo'] || '').trim().toLowerCase() === 'no') return null;
  return found;
}

function handlePasaporteLogin_(payload) {
  var nombre = String(payload.nombre || '').trim();
  var telefono = String(payload.telefono || payload.celular || '').trim();
  if (!nombre || !telefono) {
    return { ok: false, error: 'Nombre y celular son obligatorios.' };
  }
  var found = findPasaporteRowByCredentials_(nombre, telefono);
  if (!found) {
    return { ok: false, error: 'Nombre o celular incorrectos. Revisa que coincidan con tu registro.' };
  }
  return {
    ok: true,
    id: found.row['ID'],
    cliente: pasaporteRowToClient_(found.row)
  };
}

function getPasaporteCliente_(id) {
  var found = findPasaporteRowById_(id);
  if (!found) return { ok: false, error: 'Pasaporte no encontrado.' };
  return { ok: true, cliente: pasaporteRowToClient_(found.row) };
}

function listPasaportesAdmin_(limit) {
  var max = Math.min(Math.max(limit || 50, 1), 200);
  var rows = readAllSheetRows_(SHEET_PASAPORTES, HEADERS_PASAPORTES, true).slice(0, max);
  return {
    ok: true,
    clientes: rows.map(pasaporteRowToClient_).filter(function (c) { return c && c.id; })
  };
}

function listPasaporteTransacciones_(clienteId, limit) {
  var max = Math.min(Math.max(limit || 20, 1), 100);
  var sheet = getOrCreateSheet_(SHEET_PASAPORTE_TX, HEADERS_PASAPORTE_TX);
  var lastRow = sheet.getLastRow();
  var items = [];
  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow, HEADERS_PASAPORTE_TX.length).getValues();
    for (var i = values.length - 1; i >= 0; i--) {
      var row = rowObjectFromValues_(HEADERS_PASAPORTE_TX, values[i]);
      if (clienteId && row['Cliente ID'] !== clienteId) continue;
      items.push({
        id: row['ID'] || '',
        clienteId: row['Cliente ID'] || '',
        tipo: row['Tipo'] || '',
        puntos: parseInt(row['Puntos'], 10) || 0,
        descripcion: row['Descripción'] || '',
        sede: row['Sede'] || '',
        operadorId: row['Operador ID'] || '',
        fecha: row['Fecha'] || ''
      });
      if (items.length >= max) break;
    }
  }
  return { ok: true, transacciones: items };
}

function handlePasaporteCreate_(payload) {
  var nombre = String(payload.nombre || '').trim();
  var telefono = String(payload.telefono || payload.celular || '').trim();
  var correo = String(payload.email || payload.correo || '').trim().toLowerCase();
  if (!nombre) return { ok: false, error: 'Nombre obligatorio.' };
  if (!telefono) return { ok: false, error: 'Celular obligatorio.' };
  if (!isPasaporteEmailValido_(correo)) {
    return { ok: false, error: 'Correo electrónico válido obligatorio.' };
  }

  var existing = findPasaporteRowByTelefono_(telefono);
  if (existing) {
    return { ok: true, id: existing.row['ID'], existed: true, cliente: pasaporteRowToClient_(existing.row) };
  }

  var id = String(payload.id || ('PAS-' + Date.now().toString(36).toUpperCase())).trim();
  var sheet = getOrCreateSheet_(SHEET_PASAPORTES, HEADERS_PASAPORTES);
  sheet.appendRow([
    new Date().toISOString(),
    id,
    nombre,
    telefono,
    correo,
    0,
    0,
    'Bronce',
    'Sí',
    String(payload.origen || 'registro').trim()
  ]);

  return {
    ok: true,
    id: id,
    existed: false,
    cliente: {
      id: id,
      nombre: nombre,
      telefono: telefono,
      email: correo,
      puntos: 0,
      puntosHistoricos: 0,
      nivel: 'Bronce',
      activo: true,
      origen: payload.origen || 'registro'
    }
  };
}

function handlePasaporteTransaccion_(payload) {
  var clienteId = String(payload.clienteId || '').trim();
  var tipo = String(payload.tipo || 'acumulacion').trim();
  var puntos = parseInt(payload.puntos, 10) || 0;
  if (!clienteId || !puntos) return { ok: false, error: 'clienteId y puntos son obligatorios.' };

  var found = findPasaporteRowById_(clienteId);
  if (!found) return { ok: false, error: 'Cliente no encontrado.' };

  var delta = tipo === 'canje' ? -Math.abs(puntos) : Math.abs(puntos);
  var data = found.row;
  var nuevosPuntos = (parseInt(data['Puntos'], 10) || 0) + delta;
  if (nuevosPuntos < 0) return { ok: false, error: 'El cliente no tiene suficientes puntos para este canje.' };
  var nuevosHistoricos = (parseInt(data['Puntos históricos'], 10) || 0) + (delta > 0 ? delta : 0);
  var nivel = calcularNivelPasaporte_(nuevosHistoricos);

  found.sheet.getRange(found.rowNum, 6).setValue(nuevosPuntos);
  found.sheet.getRange(found.rowNum, 7).setValue(nuevosHistoricos);
  found.sheet.getRange(found.rowNum, 8).setValue(nivel);

  var txSheet = getOrCreateSheet_(SHEET_PASAPORTE_TX, HEADERS_PASAPORTE_TX);
  txSheet.appendRow([
    new Date().toISOString(),
    'TX-' + Date.now().toString(36).toUpperCase(),
    clienteId,
    tipo,
    delta,
    String(payload.descripcion || '').trim(),
    String(payload.sede || '').trim(),
    String(payload.operadorId || '').trim()
  ]);

  return {
    ok: true,
    clienteId: clienteId,
    puntos: nuevosPuntos,
    puntosHistoricos: nuevosHistoricos,
    nivel: nivel
  };
}

function listPasaporteOperadores_() {
  var rows = readAllSheetRows_(SHEET_PASAPORTE_OPS, HEADERS_PASAPORTE_OPS, false);
  var operadores = rows.map(function (row) {
    return {
      id: row['ID'] || '',
      standNombre: row['Stand nombre'] || '',
      usuario: row['Usuario'] || '',
      puntosPorEscaneo: parseInt(row['Puntos por escaneo'], 10) || 10,
      activo: String(row['Activo'] || 'Sí').toLowerCase() !== 'no'
    };
  });
  return { ok: true, operadores: operadores };
}

function handlePasaporteOperadorCreate_(payload) {
  var usuario = String(payload.usuario || '').trim().toLowerCase();
  var standNombre = String(payload.standNombre || '').trim();
  var pinHash = String(payload.pinHash || '').trim();
  if (!usuario || usuario.length < 3) return { ok: false, error: 'Usuario inválido (mínimo 3 caracteres).' };
  if (!standNombre) return { ok: false, error: 'Nombre del stand es obligatorio.' };
  if (!pinHash) return { ok: false, error: 'PIN hash requerido.' };

  var sheet = getOrCreateSheet_(SHEET_PASAPORTE_OPS, HEADERS_PASAPORTE_OPS);
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow, HEADERS_PASAPORTE_OPS.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var row = rowObjectFromValues_(HEADERS_PASAPORTE_OPS, values[i]);
      if (String(row['Usuario'] || '').toLowerCase() === usuario) {
        return { ok: false, error: 'Ese usuario ya existe.' };
      }
    }
  }

  var id = 'OP-' + Date.now().toString(36).toUpperCase();
  sheet.appendRow([
    new Date().toISOString(),
    id,
    standNombre,
    usuario,
    pinHash,
    parseInt(payload.puntosPorEscaneo, 10) || 10,
    'Sí'
  ]);

  return { ok: true, id: id, usuario: usuario, standNombre: standNombre };
}

function handlePasaporteOperadorVerify_(payload) {
  var usuario = String(payload.usuario || '').trim().toLowerCase();
  var pinHash = String(payload.pinHash || '').trim();
  if (!usuario || !pinHash) return { ok: false, error: 'Usuario y PIN son obligatorios.' };

  var sheet = getOrCreateSheet_(SHEET_PASAPORTE_OPS, HEADERS_PASAPORTE_OPS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: false, error: 'Usuario o PIN incorrectos.' };

  var values = sheet.getRange(2, 1, lastRow, HEADERS_PASAPORTE_OPS.length).getValues();
  for (var i = 0; i < values.length; i++) {
    var row = rowObjectFromValues_(HEADERS_PASAPORTE_OPS, values[i]);
    if (String(row['Usuario'] || '').toLowerCase() !== usuario) continue;
    if (String(row['Activo'] || 'Sí').toLowerCase() === 'no') {
      return { ok: false, error: 'Este operador está desactivado.' };
    }
    if (String(row['PIN hash'] || '') !== pinHash) {
      return { ok: false, error: 'Usuario o PIN incorrectos.' };
    }
    return {
      ok: true,
      operador: {
        id: row['ID'] || '',
        standNombre: row['Stand nombre'] || '',
        usuario: row['Usuario'] || '',
        puntosPorEscaneo: parseInt(row['Puntos por escaneo'], 10) || 10
      }
    };
  }
  return { ok: false, error: 'Usuario o PIN incorrectos.' };
}

function handlePasaporteOperadorToggle_(payload) {
  var id = String(payload.id || '').trim();
  var activo = payload.activo !== false && payload.activo !== 'false';
  if (!id) return { ok: false, error: 'ID de operador requerido.' };

  var sheet = getOrCreateSheet_(SHEET_PASAPORTE_OPS, HEADERS_PASAPORTE_OPS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: false, error: 'Operador no encontrado.' };

  var values = sheet.getRange(2, 1, lastRow, HEADERS_PASAPORTE_OPS.length).getValues();
  for (var i = 0; i < values.length; i++) {
    var row = rowObjectFromValues_(HEADERS_PASAPORTE_OPS, values[i]);
    if (row['ID'] !== id) continue;
    sheet.getRange(i + 2, 7).setValue(activo ? 'Sí' : 'No');
    return { ok: true, id: id, activo: activo };
  }
  return { ok: false, error: 'Operador no encontrado.' };
}

function hoyColombiaPasaporte_() {
  return Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd');
}

function handlePasaporteEscaneo_(payload) {
  var operadorId = String(payload.operadorId || '').trim();
  var clienteId = String(payload.clienteId || '').trim();
  var puntos = parseInt(payload.puntos, 10) || 10;
  var standNombre = String(payload.standNombre || '').trim();
  if (!operadorId || !clienteId) return { ok: false, error: 'operadorId y clienteId requeridos.' };

  var dia = hoyColombiaPasaporte_();
  var escaneoId = operadorId + '_' + clienteId + '_' + dia;
  var escSheet = getOrCreateSheet_(SHEET_PASAPORTE_ESCANEOS, HEADERS_PASAPORTE_ESCANEOS);
  var lastRow = escSheet.getLastRow();
  if (lastRow >= 2) {
    var values = escSheet.getRange(2, 1, lastRow, HEADERS_PASAPORTE_ESCANEOS.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var row = rowObjectFromValues_(HEADERS_PASAPORTE_ESCANEOS, values[i]);
      if (row['ID escaneo'] === escaneoId) {
        return { ok: false, error: 'Este visitante ya recibió puntos en tu stand hoy.' };
      }
    }
  }

  var txResult = handlePasaporteTransaccion_({
    clienteId: clienteId,
    tipo: 'acumulacion',
    puntos: puntos,
    descripcion: 'Visita a stand — escaneo Pasaporte Cafetero',
    sede: standNombre,
    operadorId: operadorId
  });
  if (!txResult.ok) return txResult;

  escSheet.appendRow([
    new Date().toISOString(),
    escaneoId,
    operadorId,
    clienteId,
    standNombre,
    puntos,
    dia
  ]);

  var cliente = getPasaporteCliente_(clienteId);
  return {
    ok: true,
    clienteId: clienteId,
    nombre: cliente.ok && cliente.cliente ? cliente.cliente.nombre : 'Visitante',
    puntosOtorgados: puntos,
    puntosTotales: txResult.puntos,
    nivel: txResult.nivel
  };
}

function getPasaporteConfig_(key) {
  var k = 'PASAPORTE_CFG_' + String(key || 'niveles').toUpperCase();
  var raw = PropertiesService.getScriptProperties().getProperty(k) || '';
  if (!raw) return { ok: true, key: key, data: null };
  try {
    return { ok: true, key: key, data: JSON.parse(raw) };
  } catch (e) {
    return { ok: true, key: key, data: null };
  }
}

function savePasaporteConfig_(payload) {
  var key = String(payload.key || 'niveles').trim();
  var k = 'PASAPORTE_CFG_' + key.toUpperCase();
  PropertiesService.getScriptProperties().setProperty(k, JSON.stringify(payload.data || {}));
  return { ok: true, key: key };
}

/** Configura PIN del panel jurado V60 (ejecutar en editor Apps Script). */
function configurarJuradoV60Pin(pin) {
  var value = String(pin || '').trim();
  if (!value || value.length < 4) {
    throw new Error('PIN inválido (mínimo 4 caracteres).');
  }
  PropertiesService.getScriptProperties().setProperty('JURADO_V60_PIN', value);
  Logger.log('JURADO_V60_PIN actualizado.');
}

function getJuradoV60PinExpected_() {
  return PropertiesService.getScriptProperties().getProperty('JURADO_V60_PIN') || JURADO_V60_PIN_DEFAULT;
}

function assertJuradoV60Pin_(pin) {
  var expected = getJuradoV60PinExpected_();
  if (String(pin || '').trim() !== expected) {
    return { ok: false, error: 'PIN de jurado incorrecto.' };
  }
  return { ok: true };
}

function juradoCriteriaSlug_(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/á/g, 'a')
    .replace(/é/g, 'e')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ú/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function juradoCriteriaApiList_(criteria) {
  var list = criteria && criteria.length ? criteria : null;
  if (!list) {
    return JURADO_V60_CRITERIA.map(function (label) {
      return { label: label, key: juradoCriteriaSlug_(label) };
    });
  }
  return list.map(function (c) {
    var label = String(c.label || '').trim();
    var key = String(c.key || juradoCriteriaSlug_(label)).trim();
    return { label: label, key: key };
  }).filter(function (c) { return c.label && c.key; });
}

function getJuradoScoringConfig_(evt) {
  var platformCfg = getPasaporteConfig_(juradoTenantKey_('jurado_v60_platform', evt));
  var platform = platformCfg.data || {};
  var scoring = platform.scoring || {};
  var rawCriteria = Array.isArray(scoring.criteria) ? scoring.criteria : [];
  var criteria = juradoCriteriaApiList_(rawCriteria.length ? rawCriteria : null);
  var scaleMin = parseInt(scoring.scaleMin, 10);
  var scaleMax = parseInt(scoring.scaleMax, 10);
  if (isNaN(scaleMin)) scaleMin = 1;
  if (isNaN(scaleMax)) scaleMax = 5;
  if (scaleMin >= scaleMax) {
    scaleMin = 1;
    scaleMax = 5;
  }
  var jueces = parseInt(scoring.jueces, 10);
  if (isNaN(jueces) || jueces < 1 || jueces > 5) jueces = 3;
  return {
    criteria: criteria,
    scaleMin: scaleMin,
    scaleMax: scaleMax,
    jueces: jueces,
    modo: scoring.modo === 'puntaje_general' ? 'puntaje_general' : 'duelos'
  };
}

function parseJuradoScore_(value, scaleMin, scaleMax) {
  var min = scaleMin != null ? parseInt(scaleMin, 10) : 1;
  var max = scaleMax != null ? parseInt(scaleMax, 10) : 5;
  if (isNaN(min)) min = 1;
  if (isNaN(max)) max = 5;
  var n = parseInt(value, 10);
  if (isNaN(n) || n < min || n > max) return null;
  return n;
}

function sumJuradoJudgeScores_(scores, criteria, scaleMin, scaleMax) {
  var list = criteria && criteria.length ? criteria : juradoCriteriaApiList_(null);
  var total = 0;
  for (var i = 0; i < list.length; i++) {
    var slug = list[i].key;
    var val = parseJuradoScore_(scores[slug], scaleMin, scaleMax);
    if (val === null) return null;
    total += val;
  }
  return total;
}

function juradoRowObjectFromPayload_(competidorId, nombre, judges, notas, scoringCfg) {
  var cfg = scoringCfg || getJuradoScoringConfig_('');
  var criteria = cfg.criteria || juradoCriteriaApiList_(null);
  var jueces = cfg.jueces || 3;
  var row = {
    'Fecha actualización': new Date().toISOString(),
    'Competidor ID': competidorId,
    'Nombre': nombre,
    'Notas': String(notas || '').trim()
  };
  var sumaTotal = 0;
  var subtotales = [];

  for (var j = 1; j <= jueces; j++) {
    var judgeKey = 'j' + j;
    var judgeScores = judges[judgeKey] || judges['J' + j] || {};
    var subtotal = sumJuradoJudgeScores_(judgeScores, criteria, cfg.scaleMin, cfg.scaleMax);
    if (subtotal === null) {
      return {
        ok: false,
        error: 'Completa todas las calificaciones (escala ' + cfg.scaleMin + '–' + cfg.scaleMax + ') de los ' + jueces + ' jueces.'
      };
    }
    subtotales.push(subtotal);
    sumaTotal += subtotal;
    for (var c = 0; c < criteria.length; c++) {
      var crit = criteria[c];
      var slug = crit.key;
      var header = 'J' + j + ' ' + crit.label;
      if (HEADERS_JURADO_V60.indexOf(header) >= 0) {
        row[header] = parseJuradoScore_(judgeScores[slug], cfg.scaleMin, cfg.scaleMax);
      }
    }
    var subHeader = 'J' + j + ' Subtotal';
    if (HEADERS_JURADO_V60.indexOf(subHeader) >= 0) {
      row[subHeader] = subtotal;
    }
  }

  row['Suma total'] = sumaTotal;
  row['Promedio jueces'] = Math.round((sumaTotal / jueces) * 100) / 100;
  return { ok: true, row: row, sumaTotal: sumaTotal, promedio: row['Promedio jueces'], subtotales: subtotales };
}

function juradoRowToApi_(rowObj, scoringCfg) {
  var cfg = scoringCfg || getJuradoScoringConfig_('');
  var criteria = cfg.criteria || juradoCriteriaApiList_(null);
  var jueces = cfg.jueces || 3;
  var judges = {};
  for (var j = 1; j <= jueces; j++) {
    var scores = {};
    for (var c = 0; c < criteria.length; c++) {
      var crit = criteria[c];
      var header = 'J' + j + ' ' + crit.label;
      scores[crit.key] = rowObj[header] != null ? rowObj[header] : null;
    }
    judges['j' + j] = {
      scores: scores,
      subtotal: rowObj['J' + j + ' Subtotal']
    };
  }
  return {
    competidorId: rowObj['Competidor ID'],
    nombre: rowObj['Nombre'],
    judges: judges,
    sumaTotal: rowObj['Suma total'],
    promedio: rowObj['Promedio jueces'],
    notas: rowObj['Notas'] || '',
    actualizado: rowObj['Fecha actualización'] || ''
  };
}

function findJuradoRowIndex_(sheet, competidorId) {
  var idCol = HEADERS_JURADO_V60.indexOf('Competidor ID') + 1;
  if (idCol <= 0) return -1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, idCol, lastRow, idCol).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '').trim() === competidorId) return i + 2;
  }
  return -1;
}

function listJuradoCompetidores_() {
  var sheet = getOrCreateSheet_(SHEET_COMPETENCIA, HEADERS_COMPETENCIA);
  var lastRow = sheet.getLastRow();
  var competidores = [];
  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow, HEADERS_COMPETENCIA.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var row = rowObjectFromValues_(HEADERS_COMPETENCIA, values[i]);
      if (!isHabilitado_(row['Habilitado'])) continue;
      var id = String(row['ID'] || '').trim();
      var nombre = String(row['Nombre'] || '').trim();
      if (!id || !nombre) continue;
      competidores.push({
        id: id,
        nombre: nombre,
        ciudad: String(row['Ciudad'] || '').trim(),
        representa: String(row['Representa'] || '').trim()
      });
    }
  }
  competidores.sort(function (a, b) {
    return a.nombre.localeCompare(b.nombre, 'es');
  });
  return competidores;
}

function readAllJuradoCalificaciones_(evt) {
  var sheet = getOrCreateSheet_(SHEET_JURADO_V60, HEADERS_JURADO_V60);
  var scoringCfg = getJuradoScoringConfig_(evt);
  return readAllSheetRows_(SHEET_JURADO_V60, HEADERS_JURADO_V60, false).map(function (row) {
    return juradoRowToApi_(row, scoringCfg);
  });
}

function handleJuradoCompetidoresGet_(pin, evt) {
  var access = assertJuradoV60Pin_(pin);
  if (!access.ok) return access;
  var scoringCfg = getJuradoScoringConfig_(evt);
  return {
    ok: true,
    criterios: scoringCfg.criteria,
    escala: { min: scoringCfg.scaleMin, max: scoringCfg.scaleMax },
    jueces: scoringCfg.jueces,
    modo: scoringCfg.modo,
    competidores: listJuradoCompetidores_()
  };
}

function handleJuradoCalificacionesGet_(pin, competidorId, evt) {
  var access = assertJuradoV60Pin_(pin);
  if (!access.ok) return access;
  var all = readAllJuradoCalificaciones_(evt);
  if (competidorId) {
    var one = null;
    for (var i = 0; i < all.length; i++) {
      if (all[i].competidorId === competidorId) {
        one = all[i];
        break;
      }
    }
    return { ok: true, calificacion: one, calificaciones: one ? [one] : [] };
  }
  all.sort(function (a, b) {
    return (b.promedio || 0) - (a.promedio || 0);
  });
  return { ok: true, calificaciones: all };
}

function handleJuradoGuardar_(payload) {
  var access = assertJuradoV60Pin_(payload.pin || '');
  if (!access.ok) return access;

  var competidorId = String(payload.competidorId || '').trim();
  if (!competidorId) return { ok: false, error: 'Competidor requerido.' };

  var competidores = listJuradoCompetidores_();
  var nombre = '';
  for (var i = 0; i < competidores.length; i++) {
    if (competidores[i].id === competidorId) {
      nombre = competidores[i].nombre;
      break;
    }
  }
  if (!nombre) return { ok: false, error: 'Competidor no encontrado o no habilitado.' };

  var evt = String(payload.evt || payload.tenantSlug || '').trim();
  var scoringCfg = getJuradoScoringConfig_(evt);
  var built = juradoRowObjectFromPayload_(
    competidorId,
    nombre,
    payload.judges || payload.jueces || {},
    payload.notas || '',
    scoringCfg
  );
  if (!built.ok) return built;

  var sheet = getOrCreateSheet_(SHEET_JURADO_V60, HEADERS_JURADO_V60);
  var rowValues = HEADERS_JURADO_V60.map(function (header) {
    return built.row[header] !== undefined ? built.row[header] : '';
  });
  var rowIndex = findJuradoRowIndex_(sheet, competidorId);
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, rowIndex, HEADERS_JURADO_V60.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return {
    ok: true,
    competidorId: competidorId,
    nombre: nombre,
    sumaTotal: built.sumaTotal,
    promedio: built.promedio,
    subtotales: built.subtotales,
    calificacion: juradoRowToApi_(built.row, scoringCfg)
  };
}

function normalizeNombre_(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function findCompetidorByDocumentoNombre_(documento, nombre) {
  var docNorm = normalizeDoc_(documento);
  if (!docNorm || docNorm.length < 6) return null;
  var nombreNorm = normalizeNombre_(nombre);
  if (!nombreNorm) return null;

  var sheet = getOrCreateSheet_(SHEET_COMPETENCIA, HEADERS_COMPETENCIA);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  var values = sheet.getRange(2, 1, lastRow, HEADERS_COMPETENCIA.length).getValues();
  for (var i = 0; i < values.length; i++) {
    var row = rowObjectFromValues_(HEADERS_COMPETENCIA, values[i]);
    if (!isHabilitado_(row['Habilitado'])) continue;
    if (normalizeDoc_(row['Documento']) !== docNorm) continue;
    if (normalizeNombre_(row['Nombre']) !== nombreNorm) continue;
    return row;
  }
  return null;
}

function juradoBracketPhaseLabel_(fase, rondaEnFase) {
  var labels = {
    grupos: 'Fase de grupos',
    '16avos': 'Dieciseisavos de final',
    '8avos': 'Octavos de final',
    '4tos': 'Cuartos de final',
    semifinal: 'Semifinal',
    final: 'Final'
  };
  var base = labels[fase] || String(fase || 'Torneo');
  var r = parseInt(rondaEnFase, 10) || 1;
  if (fase === 'grupos' && r > 1) return base + ' · ronda ' + r;
  return base;
}

function juradoActiveCompetitorIds_(bracket, evt) {
  if (bracket && Array.isArray(bracket.activos) && bracket.activos.length) {
    return bracket.activos.map(function (id) { return String(id || '').trim(); }).filter(Boolean);
  }
  var rows = readAllSheetRows_(SHEET_COMPETENCIA, HEADERS_COMPETENCIA, true)
    .map(sanitizeCompetenciaRow_);
  var targetEvento = ACTIVE_COMPETENCIA_EVENTO;
  if (evt) {
    var platformCfg = getPasaporteConfig_(juradoTenantKey_('jurado_v60_platform', evt));
    var platform = platformCfg.data || {};
    targetEvento = String(platform.eventId || platform.eventName || evt).trim() || evt;
  }
  return rows.filter(function (row) {
    if (!isHabilitadoCompetenciaRow_(row)) return false;
    return isSameCompetenciaEvento_(row['Evento'], targetEvento);
  }).map(function (row) { return String(row['ID'] || '').trim(); }).filter(Boolean);
}

function isHabilitadoCompetenciaRow_(row) {
  var val = String((row && row['Habilitado']) || '').trim().toLowerCase();
  if (!val) return true;
  return val === 'sí' || val === 'si' || val === 'yes' || val === 'true' || val === '1';
}

function handleJuradoPublishResultados_(payload) {
  var evt = String((payload && payload.evt) || '').trim();
  var bracketCfg = getPasaporteConfig_(juradoTenantKey_('jurado_v60_bracket', evt));
  var calCfg = getPasaporteConfig_(juradoTenantKey_('jurado_v60_calificaciones', evt));
  var bracket = bracketCfg.data && typeof bracketCfg.data === 'object' ? bracketCfg.data : {};
  var scoresMap = calCfg.data && calCfg.data.scores && typeof calCfg.data.scores === 'object'
    ? calCfg.data.scores
    : {};

  var activos = juradoActiveCompetitorIds_(bracket, evt);
  if (!activos.length) {
    return { ok: false, error: 'No hay participantes activos en esta ronda.' };
  }

  if (!bracket.resultadosCompetidor || typeof bracket.resultadosCompetidor !== 'object') {
    bracket.resultadosCompetidor = {};
  }

  var fase = String(bracket.fase || 'semifinal').trim();
  var ronda = parseInt(bracket.rondaEnFase, 10) || 1;
  var faseLabel = juradoBracketPhaseLabel_(fase, ronda);
  var roundKey = fase + '|' + ronda;
  var now = new Date().toISOString();
  var published = 0;

  activos.forEach(function (id) {
    var row = scoresMap[id];
    if (!row || row.sumaTotal == null) return;
    bracket.resultadosCompetidor[id] = {
      judges: JSON.parse(JSON.stringify(row.judges || {})),
      notas: String(row.notas || '').trim(),
      sumaTotal: row.sumaTotal,
      promedio: row.promedio != null ? row.promedio : null,
      roundKey: roundKey,
      faseLabel: faseLabel,
      publicadoAt: now
    };
    published++;
  });

  if (!published) {
    return {
      ok: false,
      error: 'No hay calificaciones completas para publicar. Espera a que los jueces terminen.'
    };
  }

  bracket.actualizado = now;
  savePasaporteConfig_({
    key: juradoTenantKey_('jurado_v60_bracket', evt),
    data: bracket
  });

  return {
    ok: true,
    published: published,
    faseLabel: faseLabel,
    roundKey: roundKey
  };
}

function juradoResultadosTorneoStatus_(bracket, competidorId) {
  if (!bracket || !competidorId) {
    return { fase: '', faseLabel: 'Torneo', estado: 'pendiente', activo: false, eliminado: false };
  }
  var activos = Array.isArray(bracket.activos) ? bracket.activos : [];
  var eliminados = Array.isArray(bracket.eliminados) ? bracket.eliminados : [];
  var activo = activos.indexOf(competidorId) >= 0;
  var eliminado = eliminados.indexOf(competidorId) >= 0;
  var fase = String(bracket.fase || '').trim();
  var ronda = parseInt(bracket.rondaEnFase, 10) || 1;
  var estado = 'pendiente';
  if (eliminado) estado = 'eliminado';
  else if (activo) estado = 'activo';
  else if (!fase && !activos.length) estado = 'inscrito';
  return {
    fase: fase,
    faseLabel: juradoBracketPhaseLabel_(fase, ronda),
    rondaEnFase: ronda,
    estado: estado,
    activo: activo,
    eliminado: eliminado
  };
}

function handleJuradoResultadosLogin_(payload) {
  var nombre = String(payload.nombre || '').trim();
  var documento = String(payload.documento || '').trim();
  var evt = String(payload.evt || '').trim();
  if (!nombre || !documento) {
    return { ok: false, error: 'Ingresa tu nombre y número de documento (cédula).' };
  }

  var row = findCompetidorByDocumentoNombre_(documento, nombre);
  if (!row) {
    return { ok: false, error: 'No encontramos un inscrito habilitado con ese nombre y documento.' };
  }

  if (evt) {
    var eventoRow = String(row['Evento'] || '').trim();
    if (eventoRow && eventoRow !== evt) {
      return { ok: false, error: 'Este inscrito no pertenece a este torneo.' };
    }
  }

  var competidorId = String(row['ID'] || '').trim();
  var calCfg = getPasaporteConfig_(juradoTenantKey_('jurado_v60_calificaciones', evt));
  var bracketCfg = getPasaporteConfig_(juradoTenantKey_('jurado_v60_bracket', evt));
  var platformCfg = getPasaporteConfig_(juradoTenantKey_('jurado_v60_platform', evt));

  var scoresRoot = calCfg.data && calCfg.data.scores ? calCfg.data.scores : {};
  var bracket = bracketCfg.data || null;
  var resultadosMap = bracket && bracket.resultadosCompetidor && typeof bracket.resultadosCompetidor === 'object'
    ? bracket.resultadosCompetidor
    : {};
  var published = resultadosMap[competidorId] || null;

  var calificacion = null;
  var resultadosPublicados = false;
  var mensajeBloqueo = '';

  if (published) {
    resultadosPublicados = true;
    calificacion = {
      competidorId: competidorId,
      judges: published.judges || {},
      notas: String(published.notas || '').trim(),
      sumaTotal: published.sumaTotal != null ? published.sumaTotal : null,
      promedio: published.promedio != null ? published.promedio : null,
      faseLabel: String(published.faseLabel || '').trim(),
      publicadoAt: String(published.publicadoAt || '').trim()
    };
  } else {
    mensajeBloqueo = 'El organizador aún no ha publicado los resultados de esta ronda. Vuelve a consultar cuando el torneo lo indique.';
  }

  var bracketForStatus = bracket;
  var torneo = juradoResultadosTorneoStatus_(bracketForStatus, competidorId);
  var platform = platformCfg.data || {};
  var scoring = platform.scoring || {};
  var criteria = Array.isArray(scoring.criteria) ? scoring.criteria : [];

  return {
    ok: true,
    competidor: {
      id: competidorId,
      nombre: String(row['Nombre'] || '').trim(),
      ciudad: String(row['Ciudad'] || '').trim(),
      representa: String(row['Representa'] || '').trim()
    },
    torneo: torneo,
    calificacion: calificacion,
    resultadosPublicados: resultadosPublicados,
    mensajeBloqueo: mensajeBloqueo,
    evento: {
      nombre: String(platform.eventName || 'Torneo sensorial').trim(),
      subtitulo: String(platform.eventSubtitle || '').trim(),
      logoUrl: String(platform.logoUrl || '').trim(),
      accentColor: String(platform.accentColor || '#c9a227').trim(),
      primaryColor: String(platform.primaryColor || '#3d281c').trim()
    },
    scoring: {
      jueces: Math.max(1, Math.min(5, parseInt(scoring.jueces, 10) || 3)),
      scaleMin: parseInt(scoring.scaleMin, 10) || 1,
      scaleMax: parseInt(scoring.scaleMax, 10) || 5,
      criteria: criteria.map(function (c) {
        return {
          key: String(c.key || '').trim(),
          label: String(c.label || '').trim(),
          desc: String(c.desc || '').trim()
        };
      }).filter(function (c) { return c.label; })
    }
  };
}

var JURADO_INSTANCES_KEY = 'jurado_v60_instances';

function juradoSlugFromName_(name) {
  var base = String(name || 'evento')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'evento';
  return base.slice(0, 40);
}

function generateJuradoPin_() {
  var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var out = '';
  for (var i = 0; i < 12; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

function juradoTenantKey_(base, slug) {
  slug = String(slug || '').trim();
  if (!slug) return base;
  return base + '__' + slug;
}

function juradoTenantKey_(base, slug) {
  slug = String(slug || '').trim();
  if (!slug) return base;
  return base + '__' + slug;
}

function defaultCompetenciaFormFields_() {
  return [
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
}

function competenciaEventoSheetName_(slug) {
  return 'Comp. ' + String(slug || 'evento').slice(0, 28);
}

function ensureCompetenciaEventoSheet_(slug) {
  var sheetName = competenciaEventoSheetName_(slug);
  return getOrCreateSheet_(sheetName, HEADERS_COMP_EVENTO);
}

function getJuradoTenantPlatform_(slug) {
  slug = String(slug || '').trim();
  if (!slug) return null;
  var cfg = getPasaporteConfig_(juradoTenantKey_('jurado_v60_platform', slug));
  return cfg.data || null;
}

function assertJuradoTenantOrganizerPin_(slug, pin) {
  slug = String(slug || '').trim();
  var pinNorm = String(pin || '').trim().toLowerCase();
  if (!slug) return { ok: false, error: 'Torneo no especificado.' };
  if (!pinNorm) return { ok: false, error: 'PIN de organizador requerido.' };
  var platform = getJuradoTenantPlatform_(slug);
  var expected = platform && platform.pinOrganizador
    ? String(platform.pinOrganizador).trim().toLowerCase()
    : '';
  if (!expected) {
    var list = listJuradoInstances_().instances || [];
    var inst = list.filter(function (i) { return i.slug === slug; })[0];
    expected = inst && inst.pinOrganizador ? String(inst.pinOrganizador).trim().toLowerCase() : '';
  }
  if (!expected || pinNorm !== expected) {
    return { ok: false, error: 'PIN de organizador incorrecto.' };
  }
  return { ok: true };
}

function assertJuradoTenantJudgePin_(slug, pin) {
  var pinNorm = String(pin || '').trim().toLowerCase();
  if (!pinNorm) return { ok: false, error: 'PIN de juez requerido.' };
  slug = String(slug || '').trim();
  var expected = '';
  if (slug) {
    var platform = getJuradoTenantPlatform_(slug);
    if (platform && platform.pinJuez) {
      expected = String(platform.pinJuez).trim().toLowerCase();
    }
  } else {
    var cfg = getPasaporteConfig_('jurado_v60_platform');
    if (cfg.data && cfg.data.pinJuez) {
      expected = String(cfg.data.pinJuez).trim().toLowerCase();
    }
  }
  if (expected && pinNorm === expected) return { ok: true };
  return assertJuradoV60Pin_(pin);
}

function handleJuradoJuezProfileSave_(payload) {
  var slug = String(payload.evt || payload.tenantSlug || '').trim();
  var access = assertJuradoTenantJudgePin_(slug, payload.pin || '');
  if (!access.ok) return access;

  var judgeNum = parseInt(payload.judgeNum, 10);
  if (isNaN(judgeNum) || judgeNum < 1 || judgeNum > 5) {
    return { ok: false, error: 'Número de juez inválido.' };
  }

  var nombre = String(payload.nombre || '').trim();
  if (!nombre || nombre.length < 2) {
    return { ok: false, error: 'Ingresa tu nombre completo.' };
  }

  var foto = payload.foto || {};
  var dataUrl = String(foto.base64 || foto.dataUrl || '').trim();
  if (!dataUrl) {
    return { ok: false, error: 'Sube una foto tuya.' };
  }

  var fotoUrl = saveFileToDriveFolder_(
    (slug || 'main') + '-juez-' + judgeNum,
    String(foto.nombreArchivo || 'foto.jpg'),
    String(foto.tipoArchivo || 'image/jpeg'),
    dataUrl,
    DRIVE_JUDGES_FOLDER_NAME,
    'foto'
  );
  if (!fotoUrl) {
    return { ok: false, error: 'No se pudo guardar la foto en Drive.' };
  }

  var cfgKey = juradoTenantKey_('jurado_v60_platform', slug);
  var cfg = getPasaporteConfig_(cfgKey);
  var platform = cfg.data && typeof cfg.data === 'object' ? cfg.data : {};
  if (!platform.eventName && slug) {
    var instList = listJuradoInstances_().instances || [];
    var inst = null;
    for (var i = 0; i < instList.length; i++) {
      if (instList[i].slug === slug) {
        inst = instList[i];
        break;
      }
    }
    if (inst) platform = defaultJuradoPlatformForTenant_(inst);
  }
  if (!platform.judgeProfiles || typeof platform.judgeProfiles !== 'object') {
    platform.judgeProfiles = {};
  }
  platform.judgeProfiles[String(judgeNum)] = {
    num: judgeNum,
    nombre: nombre,
    fotoUrl: fotoUrl,
    updatedAt: new Date().toISOString()
  };
  platform.actualizado = new Date().toISOString();

  PropertiesService.getScriptProperties().setProperty(
    'PASAPORTE_CFG_' + String(cfgKey).toUpperCase(),
    JSON.stringify(platform)
  );

  return {
    ok: true,
    judgeNum: judgeNum,
    nombre: nombre,
    fotoUrl: fotoUrl,
    profile: platform.judgeProfiles[String(judgeNum)]
  };
}

function normalizeCompetenciaFormFields_(raw) {
  var defaults = defaultCompetenciaFormFields_();
  if (!Array.isArray(raw) || !raw.length) return defaults;
  var byKey = {};
  defaults.forEach(function (f) { byKey[f.key] = f; });
  return raw.map(function (f) {
    if (!f || !f.key) return null;
    var base = byKey[f.key] || { key: f.key, label: f.key, type: 'text', required: false, enabled: true };
    return {
      key: String(f.key || base.key).trim(),
      label: String(f.label || base.label).trim() || base.label,
      type: String(f.type || base.type).trim() || 'text',
      required: f.required === true || f.required === 'true',
      enabled: f.enabled !== false && f.enabled !== 'false',
      placeholder: String(f.placeholder || base.placeholder || '').trim()
    };
  }).filter(Boolean);
}

function getCompetenciaTorneoCount_(slug) {
  var sheet = ensureCompetenciaEventoSheet_(slug);
  var lastRow = sheet.getLastRow();
  return lastRow > 1 ? lastRow - 1 : 0;
}

function readCompetenciaTorneoRows_(slug, onlyHabilitado) {
  var sheet = ensureCompetenciaEventoSheet_(slug);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow, HEADERS_COMP_EVENTO.length).getValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    var row = rowObjectFromValues_(HEADERS_COMP_EVENTO, values[i]);
    if (onlyHabilitado && !isHabilitado_(row['Habilitado'])) continue;
    rows.push(row);
  }
  return rows;
}

function handleCompetenciaTorneoFormGet_(evt) {
  var slug = String(evt || '').trim().toLowerCase();
  if (!slug || !/^[a-z0-9][a-z0-9-]{0,48}$/.test(slug)) {
    return { ok: false, error: 'Torneo no válido.' };
  }
  var platform = getJuradoTenantPlatform_(slug);
  if (!platform) {
    return { ok: false, error: 'No encontramos este torneo. Verifica el enlace.' };
  }
  var reg = platform.registration || {};
  var cupo = parseInt(reg.cupo, 10) || 32;
  var count = getCompetenciaTorneoCount_(slug);
  return {
    ok: true,
    evt: slug,
    evento: {
      nombre: String(platform.eventName || '').trim(),
      subtitulo: String(platform.eventSubtitle || '').trim(),
      organizador: String(platform.organizerName || '').trim(),
      logoUrl: String(platform.logoUrl || '').trim(),
      accentColor: String(platform.accentColor || '#c9a227').trim(),
      primaryColor: String(platform.primaryColor || '#3d281c').trim()
    },
    registration: {
      title: String(reg.title || 'Inscripción').trim(),
      fee: String(reg.fee || '').trim(),
      cupo: cupo,
      inscritos: count,
      disponibles: Math.max(0, cupo - count),
      completo: count >= cupo,
      fecha: String(reg.fecha || '').trim(),
      hora: String(reg.hora || '').trim(),
      lugar: String(reg.lugar || '').trim(),
      contactEmail: String(reg.contactEmail || '').trim(),
      whatsapp: String(reg.whatsapp || '').trim(),
      reglamentoUrl: String(reg.reglamentoUrl || '').trim()
    },
    formFields: normalizeCompetenciaFormFields_(platform.formFields).filter(function (f) {
      return f.enabled;
    }),
    sheetName: String(platform.sheetName || competenciaEventoSheetName_(slug)).trim()
  };
}

function handleCompetenciaTorneoInscripcion_(payload) {
  var slug = String(payload.evt || '').trim().toLowerCase();
  if (!slug) return { ok: false, error: 'Torneo no especificado.' };
  var formRes = handleCompetenciaTorneoFormGet_(slug);
  if (!formRes.ok) return formRes;
  if (formRes.registration.completo) {
    return { ok: false, error: 'Cupo completo para este torneo.', cupoCompleto: true };
  }

  var data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
  var fields = formRes.formFields || [];
  var normalized = {};
  for (var fi = 0; fi < fields.length; fi++) {
    var f = fields[fi];
    normalized[f.key] = String(data[f.key] != null ? data[f.key] : '').trim();
    if (f.required && !normalized[f.key]) {
      return { ok: false, error: 'Completa el campo: ' + f.label };
    }
  }

  if (payload.acepta_datos !== true && payload.acepta_datos !== 'true' && data.acepta_datos !== true) {
    return { ok: false, error: 'Debes aceptar el tratamiento de datos personales.' };
  }
  if (payload.acepta_reglas !== true && payload.acepta_reglas !== 'true' && data.acepta_reglas !== true) {
    return { ok: false, error: 'Debes aceptar el reglamento del torneo.' };
  }

  var correo = normalizeEmail_(normalized.correo || data.correo || '');
  var documento = String(normalized.documento || data.documento || '').trim();
  var nombre = String(normalized.nombre || data.nombre || '').trim();
  if (!nombre) return { ok: false, error: 'Nombre requerido.' };
  if (!correo) return { ok: false, error: 'Correo requerido.' };

  var tenantSheet = ensureCompetenciaEventoSheet_(slug);
  if (findDuplicateInSheet_(tenantSheet, HEADERS_COMP_EVENTO, correo, documento)) {
    return { ok: false, error: 'Ya existe una inscripción con este correo o documento.', duplicate: true };
  }

  var mainSheet = getOrCreateSheet_(SHEET_COMPETENCIA, HEADERS_COMPETENCIA);
  if (findDuplicateInSheet_(mainSheet, HEADERS_COMPETENCIA, correo, documento)) {
    return { ok: false, error: 'Ya existe una inscripción con este correo o documento.', duplicate: true };
  }

  var id = String(data.id || ('COMP-' + slug.toUpperCase().slice(0, 8) + '-' + Date.now().toString(36).toUpperCase())).trim();
  var now = new Date().toISOString();
  var reg = formRes.registration || {};

  tenantSheet.appendRow([
    now,
    id,
    nombre,
    documento,
    String(normalized.edad || '').trim(),
    String(normalized.celular || data.celular || '').trim(),
    correo,
    String(normalized.ciudad || '').trim(),
    String(normalized.representa || '').trim(),
    String(normalized.rol || '').trim(),
    String(normalized.experiencia || '').trim(),
    String(normalized.observaciones || '').trim(),
    'Sí',
    'Sí',
    'Sí',
    ''
  ]);

  var legalCols = parseLegalAcceptances_({
    aceptaVoluntaria: true,
    aceptaPertenencias: true,
    aceptaDatos: true,
    aceptaNoReembolso: true,
    aceptaDescalificacion: true,
    aceptaReglas: true,
    aceptaDisponibilidad: true,
    aceptaImagen: true
  });
  var mainRow = joinRowParts_([
    now,
    id,
    slug,
    reg.fee || '',
    nombre,
    documento,
    String(normalized.edad || '').trim(),
    String(normalized.ciudad || '').trim(),
    String(normalized.celular || data.celular || '').trim(),
    correo,
    '', '', '',
    String(normalized.representa || '').trim(),
    String(normalized.rol || '').trim(),
    String(normalized.experiencia || '').trim(),
    '', '', '', '', '', '',
    '', '', '', '', '', '',
    '', '', 'No', '', '', '', ''
  ], legalCols, [
    String(normalized.observaciones || '').trim(),
    'Inscrito en línea',
    'Sí',
    'Sí',
    'Torneo: ' + slug
  ]);
  mainSheet.appendRow(mainRow);

  return {
    ok: true,
    id: id,
    evt: slug,
    nombre: nombre,
    inscritos: getCompetenciaTorneoCount_(slug),
    cupo: reg.cupo || 32
  };
}

function handleCompetenciaTorneoInscripcionesGet_(evt, pin) {
  var slug = String(evt || '').trim().toLowerCase();
  var access = assertJuradoTenantOrganizerPin_(slug, pin);
  if (!access.ok) return access;
  var rows = readCompetenciaTorneoRows_(slug, false);
  var formRes = handleCompetenciaTorneoFormGet_(slug);
  return {
    ok: true,
    evt: slug,
    columns: HEADERS_COMP_EVENTO,
    rows: rows,
    registration: formRes.ok ? formRes.registration : null,
    formFields: formRes.ok ? formRes.formFields : []
  };
}

function listJuradoInstances_() {
  var cfg = getPasaporteConfig_(JURADO_INSTANCES_KEY);
  var instances = cfg.data && Array.isArray(cfg.data.instances) ? cfg.data.instances : [];
  return { ok: true, instances: instances };
}

function defaultJuradoPlatformForTenant_(instance) {
  var slug = instance.slug;
  var now = new Date().toISOString();
  return {
    eventName: instance.eventName,
    eventSubtitle: 'Calificación sensorial en vivo',
    organizerName: instance.clientName,
    tenantSlug: slug,
    eventId: slug,
    clientName: instance.clientName,
    logoUrl: '',
    accentColor: '#c9a227',
    primaryColor: '#3d281c',
    pinOrganizador: instance.pinOrganizador,
    pinJuez: instance.pinJuez,
    registration: {
      title: 'Inscripción competencia',
      fee: '',
      cupo: 32,
      fecha: 'Por confirmar',
      hora: '',
      lugar: 'Por confirmar',
      contactEmail: instance.contactEmail || '',
      whatsapp: '',
      reglamentoUrl: ''
    },
    formFields: defaultCompetenciaFormFields_(),
    sheetName: competenciaEventoSheetName_(instance.slug),
    eventId: instance.slug,
    tenantSlug: instance.slug,
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
      criteria: juradoCriteriaApiList_().map(function (c) {
        return { key: c.key, label: c.label, desc: '' };
      })
    },
    panelImageDataUrl: '',
    actualizado: now
  };
}

function handleJuradoInstanceCreate_(payload) {
  var clientName = String(payload.clientName || '').trim();
  var eventName = String(payload.eventName || '').trim();
  var contactEmail = String(payload.contactEmail || '').trim();
  if (!clientName) return { ok: false, error: 'Nombre del cliente requerido.' };
  if (!eventName) eventName = clientName + ' — Torneo sensorial';

  var listRes = listJuradoInstances_();
  var instances = listRes.instances || [];
  var baseSlug = juradoSlugFromName_(clientName);
  var slug = baseSlug;
  var n = 2;
  while (instances.some(function (i) { return i.slug === slug; })) {
    slug = baseSlug + '-' + n;
    n++;
  }

  var pinOrg = generateJuradoPin_();
  var pinJuez = generateJuradoPin_();
  var now = new Date().toISOString();
  var inscripcionUrl = SITE_PUBLIC_BASE_URL + '/competencia/torneo?evt=' + encodeURIComponent(slug);
  var instance = {
    slug: slug,
    clientName: clientName,
    eventName: eventName,
    contactEmail: contactEmail,
    pinOrganizador: pinOrg,
    pinJuez: pinJuez,
    inscripcionUrl: inscripcionUrl,
    status: 'active',
    createdAt: now
  };
  instances.push(instance);
  savePasaporteConfig_({ key: JURADO_INSTANCES_KEY, data: { instances: instances } });

  var platform = defaultJuradoPlatformForTenant_(instance);
  savePasaporteConfig_({
    key: juradoTenantKey_('jurado_v60_platform', slug),
    data: platform
  });
  savePasaporteConfig_({
    key: juradoTenantKey_('jurado_v60_calificaciones', slug),
    data: { scores: {} }
  });
  savePasaporteConfig_({
    key: juradoTenantKey_('jurado_v60_bracket', slug),
    data: null
  });

  ensureCompetenciaEventoSheet_(slug);

  return { ok: true, instance: instance, inscripcionUrl: inscripcionUrl };
}
