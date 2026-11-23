# Public practice answer boundary and authoritative grading

## Objective, baseline and authorization

The user requested a detailed plan followed by implementation for the `/api/practice` security follow-up. Baseline: merged main `88018b5ef3b9d1d7cf3a26ab19e8dc306b6a5e95`; production Worker `226e8324-d801-4d5c-9c27-8174d95ac160` contains the completed atomic assignment-attempt fix.

Dedicated worktree: `C:/Users/Administrator/.codex/worktrees/security-practice-answer-boundary/quizpro`; branch `codex/security-practice-answer-boundary`.

Authorization covers planning, reversible implementation and verification. Final commit/push/PR and a concrete production artifact still require the repository's separate delivery gates. No production mutation is authorized by this plan alone.

## Confirmed current state

- `handlePracticeRoutes` returns raw `correct_answer` and camelCase `correctAnswer`, with additional embedded answers in structured question types.
- `useQuizPlayer.handleSubmit` grades practice locally using `gradeQuiz`; deleting answer fields alone would break this flow.
- `PUBLIC_PRACTICE_SOURCE_SCOPE_SQL` already excludes code-protected/private quizzes and all five assignment/live/competition workflow tables. No new protected-pool exploit is assumed merely because public practice answers are currently visible.
- Existing learner DTO helpers already allowlist presentation data and obscure structured answer IDs. Reuse them without weakening formal quiz authorization or scoring.
- Practice is a virtual quiz assembled from questions belonging to multiple source quizzes, so formal `POST /api/results` and quiz-wide validation cannot safely substitute for a selected-question practice contract.
- Architecture review confirmed answer-bearing presentation edge cases: DRAG/DROPDOWN text can literally contain bracketed answers such as `[xanh]`; ORDERING and WORD_SCRAMBLE array positions can encode the authored solution despite client-side visual shuffling. Field-name stripping alone is insufficient.

## Resulting behavior

Loading practice returns only presentation DTOs and a signed, bounded practice-session token. Correct answers and grading metadata appear only in the successful post-submit review response. Submitting practice requires a network connection; a failure preserves answers/draft and permits retry.

This is a load-versus-review boundary for public learning content, not a promise that public practice solutions remain secret after submission. A visitor may submit skipped answers and receive the intentionally disclosed practice review. Protected content must never become eligible through that endpoint.

The Worker grades only questions authorized by the session token and still in the current public practice pool. Removing publicity, enabling a code, attaching any protected workflow, changing/deleting a selected question, or changing its revision invalidates that session before any answer/review disclosure. Return a stable conflict/expiry error, preserving the frontend draft.

Practice remains separate from saved results: no result insert, assignment attempt consumption, parent notification, activity, coins or experience. Teacher-owned preview/local fixtures keep their existing local scoring path; the secure virtual practice payload chooses server grading explicitly.

## Contract and security design

1. Add a versioned delivery negotiation to existing GET `/api/practice`: the new frontend requests `delivery=server-v1`.
2. The new Worker requires that negotiation and returns a stable refresh-required conflict for legacy/unversioned practice loads, rather than sending answer keys or allowing old clients to score sanitized questions incorrectly. Topics remain compatible.
3. Response contains the existing virtual quiz presentation plus a typed delivery/session envelope: version, token and expiry. Use explicit field allowlists; do not spread database rows into the response. Set no-store on question/session and grading responses.
4. Token uses a domain-separated signing key derived from existing Worker secret material, a dedicated issuer/audience/purpose, finite expiry (proposed 24h), unique session ID and at most 50 selected question references. Claims contain identifiers, source revisions and keyed HMAC question-content fingerprints, never answers or full question snapshots. Do not expose a plain SHA256 of an answer-bearing row: short answers could be guessed against that public digest. The fingerprint needs its own domain separation. The token is a practice selection capability, not a login or formal quiz grant. Reject wrong-purpose/auth tokens, duplicates and invalid claim types.
5. Add public POST `/api/practice/grade`. Validate request byte size (proposed 256KiB), token size, answer shape and question-order membership. Submitted correctness/score/snapshots are never trusted. Reject extra question IDs and duplicate order IDs; missing answers represent skipped questions.
6. Reload all signed selected questions using the same public source predicate, and verify membership/revisions/content fingerprints. Fail the whole request if any selected question is no longer eligible; do not return partial answer keys.
7. Normalize D1 rows through `mapLiveExamQuestionRow` before DTO/scoring. Decode structured answer IDs with the same per-question/session context used by the display DTO. The shared decoder deliberately supports legacy canonical matching/drag IDs; server-v1 practice must validate its own issued opaque IDs and nonempty structured input shapes before calling it, while permitting valid partial/skipped answers. Do not change formal/live compatibility to impose this practice-only rule. Grade exactly the selected questions using the shared canonical scoring engine. Return bounded authoritative counters, validation details, normalized answers and review details with complete exact question-ID coverage, built from canonical answers through `buildAuthoritativeReviewDetails`. No quiz-wide grading of unselected questions.
8. Reuse existing rate-limit infrastructure for the new public grading operation if available without changing router-wide behavior. Record the actual state/write implications of rate limiting. Do not log tokens, answer payloads or secrets. Do not create new results/session tables.

