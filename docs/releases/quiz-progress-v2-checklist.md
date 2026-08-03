# TôHiệuQuiz — Quiz Progress V2 release checklist

## Release status

**State:** READY FOR SHADOW ROLLOUT — implementation and local verification completed on 2026-08-03. Production deployment and production flag enablement have not been performed.

**Branch:** `feature/quiz-answer-progress-v2`

**Primary rollout commit:** `c04c7eb` (`feat: add controlled quiz progress rollout`)

## Scope delivered

- Student progress is represented by three UI states: `empty`, `partial`, and `complete`.
- Progress no longer depends on the grading contract or the presence of a client-side correct answer.
- Practice and Live Exam use the same progress engine and the same rollout flag.
- Header, question navigation, submit modal, activity tracking, and renderer badges use the shared progress summary.
- Pre-grading selections use blue semantic styling; green/red are reserved for result semantics.
- Invalid source questions can be marked `voided` and are excluded from the scoring denominator.
- Authoring validation is aligned with Worker scoring contracts.
- A read-only legacy scoring-contract audit is available.
- `VITE_FEATURE_QUIZ_PROGRESS_V2` defaults to `false`.
- With the flag disabled, V1 remains visible while V2 runs in shadow mode and only deduplicated mismatch metadata is reported.
- Mismatch telemetry contains no answer content.

## Key commits

- `06dfb08` — shared quiz progress summary.
- `f2b7ff5` — practice player integration.
- `ebe12fa` — Live Exam integration.
- `ddc6931` — complete progress summary in the UI.
- `cf90470` — clear progress visuals.
- `06f7757` — unified selected-answer colors.
- `aa8f803` — renderer progress-state synchronization.
- `ae95433` — authoring/scoring contract alignment.
- `156ce5d` — read-only contract audit.
- `f4103c2` — void invalid questions during grading.
- `a8062e0` — propagate voided scoring through API and results.
- `c04c7eb` — controlled rollout, shadow comparison, and telemetry.

## Automated verification

### Focused Vitest suite

Command:

```bash
npx vitest run \
  tests/quizProgress.test.ts \
  tests/quizProgressSummary.test.ts \
  tests/QuizProgressUi.test.tsx \
  tests/quizAnswerStateColors.test.tsx \
  tests/useQuizPlayerRewards.test.tsx \
  tests/LiveExamQuiz.progress.test.tsx \
  tests/LiveExamQuiz.pagination.test.tsx \
  tests/questionScoringContractAlignment.test.ts \
  tests/quizVoidedScoring.test.ts \
  tests/resultsRoutes.worker.test.ts \
  tests/StudentResultScreen.test.tsx \
  tests/quizProgressRollout.test.tsx \
  tests/featureFlagRules.test.ts
```

Result on 2026-08-03:

- [x] 13 test files passed.
- [x] 100 tests passed.
- [x] No focused test failures.

### Static checks and build

- [x] `npm run lint` passed with zero warnings.
- [x] `npm run typecheck` / `npx tsc -p tsconfig.json --noEmit` passed.
- [x] `npm run typecheck:strict` passed.
- [x] `npm run typecheck:workers` passed after installing the locked Worker workspace dependencies with `npm ci --prefix workers`.
- [x] `npx vite build` passed.
- [x] `npm run build` passed, including frontend build and sitemap generation.

The initial Worker typecheck attempt failed only because the isolated worktree did not yet contain `workers/node_modules/@simplewebauthn/server`. Installing from the committed `workers/package-lock.json` resolved the environment issue without source changes.

## Browser verification

The V2 development server was started with:

```cmd
set VITE_FEATURE_QUIZ_PROGRESS_V2=true&& npx vite --host 127.0.0.1 --port 3001
```

Cypress command:

```bash
npx cypress run --e2e --spec "cypress/e2e/question-scoring-matrix.cy.ts,cypress/e2e/mobile-responsive.cy.ts"
```

Result:

- [x] Canonical browser matrix passed for all 14 published question types.
- [x] Complete submission and result review passed.
- [x] Two skipped drag/drop questions were reported without leaking technical metadata.
- [x] Responsive public/auth shell passed at 360×800, 390×844, 412×915, and 768×1024.
- [x] 10 Cypress tests passed; 0 failed.

The production preview shell also rendered successfully in Playwright. Same-origin `/api/*` requests and `/_vercel/insights/script.js` returned 404 in the static preview because no Worker/API or Vercel runtime was attached; those preview-only responses were not treated as application regressions.

## Functional acceptance

- [x] A student-safe short answer such as `mine` becomes `complete` without requiring `correctAnswer` on the client.
- [x] Clearing a short answer returns it to `empty`.
- [x] Multi-part questions expose `partial` until all required parts are completed.
- [x] Practice and Live Exam compute progress through the same rollout hook.
- [x] Header, navigation, submit modal, and Live Exam activity use the same summary.
- [x] Complete navigation uses a strong completed treatment and partial uses amber.
- [x] True/False and other choices do not use result colors before grading.
- [x] Renderer styling is based on shared semantic classes.
- [x] Invalid source questions are `voided` and excluded from the denominator.
- [x] Student malformed answers remain `invalid` rather than `voided`.
- [x] Result review explains that voided questions are not counted.
- [x] Rollback can be performed by disabling the feature flag without deleting or rewriting student answers.

## Rollout sequence

1. [ ] Deploy with `VITE_FEATURE_QUIZ_PROGRESS_V2=false`.
2. [ ] Observe shadow mismatch telemetry and confirm no answer content is present.
3. [ ] Enable for an internal admin/teacher cohort.
4. [ ] Enable for one pilot class.
5. [ ] Expand to 25% traffic.
6. [ ] Expand to 100% traffic after observation gates pass.

## Observation gates

Before each expansion, verify:

- Header complete count equals the navigation and submit-modal counts.
- Live Exam `answeredCount` does not decrease after reconnect or draft restoration.
- No answer draft is overwritten during offline/online recovery.
- `quiz_progress_mismatch` remains within the accepted threshold and does not spike by question type.
- Result `totalQuestions` equals the count of valid, scoreable questions.
- Validate/submit 5xx and 422 rates do not increase after the voided-scoring release.
- `voidedCount` is reviewed for unexpected growth and traced back to authoring/import sources.

## Immediate rollback conditions

Set `VITE_FEATURE_QUIZ_PROGRESS_V2=false` and redeploy the frontend if any of the following occurs:

- Header, sidebar, modal, and activity counts disagree.
- Live Exam progress regresses after reconnect.
- Student answers or drafts are lost or overwritten.
- Shadow mismatch rate rises materially above the accepted baseline.
- Result scoring uses the wrong denominator.
- Submit/validate error rates increase materially.

The flag rollback changes only progress calculation and display selection. It does not migrate, delete, or rewrite saved answers.

## Production actions intentionally not performed

- [ ] No production deployment was made in this task.
- [ ] The production feature flag was not enabled.
- [ ] No remote D1 write or repair was performed.
- [ ] No production scoring-contract audit was executed from this worktree.
- [ ] No production cohort or traffic percentage was changed.

## Release decision

Local implementation is ready for a **flag-off production shadow deployment**. Enabling V2 for students should happen only after the shadow telemetry and production health gates above are reviewed.
