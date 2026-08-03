# Assignment Revocation V1 Implementation Plan

> Execute with `executing-plans`, `test-driven-development`, `api-and-interface-design`, `frontend-ui-engineering`, and `verification-before-completion`.

**Goal:** Add a safe, auditable “Thu hồi bài” flow for quiz assignments with zero completed submissions.

**Architecture:** Add an additive D1 migration and a dedicated idempotent Worker route. Keep revoked assignments visible to authorized teachers but exclude them from student queries. Extend the frontend assignment contract, API route registry, Zustand store, and assignment tracking UI with a reason-confirmation dialog. Harden start/result submission boundaries against stale revoked assignments.

**Tech stack:** React, TypeScript, Zustand, Cloudflare Workers, D1/SQLite, Vitest, Testing Library, Cypress, Vercel, Wrangler.

---

## Task 1: Establish the persistence contract

**Files:**
- Create: `workers/migrations/0061_assignment_revocation.sql`
- Modify: `workers/schema.sql`
- Modify: `workers/src/utils/helpers.ts`
- Test: `tests/assignmentRevocationMigration.worker.test.ts`

- [ ] Write a failing SQLite migration test asserting all five audit columns exist and fresh schema matches.
- [ ] Add migration `0061` with the five additive columns.
- [ ] Update fresh `workers/schema.sql`.
- [ ] Map audit fields in `mapAssignment`.
- [ ] Run `npm test -- tests/assignmentRevocationMigration.worker.test.ts`.

## Task 2: Implement the revoke API with race-safe rules

**Files:**
- Create: `workers/src/routes/classroom/assignmentRevokeRoute.ts`
- Modify: `workers/src/routes/classroom/assignmentRoutes.ts`
- Modify: `workers/src/routes/classroom/assignmentStatusRoute.ts`
- Test: `tests/assignmentRevocation.worker.test.ts`

- [ ] Write failing tests for reason validation, authorization delegation, success, conflict with completed submissions, idempotent replay, and conditional update race.
- [ ] Implement `POST /api/assignments/:id/revoke`.
- [ ] Count completed submissions by exact `assignment_id`, excluding STARTED placeholders.
- [ ] Make the UPDATE conditional on no completed submissions and distinguish conflicts after a zero-change result.
- [ ] Restrict the generic status route to `OPEN | CLOSED` so callers cannot forge `REVOKED`.
- [ ] Register the route and run the targeted Worker tests.

## Task 3: Enforce revoked state at student boundaries

**Files:**
- Modify: `workers/src/classroom/assignmentStudentQuery.ts`
- Modify: `workers/src/routes/classroom/assignmentStartRoute.ts`
- Modify: `workers/src/routes/results.ts`
- Test: `tests/classroomRoutes.worker.test.ts`
- Test: `tests/resultRoutesAssignmentPolicy.worker.test.ts` or the closest existing result-route contract test

- [ ] Write failing tests proving revoked assignments are absent from student lists.
- [ ] Write failing tests for stale start and stale result submission requests.
- [ ] Filter revoked assignments from student list SQL.
- [ ] Return `409 ASSIGNMENT_REVOKED` from start and result policy validation.
- [ ] Run the targeted tests.

## Task 4: Add the frontend API and store contract

**Files:**
- Modify: `src/types/classroom.types.ts`
- Modify: `src/services/api/routes/assignments.ts`
- Modify: `src/services/classroomService.ts`
- Modify: `src/stores/useAssignmentStore.ts`
- Test: `tests/assignmentServiceRoutes.test.ts`
- Test: `tests/useAssignmentStore.test.ts`

- [ ] Add `REVOKED`, audit fields, revoke request/result types.
- [ ] Register `revoke_assignment` as POST `/api/assignments/:id/revoke`.
- [ ] Preserve structured `code/data` errors through the service layer.
- [ ] Add `revokeAssignment(id, reason)` to the store and update the row in place on success.
- [ ] Write tests for success and 409 error messaging.

## Task 5: Build the teacher revoke dialog and tracking states

**Files:**
- Create: `src/components/TeacherDashboard/assignment-tab/AssignmentRevokeDialog.tsx`
- Modify: `src/components/TeacherDashboard/AssignmentTrackingSection.tsx`
- Modify: `src/components/TeacherDashboard/assignment-tab/useAssignmentTabData.ts`
- Modify: `src/components/TeacherDashboard/assignment-tab/AssignmentTab.tsx`
- Test: `tests/AssignmentRevokeDialog.test.tsx`
- Test: `tests/AssignmentTrackingSection.test.tsx`
- Modify: `tests/AssignmentTabShell.test.tsx`

- [ ] Write accessibility/behavior tests for the dialog.
- [ ] Add REVOKED filter, badge, sorting, and immutable row behavior.
- [ ] Replace exposed delete controls with revoke controls.
- [ ] Disable revoke when completed submissions exist and show the close-first explanation.
- [ ] Wire successful revoke through the tab data hook and refresh the scoped list.
- [ ] Verify desktop and mobile renderers.

## Task 6: Integration verification

**Files:**
- Create or modify: `cypress/e2e/assignment-revocation.cy.ts`
- Modify only if required: production smoke fixtures/scripts

- [ ] Add a stubbed Cypress flow: open assignment tracking, launch dialog, enter reason, confirm, observe REVOKED badge and locked actions.
- [ ] Run targeted Vitest and Cypress.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm run typecheck:strict`, `npm run typecheck:workers`, and `npm run build`.
- [ ] Run GitNexus change detection and code review.

## Task 7: Ship safely

- [ ] Commit with Conventional Commits, push branch, create PR.
- [ ] Require CI, security, Vitest shards, Cypress, production build, review, and Release Readiness.
- [ ] Merge to `main`.
- [ ] Back up D1/time-travel state and apply migration `0061` remotely.
- [ ] Deploy Worker through staged rollout, recording new and rollback version IDs.
- [ ] Wait for Vercel production deployment.
- [ ] Run production smoke using temporary data; verify revoke, student invisibility, stale start/submit rejection, teacher history, and cleanup.
- [ ] Monitor Worker errors/latency for at least 15 minutes.
- [ ] Add deployment evidence to the PR and remove worktree/branches.
