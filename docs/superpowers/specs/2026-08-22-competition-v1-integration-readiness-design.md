# Competition V1 — Integration Readiness Design Specification

**Product:** QuizPro / TôHiệuQuiz

**Feature:** Competition V1

**Branch baseline:** `feat/competition-v1` at `cfcef5e`

**Design baseline:** `2026-08-19-competition-v1-design.md`

**Status:** PROPOSED — REQUIRED BEFORE MAIN INTEGRATION

**Date:** 2026-08-22

**Owner:** Product/Engineering

---

## 1. Purpose

This specification converts the approved Competition V1 architecture and the implemented Task 1–24 branch into a reviewable, testable, and releasable contract.

It defines:

- the authoritative product and domain behavior;
- boundaries between Competition, Quiz, Results, Live Exam, Certificate, D1, Queue, and R2;
- states, invariants, APIs, authorization, audit events, and failure behavior;
- migration, capacity, observability, and rollout requirements;
- traceability from Task 1–24 to implementation and evidence;
- the mandatory gaps that must close before merge to `main` or production enablement.

This document does not authorize push, merge, migration, deployment, or feature enablement.

---

## 2. Normative Language

The words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative.

- **MUST / MUST NOT**: release-blocking requirement.
- **SHOULD / SHOULD NOT**: expected behavior; an exception requires an ADR.
- **MAY**: optional behavior.

Every normative requirement has a stable identifier such as `CMP-AREA-NNN`.

---

## 3. Scope

### 3.1 In scope

Competition V1 includes:

1. campaign creation and immutable audience snapshots;
2. exactly six configured competition rounds;
3. grade-level quiz mapping with optional class override;
4. server-authoritative round attempts and best-score progress;
5. eligibility finalization and versioned administrative override;
6. school-exam event, room, shift, member, and form orchestration;
7. certified-capacity preflight and Live Exam provisioning;
8. multi-class room authorization without synthetic classes;
9. result embargo, incidents, retests, and reconciliation;
10. explicit publication, ranking, versioned correction, certificate, and XLSX export;
11. Admin, Teacher, and Student user surfaces;
12. feature-flagged staged rollout and rollback.

### 3.2 Out of scope

Competition V1 does not:

- use Assignment as the primary round engine;
- introduce WebSocket or Durable Objects;
- perform advanced statistical equating of exam forms;
- automatically grant retests;
- expose raw Live Exam results before publication;
- hard-code a production concurrency claim;
- automatically run destructive database rollback;
- support silent unpublish or in-place mutation of published results.

---

## 4. Release Classification

The implementation is divided into three readiness levels.

| Level | Meaning | Current status |
|---|---|---|
| L1 — Local functional | Domain behavior and local tests pass | PASS |
| L2 — Integration candidate | Real D1/Queue/R2 rehearsal, capacity certificate, CI, review | NOT PROVEN |
| L3 — Production enabled | Canary completed and release evidence bound to exact SHA | NOT AUTHORIZED |

`CMP-REL-001`: A local commit or passing local test suite MUST NOT be interpreted as L2 or L3 readiness.

`CMP-REL-002`: Competition MUST remain disabled until all L2 gates are satisfied.

---

## 5. Context and Constraints

### 5.1 Existing platform

Competition V1 is implemented inside the existing modular application and Workers codebase. It reuses:

- Quiz for authoring;
- Results for scoring;
- Live Exam for synchronized school-exam delivery;
- Certificate for certificate rendering and batch processing;
- Cloudflare D1 for relational state;
- Cloudflare Queue for asynchronous export processing;
- R2 for generated XLSX artifacts.

### 5.2 Constraints

`CMP-ARC-001`: Competition MUST remain an additive domain boundary. Existing Quiz, Results, Live Exam, and Certificate behavior outside Competition MUST remain backward compatible.

`CMP-ARC-002`: Competition-specific semantics MUST use `/api/competitions` and `/api/school-exams`; they MUST NOT be hidden inside Assignment APIs.

`CMP-ARC-003`: The design MUST prefer the existing modular monolith over new services until independent scaling or ownership proves extraction necessary.

`CMP-ARC-004`: Synchronous REST remains the command/query interface. Queue is used only for work that is explicitly asynchronous, such as XLSX generation.

---

## 6. System Boundary

```text
Admin / Teacher / Student UI
              │
              ▼
       Competition Routes
              │
     ┌────────┼───────────┐
     ▼        ▼           ▼
 Campaign   Round      School Exam
 Audience   Progress   Orchestration
 Eligibility           Reconcile/Publish
     │        │           │
     └────────┼───────────┘
              │ adapters
     ┌────────┼─────────┬────────────┐
     ▼        ▼         ▼            ▼
    Quiz    Results   Live Exam   Certificate
              │
       D1 / Queue / R2
```

### 6.1 Ownership

