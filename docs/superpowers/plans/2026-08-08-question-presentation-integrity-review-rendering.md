# Question Presentation Integrity & Historical Review Rendering Implementation Plan

**Status:** COMPLETED + MERGED + RELEASED — PR #92, merge `406973f`, production rollout 2026-08-09.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khóa tính nhất quán server-side giữa `question` và `questionRichText`, bảo toàn rich presentation trong snapshot kết quả lịch sử, rồi dùng cùng `QuestionRichTextRenderer` cho teacher review và student result review mà không thay đổi scoring hoặc D1 schema.

**Architecture:** Giữ Question Presentation v1 (`question` + `question_rich_text`) theo ADR-001. Rich document là nguồn authoring/presentation khi tồn tại; Worker validate rich riêng, derive plain prompt, loại presentation JSON khỏi semantic clone, rồi mới chạy math normalization/validation và scoring trên semantic data. Shared rich renderer phải ghép math delimiter qua ranh giới text-node trước khi giao cho `MathSpan`, để Tiptap marks không làm vỡ công thức. Result snapshot là dữ liệu lịch sử authoritative: snapshot có rich thì dùng rich của snapshot; snapshot cũ không có rich thì fallback plain snapshot, tuyệt đối không mượn rich hiện tại của quiz. Review surfaces chỉ đổi renderer của prompt; answer correctness vẫn dùng contract server hiện hành.

**Tech Stack:** React 19, TypeScript 5.8, `QuestionRichTextEnvelopeV1`, `QuestionRichTextRenderer`, `MathSpan`, Cloudflare Worker/D1 hiện tại, Vitest, Testing Library, Cypress.

## Global Constraints

- Không tạo migration D1 mới; dùng `question_rich_text` từ migration `0064_add_question_rich_text.sql`.
- Không đổi `QUIZ_SCORING_ENGINE_VERSION = 2.0.0` hoặc `QUIZ_ANSWER_SCHEMA_VERSION = 2`.
- Không thay grading logic trong `src/domain/quiz-scoring`.
- Không bulk-backfill câu hỏi hoặc result snapshot cũ.
- Plain-only legacy question phải tiếp tục save/load/render như trước.
- Result snapshot lịch sử luôn có precedence cao hơn current quiz presentation.
- Không đưa `questionRichText` / `question_rich_text` vào recursive semantic math normalization; rich schema được validate riêng, math được validate trên plain projection đã ghép hoàn chỉnh.
- D1 giới hạn string/BLOB/table row ở 2.000.000 bytes; Phase 1 chỉ giữ rich snapshots khi **final serialized `results.answers` candidate có rich** `<= 1_500_000` UTF-8 bytes để chừa headroom. Vượt ngưỡng phải rebuild toàn bộ snapshots về plain historical, không được làm submission thất bại và không áp một hard cap mới lên legacy/plain-only results.
- Không log question text, TeX source hoặc serialized rich JSON trong observability event.
- Không dùng `dangerouslySetInnerHTML`.
- Không mở rộng rich text sang option/explanation/type-specific fields trong plan này.
- Trước khi sửa `mapQuestionForSave()` hoặc grading snapshot loader, rerun GitNexus impact trong worktree thực thi.
- Main branch protection/PR/review/checks vẫn áp dụng; không bypass.
- Production deploy là gate riêng sau implementation + review + verification.

---

## Dependency graph

```text
Task 1 — Typed Presentation v1 + deterministic plain projection
       |
       v
Task 2 — Server-owned rich -> semantic plain; exclude rich JSON from math walk
       |
       v
Task 3 — Content-free drift observability
       |
       v
Checkpoint A
       |
       v
Task 4 — Harden shared rich renderer across math/text-node boundaries
       |
       v
Task 5 — Authoritative result snapshots + D1-aware final answers budget
       |
       v
Task 6 — Historical snapshot presentation precedence
       |
       v
Task 7 — Teacher review renderer
       |
       v
Task 8 — Student review renderer
       |
       v
Checkpoint B
       |
       v
Task 9 — Browser/E2E
       |
       v
Task 10 — Full gates
```

Tasks 4–8 remain separately reviewable commits, but downstream review surfaces depend on Task 4's shared renderer contract. Browser verification waits for Tasks 4–8.

---

## File map

### Shared presentation/domain contracts

- `shared/question-rich-text.contract.ts`
  - owns validation, serialization, `richTextToPlainText`, `plainTextToRichText`.
- `src/types/domain.types.ts`
  - owns frontend `Question`, `QuestionMetadata`, `QuestionSnapshot`.
- `workers/src/types.ts`
  - owns persisted Worker question row shape.

### Worker write path

- `workers/src/utils/helpers.ts`
  - `mapQuestionForSave()` serializes D1 row and invokes math/scoring normalization.
- `workers/src/services/questionMath.ts`
  - owns current `normalizeIncomingQuestion()` / `prepareIncomingQuestion()` behavior.

### Shared rich rendering path

- `src/components/common/QuestionRichTextRenderer.tsx`
  - currently renders each rich `text` node through its own `MathSpan`; Phase 1 must make delimited math span-safe across adjacent marked text nodes.
- `src/utils/mathText.ts`
  - owns `splitMathSegments()` and math delimiter segmentation.

### Authoritative result snapshot path

- `workers/src/services/quizGradingService.ts`
  - explicit grading SELECT and `buildAuthoritativeStoredAnswers()`.
- `workers/src/services/liveExamQuestionMapper.ts`
  - already deserializes `question_rich_text` when the selected row contains it.

### Teacher historical review

