# Competition dashboard decomposition

## Baseline and authorization

User approved continuing the next frontend refactor on 2026-11-25. Baseline `origin/main`: d217c3566f8dec3bbcc42b64ac428b29d0bba01a. Worktree `C:/Users/Administrator/.codex/worktrees/refactor-competition-dashboard/quizpro`, branch `codex/refactor-competition-dashboard`.

Scope: decompose the 1,332-line CompetitionDashboardPage while preserving its public props/default export, DOM labels/classes/order, admin/teacher capabilities, request payloads, request IDs, timezone conversion, async cancellation, loading/error states and pending-action guards. Frontend only. Commit/push requires final scope approval under AGENTS step 6.

## Design

- Keep CompetitionDashboardPage as a thin composition root.
- Extract seven presentation sections: campaign/audience, rounds, eligibility/admissions/progress, school exam setup, reconciliation/incidents/retests, publication/rankings/corrections, certificates/exports.
- Extract audience freeze confirmation dialog with existing semantics.
- Extract typed draft models and existing pure helpers into a neutral leaf module.
- Separate data loading/selection from action/form orchestration through focused hooks. Do not move the entire 800-line state/action body into one equally large hook.
- Use explicit typed section props or grouped domain controller props; avoid passing an opaque unbounded controller to every child or adding context/store dependencies.
- Existing competitionDashboardService and public content panel APIs remain unchanged.

## Planned files

Existing: `src/features/competition/CompetitionDashboardPage.tsx`, `tests/competitionDashboardPage.test.tsx`; additional existing competition routing tests only if needed for stronger regression coverage.

New files under `src/features/competition/dashboard/`: neutral types/helpers, data/controller hooks and the seven section components/dialog above. New focused hook/behavior tests under `tests/` if existing page tests do not cover async invariants.

No Worker, shared API contract, dependency/lockfile, auth/scoring, migration, config, secret or flag change. If a concrete bug requires a behavior change, report it separately before expanding scope.

## Tasks

1. Refresh GitNexus in this worktree, inspect exact symbol context and upstream impact for the page and every moved function. An older-index preliminary page impact is LOW, but it does not replace fresh analysis. Report direct callers/flows/risk; stop for HIGH/CRITICAL. UNKNOWN is not LOW.
2. Read existing page/API/routing tests and capture baseline. Add meaningful characterization for missing async cancellation, admin/teacher guards and representative payload/date/action transitions. These tests should pass on unchanged baseline: pure refactor behavior TDD uses characterization, not a fabricated behavior failure. If introducing a new extraction interface, test it RED before implementing it.
3. Extract neutral types/helpers with exact semantics. Preserve request-ID construction and timezone helpers.
4. Extract data loading/selection hook, preserving effect dependencies, cancellation, allSettled partial-error behavior, selected event/class derivation and draft reinitialization.
5. Extract coherent action/form hooks for campaign/round/admission and school exam/reconciliation/publication/downstream operations. Preserve existing guards and try/finally placement, side effects and network order. Avoid unsolicited bug fixes.
6. Extract section components/dialog preserving DOM, responsive classes, accessible names and action enablement. Compose through explicit typed props; reduce page size without recreating a large controller monolith.
7. Review and verify: focused page/API/routing/hooks tests; import-cycle regression; lint; frontend/strict/Worker typecheck; frontend build/security/performance; browser responsive checks at 320/768/desktop for the page using stubbed services, without production mutations. Review for stale response/state capture, duplicate fetches, pending-action concurrency, role checks, request-ID/payload drift and new import cycles. Independent spec/quality review; resolve P1/P2. Refresh GitNexus and detect_changes compare origin/main before commit.
8. Present exact final files, evidence, risks and approval request. After approval commit/push/PR, wait required CI and human review, recheck HEAD and merge. Verify exact frontend deployment SHA and read-only production smoke. No Worker deploy needed. Cleanup only clean merged worktree/branch; preserve dirty C:/quizpro.

## Verification and acceptance

- Existing page behavior tests pass before and after refactor.
- Representative admin and teacher flows retain identical calls/payloads, date conversion and response handling.
- Stale requests cannot overwrite current selection where baseline already cancels them.
- Main page is a small composition root; domain hooks/sections have bounded responsibilities, not a relocated monolith.
- Zero frontend import cycles; no new dependency or backend/config change.
- Local focused checks, independent review and required CI pass.

## Rollback

Frontend commit revert/deployment rollback only; no data or Worker rollback. A discovered baseline defect is documented and handled in a separate approved behavior fix unless essential to the extraction.

