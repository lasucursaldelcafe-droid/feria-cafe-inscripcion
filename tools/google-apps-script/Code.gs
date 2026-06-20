// Web App de Google Apps Script - La Sucursal del Cafe
// Recibe inscripciones JSON y las guarda en hojas Feria, Competencia y Lista de espera.
// Tras cada inscripcion valida envia confirmacion al participante y alerta a ORGANIZER_EMAIL.
// Redespliega la Web App tras editar este archivo (Implementar > Nueva implementacion).

var SHEET_FERIA = 'Feria';
var SHEET_COMPETENCIA = 'Competencia';
var SHEET_LISTA_ESPERA = 'Lista de espera';
var CUPO_MAX_COMPETENCIA = 36;
var COMPROBANTE_PREVIEW_MAX = 1000;
var DRIVE_FOLDER_NAME = 'Switch Championship — Comprobantes';
var DRIVE_FOTOS_FOLDER_NAME = 'Switch Championship — Fotos participantes';
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
  return jsonResponse({
    ok: true,
    message: 'API de inscripciones — La Sucursal del Café',
    forms: ['feria', 'competencia', 'lista_espera']
  });
}

function doOptions() {
  return jsonResponse({ ok: true, message: 'CORS preflight' });
}

function doPost(e) {
  try {
    var payload = parsePayload_(e);
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
  applyHeaders_(getOrCreateSheet_(SHEET_LISTA_ESPERA, HEADERS_LISTA_ESPERA), HEADERS_LISTA_ESPERA);
  Logger.log('Encabezados sincronizados: Feria, Competencia, Lista de espera.');
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
    lines.push('Sede: Purist Marbella, Ciudad Jardín');
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
