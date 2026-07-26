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

```text
cert-backgrounds/tohieuquiz-2026/classic-red-navy.webp
cert-backgrounds/tohieuquiz-2026/modern-color.webp
cert-backgrounds/tohieuquiz-2026/formal-blue.webp
cert-backgrounds/tohieuquiz-2026/kids-learning.webp
cert-backgrounds/tohieuquiz-2026/geometric-navy-orange.webp
```

The certificate bucket must remain private. Generated certificates are served
through authenticated API routes rather than a public R2 domain.
