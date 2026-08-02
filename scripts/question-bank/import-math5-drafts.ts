import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CuratedQuestionBankInput } from './math5-types.ts';
import { loadCommittedMath5Dataset, validateMath5Dataset } from './validate-math5-dataset.ts';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const reportDir = path.join(projectRoot, 'reports', 'question-bank');

export interface Math5ImportOptions {
  execute?: boolean;
  allowExisting?: boolean;
  apiBaseUrl?: string;
  sessionCookie?: string;
  fetchImpl?: typeof fetch;
  writeReport?: boolean;
}

export interface Math5ImportRunResult {
  mode: 'DRY_RUN' | 'EXECUTED';
  totalItems: number;
  batches: number[];
  existingByTopic: Record<string, number>;
  summary: { received: number; created: number; duplicates: number; invalid: number };
  results: unknown[];
}

export const buildImportBatches = <T>(items: T[], size = 100): T[][] => {
  if (!Number.isInteger(size) || size < 1 || size > 100) throw new Error('Batch size must be between 1 and 100.');
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size));
};

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '');

const requestJson = async <T>(
  fetchImpl: typeof fetch,
  url: string,
  sessionCookie: string,
  init: RequestInit = {},
): Promise<T> => {
  const response = await fetchImpl(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      Cookie: sessionCookie,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  let body: unknown = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const payload = body && typeof body === 'object'
      ? body as { error?: { code?: string; message?: string }; message?: string }
      : null;
    throw new Error(`${payload?.error?.code || response.status}: ${payload?.error?.message || payload?.message || 'Question bank request failed.'}`);
  }
  return body as T;
};

const preflightExisting = async (
  fetchImpl: typeof fetch,
  baseUrl: string,
  sessionCookie: string,
  topicCodes: string[],
): Promise<Record<string, number>> => {
  const entries = await Promise.all(topicCodes.map(async (topicCode) => {
    const query = new URLSearchParams({
      scope: 'SYSTEM',
      topicCode,
      page: '1',
      pageSize: '1',
    });
    const response = await requestJson<{ pagination: { totalItems: number } }>(
      fetchImpl,
      `${baseUrl}/api/test-bank?${query.toString()}`,
      sessionCookie,
    );
    return [topicCode, response.pagination.totalItems] as const;
  }));
  return Object.fromEntries(entries);
};

const safeDraftItems = (items: CuratedQuestionBankInput[]): CuratedQuestionBankInput[] => items.map((item) => ({
  ...item,
  scope: 'SYSTEM',
  status: 'DRAFT',
}));

export const runMath5Import = async (
  options: Math5ImportOptions = {},
): Promise<Math5ImportRunResult> => {
  const validation = await validateMath5Dataset();
  if (!validation.valid) throw new Error(`Dataset validation failed: ${validation.errors.join(' | ')}`);

  const { curriculum, items } = loadCommittedMath5Dataset();
  const drafts = safeDraftItems(items);
  const batches = buildImportBatches(drafts, 100);
  const dryRun: Math5ImportRunResult = {
    mode: 'DRY_RUN',
    totalItems: drafts.length,
    batches: batches.map((batch) => batch.length),
    existingByTopic: {},
    summary: { received: drafts.length, created: 0, duplicates: 0, invalid: 0 },
    results: [],
  };
  if (!options.execute) return dryRun;

  const apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl || process.env.TOHIEUQUIZ_API_BASE_URL || '');
  const sessionCookie = options.sessionCookie || process.env.TOHIEUQUIZ_SESSION_COOKIE || '';
  if (!apiBaseUrl) throw new Error('TOHIEUQUIZ_API_BASE_URL is required for --execute.');
  if (!sessionCookie) throw new Error('TOHIEUQUIZ_SESSION_COOKIE is required for --execute.');
  const fetchImpl = options.fetchImpl || fetch;

  const existingByTopic = await preflightExisting(
    fetchImpl,
    apiBaseUrl,
    sessionCookie,
    curriculum.topics.map((topic) => topic.code),
  );
  const existingTotal = Object.values(existingByTopic).reduce((sum, count) => sum + count, 0);
  if (existingTotal > 0 && !options.allowExisting) {
    throw new Error(`Preflight found ${existingTotal} existing SYSTEM question(s). Use --allow-existing only after review.`);
  }

  const allResults: unknown[] = [];
  const summary = { received: 0, created: 0, duplicates: 0, invalid: 0 };
  for (const batch of batches) {
    const response = await requestJson<{
      summary: typeof summary;
      results: unknown[];
    }>(
      fetchImpl,
      `${apiBaseUrl}/api/test-bank/bulk`,
      sessionCookie,
      { method: 'POST', body: JSON.stringify({ items: batch }) },
    );
    summary.received += response.summary.received;
    summary.created += response.summary.created;
    summary.duplicates += response.summary.duplicates;
    summary.invalid += response.summary.invalid;
    allResults.push(...response.results);
  }

  const result: Math5ImportRunResult = {
    mode: 'EXECUTED',
    totalItems: drafts.length,
    batches: batches.map((batch) => batch.length),
    existingByTopic,
    summary,
    results: allResults,
  };
  if (options.writeReport !== false) {
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(
      path.join(reportDir, `math5-semester1-import-${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
      `${JSON.stringify(result, null, 2)}\n`,
      'utf8',
    );
  }
  return result;
};

const args = new Set(process.argv.slice(2));
const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const result = await runMath5Import({
    execute: args.has('--execute'),
    allowExisting: args.has('--allow-existing'),
  });
  console.log(JSON.stringify(result, null, 2));
}
