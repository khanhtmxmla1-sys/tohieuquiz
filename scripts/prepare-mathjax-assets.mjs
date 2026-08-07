import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const mathJaxPackageRoot = path.join(projectRoot, 'node_modules', 'mathjax-full');
const sourceRoot = path.join(mathJaxPackageRoot, 'es5');
const targetRoot = path.join(projectRoot, 'public', 'vendor', 'mathjax', 'es5');

const assets = [
  'tex-mml-chtml.js',
  path.join('input', 'tex', 'extensions', 'noerrors.js'),
];

for (const relativePath of assets) {
  const source = path.join(sourceRoot, relativePath);
  const target = path.join(targetRoot, relativePath);

  if (!existsSync(source)) {
    throw new Error(`Missing MathJax runtime asset: ${source}`);
  }

  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(source, target);
}

const licenseSource = path.join(mathJaxPackageRoot, 'LICENSE');
if (existsSync(licenseSource)) {
  const licenseTarget = path.join(projectRoot, 'public', 'vendor', 'mathjax', 'LICENSE');
  mkdirSync(path.dirname(licenseTarget), { recursive: true });
  copyFileSync(licenseSource, licenseTarget);
}

process.stdout.write('Prepared self-hosted MathJax 3.2.2 assets.\n');
