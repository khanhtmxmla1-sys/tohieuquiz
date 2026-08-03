# Quiz Answer Progress V2 Implementation Plan

> **Execution status (2026-08-03):** All 17 implementation tasks are complete on branch `feature/quiz-answer-progress-v2`. Local focused tests, lint, frontend/Worker typechecks, production build, security scan, and Cypress browser matrices passed. Production deployment remains intentionally pending; see `docs/releases/quiz-progress-v2-checklist.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tách trạng thái tiến độ làm bài khỏi logic chấm điểm, đồng bộ trạng thái `chưa làm / đang làm / hoàn thành` trên toàn bộ màn hình luyện tập và thi trực tiếp, đồng thời chuẩn hóa màu lựa chọn và bảo vệ học sinh khỏi câu hỏi nguồn bị lỗi dữ liệu.

**Architecture:** Tạo domain `quiz-progress` thuần dữ liệu, không phụ thuộc đáp án đúng và không gọi `normalizeQuestionForGrading()`. Mọi bề mặt UI dùng chung `summarizeQuizProgress()` hoặc hook `useQuizProgress()`. Logic chấm điểm hiện tại tiếp tục độc lập; thay đổi chính sách `voided` được triển khai sau khi progress/UI đã ổn định.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4, Vitest 4, Testing Library, Cloudflare Workers, D1.

## Global Constraints

- Không thực hiện hạng mục trợ năng trong đợt này; không tạo task riêng cho WCAG, Axe, screen reader hoặc điều hướng bàn phím.
- Không xóa các thuộc tính `aria-*`, `focus-visible` hoặc hành vi trợ năng đang tồn tại; chỉ giữ nguyên khi sửa component liên quan.
- Progress UI không được gọi `normalizeQuestionForGrading()` và không được yêu cầu `correctAnswer`, `correctAnswers`, `isCorrect`, `correctOrder` hoặc dữ liệu chấm điểm khác.
- Không thay đổi schema đáp án học sinh trong Release 1; phải tiếp tục đọc được dữ liệu legacy và canonical hiện tại.
- Trước khi chấm, trạng thái lựa chọn dùng xanh dương; xanh lá/đỏ chỉ dành cho trạng thái kết quả hoặc trạng thái hoàn thành ở thanh điều hướng.
- `EMPTY`, `PARTIAL`, `COMPLETE` là ba trạng thái tiến độ duy nhất trong Release 1.
- Luyện tập và thi trực tiếp phải dùng cùng một progress engine.
- Không thay đổi công thức tính điểm trong các task progress/UI.
- Thay đổi scoring `voided` chỉ được bật sau khi test Worker, API, frontend result và dữ liệu lưu kết quả cùng vượt checkpoint riêng.
- Feature flag `VITE_FEATURE_QUIZ_PROGRESS_V2` mặc định `false` cho đến khi hoàn thành shadow comparison.
- Không ghi nguyên văn đáp án học sinh vào telemetry hoặc log.
- Mỗi task phải có test thất bại trước, implementation tối thiểu, test pass và commit riêng.

---

## File Map

### Create

- `src/domain/quiz-progress/types.ts`
- `src/domain/quiz-progress/questionType.ts`
- `src/domain/quiz-progress/getQuestionProgress.ts`
- `src/domain/quiz-progress/summarizeQuizProgress.ts`
- `src/domain/quiz-progress/index.ts`
- `src/features/quiz-player/hooks/useQuizProgress.ts`
- `src/features/quiz-player/components/answer-state/stateStyles.ts`
- `src/features/quiz-player/components/answer-state/QuestionProgressButton.tsx`
- `src/features/quiz-player/components/answer-state/QuestionProgressBadge.tsx`
- `src/features/quiz-player/components/answer-state/index.ts`
- `tests/quizProgress.test.ts`
- `tests/quizProgressSummary.test.ts`
- `tests/QuizProgressUi.test.tsx`
- `tests/LiveExamQuiz.progress.test.tsx`
- `tests/questionScoringContractAlignment.test.ts`
- `scripts/audit-question-contracts.mjs`
- `tests/quizVoidedScoring.test.ts`

### Modify — progress and UI

- `src/config/featureFlags.ts`
- `.env.example`
- `src/features/quiz-player/hooks/useQuizPlayer.ts`
- `src/components/StudentView.tsx`
- `src/components/LiveExam/LiveExamQuiz.tsx`
- `src/features/quiz-player/components/QuizHeader.tsx`
- `src/features/quiz-player/components/QuizNavigation.tsx`
- `src/components/student/SubmitConfirmModal.tsx`
- `src/features/quiz-player/components/QuestionRenderer/index.tsx`
- `src/features/quiz-player/components/QuestionRenderer/types.ts`
- `src/features/quiz-player/components/QuestionRenderer/atoms/ChoiceIndicator.tsx`
- `src/features/quiz-player/components/QuestionRenderer/atoms/LatexDropdown.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/MCQRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/MultipleSelectRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/ImageQuestionRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/TrueFalseRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/UnderlineRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/WordScrambleRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/ShortAnswerRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/RiddleRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/MathRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/GeometryRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/ErrorCorrectionRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/FillInTheBlankRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/MatchingRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/OrderingRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/DragDropRenderer.tsx`
- `styles/tokens.css`
- `tests/quizAnswerStateColors.test.tsx`
- `tests/useQuizPlayerRewards.test.tsx`
- `tests/LiveExamQuiz.pagination.test.tsx`

### Modify — authoring and scoring safety

- `src/features/manual-quiz-workspace/validation/questionValidators.ts`
- `src/features/manual-quiz-workspace/validation/manualQuizValidation.ts`
- `workers/src/services/questionScoringContract.ts`
- `workers/src/services/quizGradingService.ts`
- `workers/src/utils/helpers.ts`
- `src/domain/quiz-scoring/types.ts`
- `src/domain/quiz-scoring/gradeQuiz.ts`
- `src/domain/quiz-scoring/reviewAnswer.ts`
- `src/services/quizValidationService.ts`
- `src/types/domain.types.ts`
- `src/features/quiz-player/hooks/useQuizPlayer.ts`
- `src/components/student/ResultScreen/index.tsx`
- `src/components/student/ResultScreen/tabs/StatisticsTab.tsx`
- Worker result/validation tests liên quan.

---

## Dependency Graph

```text
Question type aliases + raw-answer helpers
                ↓
getQuestionProgress(question, answer)
                ↓
summarizeQuizProgress(questions, answers)
                ↓
