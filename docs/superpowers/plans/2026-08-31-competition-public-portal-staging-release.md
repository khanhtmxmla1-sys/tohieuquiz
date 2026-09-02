# Competition Public Portal Staging Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa Competition Public Portal candidate tại commit `3c12726a647a44d87cf2fe7c338676d51bf87cd9` qua isolated staging, fixture-safe smoke, gate-by-gate validation, PR/merge gates và dark production deployment trước khi xin phê duyệt bật portal production.

**Architecture:** Không tạo Task 28 và không thêm feature mới. Plan này tái sử dụng toàn bộ code, smoke runner và rollout runbook của Task 27; staging phải tách khỏi production, tất cả năm portal feature gates bắt đầu ở trạng thái disabled, sau đó chỉ bật tuần tự trong staging để kiểm chứng. Production rollout được tách thành các approval gate: push/PR, merge + production migration/deploy, rồi production feature enablement; rollback ưu tiên tắt portal gates và giữ nguyên canonical Competition/School Exam/publication/result data.

**Tech Stack:** Git worktree, React/Vite, Cloudflare Workers + D1, existing feature-flag control plane, Vitest, Cypress, Node smoke runner, Vercel/GitHub release workflow, PowerShell on Windows.

**Spec:** `docs/superpowers/specs/2026-08-25-competition-public-portal-design.md`

## Global Constraints

- Worktree duy nhất: `C:\quizpro\.worktrees\competition-v1`.
- Branch duy nhất cho candidate: `feat/competition-v1`.
- Candidate bắt đầu plan: `3c12726a647a44d87cf2fe7c338676d51bf87cd9` (`test: add competition portal release verification`).
- Tuyệt đối không sửa main checkout `C:\quizpro`.
- Không tự động push, mở PR, merge, migrate/deploy production hoặc bật production feature flag. Mỗi nhóm thao tác này là một approval gate riêng.
- Không coi plan này là Task 28. Implementation plan gốc kết thúc ở Task 27.
- Không sửa Competition core lifecycle, School Exam orchestration, Live Exam join/submission, publication, ranking, correction, certificate hoặc XLSX contract trong release plan này.
- Portal rollout phải reversible mà không disable hoặc rollback Competition core data.
- Năm portal gates phải bắt đầu disabled trên môi trường mới:
  - `competition_public_portal_read_v1`
  - `competition_student_portal_v1`
  - `competition_legacy_redirect_v1`
  - `competition_golden_board_v1`
  - `competition_public_content_admin_v1`
- Staging smoke là read-only với business attempts/results. Smoke được phép gọi ordinary-round preflight và School Exam preflight nhưng không được gọi endpoint tạo attempt và không được gọi `/api/live-exam/join`.
- Không đưa password, cookie, access code, candidate code, JWT, token hoặc secret vào Git, report, plan evidence hoặc chat. Student cookie chỉ tồn tại trong environment variable của process/session thực thi.
- Không dùng production student/account làm fixture. Fixture phải disposable và staging-only.
- `scripts/run-competition-portal-smoke.mjs` từ chối production hosts; không thay guard này chỉ để smoke chạy.
- `vercel.json` hiện rewrite `/api/:path*` sang `https://api.thtohieu.com/api/:path*`. Vì vậy một Vercel Preview mặc định **không được coi là isolated staging** cho portal smoke nếu chưa chứng minh API traffic không chạm production. Không được dùng preview đó để mutation/fixture test.
- Staging Worker/D1/buckets/queues/service bindings phải là staging/test bindings hoặc bị loại khỏi staging runtime nếu không cần; không trỏ vào production resource identifiers.
- Rollback portal incident: tắt affected portal gate(s), chạy lại smoke/read checks, giữ canonical Competition publication/result/ranking/award data nguyên vẹn.
- Destructive schema rollback không thuộc plan này và luôn cần approval riêng.
- `.superpowers/` là scratch/untracked và không được tự động stage/commit.
- Tại thời điểm viết plan, `AGENTS.md`, `CLAUDE.md`, `docs/deployment/CURRENT_PROGRESS.md` đang có local modifications. Không tự động stage chúng cùng release plan/evidence; phải review ownership/diff trước mọi commit.

---

## File / Artifact Map

### Existing source-of-truth and release tooling — read/reuse, do not recreate

