# Student Coin Awards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auditable, role-scoped manual coin awards for one student, selected students, or a whole class, with limits, idempotency, atomic reversal, in-app notification, and private history.

**Architecture:** Extend the immutable `student_reward_ledger` and unified notifications rather than creating a second wallet. A dedicated Worker domain module validates the authenticated actor, resolves canonical class/student scope, and commits one bounded batch atomically; a thin route exposes staff and student-owned APIs. A feature-gated React module supplies the dedicated Teacher/Admin screen, class-roster shortcut, and student reward history.

**Tech Stack:** React 19, TypeScript, Zustand, Vite, Cloudflare Workers, D1/SQLite, Vitest, Testing Library, Cypress, GitNexus.

## Global Constraints

- Follow `plan → worktree → GitNexus → TDD → review/verify → approve → commit → push/PR → CI + PR approval → merge → production smoke → cleanup` without skipping a gate.
- Implement in the existing `codex/student-coin-awards-design` worktree or a new isolated worktree created from its HEAD; never implement on `main`.
- Before modifying every existing function, class, or method, run `node C:\quizpro\.gitnexus\run.cjs impact --repo C:\quizpro --target <symbol> --direction upstream`; report direct callers, affected processes, and risk. Stop for user confirmation on HIGH or CRITICAL risk.
- New files/symbols have no pre-change symbol impact; record them as `N/A — new symbol`.
- Run `node C:\quizpro\.gitnexus\run.cjs detect-changes --scope compare --base-ref main --repo <implementation-worktree>` before the commit approval gate.
- Preserve the canonical wallet in `students.coins` and the immutable `student_reward_ledger`; no second balance and no direct browser-authored actor identity.
- Award batches are all-or-nothing, have at most 100 unique active recipients, and use a client-generated idempotency key.
- Amounts are positive integers; hard technical maximum is 1,000,000 coins per recipient per request.
- Reasons are trimmed, mandatory, and 3–200 characters.
- Teacher defaults are 100 coins per student per award and 2,000 positive awarded coins per Hanoi calendar day; reversals do not restore daily allowance.
- Teachers can award only current active students in managed classes and can reverse only their own entire batch within 15 minutes.
- Administrators are exempt from Teacher business limits but remain subject to validation, audit, and the technical maximum.
- A reversal/adjustment is a new compensating `MANUAL_AWARD_REVERSAL` ledger entry; original ledger and batch rows remain immutable.
- Disable state blocks new mutations and hides new entry points, but historical data remains readable.
- Before every task-package commit, present its exact diff and verification evidence and wait for explicit user approval. Do not push until the user approves the complete branch.

## File Structure

### Shared contracts

- Create `shared/coin-awards.contract.ts` — request/response DTOs, error codes, limits, history, settings, and receipt types.
- Modify `shared/notifications.contract.ts` — add `coin_awarded` and route it to `/student/achievements?view=coin-history`.

### Worker persistence and domain

- Create `workers/migrations/0082_student_coin_awards.sql` — batch/settings/audit tables, immutable/limit triggers, indexes, feature-flag seed.
- Create `workers/rollbacks/0082_drop_student_coin_awards.sql` — remove flag seeds and coin-award objects in dependency-safe order.
- Modify `workers/schema.sql` — fresh-database equivalent of migration 0082.
- Modify `workers/src/gamification/studentRewardLedger.ts` — add source types and a JSON-backed atomic statement builder for bounded reward batches.
- Modify `workers/src/services/notificationWriter.ts` — expose a mandatory-notification batch statement builder for atomic in-app receipts.
- Create `workers/src/coinAwards/validation.ts` — normalize amount, reason, recipient IDs, idempotency key, and selection mode.
- Create `workers/src/coinAwards/repository.ts` — actor scope, recipient lookup, settings/history/replay queries, and pagination.
- Create `workers/src/coinAwards/service.ts` — preview, award, replay, reversal/adjustment, settings update, and atomic commit orchestration.
- Create `workers/src/routes/coinAwards.ts` — authenticated HTTP mapping only.
- Modify `workers/src/index.ts` and `workers/src/security/apiAuthorizationPolicy.ts` — register the route and ownership policies.

### Frontend data and UI

- Create `src/services/api/routes/coinAwards.ts` and modify `src/services/api/routes/index.ts` — API registry entries.
- Create `src/features/coin-awards/coinAwardsService.ts` — typed API adapter.
- Create `src/features/coin-awards/useCoinAwardsFeatureFlag.ts` — build-time plus runtime fail-closed gate.
- Create `src/features/coin-awards/useCoinAwardsStore.ts` — page state and mutation coordination.
- Create `src/features/coin-awards/CoinAwardsPage.tsx` — three-view shell: award, history, settings.
- Create `src/features/coin-awards/components/AwardComposer.tsx`, `AwardReceipt.tsx`, `AwardHistory.tsx`, and `AwardSettings.tsx` — focused UI units.
- Modify `src/stores/useTeacherDashboardUIStore.ts`, `src/app/navigationRoutes.ts`, `src/components/TeacherDashboard/Sidebar.tsx`, `src/components/TeacherDashboard/teacher-dashboard-shell/dashboardLazyTabs.tsx`, `TeacherDashboardFeatureTabs.tsx`, and `dashboardConfig.ts` — feature-gated navigation.
- Modify `src/features/class-management/components/StudentTable/StudentTable.tsx` and `src/features/class-management/views/ClassDetailView.tsx` — selection and canonical composer shortcut.
- Create `src/features/coin-awards/StudentCoinAwardHistory.tsx` and modify `src/features/certificates/StudentAchievementsPage.tsx` — private student history.

