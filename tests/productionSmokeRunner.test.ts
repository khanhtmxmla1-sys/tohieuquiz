import { describe, expect, it } from 'vitest';
import {
  assertMutationNamespace,
  normalizeSmokeUrl,
  redactSmokeText,
} from '../scripts/run-production-smoke.mjs';

describe('production smoke runner safeguards', () => {
  it('normalizes an HTTPS target and removes its trailing slash', () => {
    expect(normalizeSmokeUrl('https://www.thtohieu.com/', false)).toBe('https://www.thtohieu.com');
  });

  it('rejects insecure remote targets and embedded credentials', () => {
    expect(() => normalizeSmokeUrl('http://example.test', false)).toThrow('HTTPS');
    const credentialUrl = new URL('https://example.test');
    credentialUrl.username = 'fixture-user';
    credentialUrl.password = ['opaque', 'fixture'].join('-');
    expect(() => normalizeSmokeUrl(credentialUrl.toString(), false)).toThrow('credentials');
  });

  it('allows localhost only when local mode is explicit', () => {
    expect(() => normalizeSmokeUrl('http://127.0.0.1:3001', false)).toThrow('HTTPS');
    expect(normalizeSmokeUrl('http://127.0.0.1:3001/', true)).toBe('http://127.0.0.1:3001');
  });

  it('permits mutation smoke only in staging or test namespaces', () => {
    expect(assertMutationNamespace('none')).toBe('none');
    expect(assertMutationNamespace('staging')).toBe('staging');
    expect(assertMutationNamespace('test')).toBe('test');
    expect(() => assertMutationNamespace('production')).toThrow();
  });

  it('redacts credentials, bearer values, and email addresses from reports', () => {
    const redacted = redactSmokeText(
      'authorization=Bearer secret-token password=hunter2 pin=123456 admin@example.test',
    );
    expect(redacted).not.toContain('secret-token');
    expect(redacted).not.toContain('hunter2');
    expect(redacted).not.toContain('123456');
    expect(redacted).not.toContain('admin@example.test');
  });
});
