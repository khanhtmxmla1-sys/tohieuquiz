import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CuratedQuestionBankInput } from './math5-types.ts';
import { loadCommittedMath5Dataset, validateMath5Dataset } from './validate-math5-dataset.ts';

export interface PublishMath5TopicOptions {
  topicCode: string;
  execute?: boolean;
  apiBaseUrl?: string;
  sessionCookie?: string;
  fetchImpl?: typeof fetch;
}

export interface PublishMath5TopicResult {
  mode: 'DRY_RUN' | 'EXECUTED';
  topicCode: string;
  expectedItems: number;
  draftItemsFound: number;
  published: number;
}

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
  if (!response.ok) throw new Error(`Publish request failed (${response.status}): ${JSON.stringify(body)}`);
  return body as T;
};

const expectedTopicItems = (topicCode: string): CuratedQuestionBankInput[] => {
  const { curriculum, items } = loadCommittedMath5Dataset();
  if (!curriculum.topics.some((topic) => topic.code === topicCode)) {
    throw new Error(`Unknown topic code: ${topicCode}`);
  }
  return items.filter((item) => item.metadata.topicCode === topicCode);
};

export const runPublishMath5Topic = async (
  options: PublishMath5TopicOptions,
): Promise<PublishMath5TopicResult> => {
  const validation = await validateMath5Dataset();
  if (!validation.valid) throw new Error(`Dataset validation failed: ${validation.errors.join(' | ')}`);
  const expected = expectedTopicItems(options.topicCode);
  if (!options.execute) {
    return {
      mode: 'DRY_RUN',
      topicCode: options.topicCode,
      expectedItems: expected.length,
      draftItemsFound: 0,
      published: 0,
    };
  }

  const apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl || process.env.TOHIEUQUIZ_API_BASE_URL || '');
  const sessionCookie = options.sessionCookie || process.env.TOHIEUQUIZ_SESSION_COOKIE || '';
  if (!apiBaseUrl) throw new Error('TOHIEUQUIZ_API_BASE_URL is required for --execute.');
  if (!sessionCookie) throw new Error('TOHIEUQUIZ_SESSION_COOKIE is required for --execute.');
  const fetchImpl = options.fetchImpl || fetch;

  const draftItems: Array<{ id: string }> = [];
  let page = 1;
  let totalPages = 1;
  do {
    const query = new URLSearchParams({
      scope: 'SYSTEM',
      status: 'DRAFT',
      topicCode: options.topicCode,
      page: String(page),
      pageSize: '100',
    });
    const response = await requestJson<{
      items: Array<{ id: string }>;
      pagination: { totalPages: number };
    }>(fetchImpl, `${apiBaseUrl}/api/test-bank?${query.toString()}`, sessionCookie);
    draftItems.push(...response.items);
    totalPages = response.pagination.totalPages;
    page += 1;
  } while (page <= totalPages);

  if (draftItems.length !== expected.length) {
    throw new Error(`Expected ${expected.length} DRAFT items for ${options.topicCode}, found ${draftItems.length}.`);
  }

  let published = 0;
  for (const item of draftItems) {
    await requestJson(
      fetchImpl,
      `${apiBaseUrl}/api/test-bank/${encodeURIComponent(item.id)}`,
      sessionCookie,
      { method: 'PATCH', body: JSON.stringify({ status: 'PUBLISHED' }) },
    );
    published += 1;
  }

  return {
    mode: 'EXECUTED',
    topicCode: options.topicCode,
    expectedItems: expected.length,
    draftItemsFound: draftItems.length,
    published,
  };
};

const args = process.argv.slice(2);
const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const topicCode = args.find((value) => /^M5-S1-T0[1-6]$/.test(value));
  if (!topicCode) throw new Error('Provide topic code M5-S1-T01 through M5-S1-T06.');
  const result = await runPublishMath5Topic({
    topicCode,
    execute: args.includes('--execute'),
  });
  console.log(JSON.stringify(result, null, 2));
}