### Tests

- Create `tests/studentCoinAwardsMigration.worker.test.ts`.
- Create `tests/studentCoinAwardPrimitives.worker.test.ts`.
- Create `tests/studentCoinAwardService.worker.test.ts`.
- Create `tests/studentCoinAwardRoutes.worker.test.ts`.
- Create `tests/coinAwardsService.test.ts`.
- Create `tests/CoinAwardsPage.test.tsx`.
- Create `tests/StudentTableCoinAwards.test.tsx`.
- Create `tests/StudentCoinAwardHistory.test.tsx`.
- Modify `tests/unifiedNotificationsMigration.worker.test.ts`, `tests/notificationWriter.worker.test.ts`, `tests/routeGuards.test.tsx`, `tests/TeacherSidebarAccessibility.test.tsx`, `tests/apiAuthorizationMatrix.test.ts`, `tests/d1MigrationLayout.test.ts`, `tests/d1RollbackCoverage.test.ts`, and `tests/freshD1Bootstrap.test.ts`.
- Create `cypress/e2e/student-coin-awards.cy.ts` and update `docs/testing/e2e.md`.

---

### Task 1: Persistence, immutable governance, and rollout seed

**Files:**
- Create: `workers/migrations/0082_student_coin_awards.sql`
- Create: `workers/rollbacks/0082_drop_student_coin_awards.sql`
- Modify: `workers/schema.sql`
- Create: `tests/studentCoinAwardsMigration.worker.test.ts`
- Modify: `tests/d1MigrationLayout.test.ts`
- Modify: `tests/d1RollbackCoverage.test.ts`
- Modify: `tests/freshD1Bootstrap.test.ts`

**Interfaces:**
- Produces tables `coin_award_batches`, `coin_award_settings`, and `coin_award_setting_audit`.
- Produces feature flag `student_coin_awards_v1`, initially disabled, audience `teacher`, percentage `100`.
- Later tasks use `coin_award_batches.id` as `student_reward_ledger.source_key` and `notifications.source_id`.

- [ ] **Step 1: Record pre-change impact**

Run impact for `workers/schema.sql` consumers if GitNexus exposes a schema symbol; otherwise record `N/A — SQL schema file, no executable symbol`. Run impact for every existing test helper function changed. Stop on HIGH/CRITICAL.

- [ ] **Step 2: Write the failing migration tests**

Create a SQLite test that executes migrations through 0082 and asserts the exact defaults and invariants:

```ts
expect(db.prepare("SELECT max_coins_per_student, max_teacher_daily_coins, reversal_window_minutes FROM coin_award_settings WHERE scope_key='school'").get())
  .toEqual({ max_coins_per_student: 100, max_teacher_daily_coins: 2000, reversal_window_minutes: 15 });
expect(() => insertBatch({ actorRole: 'teacher', coinsPerStudent: 101, totalCoins: 101 }))
  .toThrow(/COIN_AWARD_PER_STUDENT_LIMIT/);
expect(() => insertBatch({ id: 'batch-2', actorRole: 'teacher', coinsPerStudent: 100, totalCoins: 2001 }))
  .toThrow(/COIN_AWARD_DAILY_LIMIT/);
expect(() => db.prepare("UPDATE coin_award_batches SET reason='changed' WHERE id='batch-1'").run())
  .toThrow(/COIN_AWARD_BATCH_IMMUTABLE/);
```

Also assert:

```ts
expect(db.prepare("SELECT enabled FROM feature_flags WHERE flag_key='student_coin_awards_v1'").get())
  .toEqual({ enabled: 0 });
```

- [ ] **Step 3: Run RED**

Run: `npm run test:run -- tests/studentCoinAwardsMigration.worker.test.ts tests/d1MigrationLayout.test.ts tests/d1RollbackCoverage.test.ts tests/freshD1Bootstrap.test.ts`

Expected: FAIL because migration 0082 and its schema objects do not exist.

- [ ] **Step 4: Implement migration and rollback**

Create the tables with these core columns and checks:

