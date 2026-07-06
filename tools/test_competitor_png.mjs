#!/usr/bin/env node
/**
 * Prueba E2E: carga de foto competidor para PNG (sin admin login).
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const SHEETS_URL =
  'https://script.google.com/macros/s/AKfycbyiLN6ms5dSbm6f1ZmZsR7ktqWLFGxGJd5zAnhZlmX3d0lpKFx1AhLXMXWfnF8txsp0/exec';
const FILE_ID = '1jET4LD5HZ92cjFeemK4PQyKv6ltLc6Ht';

async function fetchFotoData() {
  const url = `${SHEETS_URL}?action=competidor_foto_data&id=${FILE_ID}`;
  const res = await fetch(url);
  const data = await res.json();
  return data;
}

async function main() {
  const foto = await fetchFotoData();
  console.log('API ok:', foto.ok, 'dataUrl len:', foto.dataUrl?.length || 0);
  if (!foto.ok || !foto.dataUrl) {
    console.error('API falló:', foto.error);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));

  const result = await page.evaluate(async (dataUrl) => {
    function dataUrlToObjectUrl(dataUrl) {
      const parts = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
      if (!parts) throw new Error('dataUrl inválido');
      const contentType = parts[1] || 'image/jpeg';
      const binary = atob(parts[2]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: contentType }));
    }

    function loadImageDirect(src) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ ok: true, w: img.width, h: img.height, method: 'direct' });
        img.onerror = (e) => resolve({ ok: false, method: 'direct', error: String(e) });
        img.src = src;
      });
    }

    function loadImageBlob(src) {
      return new Promise((resolve) => {
        let objectUrl = '';
        const img = new Image();
        img.onload = () => {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          resolve({ ok: true, w: img.width, h: img.height, method: 'blob' });
        };
        img.onerror = () => {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          resolve({ ok: false, method: 'blob' });
        };
        try {
          objectUrl = dataUrlToObjectUrl(src);
          img.src = objectUrl;
        } catch (err) {
          resolve({ ok: false, method: 'blob', error: err.message });
        }
      });
    }

    function drawToCanvas(img) {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 400, 400);
      try {
        const data = canvas.toDataURL('image/png');
        return { ok: true, pngLen: data.length };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }

    const direct = await loadImageDirect(dataUrl);
    const blob = await loadImageBlob(dataUrl);

    let canvasTest = { ok: false };
    if (blob.ok) {
      const img = new Image();
      await new Promise((r) => {
        const ou = dataUrlToObjectUrl(dataUrl);
        img.onload = r;
        img.onerror = r;
        img.src = ou;
      });
      if (img.width) canvasTest = drawToCanvas(img);
    }

    return { direct, blob, canvasTest };
  }, foto.dataUrl);

  console.log('Direct load:', JSON.stringify(result.direct));
  console.log('Blob load:', JSON.stringify(result.blob));
  console.log('Canvas export:', JSON.stringify(result.canvasTest));
  if (logs.length) console.log('Console:', logs.join('\n'));

  await browser.close();
  const passed = result.blob.ok && result.canvasTest.ok;
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