- `src/components/teacher/ResultsView/student-detail/models/questionModel.ts`
  - merges current quiz data with stored result snapshots.
- `src/components/common/QuestionReview/index.tsx`
- `src/components/common/QuestionReview/QuestionReview.css`

### Student historical/immediate review

- `src/features/student-dashboard/model/assignmentModel.ts`
  - already chooses result snapshot before current quiz question.
- `src/components/student/ResultScreen/tabs/ReviewTab.tsx`

### Primary tests

- `tests/QuestionRichTextContract.test.ts`
- `tests/QuestionRichTextRenderer.test.tsx`
- `tests/quizRoutes.authoringFields.worker.test.ts`
- `tests/quizGradingService.worker.test.ts`
- `tests/studentDetailModels.test.ts`
- `tests/studentDashboardModel.test.ts`
- `tests/QuestionReview.test.tsx`
- `tests/StudentResultScreen.test.tsx`
- Create: `cypress/e2e/result-rich-text-review.cy.ts`

---

# Slice A — Presentation integrity

### Task 1: Make Presentation v1 a typed domain contract and lock plain projection

**Files:**
- Modify: `shared/question-rich-text.contract.ts:199-255`
- Modify: `src/types/domain.types.ts:1-320`
- Modify: `workers/src/types.ts`
- Modify: `tests/QuestionRichTextContract.test.ts`

**Interfaces:**

Produces:

```ts
export const normalizeQuestionPlainText = (value: string): string;
export const deriveQuestionPlainText = (value: QuestionRichTextEnvelopeV1): string;
```

Adds presentation metadata to the shared question domain:

```ts
interface QuestionMetadata {
  questionRichText?: QuestionRichTextEnvelopeV1;
}

interface QuestionSnapshot {
  questionRichText?: QuestionRichTextEnvelopeV1;
}
```

Worker persisted/mapped type may expose:

```ts
question_rich_text?: string;
questionRichText?: QuestionRichTextEnvelopeV1;
```

`normalizeQuestionPlainText()` normalizes only line endings (`CRLF/CR -> LF`). It MUST NOT trim, collapse whitespace, add list markers or rewrite TeX.

- [ ] **Step 1: Write RED contract tests**

Add:

```ts
it('derives plain text from rich content without trimming or rewriting TeX', () => {
  const rich = plainTextToRichText('  Dòng 1\r\n$24 \\div 6$  ');
  expect(deriveQuestionPlainText(rich)).toBe('  Dòng 1\n$24 \\div 6$  ');
});

it('normalizes only CRLF/CR line endings', () => {
  expect(normalizeQuestionPlainText('  A\r\nB\rC  ')).toBe('  A\nB\nC  ');
});
```

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/QuestionRichTextContract.test.ts --maxWorkers=1
```

Expected: FAIL because the exported helpers do not exist.

- [ ] **Step 3: Implement minimal helpers**

```ts
export const normalizeQuestionPlainText = (value: string): string =>
  String(value ?? '').replace(/\r\n?/g, '\n');

export const deriveQuestionPlainText = (value: QuestionRichTextEnvelopeV1): string =>
  normalizeQuestionPlainText(richTextToPlainText(value));
```

- [ ] **Step 4: Add the optional typed presentation fields**

In `src/types/domain.types.ts`, import the contract type and add `questionRichText?` to `QuestionMetadata` and `QuestionSnapshot`.

In `workers/src/types.ts`, add only the optional persisted/mapped rich fields; do not change existing required columns.

- [ ] **Step 5: Verify**

```bash
npx vitest run tests/QuestionRichTextContract.test.ts --maxWorkers=1
npm run typecheck
npm run typecheck:workers
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/question-rich-text.contract.ts src/types/domain.types.ts workers/src/types.ts tests/QuestionRichTextContract.test.ts
git commit -m "refactor: type question presentation contract"
```

---

### Task 2: Make Worker derive the authoritative plain prompt from rich content

**Files:**
- Modify: `workers/src/utils/helpers.ts:15-180`
- Modify: `tests/quizRoutes.authoringFields.worker.test.ts`

**Interfaces:**

Consumes:

```ts
parseQuestionRichText
serializeQuestionRichText
deriveQuestionPlainText
normalizeQuestionPlainText
normalizeIncomingQuestion
prepareIncomingQuestion
```

Produces internal shape:

```ts
interface PreparedQuestionPresentation {
  question: Partial<Question> & { type: string };
  questionRichTextField: string;
  submittedPlainPrompt?: string;
}
```

Required behavior:

1. no rich field -> legacy question object remains authoritative;
2. invalid rich -> existing `QuestionRichTextValidationError`;
3. valid rich -> derive raw plain prompt from validated rich document;
4. create a **semantic clone** that explicitly removes `questionRichText` and `question_rich_text` before recursive math normalization;
5. `TRUE_FALSE` -> write derived prompt into both `mainQuestion` and `question` on the semantic clone;
6. other types -> write derived prompt into `question`;
7. never mutate caller object or canonical rich JSON;
8. run `prepareIncomingQuestion()` only on the semantic clone after rich -> plain projection, so math validation sees the complete flattened formula rather than individual rich text-node fragments;
9. persist the validated rich JSON separately from the normalized/scored semantic object;
10. compare client echo only after current math normalization, not raw string comparison.

- [ ] **Step 1: Write RED authority tests**

```ts
it('persists the rich-derived prompt instead of a stale plain echo', () => {
  const rich = plainTextToRichText('Nội dung từ rich');
  const mapped = mapQuestionForSave({
    id: 'q-drift',
    type: 'MCQ',
    question: 'Nội dung stale',
    questionRichText: rich,
    options: ['A', 'B'],
    correctAnswer: 'A',
  } as any, 'quiz-a');

  expect(mapped[3]).toBe('Nội dung từ rich');
  expect(JSON.parse(mapped[4])).toEqual(rich);
});