useQuizProgress()
        ┌───────┴────────┐
        ↓                ↓
StudentView          LiveExamQuiz
        ↓                ↓
Header / Navigation / Submit modal
                ↓
Renderer state styling
                ↓
Authoring validation alignment
                ↓
Legacy audit
                ↓
Voided scoring policy
                ↓
Feature-flag rollout
```

---

# Release 1 — Progress engine và UI đồng bộ

## Task 1: Khóa contract cho Quiz Progress

**Files:**
- Create: `src/domain/quiz-progress/types.ts`
- Create: `src/domain/quiz-progress/questionType.ts`
- Create: `src/domain/quiz-progress/index.ts`
- Create: `tests/quizProgress.test.ts`

**Interfaces:**
- Produces:

```ts
export type QuestionProgressState = 'empty' | 'partial' | 'complete';

export interface QuestionProgressResult {
  state: QuestionProgressState;
  hasInteraction: boolean;
  completedParts: number;
  requiredParts: number;
}

export type ProgressQuestionType =
  | 'MCQ'
  | 'IMAGE_QUESTION'
  | 'MULTIPLE_SELECT'
  | 'SHORT_ANSWER'
  | 'TRUE_FALSE'
  | 'MATCHING'
  | 'DRAG_DROP'
  | 'DROPDOWN'
  | 'ORDERING'
  | 'CATEGORIZATION'
  | 'UNDERLINE'
  | 'WORD_SCRAMBLE'
  | 'RIDDLE'
  | 'ERROR_CORRECTION'
  | 'MATH_INPUT'
  | 'GEOMETRY'
  | 'UNKNOWN';

export function normalizeProgressQuestionType(question: unknown): ProgressQuestionType;
```

- [ ] **Step 1: Viết test aliases trước**

```ts
import { describe, expect, it } from 'vitest';
import { normalizeProgressQuestionType } from '../src/domain/quiz-progress';

