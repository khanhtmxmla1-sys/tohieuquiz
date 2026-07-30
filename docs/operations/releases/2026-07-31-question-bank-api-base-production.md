# Question Bank API Base Production Release

## Scope

- Source change: PR #28, commit `af2069e591321efbf5f99f97488d2b047226b0a9`.
- Merge commit: `0b56054f2cd13bed131da04033919259890d6c50`.
- Frontend only: no Cloudflare Worker deployment and no D1 migration.
- Behavior: protected question-bank requests use the canonical API resolver, same-origin `/api` in production, cookie credentials and encoded path identifiers.

## Initial production attempt

- Vercel deployment: `HQJN8pTqrXmJDp48hBrfUM9SYARb`.
- GitHub/Vercel result: `Deployment was blocked` before a production build was published.
- The merge happened while required CI/release checks were still running. The retry must not merge until every required PR check is complete and successful.
- Production verification after the blocked attempt still found the old `TestBankBrowser` chunk containing `localhost:8787`; therefore the fix was not considered released.

## Retry gate

- [ ] PR approval recorded from a CODEOWNER.
- [ ] ESLint, frontend/Worker typecheck, all four Vitest shards, coverage, production build, security, Cypress and release-readiness are successful.
- [ ] Merge only after the final pending check becomes successful.
- [ ] Vercel production deployment for the new merge commit is successful.
- [ ] Production JavaScript contains the question-bank route with cookie credentials and contains no `localhost:8787` fallback.
- [ ] Read-only production smoke passes.

## Rollback reference

- Previous production source before PR #28: `fead913040baef03a30e619fa392986e325d231b`.
- No data rollback is required because this release changes no Worker code or database schema.
