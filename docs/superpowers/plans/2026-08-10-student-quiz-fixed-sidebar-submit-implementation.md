# Student Quiz Fixed Sidebar + Submit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a student avatar to the standard quiz header and make desktop quiz-taking use a stationary left question navigator + submit action with only the right question column scrolling.

**Architecture:** Keep shared quiz-player components backward compatible through opt-in props. `StudentView` owns the desktop viewport layout; `QuizNavigation` gets a contained mode; `QuizPagination` gets an opt-in desktop-submit suppression; a small shared `QuizSubmitButton` preserves one submit presentation and the existing confirmation flow.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest + Testing Library, Cypress, Vite.

## Global Constraints

- Work only in `C:\quizpro\.worktrees\student-quiz-fixed-sidebar-submit` on `feat/student-quiz-fixed-sidebar-submit`.
- No Worker/API/D1/migration/scoring/persistence changes.
- `LiveExamQuiz` must preserve its existing header, sticky navigator, and desktop submit behavior by default.
- Desktop layout change begins at Tailwind `lg` breakpoint; mobile/tablet retain current flow.
- Hide scrollbar visuals without disabling scroll input or focus/`scrollIntoView()` navigation.
- Minimum interactive target height remains 44px; submit stays 48px.
- Follow TDD: every behavior change gets a failing test before production code.
- Do not commit, push, merge, or deploy without a separate explicit user approval.

---

### Task 1: Header avatar opt-in

**Files:**
- Modify: `tests/QuizProgressUi.test.tsx`
- Modify: `src/features/quiz-player/components/QuizHeader.tsx`
- Modify: `src/components/StudentView.tsx`

**Interfaces:**
- `QuizHeaderProps` adds `showAvatar?: boolean` with default `false`.
- `StudentView` passes `showAvatar` and its existing `studentAvatar` value.
- `LiveExamQuiz` does not pass `showAvatar` and remains unchanged.

- [x] **Step 1: Write failing avatar tests**

Add tests that render `QuizHeader` with `showAvatar` and verify:

```tsx
render(
  <QuizHeader
    title="Bài kiểm tra"
    timeLeft={600}
    totalQuestions={10}
    completedCount={0}
    partialCount={0}
    isPractice
    studentName="An"
    avatar="https://assets.example.test/an.png"
    showAvatar
  />,
);
expect(screen.getByRole('img', { name: 'Ảnh đại diện của An' })).toHaveAttribute(
  'src',
  'https://assets.example.test/an.png',
);
```

Also test `avatar={null}` + `showAvatar` renders fallback `A`, and default `showAvatar` omitted renders no avatar landmark for `studentName="Thi trực tiếp"`.

- [x] **Step 2: Run RED test**

Run:
`npm run test:run -- tests/QuizProgressUi.test.tsx`

Expected: FAIL because `showAvatar` is not a valid prop / no avatar is rendered.

- [x] **Step 3: Implement minimal header avatar**

Update the props and render an image/fallback before the title block only when `showAvatar` is true. Use compact dimensions (`h-10 w-10 sm:h-12 sm:w-12`), `object-cover`, existing warm/sky palette, and keep timer/title truncation intact.

Update `StudentView`:

```tsx
<QuizHeader
  ...
  avatar={studentAvatar}
  showAvatar
/>
```

- [x] **Step 4: Run GREEN test**

Run:
`npm run test:run -- tests/QuizProgressUi.test.tsx`

Expected: all `QuizProgressUi` tests pass.

---

### Task 2: Shared submit control and backward-compatible pagination

**Files:**
- Create: `src/features/quiz-player/components/QuizSubmitButton.tsx`
- Create: `tests/QuizSubmitButton.test.tsx`
- Modify: `src/features/quiz-player/components/QuizPagination.tsx`
- Modify: `tests/LiveExamQuiz.pagination.test.tsx`

**Interfaces:**

```ts
interface QuizSubmitButtonProps {
  onSubmit: () => void;
  isSubmitting: boolean;
  className?: string;
}
```

`QuizPaginationProps` adds:

```ts
hideSubmitOnDesktop?: boolean;
```

default `false`.

- [x] **Step 1: Write failing button/pagination tests**

Create `tests/QuizSubmitButton.test.tsx` verifying visible text, disabled state, and click callback. Add a pagination rendering test verifying `hideSubmitOnDesktop` applies `lg:hidden`, while the default last-page submit does not have that class.

- [x] **Step 2: Run RED tests**

Run:
`npm run test:run -- tests/QuizSubmitButton.test.tsx tests/LiveExamQuiz.pagination.test.tsx`

Expected: FAIL because `QuizSubmitButton` and `hideSubmitOnDesktop` do not exist.

- [x] **Step 3: Implement shared submit control**

Create `QuizSubmitButton.tsx` with the current submit button's semantics/styles. Replace the inline last-page submit button inside `QuizPagination` with the shared component. Apply `lg:hidden` only when `hideSubmitOnDesktop === true`.

- [x] **Step 4: Run GREEN tests**

Run:
`npm run test:run -- tests/QuizSubmitButton.test.tsx tests/LiveExamQuiz.pagination.test.tsx`

Expected: all tests pass and Live Exam default behavior remains unchanged.

---

### Task 3: Contained navigator and desktop stationary sidebar

**Files:**
- Modify: `src/features/quiz-player/components/QuizNavigation.tsx`
- Modify: `tests/quizAnswerStateColors.test.tsx`
- Modify: `src/components/StudentView.tsx`
- Create: `tests/StudentQuizLayout.test.tsx`

**Interfaces:**

`QuizNavigationProps` adds:

```ts
contained?: boolean;
```

default `false`.

`StudentView` passes `contained` only to its desktop navigator.

- [x] **Step 1: Write failing contained-navigation test**