- `docs/superpowers/specs/2026-08-25-competition-public-portal-design.md` — approved product/security/rollout contract.
- `docs/superpowers/plans/2026-08-25-competition-public-portal.md` — Tasks 1–27 implementation plan; Task 27 supplies release tooling.
- `docs/operations/competition-public-portal-rollout.md` — authoritative portal rollout order and rollback rule.
- `docs/operations/staged-rollout.md` — generic feature-control-plane stop conditions and rollback semantics.
- `scripts/run-competition-portal-smoke.mjs` — staging-only read-only portal smoke runner.
- `tests/competitionPortalSmokeRunner.test.ts` — smoke runner argument/safety contract.
- `cypress/e2e/competition-public-portal.cy.ts` — full stubbed portal journey.
- `workers/migrations/0080_competition_public_portal.sql` — portal schema/backfill + five disabled rollout seeds.
- `workers/migrations/rollback/0080_competition_public_portal.rollback.sql` — destructive portal-owned rollback; not normal release rollback.
- `workers/scripts/apply-d1-migrations-safe.cjs` — safe D1 migration planner/writer.
- `src/services/api/config.ts`, `vercel.json` — current frontend/API routing behavior; important staging isolation check.

### Created/updated only during execution evidence capture

- Create after staging verification: `docs/operations/releases/2026-08-31-competition-public-portal-staging.md`
- Modify only after verified state transition: `docs/deployment/CURRENT_PROGRESS.md`
- Local report, do not commit unless explicitly required and sanitized: `reports/competition-portal-smoke.json`
- Local staged-rollout report, do not commit unless explicitly required and sanitized: `reports/staged-rollout.json`
- Any temporary staging Wrangler/config/secret material must live outside tracked repo state, preferably under `$env:TEMP`, and must be removed after evidence capture.

---

## Release Task R1: Freeze Candidate and Re-run Local Release Preflight

**Files:**
- Read: `docs/deployment/CURRENT_PROGRESS.md`
- Read: `docs/operations/competition-public-portal-rollout.md`
- Read: `scripts/run-competition-portal-smoke.mjs`
- Read: `tests/competitionPortalSmokeRunner.test.ts`
- No production/source modification.

**Interfaces:**
- Consumes: Task 27 candidate commit and existing release tooling.
- Produces: verified local candidate SHA, clean staging scope, explicit list of unrelated dirty files.

- [ ] **Step 1: Verify workspace, branch, HEAD and index before any release operation.**

Run from `C:\quizpro\.worktrees\competition-v1`:

```powershell
git status --short --branch
git branch --show-current
git rev-parse HEAD
git diff --cached --name-only
```

Expected:

```text
branch = feat/competition-v1
HEAD = 3c12726a647a44d87cf2fe7c338676d51bf87cd9
staged area = empty
```

If HEAD differs, stop and reconcile the candidate before staging. Do not silently substitute a newer SHA.

- [ ] **Step 2: Classify every dirty file and protect unrelated work.**

Run:

```powershell
git status --porcelain=v1
git diff -- AGENTS.md CLAUDE.md docs/deployment/CURRENT_PROGRESS.md
```

Expected at plan start: local modifications may exist in `AGENTS.md`, `CLAUDE.md`, `docs/deployment/CURRENT_PROGRESS.md`, plus `.superpowers/` scratch and this plan file. None may be staged automatically.

- [ ] **Step 3: Re-run the focused Task 27 release contract.**

```powershell
npm run test:run -- tests/competitionPortalSmokeRunner.test.ts tests/releaseReadiness.test.ts
npx cypress run --e2e --spec "cypress/e2e/competition-public-portal.cy.ts"
```

Expected: all tests PASS; Cypress portal journey PASS.

- [ ] **Step 4: Re-run the focused Competition regression used by Task 27.**

```powershell
npm run test:run -- `
  tests/competitionContracts.test.ts `
  tests/competitionCampaignRoutes.worker.test.ts `
  tests/competitionRoundEngine.worker.test.ts `
  tests/competitionSchoolExamOrchestration.worker.test.ts `
  tests/competitionSchoolExamEmbargo.worker.test.ts `
  tests/liveExam.worker.test.ts `
  tests/competitionPortalPrivacy.worker.test.ts
