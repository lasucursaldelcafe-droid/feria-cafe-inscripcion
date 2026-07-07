/**
 * Genera PDFs de informes en docs/ desde HTML local (SVG incrustados).
 * Uso: npx -y puppeteer@23 node tools/generar_pdf_informes.cjs
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const informes = [
  {
    html: path.join(root, 'docs', 'informe-plataforma-jurado-v60.html'),
    pdf: path.join(root, 'docs', 'informe-plataforma-jurado-v60.pdf'),
    title: 'Informe jurado V60',
  },
  {
    html: path.join(root, 'docs', 'informe-conectividad-100.html'),
    pdf: path.join(root, 'docs', 'informe-conectividad-100.pdf'),
    title: 'Informe conectividad 100%',
  },
];

(async function () {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const item of informes) {
    if (!fs.existsSync(item.html)) {
      console.warn('Omitido (sin HTML):', item.title);
      continue;
    }
    const page = await browser.newPage();
    const fileUrl = 'file:///' + item.html.replace(/\\/g, '/');
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.pdf({
      path: item.pdf,
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
    });
    await page.close();
    const stat = fs.statSync(item.pdf);
    console.log('PDF generado:', item.pdf, '(' + Math.round(stat.size / 1024) + ' KB)');
  }

  await browser.close();
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
