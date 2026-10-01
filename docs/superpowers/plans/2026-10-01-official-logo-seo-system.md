# Official Logo and SEO System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every project-brand logo surface with the approved official school seal, preserve the `TôHiệuQuiz` wordmark on wide surfaces, and publish correct favicon, PWA, Open Graph, Twitter and JSON-LD assets.

**Architecture:** Keep one immutable 1290×1290 RGBA source file and generate every runtime derivative with a deterministic Sharp script. Route all React surfaces through the existing `SchoolLogo` configuration, while centralizing absolute SEO URLs in `src/config/branding.ts`; static HTML and manifest use the same versioned paths. SPA SEO hooks always reset to the default social card, with campaign/article images remaining explicit overrides.

**Tech Stack:** React 19, TypeScript, Vite, Sharp, Vitest, Testing Library, Cypress, Web App Manifest, Open Graph/Twitter metadata, Schema.org JSON-LD.

## Global Constraints

- Preserve the supplied seal artwork exactly: no redraw, text replacement, recoloring or crop of the outer ring.
- Source asset is PNG 1290×1290, sRGB, RGBA with transparent corners.
- Wide surfaces use seal + existing `TôHiệuQuiz` wordmark; compact icon surfaces use the seal alone.
- Social card is exactly 1200×630 with important content inside a centered 1080×510 safe area.
- Runtime UI logo is `/assets/branding/school-logo-v2.webp`.
- Default SEO logo is `https://www.thtohieu.com/assets/branding/school-logo-512.png`.
- Default social image is `https://www.thtohieu.com/assets/branding/tohieuquiz-social-card-v2.png`.
- Do not change product naming, typography, general layout, API, Worker, D1, authentication, partner logos, mascots, avatars, module icons or functional icons.
- Do not commit implementation work until the final user approval gate.
- Source of truth: `docs/superpowers/specs/2026-10-01-official-logo-seo-system-design.md`.

---

## Blast Radius and Baseline

- `SchoolLogo`: GitNexus risk **LOW**, no indexed upstream process impact; existing component API remains unchanged.
- `buildStructuredData`: GitNexus risk **LOW**, 3 upstream symbols (`useSeo`, `MainApp`, `App`), 0 affected execution processes.
- `useSeo`: GitNexus risk **LOW**, 2 upstream symbols (`MainApp`, `App`), 0 affected execution processes.
- `applyMetadata`: GitNexus risk **LOW**, 2 upstream symbols (`useCompetitionPortalSeo`, `CompetitionPortalSeoBoundary`), 0 affected execution processes.
- Baseline command passed before implementation: 7 branding/SEO test files, 24/24 tests.

## File Structure

### New source and generator

- `public/assets/branding/school-logo-source-v2.png` — exact supplied 1290×1290 source.
- `scripts/build-brand-assets.mjs` — deterministic write/check generator.
- `tests/BrandAssets.test.ts` — dimensions, formats, alpha, manifest and reference contract.

### Generated assets

- `public/assets/branding/school-logo-v2.webp`
- `public/assets/branding/school-logo-512.png`
- `public/assets/branding/favicon-32.png`
- `public/assets/branding/favicon-48.png`
- `public/assets/branding/apple-touch-icon.png`
- `public/assets/branding/pwa-icon-192.png`
- `public/assets/branding/pwa-icon-512.png`
- `public/assets/branding/pwa-maskable-512.png`
- `public/assets/branding/tohieuquiz-social-card-v2.png`

### Runtime and metadata integration

- `package.json` — generator scripts and prebuild check.
- `src/config/branding.ts` — UI and absolute SEO asset constants.
- `index.html` — favicon, Apple icon, OG/Twitter and static JSON-LD.
- `public/site.webmanifest` — any/maskable PWA icon set.
- `src/hooks/useSeo.ts` — SPA default image reset and JSON-LD logo/image.
- `src/features/competition/portal/public/useCompetitionPortalSeo.ts` — default image fallback with content-image override.

### Updated tests

- `tests/SchoolLogo.test.tsx`
- `tests/BrandSeo.test.tsx`
- `tests/CompetitionPortalSeo.test.tsx`

### Removed obsolete assets

- `public/favicon.svg`
- `public/assets/branding/school-logo-v1.png`

Removal occurs only after `rg` confirms no remaining references. Git history is the rollback source.

---

### Task 1: Build the deterministic brand asset pipeline

