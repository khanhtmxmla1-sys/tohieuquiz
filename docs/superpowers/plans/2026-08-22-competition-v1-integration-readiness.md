# Competition V1 Integration Readiness — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-08-22-competition-v1-integration-readiness-design.md`

**Branch:** `feat/competition-v1`; the exact candidate SHA is recorded in each rehearsal evidence artifact.

**Status:** APPROVED PLAN — WP1 AND WP2 COMPLETE LOCALLY; WP3 LOCAL REHEARSAL PARTIAL/BLOCKED; WP4 LOCAL JOURNEY CONTRACT PASS / REAL EVIDENCE BLOCKED; WP5 LOCAL CERTIFICATION CONTRACT PASS / REAL BENCHMARK BLOCKED; WP6 SYNTHETIC/LOCAL PASS / REAL SERVICE-BOUNDARY BLOCKED; WP7 PENDING

**Date:** 2026-08-22

**Execution note:** WP0 documentation, WP1 canonical audit lifecycle, WP2 bounded-read/artifact-authorization changes, the WP3 local rehearsal harness, WP4 local artifact journey, and WP5 fail-closed capacity contract are committed on the feature branch. WP3 remains blocked without an approved representative snapshot and application-rollback evidence. WP4 remains blocked without candidate-bound real Queue/R2/certificate evidence. WP5 remains blocked until an environment-backed benchmark is supplied. WP6 now has a clearly labelled `SYNTHETIC/LOCAL` 120-student pre-integration dataset, a complete negative-security matrix contract, green Competition regressions, and a green stubbed Cypress student journey; it is not real service-boundary evidence. No remote D1, Queue, R2, capacity-profile write, push/PR/merge has occurred.

---

## 1. Objective

Close the release-blocking gaps identified by the approved Competition V1 Integration Readiness Specification and produce evidence sufficient for a feature-branch PR review.

This plan does not authorize changes to `main`, push, PR, merge, deployment, feature enablement, or destructive database rollback. Production enablement remains a separate rollout approval.

The plan is complete only when the branch is a reviewable integration candidate. A local passing test suite is not by itself an integration or production certificate.

## 2. Current Baseline

Local audit evidence at `cfcef5e`:

- Competition regression: 20 files, 117 tests passed.
- Root and Workers typecheck: passed.
- Lint and production build: passed.
- Security scan, history scan, and policy gates: passed.
- Migration/release rehearsal: 10 tests passed.
- Branch is 20 commits ahead of `origin/main`.

Known gaps:

| ID | Priority | Gap |
|---|---|---|
| GAP-P0-01 | P0 | No real capacity certificate bound to a candidate build SHA. |
| GAP-P0-02 | P0 | No representative D1 forward-migration rehearsal evidence. |
| GAP-P0-03 | P0 | No real Queue/R2 XLSX and certificate journey evidence. |
| GAP-P0-04 | P0 | No candidate/rollback SHA pair and rollout stage for enabled readiness. |
| GAP-P1-01 | P1 | Audit lifecycle events are incomplete or named inconsistently. |
| GAP-P1-02 | P1 | E2E evidence is primarily stubbed. |
| GAP-P1-03 | P1 | Task-level traceability was reconstructed; Tasks 1–5 share one commit. |
| GAP-P1-04 | P1 | Bounded reads are not proven for every school-wide path. |

## 3. Delivery Rules

All work remains in `C:\quizpro\.worktrees\competition-v1` on `feat/competition-v1`. `C:\quizpro` on `main` is read-only and existing unrelated dirty files remain untouched.

Each work package receives a focused local commit only after its verification gate and explicit user approval. No stage/commit/push is automatic.

Recommended commit boundaries:

```text
docs(competition): add integration readiness spec and plan
fix(competition): complete canonical audit lifecycle
fix(competition): harden bounded reads and artifact authorization
test(competition): add migration and integration journeys
chore(competition): close capacity and release evidence gates
```

Executable changes use RED → GREEN → refactor. Documentation-only work is TDD N/A.

Before editing any existing function/class/method, refresh GitNexus if stale and run upstream impact for every symbol. Report risk and stop for confirmation on HIGH/CRITICAL. Before each commit, run `detect_changes` against `origin/main`.

## 4. Work Package Order

