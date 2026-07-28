# Auth Cookie Enforcement Runbook

## Status

The repository default is now:

```text
AUTH_MIGRATION_MODE="enforce"
AUTH_TOKEN_TRANSPORT_MODE="cookie"
```

This checked-in configuration is a desired deployment state only. Committing it does not deploy the Worker, change a Cloudflare secret, migrate production data or prove the production observation windows below.

## Security contract

In `enforce` mode:

- Browser authentication is accepted only from the host-only `auth_token` cookie.
- Bearer headers are ignored by the browser-session middleware.
- JWTs must use HS256 and include the expected issuer, audience and a non-negative `tokenVersion`.
- Teacher/admin `tokenVersion` must equal the current D1 account version.
- Student sessions are issued with `tokenVersion: 0`; missing versions are rejected.
- Login and password-change responses do not expose a readable token while cookie transport is active.
- Logout clears the HttpOnly cookie and returns `Cache-Control: no-store`.

In explicit `compat` mode:

- Existing Bearer sessions and legacy claim sets can be accepted temporarily.
- Accepted legacy usage emits one structured migration event.
- Token values, usernames, payloads, passwords and full URLs are never logged.

## Migration metric

Accepted compatibility traffic emits:

```json
{
  "event": "auth_legacy_session_accepted",
  "requestId": "request metadata only",
  "route": "/api/route-without-query",
  "method": "GET",
  "transport": "bearer",
  "legacyClaims": true,
  "missingTokenVersion": true,
  "role": "teacher"
}
```

Use the `event` field as the metric key. Count accepted events by hour and separately group `transport`, `legacyClaims`, `missingTokenVersion` and `role`. Do not add username, student ID, token, JWT payload, request body or query-string fields to this event.

## Rollout gates

### Before changing a deployed environment to enforce

1. Keep the deployed environment in `compat` while current clients use cookie transport.
2. Confirm `auth_legacy_session_accepted` has **zero accepted events for 72 continuous hours**.
3. Confirm login, session restore/account profile, password change and logout smoke tests pass using cookies only.
4. Confirm 401/403 rate, login success rate and protected-route latency have no unexplained regression.
5. Obtain the release owner's approval before deploying the checked-in `enforce` configuration.

The 72-hour condition cannot be satisfied by unit tests or local logs. Record exact UTC start/end timestamps and the production log query in the release evidence.

### After enforce deployment

For at least 48 continuous hours:

- watch login success and 401/403 rates;
- verify teacher, student and admin account restore flows;
- verify password-change-required accounts can complete the cookie flow;
- verify logout clears the cookie;
- verify no client starts sending Authorization headers.

Only after that 48-hour window is stable may a later change delete the compat Bearer/legacy-claims code path. That deletion is intentionally not part of this local implementation commit.

## Emergency rollback

The supported auth-validation rollback is a single configuration change:

```text
AUTH_MIGRATION_MODE="compat"
```

Redeploy the Worker through the normal reviewed release path. Do not rotate or reveal `JWT_SECRET`, do not re-enable browser token persistence, and do not add tokens back to login response bodies. Keep `AUTH_TOKEN_TRANSPORT_MODE="cookie"` during this rollback.

Rollback is appropriate only for a confirmed authentication compatibility incident. Record the incident ID, deploy SHA, UTC rollback time and the metric that triggered rollback.

## Verification commands

Run from the integration worktree before requesting deployment approval:

```text
npm run test:run -- tests/legacyJwtMigration.worker.test.ts tests/authTransport.worker.test.ts tests/authRouteTransport.worker.test.ts tests/systemJwt.worker.test.ts tests/cookieAuthClients.test.ts
npm run typecheck:workers
npm run lint
npm run security:check
npm run build
```

No production action is authorized by this document alone.
