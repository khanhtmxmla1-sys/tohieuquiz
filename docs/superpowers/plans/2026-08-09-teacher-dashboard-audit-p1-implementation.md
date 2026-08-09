# Teacher Dashboard Audit P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Fix the five Teacher Dashboard P1 UX defects confirmed by Playwright while preserving existing routes, data contracts, responsive behavior, and visual language.

**Architecture:** Keep `OverviewTab` as the overview data/composition container and `TeacherDashboardCoreTabs` as the routing boundary. Make only presentation-level responsive/accessibility changes plus one explicit quiz-open callback. Backend APIs, auth, stores, and database contracts remain untouched.

**Tech Stack:** React, TypeScript, React Router, Tailwind CSS, Vitest + Testing Library, Cypress, Playwright MCP, GitNexus.

## Global Constraints

- Work only in `C:\quizpro\.worktrees\teacher-dashboard-audit-p1` on branch `fix/teacher-dashboard-audit-p1`.
- Preserve the existing API, Worker, D1, migration, feature-flag, auth, and storage contracts.
- Keep no-horizontal-overflow behavior at 1440, 1024, 768, 390, and 320px.
- Keep desktop sidebar behavior unchanged; solve the 1024px clipping by changing Quick Action grid breakpoints.
- Keep the four primary mobile nav items unchanged in this patch; secondary tabs map visually to `Thêm`.
- Minimum confirmed dashboard interactive target touched by this patch: 44px.
- Use TDD: add a regression test, observe RED, implement minimal GREEN, then refactor if needed.
- Do not commit, push, migrate, or deploy without explicit user permission.

---

### Task 1: Lock Quick Action responsive behavior

**Files:**
- Modify: `tests/TeacherOverview.test.tsx`
- Modify: `cypress/e2e/teacher-dashboard-responsive-redesign.cy.ts`
- Modify: `src/components/TeacherDashboard/overview/QuickActionGrid.tsx`

**Interfaces:**
- Consumes: existing `QuickActionGrid({ actions, onSelect })`.
- Produces: grid contract `2 columns -> md:3 columns -> xl:6 columns`.

- [x] **Step 1: Write the failing unit assertion**

Update the existing Quick Actions overview test to require:

```ts
expect(within(quickSection as HTMLElement).getByTestId('quick-actions-grid').className).toContain('xl:grid-cols-6');
expect(within(quickSection as HTMLElement).getByTestId('quick-actions-grid').className).not.toContain('lg:grid-cols-6');
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm run test:run -- tests/TeacherOverview.test.tsx
```

Expected: the Quick Action breakpoint assertion fails because production code still contains `lg:grid-cols-6`.

- [x] **Step 3: Implement the minimal breakpoint change**

Change the grid classes to:

```tsx
className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 xl:gap-4"
```

- [x] **Step 4: Add browser-level regression coverage**

In the 1024px Cypress branch, assert the first four action card `top` positions establish a 3-column layout and each visible title is not clipped:

```ts
cy.get('[data-testid="quick-actions-grid"] button').then(($buttons) => {
  expect($buttons).to.have.length(6);
  const firstTop = $buttons[0].getBoundingClientRect().top;
  expect($buttons[2].getBoundingClientRect().top).to.eq(firstTop);
  expect($buttons[3].getBoundingClientRect().top).to.be.greaterThan(firstTop);
});
cy.get('[data-testid="quick-actions-grid"] button > span.max-w-full').each(($title) => {
  expect($title[0].scrollWidth, $title.text()).to.be.at.most($title[0].clientWidth + 1);
});
```

- [x] **Step 5: Re-run focused unit test and confirm GREEN**

Run the same Vitest command. Expected: PASS.

---

### Task 2: Make the breadcrumb semantic and route recent quizzes correctly

