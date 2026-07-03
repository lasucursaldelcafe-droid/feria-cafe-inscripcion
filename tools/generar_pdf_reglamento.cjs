/**
 * Genera assets/reglas-v60-championship.pdf desde el HTML del reglamento.
 * Uso: npx -y puppeteer@23 node tools/generar_pdf_reglamento.cjs
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'reglas-v60-championship.html');
const pdfPath = path.join(root, 'assets', 'reglas-v60-championship.pdf');

(async function () {
  if (!fs.existsSync(htmlPath)) {
    console.error('No se encontró reglas-v60-championship.html');
    process.exit(1);
  }
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' }
  });
  await browser.close();
  console.log('PDF generado:', pdfPath);
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