```

Expected: all focused suites PASS. No School Exam embargo or Live Exam regression.

- [ ] **Step 5: Run release static gates.**

```powershell
npm run lint
npm run typecheck
npm run typecheck:strict
npm run typecheck:workers
npm run build
npm run security:check
git diff --check
```

Expected: every command exits `0`; `git diff --check` produces no errors.

- [ ] **Step 6: Record R1 result without committing unrelated local files.**

R1 is `PASS` only if the exact SHA above remains HEAD and every command is green. If any test/build/security gate fails, status becomes `BLOCKED`; do not deploy staging until the failure is diagnosed and reviewed.

---

## Release Task R2: Establish an Isolated Staging Topology

**Files:**
- Read: `workers/wrangler.toml`
- Read: `vercel.json`
- Read: `docs/superpowers/plans/2026-08-22-competition-v1-integration-readiness.md` for the previously proven isolated Cloudflare staging pattern.
- Temporary only: staging Worker configuration under `$env:TEMP`; never commit it.

**Interfaces:**
- Consumes: candidate SHA from R1, Cloudflare/Vercel credentials already authorized on the operator machine.
- Produces: isolated staging API URL, staging D1 target, staging-only resource binding inventory, rollback application SHA/version target.

- [ ] **Step 1: Capture read-only production baseline before creating staging.**

```powershell
npx wrangler whoami
npx wrangler deployments status --config workers/wrangler.toml --json
```

Record only non-secret account/deployment metadata needed to distinguish production from staging. Do not copy production secrets or full credentials into evidence.

- [ ] **Step 2: Reuse the isolated staging deployment pattern already proven by Competition integration readiness.**

Required invariants for the staging Worker:

```text
unique staging Worker name
workers.dev or staging-only hostname
no api.thtohieu.com custom-domain route
isolated staging D1
staging/test R2 buckets where bindings are required
staging/test queues where bindings are required
staging-only JWT/session secret
ENVIRONMENT != production
ALLOWED_ORIGINS limited to staging/local verification origins
no production feature-flag state reused
```

If the executor cannot prove these invariants from the generated staging config and Cloudflare resource metadata, mark R2 `BLOCKED`. Do not fall back to production resources.

- [ ] **Step 3: Explicitly reject the unsafe Vercel Preview path unless its API isolation is proven.**

Run:

```powershell
Get-Content vercel.json | Select-String 'api.thtohieu.com'
```

Expected: current config shows the production API rewrite. Therefore Vercel Preview cannot be used as the mutation/fixture staging environment by default. A preview may be used only for read-only UI/CI evidence after confirming requests are not sent to production.

- [ ] **Step 4: Capture staging runtime values in shell variables, not tracked files.**

At execution time set values from the actual isolated deployment output:

```powershell
$env:COMPETITION_PORTAL_BASE_URL = $stagingApiUrl
$env:COMPETITION_PORTAL_STAGING_D1 = $stagingD1Name
$env:COMPETITION_PORTAL_STAGING_WRANGLER_CONFIG = $stagingWranglerConfigPath
```

Do not echo secret-bearing variables. `COMPETITION_PORTAL_BASE_URL` must be HTTPS and must not be any host rejected by `run-competition-portal-smoke.mjs`.

- [ ] **Step 5: Confirm staging health before applying portal migration/fixture.**

```powershell
Invoke-WebRequest -Uri "$env:COMPETITION_PORTAL_BASE_URL/api/health" -Method GET -UseBasicParsing
```

Expected: HTTP success from the isolated staging Worker. Confirm the response/deployment metadata maps to the staging Worker, not `api.thtohieu.com`.

---

## Release Task R3: Apply Portal Migration to Staging and Build a Disposable Fixture

**Files:**
- Read/execute: `workers/scripts/apply-d1-migrations-safe.cjs`
- Read: `workers/migrations/0080_competition_public_portal.sql`
- No production D1 mutation.

**Interfaces:**
- Consumes: isolated staging D1/config from R2.
- Produces: staging schema through `0080_competition_public_portal.sql`, five disabled portal flags, one disposable campaign/student/School Exam/Golden Board fixture.

- [ ] **Step 1: Dry-plan the staging D1 migration through 0079.**

```powershell
node workers/scripts/apply-d1-migrations-safe.cjs `
  --remote `
  --database $env:COMPETITION_PORTAL_STAGING_D1 `
  --config $env:COMPETITION_PORTAL_STAGING_WRANGLER_CONFIG `
  --confirm-remote $env:COMPETITION_PORTAL_STAGING_D1 `
  --through 0080_competition_public_portal.sql
```

