# Google favicon rollout

## What changed

The public favicon now uses the current school seal from
`public/assets/branding/school-logo-512.png`. The deployed file is
`/favicon-school-v2.png`, copied byte-for-byte at 512×512 PNG resolution.

The URL is intentionally versioned and stable. The HTML `icon` and `shortcut
icon` links point to it, while the Apple touch icon, manifest icons, social
card, and JSON-LD school logo remain on their approved current assets. The
existing generated `favicon-32.png` and `favicon-48.png` files remain available
for internal fallback code and are not removed in this rollout.

## Deployment checklist

1. Run `npm run assets:branding:check`, the focused favicon/brand tests,
   typecheck, and production build. The branding check verifies the favicon
   alias is present, valid 512×512 PNG, and byte-identical to the approved
   school logo.
2. Obtain required human/reviewer approval and confirm required CI checks pass
   before merging the pull request into `main`.
3. Allow Vercel to deploy the approved merged commit.
4. Keep the existing maintenance mode unchanged during deployment. This
   change does not disable maintenance, alter headers, or request indexing.

## Reopen gate before Google indexing

Only after the site is intentionally reopened, verify all of the following:

```text
https://www.thtohieu.com/                         -> 200 OK
https://www.thtohieu.com/favicon-school-v2.png    -> 200 OK
                                                  -> Content-Type: image/png
homepage response                                 -> no X-Robots-Tag: noindex
homepage HTML                                     -> /favicon-school-v2.png
homepage HTML robots meta                         -> no noindex
robots.txt for Googlebot                          -> homepage/favicons crawlable
robots.txt for Googlebot-Image                    -> favicon crawlable
site.webmanifest                                  -> all three current PWA icons
```

When those checks pass, use Google Search Console → URL Inspection → Test
Live URL → Request Indexing for the homepage. Do not change the favicon URL
again while Google is recrawling it; Google may keep a previously discovered
favicon cached for some time.

Google's favicon guidance requires a crawlable homepage and favicon, a stable
URL, and a square image; Google recommends an image larger than 48px. See the
[Google favicon documentation](https://developers.google.com/search/docs/appearance/favicon-in-search)
for the current crawler and eligibility requirements.