| Domain | Authoritative owner |
|---|---|
| Quiz content | Quiz engine |
| Immutable competition quiz reference | Competition quiz snapshot |
| Answer scoring | Results/scoring engine |
| Round attempt limit and best score | Competition round engine |
| Live room delivery and participant telemetry | Live Exam |
| Official school-exam result | Competition canonical result |
| Official ranking | Published Competition snapshot |
| Certificate rendering | Certificate engine |
| Award eligibility and batch grouping | Competition certificate adapter |

---

## 7. End-to-End Domain Flow

```text
Campaign DRAFT
  → preview audience
  → freeze AudienceSnapshot
  → configure six rounds and RoundQuiz mappings
  → open/close/finalize rounds 1..6
  → finalize Eligibility snapshot
  → create SchoolExamEvent
  → create rooms/shifts/forms/members
  → capacity preflight
  → provision LiveExamSession per room
  → run and close school exam
  → WITHHELD
  → incident/retest resolution
  → reconcile
  → READY_TO_PUBLISH
  → Admin publish
  → PUBLISHED ranking
  → certificate batches / XLSX exports
  → optional versioned result correction and republish
```

`CMP-DOM-001`: Every authoritative transition MUST be validated by the server against current persisted state.

`CMP-DOM-002`: UI state and scheduler state MUST NOT bypass domain transition rules.

`CMP-DOM-003`: Important mutations MUST accept a request ID or idempotency key and safely replay the same request.

---

## 8. State Machines and Transition Contracts

### 8.1 Campaign

```text
DRAFT → SCHEDULED → ACTIVE → ELIGIBILITY_LOCKED
      → EXAM_PREP → EXAM_RUNNING → WITHHELD
      → RECONCILING → READY_TO_PUBLISH → PUBLISHED → ARCHIVED
```

| From | To | Preconditions | Actor |
|---|---|---|---|
| DRAFT | SCHEDULED | audience locked; six valid rounds | Admin |
| SCHEDULED | ACTIVE | server time reaches campaign window | System/Admin command |
| ACTIVE | ELIGIBILITY_LOCKED | all six rounds finalized; eligibility snapshot persisted | Admin |
| ELIGIBILITY_LOCKED | EXAM_PREP | SchoolExamEvent created | Admin |
| EXAM_PREP | EXAM_RUNNING | all rooms provisioned and exam starts | Live Exam adapter |
| EXAM_RUNNING | WITHHELD | required sessions closed | System |
| WITHHELD | RECONCILING | reconcile run starts | Admin |
| RECONCILING | READY_TO_PUBLISH | zero blocking issues | System |
| READY_TO_PUBLISH | PUBLISHED | immutable publication transaction succeeds | Admin |
| PUBLISHED | ARCHIVED | retention/operations policy permits | Admin |

`CMP-STATE-001`: Published state MUST NOT transition back to an editable pre-publication state.

### 8.2 Round

```text
DRAFT → SCHEDULED → OPEN → CLOSED → FINALIZED
```

`CMP-STATE-010`: Student access MUST satisfy `opensAt <= serverNow < closesAt` even if materialized status is stale.

`CMP-STATE-011`: A finalized round MUST reject configuration and quiz-mapping mutations.

`CMP-STATE-012`: Round finalization MUST be idempotent and MUST preserve the best valid scored attempt.

### 8.3 Round attempt

```text
STARTED → SUBMITTED → SCORED
STARTED → EXPIRED
SUBMITTED/SCORED → VOID
```

`CMP-STATE-020`: Attempt numbering MUST be unique per round and student.

`CMP-STATE-021`: Attempt-limit enforcement MUST be transactional and server-authoritative.

`CMP-STATE-022`: A replayed submit with the same idempotency key MUST return the same logical result and MUST NOT consume another attempt.

### 8.4 School exam

```text
DRAFT → PREFLIGHT_BLOCKED
DRAFT/PREFLIGHT_BLOCKED → READY
READY → SCHEDULED → IN_PROGRESS → WITHHELD
WITHHELD → RECONCILING → READY_TO_PUBLISH → PUBLISHED
```

`CMP-STATE-030`: `LiveExam CLOSED` MUST NOT imply Competition `PUBLISHED`.

`CMP-STATE-031`: All student-facing result paths MUST remain withheld until an immutable Competition publication exists.

`CMP-STATE-032`: Failure to provision any planned room MUST prevent the event from becoming READY.

### 8.5 Export

```text
QUEUED → PROCESSING → READY
QUEUED/PROCESSING → FAILED
```

`CMP-STATE-040`: Export generation MUST occur outside the request path and MUST be retry-safe.

---

## 9. Data Contract

### 9.1 Migration ownership

| Migration | Primary responsibility |
|---|---|
| 0069 | Campaign, audience, quiz snapshot, rounds, attempts, progress, eligibility |
| 0070 | School exam event, room, member, result, incident, retest, reconcile, publication, export, certificate, audit |
| 0071 | Certified Live Exam capacity profile |
| 0072 | Room orchestration, member count, provisioning state, request uniqueness |
| 0073 | Reconcile versions and issue ledger |
| 0074 | Incident/retest canonical-result history |
| 0075 | Immutable publication and ranking snapshots |
| 0076 | Certificate adapter metadata and class batches |
| 0077 | Asynchronous XLSX export metadata |
| 0078 | Versioned result correction ledger |

