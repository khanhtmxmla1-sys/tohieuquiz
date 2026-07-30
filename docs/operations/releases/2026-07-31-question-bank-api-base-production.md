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

## Second production attempt

- Retry PR #29 passed every CI, security, Cypress and release-readiness gate before merge.
- Merge commit `8fa6e59d0852737692fc85a623d8280ca9956241` was still blocked by Vercel as deployment `G2VBqt98gfQxuzPNyavGh39Tp9vT`.
- Both blocked merge commits were created by `tongminhkhanh`; the previous successful production merge `fead913040baef03a30e619fa392986e325d231b` was created by `khanhtmxmla1-sys`.
- The final retry must be approved and merged by `khanhtmxmla1-sys`, the account associated with the successful Vercel production project.

## Final retry gate

- [ ] PR opened by `tongminhkhanh` and approved by CODEOWNER `khanhtmxmla1-sys`.
- [ ] ESLint, frontend/Worker typecheck, all four Vitest shards, coverage, production build, security, Cypress and release-readiness are successful.
- [ ] Merge only after the final pending check becomes successful, using the `khanhtmxmla1-sys` GitHub account.
- [ ] Vercel production deployment for the new merge commit is successful.
- [ ] Production JavaScript contains the question-bank route with cookie credentials and contains no `localhost:8787` fallback.
- [ ] Read-only production smoke passes.

## Rollback reference

- Previous production source before PR #28: `fead913040baef03a30e619fa392986e325d231b`.
- No data rollback is required because this release changes no Worker code or database schema.
