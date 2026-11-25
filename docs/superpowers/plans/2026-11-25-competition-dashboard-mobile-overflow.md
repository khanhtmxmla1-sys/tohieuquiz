# Competition dashboard Admin 320px overflow fix

Baseline: origin/main 53b5fe1. Dedicated worktree competition-dashboard-mobile-overflow; branch codex/fix-competition-dashboard-mobile-overflow. User requested implementation of the previously confirmed Admin 320px horizontal overflow.

Scope: remove the Admin320 exception from cypress/component/competition-dashboard-layout.cy.tsx, identify the actual overflow element using browser geometry, and apply minimal responsive classes in the responsible dashboard section(s). Preserve content, permissions, callbacks, state, API payloads and desktop layout. No clipping/overflow-hidden workaround, dependency, backend, migration or deployment config changes.

1. Capture RED with unconditional no-overflow assertion at all six role/width cases. Record actual overflowing nodes and bounds at320.
2. Refresh GitNexus and run upstream impact for every existing component edited; report risk. Stop for HIGH/CRITICAL before source changes.
3. Delegate scoped CSS fix to worker. Keep change local: wrap/shrink intrinsic content or controls as geometry demonstrates, not arbitrary whole-page widths.
4. GREEN all six Cypress cases; verify controls remain available/visible and text is not clipped. Test populated round controls where relevant. Run focused page/API/routing/import-cycle tests, scoped lint/typecheck and frontend build/performance/security proportionate to scope.
5. Independent diff/geometry review, resolve P1/P2; detect_changes before commit. Present exact final files/evidence/remaining risks for commit/push approval under AGENTS step6.
6. After approval commit/push/PR; required CI and human review before merge. Verify frontend deploy SHA and read-only smoke. No Worker deployment. Cleanup clean merged task artifacts only.

Expected files: this plan, the existing Cypress component spec and only dashboard section(s) proven to cause overflow. A new affected area must be reported before expanding source scope. Success: no horizontal page overflow at320/768/1440 for both roles; existing actions/permissions unchanged, no hidden/clipped content. Rollback: frontend revert/deployment rollback.

## Implementation evidence

RED: removing the Admin320 exception produced 5 passing / 1 failing cases. At320, clientWidth305, dashboard width273, computed implicit grid track309 and page scrollWidth325. Browser experiments identified CampaignAudienceSection's intrinsic sizing as a page-level constraint, and populated Round date fields also exceeded their inner card despite a document-only width check.

Fresh exact impacts: RoundsSection and CampaignAudienceSection both LOW, each one direct caller (page), zero graph-reported processes. Both source edits were preceded by impact checks. Only CSS classes changed: min-w-0 on the two outer grid items and four round field labels; explicit grid-cols-1 on the mobile campaign form with existing sm:grid-cols-2 retained. No clipping or hidden overflow.

GREEN: Cypress8/8, comprising both roles at320/768/1440 plus populated Round and Campaign form tests. Date/time and numeric edits retain values; input bounds are checked against label and card content. Independent browser geometry confirms campaign form197/197 and round form205/205 at305px client width; date/time/calendar remain readable. Independent review: no P1/P2.

Focused page/API/routing/import-cycle tests39/39 PASS. Frontend typecheck and scoped ESLint PASS. Final frontend build, security scan and performance budget PASS: initial JS169257 gzip bytes, CSS48322, existing budgets unchanged. Final detect_changes compare ran successfully:4 files,8 symbols,LOW,zero graph-reported processes. Limitation: final index refresh failed twice at the parser's5-second worker startup handshake, including single-worker retry. The successful pre-edit index/impacts and earlier refresh remain available, but the final compare is not represented as fresh-index proof. Returned extra symbol names are not all trustworthy mappings; file scope, CSS-only diff, independent geometry and runtime regression provide corroborating evidence. No global GitNexus reinstall or tool-source modification was performed.

Proposed final scope (4 files):

1. `docs/superpowers/plans/2026-11-25-competition-dashboard-mobile-overflow.md`
2. `cypress/component/competition-dashboard-layout.cy.tsx`
3. `src/features/competition/dashboard/RoundsSection.tsx`
4. `src/features/competition/dashboard/CampaignAudienceSection.tsx`

No commit/push/deploy yet. No Worker, dependency, API, auth, scoring, config, secret, flag or migration change.
