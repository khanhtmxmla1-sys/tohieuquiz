# Worker quiz routes decomposition

## Baseline and authorization

User authorized proceeding with quizzes.ts as the next isolated refactor. Baseline origin/main f4565af5bee6417b83efb34788b524be9f4983a1. Worktree C:/Users/Administrator/.codex/worktrees/refactor-worker-quiz-routes/quizpro; branch codex/refactor-worker-quiz-routes.

Scope: split workers/src/routes/quizzes.ts (1,108 lines) into focused route handlers and leaf helpers without changing observable behavior. results.ts is a later package. Final commit/push/PR and any production Worker artifact deployment require their respective explicit approvals.

## Architecture

Keep quizzes.ts as the public facade exporting handleQuizRoutes, mapQuestionFromD1, sanitizeQuestionForStudent and sanitizeQuizForStudent at their existing paths. Internals under workers/src/routes/quizzes/ import leaf definitions directly rather than importing the facade.

Separate these responsibilities:

- access verification and play questions (access codes/grants, fresh eligibility, learner DTOs and private/no-store responses);
- catalog/questions/editor reads (public versus teacher scopes and editor DTOs);
- create/update authoring (ownership, validation, question persistence and immutable quiz usage guards);
- version/duplicate copies and deletion (usage checks and copy normalization);
- dependency-neutral question DTO/persistence, usage/editability and response helpers as needed by the groups above.

Keep router dispatch explicit and in the original precedence order. Preserve exact path matching, including the existing DELETE startsWith behavior, method fallthrough, decode errors, missing IDs and final404 response. Do not tighten routes or permissions as an incidental refactor. Preserve thrown errors versus returned responses, auth-call ordering, retries, SQL statements, batches/write ordering, ownership aliases, grant contents and no-store headers. Do not create an overly generic handler framework or inject dependencies solely for testing.

## Intended scope

Existing source: workers/src/routes/quizzes.ts only. New internal modules under workers/src/routes/quizzes/. Existing security/authoring tests may receive focused characterization additions; a new route-dispatch test file is allowed if meaningful gaps are identified. This plan is part of delivery.

No results.ts, scoring engine, auth middleware, shared API contracts, frontend behavior, dependencies/lockfiles, migrations, secrets/config/flags or production data changes. Report newly discovered bugs separately before changing behavior or expanding source scope.

## Tasks

1. Read existing routes and callers/tests. Refresh GitNexus and upstream-impact each moved existing function via exact UID/file; report risk. UNKNOWN is not LOW. Stop on HIGH/CRITICAL pending explicit confirmation.
2. Capture baseline targeted tests: quizzesSecurity, quizCatalogScope, quizAccessVerification, quizPlayAccess, quizEditorAccess, quizRoutes.authoringFields, questionScoringPersistence and adjacent quizValidationReviewSecurity/DTO/access-policy suites. Add missing route precedence/error/cache/role characterization and demonstrate it against unchanged baseline. Pure extraction uses behavior characterization, not fabricated RED; newly introduced executable interfaces need genuine RED before implementation.
3. Extract leaf helpers/types and preserve all existing public exports. Keep math/rich-text/scoring contract errors, sanitization/fallbacks, DTO/key derivation and SQL column/value mapping identical.
4. Extract scoped read/access/play handlers. Keep optional auth versus required auth, invalid-token behavior, access-code/grant verification, source membership, limits/order and response shape identical.
5. Extract create/update/copy/delete handlers in bounded packages. Preserve ownership, active live-exam/submission/assignment usage guards, validation, D1 retry/batch/write semantics and error behavior. No attempts to fix transactionality or idempotency here.
6. Replace the facade body with explicit dispatch in original order. Test unmatched/method-collision/encoded-ID cases, public export compatibility and no additional DB writes/auth calls. Compare actual helper/action AST or normalized executable statements where feasible to detect drift beyond tests.
7. Run focused/adjacent security tests, real-SQLite tests already available, frontend/strict/Worker typechecks, lint, security scan, Worker dry-run build, frontend build/performance as cross-boundary regression. No upload or production mutation. Independent spec and security/quality review; resolve P1/P2. Refresh GitNexus and detect_changes including new files against origin/main. Check for new import cycles in Worker modules as well as frontend guard.
8. Present exact final files, evidence, remaining risks and final commit approval request. After approval commit/push/PR, required CI/human approval and merge. Rebuild/verify a concrete artifact from the merged SHA with clean lockfile dependencies and compare config/JS/WASM; obtain separate Worker deployment approval. Read-only smoke and approved authenticated checks, rollback to verified previous version if required. Cleanup only safe merged worktrees/branches, preserve unrelated dirty main.

## Acceptance and rollback

Public paths/exports, request/response contracts, auth/authorization, answer boundary, D1 reads/writes and validation remain compatible. Focused and required CI pass. Route facade becomes explicit orchestration; extracted groups have bounded responsibilities, not a relocated monolith. No new dependency, schema/config or contract changes.

