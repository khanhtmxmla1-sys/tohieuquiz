# Implementation plan — reorder Teacher Overview and add manual quiz class selection

## Scope

Implement the approved design in `docs/superpowers/specs/2026-08-07-dashboard-reorder-manual-class-design.md`. The initial execution stopped before commit/push/deploy; in a follow-up, the user explicitly approved fixing the MathJax CDN dependency and creating one local commit. Push/deploy remain out of scope.

The work is intentionally limited to frontend composition, existing Zustand stores, and regression coverage; there is no database migration or API contract change.

## Task 1 — Pre-change impact analysis

Status: implementation complete; impact LOW. Final verification after MathJax self-hosting: 48 focused tests passed, lint/typecheck/strict typecheck/build passed, dev and production-preview offline browser checks passed with zero MathJax CDN requests.

- Refresh GitNexus index if possible.
- Run upstream impact for `OverviewTab`, `QuizSettingsDrawer`, and `ManualQuizWorkspacePage`.
- Stop and report before editing if blast radius is HIGH or CRITICAL outside the intended teacher-dashboard/manual-quiz flows.

## Task 2 — Regression tests for Teacher Overview ordering

Files:
- `tests/TeacherOverview.test.tsx`
- `src/components/TeacherDashboard/OverviewTab.tsx`

Steps:
1. Add a test that compares DOM order for these sections:
   - `Tạo đề kiểm tra`
   - `Tình hình điểm số`
   - `Chỉ số tổng quan`
2. Assert creation appears before learning results and KPI cards appear after learning results.
3. Run focused test and confirm it fails before implementation.
4. Reorder existing components only; do not change their props or visual implementation.

## Task 3 — Regression tests for real-class settings

Files:
- `tests/QuizSettingsDrawer.test.tsx`
- `tests/ManualQuizWorkspaceLayout.test.tsx`
- `tests/ManualQuizWorkspaceAccess.test.tsx`
- `src/features/manual-quiz-workspace/components/QuizSettingsDrawer.tsx`
- `src/features/manual-quiz-workspace/ManualQuizWorkspacePage.tsx`

Steps:
1. Expand `QuizSettingsDrawer` props with current class value, class options, loading state, and an `onApply` payload containing `classLevel` + `timeLimit`.
2. Add tests for:
   - visible class selector with real class names;
   - apply returns selected class and time together;
   - current legacy/missing class remains available as fallback;
   - read-only selector is disabled;
   - existing focus behavior remains valid.
3. In workspace integration test, seed/mock `useClassStore` with classes and verify applying settings updates the store envelope quiz class.
4. Run focused tests and confirm red state before implementation.

## Task 4 — Load authorized classes in manual workspace

Files:
- `src/features/manual-quiz-workspace/ManualQuizWorkspacePage.tsx`

Steps:
1. Read `username`/`isAdmin` from existing auth state.
2. Read `classes`, `isLoading`, and `fetchClasses` from `useClassStore`.
3. When settings open and a username exists:
   - admin -> `fetchClasses()`;
   - teacher -> `fetchClasses(username)`.
4. Avoid extra API/data-model changes.
5. Pass `{ id, name }` options into `QuizSettingsDrawer`.

## Task 5 — Implement class selection in settings drawer

Files:
- `src/features/manual-quiz-workspace/components/QuizSettingsDrawer.tsx`

Steps:
1. Add a “Lớp áp dụng” select before duration controls.
2. Keep local draft state for class and duration.
3. Build options from real classes; if `classLevel` is non-empty and not present, inject it as a fallback option.
4. Disable class selector in read-only mode.
5. Apply one combined payload `{ classLevel, timeLimit }`.
6. Update description copy from time-only to general quiz settings.

## Task 6 — Update workspace apply flow

Files:
- `src/features/manual-quiz-workspace/ManualQuizWorkspacePage.tsx`

Steps:
1. Change settings callback to receive `{ classLevel, timeLimit }`.
2. Call existing `updateQuiz({ classLevel, timeLimit })` once.
3. Close drawer after successful local apply.

## Task 7 — Verification

Focused tests:
- `tests/TeacherOverview.test.tsx`
- `tests/QuizSettingsDrawer.test.tsx`
- `tests/ManualQuizWorkspaceLayout.test.tsx`
- `tests/ManualQuizWorkspaceAccess.test.tsx`
- `tests/ManualQuizWorkspaceAccessibility.test.tsx`
- `tests/ManualQuizWorkspaceResponsive.test.tsx`

Then run:
- `npm run typecheck`
- relevant lint on changed files or project lint if practical
- `npm run build`
- browser/Playwright verification for Teacher Overview and manual quiz settings if local app can be started with available test auth/stubs.

## Task 8 — Remove runtime dependency on external MathJax CDN

Files:
- `index.tsx`
- `src/config/mathJaxConfig.ts`
- `scripts/prepare-mathjax-assets.mjs`
- `package.json`
- `.gitignore`
- `tests/mathJaxConfig.test.ts`

Steps:
1. Pin `MathJaxContext` to version 3 and a same-origin `/vendor/mathjax/...` source.
2. Copy only the required MathJax 3.2.2 runtime, `noerrors` extension, and LICENSE from the installed dependency during `predev` / `prebuild:frontend`.
3. Keep generated vendor files ignored rather than committing the 1.15 MB minified runtime.
4. Verify both dev and production preview while blocking all external HTTPS; MathJax must still render and must issue zero cdnjs requests.

Finally:
- review full diff;
- run GitNexus `detect_changes` on the staged commit;
- create the single local commit authorized by the user;
- do not push or deploy without explicit user approval.