it('uses rich content as the TRUE_FALSE main prompt authority', () => {
  const rich = plainTextToRichText('Đọc dữ kiện rich');
  const mapped = mapQuestionForSave({
    id: 'tf-rich',
    type: 'TRUE_FALSE',
    mainQuestion: 'Stale main',
    question: 'Stale question',
    questionRichText: rich,
    items: [{ id: 'tf-1', statement: 'Mệnh đề', isCorrect: true }],
  } as any, 'quiz-a');

  expect(mapped[3]).toBe('Đọc dữ kiện rich');
});
```

- [ ] **Step 2: Write RED math-authority test**

Use the same malformed formula family already covered by math-observability tests:

```ts
it('validates math from rich-derived prompt instead of trusting a benign plain echo', () => {
  const rich = plainTextToRichText('Tính $\\frac{1}{2');
  expect(() => mapQuestionForSave({
    id: 'q-math-rich',
    type: 'MCQ',
    question: '2 + 2 = ?',
    questionRichText: rich,
    options: ['4', '5'],
    correctAnswer: 'A',
  } as any, 'quiz-a')).toThrow();
});
```

- [ ] **Step 3: Add RED split-rich-math semantic-boundary tests**

Construct a valid rich paragraph whose single inline expression `\(x^2\)` is split across adjacent text nodes because the middle `x` carries a bold mark. Assert `mapQuestionForSave()` accepts it because `deriveQuestionPlainText()` reconstructs one complete delimiter-balanced formula before semantic math validation. Assert the persisted rich JSON remains structure-equivalent to the validated input.

Add the inverse malformed case where the **flattened** rich plain projection has an unclosed delimiter and assert it still raises the existing math validation error. This proves semantic math validation does not recursively validate presentation text-node fragments.

- [ ] **Step 4: Run RED**

```bash
npx vitest run tests/quizRoutes.authoringFields.worker.test.ts --maxWorkers=1
```

Expected: authority tests fail under current behavior; the split-node regression defines the semantic/presentation boundary.

- [ ] **Step 5: Refactor rich parsing/serialization into one validated preparation path**

Implement semantics equivalent to:

```ts
const getSubmittedPlainPrompt = (input: Record<string, unknown>): string | undefined => {
  const keys = String(input.type || '').toUpperCase() === 'TRUE_FALSE'
    ? ['mainQuestion', 'question']
    : ['question', 'mainQuestion'];
  for (const key of keys) {
    if (input[key] !== undefined && input[key] !== null) return String(input[key]);
  }
  return undefined;
};
```

Validated rich content must be serialized from the parsed allowlisted envelope, not from unchecked input.

- [ ] **Step 6: Project rich plain into a semantic-only clone before math/scoring normalization**

`mapQuestionForSave()` order becomes:

```text
validate/parse rich
-> derive full plain prompt
-> capture serialized validated rich field separately
-> clone input
-> delete questionRichText + question_rich_text from semantic clone
-> replace semantic prompt (question; plus mainQuestion for TRUE_FALSE)
-> prepareIncomingQuestion(semantic clone)
-> prepareQuestionScoringContractForSave()
-> serialize D1 fields + separately prepared rich field
```

The load-bearing rule is that `prepareIncomingQuestion()` must never walk the structured presentation JSON. `normalizeQuestionMath()` recursively visits strings, so leaving rich JSON attached can falsely treat Tiptap-split math fragments as independent formulas and can mutate presentation data.

Do not change the 27-column order.

- [ ] **Step 7: Normalize client echo for comparison without making it authoritative**

Use current math normalization without throwing on client echo:

```ts
const normalizePlainEchoForComparison = (value: string): string => {
  const { normalized } = normalizeIncomingQuestion({
    question: normalizeQuestionPlainText(value),
  });
  return normalizeQuestionPlainText(String((normalized as { question?: unknown }).question ?? ''));
};
```

The complete rich-derived **plain projection** goes through `prepareIncomingQuestion()` and therefore remains validated; structured rich nodes do not.

- [ ] **Step 8: Preserve legacy behavior test**

```ts
expect(mapQuestionForSave({
  id: 'q-old', type: 'MCQ', question: 'Câu cũ', options: ['A', 'B'], correctAnswer: 'A',
}, 'quiz-a')[3]).toBe('Câu cũ');
```

- [ ] **Step 9: Run GREEN**

```bash
npx vitest run tests/quizRoutes.authoringFields.worker.test.ts tests/QuestionRichTextContract.test.ts --maxWorkers=2
npm run typecheck:workers
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add workers/src/utils/helpers.ts tests/quizRoutes.authoringFields.worker.test.ts
git commit -m "fix: make rich question prompt server authoritative"
```

---

### Task 3: Add content-free drift observability without math-normalization false positives

**Files:**
- Modify: `workers/src/utils/helpers.ts`
- Modify: `tests/quizRoutes.authoringFields.worker.test.ts`

**Interfaces:**

Emit only:

```json
{
  "event": "question_rich_text_plain_mismatch",
  "questionType": "MCQ"
}
```

No question ID, content, TeX source, serialized JSON, user name or answer data is required.

- [ ] **Step 1: Write RED mismatch event test**

Spy on `console.info`, submit one real semantic mismatch, and assert exactly one metadata-only event.

- [ ] **Step 2: Write RED no-noise tests**

Case A — matching rich/plain:

```text
rich-derived = "Nội dung A"
client echo  = "Nội dung A"
```

Expected: no mismatch event.

Case B — plain omitted:

```text
questionRichText present
question/mainQuestion omitted
```

Expected: no mismatch event.

Case C — mathematically equivalent after current normalization:

```text
rich raw text = Tính \frac{1}{2}
client plain  = Tính $\frac{1}{2}$
```

Expected: no mismatch event after normalization.

- [ ] **Step 3: Run RED**

```bash
npx vitest run tests/quizRoutes.authoringFields.worker.test.ts --maxWorkers=1
```

Expected: event behavior not yet implemented.

- [ ] **Step 4: Emit after authoritative math normalization**

Compute mismatch against final normalized persisted prompt, not raw rich-derived text.

- [ ] **Step 5: Verify GREEN**

```bash
npx vitest run tests/quizRoutes.authoringFields.worker.test.ts --maxWorkers=1
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add workers/src/utils/helpers.ts tests/quizRoutes.authoringFields.worker.test.ts
git commit -m "chore: observe rich question presentation drift"
```

---

## Checkpoint A — Integrity gate

Run:

```bash
npx vitest run tests/QuestionRichTextContract.test.ts tests/quizRoutes.authoringFields.worker.test.ts --maxWorkers=2
npm run typecheck
npm run typecheck:workers
```

Expected: PASS.

Also verify:

- no migration file added;
- 27-column question INSERT order unchanged;
- scoring version unchanged;
- no content-bearing drift log.

Do not start shared-renderer or result-snapshot changes if this checkpoint is red.

---

# Slice B — Shared rich renderer hardening

### Task 4: Preserve delimited math across rich text-node/mark boundaries

**Why this task is required:** `QuestionRichTextRenderer` currently calls `MathSpan` once per rich `text` node. Tiptap can split one logical TeX expression into multiple text nodes when a teacher applies Bold/Color/Highlight to only part of the expression. A valid inline expression using `\(x^2\)` can therefore be split into delimiter/text fragments; feeding those fragments independently to MathJax breaks the formula. Because this renderer is already used by manual preview and the student player, harden it before adding more review/result surfaces.

**Files:**
- Modify: `src/components/common/QuestionRichTextRenderer.tsx`
- Modify: `tests/QuestionRichTextRenderer.test.tsx`

**Interfaces:**

Keep the persisted contract unchanged. Do not add a math node. Use existing `splitMathSegments()` from `src/utils/mathText.ts` over the **full inline source stream** for each paragraph/list paragraph.

Implementation contract:

1. collect adjacent inline `text`/`hardBreak` source runs with their marks and source offsets;
2. concatenate text for the paragraph/list paragraph and run `splitMathSegments()` once across that complete inline source;
3. ordinary text segments are re-sliced back to source runs so existing marks remain exact;
4. a math segment spanning multiple source text nodes is emitted as **one** `MathSpan` with the complete delimiter-balanced raw math string;
5. marks applied to the whole math segment may wrap that `MathSpan`; if marks differ inside the formula, apply only the intersection of marks common to every contributing text run — math correctness takes precedence over partial internal styling;
6. `hardBreak` remains a structural `<br>` boundary and must not be silently folded into a delimited inline formula;
7. no `dangerouslySetInnerHTML`, no raw HTML parsing, no persisted-schema change.

- [ ] **Step 1: Write RED cross-node math test**

Use one paragraph where an inline `\(x^2\)` expression is split across three adjacent rich text nodes and the middle node has `bold`. Mock/spy `MathSpan` so the test asserts it receives one complete delimiter-balanced math segment, never independent delimiter fragments.

- [ ] **Step 2: Add mark-semantics tests**

Cover:

- full formula has the same `bold` mark on every contributing run -> whole rendered formula remains bold;
- only the middle run is bold -> formula remains intact and partial internal bold is intentionally not applied across the math segment;
- marks outside the formula remain unchanged;
- invalid/unsupported rich JSON still falls back to the existing plain `MathSpan` path.

- [ ] **Step 3: Run RED**

```bash
npx vitest run tests/QuestionRichTextRenderer.test.tsx --maxWorkers=1
```

Expected: cross-node math segmentation assertion fails under the current per-node renderer.

- [ ] **Step 4: Implement paragraph-level mixed rich/math segmentation**

Use `splitMathSegments()` as the existing delimiter authority. Keep helper logic local to `QuestionRichTextRenderer.tsx` in this task; do not create a second generic rich-content framework unless implementation evidence requires it.

- [ ] **Step 5: Run GREEN + existing math renderer regression**

```bash
npx vitest run tests/QuestionRichTextRenderer.test.tsx tests/SafeFormattedText.test.tsx tests/mathRenderingWebSurfaces.test.tsx --maxWorkers=2
npm run typecheck
```

Expected: PASS. Existing legacy HTML-like strong/emphasis plus math handling must remain green; this task is for structured-rich node boundaries, not a rewrite of `SafeFormattedText`.

- [ ] **Step 6: Commit**

```bash
git add src/components/common/QuestionRichTextRenderer.tsx tests/QuestionRichTextRenderer.test.tsx
git commit -m "fix: preserve math across rich text boundaries"
```

---

# Slice C — Historical result presentation

### Task 5: Preserve rich presentation in authoritative snapshots with a D1-aware final answers budget

**Why this task is required:** `buildAuthoritativeStoredAnswers()` creates result snapshots from `loadQuizQuestionsForGrading()`. The current explicit `QUESTION_COLUMNS` list omits `question_rich_text`, so even post-release submissions lose rich presentation in stored historical snapshots unless this is fixed. At the same time, Cloudflare D1 limits the maximum string/BLOB/table row size to 2,000,000 bytes. A fixed 1 MB rich-only allowance is unsafe if the existing plain `results.answers` payload is already large.

**D1-aware budget for Phase 1:**

```ts
export const MAX_RESULT_ANSWERS_WITH_RICH_BYTES = 1_500_000;
```

This limit applies only to the **final UTF-8 byte size of the serialized authoritative answers candidate that contains rich snapshots**. It intentionally leaves about 500 KB of headroom below D1's 2 MB row/string ceiling for other row columns and storage overhead.

It is **not** a new hard limit on legacy/plain-only result answers. If a plain-only result is already larger than 1.5 MB, Phase 1 preserves current behavior; it simply does not add rich snapshot data.

**Files:**
- Modify: `workers/src/services/quizGradingService.ts:37-145`
- Characterize only: `workers/src/services/liveExamQuestionMapper.ts:35-60` (already deserializes the field; production change only if characterization disproves this)
- Modify: `tests/quizGradingService.worker.test.ts`

**Interfaces:**

`loadQuizQuestionsForGrading()` must return mapped questions containing optional `questionRichText` when D1 row has valid `question_rich_text`.

Add:

```ts
export const MAX_RESULT_ANSWERS_WITH_RICH_BYTES = 1_500_000;

