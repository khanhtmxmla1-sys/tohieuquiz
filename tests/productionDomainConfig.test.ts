import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('TôHiệuQuiz production domain contract', () => {
  it('routes the API Worker through api.thtohieu.com with the approved origins', () => {
    const config = read('workers/wrangler.toml');

    expect(config).toContain('{ pattern = "api.thtohieu.com", custom_domain = true }');
    expect(config).toContain('R2_PUBLIC_URL = "https://assets.thtohieu.com"');

    const aiGateway = read('workers/ai-gateway/wrangler.toml');
    expect(aiGateway).toContain('{ pattern = "ai.thtohieu.com/*", zone_name = "thtohieu.com" }');
    expect(aiGateway).toContain('UPSTREAM_BASE_URL = "https://ai.thitong.site"');
    expect(aiGateway).toContain('workers_dev = false');
    expect(aiGateway).toContain('preview_urls = false');
    for (const origin of [
      'https://thtohieu.com',
      'https://www.thtohieu.com',
      'https://app.thtohieu.com',
      'https://phuhuynh.thtohieu.com',
    ]) {
      expect(config).toContain(origin);
    }
  });

  it('keeps the frontend, SEO, sitemap and CSP on the official domains', () => {
    const vercel = read('vercel.json');
    const index = read('index.html');
    const seo = read('src/hooks/useSeo.ts');
    const robots = read('public/robots.txt');
    const sitemap = read('public/sitemap.xml');
    const headers = read('public/_headers');

    expect(vercel).toContain('https://api.thtohieu.com/api/:path*');
    expect(vercel).toContain('https://assets.thtohieu.com');
    expect(index).toContain('https://www.thtohieu.com/');
    expect(seo).toContain("url: 'https://www.thtohieu.com'");
    expect(robots).toContain('Sitemap: https://www.thtohieu.com/sitemap.xml');
    expect(sitemap).toContain('<loc>https://www.thtohieu.com/</loc>');
    expect(headers).toContain('https://api.thtohieu.com');
    expect(headers).toContain('https://assets.thtohieu.com');
  });

  it('uses the dedicated parent domain and keeps certificates private', () => {
    const teacherLinks = read(
      'workers/src/routes/parentPortal/teacherLinkRoutes.ts',
    );
    const consumer = read('workers/wrangler.certificate-consumer.toml');
    const processor = read(
      'workers/src/services/certificateBatchProcessor.ts',
    );

    expect(teacherLinks).toContain('https://phuhuynh.thtohieu.com');
    expect(consumer).toContain('bucket_name = "tohieuquiz-certificates"');
    expect(consumer).not.toContain('custom_domain');
    expect(processor).toContain(
      'const authenticatedImagePath = `/api/certificates/${student.certificate_id}/image`',
    );
  });

  it('contains no placeholder or legacy production domains in deployment-critical files', () => {
    const deploymentCritical = [
      '.env.example',
      'index.html',
      'vercel.json',
      'public/_headers',
      'public/robots.txt',
      'public/sitemap.xml',
      'scripts/generate_sitemap.cjs',
      'src/hooks/useSeo.ts',
      'workers/wrangler.toml',
      'workers/wrangler.certificate-consumer.toml',
    ].map(read).join('\n');

    expect(deploymentCritical).not.toMatch(/tohieuquiz\.invalid/i);
    expect(deploymentCritical).not.toMatch(/thitong\.site/i);
    expect(deploymentCritical).not.toMatch(/itongquiz1\.vercel\.app/i);
    expect(deploymentCritical).not.toMatch(/phieu\.thitong\.site/i);
  });
});
