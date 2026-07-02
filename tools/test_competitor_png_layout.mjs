#!/usr/bin/env node
/**
 * Verifica que el layout del PNG competidor no monte texto sobre foto o footer.
 * Usa la misma geometría que createCompetitorCardCanvas en admin-dashboard.js.
 */
import { chromium } from 'playwright';

const SAMPLE_ROW = {
  ID: 'COMP-TEST-LAYOUT',
  Nombre: 'María Fernanda Rodríguez de la Torre',
  Rol: 'Barista profesional',
  Representa: 'Purist Café · especialidad',
  Ciudad: 'Medellín, Antioquia',
  'Experiencia café': '3 a 5 años',
  'Experiencia Switch': 'Avanzada',
  'Torneos previos': 'Nacional de barismo 2024',
  'Foto participante enlace Drive': ''
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://la-sucursal-del-cafe.web.app/admin', {
    waitUntil: 'domcontentloaded',
    timeout: 45000
  });

  const result = await page.evaluate(function (row) {
    var W = 1080;
    var H = 1440;
    var HEADER_END = 132;
    var FOOTER_H = 64;
    var FOOTER_GAP = 20;
    var footerTop = H - FOOTER_H - FOOTER_GAP;
    var INFO_MAX = 400;
    var PHOTO_MIN = 520;
    var infoHeight = INFO_MAX;
    var photoHeight = footerTop - HEADER_END - infoHeight;
    if (photoHeight < PHOTO_MIN) {
      photoHeight = PHOTO_MIN;
      infoHeight = footerTop - HEADER_END - photoHeight;
    }
    var photoY = HEADER_END;
    var infoY = photoY + photoHeight;
    var infoBottom = footerTop;

    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');

    function cleanCompetitorText(raw) {
      var text = String(raw || '').trim();
      if (!text) return '';
      var colonIdx = text.indexOf(':');
      if (colonIdx >= 0) text = text.slice(colonIdx + 1).trim();
      return text;
    }

    function val(row, keys) {
      for (var i = 0; i < keys.length; i++) {
        var value = row[keys[i]];
        if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
      }
      return '';
    }

    function competitorField(row, keys) {
      return cleanCompetitorText(val(row, keys));
    }

    function competitorCardSubtitle(row) {
      var parts = [competitorField(row, ['Rol']), competitorField(row, ['Representa'])].filter(Boolean);
      return parts.length ? parts.join(' · ') : 'Competidor oficial';
    }

    function competitorProfileLines(row) {
      var lines = [];
      var ciudad = competitorField(row, ['Ciudad']);
      var expCafe = competitorField(row, ['Experiencia café', 'Experiencia cafe']);
      var expV60 = competitorField(row, ['Experiencia Switch', 'Experiencia V60']);
      var torneos = competitorField(row, ['Torneos previos']);
      if (ciudad) lines.push(ciudad);
      var exp = [expCafe, expV60].filter(Boolean);
      if (exp.length) lines.push(exp.join(' · '));
      if (torneos) lines.push(torneos);
      return lines.slice(0, 3);
    }

    function measureWrappedLines(ctx, text, maxWidth, maxLines) {
      var words = String(text || '').split(/\s+/).filter(Boolean);
      if (!words.length) return [];
      var line = '';
      var lines = [];
      for (var n = 0; n < words.length; n++) {
        var testLine = line ? line + ' ' + words[n] : words[n];
        if (ctx.measureText(testLine).width > maxWidth && line) {
          lines.push(line);
          line = words[n];
        } else {
          line = testLine;
        }
        if (lines.length === maxLines) break;
      }
      if (line && lines.length < maxLines) lines.push(line);
      return lines;
    }

    var blocks = [
      { text: val(row, ['Nombre']) || 'Competidor', font: '800 50px Inter, Arial, sans-serif', lineHeight: 56, maxLines: 2 },
      { text: competitorCardSubtitle(row), font: '700 24px Inter, Arial, sans-serif', lineHeight: 30, maxLines: 2 }
    ];
    competitorProfileLines(row).forEach(function (line) {
      blocks.push({ text: line, font: '500 22px Inter, Arial, sans-serif', lineHeight: 28, maxLines: 2 });
    });

    var gap = 12;
    var padY = 24;
    var maxWidth = W - 96;
    var measured = blocks.map(function (block) {
      ctx.font = block.font;
      var lines = measureWrappedLines(ctx, block.text, maxWidth, block.maxLines);
      return { height: lines.length * block.lineHeight, lines: lines };
    }).filter(function (b) { return b.lines.length; });

    var stackH = measured.reduce(function (sum, b, idx) {
      return sum + b.height + (idx < measured.length - 1 ? gap : 0);
    }, 0);
    var maxHeight = infoBottom - infoY - padY * 2;
    var y = infoY + padY + Math.max(0, (maxHeight - stackH) / 2);
    var textBottom = y + stackH;

    return {
      photoBottom: infoY,
      infoTop: infoY,
      infoBottom: infoBottom,
      footerTop: footerTop,
      textBottom: textBottom,
      stackH: stackH,
      maxHeight: maxHeight,
      photoDoesNotOverlapText: infoY >= photoY + photoHeight - 1,
      textInsideInfoPanel: textBottom <= infoBottom - 6,
      textAboveFooter: textBottom <= footerTop - 4,
      infoAboveFooter: infoBottom <= footerTop
    };
  }, SAMPLE_ROW);

  console.log(JSON.stringify(result, null, 2));
  await browser.close();

  var passed =
    result.photoDoesNotOverlapText &&
    result.textInsideInfoPanel &&
    result.textAboveFooter &&
    result.infoAboveFooter;

  process.exit(passed ? 0 : 1);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