**Files:**
- Modify: `tests/TeacherOverview.test.tsx`
- Modify: `src/components/TeacherDashboard/OverviewTab.tsx`
- Modify: `src/components/TeacherDashboard/overview/RecentQuizzesPanel.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardCoreTabs.tsx`

**Interfaces:**
- `OverviewTabProps` adds `onOpenQuiz: (quizId: string) => void`.
- `RecentQuizzesPanelProps` adds `onOpenQuiz: (quizId: string) => void`.
- `TeacherDashboardCoreTabs` passes `quizId` through `getQuizEditorRoute(quizId)`.

- [x] **Step 1: Write failing breadcrumb and selected-quiz tests**

In `tests/TeacherOverview.test.tsx`, make `renderOverview` provide `onOpenQuiz={vi.fn()}` by default. Add assertions:

```ts
expect(within(breadcrumb).getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('href', '/');
```

and add a recent-quiz action test that clicks `Mở đề` for `Đề lớp 3A` and expects:

```ts
expect(onOpenQuiz).toHaveBeenCalledWith('quiz-3a');
```

while `Xem tất cả` must still call:

```ts
expect(onSelectTab).toHaveBeenCalledWith('manage');
```

- [x] **Step 2: Run the focused test and verify RED**

Expected failures: `Trang chủ` is not a link; no `Mở đề` action/onOpenQuiz callback exists.

- [x] **Step 3: Make `Trang chủ` a native anchor**

Replace the decorative span with:

```tsx
<a href="/" className="rounded-md transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
  Trang chủ
</a>
```

- [x] **Step 4: Add the explicit quiz-open callback**

`RecentQuizzesPanel` receives `onOpenQuiz`; the per-row action becomes:

```tsx
<button type="button" onClick={() => onOpenQuiz(quiz.id)} ...>
  Mở đề
  <ArrowRight ... />
</button>
```

Keep header `Xem tất cả` wired to `onManageQuizzes`.

In `OverviewTab` pass the new callback through to `RecentQuizzesPanel`.

In `TeacherDashboardCoreTabs` pass:

```tsx
onOpenQuiz={(quizId) => navigate(getQuizEditorRoute(quizId))}
```

- [x] **Step 5: Re-run focused tests and confirm GREEN**

Run:

```bash
npm run test:run -- tests/TeacherOverview.test.tsx tests/TeacherDashboardCoreTabs.quizEditorNavigation.test.tsx
```

Expected: PASS.

---

### Task 3: Fix mobile `Thêm` active state

**Files:**
- Create: `tests/TeacherMobileBottomNav.test.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherMobileBottomNav.tsx`
- Modify: `cypress/e2e/teacher-dashboard-responsive-redesign.cy.ts`

**Interfaces:**
- Existing props remain unchanged.
- `Thêm` represents every active tab outside `overview`, `manage`, `classes`, and `results`.

- [x] **Step 1: Write the failing component tests**

Render `TeacherMobileBottomNav` directly and assert:

```ts
expect(screen.getByRole('button', { name: 'Thêm' })).toHaveAttribute('aria-current', 'page');
```

for `activeTab="assignments"`, and assert it has no `aria-current` for `activeTab="overview"` while `Tổng quan` is current.

- [x] **Step 2: Run the new test and verify RED**

Run:

```bash
npm run test:run -- tests/TeacherMobileBottomNav.test.tsx
```

Expected: secondary-tab `Thêm` assertion fails.

- [x] **Step 3: Implement derived `isMoreActive`**

Inside the component derive:

```ts
const isMoreActive = !items.some(({ id }) => id === activeTab);
```

Apply `aria-current={isMoreActive ? 'page' : undefined}` and the same active text/icon treatment used by primary buttons.

- [x] **Step 4: Add Cypress secondary-route regression**

At mobile width, visit `/teacher/assignments` with the same session/backend stubs and assert:

```ts
cy.get('nav[aria-label="Điều hướng nhanh"] button[aria-label="Thêm"]')
  .should('have.attr', 'aria-current', 'page');
```