**Files:**
- Create: `public/assets/branding/school-logo-source-v2.png`
- Create: `scripts/build-brand-assets.mjs`
- Create: `tests/BrandAssets.test.ts`
- Modify: `package.json`
- Generate: the nine derivative assets listed in File Structure

**Interfaces:**
- Consumes: the supplied attachment at `C:\Users\ADMINI~1\AppData\Local\Temp\codex-clipboard-d636521b-265f-4aa3-9f4d-a0b8e39d1133.png`.
- Produces: `BRAND_ASSET_SPECS`, `writeBrandAssets(projectRoot?: string): Promise<void>`, and `inspectBrandAssets(projectRoot?: string): Promise<string[]>` exported from the generator.
- Produces: committed versioned files consumed by Tasks 2 and 3.

- [ ] **Step 1: Copy the approved source image without transformation**

```powershell
Copy-Item -LiteralPath 'C:\Users\ADMINI~1\AppData\Local\Temp\codex-clipboard-d636521b-265f-4aa3-9f4d-a0b8e39d1133.png' `
  -Destination 'public\assets\branding\school-logo-source-v2.png'
```

Verify the copy before using it:

```powershell
node -e "const sharp=require('sharp'); sharp('public/assets/branding/school-logo-source-v2.png').metadata().then(m=>console.log(JSON.stringify(m)))"
```

Expected: `width=1290`, `height=1290`, `format=png`, `channels=4`, `hasAlpha=true`.

- [ ] **Step 2: Write the failing asset contract test**

Create `tests/BrandAssets.test.ts`:

```ts
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
});
```

- [ ] **Step 3: Run RED**

Run:

```powershell
npm run test:run -- tests/BrandAssets.test.ts
```

Expected: FAIL because `scripts/build-brand-assets.mjs` and derivative assets do not exist.

- [ ] **Step 4: Implement the generator API and CLI**

Create `scripts/build-brand-assets.mjs` with these exact public contracts and rendering rules:

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..');
const SOURCE = 'public/assets/branding/school-logo-source-v2.png';

export const BRAND_ASSET_SPECS = [
  { relativePath: 'public/assets/branding/school-logo-v2.webp', width: 512, height: 512, format: 'webp', alpha: true },
  { relativePath: 'public/assets/branding/school-logo-512.png', width: 512, height: 512, format: 'png', alpha: true },
  { relativePath: 'public/assets/branding/favicon-32.png', width: 32, height: 32, format: 'png', alpha: true },
  { relativePath: 'public/assets/branding/favicon-48.png', width: 48, height: 48, format: 'png', alpha: true },
  { relativePath: 'public/assets/branding/apple-touch-icon.png', width: 180, height: 180, format: 'png', alpha: true },
  { relativePath: 'public/assets/branding/pwa-icon-192.png', width: 192, height: 192, format: 'png', alpha: true },
  { relativePath: 'public/assets/branding/pwa-icon-512.png', width: 512, height: 512, format: 'png', alpha: true },
  { relativePath: 'public/assets/branding/pwa-maskable-512.png', width: 512, height: 512, format: 'png', alpha: false },
  { relativePath: 'public/assets/branding/tohieuquiz-social-card-v2.png', width: 1200, height: 630, format: 'png', alpha: false },
];

const output = (root, relativePath) => path.join(root, relativePath);
const resizeSeal = (source, size) => sharp(source)
  .resize(size, size, { fit: 'contain', kernel: sharp.kernel.lanczos3 })
  .ensureAlpha();

const socialBackground = Buffer.from(`
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#FFFDF7"/>
  <path d="M760 0H1200V630H650C840 470 880 205 760 0Z" fill="#0A3FAE"/>
  <rect x="535" y="387" width="520" height="6" rx="3" fill="#E9B31A"/>
  <text x="535" y="278" font-family="Arial, sans-serif" font-size="72" font-weight="800" fill="#0C3284">TôHiệuQuiz</text>
  <text x="535" y="347" font-family="Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="2" fill="#31548F">TRƯỜNG TIỂU HỌC TÔ HIỆU</text>
