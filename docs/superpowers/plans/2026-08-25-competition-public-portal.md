# Competition Public Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved **SÂN CHƠI TÔ HIỆU QUIZ** public microsite, dedicated authenticated Student Competition portal, privacy-safe Golden Board, and staff public-content controls on top of the existing canonical Competition V1 / School Exam / Live Exam backend without rebuilding scoring, attempts, publication, ranking, correction, certificate, or export engines.

**Architecture:** Keep three hard zones over one canonical Competition backend: anonymous PUBLIC `/cuoc-thi/**` + `/api/public/competitions/**`, authenticated STUDENT `/thi/**` + `/api/student/competitions/**`, and existing STAFF `/teacher/competition` + `/api/competitions/**`. Add only portal/content/award persistence, thin student adapters, public DTO projections, and UI shells. Ordinary rounds continue through canonical Competition attempts; School Exam remains a post-six-round phase backed by canonical School Exam + `SCHOOL_EXAM_ROOM` Live Exam sessions and `WITHHELD` results until official Publication.

**Tech Stack:** React 19, React Router 8, TypeScript 5.8, Vite 6, Cloudflare Workers, D1/SQLite migrations, Zod 4, Vitest 4, Testing Library, Cypress 15, existing feature-rollout control plane, existing Competition and Live Exam services.

**Spec:** `docs/superpowers/specs/2026-08-25-competition-public-portal-design.md`

## Global Constraints

- Work only in `C:\quizpro\.worktrees\competition-v1` on `feat/competition-v1`.
- Never edit `C:\quizpro` or the `main` branch while executing this plan.
- Do not push or create a PR unless the user later explicitly approves those gates.
- Do not rebuild Competition core. Reuse `campaignService`, `roundService`, `eligibilityService`, existing Competition attempt start/submit, School Exam orchestration, Live Exam, Publication + Ranking, Result Correction, certificate, and XLSX export.
- School Exam is **after** six rounds; it is not round 6 and must never create an ordinary `competition_round_attempt`.
- `/api/public/competitions/**` is a dedicated anonymous read-only handler and must never serialize staff/student domain rows generically.
- Public winner DTO allowlist is exactly display-safe data: `fullName`, `className`, `schoolName`, `gradeLevel`, `awardCode`, `awardLabel`, plus non-sensitive source-version metadata at the board level. Never expose username, internal student/result/class/room IDs, email, phone, guardian data, raw answers, attempts, incidents, retests, reconcile internals, access codes, or artifact paths.
- Student identity is always derived from the authenticated Student session. Browser-supplied identity fields are ignored/rejected.
- Entry preflight never creates or consumes attempts/results. Start/join revalidates critical conditions server-side.
- School Exam actual join remains `POST /api/live-exam/join`; do not create a parallel join or scoring path.
- `/thi/**` must render outside `StudentDashboardUI` and remain `noindex` / absent from sitemap.
- Public-page lifecycle is independent from Competition campaign lifecycle.
- Golden Board source is only latest valid PUBLISHED publication/ranking for `GoldenBoardConfig.source_event_id` + configured immutable award-rule version.
- Each task below ends with its own focused commit; do not mix unrelated cleanup.
- For every RED step, first run the named focused test and confirm the expected failure reason before implementation. For every GREEN step, rerun that focused test before committing.

## Planned File Ownership Map

| Area | Exact files | Responsibility |
|---|---|---|
| Portal persistence | `workers/migrations/0080_competition_public_portal.sql`, `workers/migrations/rollback/0080_competition_public_portal.rollback.sql`, `workers/schema.sql` | Add public page, articles, Golden Board config, award-rule versions/rules, deterministic DRAFT backfill, rollout flag seeds, school display-name setting seed |
| Shared contracts | `shared/competition-portal.contract.ts`, `schemas/competitionPortal.schema.ts`, `schemas/index.ts` | Public/student/staff portal DTOs, stable reason codes, lifecycle enums, request validation |
| Portal domain services | `workers/src/competition/publicPageService.ts`, `competitionArticleService.ts`, `goldenBoardConfigService.ts`, `goldenBoardService.ts`, `studentPortalService.ts` | Lifecycle/content, award config/rules, winner projection, slug resolution and preflight |
| Public API | `workers/src/routes/publicCompetitions/index.ts`, `workers/src/router/createWorkerFetch.ts`, `src/services/api/routes/competitionPortal.ts`, `src/services/api/index.ts` | Anonymous read-only routes before authenticated Competition dispatch |
| Staff API | `workers/src/routes/competitions/portalRoutes.ts`, `workers/src/routes/competitions/index.ts`, `src/features/competition/public-content/competitionPublicContentService.ts` | Scoped staff reads and Admin-only portal mutations |
| Student API/client | `workers/src/routes/competitions/studentPortalRoutes.ts`, `workers/src/routes/competitions/index.ts`, `src/features/competition/portal/studentCompetitionPortalService.ts` | Slug resolver, ordinary/School Exam preflight, authenticated portal data |
| Feature rollout | `workers/src/competition/portalFeatureFlags.ts`, `src/config/featureFlags.ts` | Independent reversible public/student/redirect/board/admin gates |
| Route shells | `src/app/AppRoutes.tsx`, `src/app/lazyViews.ts`, `src/app/navigationRoutes.ts` | Public routes, Student protected `/thi/**`, safe `returnTo`, legacy compatibility |
| Public UI | `src/features/competition/portal/public/*` | Microsite shell, index, campaign detail, article, Golden Board, safe Markdown |
| Student UI | `src/features/competition/portal/student/*` | Dedicated shell, campaign journey, round/rules/preflight, ordinary and School Exam player |
| Staff UI | `src/features/competition/public-content/*`, `src/features/competition/CompetitionDashboardPage.tsx` | Public page/article/Golden Board/award-rule management and preview |
| SEO/sitemap | `src/features/competition/portal/public/useCompetitionPortalSeo.ts`, `scripts/generate_sitemap.cjs` | Canonical/meta/OG, published portal sitemap, exclusion of `/thi/**` |
| Tests | focused files named in each task + `cypress/e2e/competition-public-portal.cy.ts` | Contract, migration, service, authorization/privacy, routing, a11y, regression/E2E |

---

## Phase 1 — Persistence and Contracts

### Task 1: Add portal schema, deterministic backfill, rollback, and disabled rollout seeds

**Files:**
- Create: `workers/migrations/0080_competition_public_portal.sql`
- Create: `workers/migrations/rollback/0080_competition_public_portal.rollback.sql`
- Modify: `workers/schema.sql`
- Create: `tests/competitionPublicPortalMigration.worker.test.ts`

**Interfaces Consumes:** existing `competition_campaigns`, `competition_school_exam_events`, `feature_flags`, `feature_flag_rules`, `system_settings`, `admin_audit_logs`.

**Interfaces Produces:**
- `competition_public_pages`
- `competition_articles`
- `competition_award_rule_versions`
- `competition_award_rules`
- `competition_golden_board_configs`
- disabled rollout flags: `competition_public_portal_read_v1`, `competition_student_portal_v1`, `competition_legacy_redirect_v1`, `competition_golden_board_v1`, `competition_public_content_admin_v1`
- `system_settings.school_name` seeded only when absent, using current canonical brand value `Trường Tiểu học Tô Hiệu`.

- [ ] **RED — add migration contract test.** Assert the migration/rollback files exist; all five portal tables exist; `campaign_id` is unique on public page/config; `(campaign_id, slug)` is unique for articles; award-version/rule composite references exist; source-event cross-campaign guard trigger exists; slug immutability-after-first-publish trigger exists; all rollout seeds are disabled; rollback drops only portal-owned objects.

