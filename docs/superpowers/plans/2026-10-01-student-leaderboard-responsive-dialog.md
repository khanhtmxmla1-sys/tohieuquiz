# Student Leaderboard Responsive Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 352px corner popup with the approved centered desktop/tablet modal and near-full-screen mobile sheet while preserving leaderboard data, accessibility, and interaction behavior.

**Architecture:** Keep `StudentFloatingSidebar` as the single owner of launcher, dialog state, fetching, focus management, and rendering. Implement responsiveness with Tailwind classes only—no viewport JavaScript or API changes. Lock the contract at two levels: Vitest asserts the intended structural classes, while Cypress measures real geometry and horizontal overflow at representative viewports.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Framer Motion, Vitest + Testing Library, Cypress component testing, GitNexus.

## Global Constraints

- Desktop `>= 1024px`: centered dialog, maximum width `48rem` (768px), maximum height `82dvh`.
- Tablet `640–1023px`: centered dialog, maximum width `42rem` (672px), maximum height `85dvh`.
- Mobile `< 640px`: bottom-aligned sheet with 8px viewport margin and maximum height `calc(100dvh - 16px)`.
- Header and tab list remain outside the scrolling panel; only `#student-leaderboard-panel` scrolls.
- The tab list must never scroll horizontally; all three full labels remain visible in one row.
- Close button, tabs, and retry controls retain a minimum 44px touch target.
- Preserve dialog semantics, focus trap, focus restoration, Escape/backdrop close, body scroll lock, and reduced-motion behavior.
- Preserve `getStudentLeaderboard`, tab query mapping, response models, rank/tie behavior, and Worker/D1 contracts.
- No new dependencies, migrations, API routes, filters, search, pagination, or unrelated refactors.
- Production rollout is frontend-only; Cloudflare Worker and D1 deployment are N/A.

---

## File Structure

- Modify `src/components/gamification/StudentFloatingSidebar.tsx`: responsive overlay, dialog width/height, and non-scrolling three-column tab list.
- Modify `tests/StudentFloatingSidebar.test.tsx`: structural regression contract for the approved desktop/tablet/mobile class strategy.
- Modify `cypress/component/student-gold-leaderboard.cy.tsx`: real viewport geometry, overflow, scroll-container, and touch-target checks.
- Verify without modifying `tests/studentGoldLeaderboardUi.test.tsx`: existing API state, tab mapping, accessibility, focus, error, and empty-state regression coverage.
- Reference `docs/superpowers/specs/2026-10-01-student-leaderboard-responsive-dialog-design.md`: approved design and acceptance criteria.

## Task 1: Implement the responsive dialog contract with TDD

**Files:**
- Modify: `tests/StudentFloatingSidebar.test.tsx:64-88`
- Modify: `cypress/component/student-gold-leaderboard.cy.tsx:5-102`
- Modify: `src/components/gamification/StudentFloatingSidebar.tsx:266-333`
- Verify: `tests/studentGoldLeaderboardUi.test.tsx`

**Interfaces:**
- Consumes: existing `StudentFloatingSidebar(): JSX.Element`, `getStudentLeaderboard(query)`, dialog id `student-golden-board-popup`, and panel id `student-leaderboard-panel`.
- Produces: unchanged component/API interface with a CSS-only responsive contract that later CI and production smoke checks can measure.

- [ ] **Step 1: Refresh the isolated baseline and create the implementation branch**

Run from the managed worktree containing the approved docs commits:

```powershell
git fetch origin main
git switch -c codex/student-leaderboard-responsive-dialog
git status --short --branch
git log -3 --oneline
```

Expected: a clean feature branch containing the approved design and plan commits, based on `32d2e58` or a newer `origin/main`. If `origin/main` advanced, rebase before source edits and rerun the GitNexus index.

- [ ] **Step 2: Run GitNexus pre-change analysis**

```powershell
npx gitnexus analyze .
$responsiveWorktree = (Get-Location).Path
node .gitnexus/run.cjs impact StudentFloatingSidebar --direction upstream --repo $responsiveWorktree --file src/components/gamification/StudentFloatingSidebar.tsx --include-tests
node .gitnexus/run.cjs context StudentFloatingSidebar --repo $responsiveWorktree
```

