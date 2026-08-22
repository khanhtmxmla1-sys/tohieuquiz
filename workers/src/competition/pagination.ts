import { normalizeCollectionLimit } from '../../../shared/pagination.contract';
import {
  decodeCollectionCursor,
  encodeCollectionCursor,
} from '../utils/cursorPagination';

export function competitionLimit(value: unknown): number {
  try {
    return normalizeCollectionLimit(value);
  } catch {
    throw new Error('COMPETITION_LIMIT_INVALID');
  }
}

export function competitionCursor(
  value: string | null | undefined,
  scope: string,
  expectedValues: number,
  errorCode: string,
): string[] | null {
  try {
    return decodeCollectionCursor(value || null, scope, expectedValues);
  } catch {
    throw new Error(errorCode);
  }
}

export function competitionPage<T>(
  rows: T[],
  limit: number,
  cursorValues: (row: T) => Array<string | number>,
  scope: string,
) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return {
    items,
    nextCursor: hasMore && last ? encodeCollectionCursor(scope, cursorValues(last)) : null,
    hasMore,
    limit,
  };
}