```ts
expect(migration).toContain('CREATE TABLE IF NOT EXISTS competition_public_pages');
expect(migration).toContain('CREATE TABLE IF NOT EXISTS competition_articles');
expect(migration).toContain('CREATE TABLE IF NOT EXISTS competition_award_rule_versions');
expect(migration).toContain('CREATE TABLE IF NOT EXISTS competition_award_rules');
expect(migration).toContain('CREATE TABLE IF NOT EXISTS competition_golden_board_configs');
expect(migration).toContain('COMPETITION_PUBLIC_SLUG_IMMUTABLE');
expect(migration).toContain('GOLDEN_BOARD_SOURCE_EVENT_CAMPAIGN_MISMATCH');
```

- [ ] Run `npm run test:run -- tests/competitionPublicPortalMigration.worker.test.ts`. **Expected RED:** missing `0080_competition_public_portal.sql` / required tables.
- [ ] Implement migration. `competition_public_pages.status` is `DRAFT|PREVIEW|PUBLISHED|ARCHIVED`; articles are `DRAFT|PUBLISHED|ARCHIVED`; Golden Board `display_mode` accepts only `AWARD_WINNERS`; rule scope is `EVENT|GRADE`; rule versions are immutable after activation. Use trigger-based same-campaign checks for `source_event_id` and active award version.
- [ ] Backfill exactly one DRAFT public page per existing campaign with `INSERT ... SELECT ... WHERE NOT EXISTS`. Build the slug deterministically from normalized campaign title + school year, and append a stable suffix derived from campaign ID only when the normalized base collides. Rerunning must leave any existing page/slug untouched.
- [ ] Update `workers/schema.sql` to represent the post-0079 schema exactly.
- [ ] Run `npm run test:run -- tests/competitionPublicPortalMigration.worker.test.ts tests/d1MigrationLayout.test.ts tests/d1RollbackCoverage.test.ts tests/freshD1Bootstrap.test.ts`. **Expected GREEN:** all pass; migration ordering/rollback/bootstrap remain valid.
- [ ] Run `git diff --check -- workers/migrations/0080_competition_public_portal.sql workers/migrations/rollback/0080_competition_public_portal.rollback.sql workers/schema.sql tests/competitionPublicPortalMigration.worker.test.ts`. **Expected:** no output.
- [ ] Commit: `feat: add competition public portal schema`.

### Task 2: Define strict portal contracts and Zod schemas

**Files:**
- Create: `shared/competition-portal.contract.ts`
- Create: `schemas/competitionPortal.schema.ts`
- Modify: `schemas/index.ts`
- Create: `tests/competitionPortalContracts.test.ts`

**Interfaces Consumes:** existing `shared/competition.contract.ts` IDs/statuses only where authenticated DTOs need canonical references.

**Interfaces Produces:** explicit public DTOs, staff portal DTOs, student portal adapter DTOs, five round presentation states, preflight reason codes, lifecycle/award/article enums.

- [ ] **RED — write schema/allowlist tests.** Parse valid public summary/detail/article/board DTOs and reject extra private keys through `.strict()` public schemas.

```ts
export const COMPETITION_ROUND_PRESENTATION_STATES = [
  'LOCKED', 'OPEN', 'PASSED', 'FAILED_RETRY_AVAILABLE', 'CLOSED',
] as const;

export interface PublicGoldenBoardWinnerDto {
  fullName: string;
  className: string;
  schoolName: string;
  gradeLevel: number;
  awardCode: string;
  awardLabel: string;
}
```

- [ ] Run `npm run test:run -- tests/competitionPortalContracts.test.ts`. **Expected RED:** module/schema does not exist.
- [ ] Implement contracts with separate types for `PublicCompetitionSummaryDto`, `PublicCompetitionDetailDto`, `PublicCompetitionArticleDto`, `PublicGoldenBoardDto`, `StudentCompetitionPortalDto`, `CompetitionEntryPreflightDto`, staff public-page/article/config/rule DTOs. Public board-level metadata may contain only `publicationVersion`, `rankingVersion`, `awardRuleVersion`, `publishedAt` in addition to winner display fields.
- [ ] Define stable preflight reasons including ordinary round blocks and School Exam blocks; keep transport/network errors outside business reason codes.
- [ ] Run `npm run test:run -- tests/competitionPortalContracts.test.ts tests/competitionContracts.test.ts tests/schemas.test.ts`. **Expected GREEN:** all pass.
- [ ] Run `npm run typecheck && npm run typecheck:workers`. **Expected:** exit 0.
- [ ] Commit: `feat: add competition portal contracts`.

### Task 3: Implement independent `CompetitionPublicPage` lifecycle

**Files:**
- Create: `workers/src/competition/publicPageService.ts`
- Create: `tests/competitionPublicPageService.worker.test.ts`

**Interfaces Consumes:** `competition_public_pages`, `competition_campaigns`, `auditStatement()`.

**Interfaces Produces:** `getPublicPageForStaff`, `updatePublicPageDraft`, `previewPublicPage`, `publishPublicPage`, `archivePublicPage`, `getPublishedPublicPageBySlug`.

- [ ] **RED — test independent lifecycle and slug lock.** Cover DRAFT edit, PREVIEW, first PUBLISHED timestamp, ARCHIVED, inability to anonymously resolve non-PUBLISHED state, campaign lifecycle unchanged, slug change rejected after first publish, and audit before/after metadata.
- [ ] Run `npm run test:run -- tests/competitionPublicPageService.worker.test.ts`. **Expected RED:** service missing.
- [ ] Implement state transitions exactly `DRAFT → PREVIEW → PUBLISHED → ARCHIVED`; permit staff draft edits according to schema but never mutate `competition_campaigns.status` as a side effect.
- [ ] Use `auditStatement` actions `COMPETITION_PUBLIC_PAGE_UPDATED`, `..._PREVIEWED`, `..._PUBLISHED`, `..._ARCHIVED`; include actor/request ID and safe before/after metadata.
- [ ] Run the focused test. **Expected GREEN:** all lifecycle/slug/audit assertions pass.
- [ ] Commit: `feat: add competition public page lifecycle`.

### Task 4: Implement `CompetitionArticle` persistence and publication rules

**Files:**
- Create: `workers/src/competition/competitionArticleService.ts`
- Create: `tests/competitionArticleService.worker.test.ts`

**Interfaces Consumes:** `competition_articles`, `competition_public_pages`, `auditStatement()`.

**Interfaces Produces:** staff CRUD plus public list/get constrained to PUBLISHED article + PUBLISHED parent public page.

- [ ] **RED — test article ownership/status/slug rules.** Include all eight approved article types, `(campaign_id, slug)` collision, public non-disclosure for DRAFT/ARCHIVED and parent non-PUBLISHED, and cross-campaign article lookup returning generic not-found.
- [ ] Run `npm run test:run -- tests/competitionArticleService.worker.test.ts`. **Expected RED:** service missing.
- [ ] Implement create/update/archive/delete behavior. Physical delete is allowed only for never-published DRAFT content; previously published content transitions to ARCHIVED so URLs do not leak old content through public lookup.
- [ ] Audit all staff mutations with safe metadata; content can be included only as bounded metadata such as length/hash, not duplicated wholesale into audit JSON.
- [ ] Run focused test. **Expected GREEN:** all pass.
- [ ] Commit: `feat: add competition article service`.

### Task 5: Implement Golden Board config and immutable versioned Award Rules

**Files:**
- Create: `workers/src/competition/goldenBoardConfigService.ts`
- Create: `tests/competitionGoldenBoardConfig.worker.test.ts`

