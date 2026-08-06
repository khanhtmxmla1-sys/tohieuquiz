import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const sourceDirectory = path.resolve(root, 'artifacts/teacher-dashboard-source');
const illustrationDirectory = path.resolve(root, 'public/illustrations/tohieuquiz/teacher-dashboard-v2');
const iconDirectory = path.resolve(root, 'public/icons/tohieuquiz/dashboard-v2');

const assets = [
  {
    name: 'teacher-welcome',
    sourceFilename: 'teacher-welcome.webp',
    category: 'illustration',
    width: 960,
    height: 540,
    maxBytes: 160000,
  },
  { name: 'ai-quiz-robot', category: 'illustration', width: 480, height: 360, maxBytes: 90000 },
  { name: 'manual-quiz', category: 'illustration', width: 480, height: 360, maxBytes: 90000 },
  { name: 'assignment', category: 'icon', width: 160, height: 160, maxBytes: 32000 },
  { name: 'live-exam', category: 'icon', width: 160, height: 160, maxBytes: 32000 },
  { name: 'results', category: 'icon', width: 160, height: 160, maxBytes: 32000 },
  { name: 'students', category: 'icon', width: 160, height: 160, maxBytes: 32000 },
  { name: 'classroom', category: 'icon', width: 160, height: 160, maxBytes: 32000 },
  { name: 'certificate', category: 'icon', width: 160, height: 160, maxBytes: 32000 },
  { name: 'quiz-management', category: 'icon', width: 160, height: 160, maxBytes: 32000 },
  { name: 'quiz-create', category: 'icon', width: 160, height: 160, maxBytes: 32000 },
];

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

const checkTransparentCorners = async (buffer, asset) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const corners = [
    3,
    (info.width - 1) * info.channels + 3,
    ((info.height - 1) * info.width) * info.channels + 3,
    ((info.height * info.width) - 1) * info.channels + 3,
  ];
  if (corners.some((index) => data[index] > 18)) {
    throw new Error(`${asset.name}: artwork must keep transparent outer corners`);
  }
};

await mkdir(illustrationDirectory, { recursive: true });
await mkdir(iconDirectory, { recursive: true });

const manifestAssets = [];
for (const asset of assets) {
  const sourceFilename = asset.sourceFilename ?? `${asset.name}.svg`;
  const sourcePath = path.join(sourceDirectory, sourceFilename);
  const source = await readFile(sourcePath);
  const sourceMetadata = await sharp(source).metadata();
  if (!sourceMetadata.hasAlpha) {
    throw new Error(`${asset.name}: source artwork must contain an alpha channel`);
  }

  const outputDirectory = asset.category === 'illustration' ? illustrationDirectory : iconDirectory;
  const outputPath = path.join(outputDirectory, `${asset.name}.webp`);
  const output = await sharp(source, { density: 180 })
    .resize(asset.width, asset.height, {
      fit: 'contain',
      position: 'center',
      background: transparent,
      withoutEnlargement: false,
    })
    .webp({ quality: asset.category === 'illustration' ? 84 : 86, alphaQuality: 100, smartSubsample: true })
    .toBuffer();

  if (output.byteLength > asset.maxBytes) {
    throw new Error(`${asset.name}: ${output.byteLength} bytes exceeds ${asset.maxBytes}`);
  }
  await checkTransparentCorners(output, asset);
  await writeFile(outputPath, output);

  const publicPath = asset.category === 'illustration'
    ? `/illustrations/tohieuquiz/teacher-dashboard-v2/${asset.name}.webp`
    : `/icons/tohieuquiz/dashboard-v2/${asset.name}.webp`;
  manifestAssets.push({
    name: asset.name,
    category: asset.category,
    source: `artifacts/teacher-dashboard-source/${sourceFilename}`,
    src: publicPath,
    width: asset.width,
    height: asset.height,
    bytes: output.byteLength,
    maxBytes: asset.maxBytes,
    sha256: createHash('sha256').update(output).digest('hex'),
  });
}

const manifest = {
  generatedAt: new Date().toISOString(),
  generator: 'scripts/build-teacher-dashboard-assets.mjs',
  assets: manifestAssets,
};
await writeFile(
  path.join(iconDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log(`Generated ${manifestAssets.length} teacher dashboard assets.`);
for (const asset of manifestAssets) {
  console.log(`${asset.name}: ${asset.width}x${asset.height}, ${asset.bytes} bytes`);
}
