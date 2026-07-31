import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const names = ['question-bank','students','achievements','analytics-report','learning-resources','store','competition','tasks','system-settings'];
const sourceDir = path.resolve('assets/module-icons/source');
const outputDir = path.resolve('public/assets/module-icons');
const maxBytes = 200 * 1024;
await mkdir(outputDir, { recursive: true });

for (const name of names) {
  const sourcePath = path.join(sourceDir, `${name}.png`);
  const outputPath = path.join(outputDir, `${name}.webp`);
  try { await stat(sourcePath); } catch { throw new Error(`Missing module icon source: ${sourcePath}`); }
  const sourceMetadata = await sharp(sourcePath).metadata();
  if (!sourceMetadata.hasAlpha) throw new Error(`${name}: source image must include an alpha channel`);
  const foreground = await sharp(sourcePath)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(420, 420, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: foreground, gravity: 'centre' }])
    .webp({ quality: 88, alphaQuality: 100, effort: 6 })
    .toFile(outputPath);
  const metadata = await sharp(outputPath).metadata();
  const file = await stat(outputPath);
  if (metadata.width !== 512 || metadata.height !== 512) throw new Error(`${name}: invalid dimensions`);
  if (!metadata.hasAlpha) throw new Error(`${name}: generated WebP must retain alpha`);
  if (file.size > maxBytes) throw new Error(`${name}: ${file.size} bytes exceeds ${maxBytes}`);
  console.log(`OK ${name}.webp ${file.size} bytes`);
}
