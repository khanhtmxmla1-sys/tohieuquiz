import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

const root = path.resolve(__dirname, '..');
const faviconPath = path.join(root, 'public/favicon-school-v2.png');
const sourcePath = path.join(root, 'public/assets/branding/school-logo-512.png');

const readIndex = async () => fs.readFile(path.join(root, 'index.html'), 'utf8');

describe('Google school favicon SEO contract', () => {
  it('publishes the current school seal as the only public favicon', async () => {
    const dom = new JSDOM(await readIndex());
    const document = dom.window.document;
    const icon = document.head.querySelector('link[rel="icon"]');
    const shortcut = document.head.querySelector('link[rel="shortcut icon"]');
    const publicIconLinks = [...document.head.querySelectorAll('link[rel]')]
      .filter(link => /(^|\s)(icon|shortcut)(\s|$)/.test(link.rel));

    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('rel', 'icon');
    expect(icon).toHaveAttribute('type', 'image/png');
    expect(icon).toHaveAttribute('sizes', '512x512');
    expect(icon).toHaveAttribute('href', '/favicon-school-v2.png');
    expect(shortcut).not.toBeNull();
    expect(shortcut).toHaveAttribute('rel', 'shortcut icon');
    expect(shortcut).toHaveAttribute('type', 'image/png');
    expect(shortcut).toHaveAttribute('href', '/favicon-school-v2.png');
    expect(publicIconLinks).toHaveLength(2);
    expect(publicIconLinks.map(link => link.getAttribute('href'))).toEqual([
      '/favicon-school-v2.png',
      '/favicon-school-v2.png',
    ]);

    const html = await readIndex();
    expect(html).not.toContain('/favicon.svg');
    expect(html).not.toContain('/assets/branding/favicon-32.png');
    expect(html).not.toContain('/assets/branding/favicon-48.png');
  });

  it('keeps the Apple touch icon, PWA icons, social card and static schema intact', async () => {
    const dom = new JSDOM(await readIndex());
    const document = dom.window.document;
    const manifest = JSON.parse(await fs.readFile(path.join(root, 'public/site.webmanifest'), 'utf8'));
    const jsonLd = JSON.parse(document.getElementById('seo-jsonld')?.textContent || '{}');
    const graph = jsonLd['@graph'] as Array<Record<string, unknown>>;
    const organization = graph.find(item => item['@type'] === 'EducationalOrganization');

    expect(document.head.querySelector('link[rel="apple-touch-icon"]')).toHaveAttribute(
      'href',
      '/assets/branding/apple-touch-icon.png',
    );
    expect(document.head.querySelector('link[rel="apple-touch-icon"]')).toHaveAttribute('sizes', '180x180');
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        src: '/assets/branding/pwa-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      }),
      expect.objectContaining({
        src: '/assets/branding/pwa-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      }),
      expect.objectContaining({
        src: '/assets/branding/pwa-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      }),
    ]));
    expect(document.head.querySelector('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'https://www.thtohieu.com/assets/branding/tohieuquiz-social-card-v2.png',
    );
    expect(document.head.querySelector('meta[name="twitter:image"]')).toHaveAttribute(
      'content',
      'https://www.thtohieu.com/assets/branding/tohieuquiz-social-card-v2.png',
    );
    expect(document.head.querySelector('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
    expect(document.head.querySelector('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
    expect(organization?.logo).toBe('https://www.thtohieu.com/assets/branding/school-logo-512.png');
    expect(JSON.stringify(jsonLd)).toContain('https://www.thtohieu.com/assets/branding/school-logo-512.png');
  });

  it('copies the approved 512px school seal byte-for-byte', async () => {
    const [favicon, source] = await Promise.all([
      fs.readFile(faviconPath),
      fs.readFile(sourcePath),
    ]);
    const metadata = await sharp(favicon).metadata();

    expect(metadata).toMatchObject({ format: 'png', width: 512, height: 512 });
    expect(crypto.createHash('sha256').update(favicon).digest('hex'))
      .toBe(crypto.createHash('sha256').update(source).digest('hex'));
    expect(favicon.equals(source)).toBe(true);
  });
});