</svg>`);

export async function writeBrandAssets(projectRoot = DEFAULT_ROOT) {
  const source = output(projectRoot, SOURCE);
  const sourceMetadata = await sharp(source).metadata();
  if (sourceMetadata.width !== 1290 || sourceMetadata.height !== 1290 || !sourceMetadata.hasAlpha) {
    throw new Error('Official source logo must be a 1290x1290 PNG with alpha.');
  }

  await resizeSeal(source, 512).webp({ lossless: true }).toFile(output(projectRoot, BRAND_ASSET_SPECS[0].relativePath));
  await resizeSeal(source, 512).png({ compressionLevel: 9 }).toFile(output(projectRoot, BRAND_ASSET_SPECS[1].relativePath));
  await resizeSeal(source, 32).png({ compressionLevel: 9 }).toFile(output(projectRoot, BRAND_ASSET_SPECS[2].relativePath));
  await resizeSeal(source, 48).png({ compressionLevel: 9 }).toFile(output(projectRoot, BRAND_ASSET_SPECS[3].relativePath));
  await resizeSeal(source, 180).png({ compressionLevel: 9 }).toFile(output(projectRoot, BRAND_ASSET_SPECS[4].relativePath));
  await resizeSeal(source, 192).png({ compressionLevel: 9 }).toFile(output(projectRoot, BRAND_ASSET_SPECS[5].relativePath));
  await resizeSeal(source, 512).png({ compressionLevel: 9 }).toFile(output(projectRoot, BRAND_ASSET_SPECS[6].relativePath));

  const maskableSeal = await resizeSeal(source, 400).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 3, background: '#FFFDF7' } })
    .composite([{ input: maskableSeal, left: 56, top: 56 }])
    .png({ compressionLevel: 9 })
    .toFile(output(projectRoot, BRAND_ASSET_SPECS[7].relativePath));

  const socialSeal = await resizeSeal(source, 430).png().toBuffer();
  await sharp(socialBackground)
    .composite([{ input: socialSeal, left: 55, top: 100 }])
    .png({ compressionLevel: 9 })
    .toFile(output(projectRoot, BRAND_ASSET_SPECS[8].relativePath));
}

export async function inspectBrandAssets(projectRoot = DEFAULT_ROOT) {
  const errors = [];
  for (const spec of BRAND_ASSET_SPECS) {
    try {
      const metadata = await sharp(output(projectRoot, spec.relativePath)).metadata();
      if (metadata.width !== spec.width || metadata.height !== spec.height) errors.push(`${spec.relativePath}: dimensions`);
      if (metadata.format !== spec.format) errors.push(`${spec.relativePath}: format`);
      if (Boolean(metadata.hasAlpha) !== spec.alpha) errors.push(`${spec.relativePath}: alpha`);
    } catch {
      errors.push(`${spec.relativePath}: missing`);
    }
  }
  return errors;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  if (process.argv.includes('--write')) await writeBrandAssets();
  const errors = await inspectBrandAssets();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  }
}
```

- [ ] **Step 5: Wire package scripts and prebuild verification**

Update `package.json` scripts:

```json
{
  "assets:branding": "node scripts/build-brand-assets.mjs --write",
  "assets:branding:check": "node scripts/build-brand-assets.mjs",
  "prebuild:frontend": "npm run assets:branding:check && npm run assets:mathjax"
}
```

Keep all existing scripts unchanged except the exact `prebuild:frontend` replacement.

- [ ] **Step 6: Generate assets and run GREEN**

```powershell
npm run assets:branding
npm run assets:branding:check
npm run test:run -- tests/BrandAssets.test.ts
```

Expected: generator check exit 0 and 2/2 tests pass.

- [ ] **Step 7: Review Task 1 without committing**

```powershell
git status --short
git diff --check
```

Expected: only Task 1 files and generated assets are present. The worker reports RED/GREEN evidence to Astra; no commit/push.

---

### Task 2: Switch every UI, favicon, manifest and static SEO reference

**Files:**
- Modify: `src/config/branding.ts`
- Modify: `tests/SchoolLogo.test.tsx`
- Modify: `index.html`
- Modify: `public/site.webmanifest`
- Modify: `tests/BrandAssets.test.ts`
- Delete after reference check: `public/favicon.svg`, `public/assets/branding/school-logo-v1.png`

**Interfaces:**
- Consumes: Task 1 generated assets.
- Produces constants `SEO_LOGO_URL`, `SEO_SOCIAL_IMAGE_URL`, `SEO_SOCIAL_IMAGE_ALT` for Task 3.
- Keeps `SchoolLogoProps` and `SchoolLogoSize` unchanged.

- [ ] **Step 1: Extend RED tests for runtime and static references**