**Interfaces Consumes:** `competition_golden_board_configs`, `competition_award_rule_versions`, `competition_award_rules`, `competition_school_exam_events`, `auditStatement()`.

**Interfaces Produces:** config read/update, rule-version creation/list, activation. No winner mutation endpoint.

- [ ] **RED — test source ownership, non-overlap, ties-compatible ranges, version immutability and no manual winner API.** A config referencing another campaign’s event/rule version must fail with stable safe error.
- [ ] Run `npm run test:run -- tests/competitionGoldenBoardConfig.worker.test.ts`. **Expected RED:** service missing.
- [ ] Implement `createAwardRuleVersion()` so a new version is `MAX(version)+1`, validates each `EVENT`/`GRADE` range, rejects overlaps for same scope/grade, and stores stable `award_code`, public `award_label`, `sort_order`.
- [ ] Implement `activateAwardRuleVersion()` as the only rule-set activation mutation. Activated versions/rules cannot be edited in place.
- [ ] Implement `updateGoldenBoardConfig()` validating same-campaign `source_event_id` and `award_rule_version`; `displayMode` is fixed to `AWARD_WINNERS`.
- [ ] Audit config/rule creation/activation. Do not add any API/service accepting student IDs or winner names.
- [ ] Run focused test. **Expected GREEN:** all pass.
- [ ] Commit: `feat: add golden board award configuration`.

### Task 6: Implement version-aware Golden Board projection and privacy allowlist

**Files:**
- Create: `workers/src/competition/goldenBoardService.ts`
- Create: `tests/competitionGoldenBoard.worker.test.ts`

**Interfaces Consumes:** `competition_golden_board_configs`, active award rules, latest PUBLISHED `competition_school_exam_publications`, immutable `competition_school_exam_publication_results`, `students.full_name`, `classes.name`, `system_settings.school_name`.

**Interfaces Produces:** `PublicGoldenBoardDto` only.

- [ ] **RED — cover official source pipeline.** Seed publication v1 then correction/republish v2; assert board moves to v2 without config mutation. Cover event/grade rules, tied official rank receiving same award, disabled board, unpublished event, no matching winner, and forbidden-field serialization.
- [ ] Run `npm run test:run -- tests/competitionGoldenBoard.worker.test.ts`. **Expected RED:** projection missing.
- [ ] Implement `getPublicGoldenBoard(db, campaignId)` to resolve config, latest PUBLISHED publication for `source_event_id`, configured award rule version, and award rows by official `rank_event` / `rank_grade` only.
- [ ] Resolve display identity by server joins: `students.full_name`, `classes.name`, and `system_settings.school_name`; never accept those values from a winner mutation request.
- [ ] Build DTO explicitly instead of spreading database rows. Board cache identity helper must be `${campaignSlug}:${publicationVersion}:${awardRuleVersion}` (or equivalent structured key) so republish cannot reuse older winner data.
- [ ] Run focused test plus `npm run test:run -- tests/competitionSchoolExamOrchestration.worker.test.ts tests/competitionSchoolExamEmbargo.worker.test.ts`. **Expected GREEN:** Golden Board tests pass and canonical School Exam publication/embargo remains green.
- [ ] Commit: `feat: add official golden board projection`.

---

## Phase 2 — API Boundaries, Student Adapters, Security, and Rollout

### Task 7: Add dedicated anonymous Competition public API handler

**Files:**
- Create: `workers/src/routes/publicCompetitions/index.ts`
- Modify: `workers/src/router/createWorkerFetch.ts`
- Create: `src/services/api/routes/competitionPortal.ts`
- Modify: `src/services/api/index.ts`
- Create: `tests/competitionPublicRoutes.worker.test.ts`
- Modify: `tests/workerRouter.test.ts`

**Interfaces Consumes:** public-page/article/Golden Board services; `AuthPolicy='public'` route registry support.

**Interfaces Produces:** exactly five anonymous GET surfaces from spec.

- [ ] **RED — route tests.** Assert anonymous PUBLISHED list/detail/article/board success; DRAFT/PREVIEW/ARCHIVED and unknown resources all return the same generic public 404 shape; mutation verbs return 405/404 safely; page/article lists are bounded; ETag/Last-Modified emitted for eligible content.
- [ ] Add router-order assertion proving `/api/public/competitions/**` dispatches before authenticated `/api/competitions` and never invokes JWT verification.
- [ ] Run `npm run test:run -- tests/competitionPublicRoutes.worker.test.ts tests/workerRouter.test.ts`. **Expected RED:** public route handler/dispatch absent.
- [ ] Implement only:
  - `GET /api/public/competitions`
  - `GET /api/public/competitions/:slug`
  - `GET /api/public/competitions/:slug/articles`
  - `GET /api/public/competitions/:slug/articles/:articleSlug`
  - `GET /api/public/competitions/:slug/golden-board`
- [ ] Return explicit DTOs from contracts. Never proxy staff DTOs. Apply short cache validators to page/article; Golden Board validator identity includes publication/rule versions and never intentionally serves known-stale winners.
- [ ] Register client routes with `auth: 'public'`.
- [ ] Run focused tests. **Expected GREEN:** all pass.
- [ ] Commit: `feat: add anonymous competition portal api`.

### Task 8: Add staff public-content routes with existing teacher/admin scope rules

**Files:**
- Create: `workers/src/routes/competitions/portalRoutes.ts`
- Modify: `workers/src/routes/competitions/index.ts`
- Create: `src/features/competition/public-content/competitionPublicContentService.ts`
- Create: `tests/competitionPublicContentRoutes.worker.test.ts`
- Modify: `tests/competitionDashboardApi.test.ts`

**Interfaces Consumes:** existing authenticated Competition route context, `requireTeacher`, `requireAdmin`, portal services and Zod schemas.

**Interfaces Produces:** exact staff routes from spec section 28.

- [ ] **RED — authorization matrix.** Teacher can perform scoped GET reads only; Admin can update/create/preview/publish/archive/activate. Student and anonymous are rejected. Wrong campaign scope must not leak target existence.
- [ ] Run `npm run test:run -- tests/competitionPublicContentRoutes.worker.test.ts tests/competitionDashboardApi.test.ts`. **Expected RED:** portal staff routes absent.
- [ ] Implement `portalRoutes.ts` as a focused dispatcher invoked by existing `handleCompetitionRoutesCore` after verified auth and canonical staff scoping. Keep existing school-exam/campaign routes unchanged.
- [ ] Validate every mutation with `competitionPortal.schema.ts`; use request IDs from payload/header consistent with existing Competition mutation patterns.
- [ ] Add frontend service calls for public page, articles, Golden Board config, award-rule versions and preview; no direct raw fetches from staff UI.
- [ ] Run focused tests. **Expected GREEN:** role/scoping/API registry pass.
- [ ] Commit: `feat: add competition public content admin api`.

### Task 9: Add authenticated student slug resolver and portal adapter

**Files:**
- Create: `workers/src/competition/studentPortalService.ts`
- Create: `workers/src/routes/competitions/studentPortalRoutes.ts`
- Modify: `workers/src/routes/competitions/index.ts`
- Create: `src/features/competition/portal/studentCompetitionPortalService.ts`
- Create: `tests/competitionStudentPortalResolver.worker.test.ts`

**Interfaces Consumes:** `CompetitionPublicPage.slug`, existing `listStudentCompetitions()`, `getStudentCompetition()`, audience membership, authenticated student ID resolution.

**Interfaces Produces:** `GET /api/student/competitions/by-slug/:campaignSlug` returning ownership-scoped canonical campaign/progress plus portal presentation metadata.

