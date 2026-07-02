/**
 * Plantillas y editor visual para PNG de competidores (1080×1440).
 * Una plantilla guardada se aplica a todos los competidores al generar PNG.
 */
(function (global) {
  'use strict';

  var W = 1080;
  var H = 1440;
  var STORAGE_KEY = 'feria_admin_competidor_png_layout_v1';
  var PREVIEW_SCALE = 0.34;

  var deps = {
    buildAdminUrl: null,
    fetchJson: null
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function baseZones() {
    return [
      { id: 'kicker', label: 'Encabezado', type: 'text', field: 'kicker', x: 48, y: 36, w: 984, h: 44, fontSize: 42, fontWeight: '800', color: '#f6ead8', align: 'center', maxLines: 1 },
      { id: 'edition', label: 'Edición', type: 'text', field: 'edition', x: 48, y: 82, w: 984, h: 36, fontSize: 26, fontWeight: '600', color: 'rgba(246,234,216,0.78)', align: 'center', maxLines: 1 },
      { id: 'badge', label: 'ID', type: 'text', field: 'id', x: 48, y: 118, w: 984, h: 32, fontSize: 22, fontWeight: '700', color: '#e8a84c', align: 'center', maxLines: 1 },
      { id: 'photo', label: 'Foto', type: 'photo', x: 48, y: 158, w: 984, h: 920, radius: 28, faceY: 0.28 },
      { id: 'name', label: 'Nombre', type: 'text', field: 'nombre', x: 48, y: 1100, w: 984, h: 132, fontSize: 62, fontWeight: '800', color: '#ffffff', align: 'center', maxLines: 2, lineHeight: 66 },
      { id: 'subtitle', label: 'Subtítulo', type: 'text', field: 'subtitle', x: 48, y: 1238, w: 984, h: 36, fontSize: 28, fontWeight: '700', color: '#f5d9a8', align: 'center', maxLines: 1 },
      { id: 'profileLabel', label: 'Etiqueta perfil', type: 'text', field: 'profileLabel', x: 48, y: 1278, w: 984, h: 30, fontSize: 24, fontWeight: '600', color: 'rgba(255,255,255,0.82)', align: 'center', maxLines: 1 },
      { id: 'profile', label: 'Perfil', type: 'profileLines', x: 48, y: 1310, w: 984, h: 90, fontSize: 24, fontWeight: '500', color: 'rgba(255,255,255,0.9)', align: 'center', maxLines: 4, lineHeight: 32 },
      { id: 'footer', label: 'Pie', type: 'footer', x: 48, y: 1336, w: 984, h: 56, fontSize: 24, fontWeight: '700', color: '#f6ead8', align: 'center', text: 'Café filtrado · Plaza Marbella · Purist', radius: 18 }
    ];
  }

  var TEMPLATES = [
    {
      id: 'portrait-classic',
      name: 'Retrato clásico',
      description: 'Foto grande arriba, texto abajo (estilo Instagram 3:4).',
      background: { stops: ['#2a1a12', '#4a2f18', '#120d0a'] },
      safeMargin: 48,
      zones: baseZones()
    },
    {
      id: 'portrait-compact',
      name: 'Retrato compacto',
      description: 'Más espacio para perfil; foto un poco más baja.',
      background: { stops: ['#24160f', '#3d2818', '#0f0a08'] },
      safeMargin: 56,
      zones: (function () {
        var z = baseZones();
        z[3] = Object.assign({}, z[3], { y: 150, h: 780 });
        z[4] = Object.assign({}, z[4], { y: 960, fontSize: 56, h: 120 });
        z[5] = Object.assign({}, z[5], { y: 1088 });
        z[6] = Object.assign({}, z[6], { y: 1128 });
        z[7] = Object.assign({}, z[7], { y: 1160, h: 130 });
        z[8] = Object.assign({}, z[8], { y: 1330 });
        return z;
      })()
    },
    {
      id: 'photo-hero',
      name: 'Foto héroe',
      description: 'Foto casi a pantalla completa; texto en franja inferior.',
      background: { stops: ['#1a100c', '#2a1a12', '#0a0604'] },
      safeMargin: 40,
      zones: [
        { id: 'photo', label: 'Foto', type: 'photo', x: 0, y: 0, w: W, h: 1180, radius: 0, faceY: 0.22 },
        { id: 'overlay', label: 'Sombra', type: 'overlay', x: 0, y: 900, w: W, h: 540, color: 'rgba(0,0,0,0.55)' },
        { id: 'kicker', label: 'Encabezado', type: 'text', field: 'kicker', x: 48, y: 1020, w: 984, h: 40, fontSize: 36, fontWeight: '800', color: '#f6ead8', align: 'center', maxLines: 1 },
        { id: 'name', label: 'Nombre', type: 'text', field: 'nombre', x: 48, y: 1068, w: 984, h: 120, fontSize: 58, fontWeight: '800', color: '#ffffff', align: 'center', maxLines: 2, lineHeight: 62 },
        { id: 'subtitle', label: 'Subtítulo', type: 'text', field: 'subtitle', x: 48, y: 1190, w: 984, h: 36, fontSize: 26, fontWeight: '700', color: '#f5d9a8', align: 'center', maxLines: 1 },
        { id: 'profile', label: 'Perfil', type: 'profileLines', x: 48, y: 1234, w: 984, h: 120, fontSize: 22, fontWeight: '500', color: 'rgba(255,255,255,0.92)', align: 'center', maxLines: 3, lineHeight: 30 },
        { id: 'footer', label: 'Pie', type: 'footer', x: 48, y: 1360, w: 984, h: 48, fontSize: 22, fontWeight: '700', color: '#f6ead8', align: 'center', text: 'Purist Marbella · V60', radius: 14 }
      ]
    },
    {
      id: 'split-left',
      name: 'Dividido izquierda',
      description: 'Foto a la izquierda; datos a la derecha.',
      background: { stops: ['#2c1c14', '#45301e', '#110c09'] },
      safeMargin: 44,
      zones: [
        { id: 'kicker', label: 'Encabezado', type: 'text', field: 'kicker', x: 48, y: 40, w: 984, h: 40, fontSize: 38, fontWeight: '800', color: '#f6ead8', align: 'left', maxLines: 1 },
        { id: 'edition', label: 'Edición', type: 'text', field: 'edition', x: 48, y: 84, w: 520, h: 32, fontSize: 24, fontWeight: '600', color: 'rgba(246,234,216,0.78)', align: 'left', maxLines: 1 },
        { id: 'badge', label: 'ID', type: 'text', field: 'id', x: 600, y: 84, w: 432, h: 32, fontSize: 20, fontWeight: '700', color: '#e8a84c', align: 'right', maxLines: 1 },
        { id: 'photo', label: 'Foto', type: 'photo', x: 48, y: 140, w: 460, h: 1240, radius: 24, faceY: 0.3 },
        { id: 'name', label: 'Nombre', type: 'text', field: 'nombre', x: 540, y: 180, w: 492, h: 140, fontSize: 48, fontWeight: '800', color: '#ffffff', align: 'left', maxLines: 3, lineHeight: 52 },
        { id: 'subtitle', label: 'Subtítulo', type: 'text', field: 'subtitle', x: 540, y: 340, w: 492, h: 80, fontSize: 24, fontWeight: '700', color: '#f5d9a8', align: 'left', maxLines: 2, lineHeight: 30 },
        { id: 'profile', label: 'Perfil', type: 'profileLines', x: 540, y: 440, w: 492, h: 820, fontSize: 22, fontWeight: '500', color: 'rgba(255,255,255,0.9)', align: 'left', maxLines: 12, lineHeight: 32 },
        { id: 'footer', label: 'Pie', type: 'footer', x: 540, y: 1320, w: 492, h: 56, fontSize: 22, fontWeight: '700', color: '#f6ead8', align: 'left', text: 'V60 · Purist Marbella', radius: 16 }
      ]
    },
    {
      id: 'minimal-center',
      name: 'Minimal centrado',
      description: 'Foto mediana centrada; mucho aire alrededor.',
      background: { stops: ['#1f1410', '#2e2016', '#0d0907'] },
      safeMargin: 72,
      zones: [
        { id: 'kicker', label: 'Encabezado', type: 'text', field: 'kicker', x: 72, y: 56, w: 936, h: 40, fontSize: 34, fontWeight: '800', color: '#f6ead8', align: 'center', maxLines: 1 },
        { id: 'photo', label: 'Foto', type: 'photo', x: 190, y: 120, w: 700, h: 700, radius: 32, faceY: 0.32 },
        { id: 'name', label: 'Nombre', type: 'text', field: 'nombre', x: 72, y: 860, w: 936, h: 120, fontSize: 54, fontWeight: '800', color: '#ffffff', align: 'center', maxLines: 2, lineHeight: 58 },
        { id: 'subtitle', label: 'Subtítulo', type: 'text', field: 'subtitle', x: 72, y: 990, w: 936, h: 40, fontSize: 26, fontWeight: '600', color: '#f5d9a8', align: 'center', maxLines: 1 },
        { id: 'profile', label: 'Perfil', type: 'profileLines', x: 100, y: 1040, w: 880, h: 280, fontSize: 23, fontWeight: '500', color: 'rgba(255,255,255,0.88)', align: 'center', maxLines: 5, lineHeight: 32 },
        { id: 'footer', label: 'Pie', type: 'footer', x: 120, y: 1340, w: 840, h: 52, fontSize: 22, fontWeight: '700', color: '#f6ead8', align: 'center', text: 'La Sucursal del Café · V60', radius: 20 }
      ]
    },
    {
      id: 'bold-footer',
      name: 'Pie destacado',
      description: 'Foto alta; bloque inferior amplio para perfil.',
      background: { stops: ['#261810', '#4a3020', '#100a07'] },
      safeMargin: 48,
      zones: [
        { id: 'photo', label: 'Foto', type: 'photo', x: 48, y: 48, w: 984, h: 860, radius: 30, faceY: 0.26 },
        { id: 'name', label: 'Nombre', type: 'text', field: 'nombre', x: 48, y: 930, w: 984, h: 110, fontSize: 60, fontWeight: '800', color: '#ffffff', align: 'center', maxLines: 2, lineHeight: 64 },
        { id: 'kicker', label: 'Encabezado', type: 'text', field: 'kicker', x: 48, y: 1048, w: 984, h: 36, fontSize: 30, fontWeight: '800', color: '#e8a84c', align: 'center', maxLines: 1 },
        { id: 'profile', label: 'Perfil', type: 'profileLines', x: 64, y: 1096, w: 952, h: 200, fontSize: 24, fontWeight: '500', color: 'rgba(255,255,255,0.9)', align: 'center', maxLines: 4, lineHeight: 32 },
        { id: 'footer', label: 'Pie', type: 'footer', x: 48, y: 1320, w: 984, h: 72, fontSize: 26, fontWeight: '700', color: '#f6ead8', align: 'center', text: 'Edición Purist Marbella · Reto V60', radius: 20 }
      ]
    }
  ];

  function getTemplate(id) {
    for (var i = 0; i < TEMPLATES.length; i++) {
      if (TEMPLATES[i].id === id) return clone(TEMPLATES[i]);
    }
    return clone(TEMPLATES[0]);
  }

  function loadLayout() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return getTemplate('portrait-classic');
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.zones || !parsed.zones.length) return getTemplate('portrait-classic');
      return parsed;
    } catch (e) {
      return getTemplate('portrait-classic');
    }
  }

  function saveLayout(layout) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }

  function val(row, keys) {
    for (var i = 0; i < keys.length; i++) {
      var value = row[keys[i]];
      if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
    }
    return '';
  }

  function competitorProfileLines(row) {
    var lines = [];
    var representa = val(row, ['Representa']);
    var rol = val(row, ['Rol']);
    var experienciaCafe = val(row, ['Experiencia café', 'Experiencia cafe']);
    var experienciaSwitch = val(row, ['Experiencia Switch', 'Experiencia V60']);
    var torneos = val(row, ['Torneos previos']);
    var ciudad = val(row, ['Ciudad']);

    if (rol || representa) {
      lines.push((rol || 'Competidor/a') + (representa ? ' · ' + representa : ''));
    }
    if (experienciaCafe || experienciaSwitch) {
      lines.push([
        experienciaCafe ? 'Café ' + experienciaCafe : '',
        experienciaSwitch ? 'V60 ' + experienciaSwitch : ''
      ].filter(Boolean).join(' · '));
    }
    if (torneos) lines.push('Torneos: ' + torneos);
    if (ciudad) lines.push(ciudad);
    return lines.length ? lines : ['Perfil barista — Reto V60'];
  }

  function fieldText(field, row, zone) {
    var name = val(row, ['Nombre']) || 'Competidor';
    var id = val(row, ['ID']);
    var rol = val(row, ['Rol']);
    var representa = val(row, ['Representa']);
    switch (field) {
      case 'kicker': return 'RETO V60';
      case 'edition': return 'Edición Purist Marbella';
      case 'id': return id || 'Competidor';
      case 'nombre': return name;
      case 'subtitle':
        return (rol || 'Competidor oficial') + (representa ? ' · ' + representa : '');
      case 'profileLabel': return 'Perfil del barista';
      default:
        return zone.text || '';
    }
  }

  function driveFileId(url) {
    var raw = String(url || '').trim();
    if (!raw) return '';
    var match = raw.match(/\/file\/d\/([^/]+)/) || raw.match(/[?&]id=([^&]+)/);
    if (match && match[1]) return String(match[1]).trim();
    return /^[a-zA-Z0-9_-]{20,}$/.test(raw) ? raw : '';
  }

  function driveThumb(url, size) {
    var raw = String(url || '').trim();
    if (!raw) return '';
    var match = raw.match(/\/file\/d\/([^/]+)/) || raw.match(/[?&]id=([^&]+)/);
    if (match) return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(match[1]) + '&sz=w' + (size || 1200);
    return raw;
  }

  function loadCanvasImage(url, options) {
    options = options || {};
    return new Promise(function (resolve) {
      if (!url) { resolve(null); return; }
      var img = new Image();
      var objectUrl = options.revokeObjectUrl || '';
      var src = String(url);
      var isInline = src.indexOf('data:') === 0 || src.indexOf('blob:') === 0;
      img.onload = function () {
        if (objectUrl) setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 2000);
        resolve(img);
      };
      img.onerror = function () {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      if (!isInline) img.crossOrigin = 'anonymous';
      img.src = src;
    });
  }

  function loadCompetitorPhoto(row) {
    var driveUrl = val(row, ['Foto participante enlace Drive']);
    var fileId = driveFileId(driveUrl);
    if (!fileId || !deps.buildAdminUrl) return Promise.resolve(null);

    var photoUrl = deps.buildAdminUrl('competidor_foto', { id: fileId });
    return fetch(photoUrl, { method: 'GET', mode: 'cors', cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) return null;
        var type = (res.headers.get('content-type') || '').toLowerCase();
        if (type.indexOf('image/') !== 0) return null;
        return res.blob();
      })
      .catch(function () { return null; })
      .then(function (blob) {
        if (blob && blob.size > 0) {
          var objectUrl = URL.createObjectURL(blob);
          return loadCanvasImage(objectUrl, { revokeObjectUrl: objectUrl });
        }
        var dataUrlEndpoint = deps.buildAdminUrl('competidor_foto_data', { id: fileId });
        if (!dataUrlEndpoint || !deps.fetchJson) return loadCanvasImage(driveThumb(driveUrl, 1600));
        return deps.fetchJson(dataUrlEndpoint).then(function (res) {
          if (res && res.ok && res.dataUrl) return loadCanvasImage(res.dataUrl);
          return loadCanvasImage(driveThumb(driveUrl, 1600));
        });
      });
  }

  function roundedRect(ctx, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function drawBackground(ctx, layout) {
    var stops = (layout.background && layout.background.stops) || ['#2a1a12', '#4a2f18', '#120d0a'];
    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, stops[0]);
    bg.addColorStop(0.5, stops[1] || stops[0]);
    bg.addColorStop(1, stops[2] || stops[1] || stops[0]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.arc(W - 60, 100, 220, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(70, H - 80, 200, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPhoto(ctx, img, zone) {
    var x = zone.x;
    var y = zone.y;
    var w = zone.w;
    var h = zone.h;
    var r = zone.radius || 0;
    roundedRect(ctx, x, y, w, h, r);
    ctx.save();
    ctx.clip();

    var grd = ctx.createLinearGradient(x, y, x + w, y + h);
    grd.addColorStop(0, '#3b291f');
    grd.addColorStop(1, '#14100d');
    ctx.fillStyle = grd;
    ctx.fillRect(x, y, w, h);

    if (img) {
      var scale = Math.min(w / img.width, h / img.height);
      var dw = img.width * scale;
      var dh = img.height * scale;
      var dx = x + (w - dw) / 2;
      var dy = y + (h - dh) / 2;
      if (img.height >= img.width) {
        dy = y + Math.max(0, (h - dh) * (zone.faceY != null ? zone.faceY : 0.28));
      }
      ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '700 36px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Foto', x + w / 2, y + h / 2);
    }
    ctx.restore();
  }

  function wrapText(ctx, text, zone) {
    var align = zone.align || 'left';
    var maxWidth = zone.w - 8;
    var lineHeight = zone.lineHeight || Math.round((zone.fontSize || 24) * 1.35);
    var maxLines = zone.maxLines || 4;
    var words = String(text || '').split(/\s+/).filter(Boolean);
    var line = '';
    var lines = [];
    var n;

    ctx.textAlign = align;
    for (n = 0; n < words.length; n++) {
      var test = line ? line + ' ' + words[n] : words[n];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = words[n];
      } else {
        line = test;
      }
      if (lines.length === maxLines) break;
    }
    if (line && lines.length < maxLines) lines.push(line);

    var startX = zone.x + (align === 'center' ? zone.w / 2 : align === 'right' ? zone.w - 4 : 4);
    var y = zone.y + (zone.fontSize || 24);
    lines.forEach(function (l, idx) {
      ctx.fillText(l, startX, y + idx * lineHeight);
    });
  }

  function renderCanvas(row, layout) {
    layout = layout || loadLayout();
    return loadCompetitorPhoto(row).then(function (img) {
      var canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      var ctx = canvas.getContext('2d');
      drawBackground(ctx, layout);

      layout.zones.forEach(function (zone) {
        if (zone.type === 'overlay') {
          ctx.fillStyle = zone.color || 'rgba(0,0,0,0.4)';
          ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
          return;
        }
        if (zone.type === 'photo') {
          drawPhoto(ctx, img, zone);
          return;
        }
        if (zone.type === 'footer') {
          ctx.fillStyle = 'rgba(0,0,0,0.32)';
          roundedRect(ctx, zone.x, zone.y, zone.w, zone.h, zone.radius || 16);
          ctx.fill();
          ctx.fillStyle = zone.color || '#f6ead8';
          ctx.font = (zone.fontWeight || '700') + ' ' + (zone.fontSize || 24) + 'px Inter, Arial, sans-serif';
          wrapText(ctx, zone.text || fieldText('footer', row, zone), Object.assign({}, zone, { y: zone.y + zone.h / 2 - 12, h: zone.h }));
          return;
        }
        if (zone.type === 'profileLines') {
          ctx.fillStyle = zone.color || '#fff';
          ctx.font = (zone.fontWeight || '500') + ' ' + (zone.fontSize || 24) + 'px Inter, Arial, sans-serif';
          var lines = competitorProfileLines(row).slice(0, zone.maxLines || 4);
          var block = Object.assign({}, zone);
          lines.forEach(function (line, idx) {
            wrapText(ctx, line, Object.assign({}, block, { y: zone.y + idx * (zone.lineHeight || 32), maxLines: 2 }));
          });
          return;
        }
        if (zone.type === 'text') {
          ctx.fillStyle = zone.color || '#fff';
          ctx.font = (zone.fontWeight || '600') + ' ' + (zone.fontSize || 24) + 'px Inter, Arial, sans-serif';
          wrapText(ctx, fieldText(zone.field, row, zone), zone);
        }
      });

      return canvas;
    });
  }

  function sampleRow() {
    return {
      ID: 'COMP-EJEMPLO',
      Nombre: 'María Fernanda Rodríguez',
      Rol: 'Barista',
      Representa: 'Purist Café',
      Ciudad: 'Cali',
      'Experiencia café': '3–5 años',
      'Experiencia Switch': 'Avanzada',
      'Torneos previos': 'Regional 2024',
      'Foto participante enlace Drive': ''
    };
  }

  function mountEditor(container, options) {
    options = options || {};
    var layout = loadLayout();
    var selectedZoneId = layout.zones[0] ? layout.zones[0].id : '';
    var dragState = null;
    var previewRow = options.sampleRow || sampleRow();

    container.innerHTML =
      '<div class="png-layout-editor">' +
        '<div class="png-layout-editor__toolbar">' +
          '<label class="png-layout-editor__field">Plantilla' +
            '<select id="pngLayoutTemplate"></select>' +
          '</label>' +
          '<button type="button" class="admin-btn admin-btn--secondary" id="pngLayoutReset">Restablecer plantilla</button>' +
          '<button type="button" class="admin-btn admin-btn--primary" id="pngLayoutSave">Guardar plantilla</button>' +
          '<button type="button" class="admin-btn admin-btn--secondary" id="pngLayoutPreviewPng">Vista previa PNG</button>' +
        '</div>' +
        '<p class="admin-table-meta png-layout-editor__hint">Arrastra cada zona en el lienzo. Los márgenes seguros aparecen en línea punteada. Esta plantilla se usa para <strong>todos</strong> los PNG de competidores.</p>' +
        '<div class="png-layout-editor__body">' +
          '<div class="png-layout-editor__stage-wrap">' +
            '<div class="png-layout-editor__stage" id="pngLayoutStage"></div>' +
            '<canvas id="pngLayoutPreviewCanvas" class="png-layout-editor__preview-canvas" width="' + W + '" height="' + H + '" hidden></canvas>' +
          '</div>' +
          '<div class="png-layout-editor__sidebar">' +
            '<h5 class="png-layout-editor__sidebar-title">Zonas</h5>' +
            '<ul id="pngLayoutZoneList" class="png-layout-zone-list"></ul>' +
            '<div id="pngLayoutZoneForm" class="png-layout-zone-form"></div>' +
            '<div class="png-layout-templates">' +
              '<h5>Ejemplos de plantillas</h5>' +
              '<ul id="pngLayoutTemplateList" class="png-layout-template-list"></ul>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    var templateSelect = container.querySelector('#pngLayoutTemplate');
    TEMPLATES.forEach(function (tpl) {
      var opt = document.createElement('option');
      opt.value = tpl.id;
      opt.textContent = tpl.name;
      if (layout.templateId === tpl.id || (!layout.templateId && tpl.id === 'portrait-classic')) {
        opt.selected = true;
      }
      templateSelect.appendChild(opt);
    });

    var stage = container.querySelector('#pngLayoutStage');
    var zoneList = container.querySelector('#pngLayoutZoneList');
    var zoneForm = container.querySelector('#pngLayoutZoneForm');
    var templateList = container.querySelector('#pngLayoutTemplateList');

    function marginsFor(zone) {
      return {
        top: zone.y,
        left: zone.x,
        right: W - (zone.x + zone.w),
        bottom: H - (zone.y + zone.h)
      };
    }

    function renderTemplateList() {
      templateList.innerHTML = TEMPLATES.map(function (tpl) {
        return '<li><button type="button" class="png-layout-template-item" data-template-id="' + tpl.id + '">' +
          '<strong>' + tpl.name + '</strong><span>' + tpl.description + '</span></button></li>';
      }).join('');
      templateList.querySelectorAll('[data-template-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          applyTemplate(btn.getAttribute('data-template-id'));
        });
      });
    }

    function applyTemplate(id) {
      var tpl = getTemplate(id);
      tpl.templateId = id;
      layout = tpl;
      if (layout.zones.length) selectedZoneId = layout.zones[0].id;
      templateSelect.value = id;
      renderAll();
    }

    function renderZoneList() {
      zoneList.innerHTML = layout.zones.map(function (zone) {
        var sel = zone.id === selectedZoneId ? ' png-layout-zone-list__item--active' : '';
        return '<li><button type="button" class="png-layout-zone-list__item' + sel + '" data-zone-id="' + zone.id + '">' +
          escapeHtml(zone.label || zone.id) + ' <small>(' + zone.type + ')</small></button></li>';
      }).join('');
      zoneList.querySelectorAll('[data-zone-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          selectedZoneId = btn.getAttribute('data-zone-id');
          renderAll();
        });
      });
    }

    function renderZoneForm() {
      var zone = layout.zones.filter(function (z) { return z.id === selectedZoneId; })[0];
      if (!zone) {
        zoneForm.innerHTML = '<p class="admin-table-meta">Selecciona una zona.</p>';
        return;
      }
      var m = marginsFor(zone);
      zoneForm.innerHTML =
        '<p class="png-layout-zone-form__title">' + escapeHtml(zone.label || zone.id) + '</p>' +
        '<div class="png-layout-zone-form__grid">' +
          numInput('X', zone.x, 'zone-x') +
          numInput('Y', zone.y, 'zone-y') +
          numInput('Ancho', zone.w, 'zone-w') +
          numInput('Alto', zone.h, 'zone-h') +
        '</div>' +
        '<p class="admin-table-meta">Márgenes libres: arriba ' + m.top + ' · izq ' + m.left + ' · der ' + m.right + ' · abajo ' + m.bottom + ' px</p>' +
        (zone.type === 'text' || zone.type === 'footer' ? numInput('Tamaño texto', zone.fontSize || 24, 'zone-font') : '') +
        (zone.type === 'photo' ? numInput('Foco rostro (0–1)', zone.faceY != null ? zone.faceY : 0.28, 'zone-face', 0.01) : '');

      zoneForm.querySelectorAll('input').forEach(function (input) {
        input.addEventListener('change', function () {
          var key = input.getAttribute('data-key');
          var v = input.type === 'number' ? parseFloat(input.value, 10) : input.value;
          if (isNaN(v)) return;
          if (key === 'x') zone.x = clamp(v, 0, W - zone.w);
          if (key === 'y') zone.y = clamp(v, 0, H - zone.h);
          if (key === 'w') zone.w = clamp(v, 40, W - zone.x);
          if (key === 'h') zone.h = clamp(v, 24, H - zone.y);
          if (key === 'fontSize') zone.fontSize = clamp(v, 12, 120);
          if (key === 'faceY') zone.faceY = clamp(v, 0, 1);
          renderAll();
        });
      });
    }

    function numInput(label, value, id, step) {
      return '<label class="png-layout-zone-form__field">' + label +
        '<input type="number" id="' + id + '" data-key="' + id.replace('zone-', '') + '" value="' + value + '" step="' + (step || 1) + '">' +
        '</label>';
    }

    function clamp(n, min, max) {
      return Math.max(min, Math.min(max, n));
    }

    function renderStage() {
      var margin = layout.safeMargin || 48;
      stage.innerHTML = '';
      stage.style.width = Math.round(W * PREVIEW_SCALE) + 'px';
      stage.style.height = Math.round(H * PREVIEW_SCALE) + 'px';

      var safe = document.createElement('div');
      safe.className = 'png-layout-editor__safe';
      safe.style.left = Math.round(margin * PREVIEW_SCALE) + 'px';
      safe.style.top = Math.round(margin * PREVIEW_SCALE) + 'px';
      safe.style.width = Math.round((W - margin * 2) * PREVIEW_SCALE) + 'px';
      safe.style.height = Math.round((H - margin * 2) * PREVIEW_SCALE) + 'px';
      stage.appendChild(safe);

      layout.zones.forEach(function (zone) {
        var el = document.createElement('button');
        el.type = 'button';
        el.className = 'png-layout-zone' + (zone.id === selectedZoneId ? ' png-layout-zone--active' : '');
        el.setAttribute('data-zone-id', zone.id);
        el.style.left = Math.round(zone.x * PREVIEW_SCALE) + 'px';
        el.style.top = Math.round(zone.y * PREVIEW_SCALE) + 'px';
        el.style.width = Math.round(zone.w * PREVIEW_SCALE) + 'px';
        el.style.height = Math.round(zone.h * PREVIEW_SCALE) + 'px';
        el.innerHTML = '<span>' + escapeHtml(zone.label || zone.id) + '</span>';
        stage.appendChild(el);

        el.addEventListener('pointerdown', function (ev) {
          ev.preventDefault();
          selectedZoneId = zone.id;
          dragState = {
            zoneId: zone.id,
            startX: ev.clientX,
            startY: ev.clientY,
            origX: zone.x,
            origY: zone.y
          };
          el.setPointerCapture(ev.pointerId);
          renderZoneList();
          renderZoneForm();
          el.classList.add('png-layout-zone--active');
        });
        el.addEventListener('pointermove', function (ev) {
          if (!dragState || dragState.zoneId !== zone.id) return;
          var dx = (ev.clientX - dragState.startX) / PREVIEW_SCALE;
          var dy = (ev.clientY - dragState.startY) / PREVIEW_SCALE;
          zone.x = clamp(Math.round(dragState.origX + dx), 0, W - zone.w);
          zone.y = clamp(Math.round(dragState.origY + dy), 0, H - zone.h);
          el.style.left = Math.round(zone.x * PREVIEW_SCALE) + 'px';
          el.style.top = Math.round(zone.y * PREVIEW_SCALE) + 'px';
          renderZoneForm();
        });
        el.addEventListener('pointerup', function () {
          dragState = null;
          refreshPreviewCanvas();
        });
      });
    }

    function refreshPreviewCanvas() {
      var canvas = container.querySelector('#pngLayoutPreviewCanvas');
      if (!canvas) return;
      renderCanvas(previewRow, layout).then(function (source) {
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(source, 0, 0);
        canvas.hidden = false;
        var dataUrl = source.toDataURL('image/png');
        stage.style.backgroundImage = 'url(' + dataUrl + ')';
        stage.style.backgroundSize = '100% 100%';
      }).catch(function () { /* sin foto de ejemplo */ });
    }

    function renderAll() {
      renderZoneList();
      renderZoneForm();
      renderStage();
      refreshPreviewCanvas();
    }

    templateSelect.addEventListener('change', function () {
      applyTemplate(templateSelect.value);
    });

    container.querySelector('#pngLayoutSave').addEventListener('click', function () {
      layout.templateId = templateSelect.value;
      saveLayout(layout);
      alert('Plantilla guardada. Todos los PNG usarán este diseño.');
    });

    container.querySelector('#pngLayoutReset').addEventListener('click', function () {
      applyTemplate(templateSelect.value);
    });

    container.querySelector('#pngLayoutPreviewPng').addEventListener('click', function () {
      var row = options.getPreviewRow ? options.getPreviewRow() : previewRow;
      renderCanvas(row, layout).then(function (canvas) {
        canvas.toBlob(function (blob) {
          if (!blob) return;
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'plantilla-competidor-preview.png';
          a.click();
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        });
      });
    });

    renderTemplateList();
    renderAll();

    return {
      getLayout: function () { return layout; },
      setPreviewRow: function (row) { previewRow = row || sampleRow(); refreshPreviewCanvas(); },
      refresh: refreshPreviewCanvas
    };
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function init(options) {
    deps.buildAdminUrl = options.buildAdminUrl;
    deps.fetchJson = options.fetchJson;
  }

  global.AdminCompetidorPng = {
    init: init,
    loadLayout: loadLayout,
    saveLayout: saveLayout,
    getTemplates: function () { return TEMPLATES.map(function (t) { return { id: t.id, name: t.name, description: t.description }; }); },
    renderCanvas: renderCanvas,
    mountEditor: mountEditor,
    sampleRow: sampleRow
  };
})(window);