const utf8ByteLength = (value: string): number =>
  new TextEncoder().encode(value).byteLength;
```

`buildAuthoritativeStoredAnswers()` continues stripping correctness fields. It first builds the same safe snapshot shape it creates today, including parsed `questionRichText` where available, then measures the **final serialized answers object**, not isolated rich fields.

If the budget is exceeded:

- submission/grading MUST continue successfully;
- remove `questionRichText` from **all** stored question snapshots for that result so historical presentation is deterministic rather than partially rich;
- keep historical plain `question` and all existing safe snapshot fields;
- emit only metadata:

```json
{
  "event": "result_rich_snapshot_budget_exceeded",
  "questionCount": 300,
  "candidateAnswersBytes": 1600123,
  "plainAnswersBytes": 842311,
  "limitBytes": 1500000
}
```

Do not log rich content, question text, IDs, answers or user data.

- [ ] **Step 1: Write RED grading-loader/snapshot test**

Add a D1 mock row with:

```ts
question_rich_text: JSON.stringify(plainTextToRichText('Rich historical prompt')),
```

Grade a submission, build stored answers, then assert:

```ts
const snapshot = (stored.q1 as any).questionSnapshot;
expect(snapshot.questionRichText).toEqual(plainTextToRichText('Rich historical prompt'));
expect(JSON.stringify(snapshot)).not.toMatch(
  /correctAnswer|correctAnswers|correctOrder|correctWordIndexes|correctWord|categoryId/
);
```

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/quizGradingService.worker.test.ts --maxWorkers=1
```