Expected: report direct callers/tests and affected modules. Stop and request confirmation if risk is HIGH or CRITICAL; continue automatically for LOW/MEDIUM after reporting the blast radius.

- [ ] **Step 3: Replace the compact-card unit contract with a failing responsive contract**

In `tests/StudentFloatingSidebar.test.tsx`, replace the test beginning `opens the rich leaderboard in a compact floating card` with:

```tsx
it('opens the approved centered responsive dialog without horizontal tab scrolling', async () => {
  render(<StudentFloatingSidebar />);

  const trigger = screen.getByRole('button', { name: 'Mở bảng vàng học sinh' });
  fireEvent.click(trigger);

  const dialog = await screen.findByRole('dialog', { name: 'Bảng vàng học sinh' });
  const layer = dialog.parentElement;
  const tabList = screen.getByRole('tablist', { name: 'Phạm vi bảng vàng' });

  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(dialog).toHaveAttribute('id', 'student-golden-board-popup');
  expect(dialog).toHaveClass(
    'max-h-[calc(100dvh-1rem)]',
    'max-w-none',
    'sm:max-h-[85dvh]',
    'sm:max-w-2xl',
    'lg:max-h-[82dvh]',
    'lg:max-w-3xl',
    'rounded-[24px]',
  );
  expect(dialog).not.toHaveClass('max-w-[22rem]', 'md:max-h-[70vh]');
  expect(layer).toHaveClass(
    'items-end',
    'justify-center',
    'p-2',
    'sm:items-center',
    'sm:p-4',
    'lg:p-6',
  );
  expect(layer).not.toHaveClass('justify-end', 'md:pb-24');
  expect(tabList).toHaveClass('grid', 'grid-cols-3');
  expect(tabList).not.toHaveClass('overflow-x-auto');
  expect(screen.getByRole('tab', { name: 'Tuần này' })).toHaveClass('min-h-11', 'min-w-0');
  expect(screen.getByRole('tab', { name: 'Lớp của em' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Toàn trường' })).toBeInTheDocument();
  await waitFor(() => {
    expect(getStudentLeaderboardMock).toHaveBeenCalledWith({ scope: 'school', period: 'week' });
  });
});
```

- [ ] **Step 4: Run the unit test and capture RED**

```powershell
npm ci
npm run test:run -- tests/StudentFloatingSidebar.test.tsx
```

Expected: FAIL because the current dialog still contains `max-w-[22rem]`, the layer still uses `justify-end`, and the tab list still uses `overflow-x-auto`.

- [ ] **Step 5: Expand Cypress data so the mobile panel must scroll**

In `cypress/component/student-gold-leaderboard.cy.tsx`, append these rows to `leaderboardResponse.data.topStudents` after rank 3:

```tsx
{ studentId: 'student-5', fullName: 'Nguyễn Nhật Minh', avatar: null, className: '5A', rank: 4, xu: 80 },
{ studentId: 'student-6', fullName: 'Nguyễn Hồng Đạt', avatar: null, className: '5A', rank: 5, xu: 70 },
{ studentId: 'student-7', fullName: 'Nguyễn Thị Yến Trang', avatar: null, className: '5A', rank: 6, xu: 60 },
{ studentId: 'student-8', fullName: 'Quàng Nam Chương', avatar: null, className: '5A', rank: 7, xu: 50 },
{ studentId: 'student-9', fullName: 'Vì Thị Lê Na', avatar: null, className: '5A', rank: 8, xu: 40 },
{ studentId: 'student-10', fullName: 'Hoàng Khánh Linh', avatar: null, className: '5A', rank: 9, xu: 30 },
{ studentId: 'student-11', fullName: 'Nguyễn Văn Quang', avatar: null, className: '5A', rank: 10, xu: 20 },
```

Change `totalStudents` from `4` to `11`.

- [ ] **Step 6: Replace Cypress layout tests with failing responsive geometry tests**