Add these assertions to `tests/SchoolLogo.test.tsx`:

```ts
import {
  PRODUCT_LOGO_FALLBACK_URL,
  SCHOOL_LOGO_URL,
  SEO_LOGO_URL,
  SEO_SOCIAL_IMAGE_ALT,
  SEO_SOCIAL_IMAGE_URL,
} from '../src/config/branding';

expect(SCHOOL_LOGO_URL).toBe('/assets/branding/school-logo-v2.webp');
expect(PRODUCT_LOGO_FALLBACK_URL).toBe('/assets/branding/favicon-48.png');
expect(SEO_LOGO_URL).toBe('https://www.thtohieu.com/assets/branding/school-logo-512.png');
expect(SEO_SOCIAL_IMAGE_URL).toBe('https://www.thtohieu.com/assets/branding/tohieuquiz-social-card-v2.png');
expect(SEO_SOCIAL_IMAGE_ALT).toBe('Huy hiệu Trường Tiểu học Tô Hiệu và TôHiệuQuiz');
```

Add a test in `tests/BrandAssets.test.ts` that reads `index.html` and `public/site.webmanifest`:

```ts
it('references only the versioned brand assets in HTML and the manifest', async () => {
  const html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'public/site.webmanifest'), 'utf8'));
  expect(html).toContain('/assets/branding/favicon-32.png');
  expect(html).toContain('/assets/branding/favicon-48.png');
  expect(html).toContain('/assets/branding/apple-touch-icon.png');
  expect(html).toContain('https://www.thtohieu.com/assets/branding/tohieuquiz-social-card-v2.png');
  expect(html).toContain('https://www.thtohieu.com/assets/branding/school-logo-512.png');
  expect(html).not.toContain('/favicon.svg');
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: '/assets/branding/pwa-icon-192.png', sizes: '192x192', purpose: 'any' }),
    expect.objectContaining({ src: '/assets/branding/pwa-icon-512.png', sizes: '512x512', purpose: 'any' }),
    expect.objectContaining({ src: '/assets/branding/pwa-maskable-512.png', sizes: '512x512', purpose: 'maskable' }),
  ]));
});
```

- [ ] **Step 2: Run RED**

```powershell
npm run test:run -- tests/SchoolLogo.test.tsx tests/BrandAssets.test.ts
```

Expected: failures show old `school-logo-v1.png`, `favicon.svg`, missing absolute SEO constants and one-icon manifest.

- [ ] **Step 3: Centralize approved paths in `src/config/branding.ts`**

Replace duplicated school identity with imports/re-export:

```ts
import { SCHOOL_NAME, SITE_URL } from './schoolIdentity';

export { SCHOOL_NAME };
export const PRODUCT_NAME = 'TôHiệuQuiz';
export const SCHOOL_LOGO_URL = '/assets/branding/school-logo-v2.webp';
export const PRODUCT_LOGO_FALLBACK_URL = '/assets/branding/favicon-48.png';
export const SEO_LOGO_URL = `${SITE_URL}/assets/branding/school-logo-512.png`;
export const SEO_SOCIAL_IMAGE_URL = `${SITE_URL}/assets/branding/tohieuquiz-social-card-v2.png`;
export const SEO_SOCIAL_IMAGE_ALT = 'Huy hiệu Trường Tiểu học Tô Hiệu và TôHiệuQuiz';
```

- [ ] **Step 4: Replace static HTML metadata and icon links**

Update `index.html` to contain:

```html
<meta property="og:image" content="https://www.thtohieu.com/assets/branding/tohieuquiz-social-card-v2.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/png">
<meta property="og:image:alt" content="Huy hiệu Trường Tiểu học Tô Hiệu và TôHiệuQuiz">
<meta name="twitter:image" content="https://www.thtohieu.com/assets/branding/tohieuquiz-social-card-v2.png">
<meta name="twitter:image:alt" content="Huy hiệu Trường Tiểu học Tô Hiệu và TôHiệuQuiz">

<link rel="icon" type="image/png" sizes="32x32" href="/assets/branding/favicon-32.png">
<link rel="icon" type="image/png" sizes="48x48" href="/assets/branding/favicon-48.png">
<link rel="shortcut icon" type="image/png" href="/assets/branding/favicon-48.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/branding/apple-touch-icon.png">
```

Within static JSON-LD:

