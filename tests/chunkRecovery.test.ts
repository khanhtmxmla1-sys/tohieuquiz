import { describe, expect, it, vi } from 'vitest';
import { isStaleChunkError, recoverFromStaleChunk } from '../src/utils/chunkRecovery';

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
};

describe('chunk recovery', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://example.test/assets/Tab-old.js',
    'ChunkLoadError: Loading chunk dashboard failed',
    'Importing a module script failed',
  ])('recognizes stale deployment errors: %s', (message) => {
    expect(isStaleChunkError(new TypeError(message))).toBe(true);
  });

  it('ignores unrelated application errors', () => {
    expect(isStaleChunkError(new Error('Student not found'))).toBe(false);
  });

  it('reloads once and records the attempt in session storage', () => {
    const storage = createStorage();
    const reload = vi.fn();
    const error = new TypeError('Failed to fetch dynamically imported module');

    expect(recoverFromStaleChunk(error, {
      storage,
      reload,
      now: () => 10_000,
    })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledTimes(1);

    expect(recoverFromStaleChunk(error, {
      storage,
      reload,
      now: () => 20_000,
    })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('allows another recovery after the cooldown', () => {
    const storage = createStorage();
    const reload = vi.fn();
    const error = new Error('Error loading dynamically imported module');

    expect(recoverFromStaleChunk(error, { storage, reload, now: () => 1_000 })).toBe(true);
    expect(recoverFromStaleChunk(error, { storage, reload, now: () => 62_000 })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
