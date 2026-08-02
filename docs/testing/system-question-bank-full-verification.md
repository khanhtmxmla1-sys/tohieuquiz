# System Question Bank Full Verification

**Date:** 2026-08-02
**Workspace:** `C:\quizpro`
**Scope:** Shared question-bank backend, teacher/admin frontend, Grade 5 Math Semester 1 dataset pipeline, responsive E2E and release safety.

## Completion status

The feature is implemented and verified locally. Production D1, Worker, frontend deployment, runtime flag enablement, draft import and topic publication were not executed during this verification.

The rollout flag remains designed as:

```text
system_question_bank_v1
enabled = 0
audience = teacher
percentage = 100
```

## Backend and migration

- Migration: `workers/migrations/0060_system_question_bank.sql`
- Rollback: `workers/rollbacks/0060_drop_system_question_bank.sql`
- Tables: `question_bank_items`, `question_bank_audit`
- Preserved table: `test_bank`
- Legacy GET/POST compatibility remains tested.
- SYSTEM mutations require admin and an audit record.
- PERSONAL ownership is enforced at the Worker.
- Bulk import accepts at most 100 items and writes chunks of 25.
- SYSTEM delete is soft archive; PERSONAL behavior remains compatible with the legacy bank.

An isolated local D1 rehearsal applied migration `0060` once, reported no pending migration on the second run, backfilled one legacy row 1:1 and kept the rollout flag disabled. Full details are in `docs/testing/system-question-bank-backend-verification.md`.

## Frontend

Implemented surfaces:

- Typed V2 API client while preserving legacy service methods.
- Teacher modal with `Kho hệ thống` and `Kho của tôi` tabs.
- Server-side filters for keyword, grade, subject, semester, topic, lesson, type and difficulty.
- Server-side pagination with page sizes 30, 50 and 100.
- Copy SYSTEM question to PERSONAL with duplicate feedback.
- Add selected SYSTEM or PERSONAL questions to the quiz without reusing source IDs.
- Runtime flag fallback to the existing personal-only modal.
- Admin route `/teacher/system-question-bank`, protected by `AdminRoute`.
- Admin status totals, filtering, publish/archive actions and JSON bulk-import review.
- Admin navigation entry appears only when the rollout flag is enabled.

## Grade 5 Math Semester 1 dataset

Curriculum:

- Grade: 5
- Subject: MATH
- Semester: 1
- Topics: 6
- Lessons: 35
- Questions: 350
- Status: SYSTEM/DRAFT
- Source: CURATED_ORIGINAL

Topic counts:

```text
M5-S1-T01: 50
M5-S1-T02: 50
M5-S1-T03: 60
M5-S1-T04: 60
M5-S1-T05: 70
M5-S1-T06: 60
```

Every lesson contains:

```text
4 MCQ cơ bản
2 câu trả lời ngắn
1 bộ đúng/sai
1 câu tương tác
2 câu vận dụng
```

Difficulty distribution per lesson:

```text
4 câu mức 1
4 câu mức 2
2 câu mức 3
```

Validation results:

- 350/350 questions pass the saved `Question` schema.
- 0 canonical content-hash duplicates.
- 0 validator errors.
- 0 validator warnings.
- 92 directly parseable arithmetic expressions were independently recalculated with 0 mismatches.
- No curated item stores `explanation` or image fields.
- Committed topic JSON is exactly reproducible from the generator.

Artifacts:

- Curriculum: `data/question-bank/math5-semester1/curriculum.json`
- Topic files: `data/question-bank/math5-semester1/topic-01.json` through `topic-06.json`
- Manifest: `data/question-bank/math5-semester1/manifest.json`
- Review report: `reports/question-bank/math5-semester1-review.md`

Import safety:

- Default import mode is dry-run.
- Planned batches: `100, 100, 100, 50`.
- Execute mode requires `--execute`, API base URL and an authenticated session cookie.
- Execute mode preflights all six topics and aborts when existing SYSTEM questions are found unless an explicit reviewed override is supplied.
- Publication is dry-run by default and accepts one topic code at a time.

## Final quality gate

The production bundle placeholder-host gate uses `scripts/check-placeholder-hosts.mjs`; its regression tests distinguish real `.invalid` URLs/hostnames from JavaScript properties such as `summary.invalid`.

Commands and results:

```text
npm run lint
PASS

npm run typecheck
PASS

npm run typecheck:workers
PASS

npm run typecheck:question-bank
PASS

Focused Vitest feature suite
21 files passed
120 tests passed
0 failed

npm run build:frontend
PASS
4541 modules transformed

npm run security:scan
PASS
2120 tracked/unignored files checked

Cypress Chrome headless
2 tests passed
0 failed
```

Responsive E2E verified widths:

```text
390 px
768 px
1440 px
```

The admin table, filters and JSON import workflow did not create horizontal page overflow at the verified widths.

## Expected test log

One repository test intentionally supplies malformed legacy JSON and confirms the list endpoint skips that row instead of failing the page. The warning printed by that test is expected and is not a quality-gate failure.

## Production rollout still pending

The safe production sequence is:

1. Apply migration `0060` to production D1.
2. Deploy the Worker while keeping `system_question_bank_v1` disabled.
3. Deploy the frontend.
4. Run authenticated API smoke tests.
5. Import the 350 questions as SYSTEM/DRAFT in four batches.
6. Query counts and render representative samples from every topic.
7. Enable the flag for an admin/teacher allowlist.
8. Publish one topic at a time, beginning with `M5-S1-T01`.
9. Expand rollout only after monitoring and review.

No production step above is represented as completed in this document.
