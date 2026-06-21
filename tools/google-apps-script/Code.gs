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

var HEADERS_FERIA = [
  'Fecha registro', 'ID', 'Nombre', 'Edad', 'Celular', 'Correo', 'Intereses',
  'Acepta voluntaria', 'Acepta pertenencias', 'Acepta datos', 'Acepta imagen',
  'Estado registro', 'Notas admin'
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
  'Observaciones', 'Estado pago', 'Cupo confirmado', 'Notas admin'
];

var HEADERS_STANDS = [
  'Fecha registro', 'ID', 'Stand ID', 'Marca o negocio', 'Persona contacto', 'Celular', 'Correo',
  'Plan stand', 'Ciudad', 'Descripción exhibición',
  'Logo nombre', 'Logo tipo', 'Logo enlace Drive',
  'Acepta voluntaria', 'Acepta pertenencias', 'Acepta datos', 'Acepta imagen',
  'Estado solicitud', 'Notas admin', 'Código acceso (hash)'
];

var HEADERS_NOVEDADES = [
  'Timestamp', 'Titulo', 'Cuerpo', 'Audiencia'
];

var HEADERS_LISTA_ESPERA = [
  'Fecha registro', 'ID', 'Formulario', 'Nombre', 'Documento', 'Correo', 'Celular', 'Motivo', 'Notas admin'
];

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
  return jsonResponse({
    ok: true,
    message: 'API de inscripciones — La Sucursal del Café',
    forms: ['feria', 'competencia', 'stands', 'lista_espera', 'admin', 'analytics']
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
  Logger.log('Encabezados sincronizados: Feria, Competencia, Stands, Lista de espera, Analytics, Novedades.');
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
  ].concat(legalCols).concat([estado, '']));

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

function getStandsMapData_() {
  var sheet = getOrCreateSheet_(SHEET_STANDS, HEADERS_STANDS);
  var lastRow = sheet.getLastRow();
  var occupied = [];
  if (lastRow >= 2) {
    var standCol = HEADERS_STANDS.indexOf('Stand ID') + 1;
    var marcaCol = HEADERS_STANDS.indexOf('Marca o negocio') + 1;
    var logoCol = HEADERS_STANDS.indexOf('Logo enlace Drive') + 1;
    var standVals = standCol > 0 ? sheet.getRange(2, standCol, lastRow, standCol).getValues() : [];
    var marcaVals = marcaCol > 0 ? sheet.getRange(2, marcaCol, lastRow, marcaCol).getValues() : [];
    var logoVals = logoCol > 0 ? sheet.getRange(2, logoCol, lastRow, logoCol).getValues() : [];
    for (var i = 0; i < standVals.length; i++) {
      var sid = normalizeStandId_(standVals[i][0]);
      if (!sid) continue;
      occupied.push({
        standId: sid,
        marca: String(marcaVals[i][0] || ''),
        logoEnlace: String(logoVals[i][0] || '')
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
  return p === 'Zona Origen' || p === 'Zona Gran Reserva' || p === 'Aliado Patrocinador';
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

  var legalCols = parseFeriaLegalAcceptances_(data);
  var estado = 'Solicitud recibida';
  var contacto = data.contacto || data.nombre || '';
  var accessCode = generateAccessCode_();
  var accessHash = hashAccessCode_(accessCode);

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
    logo.nombre,
    logo.tipo,
    logo.enlace
  ].concat(legalCols).concat([estado, '', accessHash]));

  data.accessCode = accessCode;
  data.expositorPanelUrl = getExpositorPanelUrl_();
  sendConfirmationEmail_('stands', data);
  sendOrganizerNotificationEmail_('stands', data);
  return {
    id: data.id || '',
    logoEnlace: logo.enlace || '',
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

function buildEmailBody_(formType, data) {
  var id = data.id || '';
  var nombre = data.nombre || '';
  var lines = ['Hola ' + nombre + ',', ''];

  if (formType === 'competencia') {
    lines.push('Recibimos tu inscripción al Switch Championship (Evento 1).');
    lines.push('Número de inscripción: ' + id);
    lines.push('Fecha: 4 de julio de 2026');
    lines.push('Sede: Plaza Marbella, Centro Comercial (Curis)');
    lines.push('Pago: $90.000 COP a Nubank @mvl616 (Manuel Barraza)');
    lines.push('');
    lines.push('Únete al grupo de WhatsApp del torneo:');
    lines.push(WHATSAPP_GRUPO_COMPETENCIA);
    lines.push('');
    lines.push('Si adjuntaste comprobante, validaremos tu pago y confirmaremos tu cupo.');
    lines.push('Dudas: ' + ORGANIZER_EMAIL);
  } else if (formType === 'lista_espera') {
    lines.push('Te registramos en la lista de espera del Switch Championship.');
    lines.push('Referencia: ' + id);
    lines.push('Te contactaremos si se libera un cupo.');
    lines.push('Dudas: ' + ORGANIZER_EMAIL);
  } else if (formType === 'stands') {
    var contacto = data.contacto || nombre;
    lines.push('Recibimos tu solicitud de stand para la feria de La Sucursal del Café.');
    lines.push('Referencia: ' + id);
    lines.push('Marca o negocio: ' + (data.marca || ''));
    if (data.standId) lines.push('Stand seleccionado: ' + data.standId);
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
    MailApp.sendEmail(correo, subject, buildEmailBody_(formType, data));
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
    lines.push('Formulario: Solicitud de stand (expositor)');
    lines.push('ID: ' + id);
    lines.push('Marca o negocio: ' + (data.marca || ''));
    lines.push('Contacto: ' + (data.contacto || nombre));
    lines.push('Correo: ' + (data.correo || ''));
    lines.push('Celular: ' + (data.celular || ''));
    lines.push('Plan: ' + (data.plan || ''));
    if (data.standId) lines.push('Stand ID: ' + data.standId);
    lines.push('Ciudad: ' + (data.ciudad || ''));
    lines.push('Descripción: ' + (data.descripcion || ''));
    lines.push('');
    lines.push('Revisa la hoja "' + SHEET_STANDS + '" en Google Sheets para el detalle completo.');
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
    allFeria: allFeria,
    allCompetencia: allCompetencia,
    allStands: allStands
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