- [ ] **RED — ownership and page-state tests.** Authenticated Student in campaign can resolve slug even when public page is DRAFT/PREVIEW; unrelated Student gets generic 404/forbidden-safe response; teacher/admin cannot use student resolver; browser cannot choose `studentId`.
- [ ] Run `npm run test:run -- tests/competitionStudentPortalResolver.worker.test.ts`. **Expected RED:** resolver absent.
- [ ] Implement resolver as a thin adapter: slug → campaign ID → audience ownership check → existing student campaign/progress service → portal metadata. Do not duplicate attempt/eligibility/result logic.
- [ ] Add client service with typed response/error discrimination.
- [ ] Run focused test plus `npm run test:run -- tests/competitionCampaignRoutes.worker.test.ts`. **Expected GREEN:** resolver and existing student routes pass.
- [ ] Commit: `feat: add student competition slug resolver`.

### Task 10: Add non-mutating ordinary-round student preflight

**Files:**
- Modify: `workers/src/competition/studentPortalService.ts`
- Modify: `workers/src/routes/competitions/studentPortalRoutes.ts`
- Modify: `src/features/competition/portal/studentCompetitionPortalService.ts`
- Create: `tests/competitionRoundEntryPreflight.worker.test.ts`

**Interfaces Consumes:** canonical campaign audience, round status/time, eligibility/prerequisite state, attempt counts, grade/class quiz mapping.

**Interfaces Produces:** `POST /api/student/competitions/:campaignId/rounds/:roundId/preflight` → `READY|BLOCKED`, stable reason, server-time/window, attempts remaining; no attempt/result mutation.

- [ ] **RED — snapshot row counts before/after preflight.** Cover not-in-audience, round-campaign mismatch, not-open, prerequisite/eligibility block, exhausted attempts, no quiz mapping, READY; assert `competition_round_attempts` count and result tables do not change.
- [ ] Run `npm run test:run -- tests/competitionRoundEntryPreflight.worker.test.ts`. **Expected RED:** endpoint/service absent.
- [ ] Implement server evaluation by reading the same canonical conditions used by start-attempt logic. Extract only pure shared checks from `roundService.ts` if required; do not weaken `startRoundAttempt()` revalidation.
- [ ] Return server time and window in campaign timezone-safe ISO data; UI reason codes come from shared contracts.
- [ ] Run focused test plus `npm run test:run -- tests/competitionRoundEngine.worker.test.ts`. **Expected GREEN:** preflight non-mutation and start-attempt invariants both pass.
- [ ] Commit: `feat: add competition round entry preflight`.

### Task 11: Add School Exam participant preflight without a second exam model

**Files:**
- Modify: `workers/src/competition/studentPortalService.ts`
- Modify: `workers/src/routes/competitions/studentPortalRoutes.ts`
- Modify: `src/features/competition/portal/studentCompetitionPortalService.ts`
- Create: `tests/competitionSchoolExamStudentPreflight.worker.test.ts`

**Interfaces Consumes:** finalized eligibility version, `competition_school_exam_events`, members, assigned room, room window, successful certified capacity preflight, provisioned `SCHOOL_EXAM_ROOM` Live Exam session/access code.

**Interfaces Produces:** `POST /api/student/competitions/:campaignId/school-exam/preflight` with safe check-in metadata. It does not join the Live Exam.

- [ ] **RED — cover every participant check from spec section 23.** Qualified-set mismatch, no canonical active event, no active room membership, window too early/late, failed capacity preflight, unprovisioned session, wrong participant scope, and READY.
- [ ] Assert no ordinary Competition attempt and no `live_exam_participants` row exists after preflight.
- [ ] Run `npm run test:run -- tests/competitionSchoolExamStudentPreflight.worker.test.ts`. **Expected RED:** endpoint absent.
- [ ] Implement canonical event selection deterministically for the campaign phase, then resolve the authenticated student’s assigned member/room/session. Return only safe join metadata needed by the dedicated player; keep internal room/member IDs out of the browser DTO unless a canonical client operation strictly requires one.
- [ ] Access code is returned only in the authenticated Student-owned READY response because canonical `joinLiveExam(accessCode)` requires it; never expose it through public APIs/log metadata.
- [ ] Run focused test plus `npm run test:run -- tests/competitionSchoolExamOrchestration.worker.test.ts tests/competitionSchoolExamEmbargo.worker.test.ts tests/liveExam.worker.test.ts`. **Expected GREEN:** all pass.
- [ ] Commit: `feat: add school exam student preflight`.

### Task 12: Lock route authorization, safe errors, and public/private boundaries

**Files:**
- Modify: `workers/src/security/apiAuthorizationPolicy.ts`
- Modify: `tests/apiAuthorizationMatrix.test.ts`
- Create: `tests/competitionPortalAuthorization.worker.test.ts`

**Interfaces Consumes:** route security matrix from spec; current policy classifications.

**Interfaces Produces:** explicit public read policies, student-owned resolver/preflight policies, unchanged staff/school-exam policies.

- [ ] **RED — add policy cases** for every new endpoint and verb. Confirm public routes are GET-only; Student namespace is Student-owned; staff mutations are Admin; existing teacher-scoped School Exam incident/export permissions stay unchanged.
- [ ] Add runtime tests that compare unrelated-vs-missing resource error shapes so authorization does not reveal existence.
- [ ] Run `npm run test:run -- tests/apiAuthorizationMatrix.test.ts tests/competitionPortalAuthorization.worker.test.ts`. **Expected RED:** new paths have no explicit policy / wrong policy.
- [ ] Add exact policies; do not use frontend guards as authorization evidence.
- [ ] Run focused tests. **Expected GREEN:** complete matrix and safe-error checks pass.
- [ ] Commit: `test: lock competition portal authorization`.

### Task 13: Wire independent reversible feature-rollout gates

**Files:**
- Create: `workers/src/competition/portalFeatureFlags.ts`
- Modify: `workers/src/routes/publicCompetitions/index.ts`
- Modify: `workers/src/routes/competitions/studentPortalRoutes.ts`
- Modify: `workers/src/routes/competitions/portalRoutes.ts`
- Modify: `src/config/featureFlags.ts`
- Create: `tests/competitionPortalFeatureFlags.worker.test.ts`
- Modify: `tests/featureFlagService.worker.test.ts`

**Interfaces Consumes:** seeded feature flags + `resolveFeatureFlag()`; public subject uses role `public` with rule audience `all`.

**Interfaces Produces:** server gates for public read, Student portal, legacy redirect, Golden Board, and admin public-content editing; Vite umbrella helper remains optional UX gate only.

- [ ] **RED — prove each gate is independent.** Disable public read while existing Competition staff API still works; disable Golden Board while public campaign remains readable; disable admin editing while staff Competition core remains usable; disable Student portal without disabling canonical backend data.
- [ ] Run `npm run test:run -- tests/competitionPortalFeatureFlags.worker.test.ts tests/featureFlagService.worker.test.ts`. **Expected RED:** portal handlers ignore independent gates.
- [ ] Implement server-side helpers that call the existing feature-rollout resolver with correct subject. Disabled anonymous route returns generic not-found; disabled authenticated portal returns stable feature-disabled response without mutating core.
- [ ] Add frontend helpers only for UX/navigation; server remains authoritative.
- [ ] Run focused tests. **Expected GREEN:** all independent gate cases pass.
- [ ] Commit: `feat: gate competition portal rollout`.

---

## Phase 3 — Dedicated Student `/thi/**` Experience

### Task 14: Add canonical `/thi/**` routing, safe deep-link return, and legacy compatibility redirect

