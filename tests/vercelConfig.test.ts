import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
  rewrites: Array<{ source: string; destination: string }>;
  headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
};
const vercelIgnoreRules = readFileSync('.vercelignore', 'utf8').split(/\r?\n/);
const gitIgnoreRules = readFileSync('.gitignore', 'utf8').split(/\r?\n/);

const headerValue = (source: string, key: string) => config.headers
  .find(entry => entry.source === source)
  ?.headers.find(header => header.key.toLowerCase() === key.toLowerCase())
  ?.value;

describe('Vercel Parent Portal security configuration', () => {
  it('keeps the API rewrite first and the SPA fallback present', () => {
    expect(config.rewrites[0]).toEqual({
      source: '/api/:path*',
      destination: 'https://api.thtohieu.com/api/:path*',
    });
    expect(config.rewrites.some(item => item.destination === '/index.html' && item.source.includes('?!api/'))).toBe(true);
  });

  it('marks parent routes noindex/no-referrer and authentication pages no-store', () => {
    const parentSources = ['/activate', '/login', '/dashboard', '/notifications', '/results/:path*', '/assignments', '/certificates', '/profile'];
    for (const source of parentSources) {
      expect(headerValue(source, 'X-Robots-Tag')).toBe('noindex, nofollow');
      expect(headerValue(source, 'Referrer-Policy')).toBe('no-referrer');
    }
    expect(headerValue('/activate', 'Cache-Control')).toBe('private, no-store');
    expect(headerValue('/login', 'Cache-Control')).toBe('private, no-store');
  });

  it('preserves immutable asset caching and does not globally noindex the main site', () => {
    expect(headerValue('/assets/(.*)', 'Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(headerValue('/(.*)', 'X-Robots-Tag')).toBeUndefined();
  });

  it('anchors the local repository ignore rule so nested brand assets are deployed', () => {
    expect(vercelIgnoreRules).toContain('/tohieuquiz/');
    expect(vercelIgnoreRules).not.toContain('tohieuquiz/');
    expect(gitIgnoreRules).toContain('/tohieuquiz/');
    expect(gitIgnoreRules).not.toContain('tohieuquiz/');
  });
});
