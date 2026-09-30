# Tô Hiệu Brand SEO V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm cho `https://www.thtohieu.com` gửi tín hiệu nhất quán tới Google rằng TôHiệuQuiz gắn với **Trường Tiểu học Tô Hiệu, phường Tô Hiệu, tỉnh Sơn La**, ưu tiên các truy vấn thương hiệu như “Trường Tiểu học Tô Hiệu Sơn La”, “Tiểu học Tô Hiệu Sơn La”, “TôHiệuQuiz”, đồng thời giữ toàn bộ quiz theo ID ngoài phạm vi index.

**Architecture:** Tạo một nguồn dữ liệu thương hiệu trường dùng chung, bổ sung một landing page công khai có URL tĩnh, cập nhật metadata/JSON-LD của trang chủ + About + Contact + landing page, tăng internal link ở header/footer và thêm đúng URL thương hiệu vào sitemap. Không thay đổi luồng đăng nhập, quyền quiz, API quiz hay dữ liệu học sinh. Quiz theo `quizId` bị loại khỏi sitemap và gắn `noindex` để Brand SEO không làm tăng bề mặt lộ đề.

**Tech Stack:** React 18, TypeScript, React Router, Vite, Vitest, Testing Library, Node.js sitemap generator.

## Global Constraints

- Từ khóa/nhận diện chính: **Trường Tiểu học Tô Hiệu**, **Tiểu học Tô Hiệu**, **Sơn La**, **TôHiệuQuiz**.
- Canonical production host: `https://www.thtohieu.com`.
- URL landing thương hiệu: `/truong-tieu-hoc-to-hieu-son-la`.
- Tên đơn vị dùng thống nhất: `Trường Tiểu học Tô Hiệu`.
- Địa bàn dùng thống nhất theo dữ liệu mở Sơn La cập nhật 19/09/2026: `Phường Tô Hiệu, tỉnh Sơn La`.
- Mã định danh cơ quan dùng cho structured data: `H52.101.114`.
- Email cơ quan công khai theo dữ liệu mở tỉnh Sơn La: `thtohieu.tohieu@sonla.gov.vn`.
- Không ghi số điện thoại hỗ trợ TôHiệuQuiz thành số điện thoại chính thức của trường nếu chưa có nguồn chính thức xác nhận.
- Giữ `tongminhkhanh@gmail.com` và `0326439774` là kênh hỗ trợ nền tảng hiện hữu; không đưa hai giá trị này vào schema của trường.
- Không index quiz ID, đề yêu cầu mã, dashboard giáo viên/học sinh/phụ huynh, kết quả học sinh hoặc dữ liệu cá nhân.
- Không đưa câu hỏi/đáp án quiz vào landing page SEO.
- Không tạo blog, không sinh hàng trăm URL, không thêm dependency SEO mới trong V1.
- Không cam kết thứ hạng số 1; success criterion kỹ thuật là crawl/index đúng và tín hiệu thương hiệu nhất quán.
- Khi triển khai, **không sửa trực tiếp working tree `main` đang bẩn**. Tạo isolated worktree bằng skill `superpowers:using-git-worktrees`.
- Không `reset`, `clean`, overwrite hoặc gom các thay đổi đang có trên `main`.
- Nguồn xác minh trường:
  - `https://data.sonla.gov.vn/detail_data/du-lieu-ve-truong-tieu-hoc`
  - `https://data.sonla.gov.vn/detail_data/ma-dinh-danh-cac-truong-tieu-hoc-tren-dia-ban-tinh-nam-2026`

---

## File Map

### Create

- `src/config/schoolIdentity.ts` — nguồn sự thật duy nhất cho tên trường, địa phương, mã định danh, email cơ quan, URL thương hiệu và brand line.
- `src/components/schoolPage/SchoolProfilePage.tsx` — landing page SEO công khai cho trường.
- `tests/BrandSeo.test.tsx` — contract metadata/canonical/JSON-LD/noindex quiz.
- `docs/seo/brand-seo-v1-rollout.md` — checklist Search Console và kiểm tra sau deploy.

### Modify

