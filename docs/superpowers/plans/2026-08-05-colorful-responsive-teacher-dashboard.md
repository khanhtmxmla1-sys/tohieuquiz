# TôHiệuQuiz Teacher Dashboard Overview Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện giai đoạn 1 của giao diện quản lý giáo viên TôHiệuQuiz: thiết kế lại trang Tổng quan theo mockup đã duyệt, tích hợp bộ illustration/icon riêng, giữ nguyên dữ liệu thật, route hiện có, nghiệp vụ tạo đề và khả năng truy cập; dừng để người dùng duyệt trước khi mở rộng sang các màn hình khác.

**Architecture:** Chỉ thay đổi lớp trình bày frontend và pipeline tài nguyên hình ảnh. Dashboard được tách thành shell responsive, hero + KPI, khu vực tạo đề, Action Center dạng danh sách, quick actions và các panel phân tích gọn. Bộ ảnh nguồn được chuẩn hóa thành WebP nền trong suốt, quản lý qua registry có fallback; component hiển thị không gọi API trực tiếp. Desktop dùng sidebar điều hướng; mobile dùng bottom navigation cho các đích phổ biến và nút “Thêm” để mở drawer đầy đủ. Không thêm API, không sửa D1 và không dùng số liệu giả để mô phỏng biểu đồ.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, React Router, Lucide React chỉ làm fallback, Sharp 0.35.3 cho xử lý ảnh, Testing Library, Vitest, axe-core, Cypress, Playwright, GitNexus.

## Design Read

Reading this as: **dashboard quản lý dành cho giáo viên Việt Nam**, có mật độ dữ liệu vừa phải, ngôn ngữ hình ảnh thân thiện với học sinh tiểu học, theo hướng **Soft Structuralism / pastel educational SaaS**. Mức ưu tiên: rõ ràng và tin cậy trước, sinh động sau; illustration tạo cảm xúc ở hero và thẻ tạo đề, icon tùy biến hỗ trợ quét nhanh nhưng không biến trang thành giao diện trò chơi.

- Design variance: 5/10 — đủ khác biệt nhưng không phá cấu trúc quản trị quen thuộc.
- Motion intensity: 3/10 — chỉ dùng phản hồi hover/press và chuyển trạng thái có mục đích.
- Visual density: 6/10 — nhiều dữ liệu nhưng giữ khoảng thở, không lồng card nhiều tầng.

## Global Constraints

- Không sửa `src/app/navigationRoutes.ts` hoặc `src/app/AppRoutes.tsx`.
- Không thay đổi Worker, API, D1, assignment, live exam, publish hoặc dữ liệu production.
- Giữ route chuẩn:
  - AI: `/teacher/quizzes?mode=create`
  - Thủ công mới: `/teacher/quizzes/new`
  - Chỉnh sửa: `/teacher/quizzes/:quizId/edit`
- Không nhúng nguyên hai mockup vào giao diện production; mockup chỉ là tài liệu tham chiếu.
- Hero illustration phải là asset riêng không có chữ, không có số liệu và không có watermark.
- Các ảnh/icon đã sinh trong cuộc hội thoại chỉ là **source artwork**; không đưa trực tiếp vào production trước khi kiểm tra nền, crop, ánh sáng, tỷ lệ, kích thước và tính nhất quán.
- Nếu source artwork không được mount vào workspace khi bắt đầu triển khai, dừng và yêu cầu người dùng cung cấp lại file; không thay bằng ảnh ngẫu nhiên hoặc icon placeholder.
- Illustration production phải có nền trong suốt thật, không còn nền xám/gradient từ ảnh sinh, không chứa chữ bị bake-in.
- Icon production phải dùng cùng một hệ hình: squircle mềm, pastel 3D/vector, ánh sáng từ trên-trái, không trộn icon nét Lucide làm hình chính. Lucide chỉ được dùng làm fallback khi asset lỗi.
- Mỗi asset có kích thước logic cố định, `width`/`height` khai báo trước để tránh layout shift; ảnh dưới fold dùng `loading="lazy"`, tất cả dùng `decoding="async"`.
- Không hiển thị sparkline, mục tiêu 80%, xu hướng hoặc cảnh báo giả khi backend không cung cấp dữ liệu tương ứng.
- Action Center tiếp tục dùng dữ liệu thật từ `/api/teacher/action-center` và giữ hành động xóa bản nháp hiện có.
- Khi `VITE_FEATURE_MANUAL_QUIZ_WORKSPACE_V1=false`, khu vực tạo đề vẫn xuất hiện nhưng chỉ có một hành động legacy “Tạo đề mới”.
- Sidebar desktop chỉ dùng cho điều hướng; không còn hai CTA tạo đề lớn.
- Mobile bottom navigation ánh xạ vào route thật: `Tổng quan`, `Đề thi`, `Học sinh`, `Kết quả`, `Thêm`. “Thêm” mở drawer đầy đủ, không tạo tab giả `utilities`.
- Mục tiêu responsive: 320px, 390px, 768px, 1024px, 1440px và 1920px.
- Mọi điều khiển chạm tối thiểu 44×44px; hỗ trợ bàn phím, focus-visible, `aria-current`, `aria-expanded` và reduced motion.
- Không thêm raw hexadecimal color vào các file Overview đang được kiểm tra bởi `tests/teacherOverviewA11y.test.tsx`; ưu tiên semantic token hoặc Tailwind palette.
- Performance budget hiện có phải tiếp tục đạt; không thêm thư viện biểu đồ mới.
- Phải bảo toàn các thay đổi cục bộ không liên quan: `AGENTS.md`, `CLAUDE.md`, `.gemini/`, `logo_tohieu-removebg-preview.png`.
- Mọi thay đổi source phải chạy GitNexus impact trước khi sửa symbol và `detect_changes()` trước commit.
- Không commit, push, merge hoặc deploy nếu chưa có lệnh riêng của người dùng.

---

## 1. Đánh giá khả năng áp dụng hai mockup

### Có thể áp dụng trực tiếp

- Sidebar desktop chỉ giữ điều hướng.
- Hero màu xanh nổi bật và ba KPI pastel riêng biệt.
- Khu vực “Tạo đề kiểm tra” có hai lựa chọn AI/thủ công.
- Action Center dạng các hàng màu theo mức độ ưu tiên.
- Quick actions dạng tile nhỏ nhiều màu.
- Ba panel cuối: tình hình điểm số, bài vừa nộp, đề gần đây.
- Mobile có app bar gọn và bottom navigation cố định.

### Phải điều chỉnh khi triển khai thật

