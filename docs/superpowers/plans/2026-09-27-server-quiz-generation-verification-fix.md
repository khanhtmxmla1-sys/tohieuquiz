# Server Quiz Generation Verification Fix Implementation Plan

> **For agentic workers:** Use `executing-plans` to execute this plan task-by-task in the current session. Track steps with checkboxes. No parallel writers in this worktree.

**Goal:** Resolve the full Vitest verification blocker, identify any actual regressions, and prepare a reviewed change set for approval without changing production.

**Architecture:** Preserve the existing orchestrator implementation and legacy prompt path. Separate runner transport failures from test failures; use the existing four-shard runner before considering any source changes. Review shared deterministic dependencies based on runtime imports and parity evidence.

**Tech Stack:** PowerShell, Node.js, Vitest, TypeScript, Cloudflare Workers, Cypress, GitNexus.

## Global Constraints

- Work only in `C:/quizpro/.worktrees/server-quiz-generation-orchestrator`.
- Branch `feat/server-quiz-generation-orchestrator`; inspected HEAD and local origin/main both `f9d927cee87524792731ba983dbe537e5566dfac`.
- Initial state: 34 status entries, 15 tracked modified files, no staged files. This new plan adds one untracked entry.
- Checkpoint PASS results are historical evidence, not newly rerun checks.
- Do not modify `buildPromptV3`, reset/clean the checkout, overwrite existing work, or weaken test assertions/timeouts to force green.
- No commit/push/deploy/migration or feature-flag changes in the planning phase.
- Preserve one action/quota reservation per generation; bounded retries only for network/502/503/504; preserve abort handling and final deterministic audit.
- Do not log keys, authorization headers, prompts, or complete provider responses.

## Task 1: Establish a reliable full-test execution path

**Inspect:** `package.json`, `scripts/run-vitest-shards.mjs`, `vitest.config.ts`, checkpoint.
**Source changes:** None. TDD N/A: verification only.
**Produces:** Process exit code, shard outcomes, runtime versions, and a clear failure classification.

- [x] Recheck `git status --short --branch`, `git diff --stat`, and `git diff --cached --name-only`; preserve all existing work.
- [x] Run `node --version` and `npm --version`; compare with the Node version configured in `.github/workflows/ci.yml`. Record differences before interpreting failures.
- [x] Confirm terminal health using `npm run test:run -- tests/quizGenerationRetry.worker.test.ts`. Expected: normal Vitest output and exit 0. If transport fails, check whether its process is still running before launching another.
- [x] Run `npm run test:ci:all` via native terminal execution. This existing script runs all four shards sequentially with two workers; no config changes are needed.
- [x] Retain the running session ID and poll it in bounded intervals; keep full output in a temporary verification log if necessary. Do not restart the suite because a tool response was interrupted.
- [x] Accept full Vitest only when all four shards report success and the process exits 0. Focused tests do not replace the full gate.
- [x] If the wrapper cannot complete but direct execution works, execute `npm run test:ci:shard -- --shard=1/4 --reporter=dot`, then the same command for `2/4`, `3/4`, and `4/4`, against the same unchanged source and configuration. Record every result.
- [x] If HTTP 502 recurs before Node/Vitest output, classify it as unresolved runner transport failure. Preserve the command/session/log evidence and stop blind retries. Do not change provider retry code to fix a tooling error.

## Task 2: Fix only failures demonstrated by Vitest

**Inspect:** Exact failing test and implementation named in Task 1 output.
**Files to modify:** Selected only after a reproducible failure; no speculative patch is authorized by this plan.
**Produces:** Minimal regression fix with RED/GREEN evidence, or a finding that no source fix is needed.

- [x] Record the failing assertion, stack trace, test name, exit code, and shard before editing.
- [x] Rerun the exact failing test file with `npm run test:run -- <path reported by Vitest>`; compare against base source using read-only Git inspection when needed.
- [x] Distinguish incorrect behavior, obsolete fixture, environment mismatch, and intermittent timeout. A passing isolated rerun alone does not prove the cause of a timeout.
- [x] For a confirmed behavior bug, run GitNexus upstream impact for the specific symbol, report HIGH/CRITICAL risk before edits, and define the exact patch from the failing behavior.
- [x] Keep the regression test failing before applying the smallest implementation change; then rerun the file and related quota/auth/retry tests.
- [x] For stale fixtures, retain the behavioral assertions and update only the fixture that no longer models the intended state.
- [x] If any source/config changes after Task 1, rerun the full four-shard gate on the final state. Do not mix passing shards from different source revisions.

## Task 3: Close the server dependency review

**Inspect:** `workers/src/services/quizGeneration/qualityPipeline.ts`, `orchestrator.ts`, `blueprint.ts`, `src/services/ai/quizAudit.ts`, `src/services/ai/quizRepair.ts`, `src/services/ai/schemas/quizGenerationSchema.ts`, and their transitive imports.
**Tests:** `tests/quizGenerationQualityPipeline.worker.test.ts`, `tests/quizGenerationRules.worker.test.ts`, `tests/quizGenerationBlueprint.worker.test.ts`, `tests/quizGenerationOrchestrator.worker.test.ts`.
**Produces:** Explicit decision: safe to retain imports, or a separately scoped extraction proposal.