Keep `interceptLeaderboard` and `captureConsoleOutput`, then replace the two current `it(...)` blocks with:

```tsx
const openLeaderboard = () => {
  interceptLeaderboard();
  const assertCleanConsole = captureConsoleOutput();
  cy.mount(<StudentFloatingSidebar />);
  cy.get('button[aria-label="Mở bảng vàng học sinh"]').should('be.visible').click();
  cy.wait('@studentLeaderboard');
  cy.get('[role="dialog"]').should('be.visible').and('have.attr', 'aria-modal', 'true');
  return assertCleanConsole;
};

for (const [width, height] of [[1366, 768], [1536, 864]] as const) {
  it(`centers a readable desktop dialog at ${width}x${height}`, () => {
    cy.viewport(width, height);
    cy.clock(Date.parse('2026-09-30T08:00:00.000Z'), ['Date']);
    const assertCleanConsole = openLeaderboard();

    cy.get('[role="dialog"]').then(($dialog) => {
      const rect = $dialog[0].getBoundingClientRect();
      expect(rect.width).to.be.closeTo(768, 1);
      expect(Math.abs((rect.left + rect.right) / 2 - width / 2)).to.be.lessThan(2);
      expect(rect.height).to.be.at.most(height * 0.82 + 1);
    });
    cy.get('[role="tablist"]').then(($tabs) => {
      expect($tabs[0].scrollWidth).to.be.at.most($tabs[0].clientWidth + 1);
    });
    assertCleanConsole();
  });
}

it('centers the tablet dialog at 768x1024', () => {
  cy.viewport(768, 1024);
  cy.clock(Date.parse('2026-09-30T08:00:00.000Z'), ['Date']);
  const assertCleanConsole = openLeaderboard();

  cy.get('[role="dialog"]').then(($dialog) => {
    const rect = $dialog[0].getBoundingClientRect();
    expect(rect.width).to.be.closeTo(672, 1);
    expect(Math.abs((rect.left + rect.right) / 2 - 384)).to.be.lessThan(2);
    expect(rect.height).to.be.at.most(1024 * 0.85 + 1);
  });
  cy.get('[role="tablist"]').then(($tabs) => {
    expect($tabs[0].scrollWidth).to.be.at.most($tabs[0].clientWidth + 1);
  });
  assertCleanConsole();
});

for (const [width, height] of [[320, 568], [390, 844]] as const) {
  it(`uses an inset mobile sheet without horizontal overflow at ${width}x${height}`, () => {
    cy.viewport(width, height);
    cy.clock(Date.parse('2026-09-30T08:00:00.000Z'), ['Date']);
    const assertCleanConsole = openLeaderboard();

    cy.get('[role="dialog"]').then(($dialog) => {
      const rect = $dialog[0].getBoundingClientRect();
      expect(rect.left).to.be.closeTo(8, 1);
      expect(rect.right).to.be.closeTo(width - 8, 1);
      expect(rect.bottom).to.be.closeTo(height - 8, 1);
      expect(rect.height).to.be.at.most(height - 16 + 1);
    });
    cy.get('[role="tablist"]').then(($tabs) => {
      expect($tabs[0].scrollWidth).to.be.at.most($tabs[0].clientWidth + 1);
    });
    cy.get('[role="tab"]').each(($tab) => {
      expect($tab[0].getBoundingClientRect().height).to.be.at.least(44);
    });
    cy.get('#student-leaderboard-panel').scrollTo('bottom');
    cy.get('[role="tablist"]').should('be.visible');
    cy.get('#student-leaderboard-panel').should(($panel) => {
      expect($panel[0].scrollHeight).to.be.greaterThan($panel[0].clientHeight);
    });
    cy.document().then((doc) => {
      expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth + 1);
    });
    assertCleanConsole();
  });
}
```

- [ ] **Step 7: Run Cypress and capture RED**

```powershell
npm run cypress:run:component -- --spec cypress/component/student-gold-leaderboard.cy.tsx
```

