# AI Quiz Schema Recovery — Implementation Record

**Goal:** Recover supported malformed AI quiz drafts within the existing one-repair budget and distinguish schema failures from explicitly truncated provider output.

**Constraints:** Preserve `buildPromptV3`, question schemas, action/source binding, quota policy and deterministic validation. Do not raise token limits, save partial quizzes, add retries, deploy, run migrations or enable the server rollout.

## Diagnosed gaps

- V3 parsed the initial draft before its repair branch, so a Zod failure exited immediately.
- The browser response facade discarded explicit OpenAI/Gemini completion metadata.
- Personal-provider dispatch inspected `finish_reason` only when content was empty.
- Schema failures were collapsed into one generic message without safe question/field detail.
- REVIEW cancellation was swallowed by the best-effort reviewer fallback.

The original production incident remains unconfirmed because its provider response and finish metadata are unavailable. Ten questions or six selected types alone is not evidence of token exhaustion.

## Implemented scope

1. V3 initial schema recovery
   - Catch only Zod schema failures.
   - Use one `REPAIR` request for `QUIZ_CREATE` with the original action, source, signal and V3 diagnostics.
   - Require a complete V3 blueprint response.
   - Share the existing one-repair budget with slot repair; never call both.
   - Keep REVIEW best-effort, except cancellation is propagated.

2. Safe user errors
   - Summarize at most three unique 1-based question indexes.
   - Use only allowlisted field labels.
   - Never expose raw Zod messages, provider JSON, question content or unknown paths.

3. Explicit truncation classification
   - OpenAI-compatible: `finish_reason: length`.
   - Gemini: `finishReason: MAX_TOKENS`.
   - Inspect JSON, terminal SSE, personal BYOK dispatch and server system transport.
   - Missing metadata remains unclassified; no automatic retry or token-limit change.
   - Stable message: `Phản hồi AI bị cắt do giới hạn đầu ra. Hãy thử tạo ít câu hơn trong một lần.`

4. Integration fixture
   - Ten questions, six types: MCQ, TRUE_FALSE, SHORT_ANSWER, MATCHING, DRAG_DROP and CATEGORIZATION.
   - Difficulty distribution 3 easy, 5 medium, 2 hard.
   - One initial schema-invalid question repaired once, then fully validated.

## TDD and verification evidence

- RED: `tests/quizGenerationPipelineV3.test.ts` — three initial-schema cases failed before reaching REPAIR.
- GREEN: focused Vitest gate on current `origin/main` — 11 files, 86 tests passed.
- Frontend TypeScript: passed.
- Worker TypeScript: passed after installing the Worker lockfile dependencies.
- Cypress V2 (Blueprint V3 off): 6/6 passed.
- Cypress Blueprint V3: 4/4 passed, including the ten-question/six-type recovery case.
- Full Vitest gate on current `origin/main`: all 4 shards passed (171 files per shard; 3,825 tests total).
- Strict TypeScript, ESLint, production build and Worker deployment dry-run: passed.
- Security gates: passed; root and Worker production dependency audits reported zero findings.
- Final whitespace check and GitNexus `detect_changes`: passed with task-only scope and LOW risk.

Production deployment is explicitly out of scope for this change set.

## Rollback

Revert the focused commit or previous immutable frontend/Worker deployment. No schema migration or data rollback is required. Keep the server rollout flag off until a separately approved canary.
