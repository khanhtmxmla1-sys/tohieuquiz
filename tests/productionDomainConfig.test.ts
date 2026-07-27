import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const collectFrontendSourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectFrontendSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });

describe('TôHiệuQuiz production domain contract', () => {
  it('routes the API Worker through api.thtohieu.com with the approved origins', () => {
    const config = read('workers/wrangler.toml');

    expect(config).toContain('{ pattern = "api.thtohieu.com", custom_domain = true }');
    expect(config).toContain('R2_PUBLIC_URL = "https://assets.thtohieu.com"');

    const aiGateway = read('workers/ai-gateway/wrangler.toml');
    expect(aiGateway).toContain('{ pattern = "ai.thtohieu.com/*", zone_name = "thtohieu.com" }');
    expect(aiGateway).toContain('[[vpc_services]]');
    expect(aiGateway).toContain('binding = "AI_ORIGIN"');
    expect(aiGateway).toContain('service_id = "019fa1e4-5f22-7ba1-87ac-4bfba673e261"');
    expect(aiGateway).toContain('UPSTREAM_BASE_URL = "http://ai.thitong.site"');
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

  it('keeps AI gateway credentials and direct gateway calls out of browser code', () => {
    const browserSources = collectFrontendSourceFiles('src');
    const directGatewayReferences = browserSources.filter((path) => read(path).includes('ai.thtohieu.com'));
    const workerClient = read('src/services/ai/workerAiClient.ts');
    const endpointConfig = read('src/services/ai/endpointConfig.ts');
    const workerConfig = read('workers/wrangler.toml');

    expect(directGatewayReferences).toEqual([]);
    expect(endpointConfig).toContain("AI_CHAT_API_PATH = '/api/ai/chat'");
    expect(workerClient).toContain('AI_CHAT_API_PATH');
    expect(workerClient).toContain("credentials: 'include'");
    expect(workerClient).not.toContain('Authorization:');
    expect(workerConfig).toContain('CLIPROXY_API = "https://ai.thtohieu.com/v1"');
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