## Risks

Preliminary architectural risk MEDIUM: many state setters and async closures are coupled, so role/date/pending-action and cancellation characterization is required. The source graph may undercount dynamically loaded callers; runtime tests remain necessary. Production authenticated UI smoke depends on available approved credentials; do not create production campaigns/events/certificates or paid jobs for verification.

## Pre-change gate evidence

Fresh index: 27,181 nodes / 55,102 edges / 300 flows. Exact upstream impact for the page and all 30 nested/helper functions completed. All LOW except `createRequestId`: HIGH, 19 direct callers, 20 impacted symbols, zero graph-reported processes, limited to Competition. Its implementation is intended to move unchanged, preserving UUID/fallback construction. AGENTS requires confirmation after this newly discovered HIGH result; implementation is stopped pending that confirmation.

Baseline page/API/routing: 3 suites / 33 tests PASS before application source changes. No application code changed at this gate.

## Implementation and final verification — 2026-11-25

The user explicitly approved the HIGH helper impact before continuing implementation. Source implementation is complete; final commit/push/PR approval remains pending.

- Page reduced from 1,331 to 509 lines; seven sections, one dialog and seven domain/data hooks extracted. Props, drafts and composition remain explicit.
- All five helper bodies match baseline, including the UUID/fallback implementation. Independent review confirms all 19 request-ID call arguments, six effects/dependencies, 23 action paths and rendered role/phase guards preserve baseline behavior. No remaining P1/P2.
- Added three characterization cases: stale campaign response, successful sibling data after partial allSettled failure, and pending preview locking. The stale-response test was independently mutation-checked: removing cancellation in memory makes it fail.
- Final page/API/routing/import-cycle run: 4 suites / 39 tests PASS. Independent page/API/routing: 36/36 PASS.
- Frontend/strict/Worker typechecks, full lint, frontend build, security scan and performance budget PASS. Initial JS 169,260 bytes gzip; unchanged budget 204,800. CSS 48,322 bytes gzip.
- Browser: six admin/teacher cases at 320/768/1440px PASS for sections/control availability. Baseline d217c35 and refactor both show existing Admin overflow at 320px (scrollWidth 325 versus clientWidth 305 in the CT harness); this package does not fix it. No-overflow assertions apply to the other five cases only. Report this limitation explicitly; do not claim full 320px layout correctness.
- Lazy route test now waits up to 5 seconds for the imported heading, retaining the routing assertion; independent comparison proved the extracted module graph mounts correctly after the previous 1-second test timeout.
- Incremental GitNexus failed internally with Invalid UTF-8. Full index-only rebuild succeeded: 27,230 nodes / 55,219 edges / 300 flows. Zero cycles. Final compare includes all 22 files, 100 symbols, LOW risk and zero graph-reported affected processes.
- No Worker/API/scoring/auth/dependency/lockfile/migration/config/secret/flag changes. No production mutation or deployment. Generated AGENTS/CLAUDE statistics excluded.

Exact proposed delivery scope (22 files):

1. `docs/superpowers/plans/2026-11-25-competition-dashboard-refactor.md`
2. `src/features/competition/CompetitionDashboardPage.tsx`
3. `tests/competitionDashboardPage.test.tsx`
4. `tests/competitionDashboardRouting.test.tsx`
5. `cypress/component/competition-dashboard-layout.cy.tsx`
6. `src/features/competition/dashboard/AudienceFreezeDialog.tsx`
7. `src/features/competition/dashboard/CampaignAudienceSection.tsx`
8. `src/features/competition/dashboard/CertificatesExportsSection.tsx`
9. `src/features/competition/dashboard/EligibilitySection.tsx`
10. `src/features/competition/dashboard/PublicationSection.tsx`
11. `src/features/competition/dashboard/ReconciliationSection.tsx`
12. `src/features/competition/dashboard/RoundsSection.tsx`
13. `src/features/competition/dashboard/SchoolExamSection.tsx`
14. `src/features/competition/dashboard/dashboardHelpers.ts`
15. `src/features/competition/dashboard/dashboardTypes.ts`
16. `src/features/competition/dashboard/useCampaignActions.ts`
17. `src/features/competition/dashboard/useCompetitionDashboardData.ts`
18. `src/features/competition/dashboard/useDownstreamActions.ts`
19. `src/features/competition/dashboard/useEligibilityActions.ts`
20. `src/features/competition/dashboard/usePublicationActions.ts`
21. `src/features/competition/dashboard/useRoundActions.ts`
22. `src/features/competition/dashboard/useSchoolExamActions.ts`
