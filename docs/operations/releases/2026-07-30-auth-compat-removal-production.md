# Auth compatibility removal production release — 2026-07-30

## Decision boundary

The release owner explicitly accepted early closure of the planned observation gates. This release record does not claim that the original 72-hour compat window or 48-hour enforce window elapsed, and it does not substitute point-in-time verification for unavailable aggregate historical analytics.

## Source and review

- Pull request: `#20` — `security(auth): remove legacy compatibility path`
- Review state before merge: approved and clean
- Merge method: merge commit
- Merge commit: `8a9c12e8abc0c48f0218256cba75f7d6daff5660`
- Main CI: success
- Security checks: success
- Release readiness: success
- Vercel deployment status: success

## Cloudflare Worker deployment

- Worker: `tohieuquiz-api`
- New version: `96705980-78e2-4b5b-89f2-883a989dfec7`
- Version tag: `main-8a9c12e-no-compat`
- Deployment time: `2026-07-30T08:09:07.630277Z` (`2026-07-30 15:09:07 UTC+7`)
- Traffic: 100%
- Reviewed rollback version: `2003f752-22fd-4503-a05f-6c377ebfc08a`
- Removed runtime variables: `AUTH_MIGRATION_MODE`, `AUTH_TOKEN_TRANSPORT_MODE`
- Retained separate control: `AUTH_SESSION_MODE=compat`
- Secrets remained present by name: `JWT_SECRET`, `CLIPROXY_TOKEN`; no secret value was read or changed.

No D1 migration, schema change, queue mutation or production secret change occurred.

## Post-deploy verification

Production smoke run `30525655292` completed with status `ready` and 15/15 checks passed:

- canonical, apex and parent frontend shells;
- same-origin and direct API health;
- approved and hostile-origin CORS behavior;
- unauthenticated admin, teacher, student and parent guards;
- cookie-authenticated admin, teacher, student and parent reads;
- public browser smoke.

Point-in-time direct probes after deployment:

- 10/10 `/api/health` requests returned HTTP 200;
- 10/10 unauthenticated `/api/classes` requests returned HTTP 401;
- 0 observed 5xx responses;
- health average TTFB was approximately 128.67 ms, maximum 317.01 ms;
- guard average TTFB was approximately 184.52 ms, maximum 324.32 ms.

D1 evidence from the deployment timestamp through smoke completion:

- one new admin session;
- one new teacher session;
- one new student session;
- no new `security_events` row.

Parent authentication is cookie-based but does not create an `auth_sessions` row; its login and protected dashboard read passed in the production smoke.

## Residual limitation

Cloudflare aggregate historical Workers analytics was unavailable because the analytics connector closed its connection. Therefore this release record does not claim a complete historical 401/403/5xx rate or p95 latency for the prematurely closed observation windows.

## Result

Task 10 is complete under the owner-approved risk override. Browser authentication is deployed cookie-only, the Bearer/legacy compatibility path is removed, and rollback is version-based rather than flag-based.