### Practice-specific presentation normalization

- Add normalization in the new practice layer, without changing formal/live DTO helpers. Recognized answer-bearing blank markers become neutral sequential placeholders, including supported underscore syntax. Check equivalent stem copies/rich-text text nodes that otherwise repeat those markers. Preserve escaped text, line breaks and mathematical syntax such as `\\sqrt[3]`.
- Derive a keyed per-session presentation permutation for ORDERING and WORD_SCRAMBLE arrays. Client-visible array positions must not be the authored identity solution. Recompute the mapping when grading, remap submitted ranks back to canonical indices (or privately rebase both question and correct order), and generate consistent review. Cover duplicate text/letters and partial/skipped answers.
- Preserve sparse IMAGE_QUESTION text-option and image-array positions instead of inheriting the shared DTO helper's empty-string filtering. Image-only and text-only choices may coexist at matching indices. Preserve the old practice route's sentence-token fallback for legacy UNDERLINE questions when words/items are absent and answer indices are valid.
- Replace semantic DROPDOWN blank IDs (which may equal the answer) with neutral or scoped IDs, and map them back privately when grading. Preserve canonical TRUE_FALSE fallback IDs for legacy statements rather than dropping invisible items. Treat metadata-only matching and cleared selections as skipped before structured decoding, matching the canonical scoring semantics.
- Privately permute each DROPDOWN blank's options with a keyed per-session/question/blank ordering: the editor constructs these arrays as `[correctAnswer, ...distractors]`, so preserving that array order discloses the solution position even without a `correctAnswer` field. Submitted option values remain text.
- Canonicalize accepted aliases and hyphenated/case variants before the D1 mapper; do not return an unmodified source row merely because its normalized type string already equals a canonical enum member.
- The existing rate limiter is D1-backed. Reusing it adds only existing `rate_limits` bookkeeping; tests must distinguish that from prohibited result/assignment/reward/notification mutations. Select limits with classroom/shared-network traffic in mind and document failure handling.

## Rollout compatibility

Deploy the additive frontend first: it requests the delivery version and recognizes secure session responses; an old Worker may ignore the extra query parameter and continue returning its existing legacy practice payload during the deployment transition. Local scoring compatibility is limited to those legacy payloads/authorized previews, not used after a secure grade request fails.

Then deploy the new Worker, whose GET delivers sanitized data only for negotiated clients and whose POST grades the signed selection. Old browser clients receive a refresh-required error on practice loading instead of answer keys or incorrect zero scores; their existing error handling shows a generic loading failure, not a new refresh-specific UI message. Re-opening the site loads the new frontend. Never silently fall back to local grading on a secure session's network/auth/expiry/conflict failure.

Rollback Worker to the immutable pre-release version is operationally possible, but restores legacy public-practice answer exposure. Record that security tradeoff explicitly. No database rollback is needed. Do not claim past public answers already cached by browsers can be revoked.

## Expected file scope

Implementation packages may introduce a shared practice contract, Worker practice-session/grading services, a frontend practice submission service, and focused tests. Existing files expected to change:

- `workers/src/routes/practice.ts`
- `src/services/api/routes/practice.ts`
- `src/services/practiceService.ts`
- `src/types/domain.types.ts`
- `src/features/quiz-player/hooks/useQuizPlayer.ts`
- `tests/practiceQuestionAccess.worker.test.ts`
- `tests/practiceRandomization.worker.test.ts`
- `cypress/e2e/question-scoring-matrix.cy.ts` (or a dedicated secure-practice journey)

New focused test files should cover session signing/verification, grading/eligibility, service response validation and the secure quiz-player flow. The published scoring engine currently supports 14 types, including SHORT_ANSWER; use that actual set, supplementing older 13-type fixtures as needed. Do not edit formal results/grading/DTO helpers unless a concrete gap is demonstrated; analyze such changes and report scope before expanding.

## Eight implementation tasks

### 1. Audit, impact and regression RED

- Confirm all practice entry points and DTO/grading mappings, including all 14 published types.
- GitNexus exact-symbol pre-change findings: `handlePracticeRoutes` LOW (0 direct callers in graph); `useQuizPlayer` LOW (1 direct caller); `handleSubmit` in that hook LOW (1 direct caller, 2 impacted symbols). Disambiguate names by UID/file; UNKNOWN is not LOW.
- Analyze every additional existing symbol before editing. Stop for user confirmation if HIGH/CRITICAL is discovered.
- Add failing tests proving initial payloads contain no answer fields or embedded matching/category/blank/order solutions, while safe presentation fields remain.

### 2. Signed practice selection

- Implement strict bounded token claims, domain-separated keys, purpose/issuer/audience checks and expiry.
- Test tampering, auth-token substitution, missing/invalid secrets, malformed claims, duplicate IDs, size/limit boundaries and expiry.
- Verify token payloads contain no answers. Avoid changing authentication JWT behavior.

### 3. Safe loading and eligibility

- Query the existing explicit public pool and map through learner DTO helpers using a reproducible signed context.
- Preserve topics, exact hashtag selection, ordering/randomization settings, rich text, images/SVG, multiline underline and structured render fields.
- Fail closed on malformed selected content; return a useful error rather than an ungradable quiz or leaked row.
- Keep existing five protected-workflow regression tests on real SQLite.

### 4. Authoritative practice grading

- Add bounded POST handling and fresh eligibility/content checks before grading or review disclosure.
- Use shared scoring and safe review builders for exactly the selected set.
- Test forged IDs/context, stale revision/content, newly protected sources, partial invalid selections, empty/skipped answers and client-supplied score/correctness.
- Assert no result, assignment, reward or notification writes (apart from documented existing rate-limit infrastructure if applicable).

### 5. Frontend integration and recovery

- Add a typed service route and validate the complete authoritative response before using it.
- Request answers may be sparse, including completely empty submissions; reject keys outside the selected question set, but do not require every question to have an answer. Require exact full selected-set coverage only on the authoritative response.
- Use shared token byte limits and wire types rather than duplicated divergent limits. Require numeric counters without coercion, status/boolean agreement, and nested review value/line/presentation structures that the result UI actually consumes. Malformed review must fail before clearing the draft or showing completion.
- Secure practice uses POST grading; formal quizzes remain on the existing authoritative result flow and authorized previews retain their existing behavior.
- Keep practice answers and question order consistent with DTO IDs/shuffling; display server review details after success.
- Preserve draft on network errors, 400/409/expiry/429, and never claim completion/reward before successful grading.
- Retry an active signed session after transient network failure. Permanent expiry/staleness requires a new selection; never silently attach old question IDs/answers to a fresh session token. Retain the old draft without pretending it authorizes the replacement selection.
- Test legacy Worker compatibility and explicitly prohibit secure-session fallback to local scoring.

### 6. Cross-type and browser verification

- Exercise all 14 published question types through safe load, canonical answers and post-submit review; include duplicate words, punctuation, multiline text and rich presentation.
- Cypress journey loads secure questions, submits raw answers and displays authoritative score/review. Assert no `/api/results`, legacy `/api/validate`, or reward writes for practice.
- Verify mobile/keyboard presentation using existing shared renderers; add targeted browser checks if DTO mapping changes interaction.

### 7. Review and delivery evidence