**Files:**
- Modify: `src/app/AppRoutes.tsx`
- Modify: `src/app/lazyViews.ts`
- Modify: `src/app/navigationRoutes.ts`
- Create: `src/features/competition/portal/student/LegacyCompetitionRedirect.tsx`
- Modify: `tests/studentCompetitionRouting.test.ts`
- Create: `tests/competitionPortalRouting.test.tsx`
- Modify: `tests/routeGuards.test.tsx`

**Interfaces Consumes:** existing `ProtectedRoute`, `buildLoginRedirect`, `resolveSafeReturnTo`, student session role, Student portal feature gate.

**Interfaces Produces:** exact `/thi/:campaignSlug` route family and temporary `/student/competition` compatibility entry.

- [ ] **RED — route tests.** Anonymous `/thi/campaign-a/vong/2/kiem-tra?x=1` must redirect through existing login with the exact internal return path; after Student login, safe resolver restores it. Reject `https://evil.test`, `//evil.test`, backslash/encoded external forms. Teacher/admin session never satisfies Student route guard.
- [ ] Test legacy route: when redirect gate enabled, one active campaign redirects to `/thi/:slug`; multiple active campaigns render chooser; when disabled, old compatibility behavior remains available.
- [ ] Run `npm run test:run -- tests/studentCompetitionRouting.test.ts tests/competitionPortalRouting.test.tsx tests/routeGuards.test.tsx`. **Expected RED:** `/thi` not allowed and legacy route is still canonical.
- [ ] Extend safe Student prefixes from only `/student/` to internal `/student/` and `/thi/` without loosening absolute/external URL rejection.
- [ ] Register `/thi/:campaignSlug`, `/vong/:roundNumber`, `/quy-che`, `/kiem-tra`, `/lam-bai` as Student-protected lazy routes outside `StudentDashboardUI`.
- [ ] Keep `/student/live-exam/:sessionId` unchanged for non-Competition Live Exam.
- [ ] Run focused tests. **Expected GREEN:** route/deep-link/legacy matrix passes.
- [ ] Commit: `feat: add dedicated competition student routes`.

### Task 15: Build the distraction-free Student Competition shell

**Files:**
- Create: `src/features/competition/portal/student/CompetitionStudentShell.tsx`
- Create: `src/features/competition/portal/student/CompetitionStudentRoute.tsx`
- Create: `tests/CompetitionStudentShell.test.tsx`

**Interfaces Consumes:** authenticated Student session, route outlet/params, portal resolver service.

**Interfaces Produces:** dedicated `/thi/**` layout with Competition identity, minimal dashboard back link outside active exam, no dashboard menu/chat/shop/achievements.

- [ ] **RED — render shell and assert forbidden dashboard UI is absent.** Also assert semantic `<main>`, skip link, visible labeled back action, and active-exam mode hides unrelated back navigation.
- [ ] Run `npm run test:run -- tests/CompetitionStudentShell.test.tsx`. **Expected RED:** shell missing.
- [ ] Implement shell and route context that resolves campaign slug once and supplies `StudentCompetitionPortalDto` to child pages; loading/business block/network failure must be distinct states.
- [ ] Run focused test. **Expected GREEN:** shell/accessibility/distraction assertions pass.
- [ ] Commit: `feat: add competition student shell`.

### Task 16: Implement Student campaign home and five-state six-round presentation mapper

**Files:**
- Create: `src/features/competition/portal/student/roundPresentation.ts`
- Create: `src/features/competition/portal/student/StudentCompetitionHomePage.tsx`
- Create: `tests/competitionRoundPresentation.test.ts`
- Create: `tests/StudentCompetitionHomePage.test.tsx`

**Interfaces Consumes:** authenticated canonical round/progress/eligibility DTO, official result only when published, canonical School Exam phase notice.

**Interfaces Produces:** exactly `LOCKED`, `OPEN`, `PASSED`, `FAILED_RETRY_AVAILABLE`, `CLOSED` presentation states and next actionable CTA.

- [ ] **RED — table-test every mapping rule.** Include passed precedence, open with attempts, failed retry available, exhausted/closed, locked prerequisite/not-open. Ensure six displayed rounds remain six and School Exam is a separate post-round card.
- [ ] Run `npm run test:run -- tests/competitionRoundPresentation.test.ts tests/StudentCompetitionHomePage.test.tsx`. **Expected RED:** mapper/page missing.
- [ ] Implement pure mapper; no authorization decisions in React. Render campaign title/status, six-round journey, student notices, School Exam notice when canonical phase applies, and official-result card only after canonical publication.
- [ ] Run focused tests. **Expected GREEN:** all pass.
- [ ] Commit: `feat: add student competition journey`.

### Task 17: Implement round detail, rules acknowledgment, and preflight screens

**Files:**
- Create: `src/features/competition/portal/student/StudentRoundPage.tsx`
- Create: `src/features/competition/portal/student/StudentRoundRulesPage.tsx`
- Create: `src/features/competition/portal/student/StudentRoundPreflightPage.tsx`
- Create: `src/features/competition/portal/student/rulesAcknowledgement.ts`
- Create: `tests/CompetitionRoundEntryPages.test.tsx`

**Interfaces Consumes:** round display data, published rules content, ordinary/School Exam preflight client endpoints.

**Interfaces Produces:** required UX sequence round → rules → non-mutating preflight → explicit start CTA.

- [ ] **RED — UI test sequence.** `VÀO THI` routes to rules, acknowledgment only enables navigation to preflight, opening either page never calls attempt-start, BLOCKED reason is text/icon not color-only, network error is not shown as ineligible.
- [ ] Run `npm run test:run -- tests/CompetitionRoundEntryPages.test.tsx`. **Expected RED:** pages missing.
- [ ] Implement session-scoped acknowledgment as UX state only; do not send/store it as an authorization credential.
- [ ] Round page shows round number/title, server windows/timezone, disclosed pass threshold, attempts used/remaining, state, result summary only when permitted; never render answer keys or hidden quiz snapshot data.
- [ ] Preflight page calls the appropriate server endpoint and renders server status/reason/window. READY shows explicit `BẮT ĐẦU` action; it still does not create an attempt.
- [ ] Run focused test. **Expected GREEN:** all pass.
- [ ] Commit: `feat: add competition round entry flow`.

### Task 18: Build dedicated ordinary-round Exam Player on canonical Competition attempts

**Files:**
- Create: `src/features/competition/portal/student/CompetitionRoundExamPlayer.tsx`
- Create: `src/features/competition/portal/student/useCompetitionRoundAttempt.ts`
- Modify: `src/features/competition/portal/studentCompetitionPortalService.ts`
- Reuse unchanged: `src/components/student/QuestionRenderer.tsx`, `src/features/quiz-player/quizAttemptDraft.ts`, quiz-player navigation/header components
- Create: `tests/CompetitionRoundExamPlayer.test.tsx`

**Interfaces Consumes:** successful fresh preflight, existing `startCompetitionRoundAttempt()` and `submitCompetitionRoundAttempt()`, existing returned quiz snapshot/presentation and server-scored result.

**Interfaces Produces:** `/thi/:campaignSlug/vong/:roundNumber/lam-bai` ordinary player with local draft recovery and idempotent submit behavior.