Expected: FAIL because desktop width is 352px and right-aligned; mobile bottom/right positions include the old large bottom padding; the tab list can horizontally scroll.

- [ ] **Step 8: Implement the minimal responsive layout**

In `src/components/gamification/StudentFloatingSidebar.tsx`, replace the overlay class string with:

```tsx
className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-4 lg:p-6"
```

Replace the dialog class string with:

```tsx
className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-none flex-col overflow-hidden rounded-[24px] border border-[#E8D8C5] bg-[#FFFDF7] text-[#3E3027] shadow-[0_20px_60px_rgba(62,48,39,0.22)] transition duration-200 motion-reduce:transition-none sm:max-h-[85dvh] sm:max-w-2xl lg:max-h-[82dvh] lg:max-w-3xl"
```

Replace the tab-list class string with:

```tsx
className="grid grid-cols-3 gap-1 rounded-xl bg-[#FFF7E8] p-1"
```

Add `min-w-0` and use mobile-safe horizontal padding on each tab:

```tsx
className={`min-h-11 min-w-0 whitespace-nowrap rounded-lg px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C98524] sm:px-3 sm:text-sm ${
  activeTab === tab ? 'bg-[#FFFDF7] text-[#A5631D] shadow-sm' : 'text-[#8B7765] hover:text-[#5A4537]'
}`}
```

Do not change fetch logic, `StudentMeta`, `PodiumCard`, focus management, or animation state in this step.

- [ ] **Step 9: Run focused GREEN verification**

```powershell
npm run test:run -- tests/StudentFloatingSidebar.test.tsx tests/studentGoldLeaderboardUi.test.tsx tests/studentGoldLeaderboardService.test.ts
npm run cypress:run:component -- --spec cypress/component/student-gold-leaderboard.cy.tsx
```

Expected: all focused Vitest files pass; Cypress passes at 320×568, 390×844, 768×1024, 1366×768, and 1536×864 with no console errors or warnings.

- [ ] **Step 10: Review the source diff before broader verification**

```powershell
git diff -- src/components/gamification/StudentFloatingSidebar.tsx tests/StudentFloatingSidebar.test.tsx cypress/component/student-gold-leaderboard.cy.tsx
git diff --check
```

Expected: only the approved responsive classes and their regression tests changed; no API, Worker, mascot, copy, data, or unrelated component changes.

## Task 2: Full verification, approval, and focused commit

**Files:**
- Verify: `src/components/gamification/StudentFloatingSidebar.tsx`
- Verify: `tests/StudentFloatingSidebar.test.tsx`
- Verify: `tests/studentGoldLeaderboardUi.test.tsx`
- Verify: `cypress/component/student-gold-leaderboard.cy.tsx`
- No additional source files should change.

**Interfaces:**
- Consumes: the responsive component and tests produced by Task 1.
- Produces: a reviewed commit ready for a pull request; no production mutation occurs in this task.

- [ ] **Step 1: Run static and build checks**

```powershell
npx eslint src/components/gamification/StudentFloatingSidebar.tsx tests/StudentFloatingSidebar.test.tsx tests/studentGoldLeaderboardUi.test.tsx cypress/component/student-gold-leaderboard.cy.tsx
npm run typecheck
npm run build:frontend
npm run perf:budget
```

Expected: every command exits `0`; the frontend build creates no source diff; performance budget reports no error.

- [ ] **Step 2: Run GitNexus change detection against `main`**

```powershell
$responsiveWorktree = (Get-Location).Path
node .gitnexus/run.cjs detect_changes --scope compare --base-ref main --repo $responsiveWorktree --limit 100
```

Expected: changes are limited to `StudentFloatingSidebar` and its tests, with no unexpected execution flow. Resolve every P1/P2 or unexpected symbol before continuing.

- [ ] **Step 3: Present the user approval gate**

Report:

- exact modified files;
- RED and GREEN evidence;
- Vitest/Cypress counts;
- lint/typecheck/build/performance results;
- GitNexus risk and affected symbols;
- remaining risk: browser font metrics can vary slightly, bounded by geometry assertions.

