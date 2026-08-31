# Competition Public Portal — staging verification

**Date:** 2026-08-31

**Status:** `STAGING VERIFICATION PASS → PUSH/PR APPROVAL READY`

## Candidate and isolation

- Candidate commit under test: `b81263219a7a45db5505cfa7b328ce4814703a7c` (`feat: complete competition portal staging support`).
- Branch: `feat/competition-v1`.
- Isolated Worker: `tohieuquiz-competition-stg-3c12726`, served from a workers.dev hostname.
- Verified staging API URL: `https://tohieuquiz-competition-stg-3c12726.thtohieu.workers.dev`.
- Verified Worker version: `75578796-0bf4-4c0e-a7ee-d409e1308322`.
- Isolated D1: `tohieuquiz-competition-stg-3c12726` (`e0dfa4ab-278e-494f-9491-6822eba358ce`).
- Isolated R2 buckets: `tohieuquiz-competition-stg-og-3c12726`, `tohieuquiz-competition-stg-cert-3c12726`, `tohieuquiz-competition-stg-export-3c12726`.
- Isolated queues: `tohieuquiz-competition-stg-cert-3c12726`, `tohieuquiz-competition-stg-export-3c12726`.
- Staging config had `ENVIRONMENT=staging`, staging-only origins, no production custom-domain route, and no production resource bindings. Temporary config and fixture scripts were removed after evidence capture.
- The tracked Vercel rewrite still targets the production API; ordinary Vercel Preview was therefore not used for fixture mutations or staging API smoke.

## Schema and fixture

- Historical staging candidate: D1 migration registry was verified through `0079_competition_public_portal.sql`. The integrated PR candidate renumbers this Portal migration to `0080_competition_public_portal.sql` because `main` now owns `0079_competition_runtime_rollout.sql`; this historical evidence must not be treated as `0080` verification.
- One disposable staging campaign was retained with one published public page, six rounds, six round mappings, two published article records after the admin edit/publish check, one Golden Board config, one immutable award-rule version, and a qualified disposable Student fixture.
- The staging School Exam fixture had a READY preflight and a provisioned `WITHHELD` Live Exam session. One canonical School Exam result was published for the correction/republish rehearsal; no ordinary competition attempt was created.
- Final read-only D1 counts after the rehearsal: `ordinary_attempts=0`, `school_exam_results=1`, `golden_configs=1`, `award_rule_versions=1`.

## Gate verification

All five gates were read disabled before testing. The audited staging enable order was:

1. `competition_public_portal_read_v1`
2. `competition_student_portal_v1`
3. `competition_golden_board_v1`
4. `competition_public_content_admin_v1`
5. `competition_legacy_redirect_v1`

Checks passed for disabled fallback, public index/detail/article privacy, Student portal resolution, ordinary and School Exam preflight, Golden Board freshness, admin content edit/preview/publish/audit, legacy chooser compatibility, School Exam `WITHHELD` preservation, and correction followed by republish. After the rollback rehearsal, all five gates were read disabled again:

```text
competition_golden_board_v1          enabled=0
competition_legacy_redirect_v1       enabled=0
competition_public_content_admin_v1  enabled=0
competition_public_portal_read_v1   enabled=0
competition_student_portal_v1       enabled=0
```

## Smoke evidence

The read-only smoke runner passed exactly seven checks in both lifecycle modes:

- Open-round smoke: `status=ready`, `checks=7`, `mode=read-only`, `roundLifecycle=open`.
- Finalized-round smoke: `status=ready`, `checks=7`, `mode=read-only`, `roundLifecycle=finalized`.
- Checks: `public.index`, `public.detail`, `public.article`, `public.golden_board.publication`, `student.portal.resolve`, `student.round.preflight`, `student.school_exam.preflight`.
- Reports: `reports/competition-portal-smoke.json` and `reports/competition-portal-smoke-finalized.json`.
- Reports contain only sanitized target, campaign slug, check IDs, status and durations; no credentials, cookies, access codes, candidate codes, authorization headers or tokens.
- No `/api/live-exam/join` call was made. Ordinary attempt/result counts remained unchanged at zero.
- Golden Board moved from publication/ranking `1/1` to `2/2` after the fixture correction and republish; configured `awardRuleVersion` remained `1`.

## Local verification

- Focused release/content/staging tests: `43/43` passed.
- Core Competition/School Exam regression suites: `90/90` passed across seven files.
- Cypress portal contract: passed with exit code `0`.
- `npm run lint`: passed.
- `npm run typecheck`, `npm run typecheck:strict`, `npm run typecheck:workers`: passed.
- `npm run build`: passed.
- `npm run security:check`: passed, including tracked-file/history/policy scans and production dependency audits with zero findings.
- `git diff --check`: exit code `0` (only normal CRLF conversion warnings were emitted).
- A full-repository Vitest run reported `3267/3272` tests passed. Five failures are pre-existing/outside the candidate diff by path comparison; the repository is not represented as globally green by this evidence.

## Limitation and next gate

- The real Vercel UI legacy redirect was not exercised against an isolated Preview because `vercel.json` rewrites `/api/**` to production. The staging canonical chooser API and existing stubbed Cypress contract passed; production UI enablement remains a separate approval gate.
- No push, PR, merge, production migration, production deployment, or production feature enablement was performed.
- Implementation and sanitized staging-evidence commits are complete. Next approval gate: push/PR approval.