```sql
CREATE TABLE coin_award_batches (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('AWARD','REVERSAL','ADJUSTMENT')),
  parent_batch_id TEXT,
  actor_username TEXT NOT NULL,
  actor_display_name TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('teacher','admin')),
  selection_mode TEXT NOT NULL CHECK (selection_mode IN ('STUDENT','SELECTED','CLASS')),
  class_id TEXT,
  class_name TEXT,
  coins_per_student INTEGER NOT NULL CHECK (coins_per_student <> 0 AND ABS(coins_per_student) <= 1000000),
  recipient_count INTEGER NOT NULL CHECK (recipient_count BETWEEN 1 AND 100),
  total_coins INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (LENGTH(TRIM(reason)) BETWEEN 3 AND 200),
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  hanoi_date TEXT NOT NULL,
  reversal_expires_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (parent_batch_id) REFERENCES coin_award_batches(id),
  UNIQUE (actor_username, idempotency_key)
);

CREATE TABLE coin_award_settings (
  scope_key TEXT PRIMARY KEY CHECK (scope_key='school'),
  max_coins_per_student INTEGER NOT NULL CHECK (max_coins_per_student BETWEEN 1 AND 1000000),
  max_teacher_daily_coins INTEGER NOT NULL CHECK (max_teacher_daily_coins BETWEEN 1 AND 100000000),
  reversal_window_minutes INTEGER NOT NULL CHECK (reversal_window_minutes BETWEEN 1 AND 1440),
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Add immutable UPDATE/DELETE triggers for batch rows, a Teacher-only `BEFORE INSERT` trigger for per-student and daily positive award limits, indexes on `(actor_username,hanoi_date,created_at)`, `(class_id,created_at)`, and `(parent_batch_id)`, and an immutable setting audit table. Seed settings and the disabled feature flag/rule. Add equivalent schema and dependency-safe rollback.

- [ ] **Step 5: Run GREEN**

Run the Step 3 command.

Expected: all listed tests PASS.

- [ ] **Step 6: Review migration safety**

Run: `npm run test:run -- tests/d1SafeMigrations.test.ts tests/studentRewardLedgerMigration.worker.test.ts`

Expected: PASS; no destructive rewrite of existing wallet or ledger data.

- [ ] **Step 7: Commit package after its reviewer gate**

```powershell
git add workers/migrations/0082_student_coin_awards.sql workers/rollbacks/0082_drop_student_coin_awards.sql workers/schema.sql tests/studentCoinAwardsMigration.worker.test.ts tests/d1MigrationLayout.test.ts tests/d1RollbackCoverage.test.ts tests/freshD1Bootstrap.test.ts
git commit -m "feat: add student coin award persistence"
```

### Task 2: Atomic ledger and mandatory notification primitives

**Files:**
- Create: `shared/coin-awards.contract.ts`
- Modify: `shared/notifications.contract.ts`
- Modify: `workers/src/gamification/studentRewardLedger.ts`
- Modify: `workers/src/services/notificationWriter.ts`
- Create: `tests/studentCoinAwardPrimitives.worker.test.ts`
- Modify: `tests/studentRewardLedger.worker.test.ts`
- Modify: `tests/notificationWriter.worker.test.ts`

**Interfaces:**
- Produces `prepareStudentRewardBatch(db, mutations): PreparedRewardBatch`.
- Produces `prepareMandatoryNotificationBatch(db, inputs): D1PreparedStatement`.
- Produces shared DTOs including `CoinAwardCreateInput`, `CoinAwardReceipt`, `CoinAwardHistoryPage`, `CoinAwardSettings`, and `CoinAwardErrorCode`.

- [ ] **Step 1: Run and report GitNexus impact**

Run upstream impact for `applyStudentReward`, `normalizeInput`, `prepareInsert`, `NOTIFICATION_TYPES`, and `resolveNotificationTarget`. Record the direct callers and flows. Do not edit if risk is HIGH/CRITICAL until the user confirms.

- [ ] **Step 2: Write failing primitive tests**

Test one prepared reward batch with two mutations:

```ts
const prepared = prepareStudentRewardBatch(db, [
  { studentId: 's-1', username: 'a', sourceType: 'MANUAL_AWARD', sourceKey: 'batch-1', rewardType: 'COINS', coinsDelta: 10, expDelta: 0, payload: { batchId: 'batch-1' } },
  { studentId: 's-2', username: 'b', sourceType: 'MANUAL_AWARD', sourceKey: 'batch-1', rewardType: 'COINS', coinsDelta: 10, expDelta: 0, payload: { batchId: 'batch-1' } },
]);
await db.batch(prepared.statements);
expect(wallet('s-1')).toBe(10);
expect(wallet('s-2')).toBe(10);
expect(ledgerCount('batch-1')).toBe(2);
```

Prove rollback by making the second debit violate the non-negative trigger and asserting neither wallet nor ledger changes. Test the mandatory notification statement inserts `coin_awarded` for both students in the same outer `db.batch` and deduplicates by `(user,source,type)`.

- [ ] **Step 3: Run RED**

Run: `npm run test:run -- tests/studentCoinAwardPrimitives.worker.test.ts tests/studentRewardLedger.worker.test.ts tests/notificationWriter.worker.test.ts`

Expected: FAIL because the new source types and builders do not exist.

- [ ] **Step 4: Add the shared contract**

Define exact shared constants and DTOs:

```ts
export const COIN_AWARD_PRESETS = [5, 10, 20, 50] as const;
export const COIN_AWARD_MAX_RECIPIENTS = 100;
export const COIN_AWARD_TECHNICAL_MAX = 1_000_000;
export type CoinAwardSelectionMode = 'STUDENT' | 'SELECTED' | 'CLASS';
export type CoinAwardBatchKind = 'AWARD' | 'REVERSAL' | 'ADJUSTMENT';
export interface CoinAwardCreateInput {
  classId: string;
  studentIds: string[];
  selectionMode: CoinAwardSelectionMode;
  coinsPerStudent: number;
  reason: string;
  idempotencyKey: string;
}
```

Include explicit receipt/history/settings/page/error-code types used by both Worker and React; no `any` fields.

- [ ] **Step 5: Implement the atomic builders**

Extend `StudentRewardSourceType` with `MANUAL_AWARD` and `MANUAL_AWARD_REVERSAL`. Add a builder that validates 1–100 unique mutations, serializes normalized rows once, and returns two JSON1-backed statements: an `INSERT ... SELECT FROM json_each(?)` into the ledger and a set-based wallet update. Keep `applyStudentReward` behavior unchanged for existing callers.

Add `coin_awarded` to notification types and target resolution. Expose:

```ts
export function prepareMandatoryNotificationBatch(
  db: D1Database,
  inputs: CreateNotificationInput[],
): D1PreparedStatement
```

It reuses `normalizeInput`, bypasses user preference suppression only for this explicit mandatory path, and inserts all normalized rows with one JSON1 statement so it can join the same outer atomic batch.

- [ ] **Step 6: Run GREEN and regress existing callers**

Run the Step 3 command plus:

`npm run test:run -- tests/resultRewardLedger.worker.test.ts tests/attendanceRewardLedger.worker.test.ts tests/liveExamRewardLedger.worker.test.ts tests/weeklyLeaderboardRewardLedger.worker.test.ts`

Expected: PASS; existing reward behavior is unchanged.

- [ ] **Step 7: Commit package after review**

```powershell
git add shared/coin-awards.contract.ts shared/notifications.contract.ts workers/src/gamification/studentRewardLedger.ts workers/src/services/notificationWriter.ts tests/studentCoinAwardPrimitives.worker.test.ts tests/studentRewardLedger.worker.test.ts tests/notificationWriter.worker.test.ts
git commit -m "feat: add atomic coin award primitives"
```

### Task 3: Coin-award domain service

**Files:**
- Create: `workers/src/coinAwards/validation.ts`
- Create: `workers/src/coinAwards/repository.ts`
- Create: `workers/src/coinAwards/service.ts`
- Create: `tests/studentCoinAwardService.worker.test.ts`

**Interfaces:**
- Produces `previewCoinAward`, `createCoinAward`, `reverseCoinAwardBatch`, `adjustCoinAwardBatch`, `listStaffCoinAwardHistory`, `listStudentCoinAwardHistory`, `getCoinAwardSettings`, and `updateCoinAwardSettings`.
- Consumes the Task 2 batch builders and Task 1 tables.

- [ ] **Step 1: Record impact**

All domain files are new: record `N/A — new symbols`. Run context/impact for `canAccessClass`, `getClassroomById`, `requireTeacherForStudent`, and `getFeatureFlag` before reusing their contracts; no edits to those symbols are planned.

- [ ] **Step 2: Write failing service tests**

Cover at least these named tests:

```ts
it('awards one managed active student and returns a receipt');
it('awards selected students atomically');
it('expands CLASS selection to all active class students');
it('rejects any unauthorized, archived, duplicate, or stale recipient with zero writes');
it('replays the same actor and idempotency key without adding coins');
it('rejects conflicting reuse of an idempotency key');
it('enforces teacher per-student and Hanoi-day limits under concurrent calls');
it('allows admin awards while retaining the technical ceiling');
it('reverses the teacher entire batch within 15 minutes');
it('rejects partial, expired, duplicate, unauthorized, and underfunded teacher reversal');
it('creates an admin adjustment for selected original recipients');
it('returns role-scoped cursor history');
it('audits every settings change');
```

Assert every successful award writes the batch, N ledger rows, N wallet changes, and N notifications in one transaction.

- [ ] **Step 3: Run RED**

Run: `npm run test:run -- tests/studentCoinAwardService.worker.test.ts`

Expected: FAIL because service exports do not exist.

- [ ] **Step 4: Implement validation and repository boundaries**

Validation returns normalized values or stable domain errors:

```ts
export function normalizeCoinAwardInput(input: CoinAwardCreateInput): NormalizedCoinAwardInput {
  const studentIds = [...new Set(input.studentIds.map(value => String(value).trim()).filter(Boolean))];
  if (!Number.isInteger(input.coinsPerStudent) || input.coinsPerStudent < 1 || input.coinsPerStudent > COIN_AWARD_TECHNICAL_MAX) throw domainError('INVALID_AMOUNT');
  if (studentIds.length < 1 || studentIds.length > COIN_AWARD_MAX_RECIPIENTS) throw domainError('INVALID_RECIPIENT_COUNT');
  const reason = String(input.reason || '').trim();
  if (reason.length < 3 || reason.length > 200) throw domainError('INVALID_REASON');
  return { ...input, studentIds, reason, idempotencyKey: normalizeIdempotencyKey(input.idempotencyKey) };
}
```

Repository queries must resolve actor display name/role from `teachers`, class ownership from `classes.teacher_username`, active students from canonical `students`, Hanoi date via the existing system time utility, and bounded cursor history ordered by `(created_at DESC,id DESC)`.

- [ ] **Step 5: Implement preview/create/replay atomically**

Compute a stable SHA-256 request hash from sorted normalized recipients plus class, selection mode, amount, and reason. On an existing `(actor,key)`, return the original receipt only when hashes match; otherwise throw `IDEMPOTENCY_CONFLICT`.

For a new award, prepare one `db.batch` containing:

1. immutable `coin_award_batches` insert;
2. Task 2 reward-ledger batch statements;
3. Task 2 mandatory notification batch statement with `type='coin_awarded'`, `sourceType='coin_award_batch'`, `sourceId=batchId`, and `/student/achievements?view=coin-history`;
4. no separate non-atomic follow-up writes.

On a unique-key race, reload the batch and apply the same hash replay rule.

- [ ] **Step 6: Implement reversal, adjustment, history, and settings**

Teacher reversal resolves the complete original recipient set, verifies the actor, expiry, absence of a child reversal, current class access, and every wallet balance, then inserts one linked `REVERSAL` batch and negative `MANUAL_AWARD_REVERSAL` rows atomically. Administrator adjustment uses kind `ADJUSTMENT`, a mandatory new reason, selected original recipients only, and the same non-negative rule.

Settings update is Administrator-only at the route layer and uses an optimistic `updatedAt` match in the service, batching the settings update plus audit row.

- [ ] **Step 7: Run GREEN**

Run: `npm run test:run -- tests/studentCoinAwardService.worker.test.ts tests/studentCoinAwardPrimitives.worker.test.ts tests/rewardSecurityMaintenance.worker.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit package after review**