describe('normalizeProgressQuestionType', () => {
  it.each([
    ['MCQ', 'MCQ'],
    ['MULTIPLE_CHOICE', 'MCQ'],
    ['IMAGE', 'IMAGE_QUESTION'],
    ['IMAGE_MCQ', 'IMAGE_QUESTION'],
    ['MATH_INPUT', 'MATH_INPUT'],
    ['geometry', 'GEOMETRY'],
  ])('maps %s to %s', (input, expected) => {
    expect(normalizeProgressQuestionType({ type: input })).toBe(expected);
  });

  it('returns UNKNOWN instead of throwing', () => {
    expect(normalizeProgressQuestionType({ type: 'NEW_TYPE' })).toBe('UNKNOWN');
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run:

```bash
npx vitest run tests/quizProgress.test.ts
```

Expected: FAIL vì module `quiz-progress` chưa tồn tại.

- [ ] **Step 3: Tạo types và alias map tối thiểu**

`questionType.ts` phải chỉ đọc `type` hoặc `questionType`, uppercase và thay `-` bằng `_`; tuyệt đối không gọi scoring normalizer.

```ts
const TYPE_ALIASES: Record<string, ProgressQuestionType> = {
  MCQ: 'MCQ',
  MULTIPLE_CHOICE: 'MCQ',
  IMAGE: 'IMAGE_QUESTION',
  IMAGE_MCQ: 'IMAGE_QUESTION',
  IMAGE_QUESTION: 'IMAGE_QUESTION',
  MULTIPLE_SELECT: 'MULTIPLE_SELECT',
  SHORT_ANSWER: 'SHORT_ANSWER',
  TRUE_FALSE: 'TRUE_FALSE',
  MATCHING: 'MATCHING',
  DRAG_DROP: 'DRAG_DROP',
  DROPDOWN: 'DROPDOWN',
  ORDERING: 'ORDERING',
  CATEGORIZATION: 'CATEGORIZATION',
  UNDERLINE: 'UNDERLINE',
  WORD_SCRAMBLE: 'WORD_SCRAMBLE',
  RIDDLE: 'RIDDLE',
  ERROR_CORRECTION: 'ERROR_CORRECTION',
  MATH_INPUT: 'MATH_INPUT',
  GEOMETRY: 'GEOMETRY',
};
```

- [ ] **Step 4: Chạy test và typecheck**

```bash
npx vitest run tests/quizProgress.test.ts
npx tsc -p tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/quiz-progress tests/quizProgress.test.ts
git commit -m "feat: define quiz progress contract"
```

---

## Task 2: Implement progress cho các dạng câu trả lời đơn

**Files:**
- Create: `src/domain/quiz-progress/getQuestionProgress.ts`
- Modify: `src/domain/quiz-progress/index.ts`
- Modify: `tests/quizProgress.test.ts`

**Interfaces:**
- Consumes: `normalizeProgressQuestionType()` từ Task 1.
- Produces:

```ts
export function getQuestionProgress(
  question: unknown,
  rawAnswer: unknown,
): QuestionProgressResult;
```

- [ ] **Step 1: Thêm test không phụ thuộc đáp án đúng**

```ts
it('marks short answer complete without correctAnswer in student-safe DTO', () => {
  expect(getQuestionProgress(
    { id: 'q12', type: 'SHORT_ANSWER', question: 'The eraser is ____.' },
    'mine',
  )).toEqual({
    state: 'complete',
    hasInteraction: true,
    completedParts: 1,
    requiredParts: 1,
  });
});

it('returns empty after the answer is cleared', () => {
  expect(getQuestionProgress(
    { id: 'q12', type: 'SHORT_ANSWER' },
    '   ',
  ).state).toBe('empty');
});
```

Thêm cases cho:

- MCQ legacy `'B'`.
- MCQ canonical `{ type: 'MCQ', optionId: 'option-1' }`.
- IMAGE_QUESTION.
- MULTIPLE_SELECT mảng và canonical object.
- RIDDLE.
- UNDERLINE.
- GEOMETRY text input.
- UNKNOWN có answer text.

- [ ] **Step 2: Chạy test để xác nhận FAIL**

```bash
npx vitest run tests/quizProgress.test.ts
```

- [ ] **Step 3: Implement raw-answer helpers**

Reuse `unwrapStoredResultAnswer()` và `withoutUiMetadata()` từ `quiz-scoring/legacyAnswerAdapters`; không import `normalizeQuestionForGrading()` hoặc `normalizeAnswerForQuestion()`.

Quy tắc đơn:

```ts
const scalarProgress = (value: unknown): QuestionProgressResult => {
  const filled = String(value ?? '').trim().length > 0;
  return filled
    ? { state: 'complete', hasInteraction: true, completedParts: 1, requiredParts: 1 }
    : { state: 'empty', hasInteraction: false, completedParts: 0, requiredParts: 1 };
};
```

MCQ/Image phải chấp nhận `optionId`, label legacy, index số hoặc chuỗi option. Multiple select hoàn thành khi có ít nhất một lựa chọn; không dùng số đáp án đúng để suy luận.

Word scramble chưa implement trong task này.

- [ ] **Step 4: Chạy test**

```bash
npx vitest run tests/quizProgress.test.ts
```

Expected: tất cả simple cases PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/quiz-progress/getQuestionProgress.ts src/domain/quiz-progress/index.ts tests/quizProgress.test.ts
git commit -m "feat: add simple quiz progress rules"
```

---

## Task 3: Implement progress cho câu nhiều phần

**Files:**
- Modify: `src/domain/quiz-progress/getQuestionProgress.ts`
- Modify: `tests/quizProgress.test.ts`

**Interfaces:**
- Extends `getQuestionProgress()`; không thay signature.

- [ ] **Step 1: Viết test TRUE_FALSE**

```ts
const trueFalse = {
  id: 'tf',
  type: 'TRUE_FALSE',
  items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
};

expect(getQuestionProgress(trueFalse, {})).toMatchObject({ state: 'empty', completedParts: 0, requiredParts: 3 });
expect(getQuestionProgress(trueFalse, { a: true })).toMatchObject({ state: 'partial', completedParts: 1, requiredParts: 3 });
expect(getQuestionProgress(trueFalse, { a: true, b: false, c: true })).toMatchObject({ state: 'complete', completedParts: 3, requiredParts: 3 });
```

- [ ] **Step 2: Viết test MATCHING không bị metadata đánh lừa**

```ts
const matching = {
  id: 'm',
  type: 'MATCHING',
  pairs: [],
  leftItems: [{ id: 'l-0' }, { id: 'l-1' }],
  rightItems: [{ id: 'r-0' }, { id: 'r-1' }],
};

expect(getQuestionProgress(matching, { __shuffledIds: ['r-1', 'r-0'] }).state).toBe('empty');
expect(getQuestionProgress(matching, { 'l-0': 'r-0', __shuffledIds: ['r-1', 'r-0'] }).state).toBe('partial');
expect(getQuestionProgress(matching, { 'l-0': 'r-0', 'l-1': 'r-1' }).state).toBe('complete');
```

- [ ] **Step 3: Viết test blanks**

Bao gồm `DROPDOWN`, `DRAG_DROP`, object blank IDs và string blank fallback.

```ts
expect(getQuestionProgress(
  { id: 'd', type: 'DROPDOWN', blanks: [{ id: 'b1' }, { id: 'b2' }] },
  { b1: 'x' },
)).toMatchObject({ state: 'partial', completedParts: 1, requiredParts: 2 });
```

- [ ] **Step 4: Implement helper đếm phần bắt buộc**

Quy tắc:

```text
TRUE_FALSE       required = items.length
MATCHING         required = leftItems.length || pairs.length || ceil(items.length / 2)
DROPDOWN         required = blanks.length
DRAG_DROP        required = blanks.length
```

Giá trị boolean `false` phải được tính là đã trả lời. Metadata `selectedLeft`, `__shuffledIds`, `_selected` không được tính.

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/quizProgress.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/domain/quiz-progress/getQuestionProgress.ts tests/quizProgress.test.ts
git commit -m "feat: add structured quiz progress rules"
```

---

## Task 4: Implement ordering, categorization, math fraction, word scramble và error correction

**Files:**
- Modify: `src/domain/quiz-progress/getQuestionProgress.ts`
- Modify: `tests/quizProgress.test.ts`

- [ ] **Step 1: Viết failing tests**

Các yêu cầu:

```ts
// ORDERING
expect(getQuestionProgress(ordering, { ranks: { 'item-0': 1 } }).state).toBe('partial');
expect(getQuestionProgress(ordering, { ranks: { 'item-0': 1, 'item-1': 2 } }).state).toBe('complete');
expect(getQuestionProgress(ordering, { ranks: { 'item-0': 1, 'item-1': 1 } }).state).toBe('partial');

// CATEGORIZATION
expect(getQuestionProgress(categorization, { a: 'group-1' }).state).toBe('partial');

// ERROR_CORRECTION
expect(getQuestionProgress(errorCorrection, { wrongWord: 'ngoãn' }).state).toBe('partial');
expect(getQuestionProgress(errorCorrection, { wrongWord: 'ngoãn', correctWord: 'ngoan' }).state).toBe('complete');

// MATH_INPUT fraction
expect(getQuestionProgress(
  { id: 'f', type: 'MATH_INPUT', mathType: 'fraction' },
  { numerator: '1', denominator: '' },
).state).toBe('partial');

// WORD_SCRAMBLE
expect(getQuestionProgress(
  { id: 'w', type: 'WORD_SCRAMBLE', letters: ['H', 'O', 'A'] },
  [0, 1],
).state).toBe('partial');
```

- [ ] **Step 2: Implement rules**

```text
ORDERING         complete khi đủ số item, rank là số nguyên duy nhất; partial nếu có dữ liệu nhưng thiếu/trùng
CATEGORIZATION   complete khi mọi item có category; partial khi mới gán một phần
ERROR_CORRECTION complete khi cả wrongWord và correctWord có nội dung
MATH fraction    required = 2; scalar/dropdown required = 1
WORD_SCRAMBLE    complete khi số index đã chọn bằng số letters; partial nếu 1..n-1
```

Không kiểm tra nội dung có đúng hay không.

- [ ] **Step 3: Run tests and typecheck**

```bash
npx vitest run tests/quizProgress.test.ts
npx tsc -p tsconfig.json --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/domain/quiz-progress/getQuestionProgress.ts tests/quizProgress.test.ts
git commit -m "feat: complete quiz progress rules"
```

---

## Task 5: Tạo summary và React hook dùng chung

**Files:**
- Create: `src/domain/quiz-progress/summarizeQuizProgress.ts`
- Modify: `src/domain/quiz-progress/index.ts`
- Create: `src/features/quiz-player/hooks/useQuizProgress.ts`
- Create: `tests/quizProgressSummary.test.ts`

**Interfaces:**

```ts
export interface QuizProgressSummary {
  totalCount: number;
  emptyCount: number;
  partialCount: number;
  completeCount: number;
  byQuestionId: Record<string, QuestionProgressResult>;
}

export function summarizeQuizProgress(
  questions: readonly unknown[],
  answers: Record<string, unknown>,
): QuizProgressSummary;

export function useQuizProgress(
  questions: readonly Question[],
  answers: Record<string, unknown>,
): QuizProgressSummary;
```

- [ ] **Step 1: Write summary tests**

```ts
const summary = summarizeQuizProgress(
  [
    { id: 'q1', type: 'SHORT_ANSWER' },
    { id: 'q2', type: 'TRUE_FALSE', items: [{ id: 'a' }, { id: 'b' }] },
    { id: 'q3', type: 'MCQ', options: ['A', 'B'] },
  ],
  {
    q1: 'mine',
    q2: { a: true },
  },
);

expect(summary).toMatchObject({
  totalCount: 3,
  completeCount: 1,
  partialCount: 1,
  emptyCount: 1,
});
```

- [ ] **Step 2: Implement pure summary**

Question không có ID phải không làm crash; dùng key rỗng chỉ trong local result hoặc bỏ khỏi `byQuestionId`, nhưng vẫn tính vào `totalCount`.

- [ ] **Step 3: Implement memoized hook**

```ts
export const useQuizProgress = (
  questions: readonly Question[],
  answers: Record<string, unknown>,
): QuizProgressSummary => useMemo(
  () => summarizeQuizProgress(questions, answers),
  [questions, answers],
);
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/quizProgressSummary.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/quiz-progress src/features/quiz-player/hooks/useQuizProgress.ts tests/quizProgressSummary.test.ts
git commit -m "feat: add shared quiz progress summary"
```

---

## Checkpoint A — Domain foundation

- [ ] `npx vitest run tests/quizProgress.test.ts tests/quizProgressSummary.test.ts`
- [ ] `npx tsc -p tsconfig.json --noEmit`
- [ ] Xác nhận không có import từ `quiz-progress` sang `normalizeQuestionForGrading`.
- [ ] Xác nhận test câu 12 không có `correctAnswer` vẫn `complete`.
- [ ] Review diff trước khi tích hợp UI.

---

## Task 6: Tích hợp progress vào useQuizPlayer và StudentView

**Files:**
- Modify: `src/features/quiz-player/hooks/useQuizPlayer.ts`
- Modify: `src/components/StudentView.tsx`
- Modify: `tests/useQuizPlayerRewards.test.tsx`
- Create: `tests/QuizProgressUi.test.tsx`

**Interfaces:**
- `useQuizPlayer()` produces `quizProgress: QuizProgressSummary`.
- Loại bỏ `isQuestionAnswered` khỏi API UI của hook sau khi mọi consumer đã migrate.

- [ ] **Step 1: Update hook test trước**

Trong `useQuizPlayerRewards.test.tsx`, thay assertions cũ:

```ts
expect(result.current.isQuestionAnswered(question)).toBe(false);
```

bằng:

```ts
expect(result.current.quizProgress.byQuestionId[question.id].state).toBe('empty');
```

Sau một cặp matching:

```ts
expect(result.current.quizProgress.byQuestionId[question.id].state).toBe('partial');
```

Sau đủ cặp:

```ts
expect(result.current.quizProgress.byQuestionId[question.id].state).toBe('complete');
```

- [ ] **Step 2: Run test để xác nhận FAIL**

```bash
npx vitest run tests/useQuizPlayerRewards.test.tsx
```

- [ ] **Step 3: Replace scoring completeness in useQuizPlayer**

Xóa import:

```ts
import { isQuestionAnswered as hasCompleteAnswer } from '../../../domain/quiz-scoring';
```

Thêm:

```ts
import { useQuizProgress } from './useQuizProgress';
```

Tạo:

```ts
const quizProgress = useQuizProgress(shuffledQuestions, answers);
```

Return `quizProgress`; chưa thay đổi submit/scoring.

- [ ] **Step 4: Update StudentView**

Dùng:

```ts
const { emptyCount, partialCount, completeCount, byQuestionId } = quizProgress;
```

Truyền:

```tsx
<QuizHeader
  completedCount={completeCount}
  partialCount={partialCount}
  totalQuestions={shuffledQuestions.length}
/>

<QuizNavigation
  questions={shuffledQuestions}
  progressByQuestionId={byQuestionId}
/>

<SubmitConfirmModal
  emptyCount={emptyCount}
  partialCount={partialCount}
/>
```

- [ ] **Step 5: Add UI integration test for câu 12**

Render `StudentView` hoặc harness của hook với câu `SHORT_ANSWER` không có `correctAnswer`, nhập `mine`, assert:

```ts
expect(screen.getByText(/Đã hoàn thành 1\/1 câu/)).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Đi đến câu 1' })).toHaveAttribute('data-progress-state', 'complete');
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run tests/useQuizPlayerRewards.test.tsx tests/QuizProgressUi.test.tsx
```

- [ ] **Step 7: Commit**

```bash
git add src/features/quiz-player/hooks/useQuizPlayer.ts src/components/StudentView.tsx tests/useQuizPlayerRewards.test.tsx tests/QuizProgressUi.test.tsx
git commit -m "feat: use quiz progress in student player"
```

---

## Task 7: Tích hợp progress vào LiveExamQuiz

**Files:**
- Modify: `src/components/LiveExam/LiveExamQuiz.tsx`
- Modify: `tests/LiveExamQuiz.pagination.test.tsx`
- Create: `tests/LiveExamQuiz.progress.test.tsx`

**Interfaces:**
- Consumes `useQuizProgress(questions, answers)`.
- Backend activity payload vẫn giữ field `answeredCount`; giá trị field là `completeCount` để không phá API hiện có.

- [ ] **Step 1: Add failing Live Exam progress test**

Mock `QuestionRenderer` bằng button gọi `onAnswerChange(question.id, 'mine')`, dùng câu short answer không có correct answer.

```tsx
<button onClick={() => onAnswerChange(question.id, 'mine')}>Trả lời câu</button>
```

Assert sau click:

```ts
expect(screen.getByText(/Đã hoàn thành 1\/1 câu/)).toBeInTheDocument();
expect(mocks.updateActivity).toHaveBeenLastCalledWith({
  currentQuestion: 1,
  answeredCount: 1,
});
```

- [ ] **Step 2: Replace `hasCompleteAnswer`**

Xóa scoring import và `isQuestionAnswered`. Dùng:

```ts
const quizProgress = useQuizProgress(questions, answers);
const { completeCount, partialCount, emptyCount, byQuestionId } = quizProgress;
```

- [ ] **Step 3: Preserve autosave behavior**

Không sửa `saveLiveExamAnswerDraft`, snapshot version hoặc reconnect conflict trong task này. Progress phải tự cập nhật từ `answers` đã restore.

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/LiveExamQuiz.progress.test.tsx tests/LiveExamQuiz.pagination.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/LiveExam/LiveExamQuiz.tsx tests/LiveExamQuiz.progress.test.tsx tests/LiveExamQuiz.pagination.test.tsx
git commit -m "feat: use shared progress in live exams"
```

---

## Task 8: Đồng bộ Header và Submit Modal

**Files:**
- Modify: `src/features/quiz-player/components/QuizHeader.tsx`
- Modify: `src/components/student/SubmitConfirmModal.tsx`
- Modify: `tests/QuizProgressUi.test.tsx`

**Interfaces:**

```ts
interface QuizHeaderProps {
  totalQuestions: number;
  completedCount: number;
  partialCount: number;
  // existing fields unchanged
}

interface SubmitConfirmModalProps {
  isOpen: boolean;
  emptyCount: number;
  partialCount: number;
  onConfirm(): void;
  onCancel(): void;
}
```

- [ ] **Step 1: Write copy tests**

Expected header:

```text
Đã hoàn thành 3/30 câu · Đang làm 1 câu
```

Nếu `partialCount === 0`:

```text
Đã hoàn thành 3/30 câu
```

Expected modal khi còn partial:

```text
1 câu đang làm dở
26 câu chưa bắt đầu
```

- [ ] **Step 2: Update progress bar**

Progress bar width chỉ dựa trên `completedCount / totalQuestions`; không cộng partial vào phần hoàn thành.

- [ ] **Step 3: Update modal copy**

Không dùng từ “chưa làm” cho câu partial. Khi cả `emptyCount` và `partialCount` bằng 0, hiển thị “Bạn đã hoàn thành tất cả câu hỏi”.

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/QuizProgressUi.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/features/quiz-player/components/QuizHeader.tsx src/components/student/SubmitConfirmModal.tsx tests/QuizProgressUi.test.tsx
git commit -m "feat: distinguish partial and complete quiz progress"
```

---

## Task 9: Tạo semantic state styles và QuestionProgressButton

**Files:**
- Modify: `styles/tokens.css`
- Create: `src/features/quiz-player/components/answer-state/stateStyles.ts`
- Create: `src/features/quiz-player/components/answer-state/QuestionProgressButton.tsx`
- Create: `src/features/quiz-player/components/answer-state/QuestionProgressBadge.tsx`
- Create: `src/features/quiz-player/components/answer-state/index.ts`
- Modify: `src/features/quiz-player/components/QuizNavigation.tsx`
- Modify: `tests/quizAnswerStateColors.test.tsx`

**Interfaces:**

```ts
export const progressButtonClasses: Record<QuestionProgressState, string>;
export const selectedAnswerClass: string;
export const unselectedAnswerClass: string;
```

Semantic values:

```css
--quiz-progress-empty-bg: #ffffff;
--quiz-progress-empty-border: #cbd5e1;
--quiz-progress-partial-bg: #fef3c7;
--quiz-progress-partial-border: #d97706;
--quiz-progress-complete-bg: #16a34a;
--quiz-progress-complete-border: #15803d;
--quiz-answer-selected-bg: #dbeafe;
--quiz-answer-selected-border: #2563eb;
--quiz-answer-selected-text: #1e3a8a;
```

- [ ] **Step 1: Rewrite navigation tests first**

```ts
expect(completeButton).toHaveClass('bg-emerald-600', 'border-emerald-700', 'text-white');
expect(partialButton).toHaveClass('bg-amber-100', 'border-amber-500', 'text-amber-950');
expect(emptyButton).toHaveClass('bg-white', 'border-slate-300');
expect(activeCompleteButton).toHaveClass('ring-2', 'ring-sky-500');
```

- [ ] **Step 2: Implement `QuestionProgressButton`**

Props:

```ts
interface QuestionProgressButtonProps {
  questionNumber: number;
  state: QuestionProgressState;
  active: boolean;
  onClick(): void;
}
```

Complete state hiển thị số và dấu check nhỏ; partial state hiển thị số và chấm amber. Không thêm yêu cầu trợ năng mới; giữ labels hiện tại khi component được dùng trong navigation.

- [ ] **Step 3: Replace navigation predicate**

`QuizNavigation` nhận:

```ts
progressByQuestionId: Record<string, QuestionProgressResult>;
```

Không nhận `isQuestionAnswered` nữa.

- [ ] **Step 4: Update legend**

Hiển thị ba dòng:

```text
Chưa trả lời
Đang làm
Đã hoàn thành
```

Màu legend phải dùng cùng class map, không hardcode bộ màu thứ hai.

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/quizAnswerStateColors.test.tsx tests/QuizProgressUi.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add styles/tokens.css src/features/quiz-player/components/answer-state src/features/quiz-player/components/QuizNavigation.tsx tests/quizAnswerStateColors.test.tsx tests/QuizProgressUi.test.tsx
git commit -m "feat: add clear quiz progress visuals"
```

---

## Checkpoint B — Core bug fixed

- [ ] Câu short answer không có `correctAnswer` đổi số câu sang xanh đậm sau khi nhập.
- [ ] Header tăng đúng từ `2/30` lên `3/30`.
- [ ] Xóa nội dung giảm lại `2/30`.
- [ ] Câu nhiều ý có trạng thái vàng partial.
- [ ] Practice và Live Exam dùng cùng module progress.
- [ ] `npx vitest run tests/quizProgress.test.ts tests/quizProgressSummary.test.ts tests/QuizProgressUi.test.tsx tests/LiveExamQuiz.progress.test.tsx tests/LiveExamQuiz.pagination.test.tsx tests/useQuizPlayerRewards.test.tsx`
- [ ] `npx tsc -p tsconfig.json --noEmit`

Release có thể dừng an toàn tại checkpoint này nếu chưa muốn thay toàn bộ renderer.

---

# Release 2 — Chuẩn hóa màu lựa chọn và renderer

## Task 10: Migrate các renderer lựa chọn sang màu xanh dương

**Files:**
- Modify: `ChoiceIndicator.tsx`
- Modify: `MCQRenderer.tsx`
- Modify: `MultipleSelectRenderer.tsx`
- Modify: `ImageQuestionRenderer.tsx`
- Modify: `TrueFalseRenderer.tsx`
- Modify: `UnderlineRenderer.tsx`
- Modify: `WordScrambleRenderer.tsx`
- Modify: `LatexDropdown.tsx`
- Modify: `tests/quizAnswerStateColors.test.tsx`

- [ ] **Step 1: Rewrite expected selected-state tests**

Tất cả lựa chọn trước chấm phải assert:

```ts
expect(selected).toHaveClass('border-sky-600', 'bg-sky-100', 'text-sky-950');
```

True/False:

```ts
fireEvent.click(trueButton);
expect(trueButton).toHaveClass('border-sky-600', 'bg-sky-100');

fireEvent.click(falseButton);
expect(falseButton).toHaveClass('border-sky-600', 'bg-sky-100');
expect(falseButton).not.toHaveClass('bg-red-50');
```

- [ ] **Step 2: Centralize classes**

Không để mỗi renderer định nghĩa lại selected/unselected string. Import từ `answer-state/stateStyles.ts`.

- [ ] **Step 3: Preserve post-submit result colors**

Chỉ sửa quiz player input renderers; không thay màu trong ResultScreen hoặc review answer.

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/quizAnswerStateColors.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/features/quiz-player/components/QuestionRenderer src/features/quiz-player/components/answer-state/stateStyles.ts tests/quizAnswerStateColors.test.tsx
git commit -m "style: unify selected answer colors"
```

---

## Task 11: Migrate input và renderer phức hợp

**Files:**
- Modify: `QuestionRenderer/index.tsx`
- Modify: `QuestionRenderer/types.ts`
- Modify: `ShortAnswerRenderer.tsx`
- Modify: `RiddleRenderer.tsx`
- Modify: `MathRenderer.tsx`
- Modify: `GeometryRenderer.tsx`
- Modify: `ErrorCorrectionRenderer.tsx`
- Modify: `FillInTheBlankRenderer.tsx`
- Modify: `MatchingRenderer.tsx`
- Modify: `OrderingRenderer.tsx`
- Modify: `DragDropRenderer.tsx`
- Modify: `tests/QuizProgressUi.test.tsx`
- Modify or create focused renderer tests.

**Interfaces:**
- `QuestionRenderer` computes `getQuestionProgress(question, answers[question.id])` and renders `QuestionProgressBadge` in question header.
- `QuestionProgressBadge` copy:

```text
partial  → Đang làm · 1/2
complete → Đã hoàn thành
empty    → không render badge
```

- [ ] **Step 1: Add badge tests**

Render short answer with value and assert “Đã hoàn thành”. Render true/false partial and assert “Đang làm · 1/2”.

- [ ] **Step 2: Add shared input-state helper**

```ts
export const answerInputClasses = (filled: boolean): string => filled
  ? 'border-sky-500 bg-sky-50/60 text-slate-900'
  : 'border-slate-300 bg-white text-slate-800';
```

- [ ] **Step 3: Apply to scalar inputs**

Short answer, riddle, math scalar, geometry và error correction phải đổi viền/nền khi có dữ liệu; không dùng xanh lá.

- [ ] **Step 4: Apply to structured inputs**

- Matching pair đã nối: dùng sky thay emerald.
- Ordering ô đã điền: dùng sky; thiếu/trùng vẫn badge partial.
- Fill blank/dropdown đã có giá trị: dùng sky.
- Categorization/DragDrop item đã gán: dùng sky.
- Complete green chỉ xuất hiện ở badge/navigation, không tô các lựa chọn như “đúng”.

- [ ] **Step 5: Run focused tests**

```bash
npx vitest run tests/QuizProgressUi.test.tsx tests/quizAnswerStateColors.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/features/quiz-player/components/QuestionRenderer tests/QuizProgressUi.test.tsx tests/quizAnswerStateColors.test.tsx
git commit -m "style: synchronize progress states across renderers"
```

---

# Release 3 — Data contract hardening

## Task 12: Đồng bộ frontend authoring validation với scoring contract

**Files:**
- Modify: `src/features/manual-quiz-workspace/validation/questionValidators.ts`
- Modify: `src/features/manual-quiz-workspace/validation/manualQuizValidation.ts`
- Modify: `workers/src/services/questionScoringContract.ts`
- Create: `tests/questionScoringContractAlignment.test.ts`

**Context:** Worker save hiện đã gọi `prepareQuestionScoringContractForSave()`, nhưng frontend authoring validator có bộ quy tắc riêng. Hai bộ có nguy cơ lệch code hoặc lọt dữ liệu legacy.

- [ ] **Step 1: Add alignment tests**

Với mỗi dạng câu hỏi supported, assert:

```ts
const authoringErrors = validateQuestionForAuthoring(question)
  .filter((issue) => issue.severity === 'error');
const gradingContract = normalizeQuestionForGrading(question);

expect(authoringErrors.length === 0).toBe(gradingContract.ok);
```

Thêm case bắt buộc:

```ts
{
  id: 'q12',
  type: 'SHORT_ANSWER',
  question: 'The eraser is ____',
  correctAnswer: '',
  points: 1,
}
```

Frontend phải có blocking error, Worker phải reject save.

- [ ] **Step 2: Add scoring-contract fallback to authoring validator**

Sau validation hiện có, gọi `normalizeQuestionForGrading(question)`. Nếu fail, chuyển issues chưa có tương đương thành `ManualQuizIssue` severity `error`, questionId và field phù hợp.

Không xóa validation UX hiện có vì nó có message tiếng Việt và field-specific action.

- [ ] **Step 3: Fix mojibake messages trong các block liên quan**

Chỉ sửa các message validation trong file đang chạm; không mở rộng thành task dịch toàn dự án.

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/questionScoringContractAlignment.test.ts tests/manualQuizValidation.test.ts tests/manualQuizWorkspaceStore.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/features/manual-quiz-workspace/validation workers/src/services/questionScoringContract.ts tests/questionScoringContractAlignment.test.ts
git commit -m "fix: align authoring and scoring validation"
```

---

## Task 13: Tạo audit read-only cho dữ liệu câu hỏi cũ

**Files:**
- Create: `scripts/audit-question-contracts.mjs`
- Create: `docs/operations/question-contract-audit.md`
- Test: script unit fixture hoặc `tests/questionContractAudit.test.ts`

**Output contract:**

```ts
interface QuestionContractAuditRow {
  quizId: string;
  questionId: string;
  questionType: string;
  issueCode: string;
  severity: 'error' | 'warning';
  suggestedAction: string;
}
```

- [ ] **Step 1: Build fixture-driven audit test**

Input JSON rows phải map qua cùng mapper/normalizer dùng Worker, không tự viết validator thứ ba.

- [ ] **Step 2: Implement read-only modes**

```bash
node scripts/audit-question-contracts.mjs --input .tmp/questions-export.json --output .tmp/question-contract-audit.json
```

Remote mode chỉ đọc D1:

```bash
node scripts/audit-question-contracts.mjs --remote --database tohieuquiz-db --output .tmp/question-contract-audit.json
```

Script không có lệnh `UPDATE`, `DELETE`, `INSERT` và phải fail nếu output path không được chỉ định.

- [ ] **Step 3: Report summary**

Output JSON gồm:

```json
{
  "questionCount": 100,
  "invalidCount": 3,
  "issuesByCode": {
    "MISSING_CORRECT_ANSWER": 2,
    "INVALID_MATCHING_CONTRACT": 1
  },
  "rows": []
}
```

- [ ] **Step 4: Run local fixture test; không chạy remote trong task implementation**

```bash
npx vitest run tests/questionContractAudit.test.ts
node scripts/audit-question-contracts.mjs --input tests/fixtures/question-contract-audit.json --output .tmp/question-contract-audit.json
```

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-question-contracts.mjs docs/operations/question-contract-audit.md tests/questionContractAudit.test.ts tests/fixtures/question-contract-audit.json
git commit -m "chore: add read-only question contract audit"
```

---

# Release 4 — Fair scoring for invalid production questions

## Task 14: Thêm trạng thái `voided` vào scoring domain

**Files:**
- Modify: `src/domain/quiz-scoring/types.ts`
- Modify: `src/domain/quiz-scoring/gradeQuiz.ts`
- Modify: `src/domain/quiz-scoring/reviewAnswer.ts`
- Create: `tests/quizVoidedScoring.test.ts`

**Interfaces:**

```ts
export type GradingStatus = 'correct' | 'wrong' | 'skipped' | 'invalid' | 'voided';

export interface QuizGradingResult {
  questionCount: number;
  totalQuestions: number; // số câu hợp lệ dùng làm mẫu số
  voidedCount: number;
  // existing fields
}
```

- [ ] **Step 1: Write fairness test**

Quiz 3 câu, một short answer thiếu correct answer:

```ts
expect(result).toMatchObject({
  questionCount: 3,
  totalQuestions: 2,
  voidedCount: 1,
  correctCount: 2,
  score: 10,
});
expect(result.details.find((item) => item.questionId === 'broken')?.status).toBe('voided');
```

- [ ] **Step 2: Separate invalid question from invalid student answer**

Trong `gradeQuiz()`:

- `normalizeQuestionForGrading(question)` fail → detail `voided`.
- Question valid nhưng answer không normalize được → giữ `invalid`.
- Score denominator = số detail không `voided`.

Không thay `gradeQuestion()` standalone nếu chưa cần; mapping `voided` nằm ở quiz-level vì cần biết lỗi thuộc contract câu hỏi.

- [ ] **Step 3: Update review rendering**

`voided` hiển thị nội dung trung tính “Câu hỏi không được tính điểm do lỗi dữ liệu”, không hiển thị học sinh sai.

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/quizVoidedScoring.test.ts tests/quizScoringContract.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/quiz-scoring tests/quizVoidedScoring.test.ts tests/quizScoringContract.test.ts
git commit -m "feat: void invalid questions during quiz grading"
```

---

## Task 15: Propagate `voided` qua Worker API và frontend result

**Files:**
- Modify: `workers/src/services/quizGradingService.ts`
- Modify: `workers/src/utils/helpers.ts`
- Modify: Worker grading/result tests
- Modify: `src/services/quizValidationService.ts`
- Modify: `src/types/domain.types.ts`
- Modify: `src/features/quiz-player/hooks/useQuizPlayer.ts`
- Modify: `src/components/student/ResultScreen/index.tsx`
- Modify: `src/components/student/ResultScreen/tabs/StatisticsTab.tsx`
- Modify: result tests.

- [ ] **Step 1: Write Worker test before implementation**

`gradeQuizSubmission()` không được throw 422 khi chỉ có invalid question contract; phải return:

```json
{
  "questionCount": 3,
  "totalQuestions": 2,
  "voidedCount": 1,
  "score": 10
}
```

- [ ] **Step 2: Remove all-or-nothing rejection**

Trong `quizGradingService.ts`, bỏ block throw khi `questionIssues.length > 0`. Giữ issues trong grading result và telemetry.

- [ ] **Step 3: Extend API response**

`/api/validate` trả:

```ts
{
  questionCount,
  total,
  totalQuestions,
  voidedCount,
  details,
}
```

Mỗi detail có thể `status: 'voided'`.

- [ ] **Step 4: Update client types and stored result**

`StudentResult` thêm:

```ts
questionCount?: number;
voidedCount?: number;
```

`validationDetails.status` thêm `'voided'`.

`useQuizPlayer` sử dụng server `totalQuestions` làm mẫu số và giữ `questionCount`, `voidedCount` để hiển thị.

- [ ] **Step 5: Update ResultScreen**

Nếu `voidedCount > 0`, hiển thị:

```text
Điểm được tính trên 29 câu hợp lệ. 1 câu không được tính do lỗi dữ liệu.
```

`StatisticsTab` tránh chia cho 0:

```ts
const accuracy = result.totalQuestions > 0
  ? Math.round((result.correctCount / result.totalQuestions) * 100)
  : 0;
```

- [ ] **Step 6: Run focused Worker + frontend tests**

```bash
npx vitest run tests/quizVoidedScoring.test.ts tests/quizScoringContract.test.ts tests/resultsRoutes.worker.test.ts tests/useQuizPlayerRewards.test.tsx tests/StudentResultScreen.test.tsx
```

- [ ] **Step 7: Commit**

```bash
git add workers/src/services/quizGradingService.ts workers/src/utils/helpers.ts src/services/quizValidationService.ts src/types/domain.types.ts src/features/quiz-player/hooks/useQuizPlayer.ts src/components/student/ResultScreen tests
git commit -m "feat: propagate voided questions through results"
```

---

# Release 5 — Feature flag, shadow comparison và rollout

## Task 16: Thêm feature flag và staged rollout

**Files:**
- Modify: `src/config/featureFlags.ts`
- Modify: `.env.example`
- Modify: `src/features/quiz-player/hooks/useQuizPlayer.ts`
- Modify: `src/components/LiveExam/LiveExamQuiz.tsx`
- Add tests for flag behavior.

**Interfaces:**

```ts
export const isQuizProgressV2Enabled = (): boolean => resolveFeatureFlag(
  import.meta.env.VITE_FEATURE_QUIZ_PROGRESS_V2,
  false,
);
```

- [ ] **Step 1: Add flag parser test**

Assert default false, `true` enables, `false` disables.

- [ ] **Step 2: Shadow mode before UI switch**

Khi flag false:

- UI tiếp tục dùng V1 trong thời gian shadow ngắn.
- Tính V2 song song.
- Chỉ log mismatch counters, không log answer content.

Event shape:

```ts
{
  event: 'quiz_progress_mismatch',
  quizId,
  questionId,
  questionType,
  legacyComplete,
  v2State,
  releaseId,
}
```

Không gửi event cho mọi keystroke; dedupe theo `questionId + legacyComplete + v2State` trong session.

- [ ] **Step 3: Switch UI when flag true**

Practice và Live Exam phải cùng đọc flag. Không cho phép một luồng V2, một luồng V1.

- [ ] **Step 4: Add `.env.example`**

```env
VITE_FEATURE_QUIZ_PROGRESS_V2=false
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/featureFlagRules.test.ts tests/QuizProgressUi.test.tsx tests/LiveExamQuiz.progress.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/config/featureFlags.ts .env.example src/features/quiz-player/hooks/useQuizPlayer.ts src/components/LiveExam/LiveExamQuiz.tsx tests
git commit -m "feat: add controlled quiz progress rollout"
```

---

## Task 17: Final verification và release checklist

**Files:**
- Create or modify: `docs/releases/quiz-progress-v2-checklist.md`
- No production deployment in this task unless explicitly approved.

- [ ] **Step 1: Run complete focused suite**

```bash
npx vitest run \
  tests/quizProgress.test.ts \
  tests/quizProgressSummary.test.ts \
  tests/QuizProgressUi.test.tsx \
  tests/quizAnswerStateColors.test.tsx \
  tests/useQuizPlayerRewards.test.tsx \
  tests/LiveExamQuiz.progress.test.tsx \
  tests/LiveExamQuiz.pagination.test.tsx \
  tests/questionScoringContractAlignment.test.ts \
  tests/quizVoidedScoring.test.ts \
  tests/resultsRoutes.worker.test.ts \
  tests/StudentResultScreen.test.tsx
```

- [ ] **Step 2: Typecheck and build**

```bash
npx tsc -p tsconfig.json --noEmit
npx vite build
```

- [ ] **Step 3: Manual browser matrix**

Không phải audit trợ năng. Chỉ kiểm tra chức năng/màu:

```text
Desktop practice
Desktop live exam
Mobile practice
Mobile live exam
Short answer nhập/xóa
True/False partial/complete
Matching partial/complete
Fill blank partial/complete
Reload live exam draft
Offline → online live exam
Submit modal counts
Result with voided question
```

- [ ] **Step 4: Rollout order**

```text
1. Local/Test với flag true
2. Production shadow với flag false
3. Admin/teacher internal cohort
4. Một lớp thử nghiệm
5. 25% traffic
6. 100% traffic
```

- [ ] **Step 5: Rollback conditions**

Tắt flag ngay nếu:

- Header count khác modal count.
- Live Exam answeredCount giảm sau reconnect.
- Có answer draft bị ghi đè.
- Tỷ lệ mismatch tăng bất thường.
- Result totalQuestions sai mẫu số.
- Worker validate trả 5xx/422 tăng sau voided rollout.

- [ ] **Step 6: Commit checklist**

```bash
git add docs/releases/quiz-progress-v2-checklist.md
git commit -m "docs: add quiz progress v2 release checklist"
```

---

# Recommended Execution Order

## Milestone 1 — Sửa lỗi câu 12

Tasks 1–9.

Kết quả có thể phát hành độc lập:

- Câu đã nhập được nhận diện đúng.
- Sidebar, header, modal đồng bộ.
- Màu trạng thái rõ hơn.
- Practice và Live Exam dùng chung engine.

## Milestone 2 — Đồng bộ toàn bộ renderer

Tasks 10–11.

Kết quả:

- Lựa chọn trước chấm thống nhất xanh dương.
- Câu nhập liệu và câu phức hợp có trạng thái rõ.
- Không còn mỗi renderer tự quyết định màu.

## Milestone 3 — Ngăn dữ liệu lỗi mới và tìm dữ liệu cũ

Tasks 12–13.

Kết quả:

- Frontend và Worker cùng một contract.
- Có audit read-only cho dữ liệu legacy.

## Milestone 4 — Không để câu lỗi làm học sinh mất điểm

Tasks 14–15.

Đây là milestone rủi ro cao, phải review riêng vì thay đổi mẫu số điểm và API result.

## Milestone 5 — Rollout production

Tasks 16–17.

---

# Definition of Done

- [ ] `getQuestionProgress({ type: 'SHORT_ANSWER' }, 'mine')` trả `complete` dù không có đáp án đúng.
- [ ] Câu 12 đổi trạng thái ngay trong cùng render sau khi nhập.
- [ ] Xóa nội dung đưa trạng thái về `empty`.
- [ ] Header, navigation, modal và Live Exam activity dùng cùng summary.
- [ ] Có trạng thái `partial` cho câu nhiều phần.
- [ ] Completed navigation dùng xanh đậm + chữ trắng; partial dùng amber rõ.
- [ ] True/False trước chấm không dùng đỏ/xanh lá để biểu thị lựa chọn.
- [ ] Các renderer lấy class từ một source chung.
- [ ] Frontend authoring và Worker scoring contract không mâu thuẫn.
- [ ] Audit legacy chỉ đọc dữ liệu.
- [ ] Invalid production question được `voided`, không tính sai cho học sinh.
- [ ] Feature flag có thể rollback mà không đổi/xóa đáp án.
- [ ] Focused tests, typecheck và build đều pass.

# Explicitly Not Doing

- Không triển khai screen reader, WCAG, Axe hoặc audit trợ năng.
- Không thiết kế lại toàn bộ bố cục trang làm bài.
- Không thêm loại câu hỏi mới.
- Không tự đoán đáp án đúng cho câu legacy bị lỗi.
- Không migration hàng loạt đáp án học sinh sang schema mới.
- Không deploy production tự động khi chưa được người dùng duyệt.