- Mockup mobile rộng gần tablet; ở 390px phải chuyển KPI thành horizontal snap hoặc 2+1, không giữ ba card cố định trên một hàng.
- Không dùng sparkline trong KPI vì hệ thống hiện chỉ có giá trị tổng hợp, chưa có chuỗi thời gian.
- Không hiển thị “so với mục tiêu 80%” vì chưa có cấu hình mục tiêu tương ứng.
- Không tạo các cảnh báo “Lớp có tỷ lệ nộp thấp” hoặc “Đề cần duyệt” nếu Action Center không trả về loại dữ liệu đó.
- Bottom navigation không dùng nhãn “Tiện ích” như một route chung vì `TeacherDashboardTab` không có tab này; dùng “Thêm” để mở drawer.
- Không giữ nút tạo đề ở sidebar và không lặp lại hai CTA trong panel “Đề kiểm tra gần đây”.
- Không sao chép nguyên text/số liệu mẫu 1, 70%, 3; tiếp tục hiển thị dữ liệu từ `resultSummary`.

## 2. Bố cục đích

### Desktop ≥ 1280px

```text
┌──────── Sidebar 240px ────────┬──────────────── Header 64px ─────────────────┐
│ Logo                           │ Breadcrumb · Search · Notification · Account │
│ Tổng quan                      ├───────────────────────────────────────────────┤
│ Nhóm điều hướng                │ Hero 7/12              │ KPI 5/12            │
│                                ├────────────────────────┼─────────────────────┤
│                                │ Tạo đề 7/12            │ Việc cần chú ý 5/12 │
│                                ├───────────────────────────────────────────────┤
│                                │ 6 thao tác nhanh                              │
│                                ├──────────────┬──────────────┬─────────────────┤
│                                │ Điểm số      │ Bài vừa nộp  │ Đề gần đây      │
└────────────────────────────────┴──────────────┴──────────────┴─────────────────┘
```

### Mobile 320–767px

```text
┌──────────────── App bar ────────────────┐
│ Logo                     Bell · Avatar  │
│ Dashboard giáo viên / Tổng quan         │
├─────────────────────────────────────────┤
│ Hero                                    │
│ KPI horizontal snap / 2+1               │
│ Tạo đề AI                               │
│ Soạn đề thủ công                        │
│ Việc cần chú ý                          │
│ Quick actions 2 cột                     │
│ Tình hình điểm số                       │
│ Bài vừa nộp                             │
│ Đề gần đây                              │
├──────── Fixed bottom navigation ────────┤
│ Tổng quan · Đề thi · Học sinh · KQ · Thêm│
└─────────────────────────────────────────┘
```

## 3. Cấu trúc file đích

### Tạo mới

- `scripts/build-teacher-dashboard-assets.mjs`
  - Dùng Sharp để trim, remove/normalize nền khi có alpha mask phù hợp, resize và xuất WebP; từ chối source không đạt điều kiện nền/khung.
- `artifacts/teacher-dashboard-source/README.md`
  - Ghi danh sách source artwork từ cuộc hội thoại, checksum và vị trí đích; thư mục nguồn không được import vào ứng dụng.
- `public/illustrations/tohieuquiz/teacher-dashboard-v2/teacher-welcome.webp`
  - Minh họa giáo viên và học sinh cho banner; không chữ, nền trong suốt.
- `public/illustrations/tohieuquiz/teacher-dashboard-v2/ai-quiz-robot.webp`
  - Robot AI và checklist cho thẻ tạo đề AI.
- `public/illustrations/tohieuquiz/teacher-dashboard-v2/manual-quiz.webp`
  - Sổ, bút và dụng cụ học tập cho thẻ soạn đề thủ công.
- `public/icons/tohieuquiz/dashboard-v2/classroom.webp`
- `public/icons/tohieuquiz/dashboard-v2/test.webp`
- `public/icons/tohieuquiz/dashboard-v2/assignment.webp`
- `public/icons/tohieuquiz/dashboard-v2/live-exam.webp`
- `public/icons/tohieuquiz/dashboard-v2/results.webp`
- `public/icons/tohieuquiz/dashboard-v2/certificate.webp`
- `public/icons/tohieuquiz/dashboard-v2/quiz-management.webp`
- `public/icons/tohieuquiz/dashboard-v2/students.webp`
- `public/icons/tohieuquiz/dashboard-v2/manifest.json`
  - Metadata: source, kích thước, byte size, checksum, semantic name.
- `src/components/TeacherDashboard/overview/TeacherDashboardVisual.tsx`
  - Registry cho illustration/icon, khai báo kích thước, alt/decorative semantics và fallback có kiểm soát.
- `src/components/TeacherDashboard/overview/DashboardKpiGrid.tsx`
  - Hiển thị KPI thật, responsive và không giả lập xu hướng.
- `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherMobileBottomNav.tsx`
  - Điều hướng mobile năm mục và mở drawer qua “Thêm”.
- `src/components/TeacherDashboard/overview/action-center/ActionCenterItem.tsx`
  - Hàng Action Center có tone, CTA chính và secondary action riêng biệt.
- `src/components/TeacherDashboard/overview/dashboardVisualConfig.ts`
  - Class token dùng chung cho KPI, quick action và severity; tránh màu tùy tiện rải rác.
- `tests/TeacherDashboardAssets.test.tsx`
- `tests/TeacherMobileBottomNav.test.tsx`
- `tests/TeacherDashboardColorfulOverview.test.tsx`
- `cypress/e2e/teacher-dashboard-responsive-redesign.cy.ts`

### Sửa

- `src/styles/design-tokens.css`
- `src/components/TeacherDashboard/Sidebar.tsx`
- `src/components/TeacherDashboard/OverviewTab.tsx`
- `src/components/TeacherDashboard/overview/DashboardHero.tsx`
- `src/components/TeacherDashboard/overview/QuizCreationChoicePanel.tsx`
- `src/components/TeacherDashboard/overview/ActionCenterPanel.tsx`
- `src/components/TeacherDashboard/overview/QuickActionGrid.tsx`
- `src/components/TeacherDashboard/overview/PerformancePanel.tsx`
- `src/components/TeacherDashboard/overview/RecentSubmissionsPanel.tsx`
- `src/components/TeacherDashboard/overview/RecentQuizzesPanel.tsx`
- `src/components/TeacherDashboard/overview/index.ts`
- `src/components/TeacherDashboard/quiz-creation/QuizCreationActions.tsx`
- `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardLayout.tsx`
- `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardHeader.tsx`
- `src/components/TeacherDashboard/teacher-dashboard-shell/types.ts`
- `tests/TeacherOverview.test.tsx`
- `tests/TeacherSidebarAccessibility.test.tsx`
- `tests/QuizCreationActions.test.tsx`
- `tests/QuizCreationChoicePanel.test.tsx`
- `tests/TeacherDashboardShell.test.tsx`
- `tests/teacherOverviewA11y.test.tsx`
- `tests/teacherOverviewAxe.test.tsx`
- `cypress/e2e/quiz-creation-entry-points.cy.ts`

### Xóa sau khi thay thế

- `src/components/TeacherDashboard/overview/MetricGrid.tsx`
  - Ba KPI mới thay thế phần dữ liệu trùng lặp.
  - `Điểm trung bình` tiếp tục hiển thị trong PerformancePanel.
  - Tổng số đề hiển thị trong header RecentQuizzesPanel.

