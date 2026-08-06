# Teacher Dashboard Mockup-Exact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the teacher overview page so its information architecture and visual composition follow the approved dashboard mockup instead of restyling the legacy page.

**Architecture:** Preserve all existing API, store, route, permission, loading and error behavior. Replace the presentation composition with focused dashboard widgets and reuse only the approved `teacher-dashboard-v2` illustrations and `dashboard-v2` icons. The mockup is the source of truth for order, hierarchy, column proportions and spacing.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Zustand, Vitest, Testing Library, Cypress.

## Global Constraints

- Do not generate or add any new visual icon or illustration.
- Reuse only assets already registered by `TeacherDashboardVisual`.
- Do not hard-code mockup statistics; derive all values from existing stores and API contracts.
- Keep all current navigation, permissions, actions, loading, empty and error behavior.
- No horizontal page overflow at 320, 390, 768, 1024 and 1440 px.
- Desktop acceptance is structural visual parity with the approved mockup, not merely a similar color palette.

---

### Task 1: Lock visual composition with tests

**Files:**
- Modify: `tests/TeacherOverview.test.tsx`
- Modify: `tests/TeacherDashboardShell.test.tsx`
- Modify: `cypress/e2e/teacher-dashboard-responsive-redesign.cy.ts`

- [ ] Assert the overview order: top grid, KPI row, creation cards, quick actions, lower dashboard grid.
- [ ] Assert desktop hero and attention panel are siblings in the same grid.
- [ ] Assert header exposes breadcrumb, global search, date, notifications and account control.
- [ ] Run focused tests and confirm failures before implementation.

### Task 2: Rebuild shell and header to match the mockup

**Files:**
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardLayout.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardHeader.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/DashboardSearchForm.tsx`

- [ ] Use a 256 px desktop sidebar and a wide content canvas with mockup spacing.
- [ ] Render breadcrumb, wide search, date chip, notification control and account menu in one desktop header row.
- [ ] Preserve the mobile menu and compact mobile heading.
- [ ] Run shell and accessibility tests.

### Task 3: Rebuild sidebar using approved assets only

**Files:**
- Modify: `src/components/TeacherDashboard/Sidebar.tsx`
- Test: `tests/TeacherSidebarAccessibility.test.tsx`

- [ ] Replace visual navigation Lucide icons with existing approved dashboard image assets where a semantic match exists.
- [ ] For entries without an approved asset, render a text-only navigation entry rather than inventing an icon.
- [ ] Group navigation as Giảng dạy, Quản lý lớp, Cá nhân and Quản trị.
- [ ] Keep desktop fixed, tablet/mobile drawer behavior, keyboard access and permissions.

### Task 4: Compose the exact mockup overview hierarchy

**Files:**
- Modify: `src/components/TeacherDashboard/OverviewTab.tsx`
- Modify: `src/components/TeacherDashboard/overview/DashboardHero.tsx`
- Modify: `src/components/TeacherDashboard/overview/ActionCenterPanel.tsx`
- Modify: `src/components/TeacherDashboard/overview/DashboardKpiGrid.tsx`

- [ ] Build a top grid with hero at two-thirds width and attention panel at one-third width.
- [ ] Make hero a white/pastel card with text left and the approved hero illustration right.
- [ ] Add class/scope pills without hard-coded classes.
- [ ] Add a compact mode to the attention panel for top-grid placement.
- [ ] Keep five KPI cards in a separate row below.

### Task 5: Match feature cards and quick actions

**Files:**
- Modify: `src/components/TeacherDashboard/overview/QuizCreationChoicePanel.tsx`
- Modify: `src/components/TeacherDashboard/quiz-creation/QuizCreationActions.tsx`
- Modify: `src/components/TeacherDashboard/overview/QuickActionGrid.tsx`

- [ ] Render two large balanced cards with approved AI/manual illustrations.
- [ ] Use mockup CTA hierarchy and card proportions.
- [ ] Render six compact quick-action tiles using only approved assets.
- [ ] Preserve all click targets and feature-flag behavior.

### Task 6: Complete the lower dashboard grid

**Files:**
- Modify: `src/components/TeacherDashboard/OverviewTab.tsx`
- Modify: `src/components/TeacherDashboard/overview/PerformancePanel.tsx`
- Modify: `src/components/TeacherDashboard/overview/RecentSubmissionsPanel.tsx`
- Modify: `src/components/TeacherDashboard/overview/RecentQuizzesPanel.tsx`
- Create: `src/components/TeacherDashboard/overview/MyClassesPanel.tsx`
- Create: `src/components/TeacherDashboard/overview/OutstandingStudentsPanel.tsx`
- Modify: `src/components/TeacherDashboard/overview/index.ts`

- [ ] Arrange score distribution and recent activity side by side.
- [ ] Add recent quizzes, classes and outstanding students cards using existing teacher/result data.
- [ ] Show honest empty states when class or ranking data is unavailable.
- [ ] Do not introduce API calls solely to populate the mockup.

### Task 7: Visual acceptance and quality gates

**Files:**
- Modify: `cypress/e2e/teacher-dashboard-responsive-redesign.cy.ts`

- [ ] Run focused Vitest tests.
- [ ] Run lint and TypeScript checks.
- [ ] Run production build and performance budget.
- [ ] Run Cypress at 320, 390, 768, 1024 and 1440 px.
- [ ] Capture a 1440 px full-page screenshot and compare section order, column proportions and whitespace against the approved mockup.
- [ ] Review git diff and stop before merge for visual approval.