### 9.2 Core invariants

`CMP-DATA-001`: AudienceSnapshot is immutable after LOCKED and MUST contain a stable member count and hash.

`CMP-DATA-002`: A frozen audience member records grade and class at snapshot time.

`CMP-DATA-003`: CompetitionRound is unique by `(campaignId, roundNumber)` and round number is 1..6.

`CMP-DATA-004`: RoundQuiz resolution MUST choose class override first, then grade default.

`CMP-DATA-005`: A locked RoundQuiz MUST reference an immutable quiz snapshot SHA-256.

`CMP-DATA-006`: RoundProgress is a rebuildable read model; RoundAttempt remains its evidence source.

`CMP-DATA-007`: SchoolExamEvent MUST reference one immutable eligibility snapshot version.

`CMP-DATA-008`: SchoolExamRoom membership MUST preserve `originalClassId`; synthetic classes are forbidden.

`CMP-DATA-009`: Canonical Competition results MUST retain links to room member, Live Exam session, and participant.

`CMP-DATA-010`: Publication results MUST retain publication, ranking, and reconcile versions.

`CMP-DATA-011`: Result correction MUST be append-only, include before/after hashes, actor, reason, and source/applied publication versions.

### 9.3 Retention

The following records MUST be retained for the configured academic/audit retention period:

- audience and eligibility snapshots;
- quiz snapshot hashes;
- attempts, void reasons, and canonical-result history;
- incidents, retests, reconcile runs/issues;
- publication versions and result corrections;
- certificate/export job metadata;
- audit events.

Deletion/retention duration is an operations policy and MUST be approved before production enablement.

---

## 10. API Contract

### 10.1 Common behavior

`CMP-API-001`: All endpoints require an authenticated session unless explicitly documented otherwise.

`CMP-API-002`: Student identity MUST be derived from the authenticated session, never from a trusted request body field.

`CMP-API-003`: Validation failures return 4xx with a stable error code and MUST NOT partially mutate state.

`CMP-API-004`: Authorization failure MUST not reveal whether an unrelated campaign, room, result, or export exists.

`CMP-API-005`: Potentially large list endpoints MUST implement bounded pagination before school-wide rollout.

### 10.2 Student endpoints

| Method | Path | Purpose | Required scope |
|---|---|---|---|
| GET | `/api/student/competitions` | List campaigns in frozen audience | Own student |
| GET | `/api/student/competitions/:campaignId` | Campaign, round progress, eligibility summary | Own student + audience member |
| POST | `/api/student/competitions/:campaignId/rounds/:roundId/attempts` | Start round attempt | Own student + open round |
| POST | `/api/student/competitions/:campaignId/rounds/:roundId/attempts/:attemptId/submit` | Submit answers idempotently | Own attempt |
| GET | `/api/student/competitions/:campaignId/eligibility` | Own finalized eligibility | Own student |
| GET | `/api/student/competitions/:campaignId/official-result` | Own published official result | Own student + PUBLISHED |

### 10.3 Campaign and rounds

| Method | Path | Admin | Teacher |
|---|---|---:|---:|
| POST | `/api/competitions` | Yes | No |
| GET | `/api/competitions` | All | Authorized classes only |
| GET | `/api/competitions/:campaignId` | All | Authorized classes only |
| PATCH | `/api/competitions/:campaignId` | DRAFT only | No |
| POST | `/api/competitions/:campaignId/audience/preview` | Yes | No |
| POST | `/api/competitions/:campaignId/audience/snapshot` | Yes | No |
| GET | `/api/competitions/:campaignId/audience` | Yes | Scoped summary only |
| GET | `/api/competitions/:campaignId/rounds` | Yes | Yes, scoped |
| PATCH | `/api/competitions/:campaignId/rounds/:roundId` | Yes | No |
| PUT | `/api/competitions/:campaignId/rounds/:roundId/quizzes` | Yes | No |
| POST | `/api/competitions/:campaignId/rounds/:roundId/finalize` | Yes | No |
| GET | `/api/competitions/:campaignId/progress` | All | Authorized classes only |
| POST | `/api/competitions/:campaignId/eligibility/finalize` | Yes | No |
| GET | `/api/competitions/:campaignId/eligibility` | All | Authorized classes only |

### 10.4 School exam endpoints

