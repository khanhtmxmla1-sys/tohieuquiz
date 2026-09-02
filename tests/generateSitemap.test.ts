import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildSitemapEntries,
  isQuizPublic,
  resolveApiUrl,
  resolveOutputFile,
} = require('../scripts/generate_sitemap.cjs') as {
  buildSitemapEntries: (options: {
    apiUrl: string;
    fetchImpl: (url: string) => Promise<{
      ok: boolean;
      status: number;
      statusText?: string;
      json: () => Promise<unknown>;
      text: () => Promise<string>;
    }>;
    siteUrl: string;
    today: string;
  }) => Promise<Array<{ loc: string; lastmod: string }>>;
  isQuizPublic: (quiz: Record<string, unknown>) => boolean;
  resolveApiUrl: (env?: Record<string, string | undefined>) => string;
  resolveOutputFile: (argv?: string[]) => string;
};

describe('generate sitemap output path', () => {
  it('keeps the manual command pointed at public/sitemap.xml', () => {
    expect(resolveOutputFile(['node', 'generate_sitemap.cjs'])).toBe(
      path.resolve(process.cwd(), 'public', 'sitemap.xml'),
    );
  });

  it('allows the build to write directly into dist', () => {
    expect(resolveOutputFile(['node', 'generate_sitemap.cjs', 'dist/sitemap.xml'])).toBe(
      path.resolve(process.cwd(), 'dist', 'sitemap.xml'),
    );
  });
});

describe('generate sitemap API URL resolution', () => {
  it('does not call any API when build variables are absent', () => {
    expect(resolveApiUrl({})).toBe('');
  });

  it('prefers explicit sitemap configuration over other API variables', () => {
    expect(resolveApiUrl({
      SITEMAP_API_URL: 'https://sitemap.example.test ',
      WORKERS_API_URL: 'https://workers.example.test',
      VITE_WORKERS_API_URL: 'https://vite.example.test',
    })).toBe('https://sitemap.example.test');
  });

  it('falls back through worker variables in order', () => {
    expect(resolveApiUrl({
      WORKERS_API_URL: 'https://workers.example.test',
      VITE_WORKERS_API_URL: 'https://vite.example.test',
    })).toBe('https://workers.example.test');

    expect(resolveApiUrl({
      VITE_WORKERS_API_URL: 'https://vite.example.test',
    })).toBe('https://vite.example.test');
  });
});

describe('generate sitemap public quiz policy', () => {
  it('excludes quizzes from archived categories', () => {
    expect(isQuizPublic({ category: 'ioe', showOnHome: true, requireCode: false })).toBe(false);
    expect(isQuizPublic({ category_name: ' IOE ', show_on_home: 1, require_code: 0 })).toBe(false);
  });

  it('keeps active public quizzes and excludes protected ones', () => {
    expect(isQuizPublic({ category: 'tieng-anh', showOnHome: true, requireCode: false })).toBe(true);
    expect(isQuizPublic({ category: 'toan', showOnHome: true, requireCode: true })).toBe(false);
  });
});

describe('generate sitemap public competition policy', () => {
  it('adds only published public campaign and article URLs, never student routes', async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string) => {
      calls.push(url);
      if (url.endsWith('/api/quizzes')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
          text: async () => '',
        };
      }
      if (url.endsWith('/api/public/competitions')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'success',
            data: [
              { slug: 'san-choi-2026', updatedAt: '2026-08-20T00:00:00.000Z' },
              { slug: 'draft-campaign', status: 'DRAFT' },
            ],
          }),
          text: async () => '',
        };
      }
      if (url.endsWith('/api/public/competitions/san-choi-2026/articles')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'success',
            data: [
              { slug: 'the-le', publishedAt: '2026-08-21T00:00:00.000Z' },
              { slug: 'draft-article', status: 'DRAFT' },
            ],
          }),
          text: async () => '',
        };
      }
      throw new Error(`Unexpected URL ${url}`);
    };

    const entries = await buildSitemapEntries({
      siteUrl: 'https://www.example.test',
      apiUrl: 'https://api.example.test',
      today: '2026-08-31',
      fetchImpl,
    });
    const locations = entries.map((entry) => entry.loc);

    expect(locations).toContain('https://www.example.test/cuoc-thi/san-choi-2026');
    expect(locations).toContain('https://www.example.test/cuoc-thi/san-choi-2026/tin-tuc/the-le');
    expect(locations).not.toContain('https://www.example.test/cuoc-thi/draft-campaign');
    expect(locations).not.toContain('https://www.example.test/cuoc-thi/san-choi-2026/tin-tuc/draft-article');
    expect(locations.some((location) => location.includes('/thi/'))).toBe(false);
    expect(calls).toContain('https://api.example.test/api/public/competitions');
    expect(calls).toContain('https://api.example.test/api/public/competitions/san-choi-2026/articles');
  });
});