| WP | Name | Priority | Dependency | Main output |
|---|---|---|---|---|
| WP0 | Spec and traceability package | P1 | Spec approval | Approved docs and task matrix |
| WP1 | Canonical audit lifecycle | P1 | WP0 | Complete audit events/tests |
| WP2 | Bounded reads and artifact authorization | P1 | WP0 | Safe pagination/download contracts |
| WP3 | Real D1 migration rehearsal | P0 | WP0 | Forward/recovery evidence |
| WP4 | Real Queue/R2/certificate integration | P0 | WP1, WP2 | Artifact journey evidence |
| WP5 | Candidate capacity certification | P0 | WP3 | SHA-bound certified report |
| WP6 | Integration E2E and security matrix | P1 | WP1–WP5 | Environment-backed acceptance |
| WP7 | Final candidate gates | P0/P1 | WP0–WP6 | GO/NO-GO package |

WP3 and WP5 require an approved candidate environment. Local SQLite fixtures and stubbed E2E do not satisfy those gates.

## 5. WP0 — Spec and Traceability

**Code:** N/A. **TDD:** N/A (documentation-only).

Files:

- `docs/superpowers/specs/2026-08-22-competition-v1-integration-readiness-design.md`
- `docs/superpowers/plans/2026-08-22-competition-v1-integration-readiness.md`

Tasks:

1. Preserve stable requirement IDs and the P0/P1/P2 gap register.
2. Maintain Task 1–24 → commit → test → evidence mapping.
3. Record that Tasks 1–5 share `d605f91`; do not rewrite history to manufacture task commits.
4. Add artifact paths for migration, capacity, Queue/R2, and integration evidence.
5. Record owners for retention, alert thresholds, form reuse warning, and environment access.

Exit:

- [ ] Spec and plan are internally consistent.
- [ ] Each gap has an owner, evidence, and blocking rule.
- [ ] User approves this implementation plan.

## 6. WP1 — Canonical Audit Lifecycle

**Priority:** P1. **TDD:** Required. **Risk:** Medium/high because services and Live Exam adapters are shared.

Primary files/surfaces:

- `workers/src/competition/campaignService.ts`
- `workers/src/competition/roundService.ts`
- `workers/src/competition/eligibilityService.ts`
- `workers/src/competition/schoolExamService.ts`
- `workers/src/competition/schoolExamIncidentRetestService.ts`
- `workers/src/competition/schoolExamReconcileService.ts`
- `workers/src/competition/schoolExamPublicationRankingService.ts`
- `workers/src/competition/schoolExamResultCorrectionService.ts`
- `workers/src/competition/schoolExamCertificateService.ts`
- `workers/src/competition/schoolExamExportService.ts`
- `workers/src/competition/schoolExamExportProcessor.ts`
- `workers/src/routes/competitions/index.ts`
- `competition_school_exam_audit` migration/table and related worker tests.

Canonical action mapping:

```text
CAMPAIGN_CREATED, CAMPAIGN_UPDATED, AUDIENCE_SNAPSHOTTED
ROUND_CONFIG_CHANGED, ROUND_FINALIZED, ROUND_ATTEMPT_VOIDED
ELIGIBILITY_FINALIZED, ELIGIBILITY_OVERRIDDEN
ROOM_CREATED, ROOM_MEMBER_CHANGED, CAPACITY_PREFLIGHT_RUN
EXAM_PROVISIONED, EXAM_STARTED, EXAM_CLOSED
INCIDENT_REPORTED, RETEST_GRANTED
RECONCILE_STARTED, RECONCILE_RESOLVED
RESULTS_PUBLISHED, RESULT_CORRECTED
CERTIFICATE_BATCH_CREATED, XLSX_EXPORT_REQUESTED, XLSX_EXPORTED
```

Implementation-specific names such as `SCHOOL_EXAM_ROOM_CREATED` may remain only with an explicit canonical mapping and test.

RED tests:

1. room-member changes contain event, room, student, original class, snapshot, actor, and request ID;
2. preflight records certified profile and peak without sensitive data;
3. provisioning records counts and never logs access codes;
4. Live Exam start/close maps to Competition event/room;
5. reconcile emits started and resolved events;
6. certificate creation emits publication/ranking versions;
7. export request and completion emit separate events;
8. audit payload rejects answers, credentials, tokens, access codes, and raw bodies;
9. same request ID is idempotent.

Implementation order:

1. Add a typed action union/mapping helper.
2. Add common event/event-scope metadata.
3. Instrument missing service transitions.
4. Add Live Exam lifecycle mapping without changing normal CLASS sessions.
5. Refactor only after GREEN.

Rollback is additive: disable only new emission if operationally necessary; never drop audit data.

Exit:

- [ ] Focused audit tests pass.
- [ ] Competition and normal Live Exam regressions pass.
- [ ] Security scan proves payload sanitization.
- [ ] GitNexus impact is recorded for every edited symbol.

