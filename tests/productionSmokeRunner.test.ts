import { describe, expect, it } from 'vitest';
import { normalizeSmokeUrl } from '../scripts/run-production-smoke.mjs';

describe('production smoke runner URL guard', () => {
  it('normalizes an HTTPS target and removes its trailing slash', () => {
    expect(normalizeSmokeUrl('https://www.thtohieu.com/', false)).toBe('https://www.thtohieu.com');
  });

  it('rejects insecure remote targets', () => {
    expect(() => normalizeSmokeUrl('http://example.test', false)).toThrow('HTTPS');
  });

  it('allows localhost only when local mode is explicit', () => {
    expect(() => normalizeSmokeUrl('http://127.0.0.1:3001', false)).toThrow('HTTPS');
    expect(normalizeSmokeUrl('http://127.0.0.1:3001/', true)).toBe('http://127.0.0.1:3001');
  });
});