| Method | Path | Authorization / invariant |
|---|---|---|
| GET | `/api/competitions/:campaignId/school-exams` | Admin or scoped Teacher |
| POST | `/api/competitions/:campaignId/school-exams` | Admin; locked eligibility version |
| GET | `/api/school-exams/:eventId` | Admin or scoped Teacher |
| POST | `/api/school-exams/:eventId/rooms` | Admin; qualified members only |
| POST | `/api/school-exams/:eventId/preflight` | Admin; all room windows counted |
| POST | `/api/school-exams/:eventId/provision` | Admin; successful certified preflight |
| GET/POST | `/api/school-exams/:eventId/incidents` | Assigned invigilator read/report; Admin all |
| GET | `/api/school-exams/:eventId/retests` | Admin; scoped Teacher read if authorized |
| POST | `/api/school-exams/:eventId/retests/:retestId/grant` | Admin only |
| GET/POST | `/api/school-exams/:eventId/reconcile` | Admin mutation; scoped staff read |
| POST | `/api/school-exams/:eventId/publish` | Admin; READY_TO_PUBLISH only |
| GET/POST | `/api/school-exams/:eventId/corrections` | Admin mutation/read; append-only correction |
| GET | `/api/school-exams/:eventId/rankings` | Admin; Teacher CLASS only; Student own result elsewhere |
| POST | `/api/school-exams/:eventId/certificates` | Admin; published version only |
| POST | `/api/school-exams/:eventId/exports` | Admin SCHOOL/CLASS; Teacher authorized CLASS only |
| GET | `/api/school-exams/:eventId/exports/:exportId` | Creator/authorized scope only |
| GET | `/api/school-exams/:eventId/exports/:exportId/download` | READY artifact and authorized scope only |

### 10.5 Error taxonomy

Stable categories MUST include:

- `COMPETITION_NOT_FOUND`
- `COMPETITION_FORBIDDEN`
- `AUDIENCE_NOT_LOCKED`
- `ROUND_NOT_OPEN`
- `ROUND_ATTEMPT_LIMIT_REACHED`
- `ROUND_FINALIZED_LOCKED`
- `ELIGIBILITY_NOT_FINALIZED`
- `SCHOOL_EXAM_PREFLIGHT_REQUIRED`
- `CAPACITY_UNVERIFIED`
- `SCHOOL_EXAM_PROVISION_FAILED`
- `RESULTS_WITHHELD`
- `RECONCILE_BLOCKING_ISSUES`
- `PUBLISH_NOT_READY`
- `RESULT_CORRECTION_PUBLISHED_LOCKED`
- `EXPORT_NOT_READY`

---

## 11. Authorization Specification

### 11.1 Admin

Admin MAY perform all Competition configuration and lifecycle mutations, subject to state invariants. Admin privilege does not bypass immutability, capacity, reconcile, or publication preconditions.

### 11.2 Teacher

Teacher access is the union of two independent scopes:

1. **class ownership scope** for progress, eligibility, ranking, and export;
2. **assigned invigilator scope** for room monitoring and incident reporting.

`CMP-AUTH-001`: Invigilator assignment MUST NOT grant school-wide ranking or export access.

`CMP-AUTH-002`: Class ownership MUST NOT grant room control unless the teacher is assigned to that room.

`CMP-AUTH-003`: Teacher MUST NOT grant retest, publish, correct official result, or create school-wide exports.

### 11.3 Student

`CMP-AUTH-010`: Frozen audience membership is required for campaign visibility and round access.

`CMP-AUTH-011`: Room code is never sufficient for school-exam join. The authenticated student MUST have an active RoomMember record.

`CMP-AUTH-012`: Students MUST NOT access raw Live Exam result endpoints while Competition visibility is WITHHELD.

### 11.4 Authorization test matrix

Each endpoint MUST have positive and negative tests for applicable roles, cross-class access, cross-student access, unknown IDs, and body identity spoofing.

---

## 12. Capacity and Scheduling Specification

### 12.1 Certified profile

`CMP-CAP-001`: No constant such as 100 or 150 may be used as a production capacity promise.

`CMP-CAP-002`: A capacity profile is CERTIFIED only when all gates pass in one candidate-environment run:

```text
lostAnswers = 0
duplicateFailures = 0
d1Overload = 0
app5xx = 0
networkErrors = 0
statusP95Ms < 500
submitP95Ms < 2000
```

`CMP-CAP-003`: Capacity evidence MUST include exact build SHA, runtime config version, polling profile version, benchmark run ID, timestamp, and concurrency.

`CMP-CAP-004`: The release SHA MUST equal the capacity report build SHA.

### 12.2 Peak computation

Room load interval:

```text
[scheduledAt - checkInLeadMinutes,
 scheduledAt + durationMinutes + closeDrainMinutes]
```

Planned peak is the maximum sum of assigned students across overlapping intervals.

`CMP-CAP-010`: Simultaneous room splitting MUST add concurrency; only non-overlapping shifts reduce peak.

`CMP-CAP-011`: Missing, expired, nonmatching, or uncertified profile MUST produce `PREFLIGHT_BLOCKED`.

### 12.3 Required real benchmark scenarios

The release candidate MUST run at least:

1. certified-target steady state;
2. check-in burst;
3. autosave/status polling during active exam;
4. reconnect subset;
5. synchronized submit window;
6. teacher room-monitor polling;
7. two simultaneous rooms whose total equals target capacity;
8. two non-overlapping shifts demonstrating reduced peak.