Expected: snapshot lacks `questionRichText` because the SELECT omits `question_rich_text`.

- [ ] **Step 3: Add the existing column to the grading SELECT**

Change `QUESTION_COLUMNS` from:

```text
id, type, question, options, ...
```

to:

```text
id, type, question, question_rich_text, options, ...
```

No D1 schema change is involved.

- [ ] **Step 4: Verify mapper behavior**

`mapLiveExamQuestionRow()` already calls:

```ts
deserializeQuestionRichText(row.question_rich_text ?? row.questionRichText)
```

If the new test passes after SELECT change, do not alter the mapper.

- [ ] **Step 5: Add invalid-stored-rich fallback test**

A malformed `question_rich_text` loaded from D1 must produce a plain snapshot without crashing grading or persisting unchecked rich JSON.

- [ ] **Step 6: Write RED final-answers-budget tests**

Test the actual serialized `results.answers` candidate on both sides of the threshold:

```ts
it('keeps rich snapshots when final answers-with-rich stays within 1.5 MB', () => {
  const stored = buildAuthoritativeStoredAnswers(withinBudgetQuestions, answers, details);
  expect(new TextEncoder().encode(JSON.stringify(stored)).byteLength)
    .toBeLessThanOrEqual(MAX_RESULT_ANSWERS_WITH_RICH_BYTES);
  expect(Object.values(stored).some((entry: any) =>
    entry.questionSnapshot.questionRichText !== undefined,
  )).toBe(true);
});

it('degrades all snapshots when final answers-with-rich exceeds 1.5 MB', () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const stored = buildAuthoritativeStoredAnswers(overBudgetQuestions, answers, details);

  expect(Object.values(stored).every((entry: any) =>
    entry.questionSnapshot.questionRichText === undefined,
  )).toBe(true);
  expect(Object.values(stored).every((entry: any) =>
    typeof entry.questionSnapshot.question === 'string',
  )).toBe(true);
  expect(info).toHaveBeenCalledWith(expect.stringContaining('result_rich_snapshot_budget_exceeded'));
});
```

Add a third characterization: a large plain-only candidate above 1.5 MB must not be rejected by this helper or gain a new Phase-1 error path. Generate large fixtures in-memory; do not check in giant JSON files.

- [ ] **Step 7: Implement two-pass all-or-nothing snapshot projection**

1. Build the correctness-stripped candidate with rich snapshots.
2. Measure its final serialized UTF-8 byte length.
3. If the candidate is at or below `MAX_RESULT_ANSWERS_WITH_RICH_BYTES`, return it.
4. Otherwise rebuild/clone all snapshots without `questionRichText`, measure the plain serialized size, emit one metadata-only budget event, and return the plain historical result.

