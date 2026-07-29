export const DEFAULT_COLLECTION_LIMIT = 25;
export const MAX_COLLECTION_LIMIT = 100;

export interface CursorPageMeta {
  limit: number;
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CursorPage<T> {
  items: T[];
  meta: CursorPageMeta;
}

export function normalizeCollectionLimit(value: unknown): number {
  if (value === undefined || value === null || value === '') return DEFAULT_COLLECTION_LIMIT;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_COLLECTION_LIMIT) {
    throw new Error(`limit must be an integer between 1 and ${MAX_COLLECTION_LIMIT}`);
  }
  return limit;
}