```json
"logo": "https://www.thtohieu.com/assets/branding/school-logo-512.png",
"image": "https://www.thtohieu.com/assets/branding/tohieuquiz-social-card-v2.png"
```

Apply `logo` to `EducationalOrganization` and `SoftwareApplication`; apply `image` to `WebSite` and `SoftwareApplication`.

- [ ] **Step 5: Expand the web manifest**

Replace `icons` in `public/site.webmanifest`:

```json
"icons": [
  { "src": "/assets/branding/pwa-icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "/assets/branding/pwa-icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "/assets/branding/pwa-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```

- [ ] **Step 6: Remove obsolete assets only after confirming no references**

```powershell
rg -n "favicon\.svg|school-logo-v1\.png" index.html public src tests
```

Expected before deletion: no references. Then remove exactly the two obsolete files with a recoverable repository deletion; do not touch partner logos or icons.

- [ ] **Step 7: Run GREEN and integration tests**

```powershell
npm run test:run -- tests/BrandAssets.test.ts tests/SchoolLogo.test.tsx tests/SchoolBrandingIntegration.test.tsx tests/SchoolBrandingPhase2Integration.test.tsx tests/LandingHeaderUi.test.tsx
```

Expected: all selected tests pass.

- [ ] **Step 8: Astra review Task 2 without committing**

Review exact references, accessibility behavior and asset deletions. Resolve all Critical/Important findings before moving on. No commit/push.

---

### Task 3: Make SPA and competition SEO use the official logo system

**Files:**
- Modify: `src/hooks/useSeo.ts`
- Modify: `src/features/competition/portal/public/useCompetitionPortalSeo.ts`
- Modify: `tests/BrandSeo.test.tsx`
- Modify: `tests/CompetitionPortalSeo.test.tsx`

**Interfaces:**
- Consumes: `SEO_LOGO_URL`, `SEO_SOCIAL_IMAGE_URL`, `SEO_SOCIAL_IMAGE_ALT` from Task 2.
- Produces: route-stable OG/Twitter image metadata and JSON-LD logo/image references.
- Preserves campaign `hero.imageUrl` and article `coverImageUrl` as higher-priority overrides.

- [ ] **Step 1: Write RED route-reset and JSON-LD tests**

Extend `tests/BrandSeo.test.tsx`:

```ts
import { SEO_LOGO_URL, SEO_SOCIAL_IMAGE_URL } from '../src/config/branding';

it('resets default social images and publishes official logo structured data', () => {
  render(<SeoProbe pathname="/about" />);
  expect(document.head.querySelector('meta[property="og:image"]')).toHaveAttribute('content', SEO_SOCIAL_IMAGE_URL);
  expect(document.head.querySelector('meta[name="twitter:image"]')).toHaveAttribute('content', SEO_SOCIAL_IMAGE_URL);
  const jsonLd = JSON.parse(document.getElementById('seo-jsonld')?.textContent || '{}');
  expect(JSON.stringify(jsonLd)).toContain(SEO_LOGO_URL);
  expect(JSON.stringify(jsonLd)).toContain(SEO_SOCIAL_IMAGE_URL);
});
```

Extend `tests/CompetitionPortalSeo.test.tsx` with two contracts:

```ts
it('uses the official social card when a public route has no content image', async () => {
  renderCompetitionRoute('/cuoc-thi');
  await waitFor(() => expect(document.head.querySelector('meta[property="og:image"]'))
    .toHaveAttribute('content', SEO_SOCIAL_IMAGE_URL));
  expect(document.head.querySelector('meta[name="twitter:image"]'))
    .toHaveAttribute('content', SEO_SOCIAL_IMAGE_URL);
});

it('keeps a campaign hero image above the default social card', async () => {
  mockCompetition({ hero: { imageUrl: 'https://cdn.example/campaign.png' } });
  renderCompetitionRoute('/cuoc-thi/toan-tuoi-tho');
  await waitFor(() => expect(document.head.querySelector('meta[property="og:image"]'))
    .toHaveAttribute('content', 'https://cdn.example/campaign.png'));
});
```

Use the existing helpers/mocks in that test file rather than introducing duplicate router setup.

- [ ] **Step 2: Run RED**

```powershell
npm run test:run -- tests/BrandSeo.test.tsx tests/CompetitionPortalSeo.test.tsx
```

Expected: default image and JSON-LD logo assertions fail against current behavior.

- [ ] **Step 3: Update `useSeo` with a stable default image contract**

