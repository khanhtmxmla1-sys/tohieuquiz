import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { evaluateBudget, measureBundle, readInitialAssets, resolveBundleOwner } from '../scripts/analyze-bundle.mjs';

const roots: string[] = [];
afterEach(() => { roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })); });

describe('performance budget', () => {
  it('ships only scoped exceptions for the self-hosted MathJax runtime', () => {
    const budget = JSON.parse(readFileSync('config/performance-budget.json', 'utf8'));
    expect(budget.allowlist).toHaveLength(2);
    expect(budget.allowlist.map((entry: { metric: string }) => entry.metric).sort()).toEqual([
      'lazyChunkGzipBytes',
      'singleChunkMinifiedBytes',
    ]);
    expect(budget.allowlist.every((entry: { assetPattern?: string }) => (
      entry.assetPattern === '^vendor/mathjax/es5/tex-mml-chtml\\.js$'
    ))).toBe(true);
  });

  it('discovers initial scripts and styles from index.html', () => {
    expect([...readInitialAssets('<script src="/assets/app.js"></script><link href="/assets/app.css">')])
      .toEqual(['assets/app.js', 'assets/app.css']);
  });

  it('measures minified and gzip bytes for initial and lazy assets', () => {
    const root = mkdtempSync(join(tmpdir(), 'bundle-budget-'));
    roots.push(root);
    mkdirSync(join(root, 'assets'));
    writeFileSync(join(root, 'index.html'), '<script src="/assets/app.js"></script>');
    writeFileSync(join(root, 'assets/app.js'), 'console.log("initial")'.repeat(20));
    writeFileSync(join(root, 'assets/lazy.js'), 'console.log("lazy")'.repeat(10));
    const report = measureBundle(root);
    expect(report.files.find(file => file.name === 'assets/app.js')?.initial).toBe(true);
    expect(report.metrics.initialJsGzipBytes).toBeGreaterThan(0);
    expect(report.metrics.lazyChunkGzipBytes).toBeGreaterThan(0);
    expect(report.topContributors[0]).toMatchObject({ name: 'assets/app.js', owner: 'Application shell' });
  });

  it('assigns actionable owners to heavy feature chunks', () => {
    expect(resolveBundleOwner('assets/docxQuestionImporter.js')).toBe('Document import');
    expect(resolveBundleOwner('assets/WorksheetExportModal.js')).toBe('Worksheet export');
    expect(resolveBundleOwner('assets/Tooltip.js')).toBe('Analytics and results');
  });

  it('fails an injected oversized metric and rejects expired exceptions', () => {
    const report = {
      files: [],
      metrics: {
        initialJsGzipBytes: 201,
        cssGzipBytes: 1,
        lazyChunkGzipBytes: 1,
        singleChunkMinifiedBytes: 1,
      },
    };
    const budget = {
      initialJsGzipBytes: 200,
      cssGzipBytes: 2,
      lazyChunkGzipBytes: 2,
      singleChunkMinifiedBytes: 2,
      allowlist: [],
    };
    expect(evaluateBudget(report, budget)).toContain('initialJsGzipBytes: 201 bytes exceeds 200');
    const expired = {
      ...budget,
      allowlist: [{ metric: 'initialJsGzipBytes', reason: 'legacy', expires: '2020-01-01' }],
    };
    expect(evaluateBudget(report, expired)).toContain('Expired performance allowlist entry for initialJsGzipBytes');
  });

  it('does not let a scoped lazy-chunk exception hide a different oversized asset', () => {
    const report = {
      files: [
        { name: 'vendor/mathjax/es5/tex-mml-chtml.js', type: 'js', bytes: 1173007, gzipBytes: 266497, initial: false },
        { name: 'assets/unrelated-new-chunk.js', type: 'js', bytes: 300000, gzipBytes: 150000, initial: false },
      ],
      metrics: {
        initialJsGzipBytes: 1,
        cssGzipBytes: 1,
        lazyChunkGzipBytes: 266497,
        singleChunkMinifiedBytes: 1173007,
      },
    };
    const budget = {
      initialJsGzipBytes: 2,
      cssGzipBytes: 2,
      lazyChunkGzipBytes: 135000,
      singleChunkMinifiedBytes: 2000000,
      allowlist: [{
        metric: 'lazyChunkGzipBytes',
        reason: 'self-hosted math runtime',
        expires: '2099-01-01',
        assetPattern: '^vendor/mathjax/es5/tex-mml-chtml\\.js$',
        maxBytes: 300000,
      }],
    };
    expect(evaluateBudget(report, budget))
      .toContain('lazyChunkGzipBytes: 266497 bytes exceeds 135000');
  });

  it('does not let a legacy chunk exception hide a different oversized asset', () => {
    const report = {
      files: [{
        name: 'assets/unrelated-new-chunk.js',
        type: 'js',
        bytes: 900000,
        gzipBytes: 200000,
        initial: false,
      }],
      metrics: {
        initialJsGzipBytes: 1,
        cssGzipBytes: 1,
        lazyChunkGzipBytes: 1,
        singleChunkMinifiedBytes: 900000,
      },
    };
    const budget = {
      initialJsGzipBytes: 2,
      cssGzipBytes: 2,
      lazyChunkGzipBytes: 2,
      singleChunkMinifiedBytes: 500000,
      allowlist: [{
        metric: 'singleChunkMinifiedBytes',
        reason: 'legacy docx',
        expires: '2099-01-01',
        assetPattern: '^assets/docxQuestionImporter-.*\\.js$',
        maxBytes: 505000,
      }],
    };
    expect(evaluateBudget(report, budget))
      .toContain('singleChunkMinifiedBytes: 900000 bytes exceeds 500000');
  });
});
