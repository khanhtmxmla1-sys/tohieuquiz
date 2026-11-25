# Frontend import-cycle refactor plan

## Objective and authorization boundary

Remove all six confirmed circular-import components in `src` without changing user-visible behavior, public exports, API contracts, persistence, scoring, authentication, or deployment configuration.

This document authorizes planning only. Implementation, commit/push/PR, merge, and deployment remain behind the repository gates in `AGENTS.md`.

Dedicated worktree: `C:/Users/Administrator/.codex/worktrees/refactor-import-cycles/quizpro`

Branch: `codex/refactor-import-cycles`

Baseline: `origin/main` at `f7b65d4ecec97f30f2ed689c565408da0b044fdd`

## Confirmed baseline

A TypeScript-resolved import graph was built from the current `tsconfig.json`, including static imports, re-exports, type-only imports, path aliases, and literal dynamic imports.

- 1,112 production files under `src`
- 3,022 resolved internal import edges
- exactly six strongly connected components
- GitNexus independently reports the same six cycle areas, although its abbreviated cycle output omits some members of the larger components

### Cycle A — student lazy views

`lazyViews.ts → StudentDashboardUI.tsx → StudentQuizView.tsx → lazyViews.ts`, with `HomePage.tsx` also participating in the full strongly connected component.

Cause: `StudentQuizView` imports `StudentView` from the global lazy-view registry while that registry dynamically imports dashboard modules that lead back to `StudentQuizView`.

### Cycle B — student navigation and dashboard types

`navigationRoutes.ts → content.types.ts → useStudentAssignments.ts/useStudentPracticeCatalog.ts → navigationRoutes.ts`.

Cause: the route layer imports `StudentDashboardSection` from a component-prop module, while dashboard hooks consume route helpers.

### Cycle C — announcement editor

`AnnouncementComposer.tsx` imports child steps and helpers; those children/helpers import `AnnouncementDraft` and related types back from the composer. The full component includes eleven files, not only the two-file cycle shown in abbreviated reports.

Cause: a React component is acting as both runtime composition root and domain-type module.

### Cycle D — quiz-editor QuestionCard barrel

`QuestionCardActions.tsx → quiz-editor/index.ts → QuestionCard/index.ts → QuestionCard.tsx → QuestionCardActions.tsx`; renderer imports also join the full component.

Cause: an internal component imports `supportsDistractors` through the feature's public barrel instead of the defining utility module.

### Cycle E — AI generation facade

`geminiService.ts` imports/re-exports AI helpers, while internal helpers import the `AIProvider` type back from `geminiService.ts`. The strongly connected component contains nine facade/provider/prompt/repair files.

Cause: shared provider types live in a high-level runtime facade.

### Cycle F — worksheet PDF types/layout/SVG

`pdfLayout.ts → pdfTypes.ts → pdfSvgDiagram.ts → pdfLayout.ts`.

Cause: `PdfSvgDiagramImage` is declared in the SVG runtime module but is required by the shared render-context type.

## Architecture decisions

1. Preserve current public module APIs through type/value re-exports where consumers outside a feature already depend on them.
2. Move dependency-neutral types and factories downward into leaf modules; do not introduce a new global shared-types dumping ground.
3. Internal feature files import definitions directly, never through their own feature barrel.
4. Do not merge or redesign the existing duplicate AI provider taxonomies in this package. That is a separate domain refactor.
5. Do not split large components, hooks, or Worker routes in this package. This plan removes cycles only.
6. Add no npm dependency. The architecture regression uses the existing TypeScript compiler API.
7. Require zero circular strongly connected components in production `src`; do not add an allowlist for the six known cycles.

## Expected source scope

### New leaf modules

- `src/features/student-dashboard/model/studentDashboardSection.ts`
- `src/features/notifications/admin/announcementDraft.ts`
- `src/services/ai/aiProvider.types.ts`
- `tests/importCycles.test.ts`

### Existing modules expected to change