```powershell
git add workers/src/coinAwards tests/studentCoinAwardService.worker.test.ts
git commit -m "feat: add coin award domain service"
```

### Task 4: Authenticated Worker routes and authorization inventory

**Files:**
- Create: `workers/src/routes/coinAwards.ts`
- Modify: `workers/src/index.ts`
- Modify: `workers/src/security/apiAuthorizationPolicy.ts`
- Create: `tests/studentCoinAwardRoutes.worker.test.ts`
- Modify: `tests/apiAuthorizationMatrix.test.ts`

**Interfaces:**
- Staff routes: `POST /api/coin-awards/preview`, `POST /api/coin-awards/batches`, `GET /api/coin-awards/history`, `POST /api/coin-awards/batches/:id/reverse`, `POST /api/coin-awards/batches/:id/adjustments`, `GET|PUT /api/coin-awards/settings`.
- Student route: `GET /api/student/coin-awards/history`.

- [ ] **Step 1: Run impact**

Run upstream impact for `createWorkerFetch`, `API_AUTHORIZATION_POLICIES`, and any existing exported route registry function edited. Report risk before changing them.

- [ ] **Step 2: Write failing route matrix tests**

Use the real route handler with fake D1 and JWT identities. Assert:

```ts
expect(await status(studentRequest('POST', '/api/coin-awards/batches'))).toBe(403);
expect(await status(teacherOutsideClassRequest())).toBe(403);
expect(await status(teacherSettingsPut())).toBe(403);
expect(await status(adminSettingsPut())).toBe(200);
expect(await status(studentOwnHistoryGet())).toBe(200);
expect(await status(teacherStudentHistoryGet())).toBe(403);
```