## 7. WP2 — Bounded Reads and Artifact Authorization

**Priority:** P1. **TDD:** Required.

**Status:** COMPLETE LOCALLY — committed on the feature branch; awaiting the next work-package gate.

Inspect/edit only after symbol impact:

- `workers/src/routes/competitions/index.ts`
- `workers/src/competition/schoolExamExportService.ts`
- `workers/src/competition/schoolExamCertificateService.ts`
- `workers/src/competition/schoolExamPublicationRankingService.ts`
- `src/services/api/routes/competitions.ts`
- `schemas/competition.schema.ts`
- authorization policies and tests.

Required behavior:

1. progress, eligibility, ranking, incidents, reconcile, corrections, exports, and certificate reads are bounded;
2. cursor/page-token semantics are explicit and stable;
3. Teacher class scope is enforced in the query;
4. export download rechecks event, scope, publication, and actor scope;
5. R2 key is derived server-side and cannot be substituted by user input;
6. certificate reads cannot cross event/publication scope.

RED tests must cover over-limit requests, invalid cursors, cross-class pagination, guessed export IDs, unpublished artifacts, R2 key substitution, and Admin school-wide access.

Exit:

- [x] Contract and authorization matrix updated through cursor/query registry and certificate detail route.
- [x] No unbounded read remains in the affected progress, eligibility, ranking, incident, retest, reconcile-issue, correction, and certificate/export artifact paths.
- [x] Focused and relevant regression tests pass; full Competition and Live Exam suites remain green.

## 8. WP3 — Real D1 Migration Rehearsal

**Priority:** P0. **TDD:** Migration contract/rehearsal tests. **Risk:** High.

**Status:** PASS — REPRESENTATIVE FORWARD + ISOLATED STAGING APPLICATION ROLLBACK. Candidate `be38890f9f9bac7e9180996b302580df1a33b25b` passed 0069→0078 against a production-derived, locally restored, anonymized 0068 snapshot, then passed an application rollback rehearsal to known-good SHA `aad1d771cf4de89c7893cd2a0b1ba08835f33865` on isolated Cloudflare staging. The source export was read-only and encrypted, plaintext/local restore material was removed after anonymization, and no production resource was written.

Recorded representative evidence:

- anonymized snapshot SHA-256: `bec9d706ce36fed39307add5b72837a3e149ddc388c839dd4c4850a04588c81f`;
- retained protected rows: 5 teachers, 3 classes, 4 students, 41 quizzes, 34 results, 2 Live Exam sessions, 2 participants, 2 activity rows, 2 answer snapshots, and 155 connection events;
- 643 sensitive or quasi-identifying source values were removed from the retained protected columns, including credentials, names, access codes, answers, timestamps, and educational scores;
- migrations 0069–0078: 10/10 PASS;
- foreign-key violations: 0; missing tables/indexes: 0; existing protected row deltas: 0;
- Competition data was not created in production; all forward migration writes used isolated local D1 state.

Recorded application rollback evidence:

- candidate and rollback code were deployed sequentially to the same isolated staging Worker with staging-only D1, R2, and Queue bindings;
- candidate and rollback health/API smoke checks passed on the active `workers.dev` deployment;
- the rollback changed application code only; no database downgrade was executed;
- the staging registry remained at `0078_competition_result_corrections.sql`, with 26/26 expected tables, 48/48 expected indexes, and 0 foreign-key violations;
- a synthetic Competition campaign sentinel remained unchanged across candidate → rollback;
- protected representative row counts remained unchanged and no production route, secret, database, bucket, or queue was referenced;
- the isolated staging Worker, D1 database, three R2 buckets, and two queues were deleted after evidence capture.

Preconditions:

- approved anonymized/representative database snapshot;
- environment owner and backup location;
- candidate SHA;
- migration registry at 0068;
- no production write without separate approval.

Procedure:

1. Record schema, registry, counts, and indexes at baseline.
2. Apply 0069–0078 in order.
3. Record duration, warnings, registry, schema, indexes, and count deltas.
4. Run integrity queries for campaign, audience, round, exam, audit, publication, correction, export, and certificate tables.
5. Test rerun/no-op behavior where supported.
6. Restore a copy and rehearse application rollback with Competition disabled.
7. Keep destructive database rollback separate and explicitly approved.

Evidence artifact:

```text
competition-migration-rehearsal-<candidate-sha>.json
```

It includes candidate SHA, snapshot hash, registry before/after, per-migration timing, integrity results, row deltas, failure/recovery, operator, and environment.

