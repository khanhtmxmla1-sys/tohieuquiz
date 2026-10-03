# Google school favicon fix — revised plan

## Context

PR #185 already established the current school branding pipeline and approved
the following assets:

- `school-logo-512.png` for the official school logo and structured data;
- the 180px Apple touch icon;
- the three PWA manifest icons;
- the 1200×630 social card.

The old plan referred to `school-logo-v1.png`, which is no longer the current
branding source. This revision keeps the PR #185 branding intact and only
changes the public browser favicon URL so Google can discover a new, stable
favicon resource.

## Approved scope

Create `public/favicon-school-v2.png` as a byte-for-byte copy of
`public/assets/branding/school-logo-512.png`. It is a square 512×512 PNG and
therefore satisfies Google's recommendation for a favicon larger than 48px;
Google's hard requirement is a crawlable square favicon, not a 48px minimum.
Extend `scripts/build-brand-assets.mjs` so the normal branding generator and
checker create and validate this alias as part of the asset pipeline.

Update `index.html` to publish exactly these browser icon links:

```html
<link rel="icon" type="image/png" sizes="512x512" href="/favicon-school-v2.png">
<link rel="shortcut icon" type="image/png" href="/favicon-school-v2.png">
```

Keep the existing Apple touch icon, `site.webmanifest`, social metadata,
static JSON-LD logo, `src/config/branding.ts`, and `src/hooks/useSeo.ts`
unchanged. The generated `favicon-32.png` and `favicon-48.png` files remain
available for the existing internal fallback.

## TDD and verification

1. Baseline: SchoolLogo, production-domain, BrandAssets, and BrandSeo tests
   passed (4 files, 19 tests), and `npm run typecheck` passed before edits.
2. Add `tests/FaviconSeo.test.ts`, update the narrow HTML assertion in
   `tests/BrandAssets.test.ts`, and add temporary-fixture tests for the
   branding generator/checker. The fixtures must fail for a missing alias,
   stale valid PNG bytes, and a generator that does not create the alias.
3. Extend `scripts/build-brand-assets.mjs` to generate the alias from the
   generated 512px logo and reject missing, invalid, or stale alias bytes.
   Update the two HTML links and verify the tests pass. The regression tests
   check HTML link attributes, absence of the old public icon references,
   preservation of Apple/PWA/social/static schema metadata, PNG dimensions,
   and SHA-256 byte equality.
4. Run `npm run assets:branding:check`, the focused tests, the full relevant
   branding/SEO tests, typecheck, and production build. Inspect the built
   favicon and HTML before commit.
5. Run GitNexus change detection before commit. Upstream impact for
   `writeBrandAssets` and `inspectBrandAssets` is LOW (one direct caller each,
   no affected execution processes); no Worker contract, database migration,
   or runtime SEO change is in scope.

## Deployment and indexing gate

Do not change Cloudflare/Vercel maintenance behavior as part of this fix. Do
not request Google indexing while the site returns `503` or sends
`X-Robots-Tag: noindex`. After deployment and an intentional reopen, verify
the homepage and `/favicon-school-v2.png` return `200`, the favicon is served
as `image/png`, no homepage `noindex` header or HTML robots meta remains,
`robots.txt` permits Googlebot and Googlebot-Image to crawl the homepage and
favicon, and the HTML points to the new URL. Only then request indexing in
Search Console, and keep this URL stable while Google refreshes its cached
favicon.

## Files in this change

- `index.html`
- `public/favicon-school-v2.png`
- `tests/FaviconSeo.test.ts`
- `tests/BrandAssets.test.ts`
- `scripts/build-brand-assets.mjs`
- `docs/seo/google-favicon-rollout.md`
- `docs/superpowers/plans/2026-10-03-google-school-favicon-fix.md`