Do not partially retain rich snapshots. Do not reject a submission merely because the Phase-1 rich candidate crosses the budget.

- [ ] **Step 8: Verify no answer-leak regression**

Keep the existing assertion that serialized snapshots do not contain:

```text
correctAnswer
correctAnswers
correctOrder
correctWordIndexes
correctWord
categoryId
```

and add `question_rich_text` raw storage key to the forbidden set; only parsed `questionRichText` may appear under budget.

- [ ] **Step 9: Run GREEN**

```bash
npx vitest run tests/quizGradingService.worker.test.ts --maxWorkers=1
npm run typecheck:workers
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add workers/src/services/quizGradingService.ts tests/quizGradingService.worker.test.ts
git commit -m "fix: preserve rich prompt in result snapshots"
```

---

### Task 6: Enforce historical snapshot presentation precedence

**Files:**
- Modify: `src/components/teacher/ResultsView/student-detail/models/questionModel.ts`
- Modify: `tests/studentDetailModels.test.ts`
- Modify: `tests/studentDashboardModel.test.ts`

**Historical invariant:**

```text
snapshot exists + snapshot has rich
    -> use snapshot rich

snapshot exists + snapshot lacks rich
    -> use snapshot plain only
    -> DO NOT inherit current quiz rich

no snapshot
    -> current quiz rich/plain may be used
```

This prevents a quiz edited after submission from visually changing a historical result.

- [ ] **Step 1: Write RED teacher-model historical-fidelity test**

Fixture:

```ts
const currentQuestion = {
  id: 'q1',
  type: QuestionType.MCQ,
  question: 'Nội dung hiện tại',
  questionRichText: plainTextToRichText('Rich hiện tại'),
  options: ['A', 'B'],
  correctAnswer: 'A',
};

const result = {
  answers: {
    q1: {
      selectedAnswer: 'A',
      questionSnapshot: {
        id: 'q1',
        type: QuestionType.MCQ,
        question: 'Nội dung lúc nộp',
        options: ['A', 'B'],
      },
    },
  },
} as any;

const [display] = buildDisplayQuestions(result, [currentQuestion as any]);
expect(display.question).toBe('Nội dung lúc nộp');
expect(display.questionRichText).toBeUndefined();
```

Expected RED: current spread order can retain `questionRichText` from the current quiz.

- [ ] **Step 2: Add rich-snapshot preservation test**

If snapshot contains its own `questionRichText`, that exact snapshot value must win over current quiz presentation.

- [ ] **Step 3: Implement explicit presentation precedence**

After current/snapshot spreads, set:

```ts
questionRichText: snapshot
  ? snapshot.questionRichText
  : fromQuiz?.questionRichText,
```

Do not alter answer/scoring precedence.

- [ ] **Step 4: Characterize student assignment review**

`buildAssignmentReviewQuiz()` already chooses:

```ts
getQuestionSnapshot(answers[questionId]) ?? currentQuestions.get(questionId)
```

Add tests proving:

1. rich snapshot is preserved;
2. legacy snapshot does not inherit current rich;
3. current rich is used only when no snapshot exists.

Do not modify `assignmentModel.ts` if these tests pass.

- [ ] **Step 5: Run GREEN**

```bash
npx vitest run tests/studentDetailModels.test.ts tests/studentDashboardModel.test.ts --maxWorkers=2
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/teacher/ResultsView/student-detail/models/questionModel.ts tests/studentDetailModels.test.ts tests/studentDashboardModel.test.ts
git commit -m "fix: preserve historical question presentation in results"
```

---

# Slice D — Shared review rendering

### Task 7: Render rich prompt in teacher `QuestionReview`

**Files:**
- Modify: `src/components/common/QuestionReview/index.tsx`
- Modify: `src/components/common/QuestionReview/QuestionReview.css`
- Modify: `tests/QuestionReview.test.tsx`

**Interfaces:**

Consumes typed `question.questionRichText?: QuestionRichTextEnvelopeV1`.

Keeps unchanged:

- `QuestionReviewProps`;
- `checkAnswer()` behavior;
- `ReviewMap`;
- answer template props;
- explanation behavior.

- [ ] **Step 1: Write RED rich-header test**

Use a question whose rich prompt has centered bold TeX and whose plain fallback differs:

```ts
question: 'Plain fallback',
questionRichText: {
  schemaVersion: 1,
  doc: {
    type: 'doc',
    content: [{
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [{ type: 'text', text: 'Rich $x^2$', marks: [{ type: 'bold' }] }],
    }],
  },
},
```

Assert:

- `[data-testid="question-rich-text-renderer"]` exists;
- `<strong>` contains `Rich`;
- plain fallback is not shown as prompt;
- existing status/answer assertions still pass.

- [ ] **Step 2: Keep/add legacy fallback test**

A question without `questionRichText` continues through current `MathContent` path.

- [ ] **Step 3: Run RED**

```bash
npx vitest run tests/QuestionReview.test.tsx --maxWorkers=1
```

Expected: rich renderer assertion fails.

- [ ] **Step 4: Implement prompt-only renderer selection**

Semantics:

```tsx
{question.questionRichText ? (
  <QuestionRichTextRenderer
    value={question.questionRichText}
    fallback={questionText}
    className="question-text-inline"
  />
) : (
  <MathContent content={questionText} className="question-text-inline" />
)}
```

- [ ] **Step 5: Make review header safe for block rich content**