The JSON report is a release artifact, not a committed permanent secret.

---

## 13. Forms and Quiz Immutability

`CMP-FORM-001`: Every round and school-exam room MUST reference an immutable quiz snapshot before student access.

`CMP-FORM-002`: Class-specific RoundQuiz overrides grade default; ambiguous duplicate mapping MUST be rejected by uniqueness constraints.

`CMP-FORM-003`: Different-time shifts SHOULD use approved equivalent forms.

`CMP-FORM-004`: Equivalent forms MUST share blueprint, duration, total score, target difficulty, grade, and assessment objectives.

`CMP-FORM-005`: Reuse of the same form in a later shift MUST require an explicit leakage warning/acknowledgment.

---

## 14. Incidents, Retests, and Reconciliation

### 14.1 Incident

Allowed incident reasons:

- `NETWORK_FAILURE`
- `DEVICE_FAILURE`
- `SERVER_INCIDENT`
- `EXAM_INTERRUPTED`
- `ADMINISTRATIVE_ERROR`

`CMP-INC-001`: Incident report MUST identify event, room, student, original result, reporter, reason, occurrence time, and request ID.

### 14.2 Retest

`CMP-RET-001`: Only Admin may grant a retest and only from a recorded incident.

`CMP-RET-002`: Grant records MUST include expiry and intended reconcile resolution.

`CMP-RET-003`: Original result MUST never be deleted.

### 14.3 Reconcile

Allowed canonical decisions:

- `KEEP_ORIGINAL`
- `REPLACE_WITH_RETEST`
- `INVALIDATE_RESULT`

Blocking issue types MUST include missing participant/submission, duplicate result, room-member mismatch, missing score, pending retest, and exam not closed.

`CMP-REC-001`: Reconcile run MUST be versioned and rerunnable.

`CMP-REC-002`: Canonical replacement MUST write superseded result history.

`CMP-REC-003`: Event may become READY_TO_PUBLISH only when all required rooms are closed and blocking issue count is zero.

---

## 15. Publication, Ranking, and Correction

### 15.1 Publication

`CMP-PUB-001`: Publish is an explicit Admin mutation.

`CMP-PUB-002`: Publication MUST atomically persist publication version, ranking version, reconcile version, result digest, actor, request ID, and timestamp.

`CMP-PUB-003`: Student score, ranking, and certificate become visible only after PUBLISHED.

### 15.2 Ranking

Official order:

```text
score DESC
correctCount DESC
timeTaken ASC
```

Exact official ties receive the same rank. Student ID may stabilize display ordering only.

Supported scopes are EVENT, GRADE, and CLASS. Teacher access is CLASS-scoped.

### 15.3 Result correction

`CMP-COR-001`: Published results MUST NOT be edited in place.

`CMP-COR-002`: Correction creates an append-only pending record with before/after values and hashes.

`CMP-COR-003`: Republish creates a new immutable publication/ranking version and marks the earlier version superseded; historical evidence remains queryable.

---

## 16. Certificate Specification

`CMP-CERT-001`: Certificate batches MUST derive only from a published ranking version.

`CMP-CERT-002`: Winners MUST be grouped by `originalClassId` for the existing class-oriented Certificate engine; fake classes are forbidden.

`CMP-CERT-003`: Batch creation MUST be idempotent by event/publication/ranking/request.

`CMP-CERT-004`: Certificate failure MUST NOT roll back published results.

`CMP-CERT-005`: Competition MUST emit an auditable `CERTIFICATE_BATCH_CREATED` event containing parent batch ID, publication/ranking version, class batch IDs, winner counts, actor, and request ID.

---

## 17. XLSX Export Specification

`CMP-XLSX-001`: Artifact MUST be a valid XLSX with MIME type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

`CMP-XLSX-002`: Generation MUST use Queue and R2 and MUST NOT run synchronously during exam peak.

`CMP-XLSX-003`: Teacher export MUST be restricted to an authorized original class; Admin may request SCHOOL scope.

`CMP-XLSX-004`: Workbook MUST include `Tong_hop`, `Vong_1`..`Vong_6`, `Thi_cap_truong`, and `Metadata` sheets or a versioned equivalent documented in an ADR.

`CMP-XLSX-005`: Export MUST exclude credentials, tokens, access codes, answers not needed for the report, and sensitive anti-cheat telemetry.

`CMP-XLSX-006`: Competition MUST audit export request and completion. Completion event `XLSX_EXPORTED` MUST include export ID, scope, class ID if applicable, publication/ranking version, artifact key hash, actor, and request ID.

`CMP-XLSX-007`: Download authorization MUST be re-evaluated at download time and MUST not rely only on possession of the export ID.

---

## 18. Audit Specification

### 18.1 Required actions

The canonical vocabulary is:

```text
CAMPAIGN_CREATED
CAMPAIGN_UPDATED
AUDIENCE_SNAPSHOTTED
ROUND_CONFIG_CHANGED
ROUND_FINALIZED
ROUND_ATTEMPT_VOIDED
ELIGIBILITY_FINALIZED
ELIGIBILITY_OVERRIDDEN
ROOM_CREATED
ROOM_MEMBER_CHANGED
CAPACITY_PREFLIGHT_RUN
EXAM_PROVISIONED
EXAM_STARTED
EXAM_CLOSED
INCIDENT_REPORTED
RETEST_GRANTED
RECONCILE_STARTED
RECONCILE_RESOLVED
RESULTS_PUBLISHED
RESULT_CORRECTED
CERTIFICATE_BATCH_CREATED
XLSX_EXPORT_REQUESTED
XLSX_EXPORTED
```

Implementation-specific names such as `SCHOOL_EXAM_ROOM_CREATED` MAY be retained only if a documented canonical mapping exists.

### 18.2 Entry schema

Every entry MUST contain:

```text
actorId / actorUsername
actorRole
action
targetType
targetId
requestId
timestamp
reason?
beforeHash?
afterHash?
campaignId?
eventId?
```

`CMP-AUD-001`: Audit payload MUST not contain quiz answers, credentials, tokens, room access codes, or raw request bodies.

`CMP-AUD-002`: Room creation and bulk member assignment MAY be one transaction, but the audit must make the member mutation count and snapshot version explicit.

`CMP-AUD-003`: Live Exam control audit MUST map start/close events back to Competition event and room IDs.

`CMP-AUD-004`: Certificate and export lifecycle actions are release-blocking audit requirements.

---

## 19. Observability and SLOs

### 19.1 Structured events

Competition mutations MUST emit sanitized structured events containing:

- operation name;
- request ID;
- campaign/event/room identifier as applicable;
- actor role, not credentials;
- status/outcome;
- stable error code;
- duration;
- retry count for asynchronous work.

### 19.2 Required metrics

| Area | Metrics |
|---|---|
| Round | attempt start/submit/error rate; scoring latency; idempotent replay count |
| Eligibility | batch size; duration; qualified count; failure count |
| Preflight | planned peak; certified capacity; blocked reason |
| Provision | ready/failed/skipped rooms; retry count |
| Exam | join denial, autosave error, reconnect, submit latency, 5xx |
| Reconcile | duration, issue count/type, blocking count |
| Publish | duration, result count, digest/version |
| Export | queue age, processing duration, retry, terminal failure, artifact size |
| Certificate | parent/class batch count, failures, retries |

### 19.3 Stop conditions

Rollout promotion MUST stop when any of the following occurs:

- unexpected Competition authorization denial or privilege escalation;
- result embargo bypass;
- mutation 5xx above agreed threshold;
- lost/duplicate submission evidence;
- D1 overload;
- capacity certificate mismatch;
- reconcile produces unexplained blocking issues;
- sanitized logs contain forbidden data;
- Queue/R2 export failure rate exceeds agreed threshold.

Exact alert thresholds MUST be recorded in the release candidate evidence.

---

## 20. Migration, Backfill, and Rollback

### 20.1 Forward migration rehearsal

Before PR approval, migrations 0069–0078 MUST be rehearsed against:

1. an empty database bootstrap;
2. a representative anonymized copy of current D1 schema/data;
3. a database already at migration 0068;
4. a rerun/idempotency scenario where supported.

Evidence MUST contain migration registry before/after, row counts, integrity checks, duration, and exact candidate SHA.

### 20.2 Backfill

Competition V1 creates a new domain and requires no historical Competition backfill. Existing Live Exam rows MUST remain valid with CLASS participant scope and existing result visibility defaults.

`CMP-MIG-001`: Migration MUST NOT reinterpret existing Live Exam sessions as Competition sessions.

### 20.3 Application rollback

Application rollback order:

1. set `VITE_FEATURE_COMPETITION_V1=false`;
2. redeploy the distinct known-good rollback SHA;
3. verify Competition navigation and student entry points are absent;
4. preserve Competition data for investigation/retry.

### 20.4 Database rollback

Database rollback is destructive and separate. Scripts 0078→0069 MUST only run in reverse order after explicit approval and backup verification.

`CMP-MIG-010`: Automatic application rollback MUST NOT run database rollback scripts.

`CMP-MIG-011`: Dropping result correction/publication/audit tables destroys evidence and requires incident/legal approval.

---

## 21. Testing and Verification Contract

### 21.1 Local required suites

- Competition domain and worker tests;
- contract/schema tests;
- authorization matrix tests;
- Live Exam regression affected by Competition adapters;
- Certificate regression;
- migration/rollback rehearsal tests;
- release-hardening tests;
- frontend routing/dashboard/student UI tests;
- stubbed Cypress Competition journey;
- root and Workers typecheck;
- lint, build, security, coverage, performance budget.

### 21.2 Integration environment suites

`CMP-TEST-001`: Run real D1 forward migration and data integrity checks.