Also assert disabled feature flag returns stable `404 FEATURE_DISABLED` for mutations while history remains readable.

- [ ] **Step 3: Run RED**

Run: `npm run test:run -- tests/studentCoinAwardRoutes.worker.test.ts tests/apiAuthorizationMatrix.test.ts`

Expected: FAIL because routes and policy inventory are absent.

- [ ] **Step 4: Implement thin route mapping**

Authenticate once with `verifyJWTMiddleware`, accept only `teacher|admin` for staff routes, and never read actor identity/role from the body. Parse bodies with `parseBody`, map stable domain errors to 400/403/404/409/422, and attach a request ID to 500 responses/logs without logging student lists or free-text reasons.

Resolve `student_coin_awards_v1` server-side before preview/create/reverse/adjust/settings writes. Allow scoped history reads after disablement. Register exact ownership policies:

```ts
policy('coin-awards-write', '/api/coin-awards', 'teacher-owned', ['session','classId','studentId','route-handler'], 'authenticated teacher/admin canonical class and student scope', { methods: ['POST'] }),
policy('coin-awards-settings', '/api/coin-awards/settings', 'admin-only', ['session','route-handler'], 'admin-only award governance', { match: 'exact', methods: ['PUT'] }),
policy('student-coin-award-history', '/api/student/coin-awards/history', 'student-owned', ['session','studentId'], 'authenticated student identity', { match: 'exact', methods: ['GET'] }),
```

- [ ] **Step 5: Run GREEN plus security checks**

Run: `npm run test:run -- tests/studentCoinAwardRoutes.worker.test.ts tests/apiAuthorizationMatrix.test.ts`

Expected: PASS with no unclassified new endpoint.

- [ ] **Step 6: Commit package after review**

```powershell
git add workers/src/routes/coinAwards.ts workers/src/index.ts workers/src/security/apiAuthorizationPolicy.ts tests/studentCoinAwardRoutes.worker.test.ts tests/apiAuthorizationMatrix.test.ts
git commit -m "feat: expose scoped coin award routes"
```

### Task 5: Frontend API adapter, runtime flag, and store

**Files:**
- Create: `src/services/api/routes/coinAwards.ts`
- Modify: `src/services/api/routes/index.ts`
- Create: `src/features/coin-awards/coinAwardsService.ts`
- Create: `src/features/coin-awards/useCoinAwardsFeatureFlag.ts`
- Create: `src/features/coin-awards/useCoinAwardsStore.ts`
- Create: `tests/coinAwardsService.test.ts`
- Create: `tests/useCoinAwardsStore.test.ts`

**Interfaces:**
- Produces typed service calls `previewAward`, `createAward`, `listAwardHistory`, `reverseAward`, `adjustAward`, `getAwardSettings`, `updateAwardSettings`, and `listMyAwardHistory`.
- Produces store actions used by Tasks 6–8.

- [ ] **Step 1: Record impact**

Run impact for `routes` in `src/services/api/routes/index.ts` and `resolveRuntimeFeatureFlag`. New module symbols are `N/A — new`.

- [ ] **Step 2: Write failing route/service/store tests**

Assert exact HTTP mapping and payload minimization:

```ts
expect(resolveApiRoute('create_coin_award').path({})).toBe('/api/coin-awards/batches');
await createAward(input);
expect(callApi).toHaveBeenCalledWith('create_coin_award', input);
```

Store tests must prove submit locking, stable idempotency key across retry, a new key after success/cancel, receipt storage, cursor pagination, and error preservation.

- [ ] **Step 3: Run RED**

Run: `npm run test:run -- tests/coinAwardsService.test.ts tests/useCoinAwardsStore.test.ts src/services/api/__tests__/routeResolver.test.ts`

