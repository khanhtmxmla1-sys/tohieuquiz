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

The compatibility-removal commit is prepared for review only. It does not merge itself, deploy a Worker, change production configuration or migrate D1.

## Verification requirements

Before merge:

1. Verify Bearer and claim-less legacy tokens remain rejected even when obsolete compat properties are supplied.
2. Verify current cookie tokens restore admin, teacher and student sessions.
3. Verify password-change-required staff can complete the cookie flow.
4. Verify login and password-change responses omit readable tokens.
5. Run Workers typecheck, lint, security checks and production build.
6. Review the diff as a security-sensitive authentication change.

After any later deployment:

- run the protected production smoke for admin, teacher, student and parent;
- watch login success, expected 401/403 behavior, 5xx and protected-route latency;
- check security events and auth sessions;
- rollback immediately if a confirmed authentication regression appears.

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
