import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEXT_EXTENSIONS = new Set([
  '.css', '.html', '.js', '.json', '.map', '.mjs', '.svg', '.txt', '.webmanifest', '.xml',
]);

const PLACEHOLDER_HOST_PATTERN = /(?:https?:\/\/|\/\/|["'`]|\s|^)((?:[a-z0-9-]+\.)+invalid)(?=[:/?#"'`]|\s|$)/gim;
const ZOD_INTERNAL_COMPILE_INVALID_PATTERN = /(?<![\w$.])Symbol\.for\(\s*(['"])zod\.compile\.invalid\1\s*\)/g;

const isInsideQuotedLiteral = (source, position) => {
  let quote = null;
  let escaped = false;

  for (let index = 0; index < position; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
    } else if (character === '\\' && quote) {
      escaped = true;
    } else if (quote) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'" || character === '`') {
      quote = character;
    }
  }

  return quote !== null;
};

const hasMemberAccessPrefix = (source, position) => source.slice(0, position).trimEnd().endsWith('.');

export const findPlaceholderHosts = (text) => {
  const hosts = [];
  const source = String(text || '');
  const ignoredHostPositions = new Set();

  for (const marker of source.matchAll(ZOD_INTERNAL_COMPILE_INVALID_PATTERN)) {
    if (isInsideQuotedLiteral(source, marker.index) || hasMemberAccessPrefix(source, marker.index)) continue;
    ignoredHostPositions.add(marker.index + marker[0].indexOf('zod.compile.invalid'));
  }

  for (const match of source.matchAll(PLACEHOLDER_HOST_PATTERN)) {
    const hostPosition = match.index + match[0].indexOf(match[1]);
    if (ignoredHostPositions.has(hostPosition)) continue;
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