Expected: FAIL because the new registry and modules do not exist.

- [ ] **Step 4: Implement typed adapter and fail-closed flag**

Register exact methods/paths and bodies. The flag hook combines `VITE_FEATURE_STUDENT_COIN_AWARDS_V1` with runtime resolution of `student_coin_awards_v1`, returning `{ enabled, ready, degraded }`; runtime failure must set `enabled:false`.

- [ ] **Step 5: Implement the store**

Keep transport/state logic out of components. The store owns:

```ts
type CoinAwardsView = 'award' | 'history' | 'settings';
interface CoinAwardsState {
  view: CoinAwardsView;
  submitting: boolean;
  receipt: CoinAwardReceipt | null;
  history: CoinAwardHistoryItem[];
  nextCursor: string | null;
  error: string | null;
  submitAward(input: Omit<CoinAwardCreateInput,'idempotencyKey'>): Promise<CoinAwardReceipt | null>;
  reverseBatch(batchId: string, reason: string): Promise<CoinAwardReceipt | null>;
}
```

- [ ] **Step 6: Run GREEN**

Run the Step 3 command.

Expected: PASS.

- [ ] **Step 7: Commit package after review**

```powershell
git add src/services/api/routes/coinAwards.ts src/services/api/routes/index.ts src/features/coin-awards tests/coinAwardsService.test.ts tests/useCoinAwardsStore.test.ts src/services/api/__tests__/routeResolver.test.ts
git commit -m "feat: add coin award client data layer"
```

### Task 6: Dedicated Teacher/Admin award center and navigation

**Files:**
- Create: `src/features/coin-awards/CoinAwardsPage.tsx`
- Create: `src/features/coin-awards/components/AwardComposer.tsx`
- Create: `src/features/coin-awards/components/AwardReceipt.tsx`
- Create: `src/features/coin-awards/components/AwardHistory.tsx`
- Create: `src/features/coin-awards/components/AwardSettings.tsx`
- Modify: `src/stores/useTeacherDashboardUIStore.ts`
- Modify: `src/app/navigationRoutes.ts`
- Modify: `src/components/TeacherDashboard/Sidebar.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/dashboardLazyTabs.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardFeatureTabs.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/dashboardConfig.ts`
- Create: `tests/CoinAwardsPage.test.tsx`
- Modify: `tests/routeGuards.test.tsx`
- Modify: `tests/TeacherSidebarAccessibility.test.tsx`

**Interfaces:**
- Adds `TeacherDashboardTab` value `coin-awards` and route `/teacher/coin-awards`.
- `CoinAwardsPage` accepts optional `initialClassId` and `initialStudentIds`, consumed by Task 7.

- [ ] **Step 1: Run impact**

Run upstream impact for `normalizeTeacherDashboardTab`, `resolveTeacherTabFromLocation`, `Sidebar`, `TeacherDashboardFeatureTabs`, and `DASHBOARD_SEARCH_ITEMS`. Report risk.

- [ ] **Step 2: Write failing page and navigation tests**

Test presets, custom amount, required reason, recipient count/total, limit remainder, all-class second confirmation, disabled submit while pending, receipt, reversal countdown, history filters, Administrator-only settings, route resolution, and hidden navigation when the flag is off.

Example assertion:

```tsx
await user.click(screen.getByRole('button', { name: '+20' }));
expect(screen.getByText('40 xu cho 2 học sinh')).toBeInTheDocument();
await user.click(screen.getByRole('button', { name: 'Xác nhận thưởng xu' }));
expect(service.createAward).toHaveBeenCalledWith(expect.objectContaining({ coinsPerStudent: 20, studentIds: ['s-1','s-2'] }));
```

- [ ] **Step 3: Run RED**

Run: `npm run test:run -- tests/CoinAwardsPage.test.tsx tests/routeGuards.test.tsx tests/TeacherSidebarAccessibility.test.tsx`

Expected: FAIL because page/tab/navigation do not exist.

- [ ] **Step 4: Implement focused components**

`AwardComposer` owns accessible form controls only and emits normalized draft input. `AwardReceipt` renders immutable batch facts and eligible reversal. `AwardHistory` owns filters/pagination presentation. `AwardSettings` is rendered only for Administrator and requires a change reason. `CoinAwardsPage` coordinates these through the Task 5 store.

The all-class path must show a second dialog containing class name, recipient count, per-student amount, total, and reason; closing it does not regenerate the idempotency key.

- [ ] **Step 5: Integrate feature-gated navigation**

Add `coin-awards` under the **Học sinh** sidebar group with a Coins/Award icon, route mapping, lazy page, dashboard search item, and feature gate. Direct navigation while disabled renders a non-mutating disabled-state notice and never mounts the composer.

- [ ] **Step 6: Run GREEN and accessibility coverage**

Run the Step 3 command plus `npm run test:run -- tests/TeacherDashboardShell.test.tsx tests/teacherDashboardTabMigration.test.ts`.

Expected: PASS; keyboard/label tests have no new accessibility failures.

- [ ] **Step 7: Commit package after review**

```powershell
git add src/features/coin-awards/CoinAwardsPage.tsx src/features/coin-awards/components src/stores/useTeacherDashboardUIStore.ts src/app/navigationRoutes.ts src/components/TeacherDashboard/Sidebar.tsx src/components/TeacherDashboard/teacher-dashboard-shell tests/CoinAwardsPage.test.tsx tests/routeGuards.test.tsx tests/TeacherSidebarAccessibility.test.tsx
git commit -m "feat: add teacher coin award center"
```

