# API Authorization and Ownership Matrix

## Scope

This matrix classifies every API family dispatched by `workers/src/router/createWorkerFetch.ts`. The executable source of truth is `workers/src/security/apiAuthorizationPolicy.ts`; `workers/src/middleware/auth.ts` fails closed when no policy matches.

The central gate classifies routes. It does **not** replace route-level JWT, role or D1 ownership checks. Handlers must derive actor identity from the verified session and constrain database reads/writes by the ownership keys below.

## Authorization classes

| Class | Meaning | Required control |
|---|---|---|
| `public` | No application session required | Validation, sanitization and rate limiting where appropriate |
| `authenticated` | Any supported authenticated actor | JWT/parent-session verification in the handler |
| `student-owned` | Data belongs to the authenticated student or parent-linked student | Ignore spoofed client identity; derive `studentId` from session |
| `teacher-owned` | Data belongs to the authenticated teacher's quizzes/classes/results/batches | Query by resource ID **and** teacher/class ownership; admin may override only explicitly |
| `admin-only` | School/system administration | `requireAdmin` before reading or mutating protected data |
| `internal-only` | First-party telemetry/control-plane endpoint | Origin guard, strict schema, redaction and bounded rate limit |

## Route-family matrix

| Route family | Methods or exception | Class | Ownership keys | Enforcement owner |
|---|---|---|---|---|
| `/api/health` | `GET` | public | none | Router |
| `/api/login`, `/api/student-login` | `POST` | public | none | Login handlers + rate limit |
| `/api/parent/activate`, `/api/parent/login` | `POST` | public | none | Parent auth handlers + rate limit |
| `/api/phieu/public/*` | supported public reads | public | signed/public link | Public phieu handler |
| `/api/math/telemetry` | `POST` | public | none | Rate limit + sanitizer |
| `/api/announcements`, `/api/announcements/current` | `GET` | public | none | Announcement read handler |
| `/api/system-settings` | `GET` | public | none | Settings read handler |
| `/api/login-media` | `GET` | public | none | Safe Login Media read; only active scheduled slides, no admin metadata |
| `/api/practice/*` | supported methods | public | none | Practice validation |
| `/api/questions/*` | `GET` | public | `quizId` | Quiz handler strips answer material |
| `/api/quizzes` | catalogue `GET` | public | `quizId` | Quiz catalogue handler |
| `/api/client-errors` | `POST` | internal-only | none | Origin guard + rate limit + redaction |
| `/api/admin/*` | all | admin-only | route-specific | Handler `requireAdmin` checks |
| `/api/parent/*` except auth endpoints | all | student-owned | session, `studentId` | Parent session derives linked student |
| `/api/parent-links*` | all | teacher-owned | `studentId`, `classId` | Teacher/student-scope guard |
| `/api/parent-announcements*` | all | teacher-owned | `classId` | Teacher class-scope guard |
| `/api/parent-delivery*` | all | teacher-owned | `classId`, `studentId` | Teacher class-scope guard |
| `/api/logout`, `/api/account*`, `/api/teachers*` | supported methods | authenticated | session, route-specific | Route JWT/role checks |
| `/api/classes*` | all | teacher-owned | `classId` | Classroom ownership checks |
| `/api/students*` | all | teacher-owned | `studentId`, `classId` | Classroom ownership checks |
| `/api/student-profile` | all | student-owned | session, `studentId` | Authenticated student identity |
| `/api/assignments*` | writes | teacher-owned | `quizId`, `classId`, `studentId` | Assignment ownership checks |
| `/api/assignments*` | reads | student-owned | session, `studentId`, `classId` | Student/teacher scoped query |
| `/api/results` | submission `POST` | student-owned | session, `studentId`, `quizId` | Canonical student identity |
| `/api/results*` | other operations | teacher-owned | `resultId`, `studentId`, `quizId`, `classId` | Result ownership checks |
| `/api/validate` | `POST` | student-owned | session, `quizId` | Result validation handler |
| `/api/result-reports/mine*` | all | student-owned | session, `studentId`, `resultId` | Student report service |
| `/api/result-reports*` | teacher workflows | teacher-owned | `batchId`, `resultId`, `studentId`, `quizId`, `classId` | Result-report ownership services |
| `/api/quiz-drafts*` | all | teacher-owned | session, `quizId` | Draft owner scope |
| `/api/quizzes*`, `/api/questions*` | mutations/private reads | teacher-owned | `quizId` | Quiz creator/admin ownership |
| `/api/game-state*`, `/api/pets*`, `/api/shop*`, `/api/game-loop*` | all | student-owned | session, `studentId`, optional `resultId`/`quizId` | JWT student identity |
| `/api/leaderboard*` | all | authenticated | session | Gamification handler |
| `/api/gift-shop*` | all | authenticated | `studentId`, `classId`, route-specific | Student self-scope/teacher class-scope |
| `/api/live-exam*` | all | authenticated | `studentId`, `quizId`, `classId` | Role and live-session ownership |
| `/api/certificates*` | all | authenticated | `studentId`, `classId`, `batchId` | Certificate ownership checks |
| `/api/certificate-batches*` | all | teacher-owned | `studentId`, `classId`, `batchId` | Certificate batch ownership |
| `/api/notifications*` | all | authenticated | session, `studentId` | Recipient scope |
| `/api/homework*` | all | authenticated | `studentId`, `classId` | Student/teacher ownership |
| `/api/analytics*` | all | teacher-owned | `classId`, `quizId` | Teacher/admin scope |
| `/api/phieu*` excluding public | all | teacher-owned | `resultId`, `classId`, `batchId` | Teacher/admin ownership |
| `/api/announcements*`, `/api/system-settings*` | mutations | admin-only | route-specific | `requireAdmin` |
| `/api/admin/login-media*` | all | admin-only | route-specific | `verifyJWTMiddleware` + `requireAdmin`; audited writes |
| `/api/ai-tutor*` | all | student-owned | session, `resultId` | Server-derived result ownership |
| `/api/ai/*` | all | teacher-owned | session, route-specific | AI proxy role checks |
| `/api/help*` | all | authenticated | session | JWT checks |
| `/api/teacher-ai-quota*` | all | teacher-owned | session | Teacher role checks |
| `/api/test-bank*` | all | teacher-owned | `quizId` | Teacher/admin checks |