Expected: migration planner targets only the staging database and ends at `0080_competition_public_portal.sql`. If the target identity is ambiguous, stop before `--write`.

- [ ] **Step 2: Apply the planned migration only to isolated staging.**

```powershell
node workers/scripts/apply-d1-migrations-safe.cjs `
  --remote `
  --database $env:COMPETITION_PORTAL_STAGING_D1 `
  --config $env:COMPETITION_PORTAL_STAGING_WRANGLER_CONFIG `
  --confirm-remote $env:COMPETITION_PORTAL_STAGING_D1 `
  --through 0080_competition_public_portal.sql `
  --write
```

Expected: migration execution succeeds and registry includes `0080_competition_public_portal.sql`.

- [ ] **Step 3: Verify the five portal flags are present and disabled before fixture testing.**

Use the staging feature-control-plane read API or a read-only staging D1 query. Required state:

```text
competition_public_portal_read_v1=false
competition_student_portal_v1=false
competition_legacy_redirect_v1=false
competition_golden_board_v1=false
competition_public_content_admin_v1=false
```

Do not enable flags by raw SQL. Flag mutations during rollout must use the audited feature-control-plane path.

- [ ] **Step 4: Create a disposable staging campaign through canonical Competition/admin workflows.**

The fixture must contain exactly the capabilities required by the existing rollout runbook:

```text
one campaign with exactly six Competition rounds
one published CompetitionPublicPage with stable campaign slug
at least one published public article
one qualified Student fixture in the campaign audience
one ordinary round whose preflight returns READY for that Student
one canonical School Exam event with active member + assigned room
one provisioned SCHOOL_EXAM_ROOM Live Exam session whose preflight returns READY
one successful certified capacity preflight required by School Exam readiness
one latest valid PUBLISHED School Exam publication/ranking source
one active immutable award-rule version
one GoldenBoardConfig bound to the same campaign/source event
```

Do not copy real production student identity, results, room codes or credentials into staging.

- [ ] **Step 5: Obtain the actual staging campaign slug and disposable Student authenticated session.**

Store only runtime values:

```powershell
$env:COMPETITION_PORTAL_CAMPAIGN_SLUG = $actualStagingCampaignSlug
$env:COMPETITION_PORTAL_STUDENT_COOKIE = $actualDisposableStudentCookie
```

Do not put the cookie into PowerShell history, report files, plan docs or Git. Prefer setting it from a secure local secret/session source rather than typing it as a literal command argument.

- [ ] **Step 6: Verify preflight remains non-mutating.**

Before enabling portal gates, record the disposable Student's ordinary attempt/result row counts. After each preflight validation in R4, re-check counts. Expected: preflight does not create/consume attempts and does not create result rows.

---

## Release Task R4: Validate Staging Gate-by-Gate and Run the Automated Smoke

**Files:**
- Execute: `scripts/run-competition-portal-smoke.mjs`
- Read: `docs/operations/competition-public-portal-rollout.md`
- Read: `docs/operations/staged-rollout.md`
- Local report: `reports/competition-portal-smoke.json`

**Interfaces:**
- Consumes: staging fixture and runtime variables from R3.
- Produces: validated staging behavior for public, Student, Golden Board, admin and legacy zones with reversible gate state.

### Gate mutation rule

For manual staging gate edits, use the existing Feature Rollout admin UI or `PATCH /api/system-settings/feature-flags/:key/batch` with:

```json
{
  "changes": [
    { "field": "enabled", "value": true }
  ],
  "reason": "Competition Public Portal isolated staging verification",
  "expectedVersion": 1
}
```

The executor must first read the current flag and substitute its actual current `version` for `expectedVersion`. HTTP `409` means reload current state and investigate; do not bypass optimistic concurrency with raw D1 writes.

- [ ] **Step 1: Confirm disabled-state fallback first.**

With all five gates disabled:

- public portal feature routes must not expose enabled portal behavior;
- Student legacy Competition behavior remains available according to compatibility contract;
- canonical Competition/School Exam staff operations remain intact;
- no data is deleted or rewritten.

If disabling portal gates breaks Competition core, stop release as `BLOCKED`.

- [ ] **Step 2: Enable only `competition_public_portal_read_v1` in staging and validate public reads.**

Check:

```text
GET /api/public/competitions
GET /api/public/competitions/{fixture-slug}
GET /api/public/competitions/{fixture-slug}/articles/{published-article-slug}
```