- [ ] **RED — test attempt boundary.** Rendering player route alone does not start. Explicit Start performs a fresh preflight then exactly one canonical start call. If conditions changed after earlier preflight, start is blocked by server and no player appears.
- [ ] Test QuestionRenderer reuse, draft restore/clear, progress, submit confirmation, idempotency key reuse on retry, and result display uses server response rather than client recomputation.
- [ ] Run `npm run test:run -- tests/CompetitionRoundExamPlayer.test.tsx tests/QuestionRendererCoverage.test.tsx tests/quizAttemptDraft.test.ts`. **Expected RED:** player/hook missing.
- [ ] Implement player from existing quiz-player primitives. Store draft by canonical attempt/quiz identity, preserve answer state across accidental reload, and clear only after confirmed submission.
- [ ] Do not create a new scorer or question renderer.
- [ ] Run focused tests plus `npm run test:run -- tests/competitionRoundEngine.worker.test.ts`. **Expected GREEN:** UI and canonical engine tests pass.
- [ ] Commit: `feat: add competition round exam player`.

### Task 19: Integrate School Exam check-in/join into the same dedicated Competition shell

**Files:**
- Create: `src/features/competition/portal/student/CompetitionSchoolExamPlayer.tsx`
- Reuse: `src/services/liveExamService.ts`, `src/features/student-dashboard/hooks/useStudentLiveExam.ts`, `src/features/student-dashboard/components/StudentLiveExamScreen.tsx`, existing Live Exam components
- Create: `tests/CompetitionSchoolExamPlayer.test.tsx`

**Interfaces Consumes:** authenticated READY School Exam preflight with canonical access code, `joinLiveExam(accessCode)`, `useStudentLiveExam().join()`, canonical status/autosave/submit/embargo behavior.

**Interfaces Produces:** Competition-branded `/thi/**/lam-bai` School Exam path without routing through `StudentDashboardUI` or `/student/live-exam/:sessionId`.

- [ ] **RED — verify no parallel model.** READY preflight followed by explicit join calls `POST /api/live-exam/join` once; no ordinary attempt endpoint is called. Teacher/admin session cannot reach join. Changed window/member state must be rejected by server-side join/session checks.
- [ ] Test waiting/active/paused/submitted states reuse canonical components; before official publication never render `ResultsRoom` official score/rank for `SCHOOL_EXAM_ROOM`; show exact embargo message from spec after submission.
- [ ] Run `npm run test:run -- tests/CompetitionSchoolExamPlayer.test.tsx tests/liveExamFrontend.test.tsx tests/LiveExamQuiz.autosaveQueue.test.tsx`. **Expected RED:** Competition School Exam wrapper missing.
- [ ] Implement wrapper that runs fresh School Exam preflight, calls `joinLiveExam` with returned access code, passes canonical session payload to existing live-exam controller/screen, and overrides post-submit/closed presentation for WITHHELD School Exam until Competition official-result endpoint reports publication.
- [ ] Run focused tests plus `npm run test:run -- tests/competitionSchoolExamEmbargo.worker.test.ts tests/liveExam.worker.test.ts`. **Expected GREEN:** integration/embargo pass.
- [ ] Commit: `feat: integrate competition school exam player`.

---

## Phase 4 — Anonymous `/cuoc-thi/**` Microsite

### Task 20: Build public Competition microsite shell and `/cuoc-thi` index

**Files:**
- Create: `src/features/competition/portal/public/CompetitionPublicShell.tsx`
- Create: `src/features/competition/portal/public/CompetitionIndexPage.tsx`
- Create: `src/features/competition/portal/public/publicCompetitionPortalService.ts`
- Create: `tests/CompetitionPublicIndexPage.test.tsx`

**Interfaces Consumes:** anonymous public list API; optional existing Student session only to smooth CTA.

**Interfaces Produces:** branded anonymous shell, responsive nav, hero, public campaign grouping, representative six-round journey, news/rules/guides/board entry points, `VÀO THI` CTA.

- [ ] **RED — anonymous render test.** No auth call required to browse; shell has skip link/header/main/footer, no teacher/student dashboard widgets, and maps public state to `UPCOMING|ONGOING|ENDED` without exposing internal campaign status.
- [ ] Run `npm run test:run -- tests/CompetitionPublicIndexPage.test.tsx`. **Expected RED:** public shell/index missing.
- [ ] Implement typed public client using only `auth:'public'` routes. Group running/upcoming/completed PUBLISHED public pages from safe DTO dates/state.
- [ ] CTA goes to canonical `/thi/:slug`; ProtectedRoute handles login/deep-link return.
- [ ] Run focused test. **Expected GREEN:** anonymous and semantic UI tests pass.
- [ ] Commit: `feat: add competition public microsite`.

### Task 21: Build campaign detail, published article pages, and safe Markdown renderer

**Files:**
- Create: `src/features/competition/portal/public/CompetitionCampaignPage.tsx`
- Create: `src/features/competition/portal/public/CompetitionArticlePage.tsx`
- Create: `src/features/competition/portal/public/CompetitionMarkdown.tsx`
- Create: `src/features/competition/portal/public/safeCompetitionMarkdown.ts`
- Create: `tests/CompetitionPublicContentPages.test.tsx`
- Create: `tests/competitionMarkdownSecurity.test.ts`

**Interfaces Consumes:** public detail/article DTOs only.

**Interfaces Produces:** public campaign landing + one PUBLISHED article rendering; approved Markdown subset with escaped raw HTML and safe URL schemes.

- [ ] **RED — security tests.** Reject/escape `<script>`, raw HTML, inline handlers, `javascript:`, `data:` executable images, embeds; allow headings, emphasis, lists, safe `https/http` links and safe project-relative links/images.
- [ ] Campaign page test covers hero, school year, summary, six-round public timeline, published schedule/rules/guide/news summaries, conditional Golden Board CTA and `VÀO THI`.
- [ ] Run `npm run test:run -- tests/CompetitionPublicContentPages.test.tsx tests/competitionMarkdownSecurity.test.ts`. **Expected RED:** components/sanitizer missing.
- [ ] Implement a small deterministic Markdown parser/renderer using project-owned code or an already-installed safe primitive; do not enable arbitrary HTML parsing or executable embeds.
- [ ] Never pass hidden audience/eligibility/quiz/room/attempt/reconcile/incident/retest/export values to React props because public DTO does not contain them.
- [ ] Run focused tests. **Expected GREEN:** content/security pass.
- [ ] Commit: `feat: add competition campaign and article pages`.

### Task 22: Build privacy-safe Golden Board UI

**Files:**
- Create: `src/features/competition/portal/public/CompetitionGoldenBoardPage.tsx`
- Create: `tests/CompetitionGoldenBoardPage.test.tsx`

**Interfaces Consumes:** `PublicGoldenBoardDto` only.

**Interfaces Produces:** official award-winner presentation at `/cuoc-thi/:campaignSlug/bang-vang`.

- [ ] **RED — render winner allowlist.** Show name/class/school/grade/award only; do not show raw rank table, score, username, IDs, room data, or hidden diagnostics. Disabled/unpublished board returns friendly public not-found/empty state without leaking why.
- [ ] Include correction/republish fixture where source `publicationVersion` changes and page renders replacement winner set after refetch.
- [ ] Run `npm run test:run -- tests/CompetitionGoldenBoardPage.test.tsx`. **Expected RED:** page missing.
- [ ] Implement grouped award presentation ordered by server-provided award sort/rule order; source versions may be placed in non-sensitive diagnostic metadata but not as student details.
- [ ] Run focused test. **Expected GREEN:** all pass.
- [ ] Commit: `feat: add competition golden board ui`.

### Task 23: Add public SEO, canonical metadata, sitemap discovery, and Student noindex

**Files:**
- Create: `src/features/competition/portal/public/useCompetitionPortalSeo.ts`
- Modify: `src/app/AppRoutes.tsx`
- Modify: `scripts/generate_sitemap.cjs`
- Modify: `tests/generateSitemap.test.ts`
- Create: `tests/CompetitionPortalSeo.test.tsx`

**Interfaces Consumes:** public page/article SEO fields, canonical site URL, anonymous public APIs.