- `index.html` — initial HTML title/description/OpenGraph/JSON-LD hướng về thương hiệu trường + TôHiệuQuiz.
- `src/hooks/useSeo.ts` — metadata theo route, structured data của trường, `noindex` quiz.
- `src/app/routeTypes.ts` — thêm route landing trường.
- `src/app/lazyViews.ts` — lazy-load landing trường.
- `src/app/AppRoutes.tsx` — wire route công khai.
- `src/components/schoolPage/PublicPageHeader.tsx` — thêm “Nhà trường” vào navigation.
- `src/components/common/Footer.tsx` — internal link + brand line địa phương.
- `src/components/schoolPage/AboutPage.tsx` — tăng tín hiệu thương hiệu trường trong H1/copy nhưng giữ cấu trúc giao diện.
- `src/components/schoolPage/ContactPage.tsx` — phân biệt thông tin nhận diện trường với kênh hỗ trợ TôHiệuQuiz.
- `scripts/generate_sitemap.cjs` — thêm landing trường, loại quizId khỏi sitemap Brand SEO V1.
- `public/sitemap.xml` — regenerate sau khi generator pass.
- `tests/PublicSchoolPages.test.tsx` — contract nội dung/route công khai.
- `tests/generateSitemap.test.ts` — contract sitemap có landing trường và không có quiz ID.
- `tests/productionDomainConfig.test.ts` — giữ contract production domain + brand page.
- Nếu routing test hiện hữu phù hợp hơn sau khi inspect tại execution time, mở rộng test đó thay vì tạo test route trùng chức năng.

---

### Task 1: Tạo nguồn dữ liệu nhận diện trường dùng chung

**Files:**
- Create: `src/config/schoolIdentity.ts`
- Create: `tests/BrandSeo.test.tsx`

**Interfaces:**
- Produces:
  - `SCHOOL_NAME: string`
  - `SCHOOL_SHORT_NAME: string`
  - `SCHOOL_LOCALITY: string`
  - `SCHOOL_REGION: string`
  - `SCHOOL_LOCATION_LABEL: string`
  - `SCHOOL_IDENTIFIER: string`
  - `SCHOOL_OFFICIAL_EMAIL: string`
  - `SCHOOL_PROFILE_PATH: '/truong-tieu-hoc-to-hieu-son-la'`
  - `SITE_URL: 'https://www.thtohieu.com'`
  - `BRAND_RELATIONSHIP_LINE: string`

- [ ] **Step 1: Write the identity contract test**

Add to `tests/BrandSeo.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  BRAND_RELATIONSHIP_LINE,
  SCHOOL_IDENTIFIER,
  SCHOOL_LOCATION_LABEL,
  SCHOOL_NAME,
  SCHOOL_OFFICIAL_EMAIL,
  SCHOOL_PROFILE_PATH,
  SITE_URL,
} from '../src/config/schoolIdentity';

describe('Tô Hiệu brand SEO identity', () => {
  it('keeps one canonical school identity', () => {
    expect(SCHOOL_NAME).toBe('Trường Tiểu học Tô Hiệu');
    expect(SCHOOL_LOCATION_LABEL).toBe('Phường Tô Hiệu, tỉnh Sơn La');
    expect(SCHOOL_IDENTIFIER).toBe('H52.101.114');
    expect(SCHOOL_OFFICIAL_EMAIL).toBe('thtohieu.tohieu@sonla.gov.vn');
    expect(SCHOOL_PROFILE_PATH).toBe('/truong-tieu-hoc-to-hieu-son-la');
    expect(SITE_URL).toBe('https://www.thtohieu.com');
    expect(BRAND_RELATIONSHIP_LINE).toContain('Trường Tiểu học Tô Hiệu');
    expect(BRAND_RELATIONSHIP_LINE).toContain('Sơn La');
  });
});
```

Remove the unused `React` / `render` imports if the file does not yet contain UI probes at this task boundary; Task 2 will add them.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm run test:run -- tests/BrandSeo.test.tsx
```

Expected: FAIL because `src/config/schoolIdentity.ts` does not exist.

- [ ] **Step 3: Implement the identity module**

Create `src/config/schoolIdentity.ts`:

```ts
export const SITE_URL = 'https://www.thtohieu.com' as const;
export const SCHOOL_NAME = 'Trường Tiểu học Tô Hiệu' as const;
export const SCHOOL_SHORT_NAME = 'Tiểu học Tô Hiệu' as const;
export const SCHOOL_LOCALITY = 'Phường Tô Hiệu' as const;
export const SCHOOL_REGION = 'Sơn La' as const;
export const SCHOOL_LOCATION_LABEL = 'Phường Tô Hiệu, tỉnh Sơn La' as const;
export const SCHOOL_IDENTIFIER = 'H52.101.114' as const;
export const SCHOOL_OFFICIAL_EMAIL = 'thtohieu.tohieu@sonla.gov.vn' as const;
export const SCHOOL_PROFILE_PATH = '/truong-tieu-hoc-to-hieu-son-la' as const;
export const BRAND_RELATIONSHIP_LINE =
  'TôHiệuQuiz – Nền tảng học tập trực tuyến của Trường Tiểu học Tô Hiệu, Sơn La' as const;
