import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'assets', 'certificate-backgrounds', 'tohieuquiz-2026');
const templates = [
  'classic-red-navy',
  'modern-color',
  'formal-blue',
  'kids-learning',
  'geometric-navy-orange',
];

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1270, height: 698, deviceScaleFactor: 1 });

  for (const template of templates) {
    const svgPath = path.join(sourceDir, `${template}.svg`);
    const pngOutputPath = path.join(sourceDir, `${template}.png`);
    const webpOutputPath = path.join(sourceDir, `${template}.webp`);
    const svg = await fs.readFile(svgPath, 'utf8');
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:1270px;height:698px;overflow:hidden;background:#fff}svg{display:block;width:1270px;height:698px}</style></head><body>${svg}</body></html>`,
      { waitUntil: 'load' },
    );
    await page.screenshot({
      path: pngOutputPath,
      type: 'png',
      clip: { x: 0, y: 0, width: 1270, height: 698 },
      captureBeyondViewport: false,
    });
    await page.screenshot({
      path: webpOutputPath,
      type: 'webp',
      quality: 92,
      clip: { x: 0, y: 0, width: 1270, height: 698 },
      captureBeyondViewport: false,
    });
    process.stdout.write(
      `Rendered ${path.relative(projectRoot, pngOutputPath)} and ${path.relative(projectRoot, webpOutputPath)}\n`,
    );
  }
} finally {
  await browser.close();
}