Do not commit or push until the user explicitly approves.

- [ ] **Step 4: Stage only task files and commit after approval**

```powershell
git add src/components/gamification/StudentFloatingSidebar.tsx tests/StudentFloatingSidebar.test.tsx cypress/component/student-gold-leaderboard.cy.tsx
git status --short
git commit -m "fix(student): enlarge responsive leaderboard dialog"
```

Expected: one focused implementation commit; the approved design/plan docs remain in their earlier docs commits.

## Task 3: Push, PR, CI, production smoke, and cleanup

**Files:**
- No planned source changes.
- PR metadata describes the responsive-only frontend rollout.

**Interfaces:**
- Consumes: clean branch with docs and implementation commits.
- Produces: merged PR, verified Vercel deployment, and archived managed worktree.

- [ ] **Step 1: Push and open the pull request**

```powershell
git push -u origin codex/student-leaderboard-responsive-dialog
$responsivePrBody = @"
## Summary
- center the student leaderboard at readable tablet and desktop widths
- use an 8px-inset near-full-screen sheet on mobile
- keep header and tabs fixed while the leaderboard panel scrolls

## Risk
- frontend layout only; no API, Worker, D1, or migration changes
- rollback by reverting the implementation commit

## Verification
- focused Vitest leaderboard suites
- Cypress component checks at 320, 390, 768, 1366, and 1536px
- lint, typecheck, frontend build, and performance budget
"@
gh pr create --repo khanhtmxmla1-sys/tohieuquiz --base main --head codex/student-leaderboard-responsive-dialog --title "fix(student): enlarge responsive leaderboard dialog" --body $responsivePrBody
```

The PR body must include: approved A layout, responsive breakpoints, no API/migration changes, GitNexus risk, RED/GREEN evidence, complete verification, and rollback by reverting the implementation commit.

- [ ] **Step 2: Wait for required CI and code-owner approval**

```powershell
$responsivePrNumber = gh pr view --repo khanhtmxmla1-sys/tohieuquiz --json number --jq .number
gh pr checks $responsivePrNumber --repo khanhtmxmla1-sys/tohieuquiz --watch
gh pr view $responsivePrNumber --repo khanhtmxmla1-sys/tohieuquiz --json reviewDecision,mergeStateStatus,statusCheckRollup,headRefOid
```

Expected: every required check is successful, `reviewDecision` is approved, and the PR is mergeable. Do not merge while any required check/review is pending or failed.

- [ ] **Step 3: Merge only after rechecking the PR HEAD**

```powershell
$responsivePrNumber = gh pr view --repo khanhtmxmla1-sys/tohieuquiz --json number --jq .number
$responsiveHeadSha = gh pr view $responsivePrNumber --repo khanhtmxmla1-sys/tohieuquiz --json headRefOid --jq .headRefOid
gh pr merge $responsivePrNumber --repo khanhtmxmla1-sys/tohieuquiz --squash --delete-branch --match-head-commit $responsiveHeadSha
```

Expected: merge succeeds without bypassing branch protection.

- [ ] **Step 4: Verify the production deployment**

Wait for Vercel deployment and production smoke on the merge SHA. Then use the authenticated student account to verify:

- 1536×864: centered dialog approximately 768px wide; no right-corner 352px card.
- 390×844: 8px inset mobile sheet; all tabs visible; no horizontal scrollbar.
- `Tuần này`, `Lớp của em`, and `Toàn trường` all load data.
- Header/tab list remain visible while `#student-leaderboard-panel` scrolls.
- Escape, close button, backdrop, focus restoration, and launcher still work.

Capture a screenshot at desktop and mobile widths as rollout evidence. Cloudflare Worker/D1 steps are N/A because the implementation is frontend-only.

- [ ] **Step 5: Cleanup safely**

- Confirm the managed worktree is clean.
- Archive it with the Codex worktree archive tool, retaining the attached PR identity.
- Do not fast-forward `C:\quizpro\main` if it still has unrelated user changes.
- Report merge SHA, deployment status, smoke evidence, rollback commit, and any local branches intentionally retained.
