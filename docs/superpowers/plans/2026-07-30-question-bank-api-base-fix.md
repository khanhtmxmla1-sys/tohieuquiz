# Question Bank API Base Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the question bank for both teacher and admin accounts by routing all protected test-bank requests through the canonical Workers API configuration instead of a production localhost fallback.

**Architecture:** Keep the existing UI and backend authorization model unchanged. The frontend service resolves its base URL through `getWorkersApiBaseUrl()`, uses same-origin `/api` in production when no direct API URL is configured, includes the HttpOnly session cookie, and URL-encodes path identifiers. The Worker continues enforcing teacher ownership while allowing admins.

**Tech Stack:** React, TypeScript, Vite, Vitest, Cloudflare Workers, Vercel rewrites.

## Global Constraints

- Teachers must be able to load only their own question bank.
- Admins must continue to load the requested account's question bank.
- Do not weaken CSP, authentication, or ownership checks.
- Do not add dependencies or change database schemas.
- Work only in `C:\quizpro\.worktrees\fix-question-bank-api-base` on branch `fix/question-bank-api-base`.
- Base is locally cached `origin/main` SHA `fead913040baef03a30e619fa392986e325d231b`; remote fetch authentication is currently unavailable.

---

### Task 1: Add the frontend service regression contract

**Files:**
- Create: `tests/testBankService.test.ts`
- Create: `tests/testBankRoutes.worker.test.ts`

**Interfaces:**
- Consumes: `testBankService.getTestBank(teacherId)`, `saveQuestion(teacherId, question, tags)`, `deleteQuestion(id)`, and `handleTestBankRoutes()`.
- Produces: executable coverage proving canonical URL resolution, encoded path segments, cookie-authenticated requests, teacher self-access, cross-teacher denial, and retained admin access.

- [x] Add frontend service regression tests for same-origin `/api`, direct API URLs, encoded identifiers, and `credentials: 'include'`.
- [x] Add Worker authorization regression tests for teacher ownership and admin access.
- [x] Run the focused regression tests and confirm they pass with the fix.

### Task 2: Route test-bank traffic through the canonical API configuration

**Files:**
- Modify: `src/services/testBankService.ts`
- Test: `tests/testBankService.test.ts`

**Interfaces:**
- Consumes: `getWorkersApiBaseUrl(): string` from `src/services/api/config.ts`.
- Produces: `${getWorkersApiBaseUrl()}${path}` request URLs with cookie credentials.

- [x] Import `getWorkersApiBaseUrl`, remove `VITE_WORKER_URL` and `http://localhost:8787`, and add a small `testBankUrl(path)` helper.
- [x] Encode `teacherId` and question IDs with `encodeURIComponent()`.
- [x] Add `credentials: 'include'` to GET, POST, and DELETE without changing response contracts or messages.
- [x] Run focused service, Worker route, drawer, and bulk-action tests.
- [x] Run the API authorization matrix plus frontend and Worker typechecks.
- [x] Run lint and the production build; revert generated sitemap date noise.
- [x] Review the final diff and commit with `fix: route question bank through canonical API`.

## Acceptance Criteria

- Production code contains no localhost fallback in `testBankService`.
- Teachers request their own encoded username under `/api/test-bank/teacher/:teacherId`.
- Admin behavior and Worker ownership checks remain unchanged.
- All protected test-bank requests include the HttpOnly session cookie.
- CSP and Vercel rewrite configuration require no changes.
- Verification passes, or unrelated pre-existing failures are reported exactly.
