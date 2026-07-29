import { describe, expect, it } from 'vitest';
import { normalizeCollectionLimit } from '../shared/pagination.contract';
import {
  collectionLimit,
  decodeCollectionCursor,
  encodeCollectionCursor,
} from '../workers/src/utils/cursorPagination';

describe('large collection cursor contract', () => {
  it('defaults to 25 and caps every endpoint at 100', () => {
    expect(normalizeCollectionLimit(undefined)).toBe(25);
    expect(collectionLimit(new URL('https://api.test/items?limit=100'))).toBe(100);
    expect(() => normalizeCollectionLimit(101)).toThrow(/between 1 and 100/);
    expect(() => normalizeCollectionLimit(0)).toThrow(/between 1 and 100/);
  });

  it('encodes opaque endpoint-scoped stable cursor values', () => {
    const cursor = encodeCollectionCursor('results', ['2026-07-29T00:00:00.000Z', 'r-1']);
    expect(cursor).not.toContain('2026-07-29');
    expect(decodeCollectionCursor(cursor, 'results', 2))
      .toEqual(['2026-07-29T00:00:00.000Z', 'r-1']);
    expect(() => decodeCollectionCursor(cursor, 'students', 2)).toThrow(/cursor/);
    expect(() => decodeCollectionCursor('broken', 'results', 2)).toThrow(/cursor/);
  });
});
