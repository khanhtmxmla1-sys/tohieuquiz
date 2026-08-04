# TôHiệuQuiz Module Icon System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuẩn hóa 9 icon module mới thành thư viện dùng chung, bổ sung trang nội bộ `/design-system`, rồi triển khai có kiểm soát vào tiêu đề module và empty state phù hợp mà không thay đổi khu vực “Thao tác nhanh”.

**Architecture:** Giữ file nguồn chất lượng cao ngoài thư mục public, dùng `sharp` tạo đúng một file WebP 512×512 cho mỗi icon, ánh xạ qua một catalog TypeScript và render bằng component `ModuleIcon`. Trang `/design-system` là nơi kiểm tra kích thước, quy tắc sử dụng và khả năng hiển thị; các module thật chỉ nhận icon sau khi asset và component đã vượt kiểm thử.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, React Router, Vitest, Testing Library, Cypress Component Testing, `sharp`.

## Global Constraints

- Không thay hoặc chỉnh lại 6 icon đang dùng tại khu vực “Thao tác nhanh”.
- Không dùng icon module cho sidebar, nút sửa/xóa/đóng, input, bảng dữ liệu, badge nhỏ hoặc menu ba chấm.
- Icon module chỉ dùng ở kích thước `40`, `48`, `64`, `80` px; không nhận kích thước tùy ý.
- Page header mặc định dùng `48px`; empty state dùng `64px`; onboarding/giới thiệu tính năng dùng `80px`; card chức năng dùng `40px`.
- Mỗi icon runtime là một ảnh WebP riêng, nền ngoài trong suốt, canvas vuông `512×512`.
- Wrapper không thêm gradient, glow hoặc badge thứ hai vì ảnh đã chứa rounded-square badge.
- Giữ nguyên Lucide cho các thao tác hệ thống nhỏ.
- “Cuộc thi” và “Cài đặt hệ thống” chỉ được đưa vào catalog và `/design-system` ở đợt này; chưa gắn vào trang thật vì dự án chưa có module độc lập đúng nghĩa tương ứng.
- Tất cả icon trong header có nội dung chữ bên cạnh phải là decorative (`alt=""`, `aria-hidden="true"`) để tránh screen reader đọc lặp.
- Không thêm dependency mới; `sharp@0.35.3` đã có trong dự án.
- Kiểm tra responsive tại `320`, `768`, `1024`, `1440` px và tuân thủ `prefers-reduced-motion`.

---

## File Map

**Create**

- `assets/module-icons/source/question-bank.png`
- `assets/module-icons/source/students.png`
- `assets/module-icons/source/achievements.png`
- `assets/module-icons/source/analytics-report.png`
- `assets/module-icons/source/learning-resources.png`
- `assets/module-icons/source/store.png`
- `assets/module-icons/source/competition.png`
- `assets/module-icons/source/tasks.png`
- `assets/module-icons/source/system-settings.png`
- `scripts/build-module-icons.mjs`
- `src/components/common/module-icon/moduleIconCatalog.ts`
- `src/components/common/module-icon/ModuleIcon.tsx`
- `src/components/common/module-icon/index.ts`
- `src/components/design-system/DesignSystemPage.tsx`
- `src/components/design-system/IconGallery.tsx`
- `src/app/AdminOnlyRoute.tsx`
- `tests/ModuleIcon.test.tsx`
- `tests/DesignSystemPage.test.tsx`
- `cypress/component/design-system-icons.cy.tsx`
- `docs/design-system/iconography.md`

**Generated**

- `public/assets/module-icons/question-bank.webp`
- `public/assets/module-icons/students.webp`
- `public/assets/module-icons/achievements.webp`
- `public/assets/module-icons/analytics-report.webp`
- `public/assets/module-icons/learning-resources.webp`
- `public/assets/module-icons/store.webp`
- `public/assets/module-icons/competition.webp`
- `public/assets/module-icons/tasks.webp`
- `public/assets/module-icons/system-settings.webp`

**Modify**

- `package.json`
- `src/components/common/index.ts`
- `src/app/lazyViews.ts`
- `src/app/AppRoutes.tsx`
- `src/features/quiz-editor/components/TestBankModal.tsx`
- `src/features/quiz-editor/components/TestBankBrowser.tsx`
- `src/features/class-management/views/ClassDetailView.tsx`
- `src/features/certificates/StudentAchievementsPage.tsx`
- `src/components/TeacherDashboard/results-tab/ResultsTab.tsx`
- `src/components/TeacherDashboard/results-tab/ResultsEmptyState.tsx`
- `src/components/HomePage/student-dashboard/SubjectPracticeGrid.tsx`
- `src/components/TeacherDashboard/gift-shop-tab/GiftShopHeader.tsx`
- `src/components/gamification/GiftShop.tsx`
- `src/features/homework/components/HomeworkTab.tsx`
- `tests/ResultsTab.test.tsx`
- `tests/ClassDetailViewParentPortal.test.tsx`
- `tests/classManagementUi.test.tsx`

