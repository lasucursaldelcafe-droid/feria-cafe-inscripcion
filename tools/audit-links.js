const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
const internal = /^(index|el-evento|actividades|patrocinadores|inscripcion|competencia|privacidad|como-funciona-evento|reglas-switch-championship|qr-inscripcion|festival)\.html/;
const issues = [];

for (const file of files) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const re = /<a\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const hrefM = attrs.match(/href\s*=\s*["']([^"'#]+)/i);
    if (!hrefM) continue;
    const href = hrefM[1];
    if (/^(https?:|mailto:|tel:|assets\/)/i.test(href)) continue;
    if (href.startsWith('#')) continue;
    const base = href.split('?')[0].split('#')[0];
    if (!internal.test(base) && !base.startsWith('/')) continue;
    if (!/data-link\s*=/.test(attrs)) issues.push(`${file}: ${href}`);
  }
}

console.log(issues.length ? issues.join('\n') : 'OK: no missing data-link');