At minimum:

```css
.question-header-content {
  align-items: flex-start;
  min-width: 0;
}

.question-text-inline {
  flex: 1;
  min-width: 0;
}
```

Do not flatten paragraphs/lists to force a single-line header.

- [ ] **Step 6: Run GREEN**

```bash
npx vitest run tests/QuestionReview.test.tsx tests/QuestionRichTextRenderer.test.tsx --maxWorkers=2
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/common/QuestionReview/index.tsx src/components/common/QuestionReview/QuestionReview.css tests/QuestionReview.test.tsx
git commit -m "feat: render rich prompts in teacher result review"
```

---

### Task 8: Render rich prompt in student Result `ReviewTab`

**Files:**
- Modify: `src/components/student/ResultScreen/tabs/ReviewTab.tsx`
- Modify: `tests/StudentResultScreen.test.tsx`

**Interfaces:**

Consumes typed `question.questionRichText` from either current quiz (immediate result) or historical snapshot quiz (assignment review).

Keeps unchanged:

- `getStoredAnswerOutcome()`;
- server `reviewDetails` precedence;
- `buildQuestionAnswerReview()` fallback;
- `ReviewValue` answer rendering;
- answer visibility policy.

- [ ] **Step 1: Write RED rich review test**

Add one rich MCQ fixture and assert:

```ts
expect(screen.getByTestId('question-rich-text-renderer')).toBeInTheDocument();
expect(screen.getByText(/Rich/).closest('strong')).not.toBeNull();
```

Also assert supplied server review details still control the answer rows.

- [ ] **Step 2: Add legacy snapshot fallback case**

A historical question with plain TeX but no rich presentation must still render via `MathSpan` and must not borrow a current rich prompt.

- [ ] **Step 3: Run RED**

```bash
npx vitest run tests/StudentResultScreen.test.tsx --maxWorkers=1
```

Expected: rich prompt assertion fails.

- [ ] **Step 4: Replace prompt-only branch**

Replace current prompt `MathSpan` with:

```tsx
{question.questionRichText ? (
  <QuestionRichTextRenderer
    value={question.questionRichText}
    fallback={questionText}
    className="mt-3 font-semibold leading-relaxed text-slate-900"
  />
) : (
  <MathSpan
    content={questionText}
    as="p"
    className="mt-3 font-semibold leading-relaxed text-slate-900"
  />
)}
```

- [ ] **Step 5: Run GREEN**

```bash
npx vitest run tests/StudentResultScreen.test.tsx tests/QuestionReview.test.tsx tests/QuestionRichTextRenderer.test.tsx --maxWorkers=2
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/student/ResultScreen/tabs/ReviewTab.tsx tests/StudentResultScreen.test.tsx
git commit -m "feat: render rich prompts in student result review"
```

---

## Checkpoint B — Historical/rendering parity gate

Run:

```bash
npx vitest run \
  tests/quizGradingService.worker.test.ts \
  tests/studentDetailModels.test.ts \
  tests/studentDashboardModel.test.ts \
  tests/QuestionReview.test.tsx \
  tests/StudentResultScreen.test.tsx \
  tests/QuestionRichTextRenderer.test.tsx \
  --maxWorkers=2
```

Expected: PASS.

Verify these four fixtures explicitly:

1. new result snapshot with rich prompt;
2. legacy result snapshot without rich prompt;
3. current quiz edited after legacy snapshot — review still shows snapshot plain;
4. same-session result with rich prompt — rich formatting preserved.

Do not proceed to browser verification if any historical-fidelity test is red.

---

# Slice E — Browser verification and release candidate

### Task 9: Add result/review browser regression coverage

**Files:**
- Create: `cypress/e2e/result-rich-text-review.cy.ts`

**Test strategy:** Follow the existing stubbed results pattern from `cypress/e2e/results-intervention.cy.ts`: use auth storage + `cy.intercept()`; do not depend on mutable production data.

**Required scenarios:**

1. teacher result review renders centered/bold/TeX rich prompt;
2. student immediate result review renders the same presentation;
3. historical student assignment review uses rich snapshot when stored;
4. legacy snapshot without rich renders its own plain prompt even if current quiz has different rich content;
5. viewport coverage: 320 / 768 / 1024 / 1440;
6. no literal `<strong>` or raw `$...$` artifact caused by the review renderer;
7. no document-level horizontal overflow.

- [ ] **Step 1: Add a reusable rich fixture**

```ts
const richPrompt = {
  schemaVersion: 1,
  doc: {
    type: 'doc',
    content: [{
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [{
        type: 'text',
        text: 'Tính $24 \\div 6$',
        marks: [{ type: 'bold' }],
      }],
    }],
  },
};
```

- [ ] **Step 2: Stub teacher result APIs using the established results E2E auth pattern**

Use the same `auth-storage` approach as `results-intervention.cy.ts`. Return result answer snapshots with `questionRichText: richPrompt` for the new-result case and without it for the legacy case.

- [ ] **Step 3: Assert teacher review presentation**

```ts
cy.get('[data-testid="question-rich-text-renderer"]').should('be.visible');
cy.get('[data-testid="question-rich-text-renderer"] strong').should('contain.text', 'Tính');
cy.contains('<strong>').should('not.exist');
```

- [ ] **Step 4: Stub student assignment-review state with historical snapshots**

Rich snapshot case must contain `questionRichText`. Legacy snapshot case must contain only historical plain `question`; current quiz response may contain a deliberately different rich prompt to prove no inheritance occurs.

- [ ] **Step 5: Check responsive overflow**