```

Release guard: trước khi merge production, owner phải xác nhận câu `BRAND_RELATIONSHIP_LINE` đúng về quan hệ chính thức giữa TôHiệuQuiz và trường. Nếu không được phép dùng “của”, thay đúng một lần trong module này bằng câu đã được phê duyệt; các nơi khác không hard-code lại.

- [ ] **Step 4: Run test GREEN**

Run:

```bash
npm run test:run -- tests/BrandSeo.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/schoolIdentity.ts tests/BrandSeo.test.tsx
git commit -m "feat: add canonical school brand identity"
```

---

### Task 2: Chuẩn hóa metadata trang chủ và route thương hiệu, khóa quiz khỏi index

**Files:**
- Modify: `src/hooks/useSeo.ts`
- Modify: `index.html`
- Modify: `tests/BrandSeo.test.tsx`

**Interfaces:**
- Consumes: constants từ `src/config/schoolIdentity.ts`.
- Produces: title/description/canonical/robots/JSON-LD theo pathname; quiz detail luôn `noindex, nofollow, noarchive`.

- [ ] **Step 1: Add metadata probes**

Extend `tests/BrandSeo.test.tsx`:

```tsx
import { act, render } from '@testing-library/react';
import { useSeo } from '../src/hooks/useSeo';

const SeoProbe = ({ pathname, view = 'home', selectedQuiz = null }: {
  pathname: string;
  view?: string;
  selectedQuiz?: any;
}) => {
  useSeo(pathname, view, selectedQuiz, false);
  return null;
};

const canonicalHref = () =>
  document.head.querySelector('link[rel="canonical"]')?.getAttribute('href');

it('brands the home page for Trường Tiểu học Tô Hiệu Sơn La', () => {
  render(<SeoProbe pathname="/" />);
  expect(document.title).toBe('Trường Tiểu học Tô Hiệu Sơn La | TôHiệuQuiz');
  expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content'))
    .toContain('Trường Tiểu học Tô Hiệu');
  expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content'))
    .toContain('Sơn La');
  expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  expect(canonicalHref()).toBe(`${window.location.origin}/`);
});

it('publishes dedicated metadata for the school profile route', () => {
  render(<SeoProbe pathname="/truong-tieu-hoc-to-hieu-son-la" />);
  expect(document.title).toBe('Trường Tiểu học Tô Hiệu Sơn La | Giới thiệu chính thức');
  expect(canonicalHref()).toBe(
    `${window.location.origin}/truong-tieu-hoc-to-hieu-son-la`,
  );
  const jsonLd = JSON.parse(document.getElementById('seo-jsonld')?.textContent || '{}');
  expect(JSON.stringify(jsonLd)).toContain('Trường Tiểu học Tô Hiệu');
  expect(JSON.stringify(jsonLd)).toContain('H52.101.114');
  expect(JSON.stringify(jsonLd)).toContain('thtohieu.tohieu@sonla.gov.vn');
});

it('never indexes a quiz-id view', () => {
  const quiz = {
    id: 'private-quiz-1',
    title: 'Đề nội bộ',
    classLevel: '3',
    category: 'toan',
    questions: [],
  };
  render(<SeoProbe pathname="/" view="student" selectedQuiz={quiz} />);
  expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, nofollow, noarchive',
  );
});
```

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- tests/BrandSeo.test.tsx
```

Expected: home/profile title assertions fail; quiz robots assertion fails.

- [ ] **Step 3: Implement route-specific SEO in `useSeo.ts`**

Import the identity constants and change the defaults:

```ts
import {
  BRAND_RELATIONSHIP_LINE,
  SCHOOL_IDENTIFIER,
  SCHOOL_LOCATION_LABEL,
  SCHOOL_NAME,
  SCHOOL_OFFICIAL_EMAIL,
  SCHOOL_PROFILE_PATH,
  SITE_URL,
} from '../config/schoolIdentity';

const DEFAULT_TITLE = 'Trường Tiểu học Tô Hiệu Sơn La | TôHiệuQuiz';
const DEFAULT_DESCRIPTION =
  'TôHiệuQuiz là nền tảng học tập trực tuyến gắn với Trường Tiểu học Tô Hiệu, phường Tô Hiệu, tỉnh Sơn La.';
const DEFAULT_KEYWORDS =
  'Trường Tiểu học Tô Hiệu, Tiểu học Tô Hiệu Sơn La, Tô Hiệu Sơn La, TôHiệuQuiz';
```

