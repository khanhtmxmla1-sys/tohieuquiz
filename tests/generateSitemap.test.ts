import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { isQuizPublic, resolveApiUrl, resolveOutputFile } = require('../scripts/generate_sitemap.cjs') as {
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
