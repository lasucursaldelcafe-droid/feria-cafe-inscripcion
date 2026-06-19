/**
 * Web App de Google Apps Script — La Sucursal del Café
 * Recibe inscripciones JSON y las guarda en hojas "Feria" y "Competencia".
 *
 * Despliegue: Implementar > Nueva implementación > Aplicación web
 * Ejecutar como: Yo | Quién tiene acceso: Cualquier persona
 */

var SHEET_FERIA = 'Feria';
var SHEET_COMPETENCIA = 'Competencia';
var COMPROBANTE_PREVIEW_MAX = 1000;
var DRIVE_FOLDER_NAME = 'Switch Championship — Comprobantes';

var HEADERS_FERIA = [
  'Fecha registro',
  'ID',
  'Nombre',
  'Edad',
  'Celular',
  'Correo',
  'Intereses'
];

var HEADERS_COMPETENCIA = [
  'Fecha registro',
  'ID',
  'Evento',
  'Valor inscripción',
  'Nombre',
  'Documento',
  'Edad',
  'Ciudad',
  'Celular',
  'Correo',
  'Representa',
  'Rol',
  'Experiencia café',
  'Experiencia Switch',
  'Torneos previos',
  'Equipo Switch',
  'Equipo gramera',
  'Equipo tetera',
  'Dirección envío',
  'Ciudad envío',
  'Departamento',
  'Código postal',
  'Receptor',
  'Instrucciones envío',
  'Método pago',
  'Referencia pago',
  'Tiene comprobante',
  'Comprobante nombre',
  'Comprobante tipo',
  'Comprobante enlace Drive',
  'Comprobante base64 (preview)',
  'Acepta voluntaria',
  'Acepta pertenencias',
  'Acepta datos',
  'Acepta no reembolso',
  'Acepta descalificación',
  'Acepta reglas',
  'Acepta disponibilidad',
  'Acepta imagen',
  'Observaciones'
];

function doGet() {
  return jsonResponse({
    ok: true,
    message: 'API de inscripciones — La Sucursal del Café',
    forms: ['feria', 'competencia']
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

    if (formType === 'feria') {
      appendFeria_(data);
    } else if (formType === 'competencia') {
      appendCompetencia_(data);
    } else {
      return jsonResponse({ ok: false, error: 'formType inválido. Usa "feria" o "competencia".' }, 400);
    }

    return jsonResponse({ ok: true, formType: formType });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) }, 500);
  }
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Cuerpo de solicitud vacío.');
  }
  var raw = e.postData.contents;
  var parsed = JSON.parse(raw);
  return parsed;
}

function getOrCreateSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendFeria_(data) {
  var sheet = getOrCreateSheet_(SHEET_FERIA, HEADERS_FERIA);
  var intereses = Array.isArray(data.intereses) ? data.intereses.join('; ') : String(data.intereses || '');
  sheet.appendRow([
    data.fecha || new Date().toISOString(),
    data.id || '',
    data.nombre || '',
    data.edad || '',
    data.celular || '',
    data.correo || '',
    intereses
  ]);
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
      ? base64.substring(0, COMPROBANTE_PREVIEW_MAX) + '…'
      : base64;
    enlace = saveComprobanteToDrive_(data.id || 'sin-id', nombre, tipo, base64);
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

function saveComprobanteToDrive_(inscripcionId, nombreArchivo, mimeType, dataUrl) {
  try {
    var match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return '';

    var mime = mimeType || match[1];
    var bytes = Utilities.base64Decode(match[2]);
    var blob = Utilities.newBlob(bytes, mime, nombreArchivo || 'comprobante');

    var folder = getOrCreateComprobantesFolder_();
    var safeName = String(inscripcionId).replace(/[^\w\-]/g, '_');
    var ext = guessExtension_(mime, nombreArchivo);
    var file = folder.createFile(blob.setName(safeName + '_' + (nombreArchivo || ('comprobante' + ext))));

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      // Si falla el permiso, conservar el archivo privado con enlace interno.
    }

    return file.getUrl();
  } catch (err) {
    Logger.log('Error guardando comprobante en Drive: ' + err);
    return '';
  }
}

function getOrCreateComprobantesFolder_() {
  var folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
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

function parseLegalAcceptances_(data) {
  var legal = data.aceptacionesLegales || {};
  function yn(key) {
    return legal[key] ? 'Sí' : 'No';
  }
  return [
    yn('aceptaVoluntaria'),
    yn('aceptaPertenencias'),
    yn('aceptaDatos'),
    yn('aceptaNoReembolso'),
    yn('aceptaDescalificacion'),
    yn('aceptaReglas'),
    yn('aceptaDisponibilidad'),
    yn('aceptaImagen')
  ];
}

function appendCompetencia_(data) {
  var sheet = getOrCreateSheet_(SHEET_COMPETENCIA, HEADERS_COMPETENCIA);
  var equipo = data.equipoPropio || {};
  var envio = data.envio || {};
  var comp = parseComprobante_(data);
  var legalCols = parseLegalAcceptances_(data);

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
    data.observaciones || ''
  ]));
}

function jsonResponse(obj, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
