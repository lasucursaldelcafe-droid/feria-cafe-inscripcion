#!/usr/bin/env node
/**
 * Incrusta SVG locales en informe-plataforma-jurado-v60.html (img → inline).
 * Uso: node tools/inline_informe_svg.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'docs', 'informe-plataforma-jurado-v60.html');

let html = fs.readFileSync(htmlPath, 'utf8');

const imgRe = /<img\s+src="([^"]+\.svg)"\s+alt="([^"]*)"\s*>/g;

html = html.replace(imgRe, (match, src, alt) => {
  const rel = src.replace(/^\//, '').replace(/^docs\//, '');
  const svgPath = path.join(root, 'docs', rel.startsWith('imagenes/') ? rel : path.join('imagenes', path.basename(src)));
  const candidates = [
    path.join(root, 'docs', src),
    path.join(root, 'docs', rel),
    path.join(path.dirname(htmlPath), src),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    console.warn('SVG no encontrado:', src);
    return match;
  }
  let svg = fs.readFileSync(found, 'utf8').trim();
  svg = svg.replace(/<\?xml[^?]*\?>\s*/i, '');
  if (!svg.includes('role=')) {
    svg = svg.replace('<svg ', `<svg role="img" aria-label="${alt.replace(/"/g, '&quot;')}" `);
  }
  return `<div class="svg-inline" role="img" aria-label="${alt}">${svg}</div>`;
});

if (!html.includes('.svg-inline svg')) {
  html = html.replace(
    '.figure img, .figure object {',
    '.figure img, .figure object, .figure .svg-inline svg {'
  );
  html = html.replace(
    'border-radius: 0.5rem;\n    }',
    'border-radius: 0.5rem;\n    }\n    .figure .svg-inline {\n      display: block;\n      width: 100%;\n      overflow: hidden;\n      border-radius: 0.5rem;\n    }\n    .figure .svg-inline svg {\n      display: block;\n      width: 100%;\n      height: auto;\n    }'
  );
}

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('SVG incrustados en', htmlPath);
