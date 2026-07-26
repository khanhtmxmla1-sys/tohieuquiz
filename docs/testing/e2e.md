# End-to-end testing — TôHiệuQuiz

Cypress specs fall into three categories. They are **not** interchangeable: two of
them need a running backend, and one of them needs a specific feature-flag
combination. Running everything in one pass will always produce failures.

## 1. Stubbed specs — run anywhere, run in CI

Every API call is stubbed with `cy.intercept`, so these need nothing but the Vite
dev server on `http://localhost:3001`.

| Spec | Requires |
|---|---|
| `ai-question-blueprint-v3.cy.ts` | `VITE_FEATURE_AI_BLUEPRINT_V3=true` |
| `ai-quiz-generation-v2.cy.ts` | `VITE_FEATURE_AI_QUIZ_V2=true` and **`VITE_FEATURE_AI_BLUEPRINT_V3=false`** |
| `manual-quiz-workspace.cy.ts` | default flags |
| `mobile-responsive.cy.ts` | default flags |
| `parent-portal.cy.ts` | `VITE_FEATURE_PARENT_PORTAL_V1=true` |
| `unified-notifications.cy.ts` | default flags |

### The AI flag conflict

`ai-quiz-generation-v2.cy.ts` asserts the V2 pipeline's stage sequence
(`OCR → GENERATE → REPAIR → REVIEW`) and its review screen. Blueprint V3 replaces
that pipeline — `useCreateQuizLogic` computes
`aiBlueprintV3Enabled = aiQuizV2Enabled && isAiBlueprintV3Enabled()` — so with V3
enabled the REPAIR stage never runs and the "Lưu đề" button never appears.

Measured on 2026-07-26:

| `VITE_FEATURE_AI_BLUEPRINT_V3` | `ai-quiz-generation-v2.cy.ts` | `ai-question-blueprint-v3.cy.ts` |
|---|---|---|
| `true` | 2 passing, **3 failing** | 2 passing |
| `false` | **5 passing** | (not applicable) |

This is expected behaviour, not a defect: each spec pins one side of the flag. CI
therefore runs the suite as **two separate jobs** (`e2e-stubbed` and
`e2e-blueprint-v3`), not two steps in one job.

Two steps in one job does not work: `cypress-io/github-action` leaves its `start`
server running, so the second step finds port 3001 occupied, Vite silently moves to
another port, and Cypress keeps talking to the *previous* server — built with the
wrong flag — until it dies with `ECONNREFUSED`. Separate runners make the isolation
real.

## 2. Live-environment specs — need a real backend, a real student, **and practice content**

These log in for real and assert against live data. They fail fast in a stubbed run
with `studentUsername is required`.

- `student-dashboard-responsive.cy.ts`
- `student-practice-library.cy.ts`

### A student account is not enough

Measured against production on 2026-07-26 with a real student account on an empty
database: **1 of 13 tests passed**. Every failure traced to one missing element,
`[data-testid="subject-practice-grid"] button`.

`buildPracticeCatalog()` marks a subject `available` only when `questionCount > 0`,
and that count comes from `GET /api/practice/topics`, which reads hashtags out of
`questions.tags`. With no tagged questions, every subject renders in the "Sắp có"
list as plain `Đang chuẩn bị` text, `availableSubjects` is empty, and
`SubjectPracticeGrid` never renders the grid the specs click into.

So the environment needs at least one question whose `tags` contains a hashtag
matching a subject alias in `SUBJECT_CONFIG` (`src/features/student-dashboard/model/dashboardConstants.ts`)
— e.g. `#toan` for Toán học. Seed that before blaming the specs.

### Both specs are also stale against the current UI

With practice content seeded, the specs get much further — the subject page loads,
`/student/practice/toan` renders real topics, and the canonical-route assertion
passes — but neither goes green. Two spec-side defects remain, measured 2026-07-26:

1. `student-dashboard-responsive.cy.ts`, `assertNoDistractingPulse()` looks for a
   button matching `/Điểm danh nhận thưởng|Đã điểm danh hôm nay/`. The attendance
   button's label comes from `getAttendanceBadgeText()`
   (`src/features/student-dashboard/model/attendanceRewards.ts`), which returns
   `Đã điểm danh hôm nay`, `Đang tải câu hỏi điểm danh...`, or
   `Điểm danh ngày N: +X Xu +Y EXP`. `Điểm danh nhận thưởng` only ever appears in a
   `<p>` inside `AttendanceModal`, never as button text, so the assertion cannot
   pass unless the student has already claimed today.
2. `student-practice-library.cy.ts`, `openFirstAvailableSubject()` aliases
   `@firstSubject` from a DOM query and then reads `@subjectTitle` after clicking
   through to the subject route. After the navigation the alias resolves to an
   empty set, so every test in the file dies on the same step even though the page
   itself is correct.

Fix the specs before treating a red run here as a product regression.

Run them against a deployed environment with a throwaway student account:

```bash
npx cypress run --e2e \
  --spec "cypress/e2e/student-dashboard-responsive.cy.ts,cypress/e2e/student-practice-library.cy.ts" \
  --config baseUrl=https://www.thtohieu.com \
  --env studentUsername=<code>,studentPassword=<pin>
```

Never commit those credentials, and never point them at a real pupil's account.

## 3. Quarantined specs

- `quiz.cy.ts` — inherited from the source system. It asserts the old school
  branding and a "Dành cho Giáo viên" link that no longer exist, and it logs in with
  `admin`/`admin` against a live backend. Both `describe` blocks are `.skip`ped with
  the reasoning in the file header. Rewrite or delete it; do not un-skip as-is.

## Commands

```bash
# Everything CI runs (stubbed only) — needs `npm run dev` in another terminal
npm run cypress:run:stubbed
npm run cypress:run:blueprint-v3   # with VITE_FEATURE_AI_BLUEPRINT_V3=true

# Component tests
npm run cypress:run:component
```

## Component specs

`cypress/component/**` mounts components directly through the Vite dev server and
needs no flags:

- `announcement-composer-layout.cy.tsx`
- `console-hygiene.cy.tsx`
- `math-rendering.cy.tsx`
- `result-report-delivery.cy.tsx`
- `student-dropdown-menu.cy.tsx`