Add the school profile route before generic public pages:

```ts
if (pathname === SCHOOL_PROFILE_PATH) {
  title = 'Trường Tiểu học Tô Hiệu Sơn La | Giới thiệu chính thức';
  description =
    'Thông tin nhận diện Trường Tiểu học Tô Hiệu, phường Tô Hiệu, tỉnh Sơn La và nền tảng học tập TôHiệuQuiz.';
  keywords =
    'Trường Tiểu học Tô Hiệu Sơn La, Tiểu học Tô Hiệu, Tô Hiệu Sơn La, TôHiệuQuiz';
} else if (pathname === '/about') {
  title = 'Giới thiệu Trường Tiểu học Tô Hiệu Sơn La | TôHiệuQuiz';
  description =
    'Giới thiệu hoạt động giáo dục và nền tảng học tập TôHiệuQuiz của Trường Tiểu học Tô Hiệu, Sơn La.';
} else if (pathname === '/contact') {
  title = 'Liên hệ Trường Tiểu học Tô Hiệu Sơn La | TôHiệuQuiz';
  description =
    'Thông tin liên hệ và các kênh hỗ trợ liên quan đến Trường Tiểu học Tô Hiệu, Sơn La và TôHiệuQuiz.';
}
```

Change the selected quiz branch so it never becomes indexable:

```ts
} else if (view === 'student' && selectedQuiz) {
  title = `${selectedQuiz.title} - TôHiệuQuiz`;
  description = `Luyện tập bài thi ${selectedQuiz.title} trên hệ thống TôHiệuQuiz.`;
  robots = 'noindex, nofollow, noarchive';
```

Replace the organization payload in `buildStructuredData` with a school entity:

```ts
const school = {
  '@type': 'EducationalOrganization',
  '@id': `${SITE_URL}/#school`,
  name: SCHOOL_NAME,
  identifier: SCHOOL_IDENTIFIER,
  email: SCHOOL_OFFICIAL_EMAIL,
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Phường Tô Hiệu',
    addressRegion: 'Sơn La',
    addressCountry: 'VN',
  },
  url: `${SITE_URL}/truong-tieu-hoc-to-hieu-son-la`,
};
```

For non-quiz public pages, emit `WebSite + EducationalOrganization + WebPage + SoftwareApplication`; the software node must reference the school with `provider: { '@id': `${SITE_URL}/#school` }`. Do not put support phone/Gmail into `school`.

For quiz pages, structured data may describe the quiz only for runtime UX, but because robots are `noindex`, do not add school-sensitive or student-sensitive fields.

- [ ] **Step 4: Update initial `index.html` metadata**

Set the static shell to the same brand contract:

```html
<title>Trường Tiểu học Tô Hiệu Sơn La | TôHiệuQuiz</title>
<meta name="title" content="Trường Tiểu học Tô Hiệu Sơn La | TôHiệuQuiz">
<meta name="description"
  content="TôHiệuQuiz là nền tảng học tập trực tuyến gắn với Trường Tiểu học Tô Hiệu, phường Tô Hiệu, tỉnh Sơn La.">
<meta name="keywords"
  content="Trường Tiểu học Tô Hiệu, Tiểu học Tô Hiệu Sơn La, Tô Hiệu Sơn La, TôHiệuQuiz">
```

Update OG/Twitter title + description to the same entity wording. Replace the initial JSON-LD with an `@graph` containing `WebSite`, `EducationalOrganization`, and `SoftwareApplication` using the same name/location/identifier and production host.

- [ ] **Step 5: Run focused tests**

```bash
npm run test:run -- tests/BrandSeo.test.tsx tests/productionDomainConfig.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add index.html src/hooks/useSeo.ts tests/BrandSeo.test.tsx tests/productionDomainConfig.test.ts
git commit -m "feat: align public metadata with school brand"
```

---

### Task 3: Tạo landing page `/truong-tieu-hoc-to-hieu-son-la`

**Files:**
- Create: `src/components/schoolPage/SchoolProfilePage.tsx`
- Modify: `src/app/routeTypes.ts`
- Modify: `src/app/lazyViews.ts`
- Modify: `src/app/AppRoutes.tsx`
- Modify: `src/components/schoolPage/PublicPageHeader.tsx`
- Modify: `tests/PublicSchoolPages.test.tsx`

**Interfaces:**
- Consumes: school identity constants.
- Produces: one crawlable public route with exactly one H1 and internal links to About/Contact.

- [ ] **Step 1: Write failing public-page test**

Add to `tests/PublicSchoolPages.test.tsx`:

```tsx
import SchoolProfilePage from '../src/components/schoolPage/SchoolProfilePage';