---

### Task 1: Tạo worktree cô lập và khóa baseline

**Files:**
- Không sửa source.
- Đọc: `AGENTS.md`, `CONTEXT.md`, `docs/deployment/CURRENT_PROGRESS.md`.

**Interfaces:**
- Consumes: `main` hiện tại và bốn thay đổi cục bộ không liên quan.
- Produces: worktree sạch trên nhánh `feature/colorful-responsive-teacher-dashboard`.

- [ ] **Step 1: Xác minh trạng thái gốc**

```powershell
git -C C:\quizpro status --short --branch
git -C C:\quizpro fetch origin main
git -C C:\quizpro rev-list --left-right --count origin/main...main
```

Expected: `main` đồng bộ; chỉ thấy `AGENTS.md`, `CLAUDE.md`, `.gemini/`, logo PNG là thay đổi không liên quan.

- [ ] **Step 2: Tạo worktree**

```powershell
git -C C:\quizpro worktree add C:\quizpro-worktrees\colorful-dashboard -b feature/colorful-responsive-teacher-dashboard origin/main
```

Expected: worktree mới sạch, không mang theo bốn thay đổi cá nhân.

- [ ] **Step 3: Chạy baseline tập trung**

```powershell
npm run test:run -- tests/TeacherOverview.test.tsx tests/TeacherSidebarAccessibility.test.tsx tests/QuizCreationActions.test.tsx tests/QuizCreationChoicePanel.test.tsx tests/teacherOverviewA11y.test.tsx tests/teacherOverviewAxe.test.tsx
npm run typecheck
```

Expected: PASS trước khi sửa.

- [ ] **Step 4: GitNexus impact**

Chạy upstream impact cho:

```text
Sidebar
TeacherDashboardLayout
TeacherDashboardHeader
OverviewTab
DashboardHero
QuizCreationActions
ActionCenterPanel
QuickActionGrid
PerformancePanel
RecentQuizzesPanel
```

Stop condition: nếu bất kỳ symbol nào là HIGH/CRITICAL, báo người dùng trước khi chỉnh sửa.

---

### Task 2: Khóa visual contract bằng test đỏ

**Files:**
- Create: `tests/TeacherDashboardColorfulOverview.test.tsx`
- Modify: `tests/TeacherSidebarAccessibility.test.tsx`
- Modify: `tests/TeacherOverview.test.tsx`
- Modify: `tests/QuizCreationChoicePanel.test.tsx`

**Interfaces:**
- Consumes: component hiện tại.
- Produces: contract mới cho cấu trúc desktop/mobile và điểm vào tạo đề.

- [ ] **Step 1: Viết test sidebar không còn CTA tạo đề**