---

### Task 1: Import và chuẩn hóa asset

**Files:**
- Create: `assets/module-icons/source/*.png`
- Create: `scripts/build-module-icons.mjs`
- Modify: `package.json`
- Generate: `public/assets/module-icons/*.webp`

**Interfaces:**
- Consumes: 9 ảnh PNG đã được người dùng duyệt, hiện là RGBA `1536×1024`.
- Produces: 9 file WebP `512×512`, alpha trong suốt, tên file ổn định để catalog sử dụng.

- [ ] **Step 1: Đưa 9 ảnh nguồn vào đúng tên file**

Không tái tạo ảnh. Chỉ đổi tên và đặt chúng vào `assets/module-icons/source/` theo File Map.

- [ ] **Step 2: Viết kiểm thử hành vi cho script bằng dry-run**

Script phải thất bại khi thiếu file, sai alpha, output không vuông hoặc file WebP vượt `200 KB`.

- [ ] **Step 3: Tạo `scripts/build-module-icons.mjs`**

Quy trình mỗi ảnh:

```js
const normalized = await sharp(sourcePath)
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .resize(420, 420, { fit: 'inside', withoutEnlargement: true })
  .extend({
    top: 46,
    bottom: 46,
    left: 46,
    right: 46,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .webp({ quality: 88, alphaQuality: 100, effort: 6 })
  .toBuffer();
```

Sau khi ghi file, đọc metadata và xác nhận `width === 512`, `height === 512`, `hasAlpha === true`, `bytes <= 204800`.

- [ ] **Step 4: Thêm script npm**

```json
"assets:module-icons": "node scripts/build-module-icons.mjs"
```

- [ ] **Step 5: Chạy build asset**

Run: `npm run assets:module-icons`

Expected: in ra 9 dòng `OK`, tạo 9 WebP, không có file vượt budget.

- [ ] **Step 6: Commit độc lập**

```bash
git add assets/module-icons/source public/assets/module-icons scripts/build-module-icons.mjs package.json
git commit -m "chore: add normalized module icon assets"
```

---

### Task 2: Xây dựng catalog và component `ModuleIcon`

**Files:**
- Create: `src/components/common/module-icon/moduleIconCatalog.ts`
- Create: `src/components/common/module-icon/ModuleIcon.tsx`
- Create: `src/components/common/module-icon/index.ts`
- Create: `tests/ModuleIcon.test.tsx`
- Modify: `src/components/common/index.ts`

**Interfaces:**
- Produces: `ModuleIconName`, `ModuleIconSize`, `MODULE_ICON_CATALOG`, `MODULE_ICON_SIZES`, `<ModuleIcon />`.

- [ ] **Step 1: Viết test thất bại cho catalog**

Test phải xác nhận đủ đúng 9 key và không có đường dẫn trùng nhau:

```ts
const expected = [
  'question-bank', 'students', 'achievements', 'analytics-report',
  'learning-resources', 'store', 'competition', 'tasks', 'system-settings',
];
expect(Object.keys(MODULE_ICON_CATALOG)).toEqual(expected);
```

- [ ] **Step 2: Viết test thất bại cho kích thước và accessibility**

```tsx
render(<ModuleIcon name="students" size="md" />);
const image = screen.getByRole('presentation', { hidden: true });
expect(image).toHaveAttribute('width', '48');
expect(image).toHaveAttribute('height', '48');
expect(image).toHaveAttribute('alt', '');
```

Thêm test `decorative={false}` tự dùng label tiếng Việt từ catalog.

- [ ] **Step 3: Tạo catalog typed**

```ts
export const MODULE_ICON_SIZES = { sm: 40, md: 48, lg: 64, xl: 80 } as const;

export const MODULE_ICON_CATALOG = {
  'question-bank': { label: 'Ngân hàng câu hỏi', src: '/assets/module-icons/question-bank.webp' },
  students: { label: 'Học sinh', src: '/assets/module-icons/students.webp' },
  achievements: { label: 'Thành tích và bảng vàng', src: '/assets/module-icons/achievements.webp' },
  'analytics-report': { label: 'Báo cáo phân tích', src: '/assets/module-icons/analytics-report.webp' },
  'learning-resources': { label: 'Kho học liệu', src: '/assets/module-icons/learning-resources.webp' },
  store: { label: 'Cửa hàng', src: '/assets/module-icons/store.webp' },
  competition: { label: 'Cuộc thi', src: '/assets/module-icons/competition.webp' },
  tasks: { label: 'Nhiệm vụ', src: '/assets/module-icons/tasks.webp' },
  'system-settings': { label: 'Cài đặt hệ thống', src: '/assets/module-icons/system-settings.webp' },
} as const;
```