it('renders the school profile with canonical local brand facts', () => {
  const { container } = renderPage(
    <SchoolProfilePage />,
    '/truong-tieu-hoc-to-hieu-son-la',
  );

  expect(
    screen.getByRole('heading', {
      level: 1,
      name: 'Trường Tiểu học Tô Hiệu – Sơn La',
    }),
  ).toBeVisible();
  expect(container.textContent).toContain('Phường Tô Hiệu, tỉnh Sơn La');
  expect(container.textContent).toContain('H52.101.114');
  expect(container.textContent).toContain('TôHiệuQuiz');
  expect(screen.getByRole('button', { name: 'Nhà trường' }))
    .toHaveAttribute('aria-current', 'page');
});
```

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- tests/PublicSchoolPages.test.tsx
```

Expected: FAIL because `SchoolProfilePage` and the public-page key do not exist.

- [ ] **Step 3: Add the route contract**

Update `src/app/routeTypes.ts`:

```ts
export type RoutePath =
  | '/'
  | '/truong-tieu-hoc-to-hieu-son-la'
  | '/about'
  | '/contact'
  | '/privacy'
  | '/tos'
  | `/teacher/${string}`
  | `/student/${string}`;
```

Update `src/app/lazyViews.ts`:

```ts
export const SchoolProfilePage = React.lazy(
  () => import('../components/schoolPage/SchoolProfilePage'),
);
```

Import `SchoolProfilePage` in `AppRoutes.tsx` and add:

```tsx
<Route
  path="/truong-tieu-hoc-to-hieu-son-la"
  element={suspended(
    <PublicPageLayout onNavigate={onNavigate}>
      <SchoolProfilePage />
    </PublicPageLayout>,
  )}
/>
```

- [ ] **Step 4: Add “Nhà trường” to the public header**

In `PublicPageHeader.tsx`:

```ts
type PublicPage = 'school' | 'about' | 'contact' | 'privacy' | 'tos';

const navItems = [
  { label: 'Trang chủ', path: '/', key: 'home' },
  { label: 'Nhà trường', path: '/truong-tieu-hoc-to-hieu-son-la', key: 'school' },
  { label: 'Cổng liên lạc phụ huynh', path: 'https://phuhuynh.thtohieu.com/', key: 'parent-portal', external: true },
  { label: 'Giới thiệu', path: '/about', key: 'about' },
  { label: 'Liên hệ', path: '/contact', key: 'contact' },
] as const;
```

- [ ] **Step 5: Implement the landing page**

Create `SchoolProfilePage.tsx` with this content hierarchy:

```tsx
import React from 'react';
import { Building2, GraduationCap, MapPin, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router';
import {
  BRAND_RELATIONSHIP_LINE,
  SCHOOL_IDENTIFIER,
  SCHOOL_LOCATION_LABEL,
  SCHOOL_NAME,
  SCHOOL_OFFICIAL_EMAIL,
} from '../../config/schoolIdentity';
import PublicPageHeader from './PublicPageHeader';

const SchoolProfilePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F7F9FF] font-['Be_Vietnam_Pro'] text-slate-800">
      <PublicPageHeader activePage="school" />
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-16">
        <section className="rounded-[32px] border border-blue-100 bg-white p-7 shadow-[0_20px_60px_rgba(30,64,175,0.08)] md:p-12">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-600">
            Giáo dục tiểu học · Sơn La
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.03em] text-[#172554] md:text-5xl">
            Trường Tiểu học Tô Hiệu – Sơn La
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">
            {SCHOOL_NAME} là cơ sở giáo dục công lập thuộc {SCHOOL_LOCATION_LABEL}.
            Trang này cung cấp thông tin nhận diện thống nhất của nhà trường và mối liên hệ
            với nền tảng học tập TôHiệuQuiz.
          </p>

          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-blue-50 p-5">
              <dt className="font-bold text-blue-900">Đơn vị</dt>
              <dd className="mt-1 text-slate-700">{SCHOOL_NAME}</dd>
            </div>
            <div className="rounded-2xl bg-blue-50 p-5">
              <dt className="font-bold text-blue-900">Địa bàn</dt>
              <dd className="mt-1 text-slate-700">{SCHOOL_LOCATION_LABEL}</dd>
            </div>
            <div className="rounded-2xl bg-blue-50 p-5">
              <dt className="font-bold text-blue-900">Mã định danh</dt>
              <dd className="mt-1 text-slate-700">{SCHOOL_IDENTIFIER}</dd>
            </div>
            <div className="rounded-2xl bg-blue-50 p-5">
              <dt className="font-bold text-blue-900">Email cơ quan</dt>
              <dd className="mt-1 text-slate-700">{SCHOOL_OFFICIAL_EMAIL}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-8 rounded-[28px] border border-blue-100 bg-white p-7 md:p-10">
          <h2 className="text-2xl font-extrabold text-[#172554]">TôHiệuQuiz và hoạt động học tập số</h2>
          <p className="mt-4 max-w-3xl leading-7 text-slate-600">{BRAND_RELATIONSHIP_LINE}.</p>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            Nội dung quiz theo mã đề hoặc tài khoản học sinh không được công khai cho công cụ tìm kiếm.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => navigate('/about')} className="min-h-11 rounded-xl bg-blue-600 px-5 font-bold text-white">
              Giới thiệu TôHiệuQuiz
            </button>
            <button type="button" onClick={() => navigate('/contact')} className="min-h-11 rounded-xl border border-blue-200 px-5 font-bold text-blue-700">
              Liên hệ
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SchoolProfilePage;
```