- `src/app/StudentQuizView.tsx`
- `src/app/lazyViews.ts`
- `src/app/navigationRoutes.ts`
- `src/features/student-dashboard/components/content.types.ts`
- `src/features/student-dashboard/components/StudentDashboardContent.tsx`
- `src/features/student-dashboard/hooks/useStudentDashboardController.ts`
- `src/features/student-dashboard/model/index.ts`
- `src/features/student-dashboard/index.ts`
- announcement-admin files that currently import `AnnouncementDraft`, `AnnouncementAudience`, `AnnouncementStatus`, or `createEmptyAnnouncementDraft` from `AnnouncementComposer.tsx`
- `src/features/quiz-editor/components/QuestionCard/QuestionCardActions.tsx`
- `src/services/geminiService.ts`
- internal AI files currently importing `AIProvider` from `geminiService.ts`
- `src/services/worksheet-export/pdf/pdfTypes.ts`
- `src/services/worksheet-export/pdf/pdfSvgDiagram.ts`

Tests may require import-only updates while keeping their current public-facade assertions. If implementation needs behavior changes, new dependencies, Worker files, migrations, or files outside these six areas, stop and report the scope expansion before editing them.

## Risk assessment

Overall preliminary risk: **MEDIUM**.

- Runtime behavior is intended to remain identical.
- Lazy loading and public re-exports make accidental chunk/export changes possible.
- Announcement types have many internal consumers.
- AI generation and PDF export are high-value flows even though their changes should be type/import-only.
- No Worker, D1, authentication, scoring, configuration, secret, feature-flag, or production data change is expected.

Before implementation, refresh GitNexus in this worktree and run upstream impact for every existing function/class/method whose body or declaration will move or change. Use file/UID disambiguation. `UNKNOWN` is not LOW. Stop for explicit confirmation if any result is HIGH or CRITICAL.

## Eight implementation tasks

### Task 1 — Establish architecture regression RED

Create `tests/importCycles.test.ts` using the existing TypeScript compiler API:

- load `tsconfig.json` through TypeScript;
- include production `.ts/.tsx` files under `src` only;
- resolve static imports, re-exports, type-only imports, configured path aliases, and literal dynamic imports;
- build a directed file graph;
- detect strongly connected components deterministically;
- print complete normalized component membership on failure;
- assert zero components containing more than one file and no self-import edge.

RED evidence must show the six baseline components above. Test determinism on Windows path separators and mixed-case drive/file paths. Do not encode the six components as an allowlist.

### Task 2 — Break the student lazy-view cycle

- Give `StudentQuizView.tsx` ownership of the lazy `StudentView` import, or introduce an equally narrow leaf lazy module.
- Remove the unused `StudentView` export from the global `lazyViews.ts` registry only after confirming no other consumers.
- Preserve the existing `Suspense` fallback, component props, chunk laziness, result submission callback, and exit behavior.

Focused verification: student dashboard rendering, quiz layout/player tests, route guards, and a production build chunk/import check.

### Task 3 — Invert the student navigation/type dependency

- Move `StudentDashboardSection` into `model/studentDashboardSection.ts`.
- Import it directly from the leaf module in both `navigationRoutes.ts` and dashboard component/controller types.
- Preserve the existing feature public re-export so external consumers do not change unnecessarily.
- Do not move route logic into dashboard components or hooks.

Focused verification: route guards, student dashboard routing, assignments/practice navigation, and TypeScript typecheck.

### Task 4 — Extract the announcement draft domain leaf

- Move `AnnouncementDraft`, `AnnouncementStatus`, `AnnouncementAudience`, and `createEmptyAnnouncementDraft` to `announcementDraft.ts`.
- Update every internal announcement-admin consumer to import from that leaf module.
- Let `AnnouncementComposer.tsx` re-export the existing public symbols for compatibility, while importing them from the leaf module for its own use.
- Keep validation, presets, editor state, audience/channel semantics, dates, defaults, and publish behavior byte-for-byte equivalent at the data-contract level.

Focused verification: composer, delivery step, management page, settings, selector/service, and announcement Worker-adjacent regression suites.

### Task 5 — Remove the QuestionCard barrel back-edge

