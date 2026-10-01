import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..');
const SOURCE = 'public/assets/branding/school-logo-source-v2.png';

export const BRAND_ASSET_SPECS = [
  { relativePath: 'public/assets/branding/school-logo-v2.webp', width: 512, height: 512, format: 'webp', alpha: true },
  { relativePath: 'public/assets/branding/school-logo-512.png', width: 512, height: 512, format: 'png', alpha: true },
  { relativePath: 'public/assets/branding/favicon-32.png', width: 32, height: 32, format: 'png', alpha: true },
  { relativePath: 'public/assets/branding/favicon-48.png', width: 48, height: 48, format: 'png', alpha: true },
  { relativePath: 'public/assets/branding/apple-touch-icon.png', width: 180, height: 180, format: 'png', alpha: true },
  { relativePath: 'public/assets/branding/pwa-icon-192.png', width: 192, height: 192, format: 'png', alpha: true },
  { relativePath: 'public/assets/branding/pwa-icon-512.png', width: 512, height: 512, format: 'png', alpha: true },
  { relativePath: 'public/assets/branding/pwa-maskable-512.png', width: 512, height: 512, format: 'png', alpha: false },
  { relativePath: 'public/assets/branding/tohieuquiz-social-card-v2.png', width: 1200, height: 630, format: 'png', alpha: false },
];

const output = (root, relativePath) => path.join(root, relativePath);
const resizeSeal = (source, size) => sharp(source)
  .resize(size, size, { fit: 'contain', kernel: sharp.kernel.lanczos3 })
  .ensureAlpha();

const socialBackground = Buffer.from(`
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#FFFDF7"/>
  <path d="M1090 0H1200V630H930C1080 470 1130 205 1090 0Z" fill="#0A3FAE"/>
  <rect x="535" y="387" width="520" height="6" rx="3" fill="#E9B31A"/>
  <text x="535" y="278" font-family="Arial, sans-serif" font-size="72" font-weight="800" fill="#0C3284">TôHiệuQuiz</text>
  <text x="535" y="347" font-family="Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="2" fill="#31548F">TRƯỜNG TIỂU HỌC TÔ HIỆU</text>
</svg>`);

export async function writeBrandAssets(projectRoot = DEFAULT_ROOT) {
  const source = output(projectRoot, SOURCE);
  const sourceMetadata = await sharp(source).metadata();
  if (sourceMetadata.width !== 1290 || sourceMetadata.height !== 1290 || !sourceMetadata.hasAlpha) {
    throw new Error('Official source logo must be a 1290x1290 PNG with alpha.');
  }

  await fs.mkdir(output(projectRoot, 'public/assets/branding'), { recursive: true });
  await resizeSeal(source, 512).webp({ lossless: true }).toFile(output(projectRoot, BRAND_ASSET_SPECS[0].relativePath));
  await resizeSeal(source, 512).png({ compressionLevel: 9 }).toFile(output(projectRoot, BRAND_ASSET_SPECS[1].relativePath));
  await resizeSeal(source, 32).png({ compressionLevel: 9 }).toFile(output(projectRoot, BRAND_ASSET_SPECS[2].relativePath));
  await resizeSeal(source, 48).png({ compressionLevel: 9 }).toFile(output(projectRoot, BRAND_ASSET_SPECS[3].relativePath));
  await resizeSeal(source, 180).png({ compressionLevel: 9 }).toFile(output(projectRoot, BRAND_ASSET_SPECS[4].relativePath));
  await resizeSeal(source, 192).png({ compressionLevel: 9 }).toFile(output(projectRoot, BRAND_ASSET_SPECS[5].relativePath));
  await resizeSeal(source, 512).png({ compressionLevel: 9 }).toFile(output(projectRoot, BRAND_ASSET_SPECS[6].relativePath));

  const maskableSeal = await resizeSeal(source, 400).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 3, background: '#FFFDF7' } })
    .composite([{ input: maskableSeal, left: 56, top: 56 }])
    .flatten({ background: '#FFFDF7' })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(output(projectRoot, BRAND_ASSET_SPECS[7].relativePath));

  const socialSeal = await resizeSeal(source, 430).png().toBuffer();
  await sharp(socialBackground)
    .composite([{ input: socialSeal, left: 55, top: 100 }])
    .flatten({ background: '#FFFDF7' })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(output(projectRoot, BRAND_ASSET_SPECS[8].relativePath));
}

export async function inspectBrandAssets(projectRoot = DEFAULT_ROOT) {
  const errors = [];
  for (const spec of BRAND_ASSET_SPECS) {
    try {
      const metadata = await sharp(output(projectRoot, spec.relativePath)).metadata();
      if (metadata.width !== spec.width || metadata.height !== spec.height) errors.push(`${spec.relativePath}: dimensions`);
      if (metadata.format !== spec.format) errors.push(`${spec.relativePath}: format`);
      if (Boolean(metadata.hasAlpha) !== spec.alpha) errors.push(`${spec.relativePath}: alpha`);
    } catch {
      errors.push(`${spec.relativePath}: missing`);
    }
  }
  return errors;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  if (process.argv.includes('--write')) await writeBrandAssets();
  const errors = await inspectBrandAssets();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  }
}
