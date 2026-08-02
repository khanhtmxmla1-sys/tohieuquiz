// @vitest-environment node
import fs from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMath5Manifest, buildMath5ReviewReport } from '../scripts/question-bank/build-math5-review-report';
import { buildImportBatches, runMath5Import } from '../scripts/question-bank/import-math5-drafts';
import { runPublishMath5Topic } from '../scripts/question-bank/publish-math5-topic';
import { loadCommittedMath5Dataset } from '../scripts/question-bank/validate-math5-dataset';

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

describe('Math 5 question-bank operational scripts', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('builds four safe import batches and never changes DRAFT status', () => {
    const items = loadCommittedMath5Dataset().items;
    const batches = buildImportBatches(items, 100);
    expect(batches.map((batch) => batch.length)).toEqual([100, 100, 100, 50]);
    expect(batches.flat()).toHaveLength(350);
    expect(batches.flat().every((item) => item.scope === 'SYSTEM' && item.status === 'DRAFT')).toBe(true);
  });

  it('keeps import dry-run offline and reports the exact batch plan', async () => {
    const fetchMock = vi.fn();
    const result = await runMath5Import({ fetchImpl: fetchMock as unknown as typeof fetch });
    expect(result).toMatchObject({
      mode: 'DRY_RUN',
      totalItems: 350,
      batches: [100, 100, 100, 50],
      summary: { received: 350, created: 0, duplicates: 0, invalid: 0 },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preflights all six topics before sending four bulk requests', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/test-bank?')) {
        return jsonResponse({ pagination: { totalItems: 0 } });
      }
      if (url.endsWith('/api/test-bank/bulk')) {
        const body = JSON.parse(String(init?.body || '{}')) as { items: unknown[] };
        expect(body.items.length).toBeLessThanOrEqual(100);
        expect(body.items.every((entry) => (entry as { status?: string }).status === 'DRAFT')).toBe(true);
        return jsonResponse({
          summary: { received: body.items.length, created: body.items.length, duplicates: 0, invalid: 0 },
          results: body.items.map((_, index) => ({ index, status: 'CREATED', id: `created-${index}` })),
        });
      }
      return jsonResponse({ error: { code: 'NOT_FOUND', message: 'Unexpected URL' } }, 404);
    });

    const result = await runMath5Import({
      execute: true,
      apiBaseUrl: 'https://api.example.test/',
      sessionCookie: 'tohieu_session=test',
      fetchImpl: fetchMock as unknown as typeof fetch,
      writeReport: false,
    });

    expect(result).toMatchObject({
      mode: 'EXECUTED',
      totalItems: 350,
      batches: [100, 100, 100, 50],
      summary: { received: 350, created: 350, duplicates: 0, invalid: 0 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(10);
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.filter((url) => url.includes('/api/test-bank?'))).toHaveLength(6);
    expect(urls.filter((url) => url.endsWith('/api/test-bank/bulk'))).toHaveLength(4);
  });

  it('aborts execute mode when preflight finds existing system questions', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ pagination: { totalItems: 1 } }));
    await expect(runMath5Import({
      execute: true,
      apiBaseUrl: 'https://api.example.test',
      sessionCookie: 'tohieu_session=test',
      fetchImpl: fetchMock as unknown as typeof fetch,
    })).rejects.toThrow('Preflight found 6 existing SYSTEM question(s)');
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('keeps topic publishing in dry-run until --execute is explicit', async () => {
    const fetchMock = vi.fn();
    const result = await runPublishMath5Topic({
      topicCode: 'M5-S1-T05',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result).toEqual({
      mode: 'DRY_RUN',
      topicCode: 'M5-S1-T05',
      expectedItems: 70,
      draftItemsFound: 0,
      published: 0,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('builds a complete review report and cryptographic manifest', async () => {
    const manifest = await buildMath5Manifest();
    const report = await buildMath5ReviewReport();
    expect(manifest).toMatchObject({
      datasetVersion: '2026.08.02.1',
      status: 'DRAFT',
      counts: { items: 350, validItems: 350, duplicateHashes: 0 },
      importBatches: [100, 100, 100, 50],
    });
    expect(manifest.files).toHaveLength(6);
    expect(manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
    expect(manifest.datasetSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report).toContain('M5-S1-L06 — Bài 6: Cộng, trừ hai phân số khác mẫu số');
    expect(report).toContain('M5-S1-L35 — Bài 35: Ôn tập chung');
    expect((report.match(/\*\*Câu \d+ —/g) || [])).toHaveLength(350);
    expect(fs.existsSync('data/question-bank/math5-semester1/topic-06.json')).toBe(true);
  });
});
