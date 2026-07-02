#!/usr/bin/env node
/**
 * Prueba E2E: carga de foto competidor para PNG (flujo admin-dashboard.js).
 */
import { chromium } from 'playwright';

const SHEETS_URL =
  'https://script.google.com/macros/s/AKfycbxDZ-gXRSVpgVaMewOclstexVemlWk-tYUOqWTd57cK7a3D4tjT4DMErbYxcg67YTZN/exec';
const FILE_ID = '1jET4LD5HZ92cjFeemK4PQyKv6ltLc6Ht';
const ADMIN_ORIGIN = 'https://la-sucursal-del-cafe.web.app';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(ADMIN_ORIGIN + '/admin', { waitUntil: 'domcontentloaded', timeout: 30000 });

  const result = await page.evaluate(async ({ sheetsUrl, fileId }) => {
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

    async function fetchCompetitorPhotoBlob(fileId) {
      const photoUrl = sheetsUrl + '?action=competidor_foto&id=' + encodeURIComponent(fileId);
      try {
        const res = await fetch(photoUrl, { method: 'GET', mode: 'cors', cache: 'no-store' });
        if (!res.ok) return { blob: null, status: res.status, type: res.headers.get('content-type') };
        const type = (res.headers.get('content-type') || '').toLowerCase();
        if (type.indexOf('image/') !== 0) return { blob: null, status: res.status, type };
        const blob = await res.blob();
        return { blob, status: res.status, type, size: blob.size };
      } catch (e) {
        return { blob: null, error: e.message };
      }
    }

    async function loadFromDataUrl(fileId) {
      const url = sheetsUrl + '?action=competidor_foto_data&id=' + encodeURIComponent(fileId);
      const res = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-store' });
      const json = await res.json();
      if (!json.ok || !json.dataUrl) return { ok: false, error: json.error || 'sin dataUrl' };
      const img = await loadCanvasImage(json.dataUrl);
      return { ok: !!img, w: img ? img.width : 0, h: img ? img.height : 0, dataUrlLen: json.dataUrl.length };
    }

    const binary = await fetchCompetitorPhotoBlob(fileId);
    let binaryLoad = { ok: false };
    if (binary.blob && binary.size > 0) {
      const ou = URL.createObjectURL(binary.blob);
      const img = await loadCanvasImage(ou, { revokeObjectUrl: ou });
      binaryLoad = { ok: !!img, w: img ? img.width : 0, h: img ? img.height : 0, blobSize: binary.size };
    }

    const dataUrlLoad = await loadFromDataUrl(fileId);
    const passed = binaryLoad.ok || dataUrlLoad.ok;
    return { binary, binaryLoad, dataUrlLoad, passed };
  }, { sheetsUrl: SHEETS_URL, fileId: FILE_ID });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  process.exit(result.passed ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