Exit:

- [x] Empty bootstrap and 0068→0078 forward migrations pass in isolated local D1 state.
- [x] Existing Live Exam data is unchanged unexpectedly in the 0068→0078 rehearsal.
- [x] Registry/indexes/FK checks are correct after each forward migration.
- [x] Representative forward migration passes against an approved anonymized snapshot.
- [x] Application rollback preserves Competition data.
- [x] Evidence is archived and linked to the release candidate.

No representative database means WP3 is BLOCKED, not PASS.

## 9. WP4 — Real Queue/R2/Certificate Integration

**Priority:** P0. **TDD:** Required. **Risk:** High asynchronous/data-integrity impact.

**Status:** LOCAL JOURNEY CONTRACT PASS — REAL EVIDENCE BLOCKED. The worker now validates the persisted XLSX R2 object (MIME, ZIP signature, size, and checksum) before marking an export READY and records only sanitized artifact metadata in the `XLSX_EXPORTED` audit event. Existing local worker tests cover certificate/export idempotency, retries, class/Admin authorization, publication-version pinning, download re-authorization, and certificate batch linkage. The local rehearsal artifact is generated by `workers/scripts/rehearse-competition-artifact-journey.cjs`; the recorded run is `BLOCKED` until candidate-bound real Queue acceptance, R2 readback, certificate linkage, retry, and archived audit evidence are supplied. It performs no remote writes.

Journey:

```text
Published event → certificate batch → certificate processor
                → XLSX request → Queue → processor → R2
                → authorized status/read/download
```

Cases:

1. duplicate certificate/export requests are idempotent;
2. transient queue failure retries and terminal failure is visible;
3. generated XLSX is valid and has the required MIME type;
4. class export contains only the original class;
5. school export is Admin-scoped;
6. publication/ranking version is enforced;
7. download authorization is checked again;
8. audit events are present and sanitized.

Evidence artifact:

```text
competition-artifact-journey-<candidate-sha>.json
```

Include request IDs, versions, queue attempts, artifact checksums/sizes, and authorization outcomes; exclude credentials, tokens, and access codes.

Local rehearsal artifact (outside the repository):

```text
competition-artifact-journey-<candidate-sha>.json
```

The artifact records local contract PASS results and these blocking gaps:

```text
real_queue_acceptance_missing
real_r2_artifact_validation_missing
certificate_linkage_missing
retry_behavior_missing
audit_evidence_missing
candidate_worktree_dirty
```

Exit requires real Queue acceptance, real R2 artifact validation, certificate linkage, retry behavior, and audit evidence.

## 10. WP5 — Candidate Capacity Certification

**Priority:** P0. **Risk:** High student-experience/integrity impact.

**Status:** LOCAL CERTIFICATION CONTRACT PASS — REAL BENCHMARK BLOCKED. The certification script now requires explicit benchmark `passed: true`, a 40-character git SHA, all zero-integrity gates, and the latency thresholds before producing a `CERTIFIED` profile. Focused certification/release-readiness tests pass. A candidate environment benchmark is still required; fixtures or an example configuration cannot satisfy this P0 gate.

Inputs are candidate deployment SHA, runtime/polling config, representative room plan/forms, environment owner, and rollback SHA.

All gates pass together:

```text
lostAnswers = 0
duplicateFailures = 0
d1Overload = 0
app5xx = 0
networkErrors = 0
statusP95Ms < 500
submitP95Ms < 2000
```

Scenarios include check-in burst, active polling/autosave, reconnect, synchronized submit, teacher monitoring, simultaneous rooms, separate shifts, and available failure injection.

Procedure:

1. Run benchmark against candidate SHA.
2. Preserve raw report.
3. Run `npm run capacity:certify -- --input <report>`.
4. Verify report `build.sha` equals `COMPETITION_RELEASE_SHA`.
5. Persist the profile only after certification.
6. Use the profile in School Exam preflight.

Exit requires a certified report, matching SHA/config, and fail-closed readiness on any mismatch. A failed latency/integrity gate leaves Competition disabled.

Local contract evidence:

- [x] Explicit `passed: true` is required.
- [x] Candidate build SHA must be a 40-character git SHA.
- [x] Latency and zero-integrity gates remain fail-closed.
- [ ] Candidate environment benchmark and certified report are supplied.
- [ ] Certified profile is persisted from the approved candidate report.

## 11. WP6 — Integration E2E and Security Matrix

**Priority:** P1. **TDD:** Required.