For each viewport:

```ts
for (const width of [320, 768, 1024, 1440]) {
  cy.viewport(width, 900);
  cy.document().then((doc) => {
    expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth + 1);
  });
}
```

- [ ] **Step 6: Run browser suite**

```bash
npx cypress run --e2e --spec "cypress/e2e/result-rich-text-review.cy.ts"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add cypress/e2e/result-rich-text-review.cy.ts
git commit -m "test: cover historical rich prompt review parity"
```

---

### Task 10: Full regression, security, impact review and release gate

**Files:**
- No production changes unless a failing gate reveals a regression attributable to this branch.

- [ ] **Step 1: Focused tests**

```bash
npx vitest run \
  tests/QuestionRichTextContract.test.ts \
  tests/QuestionRichTextRenderer.test.tsx \
  tests/quizRoutes.authoringFields.worker.test.ts \
  tests/quizGradingService.worker.test.ts \
  tests/studentDetailModels.test.ts \
  tests/studentDashboardModel.test.ts \
  tests/QuestionReview.test.tsx \
  tests/StudentResultScreen.test.tsx \
  tests/quizEditorAccess.worker.test.ts \
  --maxWorkers=2
```

Expected: PASS.

- [ ] **Step 2: Static gates**

```bash
npm run lint
npm run typecheck
npm run typecheck:strict
npm run typecheck:workers
```

Expected: exit 0.

- [ ] **Step 3: Full gates**

```bash
npm run verify
npm run perf:budget
npm run release:readiness
```

Expected: exit 0.

- [ ] **Step 4: Security assertions**

Confirm tests prove:

- unsupported rich nodes/marks rejected;
- malformed persisted rich falls back without executing HTML;
- no correct-answer fields are added to student/result snapshot presentation;
- `question_rich_text_plain_mismatch` contains metadata only;
- historical result presentation never reads newer current rich when a snapshot exists;
- structured rich math split by formatting marks is reassembled before MathJax rather than rendered as delimiter fragments;
- semantic math normalization never recursively walks `questionRichText`;
- `QUIZ_HAS_SUBMISSIONS` continues blocking structural mutation of a quiz that already has results.

- [ ] **Step 5: GitNexus impact/diff review**

Rerun impact on:

```text
mapQuestionForSave
loadQuizQuestionsForGrading
buildDisplayQuestions
QuestionReview
ReviewTab
QuestionRichTextRenderer
prepareIncomingQuestion
```

Then run repository diff review. Resolve every Critical/Important finding before PR.

- [ ] **Step 6: PR gate**

Push feature branch and create PR only after local gates are green. Required branch-protection checks + approval must pass; no bypass.

- [ ] **Step 7: Stop for explicit production approval**

Present:

- merge SHA;
- frontend + Worker scope;
- explicit statement: **no D1 migration**;
- current Worker rollback target;
- focused smoke list.

Do not deploy without user approval.

- [ ] **Step 8: Post-deploy smoke after approval**

Run existing production smoke plus feature-specific checks:

```text
legacy plain quiz render
rich quiz render
new submission stores rich historical snapshot
teacher result review rich prompt
student result review rich prompt
legacy snapshot stays plain/historical
quiz create/update persists server-derived plain + validated rich JSON
```

---

## Phase acceptance criteria

1. When valid `questionRichText` exists, persisted plain prompt is server-derived and then processed by current math normalization/validation.
2. Equivalent client/rich forms after current math normalization do not generate false drift events.
3. Plain-only questions preserve current write/read behavior.
4. Drift observability is metadata-only.
5. `QuestionRichTextRenderer` preserves one complete delimited math segment even when Tiptap marks split the source across adjacent text nodes; partial internal styling may be dropped rather than breaking math.
6. New authoritative result snapshots retain safe `questionRichText` only when final serialized answers-with-rich stays at or below `MAX_RESULT_ANSWERS_WITH_RICH_BYTES = 1_500_000`, with correctness fields stripped.
7. When the rich candidate exceeds that threshold, submission still succeeds and all stored snapshots deterministically degrade to historical plain presentation with one metadata-only event; Phase 1 adds no new hard rejection for large legacy/plain-only result answers.
8. Historical snapshot presentation has precedence over current quiz presentation.
9. Pre-existing snapshots without rich content remain plain; no backfill is required.
10. Teacher `QuestionReview` uses `QuestionRichTextRenderer` when historical/current question data actually contains rich presentation.
11. Student Result `ReviewTab` uses the same presentation renderer and keeps server-authoritative answer review.
12. Existing `QUIZ_HAS_SUBMISSIONS` editability protection remains green; Phase 1 does not redesign answer-key history while structural edits after submissions are prohibited.
13. No D1 migration, no scoring schema/version change, no answer-template rewrite.
14. Unit/integration/browser/full release gates pass before PR/release.

## Explicit non-goals

- Rich answer options/items.
- Rich explanation.
- System Prompt v2.
- Full semantic Question Contract v2.
- New answer-key persistence.
- D1 schema changes.
- Bulk backfill of questions or result snapshots.
- Rewriting answer scoring/review templates.
- Replacing TeX-in-text with math nodes.
- Making old result snapshots magically regain formatting they never stored.

## Rollback

Application rollback only:

```text
disable/revert Phase 1 frontend + Worker changes
-> keep question_rich_text column and stored data
-> legacy/plain rendering remains available
-> no D1 downgrade
```

New result snapshots created while Phase 1 is active may contain safe `questionRichText`; older code must tolerate unknown extra snapshot fields because result snapshot JSON already supports additional presentation metadata.
