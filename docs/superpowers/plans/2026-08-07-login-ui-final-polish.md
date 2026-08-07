# Login UI Final Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện vòng cuối giao diện login TôHiệuQuiz theo ảnh localhost đã duyệt mà không thay đổi logic đăng nhập.

**Architecture:** Giữ nguyên component structure hiện tại. Chỉ thêm điều kiện hiển thị global reduced-experience banner ở `App`, sau đó tinh chỉnh Tailwind classes/copy trong login landing components. Không tạo abstraction hoặc dependency mới.

**Tech Stack:** React 19, TypeScript, Vite 6, Tailwind CSS v4, Vitest, Testing Library, Playwright.

## Global Constraints
- Không thay đổi API/auth/passkey/remember-login/notification flow.
- Không thêm dependency.
- Không commit, push hoặc deploy.
- Form phải đứng trước hero trên viewport dưới `lg`.
- Không horizontal overflow ở 390, 768, 1024, 1440.

---

### Task 1: Hide reduced-experience banner on unauthenticated root login

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `tests/AppShell.test.tsx`

**Interfaces:**
- Consumes: `useAuthStore().isLoggedIn`, `useClassroomStore().studentSession`, `useLocation().pathname`.
- Produces: global banner remains unchanged except hidden on main `/` while both sessions are absent.

- [ ] Add a failing App shell test that forces reduced-experience mode and asserts the banner is absent on unauthenticated `/`.
- [ ] Add a companion assertion that the banner is still available in an authenticated/non-login context.
- [ ] Run focused test and confirm expected failure.
- [ ] Add the smallest conditional render in `App.tsx`.
- [ ] Run focused test and confirm pass.

### Task 2: Rebalance hero, feature cards, preview and login card

**Files:**
- Modify: `src/components/HomePage/LoginLandingPage.tsx`
- Modify: `src/components/HomePage/components/HeroSection.tsx`
- Modify: `src/components/HomePage/components/LoginForm.tsx`
- Modify: `tests/LoginLandingPresentation.test.tsx`

**Interfaces:**
- Consumes: existing component props only.
- Produces: same DOM semantics and login behavior with tighter desktop visual hierarchy.

- [ ] Extend presentation test with the shortened third feature description and layout intent markers/classes that should change.
- [ ] Run test and confirm expected failure.
- [ ] Reduce desktop hero max size roughly 5–8%, reduce desktop column gap, and keep responsive ordering unchanged.
- [ ] Reduce feature icon/card density and use `Theo năng lực học sinh` for the third helper line.
- [ ] Reduce product preview vertical padding/chart height/shadow roughly 8–10%.
- [ ] Flatten segmented-control active shadow and slightly soften yellow decoration.
- [ ] Run focused login tests and confirm pass.

### Task 3: Browser and quality verification

**Files:** no new production files.

- [ ] Start Vite on `127.0.0.1:4173`.
- [ ] Verify 390×844, 768×1024, 1024×768 and 1440×900: no horizontal overflow; form precedes hero below `lg`; banner absent on unauthenticated login; desktop form/hero alignment improved.
- [ ] Capture screenshots for visual review.
- [ ] Run focused Vitest suite for App/login.
- [ ] Run ESLint on touched files.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build:frontend`.
- [ ] Run GitNexus `detect_changes` and local diff review.