### Task 7: Class-roster bulk shortcut

**Files:**
- Modify: `src/features/class-management/components/StudentTable/StudentTable.tsx`
- Modify: `src/features/class-management/views/ClassDetailView.tsx`
- Create: `tests/StudentTableCoinAwards.test.tsx`

**Interfaces:**
- `StudentTable` adds controlled selection props: `selectedStudentIds`, `onSelectionChange`, and `onOpenCoinAwards`.
- `ClassDetailView` navigates to the canonical `coin-awards` tab and supplies prefill state; it does not call the award API directly.

- [ ] **Step 1: Run impact**

Run upstream impact for `StudentTable` and `ClassDetailView`; report consumers and risk.

- [ ] **Step 2: Write failing responsive selection tests**

Assert desktop and mobile selection, select-visible/all-active behavior, bulk-action visibility, clearing on class change, disabled offline state, and prefill navigation:

```tsx
await user.click(screen.getByRole('checkbox', { name: 'Chọn Nguyễn An' }));
await user.click(screen.getByRole('button', { name: 'Thưởng xu cho 1 học sinh' }));
expect(openCoinAwards).toHaveBeenCalledWith({ classId: 'class-1', studentIds: ['s-1'], selectionMode: 'SELECTED' });
```

- [ ] **Step 3: Run RED**

Run: `npm run test:run -- tests/StudentTableCoinAwards.test.tsx tests/StudentTableParentAccess.test.tsx`

Expected: FAIL because selection props/actions do not exist.

- [ ] **Step 4: Implement selection and shortcut**

Use native checkboxes with explicit labels and a sticky bulk-action bar when selection is non-empty. Preserve all current parent-access, password-reset, archive, responsive, search, sort, and offline behavior. The shortcut stores a one-time prefill in the coin-award store, selects `coin-awards`, then clears the prefill after the composer consumes it.

- [ ] **Step 5: Run GREEN**

Run the Step 3 command plus `npm run test:run -- tests/classManagementUi.test.tsx tests/ClassDetailViewOffline.test.tsx tests/ClassDetailViewParentPortal.test.tsx`.

Expected: PASS.

- [ ] **Step 6: Commit package after review**

```powershell
git add src/features/class-management/components/StudentTable/StudentTable.tsx src/features/class-management/views/ClassDetailView.tsx tests/StudentTableCoinAwards.test.tsx
git commit -m "feat: add roster coin award shortcut"
```

### Task 8: Student notification target and private reward history

**Files:**
- Create: `src/features/coin-awards/StudentCoinAwardHistory.tsx`
- Modify: `src/features/certificates/StudentAchievementsPage.tsx`
- Modify: `shared/notifications.contract.ts` only if Task 2 left target wiring incomplete
- Create: `tests/StudentCoinAwardHistory.test.tsx`
- Modify: `tests/studentNotificationIntegration.test.tsx`

**Interfaces:**
- Uses `listMyAwardHistory` from Task 5.
- Notification `coin_awarded` navigates to `{ kind:'url', url:'/student/achievements?view=coin-history' }`.

- [ ] **Step 1: Run impact**

Run upstream impact for `StudentAchievementsPage` and `resolveNotificationTarget`. Report risk.

- [ ] **Step 2: Write failing history and deep-link tests**

Assert student-only rows show amount, actor, reason, time, resulting balance, and `Đã hoàn tác`; paginate without exposing another student. Assert `?view=coin-history` opens the history panel from a notification.

```tsx
expect(screen.getByText('+20 xu')).toBeInTheDocument();
expect(screen.getByText('Tích cực phát biểu')).toBeInTheDocument();
expect(screen.getByText('Cô Nguyễn Thị A')).toBeInTheDocument();
expect(screen.getByText('Đã hoàn tác')).toBeInTheDocument();
```

- [ ] **Step 3: Run RED**

Run: `npm run test:run -- tests/StudentCoinAwardHistory.test.tsx tests/studentNotificationIntegration.test.tsx`

Expected: FAIL because the history surface/notification target is absent.

- [ ] **Step 4: Implement the student surface**

Add a clear **Lịch sử phần thưởng** section/tab to the existing achievements page without breaking certificates. Use cursor pagination, loading/empty/error/retry states, signed amount styling, and semantic status text. Do not derive history from the generic notification inbox; fetch the authenticated student-owned ledger projection.

- [ ] **Step 5: Run GREEN and privacy regression**

Run the Step 3 command plus `npm run test:run -- tests/studentDashboardComponents.test.tsx tests/NotificationCenter.test.tsx`.

Expected: PASS.

- [ ] **Step 6: Commit package after review**

```powershell
git add src/features/coin-awards/StudentCoinAwardHistory.tsx src/features/certificates/StudentAchievementsPage.tsx shared/notifications.contract.ts tests/StudentCoinAwardHistory.test.tsx tests/studentNotificationIntegration.test.tsx
git commit -m "feat: show student coin award history"
```

### Task 9: End-to-end coverage, observability, and release verification

**Files:**
- Create: `cypress/e2e/student-coin-awards.cy.ts`
- Modify: `docs/testing/e2e.md`
- Modify: `workers/src/gamification/rewardSecurityMaintenance.ts` if existing reports exclude the new source types
- Modify: `tests/rewardSecurityMaintenance.worker.test.ts` if required by that inspection

**Interfaces:**
- Produces one HTTP-stubbed UI E2E spec and one documented production-safe smoke procedure.

- [ ] **Step 1: Inspect and run impact**