## High-risk IDOR/BOLA rules

| Client-controlled identifier | Mandatory server rule | Executable abuse evidence |
|---|---|---|
| `studentId` | Ignore or reject values that differ from the authenticated/parent-linked student; teachers must prove class ownership | `tests/parentDashboard.worker.test.ts`, `tests/giftShopRoutes.worker.test.ts` |
| `quizId` | Load quiz and constrain by `created_by`/allowed public state before private reads or mutations | `tests/quizzesSecurity.worker.test.ts` |
| `resultId` | Join result to authenticated student or owning teacher before returning answers/AI context/report data | `tests/aiTutorAuthorization.worker.test.ts`, `tests/resultReportDelivery.worker.test.ts` |
| `classId` | Resolve class and verify teacher ownership before student lists, assignments, announcements or certificates | `tests/certificates.worker.test.ts`, `tests/classroomRoutes.worker.test.ts` |
| `batchId` | Load batch through an owner-scoped query before detail, retry, revoke or delivery actions | `tests/resultReportDelivery.worker.test.ts` |

## CI contract

`tests/apiAuthorizationMatrix.test.ts` enforces that:

1. all six authorization classes remain represented;
2. representative sensitive routes keep their intended classification;
3. every `/api/*` path literal added to the Worker router matches a policy;
4. an unclassified route returns a fail-closed response;
5. executable cross-owner abuse tests remain present for the five high-risk identifiers.

Adding a router dispatch without adding an explicit policy therefore makes CI fail before the route can be accepted.