- [ ] **Step 4: Tạo component**

Props cố định:

```ts
interface ModuleIconProps {
  name: ModuleIconName;
  size?: ModuleIconSize;
  decorative?: boolean;
  alt?: string;
  priority?: boolean;
  className?: string;
}
```

Component phải đặt `width`, `height`, `loading`, `decoding="async"`, `object-contain`; khi lỗi tải ảnh, hiển thị fallback trung tính và không làm vỡ layout.

- [ ] **Step 5: Export từ common barrel**

Run: `npm run test:run -- tests/ModuleIcon.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit độc lập**

```bash
git add src/components/common/module-icon src/components/common/index.ts tests/ModuleIcon.test.tsx
git commit -m "feat: add typed module icon component"
```

---

### Task 3: Tạo trang nội bộ `/design-system`

**Files:**
- Create: `src/components/design-system/DesignSystemPage.tsx`
- Create: `src/components/design-system/IconGallery.tsx`
- Create: `src/app/AdminOnlyRoute.tsx`
- Create: `tests/DesignSystemPage.test.tsx`
- Create: `cypress/component/design-system-icons.cy.tsx`
- Modify: `src/app/lazyViews.ts`
- Modify: `src/app/AppRoutes.tsx`

**Interfaces:**
- Consumes: `MODULE_ICON_CATALOG`, `MODULE_ICON_SIZES`, `ModuleIcon`.
- Produces: route admin-only `/design-system`.

- [ ] **Step 1: Viết test route và quyền truy cập**

Test admin thấy tiêu đề “Design System TôHiệuQuiz”; giáo viên thường bị chuyển về `/teacher/overview`.

- [ ] **Step 2: Tạo `AdminOnlyRoute`**

Dùng `useAuthStore().isAdmin`; route đã nằm trong `ProtectedRoute role="teacher"`, nên guard chỉ xử lý quyền admin.

- [ ] **Step 3: Tạo `IconGallery`**

Mỗi icon hiển thị:

- Tên tiếng Việt và key component.
- Demo `40`, `48`, `64`, `80` px.
- Mẫu trên nền trắng và nền slate nhạt.
- Nhãn “Nên dùng” và “Không nên dùng”.
- Một ô code đọc-only: `<ModuleIcon name="students" size="md" />`.

- [ ] **Step 4: Tạo `DesignSystemPage`**

Ở giai đoạn này trang chỉ hoàn thiện phần “Iconography”; không dựng các section Button/Input/Modal giả hoặc “coming soon”. Trang không xuất hiện trên sidebar chính.

- [ ] **Step 5: Thêm lazy route**

`src/app/lazyViews.ts` export `DesignSystemPage`; `src/app/AppRoutes.tsx` thêm `/design-system` bọc `ProtectedRoute` và `AdminOnlyRoute`.

- [ ] **Step 6: Kiểm tra component responsive và overflow**

Run: `npm run cypress:run:component -- --spec cypress/component/design-system-icons.cy.tsx`

Expected: không horizontal overflow tại `320`, `768`, `1024`, `1440`; đủ 9 icon; ảnh không bị méo.

- [ ] **Step 7: Commit độc lập**

```bash
git add src/components/design-system src/app/AdminOnlyRoute.tsx src/app/lazyViews.ts src/app/AppRoutes.tsx tests/DesignSystemPage.test.tsx cypress/component/design-system-icons.cy.tsx
git commit -m "feat: add internal icon design system page"
```

---

### Task 4: Pilot trên 3 luồng rõ ràng nhất

**Files:**
- Modify: `src/features/quiz-editor/components/TestBankModal.tsx`
- Modify: `src/features/quiz-editor/components/TestBankBrowser.tsx`
- Modify: `src/features/class-management/views/ClassDetailView.tsx`
- Modify: `src/components/TeacherDashboard/results-tab/ResultsTab.tsx`
- Modify: `src/components/TeacherDashboard/results-tab/ResultsEmptyState.tsx`
- Modify: `tests/ResultsTab.test.tsx`
- Modify: `tests/ClassDetailViewParentPortal.test.tsx`
- Modify: `tests/classManagementUi.test.tsx`

**Interfaces:**
- Question bank header: `question-bank/md`.
- Student roster header: `students/md`; empty state: `students/lg`.
- Results header: `analytics-report/md`; empty state: `analytics-report/lg`.

- [ ] **Step 1: Viết test cho ba vị trí pilot**

Dùng `data-module-icon="question-bank|students|analytics-report"` trên wrapper để test không phụ thuộc tên file.

- [ ] **Step 2: Thay icon header của ngân hàng câu hỏi**

Trong `TestBankModal.tsx`, thay `Library` ở header bằng `<ModuleIcon name="question-bank" size="md" />`. Giữ `X`, `Search`, `Trash2` là Lucide.

Trong `TestBankBrowser.tsx`, empty state dùng `question-bank/lg`; không dùng icon module trong từng câu hỏi.

- [ ] **Step 3: Dùng icon học sinh đúng ngữ cảnh**

Trong `ClassDetailView.tsx`, đặt `students/md` cạnh tiêu đề “Lớp …”; empty state “Chưa có học sinh” dùng `students/lg`. Không thay icon lớp học trong danh sách lớp.

- [ ] **Step 4: Bổ sung tiêu đề báo cáo và bỏ emoji**

Trong `ResultsTab.tsx`, thêm header “Báo cáo phân tích” trước toolbar với `analytics-report/md`.

Trong `ResultsEmptyState.tsx`, bỏ emoji `📊`, dùng common `EmptyState` và `analytics-report/lg`. Xóa render empty state trùng nếu `AsyncState` đã xử lý cùng điều kiện.

- [ ] **Step 5: Chạy test pilot**

Run:

```bash
npm run test:run -- tests/ResultsTab.test.tsx tests/ClassDetailViewParentPortal.test.tsx tests/classManagementUi.test.tsx tests/ModuleIcon.test.tsx
```

Expected: PASS; không xuất hiện hai empty state cùng lúc ở Results.

- [ ] **Step 6: Commit độc lập**

```bash
git add src/features/quiz-editor/components/TestBankModal.tsx src/features/quiz-editor/components/TestBankBrowser.tsx src/features/class-management/views/ClassDetailView.tsx src/components/TeacherDashboard/results-tab/ResultsTab.tsx src/components/TeacherDashboard/results-tab/ResultsEmptyState.tsx tests
git commit -m "feat: pilot module icons in core learning flows"
```

---

### Task 5: Rollout đợt 2 cho module đã có trang thật

**Files:**
- Modify: `src/features/certificates/StudentAchievementsPage.tsx`
- Modify: `src/components/HomePage/student-dashboard/SubjectPracticeGrid.tsx`
- Modify: `src/components/TeacherDashboard/gift-shop-tab/GiftShopHeader.tsx`
- Modify: `src/components/gamification/GiftShop.tsx`
- Modify: `src/features/homework/components/HomeworkTab.tsx`

**Interfaces:**
- Achievements: `achievements/md` header, `achievements/xl` empty state.
- Practice library: `learning-resources/md` section title; giữ icon môn học riêng trong `PracticeSubjectHeader`.
- Store: `store/md` teacher/student header; không dùng trong product cards.
- Homework/tasks: `tasks/md` header; không dùng trong từng assignment row/card.

- [ ] **Step 1: Thành tích/Bảng vàng**

Thay icon trophy nhỏ ở header `StudentAchievementsPage` bằng module icon; empty state thay `Inbox` bằng `achievements/xl`. Giữ `RefreshCw`, `Download`, `AlertCircle` là icon thao tác. Đồng thời bỏ emoji ngôi sao trong đoạn mô tả empty state.

- [ ] **Step 2: Kho học liệu**

Trong `SubjectPracticeGrid.tsx`, đặt `learning-resources/md` cạnh tiêu đề “Thư viện luyện tập”. Không thay `Calculator`, `BookOpen`, `Earth`, `Languages`, `Monitor` trong `PracticeSubjectHeader` vì chúng phân biệt môn học.

- [ ] **Step 3: Cửa hàng**

Trong `GiftShopHeader.tsx` và header của `GiftShop.tsx`, dùng `store/md`. Giữ `Plus`, `RefreshCw`, `ArrowLeft`, `Sparkles` cho hành động và số xu.

- [ ] **Step 4: Nhiệm vụ**

Trong `HomeworkTab.tsx`, đặt `tasks/md` cạnh “Trung tâm Bài tập Tự luận”. Không thay `Pencil`, `CalendarClock`, `Lock`, `Copy`, `Archive` trong card.

- [ ] **Step 5: Kiểm tra bằng ảnh chụp trước/sau**

Chụp desktop và mobile cho từng module; xác nhận icon không làm tăng chiều cao header quá `8px`, không làm nút hành động xuống dòng ở `1024px`.

- [ ] **Step 6: Commit độc lập**

```bash
git add src/features/certificates/StudentAchievementsPage.tsx src/components/HomePage/student-dashboard/SubjectPracticeGrid.tsx src/components/TeacherDashboard/gift-shop-tab/GiftShopHeader.tsx src/components/gamification/GiftShop.tsx src/features/homework/components/HomeworkTab.tsx
git commit -m "feat: roll out module icons to existing modules"
```

---

### Task 6: Ghi nhận icon chưa có nơi triển khai đúng nghĩa

**Files:**
- Modify: `docs/design-system/iconography.md`
- Verify: `src/components/design-system/IconGallery.tsx`

- [ ] **Step 1: Ghi quy tắc cho `competition`**

Trạng thái: “Asset sẵn sàng; chưa gắn production vì chưa có route/module Cuộc thi độc lập.” Không dùng tạm cho Thi trực tiếp hoặc Thành tích vì sai nghĩa.

- [ ] **Step 2: Ghi quy tắc cho `system-settings`**

Trạng thái: “Asset sẵn sàng; chưa gắn production vì hiện có Cài đặt cá nhân, Thông báo và Operations Center tách rời.” Không đặt vào `PersonalSettingsTab` vì đó không phải Cài đặt hệ thống.

- [ ] **Step 3: Ghi ma trận sử dụng**

Tài liệu phải nêu rõ icon module 40–80px, quick-action illustration hiện tại, và Lucide 16–20px là ba tầng khác nhau.

- [ ] **Step 4: Commit độc lập**

```bash
git add docs/design-system/iconography.md src/components/design-system/IconGallery.tsx
git commit -m "docs: define module icon usage boundaries"
```

---

### Task 7: Quality gate và rollout

**Files:**
- Verify all changed files.

- [ ] **Step 1: Kiểm tra asset budget**

Run: `npm run assets:module-icons`

Expected: 9/9 asset hợp lệ, không file nào vượt `200 KB`.

- [ ] **Step 2: Chạy lint và typecheck**

```bash
npm run lint
npm run typecheck
npm run typecheck:strict
```

Expected: PASS, không warning mới.

- [ ] **Step 3: Chạy test tập trung**

```bash
npm run test:run -- tests/ModuleIcon.test.tsx tests/DesignSystemPage.test.tsx tests/ResultsTab.test.tsx tests/ClassDetailViewParentPortal.test.tsx tests/classManagementUi.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Chạy build**

