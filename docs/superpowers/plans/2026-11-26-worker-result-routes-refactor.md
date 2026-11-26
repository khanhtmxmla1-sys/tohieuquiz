# Worker Result Routes Refactor Plan

**Date:** 2026-11-26
**Branch:** `codex/refactor-worker-result-routes`
**Worktree:** `C:\Users\Administrator\.codex\worktrees\refactor-worker-result-routes\quizpro`
**Baseline:** `3d653249edb06f5064005820dc3c06eeda10372f` (`origin/main`)

## 1. Goal

Refactor the 939-line `workers/src/routes/results.ts` monolith into cohesive route modules while preserving its public API and all observable behavior.

The change is structural only. It must not change authentication, authorization, scoring, assignment-attempt enforcement, SQL, response bodies/status codes, side-effect order, Worker configuration, D1 schema, migrations, secrets, feature flags, or production traffic.

## 2. Current state and risk

`handleResultRoutes` currently authenticates once, delegates intervention routes, then dispatches nine result/validation route branches. The same file also owns assignment-policy helpers, canonical class/student resolution, result-access checks, scoring submission, persistence, activity recording, and parent notifications.

GitNexus was refreshed on this worktree before planning:

- `handleResultRoutes`: **MEDIUM**, 13 direct callers, 13 impacted symbols, 0 indexed execution processes.
- `normalizeName`: **LOW**, 3 direct callers, 17 impacted symbols.
- `resultClassError`: **LOW**, 2 direct callers, 16 impacted symbols.
- The other seven local helpers: **LOW**, 1 direct caller each, 14 impacted symbols each.

The dominant risks are route-precedence drift, duplicated authentication, changed authorization order, SQL/binding drift in submission, and side effects firing before a successful insert. No HIGH or CRITICAL impact was reported by the refreshed index.

## 3. Route inventory to preserve

Dispatch order remains exactly:

1. JWT authentication.
2. Intervention subroutes.
3. `GET /api/results/summary`.
4. `GET /api/results`.
5. `GET /api/results/:id/answers`.
6. `POST /api/results/answers/bulk`.
7. `GET /api/results/:id/skill-breakdown`.
8. `GET /api/results/:id/weakness-profile`.
9. `POST /api/results`.
10. `DELETE /api/results/:id`.
11. `POST /api/validate`.
12. Existing 404 fallback.

Specific paths must continue to win over parameterized paths. Authentication must still occur before intervention dispatch and before the final 404.

## 4. Target architecture and exact scope

### Public facade

- `workers/src/routes/results.ts`
  - Retain the sole public `handleResultRoutes` export.
  - Authenticate exactly once.
  - Preserve intervention delegation and dispatch precedence.
  - Return the same final 404.

### Shared authenticated context

- `workers/src/routes/results/context.ts`
  - Define the internal `ResultRouteContext` passed to route modules: request, env, DB, authenticated user, path, and method.
  - Define the nullable handler result convention (`Response | null`) used only inside this route family.

### Policy and identity helpers

- `workers/src/routes/results/assignmentPolicy.ts`
  - Move `ResultAssignmentPolicy`, `loadResultAssignmentPolicy`, and `validateResultAssignmentPolicy` without changing queries or validation order.

- `workers/src/routes/results/submissionIdentity.ts`
  - Move `normalizeName`, `getStudentForUser`, `resultClassError`, `resolveSubmissionClass`, and `resolveUniqueStudentId` without changing canonicalization or authorization.

- `workers/src/routes/results/resultAccess.ts`
  - Move `requireResultAccess` without changing canonical result-scope enforcement.

### Route modules

- `workers/src/routes/results/readRoutes.ts`
  - Own summary, paginated result listing, answer review, and bulk answer review.
  - Preserve cursor parsing, access predicates, query text/bindings, review reconstruction, and response shape.

- `workers/src/routes/results/analysisRoutes.ts`
  - Own skill breakdown and weakness profile routes.
  - Preserve canonical access filtering and question loading.

- `workers/src/routes/results/submitRoute.ts`
  - Own only `POST /api/results`.
  - Preserve body parsing, assignment/class/student resolution, access grants, authoritative grading, atomic conditional insert, attempt-count conflict response, activity recording, notification ordering, and response shape.

- `workers/src/routes/results/deleteRoute.ts`
  - Own only `DELETE /api/results/:id`.
  - Preserve result access check before role check and delete query.

- `workers/src/routes/results/validateRoute.ts`
  - Own only `POST /api/validate`.
  - Preserve teacher ownership checks, student public-practice constraints, and correct-answer visibility.

