// Web App de Google Apps Script - La Sucursal del Cafe
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
var COMPROBANTE_PREVIEW_MAX = 1000;
var DRIVE_FOLDER_NAME = 'Switch Championship — Comprobantes';
var DRIVE_FOTOS_FOLDER_NAME = 'Switch Championship — Fotos participantes';
var DRIVE_LOGOS_STANDS_FOLDER_NAME = 'Feria — Logos expositores';
// Correo(s) del equipo para alertas de nueva inscripcion (separar con coma si son varios).
var ORGANIZER_EMAIL = 'lasucursaldelcafe@gmail.com';
var WHATSAPP_GRUPO_COMPETENCIA = 'https://chat.whatsapp.com/GUFGVoaP8X81zWbBjZfIW9';
var WHATSAPP_ORGANIZADOR = '573116699638';
// WhatsApp automático: Apps Script no tiene WhatsApp Business API (Meta) configurada.
// El participante recibe enlaces chat.whatsapp.com (grupo) y wa.me (organizador) en el correo.

var HEADERS_FERIA = [
  'Fecha registro', 'ID', 'Nombre', 'Edad', 'Celular', 'Correo', 'Intereses',
  'Acepta voluntaria', 'Acepta pertenencias', 'Acepta datos', 'Acepta imagen',
  'Estado registro', 'Habilitado', 'Notas admin'
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

var HEADERS_STANDS = [
  'Fecha registro', 'ID', 'Stand ID', 'Marca o negocio', 'Persona contacto', 'Celular', 'Correo',
  'Plan stand', 'Ciudad', 'Descripción exhibición',
  'Tipo participante', 'Red social preferida', 'Red social enlace', 'Logos directorio (JSON)', 'Visible directorio público',
  'Logo nombre', 'Logo tipo', 'Logo enlace Drive',
  'Comparte stand', 'Marcas adicionales (JSON)',
  'Acepta voluntaria', 'Acepta pertenencias', 'Acepta datos', 'Acepta imagen',
  'Estado solicitud', 'Habilitado', 'Notas admin', 'Código acceso (hash)'
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
var SITE_PUBLIC_BASE_URL = 'https://la-sucursal-del-cafe.web.app';

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
  if (params.action === 'expositor_feed') {
    return jsonResponse(getExpositorFeed_());
  }
  if (params.action === 'participantes_publico') {
    return jsonResponse(getParticipantesPublico_());
  }
  if (params.action === 'patrocinadores_competencia_publico') {
    return jsonResponse(getPatrocinadoresCompetenciaPublico_());
  }
  return jsonResponse({
    ok: true,
    message: 'API de inscripciones — La Sucursal del Café',
    forms: [
      'feria', 'competencia', 'stands', 'lista_espera', 'participantes_publico',
      'patrocinadores_competencia_publico', 'admin', 'analytics'
    ]
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

    var formType = String(payload.formType || '').toLowerCase();
    var data = payload.data || payload;
    var id = '';

    var extra = {};
    if (formType === 'feria') {
      id = appendFeria_(data);
    } else if (formType === 'competencia') {
      var competenciaResult = appendCompetencia_(data);
      id = competenciaResult.id;
      extra.whatsappGrupoUrl = WHATSAPP_GRUPO_COMPETENCIA;
      extra.fotoEnlace = competenciaResult.fotoEnlace || '';
    } else     if (formType === 'stands') {
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
  ensureDefaultPatrocinadoresCompetencia_();
  Logger.log(
    'Encabezados sincronizados: Feria, Competencia, Stands, Lista de espera, Analytics, Novedades, Patrocinadores competencia.'
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

function getCompetenciaCount_() {
  var sheet = getOrCreateSheet_(SHEET_COMPETENCIA, HEADERS_COMPETENCIA);
  var lastRow = sheet.getLastRow();
  return lastRow > 1 ? lastRow - 1 : 0;
}

function appendFeria_(data) {
  var sheet = getOrCreateSheet_(SHEET_FERIA, HEADERS_FERIA);
  if (findDuplicateInSheet_(sheet, HEADERS_FERIA, data.correo, null)) {
    throw new Error('Ya existe una inscripción de feria con este correo.');
  }

  var intereses = Array.isArray(data.intereses) ? data.intereses.join('; ') : String(data.intereses || '');
  var legalCols = parseFeriaLegalAcceptances_(data);
  var estado = 'Registrado';

  sheet.appendRow([
    data.fecha || new Date().toISOString(),
    data.id || '',
    data.nombre || '',
    data.edad || '',
    data.celular || '',
    data.correo || '',
    intereses
  ].concat(legalCols).concat([estado, 'Sí', '']));

  sendConfirmationEmail_('feria', data);
  sendOrganizerNotificationEmail_('feria', data);
  return data.id || '';
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
  return {
    id: row['ID'] || '',
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
    comparteStand: row['Comparte stand'] || 'No',
    marcasAdicionales: parseMarcasAdicionalesJson_(row['Marcas adicionales (JSON)']),
    logos: buildStandLogosFromRow_(
      row['Marca o negocio'],
      row['Logo enlace Drive'],
      row['Marcas adicionales (JSON)']
    ),
    estado: row['Estado solicitud'] || ''
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

      var marca = String(row['Marca o negocio'] || '').trim();
      if (!marca) continue;

      participantes.push({
        id: String(row['ID'] || '').trim(),
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
        standId: String(row['Stand ID'] || '').trim()
      });
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

  sheet.appendRow([
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
  ].concat(legalCols).concat([estado, 'Sí', '', accessHash]));

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
    throw new Error('Cupo completo. No hay cupos disponibles para Switch Championship.');
  }

  var sheet = getOrCreateSheet_(SHEET_COMPETENCIA, HEADERS_COMPETENCIA);
  if (findDuplicateInSheet_(sheet, HEADERS_COMPETENCIA, data.correo, data.documento)) {
    throw new Error('Ya existe una inscripción de competencia con este correo o documento.');
  }

  var equipo = data.equipoPropio || {};
  var envio = data.envio || {};
  var comp = parseComprobante_(data);
  var foto = parseFotoParticipante_(data);
  var legalCols = parseLegalAcceptances_(data);
  var tieneComprobante = comp.tiene === 'Sí';
  var estadoPago = tieneComprobante ? 'Comprobante recibido' : 'Pendiente pago';
  var cupoConfirmado = 'No';

  sheet.appendRow([
    data.fecha || new Date().toISOString(),
    data.id || '',
    data.evento || 'Switch Championship',
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
  ].concat(legalCols).concat([
    data.observaciones || '',
    estadoPago,
    cupoConfirmado,
    'Sí',
    ''
  ]));

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
  return getSiteUrl_() + '/reglas-switch-championship.html';
}

function buildWaMeUrl_(phone, text) {
  var digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  var url = 'https://wa.me/' + digits;
  if (text) url += '?text=' + encodeURIComponent(text);
  return url;
}

function buildCompetenciaWaOrganizadorUrl_(data) {
  var nombre = String(data.nombre || 'Participante').trim();
  var id = String(data.id || '').trim();
  var msg = 'Hola, me inscribí al Switch Championship (1.ª clasificatoria). ' +
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
  var lines = [
    'Hola ' + nombre + ',',
    '',
    '¡Bienvenido/a al Switch Championship! Recibimos tu inscripción a la 1.ª clasificatoria del circuito de café filtrado con Hario Switch.',
    '',
    'Número de inscripción: ' + id,
    'Fecha: 4 de julio de 2026',
    'Sede: Plaza Marbella, Centro Comercial (Curis), Cali',
    'Pago: $90.000 COP a Nubank @mbl616 (Manuel Barraza)',
    '',
    '—— Reglamento (resumen) ——',
    '• Método obligatorio: Hario Switch (extracción manual).',
    '• Formato: clasificatoria, semifinal y final.',
    '• Sin reembolso por retiro o no asistencia (salvo cancelación total del evento).',
    '• Debes cumplir tiempos, protocolo y criterios del jurado.',
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
  lines.push('Switch Championship · 1.ª clasificatoria');
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
  var pagoNote = tieneComprobante
    ? 'Recibimos tu comprobante de pago. Validaremos los $90.000 COP en Nubank @mbl616 y te confirmaremos tu cupo.'
    : 'Pendiente: realiza tu pago de $90.000 COP a Nubank @mbl616 (Manuel Barraza) y envía el comprobante si aún no lo adjuntaste.';
  var btnStyle = 'display:inline-block;padding:12px 20px;margin:8px 8px 8px 0;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;';
  var btnGreen = btnStyle + 'background:#25D366;color:#ffffff;';
  var btnBrown = btnStyle + 'background:#5f4a3a;color:#ffffff;';

  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#3d2b1f;max-width:600px;">',
    '<p style="margin:0 0 16px;">Hola <strong>' + nombre + '</strong>,</p>',
    '<p style="margin:0 0 16px;">¡Bienvenido/a al <strong>Switch Championship</strong>! Recibimos tu inscripción a la <strong>1.ª clasificatoria</strong> del circuito de café filtrado con Hario Switch, organizado por La Sucursal del Café.</p>',
    '<table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:14px;">',
    '<tr><td style="padding:6px 0;color:#6b5344;width:38%;">Número de inscripción</td><td style="padding:6px 0;"><strong>' + id + '</strong></td></tr>',
    '<tr><td style="padding:6px 0;color:#6b5344;">Fecha</td><td style="padding:6px 0;">4 de julio de 2026</td></tr>',
    '<tr><td style="padding:6px 0;color:#6b5344;">Sede</td><td style="padding:6px 0;">Plaza Marbella, Centro Comercial (Curis), Cali</td></tr>',
    '<tr><td style="padding:6px 0;color:#6b5344;">Pago</td><td style="padding:6px 0;">$90.000 COP · Nubank <strong>@mbl616</strong> (Manuel Barraza)</td></tr>',
    '</table>',
    '<h2 style="font-size:17px;color:#5f4a3a;margin:24px 0 10px;">Reglamento</h2>',
    '<ul style="margin:0 0 12px;padding-left:20px;">',
    '<li style="margin-bottom:6px;">Método obligatorio: <strong>Hario Switch</strong> (extracción manual).</li>',
    '<li style="margin-bottom:6px;">Formato: clasificatoria, semifinal y final.</li>',
    '<li style="margin-bottom:6px;">Sin reembolso por retiro o no asistencia (salvo cancelación total del evento).</li>',
    '<li style="margin-bottom:6px;">Debes cumplir tiempos, protocolo y criterios del jurado.</li>',
    '</ul>',
    '<p style="margin:0 0 20px;"><a href="' + reglasUrl + '" style="color:#8b4513;font-weight:600;">Ver reglamento completo en el sitio</a></p>',
    '<h2 style="font-size:17px;color:#5f4a3a;margin:24px 0 10px;">WhatsApp del torneo</h2>',
    '<p style="margin:0 0 12px;">Únete al grupo para recibir avisos, logística y novedades del Switch Championship:</p>',
    '<p style="margin:0 0 16px;"><a href="' + grupoUrl + '" style="' + btnGreen + '">Entrar al grupo de WhatsApp</a></p>',
    '<p style="margin:0 0 8px;font-size:14px;color:#6b5344;">¿Necesitas escribir al organizador? Abre WhatsApp con un mensaje prellenado:</p>',
    '<p style="margin:0 0 16px;"><a href="' + waOrganizador + '" style="' + btnBrown + '">Contactar por WhatsApp</a></p>',
    '<p style="margin:0 0 20px;padding:12px 14px;background:#f5f0ea;border-left:4px solid #bb5e3c;font-size:14px;">' + escapeHtml_(pagoNote) + '</p>',
    '<p style="margin:0 0 8px;font-size:13px;color:#888;">WhatsApp no puede enviarse automáticamente desde este sistema; usa los botones anteriores para unirte al grupo o contactarnos.</p>',
    '<p style="margin:16px 0 0;">Dudas: <a href="mailto:' + organizerEmail + '" style="color:#8b4513;">' + organizerEmail + '</a></p>',
    '<hr style="border:none;border-top:1px solid #e0d5c8;margin:24px 0;">',
    '<p style="margin:0;font-size:13px;color:#888;">— La Sucursal del Café<br>Switch Championship · 1.ª clasificatoria</p>',
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
    lines.push('Te registramos en la lista de espera del Switch Championship.');
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
    lines.push('Recibimos tu inscripción a la feria de La Sucursal del Café.');
    lines.push('Referencia: ' + id);
    lines.push('Fechas: 29 y 30 de agosto de 2026');
    lines.push('Sede: Palmetto Plaza, Cali');
    lines.push('La feria y el Switch Championship son eventos independientes (fechas y sedes distintas).');
    lines.push('Dudas: ' + ORGANIZER_EMAIL);
  }

  lines.push('');
  lines.push('— La Sucursal del Café');
  return lines.join('\n');
}

function sendConfirmationEmail_(formType, data) {
  var correo = normalizeEmail_(data.correo);
  if (!correo || correo.indexOf('@') === -1) return;

  var subject = 'Inscripción recibida — La Sucursal del Café';
  if (formType === 'competencia') subject = 'Switch Championship — inscripción ' + (data.id || '');
  if (formType === 'lista_espera') subject = 'Lista de espera — Switch Championship';
  if (formType === 'stands') subject = 'Solicitud de stand recibida — ' + (data.marca || data.id || '');

  try {
    if (formType === 'competencia') {
      MailApp.sendEmail({
        to: correo,
        subject: subject,
        body: buildCompetenciaEmailPlain_(data),
        htmlBody: buildCompetenciaEmailHtml_(data),
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
    lines.push('Formulario: Switch Championship (competencia)');
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
    lines.push('Formulario: Lista de espera (Switch Championship)');
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
    return '[Switch Championship] Nueva inscripción — ' + nombre + (id ? ' (' + id + ')' : '');
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