- Change `QuestionCardActions.tsx` to import `supportsDistractors` directly from `utils/questionHelpers.ts`.
- Keep `supportsDistractors` exported by `quiz-editor/index.ts` for external consumers.
- Do not otherwise reorganize QuestionCard renderers in this package.

Focused verification: QuestionCard/QuizPreview, underline editor, math rendering surfaces, typecheck, and production build.

### Task 6 — Lower AI provider types and PDF image types

AI:

- Define the current eight-value `AIProvider` union in `aiProvider.types.ts`.
- Update internal AI facade/provider/prompt/repair/OCR modules to import the leaf type directly.
- Re-export `AIProvider` from `geminiService.ts` so existing callers remain source-compatible.
- Do not alter provider selection, credentials, prompts, retries, models, or generation behavior.

PDF:

- Move `PdfSvgDiagramImage` into `pdfTypes.ts` beside `PdfRenderContext`.
- Import it from `pdfTypes.ts` in `pdfSvgDiagram.ts` and re-export it from the old module for compatibility.
- Preserve raster limits, sanitization, layout, pagination, image dimensions, fonts, and output content.

Focused verification: quiz-generation workflow/server-path/quality tests; PDF SVG, worksheet export integrity/service, math export, and accessibility tests.

### Task 7 — GREEN, structural review, and full verification

Required checks:

1. `tests/importCycles.test.ts` reports zero cycles.
2. GitNexus `check --cycles --json` reports zero cycles for the target repository.
3. Focused suites from Tasks 2–6 pass.
4. `npm run lint`
5. `npm run typecheck`
6. `npm run typecheck:strict`
7. `npm run typecheck:workers` as a cross-boundary regression check
8. relevant frontend production build and performance budget
9. `npm run security:scan` or the repository's current equivalent
10. `git diff --check`

Review the final diff for changed exports, lazy chunk boundaries, type/value import mistakes, side-effect ordering, accidental provider-union drift, and unrelated formatting. Obtain independent specification and quality review; resolve every P1/P2 finding.

Refresh GitNexus if needed and run `detect_changes({scope: compare, base_ref: origin/main})` before commit. Expected affected flows are limited to frontend module loading, student routing/dashboard, announcement authoring, quiz-editor actions, AI generation typing/imports, and worksheet PDF export. Unexpected Worker/business flows require investigation before proceeding.

### Task 8 — Approval, delivery, and cleanup

- Report exact final files, RED→GREEN evidence, cycle count, focused/full checks, impact risk, and remaining limitations.
- Wait for explicit user approval before commit/push.
- Create one focused refactor commit and PR against `main`.
- Do not merge until required CI and code-owner review pass at the final PR HEAD.
- No Worker upload, D1 migration, secret/config/flag change, or backend production deployment is expected.
- After frontend production deployment, run read-only smoke for home, student dashboard navigation, teacher announcement UI loading, quiz editor loading, AI generation entry rendering, and worksheet export modal loading. Do not trigger paid AI generation or mutate production content solely for smoke.
- Remove the worktree/branch only after merge and smoke, while preserving unrelated dirty worktrees.

## Rollback

Rollback is a normal frontend commit revert/deployment rollback. Because this package changes imports/types only and adds no persistence or API contract, there is no database or Worker rollback. If a lazy chunk or public export regression is found before merge, revert the affected task within the feature branch and keep the architecture test RED until a correct acyclic direction is implemented; do not add an exception to make the test pass.

## Acceptance criteria

- All six baseline strongly connected components are removed.
- The new architecture regression finds zero production `src` cycles.
- Public exports used by existing callers remain compatible.
- No visible behavior, network request, scoring, authorization, provider choice, generated PDF content, or persistence behavior changes.
- Focused and repository-required checks pass.
- Final scope contains no Worker, migration, dependency, secret, config, or feature-flag change.

## Explicit non-goals and follow-up

This package does not split the large route handlers/components identified in the audit. After this cycle package is stable, plan those independently in this order:

1. `CompetitionDashboardPage`
2. `handleQuizRoutes` / `handleResultRoutes`
3. `ManualQuizWorkspacePage`
4. `createWorkerFetch`
5. `useQuizGeneration`, `useQuizPlayer`, and the broader `geminiService` facade