Import the branding constants and add logo/image fields:

```ts
import {
  SEO_LOGO_URL,
  SEO_SOCIAL_IMAGE_ALT,
  SEO_SOCIAL_IMAGE_URL,
} from '../config/branding';
```

Inside `buildStructuredData`, add:

```ts
const organization = {
  '@type': 'EducationalOrganization',
  name: SCHOOL_NAME,
  alternateName: 'TôHiệuQuiz',
  url: SCHOOL_PROFILE_URL,
  logo: SEO_LOGO_URL,
  image: SEO_SOCIAL_IMAGE_URL,
};
```

Add `logo: SEO_LOGO_URL` to the `WebSite` object, `image: SEO_SOCIAL_IMAGE_URL` to `WebSite` and `WebPage`, and `image: SEO_SOCIAL_IMAGE_URL` to the `Quiz` object while preserving its publisher.

Inside `useSeo` after title/description tags:

```ts
upsertMetaByProperty('og:image', SEO_SOCIAL_IMAGE_URL);
upsertMetaByProperty('og:image:width', '1200');
upsertMetaByProperty('og:image:height', '630');
upsertMetaByProperty('og:image:type', 'image/png');
upsertMetaByProperty('og:image:alt', SEO_SOCIAL_IMAGE_ALT);
upsertMetaByName('twitter:card', 'summary_large_image');
upsertMetaByName('twitter:image', SEO_SOCIAL_IMAGE_URL);
upsertMetaByName('twitter:image:alt', SEO_SOCIAL_IMAGE_ALT);
```

This explicit reset prevents a previous competition hero image leaking into a normal SPA route.

- [ ] **Step 4: Update competition SEO fallback and override behavior**

Import:

```ts
import {
  SEO_SOCIAL_IMAGE_ALT,
  SEO_SOCIAL_IMAGE_URL,
} from '../../../../config/branding';
```

At the start of `applyMetadata`:

```ts
const imageUrl = metadata.imageUrl || SEO_SOCIAL_IMAGE_URL;
const imageAlt = metadata.imageUrl ? metadata.title : SEO_SOCIAL_IMAGE_ALT;
```

Replace conditional removal with unconditional, route-stable tags:

```ts
upsertMetaByName('twitter:card', 'summary_large_image');
upsertMetaByProperty('og:image', imageUrl);
upsertMetaByProperty('og:image:alt', imageAlt);
upsertMetaByName('twitter:image', imageUrl);
upsertMetaByName('twitter:image:alt', imageAlt);
```

Remove `removeMetaByProperty` only if `rg` confirms it has no remaining caller in the file.

- [ ] **Step 5: Run GREEN and private-route regression tests**

```powershell
npm run test:run -- tests/BrandSeo.test.tsx tests/CompetitionPortalSeo.test.tsx tests/ParentPortalSeo.test.tsx
```

Expected: all selected tests pass and robots/noindex behavior remains unchanged.

- [ ] **Step 6: Astra review Task 3 without committing**

Review SPA route transitions, custom campaign override behavior, JSON-LD schema shape and canonical/robots preservation. Resolve all Critical/Important findings. No commit/push.

---

### Task 4: Full verification, approval, delivery and production smoke

**Files:**
- No planned source changes.
- Verification may create ignored build output only.

**Interfaces:**
- Consumes: reviewed uncommitted Tasks 1–3.
- Produces: one approved implementation commit, PR, merged production deployment and visual evidence.

- [ ] **Step 1: Run the complete focused test set**

```powershell
npm run assets:branding:check
npm run test:run -- tests/BrandAssets.test.ts tests/SchoolLogo.test.tsx tests/SchoolBrandingIntegration.test.tsx tests/SchoolBrandingPhase2Integration.test.tsx tests/LandingHeaderUi.test.tsx tests/BrandSeo.test.tsx tests/CompetitionPortalSeo.test.tsx tests/ParentPortalSeo.test.tsx
```

Expected: all files/tests pass with zero failures.

- [ ] **Step 2: Run static verification**

```powershell
npx eslint scripts/build-brand-assets.mjs src/config/branding.ts src/hooks/useSeo.ts src/features/competition/portal/public/useCompetitionPortalSeo.ts tests/BrandAssets.test.ts tests/SchoolLogo.test.tsx tests/BrandSeo.test.tsx tests/CompetitionPortalSeo.test.tsx --max-warnings=0
npx tsc --noEmit
npm run build:frontend
npm run perf:budget
git diff --check
```