**Status:** SYNTHETIC/LOCAL PASS — REAL SERVICE-BOUNDARY EVIDENCE BLOCKED. `workers/scripts/build-competition-synthetic-preintegration.cjs` produces an outside-repository artifact labelled `SYNTHETIC/LOCAL` with 120 students, four original classes, six finalized rounds, 90 qualified students, four rooms, 90 publication results, and the complete negative-security matrix. The artifact keeps WP3–WP5 blockers explicit and cannot be used as production evidence. Competition regression and the stubbed Cypress Competition journey pass locally.

Integration journey:

```text
Admin campaign/audience/rounds
→ student attempts/progress/eligibility
→ rooms/members/preflight/provision
→ assigned invigilator and RoomMember join
→ Live Exam close and withheld result
→ incident/retest/reconcile
→ Admin publish/rank/certificate/export
→ correction and new publication version
```

Negative security cases:

- Student A cannot read Student B data;
- student cannot change identity, attempts, room, or campaign membership;
- Teacher class A cannot read class B data/export;
- invigilator cannot publish/grant retest;
- unassigned teacher cannot report an incident;
- room code alone cannot authorize join;
- raw Live Exam result is withheld;
- blocking reconcile prevents publish;
- correction cannot edit old publication;
- export ID cannot bypass scope.

Exit requires real service-boundary journey, complete authorization matrix, normal CLASS Live Exam regression, and stubbed Cypress remaining green.

Synthetic/local evidence:

- [x] Dataset is labelled `SYNTHETIC/LOCAL` and `productionEvidence: false`.
- [x] Original-class ownership survives eligibility, room membership, and publication.
- [x] Negative-security matrix is complete and contains no credentials or answer payloads.
- [x] Competition regression and stubbed Cypress journey pass.
- [ ] Real service-boundary journey runs against an approved candidate environment.
- [ ] WP3–WP5 P0 external evidence gates are closed.

Artifact name:

```text
competition-synthetic-preintegration-<candidate-sha>.json
```

## 12. WP7 — Final Candidate Gates

Run from the final candidate SHA:

```text
Competition regression and full CI shards
coverage, root/strict/Workers typecheck, lint, build
performance budget
security scan/history/policy/dependency gates
migration contracts and representative rehearsal
stubbed Cypress and integration E2E
capacity certification
release readiness
GitNexus detect-changes compare origin/main
```

The machine-readable release report records candidate/base SHA, command, environment, timestamp, result, artifact path/hash, flaky reruns, risks, rollback SHA, and rollout stage.

GO requires all P0 gaps closed, no unresolved P1 security/data-integrity defect, SHA-matched capacity, real migration/artifact journeys, passing CI, approved scope, and explicit user approval of final commit files. Otherwise status is NO-GO with blocker and next action.

## 13. File/Behavior Matrix

| Behavior | Primary code | RED test first | Rollback |
|---|---|---|---|
| Canonical audit | competition services/routes | audit lifecycle worker tests | disable additive event emission |
| Bounded reads | route/service queries | pagination/scope tests | revert new query contract |
| Artifact authorization | export/certificate service | cross-scope download tests | deny download until fixed |
| D1 rehearsal | migrations/scripts/docs | migration rehearsal | application flag rollback |
| Queue/R2 | export processor/consumer | integration journey | pause consumer, retain jobs |
| Certificate | certificate adapter | published-version tests | retry/hold batch |
| Capacity | benchmark/certifier/preflight | cert gate tests | keep flag disabled |
| Integration E2E | Worker/environment fixture | full journey | remain disabled/internal |

## 14. Per-Package Review Checklist

Before every code package:

- [ ] exact symbols and files identified;
- [ ] GitNexus freshness checked;
- [ ] upstream impact run and reported;
- [ ] HIGH/CRITICAL risk confirmed before edit;
- [ ] RED test written;
- [ ] smallest implementation selected;
- [ ] focused GREEN and regression scope listed;
- [ ] rollback path documented;
- [ ] unrelated dirty files excluded.

Before every commit:

- [ ] focused tests pass;
- [ ] relevant typecheck/lint/build/security pass;
- [ ] final diff reviewed;
- [ ] `detect_changes` against `origin/main` pass;
- [ ] exact files shown to user;
- [ ] commit approval received.

## 15. Approval Gate

Approval authorizes planning to proceed into WP1–WP7 subject to the per-package impact and test gates. It does not authorize commit, push, PR, merge, migration, deployment, or production feature enablement.

Requested gate:

```text
DUYỆT KẾ HOẠCH GAP-FIX COMPETITION V1 P0/P1
```