`CMP-TEST-002`: Run Student round attempt through Worker and persisted Results/Progress.

`CMP-TEST-003`: Run RoomMember join through real school-exam participant scope.

`CMP-TEST-004`: Close Live Exam and prove every alternative result endpoint remains withheld.

`CMP-TEST-005`: Run reconcile, publish, ranking, correction, and republish with version checks.

`CMP-TEST-006`: Produce and download a real certificate batch and XLSX artifact through Queue/R2.

`CMP-TEST-007`: Run the certified capacity benchmark against the exact candidate SHA.

### 21.3 Acceptance evidence format

Each gate record MUST include:

- command or automated check name;
- environment;
- start/end time;
- candidate SHA;
- pass/fail result;
- artifact/report link or path;
- reviewer/owner;
- known flakes and rerun explanation.

---

## 22. Task 1–24 Traceability

| Task | Implemented capability | Commit | Primary evidence area | Status |
|---:|---|---|---|---|
| 1–5 | Campaign, audience, schema/contracts foundation | `d605f91` | campaign/audience/contracts | Local PASS; task-level split missing |
| 6 | Round attempt engine | `540b3cc` | round engine tests | Local PASS |
| 7 | Eligibility finalization | `3ca468a` | eligibility tests | Local PASS |
| 8 | School exam foundation | `8e8ec5e` | schema/foundation tests | Local PASS |
| 9 | Multi-class RoomMember authorization | `01783e8` | join authorization tests | Local PASS |
| 10 | Result embargo | `adb9516` | embargo tests | Local PASS |
| 11 | Capacity certification model | `509616f` | capacity unit/certification tests | Real report missing |
| 12 | School exam orchestration | `8278b0e` | orchestration tests | Local PASS |
| 13 | Reconciliation | `f06ee6a` | reconcile tests | Local PASS |
| 14 | Incident/retest workflow | `e2f75c8` | incident/retest tests | Local PASS |
| 15 | Publication/ranking | `895f20a` | publication/ranking tests | Local PASS |
| 16 | Certificate adapter | `b9ebf25` | certificate adapter/regression | Local PASS; canonical audit gap |
| 17 | Asynchronous XLSX | `e2fe099` | export/queue/XLSX tests | Local PASS; real Queue/R2 and audit gap |
| 18 | Admin/Teacher workflow UI/API | `6c5e503` | dashboard/API/role tests | Local PASS |
| 19 | RoundQuiz mapping | `d65dd2a` | mapping/snapshot tests | Local PASS |
| 20 | Student flow | `6fd72fb` | student routing/page tests | Local PASS |
| 21 | Release-readiness baseline | `098cd53` | release/rollback/perf/security | Local PASS |
| 22 | Versioned result correction | `0b25796` | correction/publication tests | Local PASS |
| 23 | Release hardening | `25bcb9d` | release contract/E2E/migration | Local PASS |
| 24 | Final local release gates | `cfcef5e` | timezone/coverage/migration gates | Local PASS |

`CMP-TRACE-001`: Before PR, Tasks 1–5 MUST be decomposed in the traceability record into five requirement-level rows even if commit history is not rewritten.

`CMP-TRACE-002`: Commit history MUST NOT be rewritten solely to manufacture one-commit-per-task traceability.

---

## 23. Gap Register Before Main

### P0 — release blockers

| ID | Gap | Required closure evidence |
|---|---|---|
| GAP-P0-01 | No real certified capacity report | Passing JSON report bound to candidate SHA and runtime config |
| GAP-P0-02 | No representative D1 migration rehearsal | Forward rehearsal report with integrity checks and rollback plan |
| GAP-P0-03 | No real Queue/R2 export journey | Successful queued XLSX creation, authorization, download, retry test |
| GAP-P0-04 | No exact release/rollback SHA pair and rollout stage | Release-readiness report for internal candidate |

### P1 — required before PR approval

| ID | Gap | Required closure |
|---|---|---|
| GAP-P1-01 | Task 1–24 traceability was reconstructed from history | Approve and maintain this spec/trace table |
| GAP-P1-02 | Audit vocabulary is incomplete/inconsistent | Canonical mapping plus missing certificate/export/member/lifecycle audit events and tests |
| GAP-P1-03 | E2E is primarily stubbed | Integration-environment journey for D1/Workers/Queue/R2 |
| GAP-P1-04 | Large branch blast radius | Human review by domain/security/release owners and full CI |
| GAP-P1-05 | Pagination limits not proven for all large reads | Bounded query/API evidence or explicit V1 dataset limit ADR |

### P2 — rollout hardening

| ID | Gap | Required closure |
|---|---|---|
| GAP-P2-01 | Retention duration undefined | Approve operations retention policy |
| GAP-P2-02 | Alert thresholds not frozen | Candidate SLO/alert sheet |
| GAP-P2-03 | Same-form later-shift warning requires UX acceptance evidence | UI/API acceptance test or ADR |

---

## 24. Architecture Decisions

