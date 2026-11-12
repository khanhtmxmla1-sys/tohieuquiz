import { describe, expect, it } from 'vitest';
import {
  assertMutationNamespace,
  normalizeSmokeUrl,
  redactSmokeText,
} from '../scripts/run-production-smoke.mjs';
import { assertProductionTarget, PRODUCTION_ORIGINS } from '../scripts/production-targets.mjs';

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

  it('does not reflect malformed URL input in configuration errors', () => {
    const canary = 'fixture-canary-should-not-appear';
    expect(() => normalizeSmokeUrl(`https://[${canary}`, false)).toThrow('Invalid smoke URL.');
    expect(() => normalizeSmokeUrl(`https://[${canary}`, false)).not.toThrow(canary);
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

  it('accepts only the canonical origin for each production target', () => {
    expect(assertProductionTarget(`${PRODUCTION_ORIGINS.api}/`, 'api')).toBe(PRODUCTION_ORIGINS.api);
    expect(() => assertProductionTarget(`${PRODUCTION_ORIGINS.site}/`, 'api'))
      .toThrow('Unapproved production smoke target');
    expect(() => assertProductionTarget('https://api.thtohieu.com.untrusted.example/', 'api'))
      .toThrow('Unapproved production smoke target');
    const userInfoUrl = new URL(PRODUCTION_ORIGINS.api);
    userInfoUrl.username = 'fixture-user';
    userInfoUrl.password = 'fixture-password';
    expect(() => assertProductionTarget(userInfoUrl.toString(), 'api'))
      .toThrow('Unapproved production smoke target');
    expect(() => assertProductionTarget('http://api.thtohieu.com/', 'api'))
      .toThrow('Unapproved production smoke target');
    expect(() => assertProductionTarget('https://api.thtohieu.com:8443/', 'api'))
      .toThrow('Unapproved production smoke target');
    expect(() => assertProductionTarget('https://api.thtohieu.com:443/', 'api'))
      .toThrow('Unapproved production smoke target');
    expect(() => assertProductionTarget(' https://api.thtohieu.com:443/', 'api'))
      .toThrow('Unapproved production smoke target');
    expect(() => assertProductionTarget('https:////api.thtohieu.com:443/', 'api'))
      .toThrow('Unapproved production smoke target');
    expect(() => assertProductionTarget('https://api.thtohieu.com/extra', 'api'))
      .toThrow('Unapproved production smoke target');
    expect(() => assertProductionTarget('https://api.thtohieu.com/?leak=true', 'api'))
      .toThrow('Unapproved production smoke target');
    const canary = 'fixture-canary-should-not-appear';
    expect(() => assertProductionTarget(`https://[${canary}`, 'api')).toThrow('Unapproved production smoke target');
    expect(() => assertProductionTarget(`https://[${canary}`, 'api')).not.toThrow(canary);
  });
});
