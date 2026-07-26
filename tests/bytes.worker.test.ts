import { describe, expect, it } from 'vitest';
import { toArrayBuffer } from '../workers/src/utils/bytes';

describe('Worker byte helpers', () => {
  it('copies only the active Uint8Array view into an independent ArrayBuffer', () => {
    const source = new Uint8Array([10, 20, 30, 40]);
    const view = source.subarray(1, 3);

    const buffer = toArrayBuffer(view);

    expect(Array.from(new Uint8Array(buffer))).toEqual([20, 30]);
    source[1] = 99;
    expect(Array.from(new Uint8Array(buffer))).toEqual([20, 30]);
  });
});