Expected: anonymous reads succeed; detail exposes exactly six rounds; no authenticated/student-only fields leak.

- [ ] **Step 3: Enable only `competition_student_portal_v1` next and validate authenticated Student resolution/preflight.**

Check with the disposable Student session:

```text
GET  /api/student/competitions/by-slug/{fixture-slug}
POST /api/student/competitions/{campaignId}/rounds/{roundId}/preflight
POST /api/student/competitions/{campaignId}/school-exam/preflight
```

Expected:

```text
portal slug matches fixture
exactly six rounds
ordinary preflight = READY
School Exam preflight = READY
no ordinary attempt created
no /api/live-exam/join call
```

- [ ] **Step 4: Enable only `competition_golden_board_v1` next and validate publication source.**

Check:

```text
GET /api/public/competitions/{fixture-slug}/golden-board
```

Expected: winners derive from latest valid PUBLISHED School Exam publication/ranking and configured award-rule version; response includes positive integer `publicationVersion`, `rankingVersion`, `awardRuleVersion`; no unpublished/WITHHELD official result leaks.

- [ ] **Step 5: Run the complete automated staging smoke after the first three gates are enabled.**

Because base URL, slug and cookie are already in environment variables, do not pass cookie on the command line:

```powershell
npm run competition:portal:smoke
```

Expected stdout contains exactly these seven checks as PASS:

```text
[PASS] public.index
[PASS] public.detail
[PASS] public.article
[PASS] public.golden_board.publication
[PASS] student.portal.resolve
[PASS] student.round.preflight
[PASS] student.school_exam.preflight
```

Expected final report summary:

```text
status = ready
checks = 7
mode = read-only
```

- [ ] **Step 6: Inspect the smoke report for both result and secret hygiene.**

```powershell
Get-Content reports/competition-portal-smoke.json
```

Expected: target/slug/check IDs/status/durations only; no cookie, password, access code, authorization header or token value.

- [ ] **Step 7: Re-check attempt/result counts after smoke.**

Expected: ordinary attempt/result row counts for the fixture Student are unchanged from R3 Step 6. This proves preflight did not mutate participation state.

- [ ] **Step 8: Enable `competition_public_content_admin_v1` and perform the authorized admin editing check.**

Using a disposable staging Admin:

```text
read current public content
make one staging-only edit
preview
publish through canonical portal-content API/UI
verify audit entry and scope
verify anonymous response exposes only published projection
```

Do not test by modifying production content or by directly editing D1 rows.

- [ ] **Step 9: Enable `competition_legacy_redirect_v1` last and validate compatibility.**

Expected when gate enabled: `/student/competition` follows the server-authoritative canonical portal slug/chooser path. Expected when rolled back disabled: legacy compatibility behavior remains available.

- [ ] **Step 10: Validate School Exam WITHHELD and correction+republish behavior with fixture-only data.**

Required assertions:

```text
before official Publication: Student receives no official score/rank
post-submit/result boundary preserves WITHHELD semantics
Golden Board never reads an unpublished source
fixture correction + republish produces a newer official source version
next Golden Board read reports the new publicationVersion/rankingVersion
awardRuleVersion remains the configured immutable version unless deliberately changed through its own workflow
```

- [ ] **Step 11: Apply staging stop conditions after every gate change.**

Block/rollback the current gate immediately if any of the following occurs:

```text
5xx rate > 1%
client errors > 2x baseline
p95 latency > 30% above baseline
any data-corruption signal
any authentication anomaly
privacy leak or School Exam embargo breach
```

Rollback only the affected portal gate using the feature-control-plane rollback path; do not roll back Competition result/publication data.

- [ ] **Step 12: Finish staging in a known safe state.**

After evidence capture, either disable all five staging portal gates or leave the isolated disposable staging environment clearly labeled/non-production according to operator policy. Never translate staging gate state directly into production state.

---

## Release Task R5: Capture Staging Evidence and Re-run Candidate Verification

**Files:**
- Create: `docs/operations/releases/2026-08-31-competition-public-portal-staging.md`
- Potentially modify: `docs/deployment/CURRENT_PROGRESS.md`
- Do not include secrets or raw cookies.

**Interfaces:**
- Consumes: R1–R4 verified output.
- Produces: reviewable staging evidence bound to exact candidate SHA and clear next approval gate.

