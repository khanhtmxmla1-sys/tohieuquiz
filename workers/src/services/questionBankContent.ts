const HASH_OMITTED_KEYS = new Set([
  'id',
  'tags',
  'grade',
  'subject',
  'semester',
  'topicCode',
  'topic_code',
  'lessonCode',
  'lesson_code',
  'source',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
  'createdBy',
  'created_by',
  'updatedBy',
  'updated_by',
  'publishedAt',
  'published_at',
  'archivedAt',
  'archived_at',
]);

const normalizeString = (value: string): string => value.trim().replace(/\s+/g, ' ');

const canonicalValue = (value: unknown): unknown => {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return normalizeString(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    if (HASH_OMITTED_KEYS.has(key)) continue;
    const child = record[key];
    if (child === undefined || typeof child === 'function' || typeof child === 'symbol') continue;
    normalized[key] = canonicalValue(child);
  }
  return normalized;
};

export const canonicalizeQuestionData = (question: unknown): string =>
  JSON.stringify(canonicalValue(question));

const bytesToHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');

export const hashQuestionData = async (question: unknown): Promise<string> => {
  const canonical = canonicalizeQuestionData(question);
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonical),
  );
  return bytesToHex(digest);
};

export { HASH_OMITTED_KEYS };
