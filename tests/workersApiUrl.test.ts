import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { normalizeWorkersApiUrl } from '../src/config/constants';
import { resolveWorkersApiBaseUrl } from '../src/services/api/config';

describe('normalizeWorkersApiUrl', () => {
  it('removes literal escaped line endings from deployment environment values', () => {
    expect(normalizeWorkersApiUrl('https://api.thtohieu.com\\r\\n')).toBe(
      'https://api.thtohieu.com',
    );
  });

  it('removes real line endings, whitespace, and trailing slashes', () => {
    expect(normalizeWorkersApiUrl('  https://api.thtohieu.com/\r\n')).toBe(
      'https://api.thtohieu.com',
    );
  });

  it('uses a same-origin API base on Vercel Preview but keeps the configured production origin', () => {
    expect(resolveWorkersApiBaseUrl({
      configuredUrl: 'https://api.thtohieu.com',
      isDev: false,
      hostname: 'tohieuquiz-git-security.vercel.app',
    })).toBe('');
    expect(resolveWorkersApiBaseUrl({
      configuredUrl: 'https://api.thtohieu.com',
      isDev: false,
      hostname: 'thtohieu.com',
    })).toBe('https://api.thtohieu.com');
    expect(resolveWorkersApiBaseUrl({
      configuredUrl: 'https://api.thtohieu.com',
      isDev: false,
      hostname: 'phuhuynh.thtohieu.com',
    })).toBe('');
  });

  it('orders the external API rewrite before the SPA fallback', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
    expect(config.rewrites[0]).toEqual({
      source: '/api/:path*',
      destination: 'https://api.thtohieu.com/api/:path*',
    });
    const spaFallback = config.rewrites.find((rewrite: { source: string }) => rewrite.destination === '/index.html' && rewrite.source.includes('?!api/'));
    expect(config.rewrites.indexOf(spaFallback)).toBeGreaterThan(0);
  });
});