- [ ] **Step 1: Create the staging evidence document with only sanitized facts.**

The document must record:

```text
candidate SHA = 3c12726a647a44d87cf2fe7c338676d51bf87cd9
branch = feat/competition-v1
staging environment identifier/URL (non-secret)
staging D1/resource names sufficient to prove isolation, but no credentials
migration through 0079 result
five gates initial disabled state
gate enable order used in staging
7/7 smoke result and report path
focused regression/Cypress/static gate results
WITHHELD verification result
Golden Board publication-version + correction/republish result
attempt-count non-mutation result
rollback rehearsal/result if performed
known limitations or blockers
next gate = push/PR approval
```

- [ ] **Step 2: Update `docs/deployment/CURRENT_PROGRESS.md` only if the staging evidence is complete.**

New status wording should be factual, for example:

```text
TASK 27 COMMITTED → STAGING SMOKE PASS → PUSH/PR APPROVAL READY
```

Do not mark PR/merge/production complete before those actions occur.

- [ ] **Step 3: Review diffs and keep unrelated local edits out of the evidence commit.**

```powershell
git diff -- docs/operations/releases/2026-08-31-competition-public-portal-staging.md docs/deployment/CURRENT_PROGRESS.md
git diff --check
npm run test:run -- tests/competitionPortalSmokeRunner.test.ts tests/releaseReadiness.test.ts
```

Expected: intended documentation only; tests green; no whitespace errors.

- [ ] **Step 4: Independent review before any staging-evidence commit.**

Reviewer checks:

```text
no secret in docs/report
candidate SHA matches deployment
staging is provably isolated
smoke = 7/7
no attempt/result mutation from smoke
all five gate semantics verified
WITHHELD and Golden Board freshness preserved
rollback is feature-gate-only
unrelated AGENTS.md/CLAUDE.md/.superpowers excluded
```

- [ ] **Step 5: Stop at commit approval gate.**

Do not stage or commit staging evidence until the user explicitly approves the exact file set and commit message.

Recommended commit message after approval:

```text
docs: record competition portal staging verification
```

---

## Release Task R6: Push Branch and Open PR — Explicit Approval Required

**Files:**
- No new implementation files by default.
- Git remote/PR metadata only.

**Interfaces:**
- Consumes: approved candidate + staging evidence commit.
- Produces: remote feature branch and reviewable PR targeting `main`.

- [ ] **Step 1: Re-verify branch, HEAD and staged/dirty state immediately before push.**

```powershell
git status --short --branch
git branch --show-current
git log --oneline -n 5
git diff --cached --name-only
```

Expected: branch `feat/competition-v1`; no unintended staged files; all expected Task 1–27 + approved staging evidence commits present.

- [ ] **Step 2: Obtain explicit user approval for push/PR.**

This plan does not authorize push automatically. If approval is absent, stop here.

- [ ] **Step 3: After approval, push the feature branch.**

```powershell
git push -u origin feat/competition-v1
```

Expected: remote branch updated successfully. Do not force-push.

- [ ] **Step 4: Open PR from `feat/competition-v1` to `main`.**

PR description must include:

```text
approved spec + implementation plan paths
Tasks 1–27 scope summary
candidate/staging evidence SHA
staging 7/7 smoke result
all five production gates remain disabled
migration 0079 is additive portal-owned schema/backfill + disabled flag seeds
no production deploy/enablement performed
rollback = disable portal gates first; preserve Competition core data
```

- [ ] **Step 5: Require full CI/security/release checks and independent code review.**

Do not merge while any required check is pending/failing or any P1/P2 security/data-integrity issue is unresolved.

- [ ] **Step 6: Treat Vercel Preview as UI evidence only unless API isolation is independently proven.**

Because tracked `vercel.json` rewrites `/api` to production, do not run staging fixture mutations through ordinary preview by assumption. If preview networking resolves to production, restrict it to read-only rendering checks or skip it for portal staging evidence.

- [ ] **Step 7: Stop at merge approval gate.**

A green PR does not authorize merge.

---

## Release Task R7: Merge and Dark Production Deployment — Separate Explicit Approval Required

**Files:**
- Release metadata/docs only after successful deployment.
- Production D1 migration and application deployment are operational mutations, not automatic consequences of PR approval.

**Interfaces:**
- Consumes: approved green PR.
- Produces: production schema/code present with all five portal gates disabled and a known rollback application version.

