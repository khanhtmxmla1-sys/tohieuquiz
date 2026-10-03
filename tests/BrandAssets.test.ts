import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  BRAND_ASSET_SPECS,
  inspectBrandAssets,
  writeBrandAssets,
} from '../scripts/build-brand-assets.mjs';

const root = path.resolve(__dirname, '..');
sharp.cache(false);

const removeFixture = async (fixtureRoot: string) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await fs.rm(fixtureRoot, { recursive: true, force: true });
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EBUSY' || attempt === 9) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
};

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
      'public/favicon-school-v2.png',
    ]);
  });

  it('rejects a missing favicon alias', async () => {
    const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'quizpro-brand-assets-'));
    const fixtureBranding = path.join(fixtureRoot, 'public/assets/branding');
    const sourceBranding = path.join(root, 'public/assets/branding');

    try {
      await fs.cp(sourceBranding, fixtureBranding, { recursive: true });
      await expect(inspectBrandAssets(fixtureRoot)).resolves.toContain(
        'public/favicon-school-v2.png: missing',
      );
    } finally {
      await removeFixture(fixtureRoot);
    }
  });

  it('rejects a stale but valid 512px PNG favicon alias', async () => {
    const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'quizpro-brand-assets-'));
    const fixtureBranding = path.join(fixtureRoot, 'public/assets/branding');
    const sourceBranding = path.join(root, 'public/assets/branding');

    try {
      await fs.cp(sourceBranding, fixtureBranding, { recursive: true });
      const stale = await sharp({
        create: {
          width: 512,
          height: 512,
          channels: 4,
          background: { r: 17, g: 31, b: 47, alpha: 1 },
        },
      }).png().toBuffer();
      await fs.writeFile(path.join(fixtureRoot, 'public/favicon-school-v2.png'), stale);
      await expect(inspectBrandAssets(fixtureRoot)).resolves.toContain(
        'public/favicon-school-v2.png: content',
      );
    } finally {
      await removeFixture(fixtureRoot);
    }
  });

  it('generates the favicon alias byte-for-byte from the approved 512px logo', async () => {
    const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'quizpro-brand-assets-'));
    const fixtureBranding = path.join(fixtureRoot, 'public/assets/branding');
    const sourceBranding = path.join(root, 'public/assets/branding');

    try {
      await fs.mkdir(fixtureBranding, { recursive: true });
      await fs.copyFile(
        path.join(sourceBranding, 'school-logo-source-v2.png'),
        path.join(fixtureBranding, 'school-logo-source-v2.png'),
      );
      await writeBrandAssets(fixtureRoot);

      const logo = await fs.readFile(path.join(fixtureBranding, 'school-logo-512.png'));
      const favicon = await fs.readFile(path.join(fixtureRoot, 'public/favicon-school-v2.png'));
      expect(favicon.equals(logo)).toBe(true);
    } finally {
      await removeFixture(fixtureRoot);
    }
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
    expect(html).toContain('/favicon-school-v2.png');
    expect(html).not.toContain('/assets/branding/favicon-32.png');
    expect(html).not.toContain('/assets/branding/favicon-48.png');
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
