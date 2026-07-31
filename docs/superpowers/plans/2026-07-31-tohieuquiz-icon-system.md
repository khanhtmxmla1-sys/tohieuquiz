# TôHiệuQuiz Icon System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuẩn hóa 12 icon thương hiệu và áp dụng sáu icon vào khu “Thao tác nhanh” của Dashboard giáo viên.

**Architecture:** Asset được lưu trong `public/icons/tohieuquiz/`. Component `TohieuIcon` là điểm truy cập duy nhất tới asset và xuất kiểu `TohieuIconName`; `OverviewTab` chỉ cấu hình tên icon, còn `QuickActionGrid` chịu trách nhiệm trình bày.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Mỗi icon là một file WebP 256 × 256 px, nền trong suốt.
- Không thêm dependency mới.
- Icon module dùng 48 px trong Quick Action; icon thao tác nhỏ tiếp tục dùng Lucide.
- Icon cạnh nhãn chữ là decorative: `alt=""`, `aria-hidden="true"`.
- Không thay đổi hành vi điều hướng hoặc nghiệp vụ.

---

### Task 1: Chuẩn hóa và nhập 12 asset

**Files:**
- Create: `public/icons/tohieuquiz/overview.webp`
- Create: `public/icons/tohieuquiz/quiz-create.webp`
- Create: `public/icons/tohieuquiz/quiz-management.webp`
- Create: `public/icons/tohieuquiz/assignment.webp`
- Create: `public/icons/tohieuquiz/classroom.webp`
- Create: `public/icons/tohieuquiz/live-exam.webp`
- Create: `public/icons/tohieuquiz/learning-results.webp`
- Create: `public/icons/tohieuquiz/certificate.webp`
- Create: `public/icons/tohieuquiz/parent-portal.webp`
- Create: `public/icons/tohieuquiz/notification.webp`
- Create: `public/icons/tohieuquiz/gift-shop.webp`
- Create: `public/icons/tohieuquiz/settings.webp`

**Interfaces:**
- Produces: public URLs `/icons/tohieuquiz/<name>.webp`.

- [ ] **Step 1: Chuẩn hóa ảnh nguồn**

Crop theo alpha thực, đặt vào canvas vuông, resize 256 × 256 và xuất WebP có alpha.

- [ ] **Step 2: Chép asset vào dự án**

Tạo thư mục và chép đúng 12 file với tên trong danh sách.

- [ ] **Step 3: Xác minh asset**

Run:
```bash
node -e "const fs=require('fs'); const p='public/icons/tohieuquiz'; console.log(fs.readdirSync(p).filter(f=>f.endsWith('.webp')).length)"
```
Expected: `12`.

- [ ] **Step 4: Commit**

```bash
git add public/icons/tohieuquiz
git commit -m "feat(ui): add TohieuQuiz brand icon assets"
```

### Task 2: Tạo component icon dùng chung

**Files:**
- Create: `src/components/icons/TohieuIcon.tsx`
- Create: `tests/TohieuIcon.test.tsx`

**Interfaces:**
- Produces: `TohieuIconName` union type.
- Produces: `TohieuIcon({ name, size?, className?, alt?, decorative? })`.

- [ ] **Step 1: Viết test thất bại**

Test phải xác nhận `quiz-create` ánh xạ tới `/icons/tohieuquiz/quiz-create.webp`, mặc định 48 × 48, decorative icon có `alt=""` và `aria-hidden="true"`, icon có nội dung dùng alt được truyền vào.

- [ ] **Step 2: Chạy test và xác nhận thất bại**

Run:
```bash
npx vitest run tests/TohieuIcon.test.tsx
```
Expected: FAIL vì component chưa tồn tại.

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo map `Record<TohieuIconName, string>` đủ 12 tên và component `img` có `width`, `height`, `decoding="async"`, `draggable={false}`.

- [ ] **Step 4: Chạy test và xác nhận pass**

Run:
```bash
npx vitest run tests/TohieuIcon.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/icons/TohieuIcon.tsx tests/TohieuIcon.test.tsx
git commit -m "feat(ui): add reusable TohieuQuiz icon component"
```

### Task 3: Áp dụng vào Quick Action Dashboard

**Files:**
- Modify: `src/components/TeacherDashboard/OverviewTab.tsx`
- Modify: `src/components/TeacherDashboard/overview/QuickActionGrid.tsx`
- Modify: `tests/TeacherOverview.test.tsx`

**Interfaces:**
- Consumes: `TohieuIconName` và `TohieuIcon` từ Task 2.
- Produces: `DashboardQuickAction.icon: TohieuIconName`.

- [ ] **Step 1: Bổ sung test Dashboard**

Render `OverviewTab`, xác nhận có sáu ảnh với các URL: `quiz-create`, `assignment`, `live-exam`, `learning-results`, `classroom`, `certificate`; đồng thời click button “Tạo đề mới” vẫn gọi `onSelectTab('create')`.

- [ ] **Step 2: Chạy test và xác nhận thất bại**

Run:
```bash
npx vitest run tests/TeacherOverview.test.tsx
```
Expected: FAIL vì Dashboard chưa dùng asset mới.

- [ ] **Step 3: Cập nhật model và dữ liệu quick action**

Đổi `DashboardQuickAction.icon` từ `ReactElement` sang `TohieuIconName`, xóa `iconClassName`, giữ `surfaceClassName`; thay sáu icon Lucide bằng tên icon thương hiệu.

- [ ] **Step 4: Cập nhật UI**

Trong `QuickActionGrid`, render `<TohieuIcon name={action.icon} size={48} decorative />`, giữ button semantic, focus ring và layout responsive.

- [ ] **Step 5: Chạy test liên quan**

Run:
```bash
npx vitest run tests/TohieuIcon.test.tsx tests/TeacherOverview.test.tsx tests/teacherOverviewAxe.test.tsx
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/TeacherDashboard/OverviewTab.tsx src/components/TeacherDashboard/overview/QuickActionGrid.tsx tests/TeacherOverview.test.tsx
git commit -m "feat(teacher-dashboard): use TohieuQuiz icons for quick actions"
```

### Task 4: Xác minh toàn bộ thay đổi

**Files:**
- Review all changed files.

- [ ] **Step 1: Chạy lint và typecheck**

```bash
npm run lint
npm run typecheck
```
Expected: PASS.

- [ ] **Step 2: Chạy test thay đổi và build**

```bash
npm run test:run -- tests/TohieuIcon.test.tsx tests/TeacherOverview.test.tsx tests/teacherOverviewAxe.test.tsx
npm run build
```
Expected: PASS.

- [ ] **Step 3: Review diff**

Xác nhận không đổi Sidebar, nghiệp vụ, API hoặc dữ liệu; không có đường dẫn asset viết rải rác ngoài `TohieuIcon.tsx`.

- [ ] **Step 4: Commit tài liệu nếu chưa commit**

```bash
git add docs/superpowers/specs/2026-07-31-tohieuquiz-icon-system-design.md docs/superpowers/plans/2026-07-31-tohieuquiz-icon-system.md
git commit -m "docs: add TohieuQuiz icon system design and plan"
```
