# System Hanoi Time Zone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuẩn hóa toàn bộ hiển thị, nhập liệu và quy tắc ngày của TôHiệuQuiz theo `Asia/Ho_Chi_Minh`, trong khi giữ timestamp lưu trữ/API ở UTC.

**Architecture:** Một contract thời gian dùng chung được import bởi frontend và Worker. Frontend và Worker có utility riêng phù hợp runtime nhưng cùng múi giờ, locale và offset; toàn bộ consumer được migrate khỏi formatter phụ thuộc timezone máy chạy. Static guard ngăn code mới quay lại cách cũ.

**Tech Stack:** TypeScript, React 19, Vite, Cloudflare Workers, D1, Intl.DateTimeFormat, Vitest, Cypress.

## Global Constraints

- Múi giờ nghiệp vụ duy nhất: `Asia/Ho_Chi_Minh`.
- Locale hiển thị: `vi-VN`, dạng 24 giờ.
- Timestamp lưu D1/API/log: UTC ISO-8601.
- `datetime-local` luôn được hiểu là giờ Hà Nội.
- Không migration hay cộng 7 giờ vào dữ liệu lịch sử.
- Cron Cloudflare vẫn khai báo UTC và phải có tài liệu quy đổi.
- Thực hiện TDD, commit sau mỗi task và không deploy trước full quality gate.

---

### Task 1: Shared Time Contract and Core Utilities

**Files:**
- Create: `shared/time-zone.contract.ts`
- Modify: `src/utils/dateTime.ts`
- Create: `workers/src/utils/systemTime.ts`
- Modify: `src/utils/formatters.ts`
- Test: `tests/dateTimeVietnam.test.ts`
- Create: `tests/systemTime.worker.test.ts`

**Interfaces:**
- Produces `SYSTEM_TIME_ZONE`, `SYSTEM_LOCALE`, `SYSTEM_UTC_OFFSET`.
- Produces frontend helpers `formatSystemDate`, `formatSystemTime`, `formatSystemDateTime`, `formatSystemDateLong`, `toSystemDateTimeLocal`, `systemDateTimeLocalToIso`, `getSystemDateKey`, `getSystemWeekKey`.
- Produces Worker helpers `formatSystemDateTime`, `formatSystemDate`, `getSystemDateKey`, `getSystemWeekKey`.

- [ ] Write failing tests for timezone-independent formatting, midnight boundary, local-input round trip and ISO week boundary.
- [ ] Run `npm run test:run -- tests/dateTimeVietnam.test.ts tests/systemTime.worker.test.ts` and confirm failures.
- [ ] Implement the shared contract and both utility modules with explicit `timeZone` and `hourCycle: 'h23'`.
- [ ] Preserve deprecated Vietnam-named aliases for existing consumers.
- [ ] Route `src/utils/formatters.ts::formatDate` through `formatSystemDateTime`.
- [ ] Run targeted tests, `npm run typecheck`, and `npm run typecheck:workers`.
- [ ] Commit as `feat(time): add Hanoi system time contract`.

### Task 2: Frontend Display Migration

**Files:**
- Modify all tracked `src/**/*.ts` and `src/**/*.tsx` that directly format Date values.
- Test: `tests/systemTimeUsageGuard.test.ts`
- Update representative existing component tests for dashboard, Live Exam, homework, notifications, security and reports.

**Interfaces:**
- Consumes Task 1 frontend helpers.
- Produces no new public API.

- [ ] Write a static guard test that finds direct date `toLocaleDateString`, `toLocaleTimeString`, date `toLocaleString`, and ad-hoc `Intl.DateTimeFormat` under `src/`, excluding `src/utils/dateTime.ts`; number formatting remains allowed.
- [ ] Run the guard and confirm it fails with the current inventory.
- [ ] Replace direct formatters with the smallest matching helper while preserving copy and fallback behavior.
- [ ] Add `dateTime` attributes containing original UTC timestamps where `<time>` is used.
- [ ] Run guard plus affected component tests.
- [ ] Run frontend typecheck and ESLint for changed files.
- [ ] Commit as `refactor(time): use Hanoi formatting across frontend`.