Inspect reconciliation/suspicious-growth queries. If manual types already flow through generic ledger aggregation, record `N/A — no code change required`. Otherwise run upstream impact for the exact report function before editing.

- [ ] **Step 2: Write the failing Cypress spec**

Cover:

1. Teacher opens class, selects two students, opens prefilled award composer, awards `+20`, and sees one receipt.
2. Duplicate POST retry returns the same batch and UI does not double-count.
3. Teacher history shows the batch and successful reversal.
4. Administrator sees settings; Teacher does not.
5. Student opens the notification and lands on private coin history.
6. With the flag off, navigation disappears and mutation returns the disabled contract.

- [ ] **Step 3: Run RED**

Run: `npx cypress run --spec cypress/e2e/student-coin-awards.cy.ts --browser chrome`

Expected: FAIL until all selectors/contracts are integrated.

- [ ] **Step 4: Add stable test selectors and close observability gaps**

Add only semantic roles/labels where possible; use `data-testid` only for receipt batch identity or countdown where role-based selection is unstable. Ensure logs/metrics expose counts and error codes but never student lists or free-text reasons. Update E2E documentation with required flag and safe throwaway student guidance.

- [ ] **Step 5: Run focused and full verification**

Run:

```powershell
npm run test:run -- tests/studentCoinAwardsMigration.worker.test.ts tests/studentCoinAwardPrimitives.worker.test.ts tests/studentCoinAwardService.worker.test.ts tests/studentCoinAwardRoutes.worker.test.ts tests/coinAwardsService.test.ts tests/useCoinAwardsStore.test.ts tests/CoinAwardsPage.test.tsx tests/StudentTableCoinAwards.test.tsx tests/StudentCoinAwardHistory.test.tsx
npx tsc --noEmit
npm run build
npx cypress run --spec cypress/e2e/student-coin-awards.cy.ts --browser chrome
```

Expected: all tests PASS, TypeScript exits 0, production build exits 0, Cypress spec passes.

- [ ] **Step 6: Review final diff and GitNexus scope**

Run:

```powershell
git diff --check main...HEAD
git diff --stat main...HEAD
node C:\quizpro\.gitnexus\run.cjs detect-changes --scope compare --base-ref main --repo C:\quizpro\.worktrees\student-coin-awards-design
```

Review every changed file for unrelated edits. Resolve all P1/P2 findings and unexpected flows. If the worktree was re-indexed under another path, pass that exact indexed path to `--repo`.

- [ ] **Step 7: Present the mandatory approval gate**

Report exact changed files, focused/full verification output, blast radius, migrations, feature-flag default, rollback path, remaining risks, and proposed commit set. Wait for explicit user approval before any final commit/push.

- [ ] **Step 8: Commit only after approval**

```powershell
git add cypress/e2e/student-coin-awards.cy.ts docs/testing/e2e.md workers/src/gamification/rewardSecurityMaintenance.ts tests/rewardSecurityMaintenance.worker.test.ts
git commit -m "test: cover student coin award workflow"
```

Omit unchanged optional files from `git add`.

### Task 10: Push, PR, CI, merge, production smoke, and cleanup

**Files:**
- No source files unless CI/review produces an approved corrective package.

**Interfaces:**
- Delivers a reviewed PR to `main`; does not bypass protected-branch or production gates.

- [ ] **Step 1: Push and open the PR after user approval**

Push `codex/student-coin-awards-design` (or the approved implementation branch) and open a PR describing scope, security model, migration 0082, feature flag, tests, rollback, and deployment notes.

- [ ] **Step 2: Wait for CI and human approval**

Use `gh pr checks --watch` or the repository's normal check command. Do not merge with pending/failed required checks, unresolved P1/P2 review findings, or missing required approval.

- [ ] **Step 3: Re-check PR HEAD and merge**

Immediately before merge, verify the reviewed HEAD SHA, mergeability, checks, approvals, migration order, and disabled-by-default flag. Merge only when clean.

- [ ] **Step 4: Production verification**

After deployment, verify the deployed SHA, confirm migration 0082 is registered, confirm `student_coin_awards_v1` remains disabled, then enable only the approved Administrator cohort. Use a throwaway student to award a small amount, verify one ledger row/notification/history item, reverse it, and verify the compensating row and restored balance. Do not use a real pupil account.

- [ ] **Step 5: Cleanup**

Fast-forward local `main` only when safe, preserve unrelated changes in `C:\quizpro`, remove the merged worktree/branch, delete the remote branch when appropriate, and report final PR/SHA/deployment/smoke status.

## Plan Self-Review

- **Spec coverage:** Tasks 1–4 cover persistence, immutability, limits, authorization, idempotency, atomic award/reversal, audit, and feature gating. Tasks 5–7 cover the dedicated center and class shortcut. Task 8 covers notification deep-link and private student history. Tasks 9–10 cover regression, rollout, production smoke, and cleanup.
- **Scope:** This remains one coherent vertical feature; notifications and feature flags extend existing infrastructure only and are not independent products.
- **Type consistency:** `CoinAwardCreateInput`, `CoinAwardReceipt`, `CoinAwardHistoryPage`, `CoinAwardSettings`, `CoinAwardSelectionMode`, and `CoinAwardBatchKind` originate in `shared/coin-awards.contract.ts` and are reused unchanged.
- **Atomicity:** Batch metadata, ledger entries, wallet changes, and mandatory notifications share one D1 `db.batch`; no post-commit notification gap remains.
- **No placeholders:** Every task names exact files, commands, expected RED/GREEN outcomes, and concrete interfaces.
