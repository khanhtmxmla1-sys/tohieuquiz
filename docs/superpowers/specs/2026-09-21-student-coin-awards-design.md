# Student Coin Awards Design

**Date:** 2026-09-21

**Status:** Approved design, pending written-spec review

**Scope:** Manual coin awards for one student, a selected group, or an entire class

## 1. Summary

Add a controlled manual coin-award workflow for Teachers and Administrators. Teachers can award coins only to active students in classes they manage and are subject to configurable limits. Administrators can award coins school-wide without Teacher limits, but every award still requires a reason and produces an immutable audit trail.

The feature combines:

- a dedicated **Thưởng xu** management area for awarding, history, and governance;
- a shortcut from class/student lists that opens the same award form with the current selection prefilled;
- in-app notifications and student-visible reward history;
- time-limited Teacher reversal and unrestricted Administrator adjustment, both represented as compensating ledger entries.

This design extends the existing canonical `student_reward_ledger`. It does not introduce a second wallet or directly mutate coin balances outside the reward-ledger transaction path.

## 2. Goals

- Let a Teacher reward one student, selected students, or all active students in a managed class.
- Let an Administrator reward students across the school.
- Make common awards fast through presets while retaining custom positive integer amounts.
- Require a meaningful reason for every award or adjustment.
- Prevent duplicate submissions, unauthorized awards, and hidden history edits.
- Give students a clear notification and a readable history of manual awards.
- Preserve compatibility with Gift Shop spending, automatic rewards, leaderboards, and the existing wallet balance.

## 3. Non-goals

- Email, SMS, or push notifications.
- Scheduled or recurring manual awards.
- Approval workflows for large Teacher awards in V1.
- Free-form negative adjustments by Teachers.
- Replacing the existing automatic reward rules.
- Creating a separate coin balance for classroom rewards.

## 4. Roles and authorization

### 4.1 Teacher

A Teacher may:

- award coins to active students in classes currently managed by that Teacher;
- award the same amount and reason to one student, selected students, or an entire managed class;
- view manual-award history for the Teacher's managed classes;
- reverse only an award created by that Teacher, within 15 minutes of creation, when every affected wallet can cover the reversal.

A Teacher may not:

- award students outside the Teacher's managed classes;
- bypass per-student, per-award, or daily limits;
- submit a negative award amount;
- edit or delete a ledger entry;
- reverse an award after the reversal window or reverse an award more than once.

### 4.2 Administrator

An Administrator may:

- award coins to any active student in the school;
- view school-wide manual-award history;
- operate without Teacher award limits;
- create a compensating adjustment after the Teacher reversal window or when a Teacher cannot reverse an award.

Administrator awards and adjustments still require a reason and remain fully auditable.

### 4.3 Server authority

The Worker derives the actor identity and role from the authenticated session. It re-resolves class membership, management scope, student state, limits, and current wallet balances at mutation time. Student IDs, class IDs, actor IDs, roles, and limit calculations supplied by the browser are never treated as authoritative.

## 5. User experience

### 5.1 Dedicated management area

Add a **Thưởng xu** entry to the Teacher and Administrator management navigation with three views:

1. **Thưởng xu** — compose and submit an award.
2. **Lịch sử** — search and filter manual awards, reversals, and adjustments.
3. **Cấu hình hạn mức** — Administrator-only limit configuration.

### 5.2 Award form

The form supports:

- one student;
- an explicit multi-select group;
- all active students in one selected class.

It provides preset amounts `+5`, `+10`, `+20`, and `+50`, plus a custom positive integer input. A reason is mandatory, trimmed, and must contain 3–200 characters. Suggested reasons include:

- Tiến bộ;
- Hoàn thành tốt;
- Hỗ trợ bạn;
- Tích cực phát biểu.

Suggested reasons are conveniences, not privileged codes; the submitted reason remains human-readable text.

Before submission, the confirmation summary shows:

- recipient count;
- coins per student;
- total coins represented by the batch;
- reason;
- remaining Teacher daily allowance after the award, when applicable.

An all-class award requires a second explicit confirmation. The submit button is disabled while the request is in flight.

### 5.3 Class-list shortcut

Student/class lists gain selection checkboxes and a **Thưởng xu** bulk action. The shortcut opens the canonical award form with the selected students or class prefilled; it does not implement a separate mutation path.

Only active students are included by the all-class option. The final server-side authorization check remains authoritative if membership or status changes after the form is opened.

### 5.4 Success receipt

After a successful award, the UI shows a batch receipt containing:

- batch identifier;
- number of recipients;
- amount per recipient;
- reason;
- actor;
- creation time;
- Teacher reversal expiry, when applicable.