Run: `npm run build`

Expected: PASS; Vite không báo missing module icon asset.

- [ ] **Step 5: Kiểm tra trình duyệt**

Kiểm tra `/design-system` bằng admin và các module pilot tại 4 breakpoint. Tab qua tất cả nút, xác nhận icon decorative không tạo focus stop và không bị screen reader đọc lặp.

- [ ] **Step 6: Rollout có kiểm soát**

Deploy đợt đầu gồm component, design system và ba pilot. Sau smoke test mới đưa đợt 2 lên production. Rollback chỉ cần hoàn tác integration JSX; asset và catalog có thể giữ vì không ảnh hưởng runtime khi không được render.

- [ ] **Step 7: Commit hoàn tất nếu có điều chỉnh quality gate**

```bash
git add .
git commit -m "test: verify module icon system rollout"
```

---

## Acceptance Criteria

- `/design-system` chỉ admin truy cập được và hiển thị đủ 9 icon ở 4 kích thước.
- 9 ảnh runtime đều là WebP vuông 512×512, alpha trong suốt, ≤200 KB/file.
- Khu vực “Thao tác nhanh” không thay đổi cả JSX, asset lẫn hình thức hiển thị.
- Sidebar, nút thao tác và bảng dữ liệu tiếp tục dùng Lucide.
- Không còn emoji trong `ResultsEmptyState` và empty state Thành tích.
- Ngân hàng câu hỏi, Học sinh và Báo cáo có icon ở header/empty state đúng cấp độ.
- Thành tích, Kho học liệu, Cửa hàng và Nhiệm vụ được rollout sau pilot.
- Cuộc thi và Cài đặt hệ thống chỉ ở catalog/design-system cho tới khi có module độc lập.
- Lint, typecheck, focused tests và build đều pass.
- Không có horizontal overflow tại 320px và không có layout shift do thiếu `width`/`height` ảnh.