### Task 3: Hanoi Input Semantics for Every datetime-local Form

**Files:**
- Modify assignment, intervention, feature-rollout, homework and announcement form components and their submit hooks/services.
- Modify tests covering assignment prefill, feature rollout, homework creation and announcement publishing.

**Interfaces:**
- Consumes `toSystemDateTimeLocal` and `systemDateTimeLocalToIso`.
- API payloads continue to expose ISO UTC strings.

- [ ] Add failing tests proving a value entered as `2026-08-05T07:30` is sent as `2026-08-05T00:30:00.000Z` regardless of browser `TZ`.
- [ ] Add failing tests proving ISO API values populate inputs as Hanoi local values.
- [ ] Replace `new Date(localValue).toISOString()` and manual slicing with Task 1 helpers.
- [ ] Add visible “Giờ Hà Nội (GMT+7)” hints to scheduling/deadline fields.
- [ ] Run targeted integration tests and Cypress form smoke.
- [ ] Commit as `fix(time): interpret schedule inputs as Hanoi time`.

### Task 4: Worker Business-Day Migration

**Files:**
- Modify: `workers/src/gameLoop/dateKeys.ts`
- Modify: `workers/src/routes/gamification.ts`
- Modify: `workers/src/services/teacherAiQuotaLedger.ts`
- Modify: `workers/src/parentPortal/deadlineReminderService.ts`
- Modify Worker notification/certificate routes that format dates.
- Test existing gamification, AI quota, reminder, notification and certificate suites.

**Interfaces:**
- Consumes Task 1 Worker helpers.
- Existing exports named `getBangkokDateKey` receive a compatibility alias only where tests/external consumers require it; production code uses `getSystemDateKey`.

- [ ] Add failing boundary tests at `16:59:59Z` and `17:00:00Z` for date keys, weekly keys, attendance and AI quota.
- [ ] Replace all `Asia/Bangkok`, runtime-local `getFullYear/getMonth/getDate`, and Worker date formatting without explicit timezone.
- [ ] Replace SQLite weekly filtering based on UTC `strftime` with Hanoi date boundaries computed in TypeScript and bound as UTC ISO range.
- [ ] Run Worker targeted tests and Worker typecheck.
- [ ] Commit as `fix(time): align Worker business days with Hanoi`.

### Task 5: Cron, Documentation and Regression Guard

**Files:**
- Modify: `workers/wrangler.toml`
- Modify: `docs/operations/maintenance-calendar.md`
- Create: `docs/architecture/system-time.md`
- Extend: `tests/systemTimeUsageGuard.test.ts`
- Add/modify cron contract tests if schedule changes are required.

**Interfaces:**
- Documents UTC cron expression and Hanoi execution time.
- Static guard covers both `src/` and `workers/src/`.

- [ ] Map each current cron to its handler and intended Hanoi time.
- [ ] Correct only expressions whose actual execution does not match their documented business time.
- [ ] Document storage, API, display, input, date-key and cron contracts.
- [ ] Extend guard to reject `Asia/Bangkok` and ad-hoc date formatter use in Worker code.
- [ ] Run migration-layout/cron tests, lint and both typechecks.
- [ ] Commit as `docs(time): define Hanoi timezone operations contract`.

### Task 6: Full Verification, PR and Staged Production Rollout

**Files:**
- No source changes unless a verification failure reveals a regression.

**Interfaces:**
- Produces a mergeable PR and rollback-ready Worker version.

- [ ] Run `npm run verify` and capture exit code 0.
- [ ] Run Cypress desktop/mobile scheduling and quiz smoke tests.
- [ ] Run `git diff --check`, code review and GitNexus impact review for changed route handlers.
- [ ] Push branch and open PR into `main`.
- [ ] After approval and green CI, merge with merge commit.
- [ ] Confirm Vercel production deployment.
- [ ] Upload Worker version at 0%, smoke with version override, then promote 100%, retaining previous version for rollback.
- [ ] Run production smoke and verify timestamps in representative pages/API payloads.
