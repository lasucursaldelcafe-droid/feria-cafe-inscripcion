/**
 * Web App de Google Apps Script — La Sucursal del Café
 * Recibe inscripciones JSON y las guarda en hojas "Feria" y "Competencia".
 *
 * Despliegue: Implementar > Nueva implementación > Aplicación web
 * Ejecutar como: Yo | Quién tiene acceso: Cualquier persona
 */

var SHEET_FERIA = 'Feria';
var SHEET_COMPETENCIA = 'Competencia';

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
  'Comprobante',
  'Observaciones'
];

function doGet() {
  return jsonResponse({
    ok: true,
    message: 'API de inscripciones — La Sucursal del Café',
    forms: ['feria', 'competencia']
  });
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

function appendCompetencia_(data) {
  var sheet = getOrCreateSheet_(SHEET_COMPETENCIA, HEADERS_COMPETENCIA);
  var equipo = data.equipoPropio || {};
  var envio = data.envio || {};
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
    data.comprobante || '',
    data.observaciones || ''
  ]);
}

function jsonResponse(obj, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