## Implementation verification — 2026-11-25

Implementation complete; commit/push/PR approval pending. Independent review: no remaining P1/P2. All 12 moved declarations matched baseline AST; public exports remain compatible and StudentView remains a separate dynamic chunk.

- Baseline RED: six SCCs; summary retained in ignored `TEMP/import-cycles-red.log`. Independent reviewer reproduced six baseline SCCs and zero current SCCs. The initial 3,022-edge count omitted an inline type edge; the corrected graph also excludes test-only src files.
- Corrected architecture guard: 3/3 PASS, including Windows canonical paths, a real resolved import edge, cyclic/self-cycle fixtures, inline type imports, literal dynamic imports and test-file exclusions.
- Parent focused regression: 14 suites / 118 tests PASS. Worker additionally reports 17 suites / 127 tests and final 9 suites / 74 tests PASS; overlapping counts are not summed.
- Full lint, frontend/strict/Worker typechecks, frontend production build, performance budget PASS. Initial JS: 169,258 bytes gzip (limit unchanged: 204,800); CSS: 48,322 bytes gzip.
- Refreshed GitNexus: cycleCount 0; compare scope LOW, zero affected processes. Graph results supplement the runtime tests.
- No Worker, dependency/lockfile, D1, API, scoring, auth, config, secret, flag or migration changes. GitNexus-generated AGENTS/CLAUDE statistics are excluded from delivery.
- Remaining limitation: authenticated production UI smoke follows merge/deployment; local build/lazy-chunk inspection and focused component tests have passed.

Exact proposed delivery scope (36 files):

1. This plan document.
2. `tests/importCycles.test.ts`
3. `src/app/studentViewLazy.ts`
4. `src/app/StudentQuizView.tsx`
5. `src/app/lazyViews.ts`
6. `src/app/navigationRoutes.ts`
7. `src/features/student-dashboard/model/studentDashboardSection.ts`
8. `src/features/student-dashboard/model/index.ts`
9. `src/features/student-dashboard/components/content.types.ts`
10. `src/features/student-dashboard/hooks/useStudentDashboardController.ts`
11. `src/features/notifications/admin/announcementDraft.ts`
12. `src/features/notifications/admin/AnnouncementComposer.tsx`
13. `src/features/notifications/admin/AnnouncementContentStep.tsx`
14. `src/features/notifications/admin/AnnouncementDeliveryStep.tsx`
15. `src/features/notifications/admin/AnnouncementListToolbar.tsx`
16. `src/features/notifications/admin/AnnouncementManagementPage.tsx`
17. `src/features/notifications/admin/AnnouncementPreview.tsx`
18. `src/features/notifications/admin/AnnouncementPublishDialog.tsx`
19. `src/features/notifications/admin/AnnouncementReviewStep.tsx`
20. `src/features/notifications/admin/announcementAdminMeta.ts`
21. `src/features/notifications/admin/announcementAdminSelectors.ts`
22. `src/features/notifications/admin/announcementDraftUtils.ts`
23. `src/features/notifications/admin/announcementPresets.ts`
24. `src/features/notifications/admin/useAnnouncementEditorState.ts`
25. `src/features/notifications/admin/validateAnnouncementDraft.ts`
26. `src/features/quiz-editor/components/QuestionCard/QuestionCardActions.tsx`
27. `src/features/quiz-editor/components/QuestionCard/renderers/TrueFalseRenderer.tsx`
28. `src/services/ai/aiProvider.types.ts`
29. `src/services/ai/extractTextFromPdf.ts`
30. `src/services/ai/prompts/quizPromptBuilder.ts`
31. `src/services/ai/prompts/slotPromptBuilder.ts`
32. `src/services/ai/prompts/systemPromptBuilder.ts`
33. `src/services/ai/utils/jsonRepair.ts`
34. `src/services/geminiService.ts`
35. `src/services/worksheet-export/pdf/pdfSvgDiagram.ts`
36. `src/services/worksheet-export/pdf/pdfTypes.ts`