Extend `quizAnswerStateColors.test.tsx` with a case rendering `contained` and assert the card has flex/min-height containment and a question-grid scroll region with hidden-scrollbar utilities. Also assert the default render retains `sticky top-24`.

- [x] **Step 2: Run RED navigation test**

Run:
`npm run test:run -- tests/quizAnswerStateColors.test.tsx`

Expected: FAIL because `contained` is not supported.

- [x] **Step 3: Implement contained navigator**

For default mode preserve current DOM behavior. For contained mode:
- root: flex column + `min-h-0 flex-1`;
- heading stays shrink-safe;
- number-grid wrapper: `min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`;
- legend remains below the scroll region.

- [x] **Step 4: Run GREEN navigation test**

Run:
`npm run test:run -- tests/quizAnswerStateColors.test.tsx tests/quizPageNavigation.test.tsx`

Expected: all pass.

- [x] **Step 5: Write failing StudentView desktop layout test**

Create `tests/StudentQuizLayout.test.tsx` with `useQuizPlayer` and `useQuizPageNavigation` mocked to a stable quiz-step state. Verify:
- desktop aside landmark `Điều hướng bài làm` exists and contains a visible `Nộp bài` button;
- clicking sidebar `Nộp bài` calls `setShowSubmitConfirm(true)`;
- `<main aria-label="Nội dung câu hỏi">` carries `lg:overflow-y-auto` and hidden-scrollbar utilities;
- root shell carries `lg:h-dvh lg:overflow-hidden`;
- `QuizPagination` receives desktop-submit suppression (only sidebar submit lacks `lg:hidden`; pagination submit is responsive-hidden).

- [x] **Step 6: Run RED StudentView test**

Run:
`npm run test:run -- tests/StudentQuizLayout.test.tsx`

Expected: FAIL because the current layout uses page scrolling and has no desktop sidebar submit.

- [x] **Step 7: Implement StudentView desktop layout**

Update the quiz shell and content wrappers to use desktop viewport-height flex containment. Add:

```tsx
<aside aria-label="Điều hướng bài làm" className="... lg:flex lg:min-h-0 lg:flex-col">
  <QuizNavigation contained ... />
  <div className="mt-4 shrink-0">
    <QuizSubmitButton onSubmit={() => setShowSubmitConfirm(true)} isSubmitting={isSubmitting} className="w-full" />
    {/* desktop-only submit error */}
  </div>
</aside>
```

Make `<main>` the desktop scroll owner and pass `hideSubmitOnDesktop` to `QuizPagination`. Keep the existing submit error visible below pagination only below `lg`.

- [x] **Step 8: Run GREEN StudentView tests**

Run:
`npm run test:run -- tests/StudentQuizLayout.test.tsx tests/QuizProgressUi.test.tsx tests/quizAnswerStateColors.test.tsx tests/quizPageNavigation.test.tsx tests/MobileQuizNavigator.test.tsx tests/LiveExamQuiz.pagination.test.tsx tests/LiveExamQuiz.progress.test.tsx`

Expected: all pass.

---

### Task 4: Browser regression for independent scroll and responsive parity

**Files:**
- Modify: `cypress/e2e/student-quiz-reliability.cy.ts`

**Interfaces:** No production interface changes.

- [x] **Step 1: Add desktop Cypress regression**

Use a quiz with enough questions/content to make the right column scroll. At 1440x900 and 1024x768:
- start the quiz;
- capture the aside's `getBoundingClientRect().top`;
- scroll `[aria-label="Nội dung câu hỏi"]` by several hundred pixels;
- assert the main scrollTop increased and aside top is unchanged;
- assert computed scrollbar width behavior does not create a visible gutter/overflow;
- assert desktop `Nộp bài` is visible before reaching the last page and opens the submit confirmation dialog;
- click a question-number button and assert the exact question receives focus;
- assert document width does not exceed viewport.

Keep the existing 390px mobile test and add a 320px overflow assertion if needed.

- [x] **Step 2: Run Cypress**

Start local Vite server and run:
`npx cypress run --e2e --spec cypress/e2e/student-quiz-reliability.cy.ts --browser chrome`

Expected: all student reliability specs pass at desktop and mobile breakpoints.

---

### Task 5: Final verification and review

**Files:** all changed files above plus this spec/plan.

- [x] **Step 1: Focused test suite**

Run:
`npm run test:run -- tests/StudentQuizLayout.test.tsx tests/QuizSubmitButton.test.tsx tests/QuizProgressUi.test.tsx tests/quizAnswerStateColors.test.tsx tests/quizPageNavigation.test.tsx tests/MobileQuizNavigator.test.tsx tests/LiveExamQuiz.pagination.test.tsx tests/LiveExamQuiz.progress.test.tsx`

Expected: 0 failures.

- [x] **Step 2: Static/build gates**

Run sequentially:
- `npm run typecheck`
- `npm run lint`
- `npm run build:frontend`
- `npm run perf:budget`
- `git diff --check`

Expected: exit code 0 for all commands.

- [x] **Step 3: Browser verification**

Verify 1440, 1024, 768, 390, and 320 widths. Confirm no console errors, no horizontal overflow, desktop independent right-column scroll, stationary left navigation/submit, and unchanged mobile navigator flow.

- [x] **Step 4: Code/impact review**

Run Local Coding `review_diff`, secret scan for changed files, and GitNexus:
`detect_changes(scope="compare", base_ref="main", worktree="C:\\quizpro\\.worktrees\\student-quiz-fixed-sidebar-submit")`.

Stop if P1/P2 findings, HIGH/CRITICAL impact, or verification failures appear.

- [x] **Step 5: Handoff without side effects**

Report exact changed files and evidence. Do not commit/push/merge/deploy. Wait for explicit user approval for the next Git operation.
