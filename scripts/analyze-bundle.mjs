import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const listFiles = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const fullPath = join(directory, entry.name);
  return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
});

const normalizeAssetPath = value => value.replace(/^\//, '').split(/[?#]/, 1)[0];

export function readInitialAssets(indexHtml) {
  return new Set([...indexHtml.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map(match => normalizeAssetPath(match[1]))
    .filter(asset => asset.endsWith('.js') || asset.endsWith('.css')));
}

export function resolveBundleOwner(name) {
  if (/docx|spreadsheet|FileSaver/i.test(name)) return 'Document import';
  if (/Worksheet|jspdf|html2canvas|purify|pdf/i.test(name)) return 'Worksheet export';
  if (/Tooltip|chart|Results|analytics/i.test(name)) return 'Analytics and results';
  if (/vendor-|assets\/(?:index|app)(?:[.-])/i.test(name)) return 'Application shell';
  return 'Route feature';
}

export function measureBundle(distDir) {
  const indexPath = resolve(distDir, 'index.html');
  if (!existsSync(indexPath)) throw new Error(`Missing build artifact: ${indexPath}`);
  const initialAssets = readInitialAssets(readFileSync(indexPath, 'utf8'));
  const files = listFiles(distDir)
    .filter(file => /\.(js|css)$/.test(file))
    .map(file => {
      const content = readFileSync(file);
      const name = relative(distDir, file).replaceAll('\\', '/');
      return {
        name,
        type: name.endsWith('.css') ? 'css' : 'js',
        bytes: content.byteLength,
        gzipBytes: gzipSync(content).byteLength,
        initial: initialAssets.has(name),
      };
    });
  const topContributors = [...files]
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, 10)
    .map(file => ({ ...file, owner: resolveBundleOwner(file.name) }));
  return {
    generatedAt: new Date().toISOString(),
    files,
    topContributors,
    metrics: {
      initialJsGzipBytes: files.filter(file => file.type === 'js' && file.initial).reduce((sum, file) => sum + file.gzipBytes, 0),
      cssGzipBytes: files.filter(file => file.type === 'css').reduce((sum, file) => sum + file.gzipBytes, 0),
      lazyChunkGzipBytes: Math.max(0, ...files.filter(file => file.type === 'js' && !file.initial).map(file => file.gzipBytes)),
      singleChunkMinifiedBytes: Math.max(0, ...files.filter(file => file.type === 'js').map(file => file.bytes)),
    },
  };
}

const isActiveAllowlistEntry = (entry, metric, now = new Date()) => {
  if (entry.metric !== metric || !entry.reason || !entry.expires) return false;
  return new Date(entry.expires) > now;
};

const isAllowedOversizedChunk = (file, entries, metric, sizeKey, now) => entries.some(entry => {
  if (!isActiveAllowlistEntry(entry, metric, now)) return false;
  if (!entry.assetPattern || !Number.isFinite(Number(entry.maxBytes))) return false;
  try {
    return new RegExp(entry.assetPattern).test(file.name) && Number(file[sizeKey] || 0) <= Number(entry.maxBytes);
  } catch {
    return false;
  }
});

export function evaluateBudget(report, budget, now = new Date()) {
  const errors = [];
  for (const metric of ['initialJsGzipBytes', 'cssGzipBytes', 'lazyChunkGzipBytes', 'singleChunkMinifiedBytes']) {
    const actual = Number(report.metrics[metric] || 0);
    const limit = Number(budget[metric]);
    if (!Number.isFinite(limit)) {
      errors.push(`${metric}: missing numeric budget`);
      continue;
    }
    if (actual > limit) {
      if (metric === 'singleChunkMinifiedBytes' || metric === 'lazyChunkGzipBytes') {
        const sizeKey = metric === 'singleChunkMinifiedBytes' ? 'bytes' : 'gzipBytes';
        const oversized = (report.files || []).filter(file => (
          file.type === 'js'
          && (metric !== 'lazyChunkGzipBytes' || !file.initial)
          && Number(file[sizeKey] || 0) > limit
        ));
        const blocked = oversized.length === 0
          || oversized.some(file => !isAllowedOversizedChunk(file, budget.allowlist || [], metric, sizeKey, now));
        if (blocked) errors.push(`${metric}: ${actual} bytes exceeds ${limit}`);
      } else if (!(budget.allowlist || []).some(entry => isActiveAllowlistEntry(entry, metric, now))) {
        errors.push(`${metric}: ${actual} bytes exceeds ${limit}`);
      }
    }
  }
  for (const entry of budget.allowlist || []) {
    if (!entry.reason || !entry.expires || !entry.metric) {
      errors.push('Invalid performance allowlist entry: reason, expires and metric are required');
    } else if (new Date(entry.expires) <= now) {
      errors.push(`Expired performance allowlist entry for ${entry.metric}`);
    } else if (
      (entry.metric === 'singleChunkMinifiedBytes' || entry.metric === 'lazyChunkGzipBytes')
      && (!entry.assetPattern || !Number.isFinite(Number(entry.maxBytes)))
    ) {
      errors.push('Invalid chunk allowlist entry: assetPattern and maxBytes are required');
    }
  }
  return errors;
}

export function runBundleAnalysis(args = process.argv.slice(2)) {
  const distArg = args.find(arg => arg.startsWith('--dist='))?.slice('--dist='.length) || 'dist';
  const configArg = args.find(arg => arg.startsWith('--config='))?.slice('--config='.length) || 'config/performance-budget.json';
  const reportArg = args.find(arg => arg.startsWith('--report='))?.slice('--report='.length) || 'reports/bundle-report.json';
  const report = measureBundle(resolve(distArg));
  const budget = JSON.parse(readFileSync(resolve(configArg), 'utf8'));
  const errors = evaluateBudget(report, budget);
  const output = { status: errors.length ? 'blocked' : 'ready', budget, ...report, errors };
  mkdirSync(resolve(reportArg, '..'), { recursive: true });
  writeFileSync(resolve(reportArg), `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(output, null, 2));
  if (args.includes('--check') && errors.length) return 1;
  return 0;
}

const isEntryPoint = process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase();
if (isEntryPoint) process.exitCode = runBundleAnalysis();