### Tests and plan

- `tests/resultRouteDispatch.worker.test.ts`
  - Add characterization coverage for facade authentication, intervention precedence, route precedence, and authenticated 404 behavior.

- Existing result/validation test suites remain unchanged unless an import-only mechanical update is strictly required. The public import path remains `workers/src/routes/results`, so such updates are not expected.

- This plan file is part of the PR for traceability.

Expected maximum scope: 12 files (1 existing source file, 9 new internal source files, 1 new test, and this plan). An import-only adjustment to an existing test may replace, but not add to, that scope. Any behavior change or scope beyond this limit requires a revised plan and approval.

## 5. TDD sequence

1. Run the focused existing result/validation suites on the untouched baseline and record the result.
2. Add `resultRouteDispatch.worker.test.ts` against the new internal facade contract before extraction. The first test must fail because the proposed module seam/dispatch helpers do not yet exist; record RED.
3. Extract the minimum shared context and route handlers needed to make the dispatch test pass; record GREEN.
4. Move one route group at a time, running the focused suite after each group.
5. Refactor imports/types only after behavior is green.

Because this is a behavior-preserving extraction, existing characterization suites are the primary regression oracle. No production behavior will be intentionally changed merely to manufacture a failing test.

## 6. Verification matrix

### Focused behavior

Run all suites that directly exercise `handleResultRoutes`:

- `tests/resultRouteDispatch.worker.test.ts`
- `tests/paginationRoutes.worker.test.ts`
- `tests/resultSummaryRoute.worker.test.ts`
- `tests/resultsRoutes.worker.test.ts`
- `tests/resultsQuestionAnalysis.worker.test.ts`
- `tests/resultsAuthoritativeScoring.worker.test.ts`
- `tests/resultAssignmentAtomicity.worker.test.ts`
- `tests/resultAssignmentAttempts.worker.test.ts`
- `tests/resultCanonicalAuthorizationRoutes.worker.test.ts`
- `tests/studentReviewHistory.worker.test.ts`
- `tests/weaknessProfile.worker.test.ts`
- `tests/quizzesSecurity.worker.test.ts`
- `tests/quizValidationReviewSecurity.worker.test.ts`
- `tests/workerRouter.worker.test.ts`

### Repository gates

- Worker typecheck: `npm run typecheck:workers`
- Relevant lint for changed TS files, followed by repository lint if feasible.
- Worker build using the repository build path.
- Security checks required by the repository.
- Full relevant Vitest shard/CI-equivalent checks in proportion to available resources.
- Review the complete diff and resolve all P1/P2 findings.
- Refresh GitNexus after extraction and run `detect_changes --scope compare --base-ref main` before asking for commit approval.

## 7. Invariants and explicit non-goals

The implementation must preserve:

- `handleResultRoutes(request, env, path, method): Promise<Response>` and its import path.
- Authentication before all route handling and authenticated 404 behavior.
- Intervention routing precedence.
- All route paths, HTTP methods, status codes, error codes/messages, and JSON shapes.
- All SQL text semantics and binding order.
- Teacher/admin/student access boundaries and canonical result scopes.
- Atomic assignment-attempt insertion and its 409 behavior.
- Authoritative scoring and review-detail budget behavior.
- Activity and parent-notification best-effort semantics after successful persistence.

Out of scope:

- New endpoints or response contracts.
- Scoring, idempotency, attempt-limit, assignment, or authorization changes.
- Query optimization or schema changes.
- D1 migrations.
- Worker config, secrets, feature flags, dependencies, or frontend changes.
- Production deployment as part of implementation approval.

## 8. Review and delivery gates

1. Obtain approval for this plan before any executable source/test edit.
2. Delegate the scoped extraction to a worker agent as required by repository instructions.
3. The orchestrator inspects the real diff and verification evidence and sends corrections back when needed.
4. Present exact final files, test evidence, GitNexus change scope, and remaining risk for a separate commit approval.
5. Only after approval: commit, push, open PR, wait for required CI and code-owner approval, then merge.
6. Worker production deployment requires a separate approval tied to the exact merged commit and built artifact hash.

## 9. Rollback

- Before merge: abandon the isolated feature branch/worktree; `main` remains unchanged.
- After merge but before deploy: revert the focused PR if regression evidence appears.
- After a separately approved Worker deploy: retain the previous Worker version at 0% traffic and restore it if the new version causes a verified regression.
- No database rollback is needed because this plan contains no migration or data mutation outside normal request behavior.