The imported icons are optional only if used in the final markup; remove unused imports to keep lint green.

- [ ] **Step 6: Run focused tests**

```bash
npm run test:run -- tests/PublicSchoolPages.test.tsx tests/BrandSeo.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/schoolPage/SchoolProfilePage.tsx src/components/schoolPage/PublicPageHeader.tsx src/app/routeTypes.ts src/app/lazyViews.ts src/app/AppRoutes.tsx tests/PublicSchoolPages.test.tsx
git commit -m "feat: add Tô Hiệu school brand landing page"
```

---

### Task 4: Tăng tín hiệu thương hiệu trong About, Contact và Footer

**Files:**
- Modify: `src/components/schoolPage/AboutPage.tsx`
- Modify: `src/components/schoolPage/ContactPage.tsx`
- Modify: `src/components/common/Footer.tsx`
- Modify: `tests/PublicSchoolPages.test.tsx`

**Interfaces:**
- Consumes: `schoolIdentity.ts`.
- Produces: internal links và copy thương hiệu nhất quán trên mọi trang công khai.

- [ ] **Step 1: Write failing content/link assertions**

Add:

```tsx
it('connects About and Contact to the Sơn La school identity', () => {
  const about = renderPage(<AboutPage />, '/about');
  expect(about.container.textContent).toContain('Trường Tiểu học Tô Hiệu');
  expect(about.container.textContent).toContain('Sơn La');
  about.unmount();

  const contact = renderPage(<ContactPage />, '/contact');
  expect(contact.container.textContent).toContain('Trường Tiểu học Tô Hiệu');
  expect(contact.container.textContent).toContain('Phường Tô Hiệu');
});
```

For Footer, add a focused render if no existing footer test already covers it:

```tsx
import Footer from '../src/components/common/Footer';

it('links the public footer to the school profile', () => {
  const onNavigate = vi.fn();
  render(<MemoryRouter><Footer onNavigate={onNavigate} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Nhà trường' }));
  expect(onNavigate).toHaveBeenCalledWith('/truong-tieu-hoc-to-hieu-son-la');
  expect(screen.getByText(/Trường Tiểu học Tô Hiệu/)).toBeVisible();
});
```

Add `vi` to the Vitest import.

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- tests/PublicSchoolPages.test.tsx
```

Expected: FAIL on missing school copy/footer route.

- [ ] **Step 3: Update About**

Do not rewrite the whole page. Change the hero identity so the first visible section includes:
- badge: `Trường Tiểu học Tô Hiệu · Sơn La`
- H1: `Trường Tiểu học Tô Hiệu – học vui hơn, dạy nhẹ nhàng hơn.`
- intro contains `TôHiệuQuiz` and `Sơn La`.

Keep the capability/audience sections unchanged unless necessary for grammar.

- [ ] **Step 4: Update Contact**

Add a clear school identity block separate from platform support:

```tsx
<div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
  <p className="font-extrabold text-[#172554]">{SCHOOL_NAME}</p>
  <p className="mt-1 text-sm text-slate-600">{SCHOOL_LOCATION_LABEL}</p>
  <p className="mt-1 text-sm text-slate-600">
    Mã định danh: {SCHOOL_IDENTIFIER}
  </p>
  <a href={`mailto:${SCHOOL_OFFICIAL_EMAIL}`} className="mt-2 inline-flex text-sm font-bold text-blue-700">
    {SCHOOL_OFFICIAL_EMAIL}
  </a>
