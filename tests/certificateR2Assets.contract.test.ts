import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const requiredFonts = [
  'Roboto-Regular',
  'Roboto-Bold',
  'Spectral-Regular',
  'Spectral-Bold',
  'Spectral-BoldItalic',
  'DancingScript-Bold',
  'GreatVibes-Regular',
  'PlaywriteVN-Regular',
  'Allura-Regular',
  'AlexBrush-Regular',
];

const requiredBackgrounds = [
  'classic-red-navy.webp',
  'modern-color.webp',
  'formal-blue.webp',
  'kids-learning.webp',
  'geometric-navy-orange.webp',
];

describe('certificate R2 asset contract', () => {
  it('loads every required certificate font from the private R2 bucket', () => {
    const loader = readFileSync('workers/src/services/fontLoader.ts', 'utf8');
    const docs = readFileSync('assets/certificate-fonts/README.md', 'utf8');

    for (const font of requiredFonts) {
      expect(loader).toContain(`'${font}'`);
      expect(docs).toContain(`fonts/${font}.ttf`);
    }
    expect(loader).toContain('env?.CERT_IMAGES');
    expect(loader).toContain('Certificate font not found in R2');
  });

  it('keeps all seeded background files available under their exact R2 keys', () => {
    const seed = readFileSync(
      'workers/migrations/0036_seed_tohieuquiz_certificate_templates.sql',
      'utf8',
    );
    const docs = readFileSync('assets/certificate-fonts/README.md', 'utf8');

    for (const background of requiredBackgrounds) {
      const r2Key = `cert-backgrounds/tohieuquiz-2026/${background}`;
      const localPath = `assets/certificate-backgrounds/tohieuquiz-2026/${background}`;
      expect(seed).toContain(r2Key);
      expect(docs).toContain(r2Key);
      expect(existsSync(localPath)).toBe(true);
    }
  });

  it('keeps generated certificate images behind authenticated API routes', () => {
    const processor = readFileSync(
      'workers/src/services/certificateBatchProcessor.ts',
      'utf8',
    );
    const config = readFileSync(
      'workers/wrangler.certificate-consumer.toml',
      'utf8',
    );

    expect(processor).toContain(
      'const authenticatedImagePath = `/api/certificates/${student.certificate_id}/image`',
    );
    expect(config).toContain('bucket_name = "tohieuquiz-certificates"');
    expect(config).not.toContain('custom_domain');
  });
});