### ADR-CMP-001 — Modular Competition domain

**Status:** Accepted

**Decision:** Keep Competition inside the existing Workers/application repository with explicit domain services and adapters.

**Alternative:** New microservice.

**Rationale:** Current team, data, deployment, and reuse needs do not justify distributed ownership and consistency costs.

**Trade-off:** Larger branch and shared deployment blast radius.

**Mitigation:** Feature flag, dedicated namespace, strict contracts, staged rollout, GitNexus/CI review.

**Revisit trigger:** Independent team ownership or sustained scaling that cannot be met by the current Workers/D1 topology.

### ADR-CMP-002 — Append-only publication instead of event sourcing

**Status:** Accepted

**Decision:** Use immutable publication snapshots and append-only correction/audit ledgers.

**Alternative:** Full event sourcing.

**Rationale:** Preserves official history without introducing unnecessary reconstruction and operational complexity.

**Trade-off:** Some state is duplicated between current canonical rows and versioned snapshots.

**Mitigation:** Hashes, version constraints, reconcile linkage, consistency tests.

### ADR-CMP-003 — Multi-class participant adapter

**Status:** Accepted

**Decision:** Use `SCHOOL_EXAM_ROOM` participant scope and RoomMember with original class.

**Alternative:** Synthetic class or one Live Exam implementation per original class only.

**Rationale:** Supports physical mixed-class rooms without corrupting class ownership or reporting.

**Trade-off:** Adds authorization and result-mapping paths to Live Exam.

**Mitigation:** Additive scope type, negative authorization tests, originalClassId invariants.

### ADR-CMP-004 — Asynchronous XLSX through Queue/R2

**Status:** Accepted

**Decision:** Queue heavy generation and store artifacts in R2.

**Alternative:** Generate synchronously in HTTP request.

**Rationale:** Avoids CPU/time spikes and request timeout during exam operations.

**Trade-off:** Eventual consistency and retry/authorization complexity.

**Mitigation:** Explicit job states, idempotency, terminal/retryable failures, download-time authorization.

### ADR-CMP-005 — Capacity as release evidence

**Status:** Accepted

**Decision:** Bind a certified benchmark artifact to the exact release SHA and runtime configuration.

**Alternative:** Fixed documented maximum.

**Rationale:** Capacity changes with code, platform, polling, and configuration; a constant would be unsafe.

**Trade-off:** Each release candidate may require a new benchmark.

**Mitigation:** Machine-readable benchmark/certification scripts and fail-closed release readiness.

---

## 25. Rollout Plan

### Stage 0 — Disabled integration

- merge is still forbidden until P0/P1 evidence is complete;
- feature flag remains false;
- migrations are rehearsed outside production;
- full CI and human review run.

### Stage 1 — Internal

- exact certified SHA;
- internal test campaign only;
- limited rooms within certified capacity;
- validate logs, audit, Queue/R2, reconcile, publish, certificate, and export.

### Stage 2 — Canary

- one approved school/grade/campaign;
- no candidate SHA or capacity artifact change;
- active operations owner and rollback readiness;
- promotion only after acceptance window passes.

### Stage 3 — School-wide

- all canary exit criteria pass;
- capacity plan covers every overlapping room window;
- alerting and incident ownership are active;
- release evidence is archived.

---

## 26. Definition of Done

Competition V1 is eligible for PR approval only when:

- [ ] this specification is reviewed and approved;
- [ ] all P0 and P1 gaps are closed with linked evidence;
- [ ] the branch contains only Competition V1 and approved spec/readiness changes;
- [ ] full required local verification passes from the final candidate SHA;
- [ ] representative D1 migration rehearsal passes;
- [ ] real Queue/R2/certificate integration journey passes;
- [ ] capacity benchmark passes and is bound to candidate SHA/config;
- [ ] audit vocabulary/mapping and missing lifecycle events are tested;
- [ ] GitNexus change detection and security review have no unresolved P1/P2 finding;
- [ ] CI passes on the pushed feature branch;
- [ ] required human reviewers approve;
- [ ] rollback SHA, rollout owner, and internal-stage window are recorded.

Competition V1 is eligible for production enablement only after the Internal and Canary stage exit criteria pass.

---

## 27. Approval Gates

1. **SPEC APPROVAL** — approves this contract, not code merge.
2. **GAP-FIX PLAN APPROVAL** — approves implementation work for P0/P1 gaps.
3. **COMMIT APPROVAL** — approves only reviewed spec/gap-fix files.
4. **PUSH/PR APPROVAL** — allows feature-branch push and PR; never direct push to `main`.
5. **MERGE APPROVAL** — only after CI and required human review.
6. **INTERNAL ROLLOUT APPROVAL** — binds candidate SHA, rollback SHA, capacity report, and stage.
7. **CANARY/SCHOOL-WIDE APPROVAL** — separate promotion decisions.

Current gate after this document is reviewed:

```text
DUYỆT SPEC COMPETITION V1 INTEGRATION READINESS
```