The receipt provides a reversal action only while the authenticated actor is eligible to use it.

## 6. Limits and governance

Teacher limits are Administrator-configurable. Initial defaults are:

- maximum `100` coins per student in one manual award;
- maximum `2,000` awarded coins per Teacher per Hanoi calendar day.

The daily total is the sum of positive `MANUAL_AWARD` coin deltas created by the Teacher during that Hanoi day. Reversals do not restore the daily allowance in V1; this prevents award/reverse cycling from bypassing the limit. Administrator awards and adjustments do not consume Teacher allowance.

Configuration changes apply to new requests only. They do not rewrite or invalidate historical entries. Every configuration change records the Administrator actor, previous value, new value, reason, and time.

## 7. Ledger model

Extend `StudentRewardSourceType` with:

- `MANUAL_AWARD`;
- `MANUAL_AWARD_REVERSAL`.

Each recipient receives a separate immutable `student_reward_ledger` row so the existing wallet and per-student history remain canonical. Rows belonging to one user action share a batch identifier in their payload.

A manual-award payload records at least:

- `batchId`;
- `actorId` and immutable actor display snapshot;
- `actorRole`;
- `classId` and class-name snapshot when a class context exists;
- human-readable `reason`;
- recipient-selection mode;
- idempotency key;
- limit-policy snapshot used for the decision.

A reversal payload additionally records:

- the original ledger ID;
- the original batch ID;
- reversal actor;
- reversal reason;
- reversal time.

The original award row is never updated or deleted. A reversal inserts an equal negative coin delta linked to the original entry. The existing non-negative-wallet database protection remains authoritative.

## 8. API boundaries

The implementation should expose one canonical manual-award service behind role-scoped HTTP handlers. Exact route names may follow existing repository conventions, but the contract must support:

- recipient discovery scoped to the actor;
- preview/validation of a proposed batch;
- batch creation with an idempotency key;
- paginated and filtered history;
- Teacher reversal;
- Administrator adjustment;
- reading and updating award-limit settings for Administrators.

Preview is advisory. The mutation endpoint independently repeats every permission, membership, state, amount, and limit check.

The browser submits one client-generated idempotency key per logical award action. Replaying the same key for the same actor returns the original receipt and never awards twice. Reusing the key with conflicting content returns a conflict response.

## 9. Batch atomicity

Manual awards use all-or-nothing semantics. Before writing, the Worker validates every recipient and the complete limit calculation. It then writes all recipient ledger entries, wallet updates, batch metadata, and notification records atomically.

If any recipient is inactive, unauthorized, duplicated, invalid, or causes a limit violation, the entire request is rejected and no student receives coins. The response identifies the invalid recipients or blocking rule without exposing data outside the actor's authorized scope.

V1 accepts at most 100 unique recipients in one request. Whole-school Administrator awards that exceed that bound are outside this feature and require a later asynchronous design. A technical ceiling of 1,000,000 coins per recipient per request applies to every role independently of Teacher business limits, preventing accidental or abusive integer-scale inputs.

## 10. Reversal and adjustment rules

### 10.1 Teacher reversal

A Teacher may reverse only the entire original batch when:

- the Teacher created it;
- no row in the batch has already been reversed;
- no more than 15 minutes have elapsed;
- every affected student still has enough coins for the compensating debit;
- the Teacher still has access to the relevant class scope.

The reversal is atomic across the batch. Partial Teacher reversal is not supported in V1.

### 10.2 Administrator adjustment

When Teacher reversal is unavailable, an Administrator may create a compensating adjustment for selected affected students. A new reason is mandatory. The adjustment never rewrites the original award and cannot make a student's wallet negative.

## 11. Notifications and student history

Each successful recipient award creates an in-app notification similar to:

> Bạn được cô Nguyễn Thị A thưởng 20 xu
>
> Lý do: Tích cực phát biểu

The notification records the amount, actor display snapshot, reason, time, batch reference, and resulting balance needed by the presentation contract.

Students can view a **Lịch sử phần thưởng** list containing:

- positive manual awards;
- reversals or Administrator adjustments that affect them;
- amount;
- reason;
- actor;
- time;
- `Đã hoàn tác` state when the original award has a matching reversal.

Students can read only their own history. Teachers can read only history within their current managed-class scope. Administrators can read school-wide history. All list endpoints are bounded and paginated.

## 12. Failure handling

The UI distinguishes business-rule failures from transient server/network failures. Expected business errors include:

- student is inactive or no longer belongs to the selected class;
- Teacher does not manage one or more recipients;
- invalid or non-positive amount;
- per-student or daily limit exceeded;
- idempotency conflict;
- reversal window expired;
- award already reversed;
- insufficient current wallet balance for reversal;
- concurrent membership, limit, or wallet change.

A transient failure does not claim that coins were awarded. The client may safely retry with the same idempotency key and receive the original receipt if the first request committed.

## 13. Security and privacy

- Enforce all authorization and limits in the Worker.
- Derive actor identity and role from the authenticated session.
- Resolve student membership and status from canonical data at mutation time.
- Keep the reward ledger immutable.
- Sanitize and length-limit human-entered reasons.
- Do not expose students from unauthorized classes through recipient search or error messages.
- Rate-limit mutation endpoints in addition to business limits.
- Record security-relevant failures and suspicious reward growth through the existing reward-security maintenance path where applicable.

## 14. Compatibility

The canonical wallet remains `students.coins`, updated only through the existing atomic reward-ledger workflow. Therefore manual awards automatically participate in:

- Gift Shop spending and refund behavior;
- Pet Shop spending;
- wallet displays;
- gold/coin leaderboards where the current balance is used;
- reward reconciliation and suspicious-growth reporting.

Automatic reward source types and their idempotency rules remain unchanged.

## 15. Testing strategy

### 15.1 Worker and persistence

- Teacher awards one eligible student.
- Teacher awards selected students.
- Teacher awards all active students in a managed class.
- Teacher cannot award a student outside managed classes.
- Inactive students are rejected.
- Presets and valid custom positive integers succeed.
- Zero, negative, fractional, non-finite, and oversized values fail.
- Per-student and daily Teacher limits are enforced.
- Administrator awards are exempt from Teacher limits.
- Replaying an idempotency key returns the original receipt without a second award.
- Conflicting reuse of an idempotency key returns conflict.
- A failing recipient causes a zero-write batch rollback.
- Concurrent requests cannot exceed limits or double-award.
- Teacher reversal succeeds within 15 minutes.
- Teacher reversal fails when expired, already reversed, unauthorized, or underfunded.
- Administrator adjustment creates a linked compensating entry.
- Ledger rows remain immutable and wallets remain non-negative.

### 15.2 Authorization and privacy

- Student, Teacher, and Administrator access matrices are enforced for every endpoint.
- Search and history do not leak students outside the actor's scope.
- Actor fields supplied by the browser cannot impersonate another user.

### 15.3 Frontend

- Single, selected-group, and all-class form flows.
- Preset and custom amount behavior.
- Mandatory reason and confirmation summary.
- Double confirmation for all-class awards.
- Submit lock and idempotent retry behavior.
- Success receipt and countdown/expiry of Teacher reversal.
- Clear presentation of each expected business error.
- Student notification and private reward history.
- Desktop and mobile layout coverage.

### 15.4 Regression

- Gift Shop purchases and refunds still use the resulting wallet balance.
- Automatic quiz, attendance, mission, chest, weekly, and Live Exam rewards remain unchanged.
- Leaderboard and wallet displays reflect manual awards.
- Reward reconciliation includes manual award and reversal source types.

## 16. Rollout and observability

Release behind a dedicated feature flag. Roll out first to Administrators, then to a small Teacher cohort, then school-wide after verifying:

- award success/failure counts;
- duplicate-prevention events;
- limit rejections;
- reversal rate;
- suspicious growth alerts;
- reward-ledger reconciliation.

Disabling the feature flag hides new entry points and blocks new manual-award mutations. Historical ledger entries and student history remain readable; disabling the feature never attempts to remove awarded coins.

## 17. Acceptance criteria

1. Teachers can award the same amount and reason to one student, selected students, or all active students in a managed class.
2. Administrators can award students school-wide without Teacher limits.
3. Teacher defaults are 100 coins per student per award and 2,000 coins per Hanoi day, with Administrator-configurable values.
4. Every award requires a reason and records actor, role, recipients, class context, time, and batch identity.
5. Duplicate submission cannot increase a wallet twice.
6. A batch is atomic: either every validated recipient receives the award or none do.
7. Teachers can reverse only their own entire batch within 15 minutes, subject to authorization and non-negative wallets.
8. Administrators can issue auditable compensating adjustments when Teacher reversal is unavailable.
9. Students receive an in-app notification and can view only their own reward history.
10. Existing Gift Shop, automatic rewards, wallet displays, and reward security remain compatible.

## 18. Implementation boundary

This document defines behavior and invariants, not exact component, handler, table, or route names. The implementation plan must inspect current Student/Teacher management surfaces, notification infrastructure, class-ownership authorization, D1 transaction limits, and feature-flag conventions before assigning concrete files.
