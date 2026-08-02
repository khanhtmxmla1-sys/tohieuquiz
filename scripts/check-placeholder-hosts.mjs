import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEXT_EXTENSIONS = new Set([
  '.css', '.html', '.js', '.json', '.map', '.mjs', '.svg', '.txt', '.webmanifest', '.xml',
]);

const PLACEHOLDER_HOST_PATTERN = /(?:https?:\/\/|\/\/|["'`]|\s|^)((?:[a-z0-9-]+\.)+invalid)(?=[:/?#"'`]|\s|$)/gim;

export const findPlaceholderHosts = (text) => {
  const hosts = [];
  const source = String(text || '');
  for (const match of source.matchAll(PLACEHOLDER_HOST_PATTERN)) {
    hosts.push(match[1].toLowerCase());
  }
  return [...new Set(hosts)];
};

const listTextFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolutePath = path.join(directory, entry.name);
  if (entry.isDirectory()) return listTextFiles(absolutePath);
  return TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) ? [absolutePath] : [];
});

export const scanPlaceholderHosts = (directory) => {
  const root = path.resolve(directory);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Bundle directory does not exist: ${root}`);
  }

  const findings = [];
  for (const file of listTextFiles(root)) {
    const hosts = findPlaceholderHosts(fs.readFileSync(file, 'utf8'));
    if (hosts.length > 0) findings.push({ file: path.relative(root, file), hosts });
  }
  return findings;
};

const isEntryPoint = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  const directory = process.argv[2] || 'dist';
  const findings = scanPlaceholderHosts(directory);
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(`${finding.file}: ${finding.hosts.join(', ')}`);
    }
    console.error("Placeholder '.invalid' host found in the production bundle.");
    process.exitCode = 1;
  } else {
    console.log('No placeholder hosts in the bundle.');
  }
}