- [x] Trace runtime imports separately from `import type`; determine whether a frontend barrel survives bundling or introduces browser state/APIs.
- [x] Check for DOM, storage, React hooks, client credentials, and browser initialization in the reachable runtime chain. A path under `src/` alone is not a defect.
- [x] Preserve existing helpers when they are deterministic and Worker-compatible; document residual maintainability coupling.
- [x] If unsafe runtime coupling is demonstrated, identify exact helpers and direct imports to move into shared modules, perform impact analysis, and define a separate extraction patch with parity tests before editing. Do not duplicate the entire quality engine or alter `buildPromptV3`.
- [x] After an extraction only: run focused parity/quality tests, root and Worker typechecks, and Worker bundle dry-run (`npx wrangler deploy --dry-run --config wrangler.toml` from `workers`). A dry-run is not a production deployment.

## Task 4: Final review and concrete approval package

**Inspect:** All tracked diffs and every new source/test/migration file, including `workers/migrations/0085_server_quiz_generation.sql`, migration registry, operations fixtures, route policy, quota ledger, thin client, and feature flag.
**Update:** `docs/deployment/checkpoints/2026-09-27-server-quiz-generation-orchestrator.md` after actual execution results are known.
**Produces:** File inventory, current verification evidence, remaining risks, and exact commit scope.

- [x] Audit untracked files explicitly; `git diff` and unstaged GitNexus output alone do not cover all new files.
- [x] Check auth rejection before upstream access, account-owned action identity, concurrent/replayed requests, quota finalization, retry deadline/abort, repair/review limits, final audit, and safe error metadata.
- [x] Confirm migration 0085 has no numbering collision with the current remote base before preparing a PR; keep runtime flag off by default.
- [x] Confirm frontend full V3 feature-on uses one business request; feature-off/trial/regenerate preserve their documented paths. Verify double-click and cancel evidence.
- [x] Reuse unchanged historical gates with their provenance; rerun affected gates after fixes. Before approval provide final full Vitest, relevant typecheck/lint/build/security results and Cypress evidence. If frontend flow changes, rerun `cypress/e2e/server-quiz-generation.cy.ts` using the configured local test server and mocked providers.
- [x] Run `git diff --check` and GitNexus detect-changes against the correct base; include the separate review of untracked files in the scope assessment.
- [x] Update checkpoint with commands, counts, exit codes, source state, and unresolved blockers. Do not claim full AI production generation is verified by mocked E2E.
- [x] Present the exact reviewed files for commit approval. Commit/push/PR follow the repository gate; production migration 0085, Worker deployment, and canary remain a later rollout step.

## Completion and rollback

This fix phase is complete when the full suite has conclusive results on the final source, actual failures are resolved, runtime dependency review is documented, and the commit package is reviewable. If full verification remains blocked by tooling, report that limitation without declaring success.

No production rollback is needed for this phase because no production action occurs. Preserve pre-existing work and use focused diffs for any correction; never reset the worktree. The later feature rollout retains the existing flag-off legacy path as its rollback mechanism.

## Execution result — 27/09/2026

- Full Vitest completed on the final source: 4/4 shards, 681 files, 3,795 tests, exit 0.
- The first full run exposed an internal feature flag leaking from the public `useCreateQuizLogic` contract. GitNexus impact was LOW; the minimal fix removed it from the returned object while preserving internal use.
- TDD exposed a diagnostics defect: terminal provider retries under-counted `provider_attempts`. Impact was MEDIUM for `QuizProviderStageError` and LOW for the retry/diagnostics helpers; regression tests failed before the patch and passed afterward.
- Final gates passed: root/Worker typechecks, strict typecheck, lint, build, security checks, Worker dry-run, `git diff --check`, and GitNexus compare (`15 tracked files`, `38 symbols`, `0 processes`, risk LOW).
- Reviewed content scope is 43 files: 15 tracked diffs and 28 new files. `AGENTS.md` and `CLAUDE.md` may still appear modified in `git status` because GitNexus touched line endings/stat metadata, but their filtered hashes equal HEAD and `git diff --name-only` excludes them; they are not part of the commit scope.
- Runtime dependency audit found no reachable DOM/storage/React hook/client-secret/browser-initialization dependency. The deterministic imports remain; frontend type-barrel coupling is a documented maintainability risk only.
- Migration 0085 does not collide with `origin/main`; runtime feature flag and percentage remain disabled by default.
- Cypress 7/7 is retained as historical checkpoint evidence because the final fixes did not change the browser flow. It proves mocked UI behavior, not real provider production generation.
- No commit, push, PR, migration, deployment, feature-flag enablement, canary, or production mutation occurred. The next gate is explicit user approval of the reviewed commit scope.
