# Competition Public Portal rollout runbook

This runbook is for the Competition public portal candidate. It keeps the five server-side portal gates reversible and separates portal presentation from canonical Competition, School Exam, Live Exam, publication, ranking, result, certificate, and export data.

## Safety rules

- The first deployment includes schema and code with every portal gate disabled:

  ```text
  competition_public_portal_read_v1=false
  competition_student_portal_v1=false
  competition_legacy_redirect_v1=false
  competition_golden_board_v1=false
  competition_public_content_admin_v1=false
  ```

- Seed/configuration changes are staging-only until the rollout has passed all checks.
- The portal smoke runner is read-only. It may issue the two authenticated preflight POST requests, but it must không tạo attempt / never create an attempt and it never calls `/api/live-exam/join`.
- Do not put passwords, session cookies, candidate codes, access codes, or production data in source control or smoke reports.
- Rollback means disabling the affected portal gates only. Never roll back Competition core publication/result data, School Exam publication data, ranking data, or award-rule versions to hide a portal problem.

## Canonical staging fixture workflow

Create portal content through the audited admin API after the campaign exists. A campaign created after migration 0079 has no implicit page row:

```text
POST /api/competitions/{campaignId}/public-page
POST /api/competitions/{campaignId}/articles
POST /api/competitions/{campaignId}/articles/{articleId}/publish
POST /api/competitions/{campaignId}/articles/{articleId}/archive
```

For a certified Live Exam capacity profile, seed only the isolated staging D1 with the guarded command below. It requires an exact staging database confirmation, a config with `ENVIRONMENT = "staging"`, no custom routes, and a profile bound to the candidate SHA:

```text
npm run capacity:seed:staging -- --input <certified-profile.json> --database <staging-database> --config <staging-wrangler.toml> --confirm-staging <staging-database> --candidate-sha <candidate-sha>
```

## Ordered rollout

1. Deploy the schema and application code with the five portal gates disabled. Confirm the migration is applied and the current Worker/frontend candidate SHA is recorded.
2. Seed/configure a disposable staging campaign: one published public page, six rounds, one published rules article, a qualified Student fixture, a READY School Exam room, a published Golden Board source publication, and an immutable award-rule version. Keep the fixture identities private.
3. Run the public-read smoke manually and check the anonymous index, campaign detail, article, canonical six-round projection, and the Golden Board publication/ranking/award-rule versions.
4. Run Student portal smoke with a fixture-only session cookie:

   ```text
   npm run competition:portal:smoke -- --base-url <staging-url>
   ```

   Require all checks to report `[PASS]`. The default runner validates Student resolution, an ordinary open-round preflight, and School Exam preflight readiness. It does not start or submit an attempt.

   Finalized eligibility is a separate, read-only lifecycle assertion. Run it only after recording the pre-lock `READY` evidence:

   ```text
   npm run competition:portal:smoke -- --expect-finalized-round
   ```

   In this mode the ordinary-round check passes only for the expected non-mutating `BLOCKED` / `ROUND_NOT_OPEN` response. This confirms that finalization remains authoritative and is not evidence that a closed round is ready for entry.
5. Run the Golden Board publication-version check. Confirm that only the latest valid PUBLISHED source is projected and that a withheld/unpublished source does not appear publicly. After correction and republish, confirm the public response changes to the new `publicationVersion`, `rankingVersion`, and configured `awardRuleVersion`.
6. Run the admin editing check with an authorized disposable administrator: update/preview/publish public content, verify scope and audit behavior, then confirm anonymous readers see only the published projection.
7. Run the legacy redirect/navigation check: `/student/competition` follows the server-authoritative portal slug when the redirect gate is enabled and preserves the compatibility dashboard when it is disabled or no canonical slug is available.
8. Enable one gate at a time, in this order, with an observation checkpoint after each: `competition_public_portal_read_v1`, `competition_student_portal_v1`, `competition_golden_board_v1`, `competition_public_content_admin_v1`, then `competition_legacy_redirect_v1`. Re-run the relevant smoke after each change; do not enable a gate when the preceding check is failing.

## Verification matrix

The candidate must pass the following before any production enablement decision:

- `npm run test:run -- tests/competitionPortalSmokeRunner.test.ts tests/releaseReadiness.test.ts`
- `npx cypress run --e2e --spec "cypress/e2e/competition-public-portal.cy.ts"`
- Competition core, School Exam, Live Exam, privacy, lint, frontend/strict/Worker typecheck, build, and security checks from the Task 27 release plan.
- Staging-only `npm run competition:portal:smoke -- --base-url <staging-url>` with every check `[PASS]`.

## Rollback

If public content, student navigation, Golden Board data, admin editing, legacy navigation, privacy, or availability is unhealthy, disable only the affected portal gate(s) and repeat read-only smoke. Preserve canonical Competition core publication/result data and investigate the projection/configuration defect separately. Re-enable gates only after the staging fixture and the corresponding smoke/regression checks are green again.