- [x] **Step 5: Re-run the new component test and confirm GREEN**

Expected: PASS.

---

### Task 4: Normalize confirmed 40px dashboard touch targets

**Files:**
- Modify: `src/components/TeacherDashboard/Sidebar.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/DashboardSearchForm.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardHeader.tsx`
- Modify: `src/components/TeacherDashboard/overview/ActionCenterPanel.tsx`
- Modify: `src/components/TeacherDashboard/overview/RecentSubmissionsPanel.tsx`
- Modify: `src/components/TeacherDashboard/overview/RecentQuizzesPanel.tsx`
- Modify: `cypress/e2e/teacher-dashboard-responsive-redesign.cy.ts`

**Interfaces:**
- No prop or data contract changes.
- Controls measured at 40px become 44px using `h-11`, `min-h-11`, or `size-11`.

- [x] **Step 1: Add failing Cypress target-size assertions**

Add a helper over visible dashboard interactive controls intentionally touched by this patch and assert relevant width/height is at least 44px. Include sidebar nav/group controls, header menu/search controls, Action Center refresh, and overview `Xem tất cả` controls.

- [x] **Step 2: Run Cypress responsive spec and verify RED**

Run:

```bash
npx cypress run --e2e --spec cypress/e2e/teacher-dashboard-responsive-redesign.cy.ts --browser chrome
```

Expected: target-size assertions fail on current 40px controls.

- [x] **Step 3: Apply minimal 44px class changes**

Use the existing Tailwind scale only:

```txt
min-h-10 -> min-h-11
h-10 -> h-11
size-10 -> size-11
```

For `DashboardSearchForm`, increase the input and submit button together so their vertical geometry remains aligned.

- [x] **Step 4: Re-run Cypress responsive spec and confirm GREEN**

Expected: all responsive, overflow, clipping, drawer, and target-size assertions pass.

---

### Task 5: Verification, impact review, and branch handoff

**Files:**
- Review: all changed source/tests/docs.

**Interfaces:**
- Produces verification evidence only; no production mutation.

- [x] **Step 1: Run focused Vitest suite**

```bash
npm run test:run -- tests/TeacherOverview.test.tsx tests/TeacherMobileBottomNav.test.tsx tests/TeacherDashboardShell.test.tsx tests/TeacherDashboardCoreTabs.quizEditorNavigation.test.tsx
```

Expected: PASS.

- [x] **Step 2: Run quality gates**

```bash
npm run lint
npm run typecheck
npm run build:frontend
npm run perf:budget
```

Expected: PASS; no new budget regression.

- [x] **Step 3: Run Cypress responsive regression**

```bash
npx cypress run --e2e --spec cypress/e2e/teacher-dashboard-responsive-redesign.cy.ts --browser chrome
```

Expected: PASS at 1440, 1024, 768, 390, and 320px.

- [x] **Step 4: Re-run Playwright MCP measurements**

Verify at minimum:

- 1024px Quick Actions form two rows of three and visible titles are not clipped.
- `/teacher/assignments` at 390px marks `Thêm` current.
- `Trang chủ` resolves as a link.
- `Mở đề` for the first recent quiz navigates to `/teacher/quizzes/<encoded-id>/edit`.
- No horizontal overflow at 1440, 1024, 390, and 320px.
- No console errors with the authenticated repository fixture.

- [x] **Step 5: Run GitNexus change detection**

Use `detect_changes(scope="compare", base_ref="main", worktree="C:\\quizpro\\.worktrees\\teacher-dashboard-audit-p1")` and review all affected flows.

- [x] **Step 6: Review diff and status**

Confirm only intended files are changed and no secret/session fixture is committed.

- [x] **Step 7: Stop before commit/push/deploy**

Report the branch/worktree, exact verification results, and remaining risks. Wait for explicit user authorization for commit/integration/deployment.
