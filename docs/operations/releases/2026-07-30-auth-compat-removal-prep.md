# Auth compatibility removal preparation — 2026-07-30

## Decision

The release owner instructed the team to close the enforce observation gate early and continue at approximately `2026-07-30 13:21 UTC+7`.

This is an explicit risk acceptance override. It does **not** establish that the planned 48-hour production observation window completed, and it does not replace missing aggregate analytics evidence.

## Production boundary

- Production enforce began at `2026-07-30 13:05:51 UTC+7`.
- The normal 48-hour end time was `2026-08-01 13:05:51 UTC+7`.
- Protected production smoke immediately after enforce passed all 15 checks for public/API guards and authenticated admin, teacher, student and parent reads.
- The compatibility-removal branch does not deploy production, change D1 or alter secrets.

## Prepared change

Branch: `security/remove-auth-compat`

The prepared review commit removes:

- browser Bearer extraction;
- legacy JWT claim acceptance;
- compatibility telemetry emitted only for accepted legacy traffic;
- readable token fallback in auth response bodies;
- `AUTH_MIGRATION_MODE` and `AUTH_TOKEN_TRANSPORT_MODE` source/config controls.

`AUTH_SESSION_MODE` remains unchanged because it controls D1-backed session enforcement, not Bearer or legacy-claims compatibility.

## Verification evidence

- TDD RED: 6 expected failures proved the old code could still accept legacy JWTs, honor obsolete compat flags and return a readable response token.
- Expanded auth regression: 6 files and 24 tests passed.
- Announcement audience regression: 8/8 tests passed after replacing one stale Bearer fixture with the current auth cookie.
- Full Vitest regression: all four shards passed, totaling 374 files and 1,722 tests.
- Workers typecheck, lint, security scan, reachable-history secret scan, security policy gates and production build passed.
- Root and Workers production dependency audits reported zero vulnerabilities.

## Rollback boundary

After this change is eventually reviewed, merged and deployed, rollback must use the previous reviewed Worker version or commit. A runtime compatibility flag will no longer exist.

No merge or production deployment is included in this preparation step.
