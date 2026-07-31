# TÃ´Hiá»‡uQuiz Icon System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuáº©n hÃ³a 12 icon thÆ°Æ¡ng hiá»‡u vÃ  Ã¡p dá»¥ng sÃ¡u icon vÃ o khu â€œThao tÃ¡c nhanhâ€ cá»§a Dashboard giÃ¡o viÃªn.

**Architecture:** Asset Ä‘Æ°á»£c lÆ°u trong `public/icons/tohieuquiz/`. Component `TohieuIcon` lÃ  Ä‘iá»ƒm truy cáº­p duy nháº¥t tá»›i asset vÃ  xuáº¥t kiá»ƒu `TohieuIconName`; `OverviewTab` chá»‰ cáº¥u hÃ¬nh tÃªn icon, cÃ²n `QuickActionGrid` chá»‹u trÃ¡ch nhiá»‡m trÃ¬nh bÃ y.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Má»—i icon lÃ  má»™t file WebP 256 Ã— 256 px, ná»n trong suá»‘t.
- KhÃ´ng thÃªm dependency má»›i.
- Icon module dÃ¹ng 48 px trong Quick Action; icon thao tÃ¡c nhá» tiáº¿p tá»¥c dÃ¹ng Lucide.
- Icon cáº¡nh nhÃ£n chá»¯ lÃ  decorative: `alt=""`, `aria-hidden="true"`.
- KhÃ´ng thay Ä‘á»•i hÃ nh vi Ä‘iá»u hÆ°á»›ng hoáº·c nghiá»‡p vá»¥.

---

### Task 1: Chuáº©n hÃ³a vÃ  nháº­p 12 asset

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

- [ ] **Step 1: Chuáº©n hÃ³a áº£nh nguá»“n**

Crop theo alpha thá»±c, Ä‘áº·t vÃ o canvas vuÃ´ng, resize 256 Ã— 256 vÃ  xuáº¥t WebP cÃ³ alpha.

- [ ] **Step 2: ChÃ©p asset vÃ o dá»± Ã¡n**

Táº¡o thÆ° má»¥c vÃ  chÃ©p Ä‘Ãºng 12 file vá»›i tÃªn trong danh sÃ¡ch.

- [ ] **Step 3: XÃ¡c minh asset**

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

### Task 2: Táº¡o component icon dÃ¹ng chung

**Files:**
- Create: `src/components/icons/TohieuIcon.tsx`
- Create: `tests/TohieuIcon.test.tsx`

**Interfaces:**
- Produces: `TohieuIconName` union type.
- Produces: `TohieuIcon({ name, size?, className?, alt?, decorative? })`.

- [ ] **Step 1: Viáº¿t test tháº¥t báº¡i**

Test pháº£i xÃ¡c nháº­n `quiz-create` Ã¡nh xáº¡ tá»›i `/icons/tohieuquiz/quiz-create.webp`, máº·c Ä‘á»‹nh 48 Ã— 48, decorative icon cÃ³ `alt=""` vÃ  `aria-hidden="true"`, icon cÃ³ ná»™i dung dÃ¹ng alt Ä‘Æ°á»£c truyá»n vÃ o.

- [ ] **Step 2: Cháº¡y test vÃ  xÃ¡c nháº­n tháº¥t báº¡i**

Run:
```bash
npx vitest run tests/TohieuIcon.test.tsx
```
Expected: FAIL vÃ¬ component chÆ°a tá»“n táº¡i.

- [ ] **Step 3: Viáº¿t implementation tá»‘i thiá»ƒu**

Táº¡o map `Record<TohieuIconName, string>` Ä‘á»§ 12 tÃªn vÃ  component `img` cÃ³ `width`, `height`, `decoding="async"`, `draggable={false}`.

- [ ] **Step 4: Cháº¡y test vÃ  xÃ¡c nháº­n pass**

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

### Task 3: Ãp dá»¥ng vÃ o Quick Action Dashboard

**Files:**
- Modify: `src/components/TeacherDashboard/OverviewTab.tsx`
- Modify: `src/components/TeacherDashboard/overview/QuickActionGrid.tsx`
- Modify: `tests/TeacherOverview.test.tsx`

**Interfaces:**
- Consumes: `TohieuIconName` vÃ  `TohieuIcon` tá»« Task 2.
- Produces: `DashboardQuickAction.icon: TohieuIconName`.

- [ ] **Step 1: Bá»• sung test Dashboard**

Render `OverviewTab`, xÃ¡c nháº­n cÃ³ sÃ¡u áº£nh vá»›i cÃ¡c URL: `quiz-create`, `assignment`, `live-exam`, `learning-results`, `classroom`, `certificate`; Ä‘á»“ng thá»i click button â€œTáº¡o Ä‘á» má»›iâ€ váº«n gá»i `onSelectTab('create')`.

- [ ] **Step 2: Cháº¡y test vÃ  xÃ¡c nháº­n tháº¥t báº¡i**

Run:
```bash
npx vitest run tests/TeacherOverview.test.tsx
```
Expected: FAIL vÃ¬ Dashboard chÆ°a dÃ¹ng asset má»›i.

- [ ] **Step 3: Cáº­p nháº­t model vÃ  dá»¯ liá»‡u quick action**

Äá»•i `DashboardQuickAction.icon` tá»« `ReactElement` sang `TohieuIconName`, xÃ³a `iconClassName`, giá»¯ `surfaceClassName`; thay sÃ¡u icon Lucide báº±ng tÃªn icon thÆ°Æ¡ng hiá»‡u.

- [ ] **Step 4: Cáº­p nháº­t UI**

Trong `QuickActionGrid`, render `<TohieuIcon name={action.icon} size={48} decorative />`, giá»¯ button semantic, focus ring vÃ  layout responsive.

- [ ] **Step 5: Cháº¡y test liÃªn quan**

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

### Task 4: XÃ¡c minh toÃ n bá»™ thay Ä‘á»•i

**Files:**
- Review all changed files.

- [ ] **Step 1: Cháº¡y lint vÃ  typecheck**

```bash
npm run lint
npm run typecheck
```
Expected: PASS.

- [ ] **Step 2: Cháº¡y test thay Ä‘á»•i vÃ  build**

```bash
npm run test:run -- tests/TohieuIcon.test.tsx tests/TeacherOverview.test.tsx tests/teacherOverviewAxe.test.tsx
npm run build
```
Expected: PASS.

- [ ] **Step 3: Review diff**

XÃ¡c nháº­n khÃ´ng Ä‘á»•i Sidebar, nghiá»‡p vá»¥, API hoáº·c dá»¯ liá»‡u; khÃ´ng cÃ³ Ä‘Æ°á»ng dáº«n asset viáº¿t ráº£i rÃ¡c ngoÃ i `TohieuIcon.tsx`.

- [ ] **Step 4: Commit tÃ i liá»‡u náº¿u chÆ°a commit**

```bash
git add docs/superpowers/specs/2026-07-31-tohieuquiz-icon-system-design.md docs/superpowers/plans/2026-07-31-tohieuquiz-icon-system.md
git commit -m "docs: add TohieuQuiz icon system design and plan"
```

