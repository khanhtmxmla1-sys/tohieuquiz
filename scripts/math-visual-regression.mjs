import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const update = process.argv.includes('--update');
const caseNames = ['mcq', 'matching', 'drag-drop', 'fill-blank', 'short-answer', 'explanation'];
const names = caseNames.flatMap((name) => [
  `math-${name}-desktop.png`,
  `math-${name}-mobile.png`,
]);
const screenshotRoot = path.join(root, 'artifacts', 'math-screenshots');
const baselineRoot = path.join(root, 'cypress', 'visual-baselines', 'math');
const cypressCli = path.join(root, 'node_modules', 'cypress', 'bin', 'cypress');

fs.rmSync(screenshotRoot, { recursive: true, force: true });
const result = spawnSync(
  process.execPath,
  [
    cypressCli,
    'run',
    '--component',
    '--browser',
    'electron',
    '--spec',
    'cypress/component/math-rendering.cy.tsx',
  ],
  { cwd: root, encoding: 'utf8', stdio: 'inherit' },
);
if (result.error) {
  console.error(`Could not start Cypress: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status || 1);

const walk = (dir) => fs.existsSync(dir)
  ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const target = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(target) : [target];
    })
  : [];
const actualFiles = walk(screenshotRoot).filter((file) => file.endsWith('.png'));
const actualByName = new Map(actualFiles.map((file) => [path.basename(file), file]));
const missing = names.filter((name) => !actualByName.has(name));
if (missing.length > 0) {
  console.error(`Missing screenshots: ${missing.join(', ')}`);
  process.exit(1);
}

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.mkdirSync(baselineRoot, { recursive: true });

if (update) {
  for (const name of names) {
    fs.copyFileSync(actualByName.get(name), path.join(baselineRoot, name));
  }
  process.stdout.write(`Updated ${names.length} math screenshot baselines.\n`);
  process.exit(0);
}

const failures = [];
for (const name of names) {
  const baseline = path.join(baselineRoot, name);
  if (!fs.existsSync(baseline)) {
    failures.push(`${name}: baseline missing`);
    continue;
  }
  const actualHash = sha256(actualByName.get(name));
  const baselineHash = sha256(baseline);
  if (actualHash !== baselineHash) {
    failures.push(`${name}: ${baselineHash.slice(0, 12)} != ${actualHash.slice(0, 12)}`);
  }
}

if (failures.length > 0) {
  console.error('Math screenshot regression failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
process.stdout.write(`Math screenshot regression passed: ${names.length}/${names.length} baselines match.\n`);
