# Auth Cookie Enforcement Runbook

## Current status

Browser authentication is permanently cookie-only in the current source contract:

- only the host-only `auth_token` cookie is accepted;
- `Authorization: Bearer` is ignored by browser-session authentication;
- JWT verification always requires HS256, the expected issuer and audience;
- middleware rejects tokens without a non-negative `tokenVersion`;
- login, passkey, password-change and student-login responses never expose a readable token;
- logout reads only the auth cookie, revokes its session when present and clears the cookie.

`AUTH_MIGRATION_MODE` and `AUTH_TOKEN_TRANSPORT_MODE` have been removed from source types and checked deployment configuration. `AUTH_SESSION_MODE` remains a separate session-record rollout control and is not part of the removed Bearer/legacy compatibility path.

## Compatibility removal

The separate compatibility-removal change deletes:

- Bearer token extraction for browser sessions;
- claim-less legacy JWT verification and the `allowLegacy` option;
- the `auth_legacy_session_accepted` telemetry path;
- the response-body token fallback;
- the two environment flags that could re-enable those behaviors.

Supplying obsolete `AUTH_MIGRATION_MODE=compat` or `AUTH_TOKEN_TRANSPORT_MODE=compat` properties at runtime has no effect after this change.

## Production gate record

Production was promoted to auth enforce at **2026-07-30 13:05:51 UTC+7**. The normal runbook called for a continuous 48-hour enforce observation window through **2026-08-01 13:05:51 UTC+7**.

At approximately **2026-07-30 13:21 UTC+7**, the release owner explicitly instructed the team to close the gate early and continue, accepting the risk that the full observation window and aggregate analytics evidence were incomplete. Record this as an owner risk override, not as proof that 48 continuous hours elapsed.

PR #20 was approved and merged at commit `8a9c12e8abc0c48f0218256cba75f7d6daff5660`. Worker version `96705980-78e2-4b5b-89f2-883a989dfec7` was promoted to 100% traffic at **2026-07-30 15:09:07 UTC+7**. The previous enforce version `2003f752-22fd-4503-a05f-6c377ebfc08a` remains the reviewed rollback target. No D1 migration or secret change was part of this release.

## Release verification completed

Before merge:

1. Bearer and claim-less legacy tokens were verified rejected even when obsolete compat properties were supplied.
2. Current cookie tokens restored admin, teacher and student sessions.
3. Password-change-required staff completed the cookie flow in regression coverage.
4. Login and password-change responses omitted readable tokens.
5. Workers typecheck, lint, security checks, dependency audits and production build passed.
6. The security-sensitive diff was reviewed and PR #20 was approved.

After deployment:

- production smoke run `30525655292` passed 15/15 checks for public pages, CORS, guards and authenticated admin, teacher, student and parent reads;
- D1 recorded fresh admin, teacher and student sessions and no new security event during smoke;
- ten health probes returned 200 and ten unauthenticated protected-route probes returned 401, with zero observed 5xx;
- the Worker remained at 100% on version `96705980-78e2-4b5b-89f2-883a989dfec7` after verification.

Continue normal monitoring and rollback immediately if a confirmed authentication regression appears.

## Emergency rollback after compatibility removal

The compatibility flags no longer exist. Rollback is therefore version-based:

1. Redeploy the last reviewed known-good Worker version or commit through the normal release path.
2. Keep browser token persistence disabled and continue using the HttpOnly cookie.
3. Do not rotate or reveal `JWT_SECRET` unless a separate secret-compromise incident requires it.
4. Record the incident identifier, failing metric, affected release, UTC rollback time and restored version.

Do not recreate an ad-hoc Bearer fallback inside production during an incident. Fix the regression in a reviewed change or restore the previous reviewed Worker version.

## Verification commands

Run from the isolated compatibility-removal worktree:

```text
npm run test:run -- tests/authTransport.worker.test.ts tests/authRouteTransport.worker.test.ts tests/legacyJwtMigration.worker.test.ts tests/systemJwt.worker.test.ts tests/cookieAuthClients.test.ts tests/authSessionService.worker.test.ts
npm run typecheck:workers
npm run lint
npm run security:check
npm run build
```

No production deployment is authorized by this document alone.