Expected: every command exits 0. Security scan is N/A for the image-only/static metadata surface because no input, auth, API, Worker or dependency is added; existing CI security remains required before merge.

- [ ] **Step 3: Browser verification before approval gate**

Run the existing stubbed login and mobile specs:

```powershell
npm run cypress:run:stubbed -- --spec "cypress/e2e/login-home.cy.ts,cypress/e2e/mobile-responsive.cy.ts"
```

Then inspect a production build or Vercel preview at desktop 1366×768 and mobile 390×844:

- Header/login logo is the new seal.
- Wordmark remains readable with 8–10px separation.
- No logo is stretched, clipped or wrapped.
- Favicon is the new seal.
- Manifest icons load with HTTP 200.
- OG image is 1200×630 and visually matches approved Option A.

- [ ] **Step 4: Run GitNexus change detection and final review**

```powershell
node .gitnexus/run.cjs detect_changes --scope compare --base-ref origin/main --repo "C:\Users\Administrator\.codex\worktrees\official-logo-seo\quizpro" --limit 200
git status --short
git diff --stat
```

Expected: only planned brand assets, generator, runtime metadata and tests. Astra performs a final full-diff review and resolves P1/P2 findings.

- [ ] **Step 5: User approval gate before implementation commit**

Present:

- Exact files added/modified/deleted.
- RED/GREEN evidence for all three tasks.
- Asset dimensions and byte sizes.
- Test, lint, typecheck, build, performance and browser evidence.
- Remaining risk: social-platform cache and small-icon legibility.

Do not commit or push until the user explicitly approves.

- [ ] **Step 6: Create one focused implementation commit**

Stage only approved implementation files and run staged checks:

```powershell
git diff --cached --check
git commit -m "feat(brand): adopt official logo across app and SEO"
```

The earlier spec and plan commits remain separate documentation commits.

- [ ] **Step 7: Push and open PR**

Push `codex/official-logo-seo` and open a PR against `main`. PR metadata must include:

- Option A lockup rules.
- Asset matrix.
- UI/PWA/SEO scope.
- LOW GitNexus risk.
- Complete verification evidence.
- No API/Worker/D1/migration changes.
- Rollback by reverting the squash commit.

- [ ] **Step 8: CI, approval and merge**

Wait until every required check is successful and code-owner approval applies to the current PR HEAD. Recheck HEAD immediately before squash merge. Never bypass branch protection.

- [ ] **Step 9: Production verification**

Confirm Vercel Production deployment points to the merge SHA, wait for automated production smoke, then verify read-only:

```text
GET /assets/branding/school-logo-v2.webp                 200 image/webp
GET /assets/branding/favicon-32.png                      200 image/png
GET /assets/branding/apple-touch-icon.png                200 image/png
GET /assets/branding/pwa-icon-192.png                    200 image/png
GET /assets/branding/pwa-icon-512.png                    200 image/png
GET /assets/branding/pwa-maskable-512.png                200 image/png
GET /assets/branding/tohieuquiz-social-card-v2.png       200 image/png
GET /site.webmanifest                                    200 application/manifest+json or JSON-compatible type
```

Inspect production HTML/DOM for favicon, OG/Twitter, JSON-LD and the approved wide/mobile lockups. Capture desktop and mobile screenshots.

- [ ] **Step 10: Cleanup**

- Confirm PR merged and production smoke passed.
- Delete remote feature branch when appropriate.
- Archive the managed worktree with the attached PR identity.
- Do not fast-forward `C:\quizpro\main` while it contains unrelated user changes.
- Report merge SHA, deployment status, screenshots, rollback SHA and cleanup state.

---

## Task Ownership and Review Gates

1. Luna worker: Task 1 only → Astra diff review.
2. Luna worker: Task 2 only → Astra diff review.
3. Luna worker: Task 3 only → Astra diff review.
4. Astra/root: Task 4 verification and approval gate.

Workers must not overlap write scopes, commit, push, open PRs or deploy. Every worker reports exact files, RED/GREEN commands, outputs and blockers.

## Rollback

Revert the final squash merge commit. Because all paths are versioned and there is no database or Worker migration, rollback is a normal frontend revert followed by Vercel redeploy. Social caches may continue showing the `v2` card temporarily, but the site metadata will immediately return to the previous URLs after rollback.