**Interfaces Produces:** title/description/canonical/OG for PUBLISHED public pages/articles; sitemap entries for PUBLISHED pages/articles only; `robots=noindex,nofollow` for `/thi/**`.

- [ ] **RED — metadata tests.** Public campaign/article creates one canonical URL and OG fields; archived/non-public content absent. Student routes set noindex and never enter sitemap.
- [ ] Extend sitemap test so generator fetches `/api/public/competitions` and each campaign’s published article summaries when API URL exists; output only published `/cuoc-thi/**` URLs.
- [ ] Run `npm run test:run -- tests/CompetitionPortalSeo.test.tsx tests/generateSitemap.test.ts`. **Expected RED:** portal metadata/sitemap support absent.
- [ ] Implement metadata hook and sitemap fetch/render while keeping current public quiz sitemap behavior intact.
- [ ] Run focused tests, then `npm run sitemap:generate`. **Expected GREEN:** tests pass and generator exits 0.
- [ ] Commit: `feat: add competition portal seo`.

---

## Phase 5 — Staff Management, Privacy Hardening, Accessibility, and Release Evidence

### Task 24: Extend `/teacher/competition` with focused public-content management UI

**Files:**
- Create: `src/features/competition/public-content/CompetitionPublicContentPanel.tsx`
- Create: `src/features/competition/public-content/PublicPageEditor.tsx`
- Create: `src/features/competition/public-content/CompetitionArticleManager.tsx`
- Create: `src/features/competition/public-content/GoldenBoardConfigPanel.tsx`
- Create: `src/features/competition/public-content/AwardRuleVersionEditor.tsx`
- Modify: `src/features/competition/CompetitionDashboardPage.tsx`
- Create: `tests/CompetitionPublicContentPanel.test.tsx`

**Interfaces Consumes:** staff public-content service from Task 8; selected canonical campaign; current user role.

**Interfaces Produces:** staff reads for teacher/admin; Admin mutations for draft/preview/publish/archive/articles/config/rules; no manual-winner editor.

- [ ] **RED — role/UI test.** Teacher sees public state/preview data but mutation controls are disabled/absent. Admin can edit page fields, article metadata/content, select same-campaign School Exam source event, create a new award-rule version, activate it, enable board, preview, publish/archive.
- [ ] Assert there is no control or service call to type/select winner records/student IDs.
- [ ] Run `npm run test:run -- tests/CompetitionPublicContentPanel.test.tsx tests/competitionDashboardPage.test.tsx`. **Expected RED:** panel missing.
- [ ] Implement focused subcomponents; only add one integration slot in the existing large `CompetitionDashboardPage.tsx` so portal code does not further centralize into that file.
- [ ] Preview opens staff-only preview route/data and never toggles anonymous visibility. Publish/archive require explicit confirmation with accessible dialog semantics.
- [ ] Run focused tests. **Expected GREEN:** role and mutation UI pass.
- [ ] Commit: `feat: add competition public content management`.

### Task 25: Add end-to-end authorization/privacy regression tests across all three zones

**Files:**
- Create: `tests/competitionPortalPrivacy.worker.test.ts`
- Modify: `tests/apiAuthorizationMatrix.test.ts`
- Modify: `tests/competitionSchoolExamEmbargo.worker.test.ts`
- Modify: `tests/liveExam.worker.test.ts`

**Interfaces Consumes:** all new portal routes and canonical School Exam/Live Exam result routes.

**Interfaces Produces:** executable privacy/security acceptance evidence.

- [ ] Add one forbidden-field helper covering `username`, `studentId`, `email`, `phone`, guardian/parent keys, answers, attempts, incidents, retests, reconcile, internal IDs, room/access codes, storage paths; recursively scan every public DTO JSON fixture.
- [ ] Add role matrix: anonymous public GET success; anonymous student/staff denied; Student own portal success and unrelated campaign denied; Teacher/Admin cannot create student attempts via student namespace; Teacher staff-read and Admin mutation behavior exact.
- [ ] Add embargo case: School Exam participant submits, direct raw Live Exam result request remains withheld before official Publication; Competition portal official-result also returns withheld/not-found-safe state; after publish canonical result becomes available according to existing contract.
- [ ] Run `npm run test:run -- tests/competitionPortalPrivacy.worker.test.ts tests/apiAuthorizationMatrix.test.ts tests/competitionSchoolExamEmbargo.worker.test.ts tests/liveExam.worker.test.ts`. **Expected GREEN after prior tasks:** all pass.
- [ ] Run `npm run security:scan`. **Expected:** exit 0 and no new portal findings.
- [ ] Commit: `test: harden competition portal privacy`.

### Task 26: Lock mobile-first and accessibility behavior

**Files:**
- Create: `tests/CompetitionPortalAccessibility.test.tsx`
- Modify: `cypress/e2e/mobile-responsive.cy.ts`

**Interfaces Consumes:** public shell/pages, Student shell/entry/player, staff publish dialogs.

**Interfaces Produces:** keyboard/mobile/reduced-motion accessibility regression evidence.

- [ ] **RED — Testing Library/axe coverage.** Verify heading hierarchy, skip links, accessible names, focus-visible controls, status text not color-only, dialogs labeled and focus-managed, `aria-live` not continuously noisy for timer/status, no keyboard trap in player, reduced-motion class/behavior where animations exist.
- [ ] Add mobile widths (phone portrait) for `/cuoc-thi`, campaign detail, Golden Board, `/thi/:slug`, preflight, and player; verify primary touch targets are at least project minimum (`min-h-11` / equivalent 44px) and no horizontal overflow.
- [ ] Run `npm run test:run -- tests/CompetitionPortalAccessibility.test.tsx`. **Expected RED before fixes:** any missing semantics identified by the new tests.
- [ ] Make only portal-specific accessibility/layout corrections in files introduced by prior tasks; do not restyle unrelated dashboards.
- [ ] Run `npm run test:run -- tests/CompetitionPortalAccessibility.test.tsx` and `npx cypress run --e2e --spec "cypress/e2e/mobile-responsive.cy.ts"`. **Expected GREEN:** both pass.
- [ ] Commit: `test: lock competition portal accessibility`.

### Task 27: Add Competition Portal E2E journey, staging smoke script, rollout runbook, and final regression gate

**Files:**
- Create: `cypress/e2e/competition-public-portal.cy.ts`
- Create: `scripts/run-competition-portal-smoke.mjs`
- Create: `tests/competitionPortalSmokeRunner.test.ts`
- Create: `docs/operations/competition-public-portal-rollout.md`
- Modify: `package.json`
- Modify: `tests/releaseReadiness.test.ts`

**Interfaces Consumes:** all portal zones, seeded feature flags, staging API/base URL, existing release-readiness conventions.

**Interfaces Produces:** reproducible E2E + staging smoke command and reversible rollout sequence.

- [ ] Add `competition-public-portal.cy.ts` covering: anonymous index/detail/article; Student deep-link login return; six-round state display; rules→preflight with zero attempt creation; ordinary start/submit; School Exam READY→canonical Live Exam join; WITHHELD post-submit message; public Golden Board only after Publication; correction+republish source-version refresh; legacy redirect.
- [ ] Add smoke runner that performs read-only public checks plus authenticated fixture-safe Student portal preflight checks. It must never create real attempts in smoke mode; School Exam join is validated by route/preflight readiness rather than starting a production participant unless an explicit disposable staging fixture is provided.
- [ ] Add package script `competition:portal:smoke` and unit-test argument/env validation for the runner.
- [ ] Run `npm run test:run -- tests/competitionPortalSmokeRunner.test.ts tests/releaseReadiness.test.ts`. **Expected RED before runner/runbook wiring:** required script/check missing; then GREEN after implementation.
- [ ] Run `npx cypress run --e2e --spec "cypress/e2e/competition-public-portal.cy.ts"`. **Expected GREEN:** complete stubbed E2E journey passes.
- [ ] Document rollout order: deploy schema/code with all five gates disabled → staging seed/config → public-read smoke → Student portal smoke → Golden Board publication-version check → admin editing check → legacy redirect/navigation check → enable one gate at a time. Document rollback as disabling portal gates only; never roll back Competition core publication/result data.
- [ ] Run focused Competition regression:

```bash
npm run test:run -- \
  tests/competitionContracts.test.ts \
  tests/competitionCampaignRoutes.worker.test.ts \
  tests/competitionRoundEngine.worker.test.ts \
  tests/competitionSchoolExamOrchestration.worker.test.ts \
  tests/competitionSchoolExamEmbargo.worker.test.ts \
  tests/liveExam.worker.test.ts \
  tests/competitionPortalPrivacy.worker.test.ts
```

**Expected:** all pass.

- [ ] Run global gates: `npm run lint && npm run typecheck && npm run typecheck:strict && npm run typecheck:workers`. **Expected:** all exit 0.
- [ ] Run `npm run build`. **Expected:** build exits 0 and generated sitemap contains PUBLISHED public Competition URLs only when API fixture/config supplies them; `/thi/**` absent.
- [ ] Run `npm run security:check`. **Expected:** exit 0.
- [ ] On staging only, run `npm run competition:portal:smoke -- --base-url <staging-url>`. **Expected:** all smoke checks report PASS; no production feature gate is enabled by the script.
- [ ] Commit: `test: add competition portal release verification`.

---

## Cross-Task Interface Rules

### Public DTO serializer rule

Every public response is built field-by-field. The implementation must follow this shape instead of row spreading:

```ts
const winner: PublicGoldenBoardWinnerDto = {
  fullName: row.full_name,
  className: row.class_name,
  schoolName,
  gradeLevel: Number(row.grade_level),
  awardCode: row.award_code,
  awardLabel: row.award_label,
};
```

### Ordinary start boundary

The frontend sequence is fixed:

```text
round page
→ rules acknowledgement (UX only)
→ POST ordinary preflight (no mutation)
→ explicit Start
→ POST canonical competition attempt endpoint (server revalidates)
→ dedicated player
→ canonical submit
```

### School Exam join boundary

The frontend/server sequence is fixed:

```text
six rounds complete
→ canonical eligibility
→ School Exam event/member/room/session preflight (no join)
→ explicit Join
→ existing POST /api/live-exam/join
→ existing Live Exam waiting/player/autosave/submit
→ WITHHELD message
→ official Competition result only after Publication
```

### Golden Board source boundary

```text
GoldenBoardConfig.source_event_id
→ latest PUBLISHED competition_school_exam_publications row
→ matching immutable publication_results
→ configured immutable award_rule_version
→ event/grade official rank match
→ display-name joins
→ explicit public winner DTO
```

No implementation task may introduce a manual winner table/editor or use current mutable canonical result rows as the public winner source.

## Spec Coverage Matrix — 48/48

| Spec sections | Covered by tasks |
|---|---|
| 1–5 Product purpose, goals/non-goals, canonical baseline | Global Constraints; Tasks 18–19, 27 regression gate |
| 6 Three-zone architecture | Tasks 7–15, 20–25 |
| 7 Route map | Tasks 14, 20–23 |
| 8 Public access contract | Tasks 2, 7, 12, 25 |
| 9 Public microsite shell | Task 20 |
| 10 `/cuoc-thi` index | Task 20 |
| 11 campaign public detail | Task 21 |
| 12 public Golden Board | Tasks 6, 22 |
| 13 public article page | Tasks 4, 21 |
| 14 public page lifecycle | Tasks 1, 3, 8, 24 |
| 15 Student shell | Task 15 |
| 16 Student auth/role boundary | Tasks 9, 12, 14, 25 |
| 17 deep-link login return | Task 14 |
| 18 Student campaign home | Task 16 |
| 19 six-round presentation states | Tasks 2, 16 |
| 20 round page | Task 17 |
| 21 rules step | Task 17 |
| 22 entry preflight | Tasks 10, 17 |
| 23 School Exam participant checks | Tasks 11, 19 |
| 24 attempt creation boundary | Tasks 10–11, 18–19, 25 |
| 25 dedicated Exam Player | Tasks 18–19 |
| 26 ordinary submission/result | Task 18 |
| 27 School Exam embargo | Tasks 11, 19, 25 |
| 28 Competition Admin responsibility | Tasks 8, 24 |
| 29 public aggregate relationship | Tasks 1, 3–6 |
| 30 `CompetitionPublicPage` | Tasks 1, 3 |
| 31 `CompetitionArticle` | Tasks 1, 4 |
| 32 `GoldenBoardConfig` | Tasks 1, 5 |
| 33 versioned Award Rules | Tasks 1, 5–6 |
| 34 Golden Board derivation | Task 6 |
| 35 correction + republish consistency | Tasks 6, 22, 27 |
| 36 Golden Board privacy | Tasks 2, 6, 25 |
| 37 public API contract | Tasks 7, 12–13 |
| 38 public DTO shapes | Tasks 2, 6–7, 25 |
| 39 Student slug adapter | Task 9 |
| 40 Student preflight API | Tasks 10–11 |
| 41 route security matrix | Tasks 12, 25 |
| 42 error/status behavior | Tasks 2, 7, 9–12, 15, 17, 25 |
| 43 caching/freshness | Tasks 6–7 |
| 44 legacy compatibility | Task 14 |
| 45 rollout/feature flags | Tasks 1, 13, 27 |
| 46 mobile/accessibility/SEO | Tasks 20–23, 26 |
| 47 observability/audit/testing | Tasks 3–5, 8, 24–27 |
| 48 acceptance criteria/guardrails | Global Constraints + Tasks 1–27 + final verification |

## Phase Gates During Execution

After each phase, before starting the next phase:

1. `git status --short --branch` must show only the intended next-task changes or a clean worktree.
2. Run every focused test created in that phase.
3. Run `npm run typecheck:workers` after backend phases and `npm run typecheck` after frontend phases.
4. Run `git diff --check` before each task commit.
5. Do not enable production feature flags during implementation.

## Final Verification Before Execution Handoff Is Declared Complete

When all implementation tasks have been executed in a future execution session, run in this order:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run typecheck:strict`
4. `npm run typecheck:workers`
5. `npm run test:ci:all`
6. `npm run test:coverage`
7. `npm run build`
8. `npm run security:check`
9. `npx cypress run --e2e --spec "cypress/e2e/competition-public-portal.cy.ts,cypress/e2e/competition-v1.cy.ts,cypress/e2e/mobile-responsive.cy.ts"`
10. staging-only `npm run competition:portal:smoke -- --base-url <staging-url>`

Expected final result: all commands exit 0; Competition/School Exam/Live Exam canonical regressions remain green; public privacy tests prove forbidden fields absent; `/thi/**` stays outside `StudentDashboardUI`, is noindex and not in sitemap; no feature flag is changed in production by tests or smoke tooling.

## Execution Handoff

This plan stops before production-code execution. When the user chooses an execution mode, use one of the following and keep the task/commit boundaries above unchanged:

1. **Subagent-Driven Development (recommended):** `superpowers:subagent-driven-development`, one task at a time with review checkpoints.
2. **Inline Execution:** `superpowers:executing-plans`, execute the same tasks sequentially in this worktree.
