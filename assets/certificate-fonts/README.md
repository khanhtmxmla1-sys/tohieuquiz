# Certificate rendering assets

The certificate consumer reads all rendering assets from the private
`tohieuquiz-certificates` R2 bucket. A fresh environment must provision every
object below; it must not rely on assets from another Cloudflare account.

## Required font objects

```text
fonts/Roboto-Regular.ttf
fonts/Roboto-Bold.ttf
fonts/Spectral-Regular.ttf
fonts/Spectral-Bold.ttf
fonts/Spectral-BoldItalic.ttf
fonts/DancingScript-Bold.ttf
fonts/GreatVibes-Regular.ttf
fonts/PlaywriteVN-Regular.ttf
fonts/Allura-Regular.ttf
fonts/AlexBrush-Regular.ttf
```

The font loader accepts TrueType and OpenType data. The Dancing Script Bold
source is an OpenType font stored under the stable R2 key expected by the
runtime.

Sources:

- Roboto: official `googlefonts/roboto` repository.
- Spectral, Great Vibes, Playwrite Việt Nam, Allura and Alex Brush: official
  `google/fonts` repository.
- Dancing Script: official `impallari/DancingScript` upstream repository.

The fonts are distributed under their upstream open-font licenses. Preserve
the upstream license terms when refreshing any binary.

## Required certificate backgrounds

The renderer uses PNG source artwork because the Worker-side Resvg pipeline
does not decode embedded WebP images. WebP copies remain available as compact
thumbnails for the template picker.

```text
cert-backgrounds/tohieuquiz-2026/classic-red-navy.png
cert-backgrounds/tohieuquiz-2026/modern-color.png
cert-backgrounds/tohieuquiz-2026/formal-blue.png
cert-backgrounds/tohieuquiz-2026/kids-learning.png
cert-backgrounds/tohieuquiz-2026/geometric-navy-orange.png
cert-backgrounds/tohieuquiz-2026/classic-red-navy.webp
cert-backgrounds/tohieuquiz-2026/modern-color.webp
cert-backgrounds/tohieuquiz-2026/formal-blue.webp
cert-backgrounds/tohieuquiz-2026/kids-learning.webp
cert-backgrounds/tohieuquiz-2026/geometric-navy-orange.webp
```

The certificate bucket must remain private. Generated certificates are served
through authenticated API routes rather than a public R2 domain.

## Provisioning order

To avoid switching templates to keys that do not exist yet, release these
assets in this order:

1. Upload all five PNG files above to the private `tohieuquiz-certificates` R2 bucket.
2. Deploy the API and certificate consumer with the background-format guard.
3. Apply D1 migration `0055_certificate_render_backgrounds_png.sql`.
4. Render a test certificate and verify the generated PNG contains the selected artwork.

Certificates generated before this migration are immutable PNG objects. Any
previously generated blank certificates must be explicitly re-rendered after
the rollout; changing the template key does not rewrite existing objects.

## Ten generated blank-artwork templates

These PNG objects are used for both certificate rendering and template-picker
thumbnails. Each background contains decoration only; all certificate text is
rendered dynamically from `fields_config`.

```text
cert-backgrounds/tohieuquiz-2026/generated-10/01-ornate-red-navy.png
cert-backgrounds/tohieuquiz-2026/generated-10/02-geometric-blue-gold.png
cert-backgrounds/tohieuquiz-2026/generated-10/03-formal-blue-administrative.png
cert-backgrounds/tohieuquiz-2026/generated-10/04-cheerful-school.png
cert-backgrounds/tohieuquiz-2026/generated-10/05-geometric-navy-orange.png
cert-backgrounds/tohieuquiz-2026/generated-10/06-botanical-green-gold.png
cert-backgrounds/tohieuquiz-2026/generated-10/07-purple-gold-ornate.png
cert-backgrounds/tohieuquiz-2026/generated-10/08-soft-pastel-learning.png
cert-backgrounds/tohieuquiz-2026/generated-10/09-premium-gold-cream.png
cert-backgrounds/tohieuquiz-2026/generated-10/10-festive-academic-blue-gold.png
```