</div>
```

Retain the existing TôHiệuQuiz support phone/Gmail but label that section `Hỗ trợ nền tảng TôHiệuQuiz` so Google/users do not confuse it with official school contact data.

- [ ] **Step 5: Update Footer navigation and brand line**

Extend `FooterRoutePath`:

```ts
export type FooterRoutePath =
  | '/'
  | '/truong-tieu-hoc-to-hieu-son-la'
  | '/about'
  | '/contact'
  | '/privacy'
  | '/tos';
```

Add:

```ts
{ name: 'Nhà trường', path: '/truong-tieu-hoc-to-hieu-son-la' },
```

Replace the generic public brand paragraph with:

```tsx
<p className="mt-5 max-w-sm text-sm font-medium leading-7 text-slate-600">
  {BRAND_RELATIONSHIP_LINE}. {SCHOOL_LOCATION_LABEL}.
</p>
```

Do not add the school brand line to the private dashboard footer when `showPublicLinks=false`; private surfaces should remain compact.

- [ ] **Step 6: Run tests**

```bash
npm run test:run -- tests/PublicSchoolPages.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/schoolPage/AboutPage.tsx src/components/schoolPage/ContactPage.tsx src/components/common/Footer.tsx tests/PublicSchoolPages.test.tsx
git commit -m "feat: strengthen school brand signals on public pages"
```

---

### Task 5: Sitemap chỉ ưu tiên trang thương hiệu, không phát tán quiz ID

**Files:**
- Modify: `scripts/generate_sitemap.cjs`
- Modify: `tests/generateSitemap.test.ts`
- Regenerate: `public/sitemap.xml`

**Interfaces:**
- Produces: sitemap có `/`, `/truong-tieu-hoc-to-hieu-son-la`, `/about`, `/contact`, public competition URLs hiện hữu; không có `?quizId=`.

- [ ] **Step 1: Write failing sitemap contract**

In `tests/generateSitemap.test.ts`, add:

```ts
it('includes the school brand page and never emits quiz-id URLs', async () => {
  const fetchImpl = async (url: string) => {
    if (url.endsWith('/api/quizzes')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 'public-looking-quiz', category: 'toan', showOnHome: true, requireCode: false },
          ],
        }),
        text: async () => '',
      };
    }
    if (url.endsWith('/api/public/competitions')) {
      return { ok: true, status: 200, json: async () => ({ data: [] }), text: async () => '' };
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const entries = await buildSitemapEntries({
    siteUrl: 'https://www.example.test',
    apiUrl: 'https://api.example.test',
    today: '2026-09-29',
    fetchImpl,
  });
  const locations = entries.map((entry) => entry.loc);

  expect(locations).toContain(
    'https://www.example.test/truong-tieu-hoc-to-hieu-son-la',
  );
  expect(locations.some((location) => location.includes('quizId='))).toBe(false);
});
```

- [ ] **Step 2: Run RED**

```bash
npm run test:run -- tests/generateSitemap.test.ts
```

Expected: FAIL because profile URL is absent and current generator emits public quiz IDs.

- [ ] **Step 3: Modify generator**

In `buildSitemapData`, after home add:

```js
entries.push({
  loc: toUrl(siteUrl, '/truong-tieu-hoc-to-hieu-son-la', []),
  lastmod: today,
  changefreq: 'weekly',
  priority: '0.9',
});
```

Remove the block that maps `quizzes` to `/?quizId=<id>` sitemap entries. Keep quiz fetch only if it is still needed to derive public category URLs; otherwise simplify after confirming tests. Do not change Competition public sitemap behavior.

- [ ] **Step 4: Run generator tests**

```bash
npm run test:run -- tests/generateSitemap.test.ts
```

Expected: PASS.

- [ ] **Step 5: Regenerate sitemap**

```bash
npm run sitemap:generate
```

Expected console output includes generated URL count and `public/sitemap.xml`. Inspect:

```bash
node -e "const fs=require('fs');const s=fs.readFileSync('public/sitemap.xml','utf8');if(!s.includes('/truong-tieu-hoc-to-hieu-son-la'))process.exit(1);if(s.includes('quizId='))process.exit(2);console.log('brand sitemap ok')"
```

Expected: `brand sitemap ok`.

- [ ] **Step 6: Run production-domain contract**

```bash
npm run test:run -- tests/productionDomainConfig.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/generate_sitemap.cjs tests/generateSitemap.test.ts public/sitemap.xml
git commit -m "feat: prioritize brand pages in sitemap"
```

---

### Task 6: Thêm rollout runbook cho Google Search Console

**Files:**
- Create: `docs/seo/brand-seo-v1-rollout.md`

**Interfaces:**
- Consumes: production URLs created by Tasks 2–5.
- Produces: repeatable post-deploy procedure; no app runtime dependency.

- [ ] **Step 1: Create the runbook**

Use this exact checklist:

```md
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/seo/brand-seo-v1-rollout.md
git commit -m "docs: add brand SEO rollout checklist"
```

---

### Task 7: Full verification and release readiness

**Files:**
- Review all files changed by Tasks 1–6.
- No unrelated refactor.

- [ ] **Step 1: Run focused SEO/public-page tests**

```bash
npm run test:run -- tests/BrandSeo.test.tsx tests/PublicSchoolPages.test.tsx tests/generateSitemap.test.ts tests/productionDomainConfig.test.ts
```

Expected: all PASS.

- [ ] **Step 2: Run static verification**

```bash
npm run lint
npm run typecheck
npm run typecheck:strict
```

Expected: all exit 0.

- [ ] **Step 3: Build production assets**

```bash
SITEMAP_SITE_URL=https://www.thtohieu.com npm run build
```

Expected: build exits 0; generated sitemap contains school profile URL and no `quizId=`.

On Windows PowerShell use:

```powershell
$env:SITEMAP_SITE_URL="https://www.thtohieu.com"; npm run build
```

- [ ] **Step 4: Inspect final diff**

```bash
git diff --check
git status --short
git log --oneline -7
```

Expected:
- `git diff --check` exits 0.
- Only Brand SEO V1 files are changed in the isolated worktree.
- No unrelated `main` dirt was copied into commits.

- [ ] **Step 5: Final browser smoke**

Verify desktop + mobile:
- `/`
- `/truong-tieu-hoc-to-hieu-son-la`
- `/about`
- `/contact`

Acceptance:
- one visible H1 per brand page;
- “Nhà trường” works desktop/mobile;
- no horizontal overflow;
- Footer link works;
- brand copy is readable, not keyword-stuffed;
- quiz login/protected flows remain unchanged.

- [ ] **Step 6: Release**

Push the isolated branch, open/review PR or merge using the repository’s normal release path. After production deploy, execute `docs/seo/brand-seo-v1-rollout.md`.

---

## Acceptance Criteria

- Searching/crawling the site sees one consistent entity: **Trường Tiểu học Tô Hiệu — Phường Tô Hiệu, tỉnh Sơn La — TôHiệuQuiz — thtohieu.com**.
- Home title contains `Trường Tiểu học Tô Hiệu Sơn La` and `TôHiệuQuiz`.
- A dedicated crawlable page exists at `/truong-tieu-hoc-to-hieu-son-la`.
- About and Contact contain natural, visible school/locality mentions.
- Public navigation and footer link to the school profile page.
- JSON-LD identifies `EducationalOrganization` with `H52.101.114` and the official school email; platform support phone/Gmail are not misrepresented as school data.
- Sitemap contains the brand landing page.
- Sitemap contains no `quizId=` URL.
- Quiz ID views return runtime `noindex, nofollow, noarchive`.
- Existing teacher/student/parent private surfaces remain noindex and functionally unchanged.
- Focused tests, lint, typecheck and production build pass.
- Google Search Console rollout is documented; ranking position itself is monitored, not guaranteed.

## Self-Review

- **Spec coverage:** Brand recognition, “Tô Hiệu”, “Sơn La”, dedicated page, home/About/Contact/footer, schema, sitemap, Search Console, and quiz privacy are all assigned to explicit tasks.
- **Placeholder scan:** No implementation step uses TBD/TODO or delegates an unspecified coding action. The only release guard is an explicit owner authorization check for the relationship wording.
- **Type consistency:** The school profile route is declared once as `SCHOOL_PROFILE_PATH` for SEO constants and added to both `RoutePath` and `FooterRoutePath`; public-header key is `school`; tests use the same literal route.
- **YAGNI:** No blog, SSR migration, SEO library, mass content generator, or database changes.
- **Safety:** Execution must begin in an isolated worktree because current `main` has unrelated modified/untracked files.
