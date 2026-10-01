import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  BRAND_ASSET_SPECS,
  inspectBrandAssets,
} from '../scripts/build-brand-assets.mjs';

const root = path.resolve(__dirname, '..');

describe('official brand asset pipeline', () => {
  it('publishes every derived asset with the approved geometry', async () => {
    expect(await inspectBrandAssets(root)).toEqual([]);
    expect(BRAND_ASSET_SPECS.map(asset => asset.relativePath)).toEqual([
      'public/assets/branding/school-logo-v2.webp',
      'public/assets/branding/school-logo-512.png',
      'public/assets/branding/favicon-32.png',
      'public/assets/branding/favicon-48.png',
      'public/assets/branding/apple-touch-icon.png',
      'public/assets/branding/pwa-icon-192.png',
      'public/assets/branding/pwa-icon-512.png',
      'public/assets/branding/pwa-maskable-512.png',
      'public/assets/branding/tohieuquiz-social-card-v2.png',
    ]);
  });

  it('keeps the source seal square and transparent', async () => {
    const source = path.join(root, 'public/assets/branding/school-logo-source-v2.png');
    await expect(fs.stat(source)).resolves.toMatchObject({ isFile: expect.any(Function) });
    const metadata = await sharp(source).metadata();
    expect(metadata).toMatchObject({
      format: 'png', width: 1290, height: 1290, channels: 4, hasAlpha: true,
    });
  });

  it('references only the versioned brand assets in HTML and the manifest', async () => {
    const html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
    const manifest = JSON.parse(await fs.readFile(path.join(root, 'public/site.webmanifest'), 'utf8'));
    expect(html).toContain('/assets/branding/favicon-32.png');
    expect(html).toContain('/assets/branding/favicon-48.png');
    expect(html).toContain('/assets/branding/apple-touch-icon.png');
    expect(html).toContain('https://www.thtohieu.com/assets/branding/tohieuquiz-social-card-v2.png');
    expect(html).toContain('https://www.thtohieu.com/assets/branding/school-logo-512.png');
    const legacyFavicon = ['/favicon', 'svg'].join('.');
    expect(html).not.toContain(legacyFavicon);
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: '/assets/branding/pwa-icon-192.png', sizes: '192x192', purpose: 'any' }),
      expect.objectContaining({ src: '/assets/branding/pwa-icon-512.png', sizes: '512x512', purpose: 'any' }),
      expect.objectContaining({ src: '/assets/branding/pwa-maskable-512.png', sizes: '512x512', purpose: 'maskable' }),
    ]));
  });
});