- Focused tests plus adjacent practice, DTO, result/scoring, assignment and preview tests; relevant lint, frontend/Worker typechecks, builds and security scan.
- Independent specification and quality/security review; resolve all P1/P2 findings.
- Refresh GitNexus and run `detect_changes` against main, including new files, before commit.
- Report exact final file list, validation evidence, risks and rollback. Obtain final commit/push/PR approval under AGENTS step 6.

### 8. PR, rollout and closure

- Required CI and human GitHub review before merge; verify HEAD immediately before merge.
- Verify deployment sequence above; run read-only public/authenticated smoke after frontend and Worker deployment. A live POST grading canary, if used, must be explicitly included in the production approval because existing rate-limit bookkeeping writes to D1; it must use existing public content and must never create formal results or protected test fixtures.
- Build the concrete Worker artifact from merged SHA with clean lockfile dependencies, verify uploaded JS/WASM bytes and config, and obtain separate production approval under AGENTS step 11.
- Do not mutate production student results to test the new flow. Preserve unrelated main/worktrees, retain redacted evidence and clean only safe task artifacts.

## Remaining design checks before source changes

Architecture review confirmed canonical `result.reviewDetails` is the existing review UI boundary, D1 rate limiting adds only infrastructure bookkeeping, and formal helpers need no behavior changes. Presentation corrections and practice-only structured-ID validation above are mandatory regression cases. The implementation must confirm the exact payload budget and verify all 14 published type mappings. If those checks change the proposed external contract or reveal an unexpectedly broad impact, update the plan and report before expanding scope.

## Current status

Implementation complete in the dedicated worktree; independent final security/specification review found no remaining P1/P2. No commit, push or production change for this package.

Verification on 2026-11-23:

- Captured regression RED against unchanged baseline `88018b5`: negotiated GET still returned `correct_answer` before this implementation.
- Adjacent scoring, DTO, assignment atomicity/attempt limits, rewards, resume and student preview: 9 suites / 93 tests PASS.
- Frontend and Worker typechecks PASS; scoped ESLint and security scan PASS.
- Frontend production build and explicit `workers/wrangler.toml` Worker dry-run build PASS. Dry-run did not upload or change production.
- Performance budget PASS: initial JavaScript 169,256 bytes gzip; budget unchanged.
- Cypress scoring matrix: 3/3 PASS, including secure raw submission and authoritative review with no results/validate calls. The secure browser case starts from a seeded selected quiz; GET negotiation is verified by service tests and real-SQLite Worker tests, not that browser case. Reward suppression is verified by hook tests.
- Final focused suite: 6 suites / 77 tests PASS (170 focused + adjacent tests total).
- GitNexus fully refreshed: 27,110 nodes / 55,008 edges / 300 flows. Compare against `origin/main`: exactly 17 changed files, 328 symbols, LOW risk, zero affected processes reported by the graph. This graph result is a scope check, not a substitute for runtime verification. Commit approval remains pending.

Exact delivery scope (17 files):

1. `docs/superpowers/plans/2026-11-22-public-practice-answer-boundary.md`
2. `shared/practice-grading.contract.ts`
3. `workers/src/routes/practice.ts`
4. `workers/src/services/practiceSession.ts`
5. `workers/src/services/practiceGrading.ts`
6. `workers/src/services/practicePresentation.ts`
7. `src/services/api/routes/practice.ts`
8. `src/services/practiceService.ts`
9. `src/types/domain.types.ts`
10. `src/features/quiz-player/hooks/useQuizPlayer.ts`
11. `tests/practiceSession.worker.test.ts`
12. `tests/practiceGrading.worker.test.ts`
13. `tests/practiceQuestionAccess.worker.test.ts`
14. `tests/practiceRandomization.worker.test.ts`
15. `tests/practiceService.test.ts`
16. `tests/useQuizPlayerPracticeSubmission.test.tsx`
17. `cypress/e2e/question-scoring-matrix.cy.ts`

Remaining operational limitations: submission requires network access; expired or stale selections require a new session while the old draft is retained. Public learning solutions become visible after submission. Rate limiting uses existing D1 bookkeeping. Deploy frontend before Worker; old browser clients must reload. Worker rollback restores the previous answer-exposure behavior. No dependency/config/secret/flag/migration changes are included.