- [ ] **Step 1: Obtain explicit user approval for merge + production migration/deploy.**

Approval must clearly cover production mutation. If user approves merge only, merge may proceed but production migration/deploy remains blocked.

- [ ] **Step 2: Merge only the reviewed PR through the protected `main` workflow.**

After merge, record exact merge SHA. Do not use force merge or bypass required checks.

- [ ] **Step 3: Capture production pre-deploy rollback baseline.**

Record:

```text
current production Worker version
current Vercel production deployment/merge SHA
D1 latest applied migration
five portal feature-flag current states
```

Do not record secret values.

- [ ] **Step 4: Dry-plan production D1 migration through 0079 before writing.**

Use the safe migration script against the canonical production D1 only after production approval. Confirm planned target and pending migration names before `--write`.

- [ ] **Step 5: Apply approved production migration and verify all five portal seeds remain disabled.**

Expected after migration:

```text
0080_competition_public_portal.sql registered/applied
all portal schema objects present
existing Competition core data intact
all five portal flags disabled
```

Normal rollback does not run `0080_competition_public_portal.rollback.sql`.

- [ ] **Step 6: Deploy reviewed Worker/frontend candidate with portal gates still disabled.**

Record the new Worker version and previous reviewed rollback Worker version. Wait for frontend production deployment of the exact merge SHA.

- [ ] **Step 7: Run general production health/CORS/auth/role smoke with portal gates disabled.**

Expected: existing site/Competition behavior remains healthy. No portal navigation is enabled merely because code/schema are present.

- [ ] **Step 8: Stop at production feature-enablement approval gate.**

Dark deploy success does not authorize turning on any portal gate.

---

## Release Task R8: Production Portal Enablement — Separate Explicit Approval Required

**Files:**
- Update release evidence/current progress only after each verified state transition.
- No direct D1 feature-flag writes.

**Interfaces:**
- Consumes: dark production deploy with all portal gates disabled.
- Produces: controlled production enablement with rollback checkpoints.

- [ ] **Step 1: Obtain explicit user approval to start production feature enablement.**

Do not infer this approval from earlier plan, push, PR, merge or deploy approvals.

- [ ] **Step 2: Enable production gates one at a time in the approved order.**

Order is fixed:

```text
1. competition_public_portal_read_v1
2. competition_student_portal_v1
3. competition_golden_board_v1
4. competition_public_content_admin_v1
5. competition_legacy_redirect_v1
```

Each mutation uses the audited feature-control-plane UI/API with reason + optimistic version check.

- [ ] **Step 3: After each gate, run only the relevant production-safe read checks and observability review.**

Production smoke must not create attempts, join Live Exam, create results, or mutate canonical Competition data. Student preflight may be run only with an approved dedicated smoke account/fixture that cannot create real competition participation through the smoke command.

- [ ] **Step 4: Enforce stop conditions after each gate.**

Immediate rollback trigger:

```text
5xx > 1%
client errors > 2x baseline
p95 > 30% above baseline
data corruption signal
auth anomaly
privacy leak
School Exam embargo breach
wrong Golden Board publication source
legacy redirect loop/broken canonical navigation
```

- [ ] **Step 5: Roll back the smallest affected portal gate first.**

Use audited feature-control-plane rollback. After rollback:

```text
rerun production-safe smoke
verify health/observability
preserve redacted evidence
record incident cause before re-enable
```

Never roll back official Competition publication/result/ranking data to hide a portal issue.

- [ ] **Step 6: After all five gates are healthy, perform final production verification.**

Verify:

```text
public index/detail/article healthy
student dedicated portal resolves correct campaign
ordinary/School Exam preflight contracts preserved
School Exam result remains WITHHELD until Publication
Golden Board uses latest official PUBLISHED source
admin public-content editing scope/audit healthy
legacy redirect works without redirect loop
/thi/** remains noindex and excluded from sitemap
no privacy-forbidden fields in public DTOs
```

- [ ] **Step 7: Update final release evidence and `CURRENT_PROGRESS.md`.**

Only after confirmed production health may status move to a wording equivalent to:

```text
COMPETITION PUBLIC PORTAL PRODUCTION ROLLOUT COMPLETE
```

Record exact merge SHA, Worker/frontend deployment identifiers, gate states, smoke outcomes, rollback target, and any residual observation items. Do not record secrets.

---

## Rollback Decision Matrix