Before deployment rollback is a commit revert. Production rollback uses the immutable Worker version confirmed immediately before upload; record its exact ID and security tradeoffs in the release evidence. No D1 rollback is needed because there is no migration. Frontend deployment alone does not release changed Worker source.

Preliminary risk HIGH from the security-sensitive surface, regardless of graph scoring. Exact impact and user confirmation gates still apply. Dynamic router calls may be undercounted by the graph; runtime security/contract verification is mandatory.

## Pre-change verification — 2026-11-26

Fresh index at baseline f4565af:27,238 nodes /55,238 edges /300 flows. Exact upstream impact completed for all25 function symbols in quizzes.ts, including the entrypoint, public mappers/sanitizers, auth/private-response helpers, validation/persistence/copy helpers, usage/editability functions and nested safeText. All LOW; direct callers0–2 and no affected processes reported. This does not downgrade the architectural sensitivity or replace runtime tests.

Baseline7 suites /83 tests PASS: quizzesSecurity, quizCatalogScope, quizAccessVerification, quizPlayAccess, quizEditorAccess, quizRoutes.authoringFields, questionScoringPersistence. Source unchanged at that point. Worker will add characterization before extraction and preserve the original11-step precedence, including DELETE startsWith and final404.

Agreed internal groups: response.ts, questionPersistence.ts, questionDto.ts, quizUsage.ts, access.ts, catalog.ts, authoring.ts, versions.ts, delete.ts; quizzes.ts remains public facade. New tests/quizRouteDispatch.worker.test.ts may cover identified dispatch/error/cache/export gaps. No extra approval is inferred for commit/push or production deployment.

## Implementation and verification

Implementation complete in the isolated worktree; commit/push/PR approval pending. Facade reduced to45 lines; ten internal modules split response/access helpers, DTOs, persistence, usage and route groups. Names below are the final implementation, replacing the provisional names above.

- Baseline characterization: new dispatch cases passed on the original facade before extraction; final7 cases include unsupported method404, malformed IDs with no auth/first/all/run calls, decoded ID binding, overlapping access/play precedence, no-store rejection, DELETEprefix plus both exact bindings, and public exports.
- Final expanded focused/adjacent verification:13 suites /113 tests PASS. Seven dispatch tests reran PASS after final assertion strengthening. Independent reviewer additionally ran4 suites /61 tests; overlapping counts are not summed.
- Independent review: no P1/P2. All10 original route branches,24 helpers,4 public exports and34 SQL statements preserve behavior; SQL differs only in indentation. Auth-call ordering, private cache headers, validation errors, write/batch order and DELETEprefix behavior preserved. Nullable unmatched handlers add only async hops, no body/auth/DB work.
- Worker/frontend/strict typechecks, full lint, security scan, Worker dry-run build, frontend production build and performance budget PASS. Frontend initial JS169257 gzip bytes and CSS48322; budgets unchanged.
- Worker dry-run did not upload or deploy. Generated JS/map/WASM verification directories were removed after verification; all source/evidence remain. Production release artifact will be rebuilt from merged SHA and require separate approval.
- No dependency/lockfile, migration, config, secret, flag, API/scoring/auth semantics, frontend behavior or results.ts changes.
- Final GitNexus incremental refresh failed internally at LOWER Invalid UTF-8; full single-worker rebuild succeeded (27,270 nodes /55,437 edges /300 flows). Final compare includes exactly13 files and108 symbols; risk CRITICAL with32 affected execution flows through the extracted handlers/auth/DTO dependencies. The earlier pre-change LOW results must not be presented as the final risk. User confirmation is required for this newly visible CRITICAL blast radius before commit/push. No code changes are inferred from graph scoring alone; runtime tests and independent behavior comparison remain supporting evidence.

Exact proposed scope (13 files):

1. `docs/superpowers/plans/2026-11-25-worker-quiz-routes-refactor.md`
2. `tests/quizRouteDispatch.worker.test.ts`
3. `workers/src/routes/quizzes.ts`
4. `workers/src/routes/quizzes/accessHelpers.ts`
5. `workers/src/routes/quizzes/accessRoutes.ts`
6. `workers/src/routes/quizzes/authoringRoutes.ts`
7. `workers/src/routes/quizzes/copyRoutes.ts`
8. `workers/src/routes/quizzes/deleteRoute.ts`
9. `workers/src/routes/quizzes/questionDto.ts`
10. `workers/src/routes/quizzes/questionPersistence.ts`
11. `workers/src/routes/quizzes/quizUsage.ts`
12. `workers/src/routes/quizzes/readRoutes.ts`
13. `workers/src/routes/quizzes/response.ts`

Remaining operational gates: commit approval, PR CI/human review, merge, exact artifact verification, separate production approval, deploy/smoke and cleanup. No browser behavior change is introduced; local browser interaction is N/A for this extraction, with frontend build and service/security contracts checked. Production smoke remains a release gate rather than a claim from local tests.