```tsx
it('keeps quiz creation out of the navigation sidebar', () => {
  renderSidebar();
  expect(screen.queryByRole('button', { name: 'Tạo đề bằng AI' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Soạn đề thủ công' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Tổng quan' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Viết test thứ tự Overview mới**

```tsx
const headings = screen.getAllByRole('heading').map(node => node.textContent);
expect(headings.indexOf('Tạo đề kiểm tra')).toBeLessThan(headings.indexOf('Việc cần chú ý hôm nay'));
expect(headings.indexOf('Việc cần chú ý hôm nay')).toBeLessThan(headings.indexOf('Thao tác nhanh'));
```

- [ ] **Step 3: Viết test legacy flag**

```tsx
renderOverview({ manualQuizWorkspaceEnabled: false });
const section = screen.getByRole('heading', { name: 'Tạo đề kiểm tra' }).closest('section');
expect(within(section!).getByRole('button', { name: 'Tạo đề mới' })).toBeInTheDocument();
expect(within(section!).queryByRole('button', { name: 'Soạn đề thủ công' })).not.toBeInTheDocument();
```

- [ ] **Step 4: Viết test loại bỏ CTA lặp ở đề gần đây**

```tsx
const recent = screen.getByRole('heading', { name: 'Đề kiểm tra gần đây' }).closest('section');
expect(within(recent!).queryByRole('button', { name: 'Tạo đề bằng AI' })).not.toBeInTheDocument();
expect(within(recent!).queryByRole('button', { name: 'Soạn đề thủ công' })).not.toBeInTheDocument();
expect(within(recent!).getByRole('button', { name: /Xem tất cả/i })).toBeInTheDocument();
```

- [ ] **Step 5: Chạy test và xác nhận FAIL đúng lý do**

```powershell
npm run test:run -- tests/TeacherDashboardColorfulOverview.test.tsx tests/TeacherSidebarAccessibility.test.tsx tests/TeacherOverview.test.tsx tests/QuizCreationChoicePanel.test.tsx
```

Expected: FAIL vì sidebar vẫn có CTA, thứ tự hiện tại khác và legacy panel đang bị ẩn.

---

### Task 3: Chuẩn hóa bộ illustration/icon và palette

**Files:**
- Create: `scripts/build-teacher-dashboard-assets.mjs`
- Create: `artifacts/teacher-dashboard-source/README.md`
- Create: `public/illustrations/tohieuquiz/teacher-dashboard-v2/teacher-welcome.webp`
- Create: `public/illustrations/tohieuquiz/teacher-dashboard-v2/ai-quiz-robot.webp`
- Create: `public/illustrations/tohieuquiz/teacher-dashboard-v2/manual-quiz.webp`
- Create: `public/icons/tohieuquiz/dashboard-v2/*.webp`
- Create: `public/icons/tohieuquiz/dashboard-v2/manifest.json`
- Create: `src/components/TeacherDashboard/overview/TeacherDashboardVisual.tsx`
- Modify: `styles/tokens.css`
- Create: `src/components/TeacherDashboard/overview/dashboardVisualConfig.ts`
- Test: `tests/TeacherDashboardAssets.test.tsx`
- Test: `tests/teacherOverviewA11y.test.tsx`

**Interfaces:**
- Produces: `TeacherDashboardVisualName`, `TEACHER_DASHBOARD_VISUALS`, `<TeacherDashboardVisual />`, semantic tokens và class map dùng bởi các task UI sau.
- Source artwork expected from the conversation: `cheerful_classroom_learning_adventure.png`, `friendly_ai_robot_with_floating_checklist.png`, `pastel_study_desk_essentials.png`, `friendly_classroom_students_icon.png`, `pastel_checklist_icon_with_pencil.png`, `pastel_blue_paper_airplane_icon.png`, `pastel_analytics_chart_with_sparkles.png`.

- [ ] **Step 1: Kiểm kê source artwork và khóa điều kiện dừng**

Tạo `artifacts/teacher-dashboard-source/README.md` với bảng:

```markdown
| semanticName | sourceFilename | target | expectedRatio | maxBytes |
| teacher-welcome | cheerful_classroom_learning_adventure.png | public/illustrations/tohieuquiz/teacher-dashboard-v2/teacher-welcome.webp | 3:2 | 160000 |
| ai-quiz-robot | friendly_ai_robot_with_floating_checklist.png | public/illustrations/tohieuquiz/teacher-dashboard-v2/ai-quiz-robot.webp | 1:1 | 90000 |
| manual-quiz | pastel_study_desk_essentials.png | public/illustrations/tohieuquiz/teacher-dashboard-v2/manual-quiz.webp | 1:1 | 90000 |
```

Stop condition: source thiếu, nền xám không thể tách sạch, hoặc có chi tiết chữ/artefact không chấp nhận được thì dừng và yêu cầu tạo lại asset; không tự che lỗi bằng CSS.

- [ ] **Step 2: Viết test đỏ cho registry và file output**

```tsx
it.each([
  'teacher-welcome',
  'ai-quiz-robot',
  'manual-quiz',
  'classroom',
  'test',
  'assignment',
  'live-exam',
  'results',
  'certificate',
  'quiz-management',
  'students',
] as const)('registers %s with an existing optimized asset', async (name) => {
  const visual = TEACHER_DASHBOARD_VISUALS[name];
  expect(visual.src).toMatch(/^\/(icons|illustrations)\/tohieuquiz\/.*\.webp$/);
  expect(visual.width).toBeGreaterThan(0);
  expect(visual.height).toBeGreaterThan(0);
  expect(visual.maxBytes).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Tạo pipeline Sharp**

`scripts/build-teacher-dashboard-assets.mjs` phải:

```text
1. đọc source path từ manifest cục bộ;
2. kiểm tra kích thước và alpha channel;
3. trim vùng rỗng, resize theo bounding box, không kéo méo;
4. xuất WebP quality 82-86;
5. ghi width/height/bytes/sha256 vào manifest;
6. fail process nếu illustration vượt 160 KB, icon vượt 32 KB, alpha edge còn nền xám rõ rệt hoặc thiếu file.
```

Run:

```powershell
node scripts/build-teacher-dashboard-assets.mjs --source artifacts/teacher-dashboard-source --write
```

Expected: 3 illustration + 8 icon được tạo; manifest hợp lệ; không dùng các file `imagegen.png` mơ hồ.

- [ ] **Step 4: Tạo registry có fallback**

```tsx
export type TeacherDashboardVisualName =
  | 'teacher-welcome'
  | 'ai-quiz-robot'
  | 'manual-quiz'
  | 'classroom'
  | 'test'
  | 'assignment'
  | 'live-exam'
  | 'results'
  | 'certificate'
  | 'quiz-management'
  | 'students';

export interface TeacherDashboardVisualProps {
  name: TeacherDashboardVisualName;
  alt?: string;
  decorative?: boolean;
  className?: string;
  loading?: 'eager' | 'lazy';
}
```

`TeacherDashboardVisual` dùng `onError` để chuyển sang fallback semantic hiện có; không tạo vòng lặp lỗi và không hiển thị broken-image glyph.

- [ ] **Step 5: Mở rộng token màu**

```css
:root {
  --color-dashboard-blue: #2563eb;
  --color-dashboard-blue-soft: #eff6ff;
  --color-dashboard-cyan-soft: #ecfeff;
  --color-dashboard-green-soft: #ecfdf5;
  --color-dashboard-violet-soft: #f5f3ff;
  --color-dashboard-orange-soft: #fff7ed;
  --color-dashboard-rose-soft: #fff1f2;
  --color-dashboard-shell: #f8fafc;
  --dashboard-card-shadow: 0 10px 30px rgb(30 64 175 / 0.06);
}
```

- [ ] **Step 6: Tạo class config có kiểu rõ ràng**

```ts
export type DashboardTone = 'blue' | 'green' | 'violet' | 'orange' | 'rose' | 'cyan';

export const dashboardToneClasses: Record<DashboardTone, {
  surface: string;
  icon: string;
  text: string;
  border: string;
}> = {
  blue: { surface: 'bg-blue-50', icon: 'bg-blue-100 text-blue-700', text: 'text-blue-700', border: 'border-blue-100' },
  green: { surface: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-700', border: 'border-emerald-100' },
  violet: { surface: 'bg-violet-50', icon: 'bg-violet-100 text-violet-700', text: 'text-violet-700', border: 'border-violet-100' },
  orange: { surface: 'bg-orange-50', icon: 'bg-orange-100 text-orange-700', text: 'text-orange-700', border: 'border-orange-100' },
  rose: { surface: 'bg-rose-50', icon: 'bg-rose-100 text-rose-700', text: 'text-rose-700', border: 'border-rose-100' },
  cyan: { surface: 'bg-cyan-50', icon: 'bg-cyan-100 text-cyan-700', text: 'text-cyan-700', border: 'border-cyan-100' },
};
```

- [ ] **Step 7: Mở rộng test token và asset**

Đưa các file mới vào `overviewFiles`, tiếp tục cấm raw hex trong TSX, kiểm tra asset manifest, kích thước khai báo và fallback.

- [ ] **Step 8: Chạy test**

```powershell
npm run test:run -- tests/TeacherDashboardAssets.test.tsx tests/teacherOverviewA11y.test.tsx
```

Expected: PASS; không có file thiếu, không asset nào vượt budget.

---

### Task 4: Làm sạch sidebar desktop

**Files:**
- Modify: `src/components/TeacherDashboard/Sidebar.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardLayout.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/types.ts`
- Test: `tests/TeacherSidebarAccessibility.test.tsx`

**Interfaces:**
- Removes from Sidebar: `manualQuizWorkspaceEnabled`, `onCreateQuizWithAi`, `onCreateQuizManually`.
- Keeps: `activeTab`, `setActiveTab`, gift shop flag, logout, mobile drawer state.

- [ ] **Step 1: Chạy GitNexus impact cho `Sidebar` và `TeacherDashboardLayout`**

- [ ] **Step 2: Gỡ import và props tạo đề**

```tsx
export interface SidebarProps {
  activeTab: TeacherDashboardTab;
  setActiveTab: (tab: TeacherDashboardTab) => void;
  isGiftShopEnabled?: boolean;
  onLogout: () => void;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
}
```

- [ ] **Step 3: Đưa Tổng quan ngay dưới logo**

```tsx
<div className="shrink-0 border-b border-slate-200 bg-white px-3 py-3">
  <NavButton item={{ id: 'overview', label: 'Tổng quan', icon: <Home className="size-5" /> }} />
</div>
```

- [ ] **Step 4: Đổi desktop width 248px → 240px**

```tsx
<aside className="... w-[240px] ..." />
<div className="... lg:ml-[240px] lg:w-[calc(100%-240px)] ..." />
```

- [ ] **Step 5: Chạy test**

```powershell
npm run test:run -- tests/TeacherSidebarAccessibility.test.tsx tests/TeacherDashboardShell.test.tsx
```

Expected: sidebar không có CTA tạo đề, accordion và Escape vẫn hoạt động.

---

### Task 5: Thêm mobile app bar và bottom navigation

**Files:**
- Create: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherMobileBottomNav.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardHeader.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardLayout.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/types.ts`
- Test: `tests/TeacherMobileBottomNav.test.tsx`

**Interfaces:**

```ts
interface TeacherMobileBottomNavProps {
  activeTab: TeacherDashboardTab;
  onSelectTab: (tab: TeacherDashboardTab) => void;
  onOpenMore: () => void;
}
```

- [ ] **Step 1: Viết test đỏ cho năm mục**

```tsx
expect(screen.getByRole('button', { name: 'Tổng quan' })).toHaveAttribute('aria-current', 'page');
fireEvent.click(screen.getByRole('button', { name: 'Đề thi' }));
expect(onSelectTab).toHaveBeenCalledWith('manage');
fireEvent.click(screen.getByRole('button', { name: 'Thêm' }));
expect(onOpenMore).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Tạo mapping route thật**

```ts
const items = [
  { id: 'overview', label: 'Tổng quan', icon: Home },
  { id: 'manage', label: 'Đề thi', icon: FileText },
  { id: 'classes', label: 'Học sinh', icon: UsersRound },
  { id: 'results', label: 'Kết quả', icon: ChartNoAxesColumnIncreasing },
] as const;
```

- [ ] **Step 3: Tạo nút “Thêm” mở drawer**

```tsx
<button type="button" onClick={onOpenMore} aria-label="Mở thêm chức năng">
  <LayoutGrid aria-hidden="true" />
  <span>Thêm</span>
</button>
```

- [ ] **Step 4: Gắn bottom nav vào layout**

```tsx
<TeacherMobileBottomNav
  activeTab={props.activeTab}
  onSelectTab={props.selectTab}
  onOpenMore={() => props.setIsMobileMenuOpen(true)}
/>
```

- [ ] **Step 5: Chừa safe area**

```tsx
<main className="... pb-24 lg:pb-8" />
<nav className="fixed inset-x-0 bottom-0 z-40 ... pb-[env(safe-area-inset-bottom)] lg:hidden" />
```

- [ ] **Step 6: Chuyển header mobile thành hai hàng**

Mobile row 1: logo + notification + account avatar. Mobile row 2: “Dashboard giáo viên” + active label. Desktop giữ search và account label đầy đủ.

- [ ] **Step 7: Chạy test**

```powershell
npm run test:run -- tests/TeacherMobileBottomNav.test.tsx tests/TeacherDashboardShell.test.tsx tests/TeacherSidebarAccessibility.test.tsx
```

---

### Task 6: Tách hero và KPI thành hai vùng responsive

**Files:**
- Create: `src/components/TeacherDashboard/overview/DashboardKpiGrid.tsx`
- Modify: `src/components/TeacherDashboard/overview/DashboardHero.tsx`
- Modify: `src/components/TeacherDashboard/OverviewTab.tsx`
- Modify: `src/components/TeacherDashboard/overview/index.ts`
- Test: `tests/TeacherDashboardColorfulOverview.test.tsx`

**Interfaces:**

```ts
export interface DashboardKpi {
  id: 'today-submissions' | 'pass-rate' | 'students';
  label: string;
  value: string | number;
  helper: string;
  tone: 'blue' | 'green' | 'violet';
  icon: React.ElementType;
}
```

- [ ] **Step 1: Viết test dữ liệu thật**

```tsx
expect(screen.getByText('Lượt nộp hôm nay')).toBeInTheDocument();
expect(screen.getByText('Tỷ lệ đạt')).toBeInTheDocument();
expect(screen.getByText('Học sinh')).toBeInTheDocument();
expect(screen.queryByText(/mục tiêu 80%/i)).not.toBeInTheDocument();
```

- [ ] **Step 2: Thu gọn `DashboardHero`**

`DashboardHero` chỉ nhận greeting, tên, ngày, scope và role; bỏ ba prop KPI.

```tsx
<section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 text-white shadow-[var(--dashboard-card-shadow)]">
  <div className="relative z-10 max-w-2xl p-5 sm:p-7 lg:p-8">...</div>
  <TeacherDashboardVisual
    name="teacher-welcome"
    decorative
    loading="eager"
    className="pointer-events-none absolute bottom-0 right-0 h-full w-auto object-contain"
  />
</section>
```

- [ ] **Step 3: Tạo KPI grid không sparkline**

Mobile 320–479: horizontal snap có phần card kế tiếp lộ ra. Từ `sm`: ba cột.

```tsx
<dl className="grid auto-cols-[82%] grid-flow-col gap-3 overflow-x-auto snap-x snap-mandatory pb-1 sm:grid-flow-row sm:grid-cols-3 sm:auto-cols-auto sm:overflow-visible xl:grid-cols-1">
```

- [ ] **Step 4: Bố trí top grid**

```tsx
<div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(360px,5fr)]">
  <DashboardHero ... />
  <DashboardKpiGrid metrics={topMetrics} isLoading={isSummaryLoading} />
</div>
```

- [ ] **Step 5: Không render `MetricGrid` cũ**

Tạm thời gỡ khỏi `OverviewTab`; xóa file ở Task 10 sau khi toàn bộ test đã chuyển.

- [ ] **Step 6: Chạy test**

```powershell
npm run test:run -- tests/TeacherDashboardColorfulOverview.test.tsx tests/TeacherOverview.test.tsx tests/teacherOverviewAxe.test.tsx
```

---

### Task 7: Thiết kế lại khu vực tạo đề

**Files:**
- Modify: `src/components/TeacherDashboard/quiz-creation/QuizCreationActions.tsx`
- Modify: `src/components/TeacherDashboard/overview/QuizCreationChoicePanel.tsx`
- Modify: `src/components/TeacherDashboard/overview/TeacherDashboardVisual.tsx`
- Modify: `src/components/TeacherDashboard/OverviewTab.tsx`
- Test: `tests/QuizCreationActions.test.tsx`
- Test: `tests/QuizCreationChoicePanel.test.tsx`
- Test: `tests/TeacherDashboardAssets.test.tsx`

**Interfaces:**

```ts
interface QuizCreationChoicePanelProps {
  manualQuizWorkspaceEnabled: boolean;
  onCreateWithAi: () => void;
  onCreateManually: () => void;
}
```

- [ ] **Step 1: Viết test legacy panel luôn tồn tại**

- [ ] **Step 2: Loại bỏ layout `sidebar`**

```ts
export interface QuizCreationActionsProps {
  layout: 'cards' | 'compact';
  manualEnabled?: boolean;
  onCreateWithAi: () => void;
  onCreateManually: () => void;
}
```

- [ ] **Step 3: Card là một button duy nhất**

Không đặt button con trong card button. CTA “Bắt đầu với AI” chỉ là visual label.

```tsx
<button type="button" className="group relative min-h-28 overflow-hidden rounded-2xl ...">
  <span className="...">AI icon</span>
  <span className="min-w-0 flex-1">...</span>
  <span aria-hidden="true" className="inline-flex items-center ...">Bắt đầu <ArrowRight /></span>
</button>
```

- [ ] **Step 4: Tích hợp illustration và màu card**

- AI: nền blue-50/white, CTA xanh dương, dùng `<TeacherDashboardVisual name="ai-quiz-robot" decorative />`; không đặt chữ trắng trên gradient nhạt.
- Manual: nền emerald-50/white, CTA xanh lá, dùng `<TeacherDashboardVisual name="manual-quiz" decorative />`.
- Illustration chiếm tối đa 38% chiều ngang card desktop và không đè CTA/copy.
- Mobile: xếp dọc, illustration chuyển xuống góc phải và giới hạn chiều cao 112px.
- Desktop: hai cột, cao khoảng 132–156px để asset không bị cắt.
- Khi ảnh lỗi, fallback icon vẫn giữ kích thước và card không thay đổi chiều cao.

- [ ] **Step 5: Flag tắt**

Render một card primary full-width “Tạo đề mới”, gọi `onCreateWithAi`/legacy create route.

- [ ] **Step 6: Chạy test**

```powershell
npm run test:run -- tests/QuizCreationActions.test.tsx tests/QuizCreationChoicePanel.test.tsx tests/TeacherOverview.test.tsx
```

---

### Task 8: Chuyển Action Center thành danh sách màu gọn

**Files:**
- Create: `src/components/TeacherDashboard/overview/action-center/ActionCenterItem.tsx`
- Modify: `src/components/TeacherDashboard/overview/ActionCenterPanel.tsx`
- Test: `tests/TeacherDashboardColorfulOverview.test.tsx`
- Test: test Action Center hiện có nếu có.

**Interfaces:**

```ts
interface ActionCenterItemProps {
  item: TeacherActionItem;
  deletingDraftId: string | null;
  onSecondaryAction: (action: TeacherActionMutation) => void;
}
```

- [ ] **Step 1: Giữ nguyên contract và mutation**

Không sửa `teacher-action-center.contract`, service hoặc Worker.

- [ ] **Step 2: Chuyển grid hai cột thành list một cột**

```tsx
<ul className="mt-4 space-y-2">
  {data.items.map(item => <li key={item.id}><ActionCenterItem ... /></li>)}
</ul>
```

- [ ] **Step 3: Tone theo severity**

```ts
critical → rose
warning  → orange
info     → blue/cyan
```

Mỗi hàng gồm icon, title, explanation, count badge, CTA arrow. Secondary action “Xóa bản nháp” là button riêng, không lồng trong Link.

- [ ] **Step 4: Giữ loading/error/empty states**

Các trạng thái vẫn có `role=status`/`role=alert`, nhưng giảm `min-height` trên mobile.

- [ ] **Step 5: Chạy test**

```powershell
npm run test:run -- tests/TeacherDashboardColorfulOverview.test.tsx tests/teacherOverviewAxe.test.tsx
```

---

### Task 9: Đổi quick actions thành sáu tile nhiều màu

**Files:**
- Modify: `src/components/TeacherDashboard/OverviewTab.tsx`
- Modify: `src/components/TeacherDashboard/overview/QuickActionGrid.tsx`
- Modify: `src/components/TeacherDashboard/overview/TeacherDashboardVisual.tsx`
- Modify: `src/components/TeacherDashboard/overview/dashboardVisualConfig.ts`
- Test: `tests/TeacherOverview.test.tsx`
- Test: `tests/TeacherDashboardAssets.test.tsx`

**Interfaces:**

Quick action mới:

```ts
[
  { tab: 'manage', title: 'Quản lý đề', tone: 'blue' },
  { tab: 'live-exam', title: 'Thi trực tiếp', tone: 'green' },
  { tab: 'assignments', title: 'Dạy và giao bài', tone: 'violet' },
  { tab: 'classes', title: 'Học sinh', tone: 'cyan' },
  { tab: 'results', title: 'Báo cáo', tone: 'orange' },
  { tab: 'certificates', title: 'Chứng nhận', tone: 'rose' },
]
```

- [ ] **Step 1: Viết test có sáu action và route đúng**

- [ ] **Step 2: Thu gọn interface**

```ts
export interface DashboardQuickAction {
  tab: TeacherDashboardTab;
  title: string;
  visual: Extract<TeacherDashboardVisualName,
    'assignment' | 'live-exam' | 'results' | 'classroom' | 'certificate' | 'quiz-management'>;
  tone: DashboardTone;
}
```

Bỏ description dài khỏi visual tile; có thể dùng `aria-description` hoặc `title` nếu cần.

- [ ] **Step 3: Responsive grid**

```tsx
<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
```

- [ ] **Step 4: Giảm motion**

Chỉ dùng đổi nền/viền nhẹ; không nâng card mạnh. Tất cả transition bị vô hiệu bởi reduced-motion token hiện có.

- [ ] **Step 5: Chạy test**

```powershell
npm run test:run -- tests/TeacherOverview.test.tsx tests/teacherOverviewAxe.test.tsx
```

---

### Task 10: Gọn hóa ba panel phân tích cuối trang

**Files:**
- Modify: `src/components/TeacherDashboard/overview/PerformancePanel.tsx`
- Modify: `src/components/TeacherDashboard/overview/RecentSubmissionsPanel.tsx`
- Modify: `src/components/TeacherDashboard/overview/RecentQuizzesPanel.tsx`
- Modify: `src/components/TeacherDashboard/OverviewTab.tsx`
- Test: `tests/TeacherOverview.test.tsx`

**Interfaces:**
- `RecentQuizzesPanel` mới chỉ nhận `quizzes`, `onManageQuizzes`, `totalQuizCount`.
- Gỡ props tạo đề khỏi RecentQuizzesPanel.

- [ ] **Step 1: PerformancePanel dùng donut thật**

Dùng CSS `conic-gradient` hoặc SVG, không thêm dependency:

```tsx
<div
  role="img"
  aria-label={`Tỷ lệ đạt ${statistics.passRate}%, ${statistics.passCount} bài đạt, ${statistics.failCount} bài chưa đạt`}
  style={{ background: `conic-gradient(var(--color-success) ${statistics.passRate}%, var(--color-dashboard-rose-soft) 0)` }}
/>
```

Giữ điểm trung bình, median, max, min bằng text thật. Score distribution vẫn có danh sách accessible; có thể ẩn visual bar ở mobile.

- [ ] **Step 2: RecentSubmissionsPanel thành compact list**

Tối đa 3–5 dòng, icon màu theo trạng thái; không thay đổi dữ liệu lọc theo ngày/lớp.

- [ ] **Step 3: RecentQuizzesPanel thành compact list**

Bỏ table trong Overview. Mỗi item hiển thị title, lớp, số câu, ngày tạo và nút quản lý. Trang `ManageTab` vẫn là nơi có bảng đầy đủ.

- [ ] **Step 4: Bố trí 3 panel**

```tsx
<div className="grid min-w-0 gap-4 xl:grid-cols-3">
  <PerformancePanel ... />
  <RecentSubmissionsPanel ... />
  <RecentQuizzesPanel ... />
</div>
```

Mobile và tablet xếp dọc; không tạo horizontal overflow.

- [ ] **Step 5: Chạy test**

```powershell
npm run test:run -- tests/TeacherOverview.test.tsx tests/teacherOverviewAxe.test.tsx
```

---

### Task 11: Hoàn thiện composition và xóa code cũ

**Files:**
- Modify: `src/components/TeacherDashboard/OverviewTab.tsx`
- Modify: `src/components/TeacherDashboard/overview/index.ts`
- Delete: `src/components/TeacherDashboard/overview/MetricGrid.tsx`
- Modify: `tests/teacherOverviewA11y.test.tsx`
- Modify: `tests/TeacherOverview.test.tsx`

**Interfaces:**
- Produces thứ tự cuối cùng: hero/KPI → create/action → quick actions → analytics.

- [ ] **Step 1: Composition desktop**

```tsx
<div className="mx-auto w-full max-w-[1440px] space-y-4 sm:space-y-5 lg:space-y-6">
  <TopOverviewGrid />
  {showAlert && <LoadErrorAlert />}
  <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(360px,5fr)]">
    <QuizCreationChoicePanel ... />
    <ActionCenterPanel />
  </div>
  <QuickActionGrid ... />
  <div className="grid gap-4 xl:grid-cols-3">...</div>
</div>
```

- [ ] **Step 2: Gỡ MetricGrid export/import/type**

- [ ] **Step 3: Sửa admin/teacher copy**

Không dùng dữ liệu mẫu. Greeting lấy từ auth và giờ hệ thống; scope giữ `Toàn trường` hoặc `Lớp X`.

- [ ] **Step 4: Chạy focused suite**

```powershell
npm run test:run -- tests/TeacherDashboardColorfulOverview.test.tsx tests/TeacherOverview.test.tsx tests/TeacherSidebarAccessibility.test.tsx tests/TeacherMobileBottomNav.test.tsx tests/QuizCreationActions.test.tsx tests/QuizCreationChoicePanel.test.tsx tests/teacherOverviewA11y.test.tsx tests/teacherOverviewAxe.test.tsx tests/TeacherDashboardShell.test.tsx
```

Expected: PASS.

---

### Task 12: Cập nhật Cypress cho route và responsive thật

**Files:**
- Create: `cypress/e2e/teacher-dashboard-responsive-redesign.cy.ts`
- Modify: `cypress/e2e/quiz-creation-entry-points.cy.ts`
- Optional modify: `cypress/e2e/mobile-responsive.cy.ts`

**Interfaces:**
- Desktop sidebar không còn tạo đề.
- Tạo đề qua panel chính và search.
- Mobile dùng bottom nav + drawer “Thêm”.

- [ ] **Step 1: Sửa E2E entry points**

Loại bỏ hai case bấm CTA trong sidebar. Giữ:

```text
- AI từ panel Overview
- Manual từ panel Overview
- Browser Back từ manual workspace
- Dashboard search AI/manual
```

- [ ] **Step 2: Viết desktop visual structure test**

```ts
cy.viewport(1440, 1000);
cy.get('aside').contains('Tạo đề bằng AI').should('not.exist');
cy.contains('h2', 'Tạo đề kiểm tra').should('be.visible');
cy.contains('h2', 'Việc cần chú ý hôm nay').should('be.visible');
cy.get('[data-testid="teacher-mobile-bottom-nav"]').should('not.be.visible');
```

- [ ] **Step 3: Viết mobile 390×844**

```ts
cy.viewport(390, 844);
cy.get('[data-testid="teacher-mobile-bottom-nav"]').should('be.visible');
cy.get('body').then($body => {
  expect($body[0].scrollWidth).to.eq($body[0].clientWidth);
});
cy.contains('button', 'Tạo đề bằng AI').should('be.visible');
cy.contains('button', 'Soạn đề thủ công').should('be.visible');
cy.get('[data-testid="teacher-mobile-bottom-nav"]').contains('button', 'Thêm').click();
cy.get('aside').should('be.visible');
```

- [ ] **Step 4: Viết breakpoint tests**

Chạy 320×740, 768×1024, 1024×768, 1440×1000.

- [ ] **Step 5: Chạy Cypress**

```powershell
npx cypress run --e2e --spec "cypress/e2e/teacher-dashboard-responsive-redesign.cy.ts,cypress/e2e/quiz-creation-entry-points.cy.ts"
```

Expected: PASS.

---

### Task 13: Accessibility, performance và browser review

**Files:**
- Modify tests only nếu phát hiện lỗi.

- [ ] **Step 1: Axe unit audit**

```powershell
npm run test:run -- tests/teacherOverviewAxe.test.tsx
```

- [ ] **Step 2: Keyboard review**

Kiểm tra Tab/Shift+Tab:

```text
Header actions → create cards → action rows → quick actions → analytics actions → bottom nav.
```

Không có nested interactive, focus không bị che bởi bottom nav.

- [ ] **Step 3: Color contrast**

Kiểm tra text trên gradient AI/hero, badge severity, pastel quick actions. Normal text ≥ 4.5:1, large text ≥ 3:1.

- [ ] **Step 4: Playwright visual review**

Capture và so sánh:

```text
1440×1000 desktop
1024×768 compact desktop/tablet
768×1024 tablet
390×844 mobile
320×740 small mobile
```

Checklist:

```text
- Không horizontal overflow
- Bottom nav không che nội dung
- Drawer mở/đóng đúng
- KPI swipe/snap dùng được
- Hero asset không méo/cắt chữ
- Card AI/manual không quá cao
- Empty/loading/error states không vỡ layout
```

- [ ] **Step 5: Performance**

```powershell
npm run build
npm run perf:budget
```

Hero asset ≤ 120 KB và lazy/decode async. Không thêm chart dependency.

---

### Task 14: Full verification và primary review

**Files:**
- Không thêm scope mới.

- [ ] **Step 1: Focused tests**

```powershell
npm run test:run -- tests/TeacherDashboardColorfulOverview.test.tsx tests/TeacherOverview.test.tsx tests/TeacherSidebarAccessibility.test.tsx tests/TeacherMobileBottomNav.test.tsx tests/QuizCreationActions.test.tsx tests/QuizCreationChoicePanel.test.tsx tests/TeacherDashboardShell.test.tsx tests/teacherOverviewA11y.test.tsx tests/teacherOverviewAxe.test.tsx
```

- [ ] **Step 2: Quality gates**

```powershell
npm run lint
npm run typecheck
npm run typecheck:strict
npm run typecheck:workers
npm run test:ci:all
npm run build
npm run perf:budget
npm run security:scan
```

- [ ] **Step 3: Diff hygiene**

```powershell
git diff --check
git status --short
git diff --stat
```

- [ ] **Step 4: GitNexus detect changes**

```text
detect_changes(scope="compare", base_ref="main")
```

Expected: chỉ ảnh hưởng Teacher Dashboard UI và các test liên quan; không có API/Worker/D1 process.

- [ ] **Step 5: Primary review**

Review theo:

```text
- Plan compliance
- Route preservation
- Feature flag fallback
- Data truthfulness
- Responsive behavior
- Accessibility
- Performance
- Unrelated worktree changes
- Rollback
```

- [ ] **Step 6: Báo cáo, chưa commit**

Dừng để người dùng kiểm tra ảnh browser thực tế. Chỉ commit khi có lệnh riêng.

---

## Phase 1 Visual Approval Gate

Sau Task 13, tạo ảnh chụp browser thật ở 1440×1000, 1024×768, 768×1024, 390×844 và 320×740. Báo cáo phải kèm:

```text
- ảnh desktop đầy đủ;
- ảnh mobile đầy đủ;
- danh sách asset production và byte size;
- những điểm khác mockup do dữ liệu/quyền/responsive thật;
- lỗi còn tồn tại, nếu có.
```

Dừng tại đây để người dùng duyệt. Không bắt đầu giai đoạn 2 (Quản lý đề, Giao bài, Kết quả, Lớp học, Chứng nhận) cho đến khi nhận được chấp thuận rõ ràng.

## Acceptance Criteria

- [ ] Bộ 3 illustration và 8 icon tùy biến đã được chuẩn hóa, có manifest và không còn nền xám/artefact.
- [ ] Không có chữ, logo giả hoặc số liệu bị bake vào illustration.
- [ ] Asset chính dùng WebP, đúng tỷ lệ, không méo; illustration ≤160 KB, icon ≤32 KB.
- [ ] Mọi asset có width/height cố định, decoding async và fallback không gây layout shift.
- [ ] Desktop sidebar không còn hai CTA tạo đề lớn; mục tạo đề vẫn dễ tìm qua điều hướng và khu vực tạo đề chính.
- [ ] Overview có hero gradient và ba KPI nhiều màu dùng dữ liệu thật.
- [ ] Không có sparkline hoặc mục tiêu giả.
- [ ] AI/manual hoạt động từ khu vực tạo đề, route không đổi.
- [ ] Khi feature flag tắt, có một card legacy “Tạo đề mới”.
- [ ] Action Center hiển thị list màu từ dữ liệu thật và xóa bản nháp vẫn hoạt động.
- [ ] Quick actions có sáu tile, điều hướng đúng tab.
- [ ] Recent quizzes không lặp CTA tạo đề.
- [ ] Mobile có bottom nav và “Thêm” mở drawer đầy đủ.
- [ ] 320px và 390px không horizontal overflow.
- [ ] Bottom nav không che nội dung hoặc dialog.
- [ ] Keyboard và screen reader dùng được.
- [ ] Không có serious/critical axe violation.
- [ ] Lint, typecheck, tests, build, perf budget và security scan đều PASS.
- [ ] Không có thay đổi API, Worker, D1 hoặc production data.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Mockup mobile không phản ánh 390px thật | Card bị quá nhỏ hoặc tràn | Horizontal snap KPI; stack các section; test 320/390 |
| Màu sắc quá nhiều làm rối | Giảm khả năng quét | Một tone cho mỗi loại nội dung; nền pastel, text contrast cao |
| Bottom nav che nội dung | Không bấm được nút cuối | `pb-24`, safe-area inset, Playwright ở iPhone-sized viewport |
| Bottom nav tạo route không tồn tại | Navigation lỗi | Chỉ map tab thật; “Thêm” mở drawer |
| Sparklines gây hiểu nhầm | Hiển thị dữ liệu không có thật | Không triển khai trend khi API chưa cung cấp time series |
| Source artwork có nền xám/gradient hoặc ánh sáng không đồng nhất | Asset nhìn như ảnh dán, không hòa vào UI | Pipeline Sharp + visual inspection; không đạt thì tạo lại, không che bằng CSS |
| Bộ icon thiếu một số chức năng hoặc khác phong cách | Giao diện trộn nhiều hệ icon | Hoàn thiện đủ 8 semantic icon trước khi tích hợp; registry dùng Lucide chỉ làm fallback |
| Asset tăng tải trang | Chậm LCP hoặc layout shift | Hero ≤160 KB, mỗi icon ≤32 KB, width/height cố định, lazy-load dưới fold, preload chỉ khi đo LCP chứng minh cần |
| Gỡ CTA ở sidebar làm giảm discoverability | Người dùng khó tìm tạo đề | Khu vực tạo đề nằm ngay sau hero; search vẫn tìm AI/manual |
| Thay RecentQuizzes table làm mất thông tin | Người dùng thiếu chi tiết | Overview chỉ là compact list; ManageTab vẫn giữ bảng đầy đủ |
| Thay layout ảnh hưởng test cũ | CI fail | TDD cập nhật contract trước, chạy focused suite mỗi task |
| Thay đổi lẫn file cá nhân | Commit bẩn | Triển khai trong worktree riêng từ `origin/main` |

## Rollback

- Revert commit/PR UI; không cần rollback database.
- Hero asset có thể xóa độc lập.
- Nếu bottom nav gây vấn đề, tắt render `TeacherMobileBottomNav` và khôi phục hamburger hiện có mà không ảnh hưởng route.
- Nếu colorful layout cần rollout thận trọng, có thể bọc Overview composition mới bằng feature flag frontend `VITE_FEATURE_COLORFUL_TEACHER_DASHBOARD_V1`; mặc định chỉ bật sau khi visual QA đạt. Không cần flag nếu người dùng duyệt triển khai trực tiếp toàn bộ.

## Stop Conditions

Dừng và báo người dùng khi:

- GitNexus trả HIGH/CRITICAL.
- Phát hiện cần sửa API/Worker/D1 để giống mockup.
- Cần thêm dữ liệu trend hoặc cảnh báo chưa tồn tại.
- Accessibility contrast không đạt với palette đã chọn.
- Bundle/performance budget vượt giới hạn.
- Baseline test đang fail trước khi bắt đầu.
- Phát hiện thay đổi không liên quan trong worktree.
- Cần commit, push, merge hoặc deploy nhưng chưa có lệnh riêng.

## Execution Recommendation

Khuyến nghị dùng **Subagent-Driven Development** theo các nhóm độc lập:

1. Asset normalization + registry + visual tokens.
2. Shell desktop/mobile.
3. Hero + KPI + creation cards.
4. Action Center + quick actions + analytics panels.
5. Tests + browser visual/accessibility review + Phase 1 approval gate.

Mỗi nhóm phải qua focused tests và review trước khi chuyển nhóm tiếp theo.