| Failure area | First rollback action | Data action |
|---|---|---|
| Anonymous public portal | Disable `competition_public_portal_read_v1` | Preserve Competition/publication data |
| Student dedicated portal | Disable `competition_student_portal_v1` | Preserve attempts/results; investigate portal adapter |
| Golden Board | Disable `competition_golden_board_v1` | Preserve official publication/ranking/award rules |
| Admin public-content UI/API | Disable `competition_public_content_admin_v1` | Preserve existing content rows; no destructive cleanup |
| Legacy redirect/navigation | Disable `competition_legacy_redirect_v1` | Preserve legacy route and backend data |
| Cross-cutting application defect | Disable affected portal gates; if necessary roll application back to recorded reviewed Worker/frontend version | Keep additive 0079 schema unless destructive rollback gets separate approval |
| Privacy/auth/embargo defect | Disable relevant portal gates immediately; classify release NO-GO | Do not expose or rewrite protected result data |

---

## Acceptance Criteria

The staging/release plan is complete only when all applicable statements are true:

- [ ] Candidate SHA is explicitly bound to staging evidence.
- [ ] Isolated staging is proven not to use production D1/Worker/custom-domain/resource bindings.
- [ ] Migration through `0080_competition_public_portal.sql` succeeds on staging.
- [ ] All five portal gates are initially disabled.
- [ ] Disposable staging fixture contains six rounds, qualified Student, READY ordinary preflight, READY School Exam preflight, published article and latest PUBLISHED Golden Board source.
- [ ] Automated Competition Portal smoke reports exactly `7/7` PASS and `status=ready`.
- [ ] Smoke does not create/consume ordinary attempts and does not call `/api/live-exam/join`.
- [ ] Smoke/report contains no cookie/token/password/access code.
- [ ] School Exam official result remains withheld before Publication.
- [ ] Golden Board changes source version after fixture correction+republish.
- [ ] Admin editing and legacy redirect checks pass on staging.
- [ ] All Task 27 regression/static/security gates remain green.
- [ ] Staging evidence document is independently reviewed.
- [ ] Push/PR occurs only after explicit approval.
- [ ] Merge occurs only after explicit approval and green review/CI.
- [ ] Production migration/deploy occurs only after explicit production approval.
- [ ] Production code/schema lands with all five portal gates disabled first.
- [ ] Production feature enablement occurs only after separate explicit approval.
- [ ] Production rollback path is gate-first and does not roll back canonical Competition publication/result data.

---

## Self-Review Against Approved Spec and Existing Runbook

### Spec coverage

- Design §45 reversible five-gate rollout: R3, R4, R7, R8.
- Staging smoke before production navigation: R2–R5.
- School Exam canonical orchestration and WITHHELD boundary: R3–R4, R8.
- Golden Board latest PUBLISHED source + correction/republish freshness: R4, R8.
- Legacy compatibility during rollout: R4, R8.
- Public privacy boundary: R4, R8.
- Existing Competition/School Exam regressions remain green: R1, R5.
- No new Competition lifecycle/attempt model: global constraints + R4 non-mutation checks.

### Placeholder scan

This plan intentionally uses shell/runtime variables such as `$env:COMPETITION_PORTAL_BASE_URL` rather than literal deployment URLs or secrets. Each variable has an explicit acquisition step and safety rule; none represents unimplemented product behavior.

### Type/interface consistency

No new runtime code interfaces are introduced. The plan consumes the already-implemented Task 27 CLI contract:

```text
COMPETITION_PORTAL_BASE_URL
COMPETITION_PORTAL_CAMPAIGN_SLUG
COMPETITION_PORTAL_STUDENT_COOKIE
COMPETITION_PORTAL_SMOKE_OUTPUT (optional)
```

and the existing feature-flag batch mutation contract:

```text
PATCH /api/system-settings/feature-flags/:key/batch
{ changes, reason, expectedVersion }
```

---

## Execution Handoff

Plan execution should start only after the user approves this plan. Recommended mode:

1. **Subagent-Driven Development / Operations (recommended):** use `superpowers:subagent-driven-development`, execute R1→R5 with independent review checkpoints; stop at every explicit approval gate before R6/R7/R8.
2. **Inline Execution:** use `superpowers:executing-plans`, execute the same tasks sequentially in this worktree and stop at the same approval gates.

Regardless of execution mode, do not skip the isolation proof, staging smoke, evidence review, or production approval gates.
