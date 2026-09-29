# Brand SEO V1 Rollout

## Before deploy
- [ ] Confirm owner-approved relationship wording between TôHiệuQuiz and Trường Tiểu học Tô Hiệu.
- [ ] Confirm school identity: Trường Tiểu học Tô Hiệu.
- [ ] Confirm locality: Phường Tô Hiệu, tỉnh Sơn La.
- [ ] Confirm identifier: H52.101.114.
- [ ] Confirm official email: thtohieu.tohieu@sonla.gov.vn.
- [ ] Confirm quiz routes remain noindex and absent from sitemap.

## Production smoke
- [ ] GET https://www.thtohieu.com/ returns 200.
- [ ] GET https://www.thtohieu.com/truong-tieu-hoc-to-hieu-son-la returns 200.
- [ ] GET https://www.thtohieu.com/about returns 200.
- [ ] GET https://www.thtohieu.com/contact returns 200.
- [ ] GET https://www.thtohieu.com/sitemap.xml contains the school profile URL.
- [ ] sitemap.xml contains no quizId URL.
- [ ] View page source for home/profile shows brand title and description before JavaScript hydration.
- [ ] Runtime head has exactly one canonical link.

## Google Search Console
- [ ] Use Domain property for thtohieu.com if DNS access is available; otherwise use URL-prefix https://www.thtohieu.com/.
- [ ] Submit https://www.thtohieu.com/sitemap.xml.
- [ ] URL Inspection: request indexing for /.
- [ ] URL Inspection: request indexing for /truong-tieu-hoc-to-hieu-son-la.
- [ ] URL Inspection: request indexing for /about.
- [ ] URL Inspection: request indexing for /contact.

## Search checks
Record date and result position without treating it as a guaranteed KPI:
- Trường Tiểu học Tô Hiệu Sơn La
- Tiểu học Tô Hiệu Sơn La
- TôHiệuQuiz
- Trường Tô Hiệu Sơn La
- Tiểu học Tô Hiệu

## 2–8 week review
- [ ] Search Console > Performance: filter queries containing "tô hiệu".
- [ ] Record impressions, clicks, CTR, average position and landing page.
- [ ] Search Console > Pages: verify the four brand URLs are indexed.
- [ ] Do not create mass pages to react to short-term ranking movement.
- [ ] If the exact school-name query still resolves mainly to another same-name school, strengthen verified local/entity signals before expanding content.
