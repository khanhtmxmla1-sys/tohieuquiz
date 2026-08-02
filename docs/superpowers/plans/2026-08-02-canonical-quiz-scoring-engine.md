# Canonical Quiz Scoring Engine V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Every production change follows Red → Green → Refactor and each task ends with an independently reviewable commit.

**Goal:** Loại bỏ hoàn toàn tình trạng cùng một đáp án nhưng các màn hình hoặc luồng thi chấm khác nhau; mọi bài nộp thường, bài tập được giao, thi trực tiếp, thống kê và màn hình xem lại phải sử dụng cùng một bộ chấm điểm phía máy chủ, tương thích dữ liệu cũ và không tin điểm do trình duyệt gửi lên.

**Architecture:** Tạo một module TypeScript thuần `src/domain/quiz-scoring/` chứa hợp đồng đáp án, adapter dữ liệu cũ, chuẩn hóa câu hỏi/đáp án và hàm chấm duy nhất. Frontend chỉ thu thập đáp án; Worker là nguồn điểm chính thức. `/api/validate`, `POST /api/results`, thi trực tiếp, thống kê và fallback của giao diện giáo viên đều gọi cùng module. Các định dạng cũ được hỗ trợ qua adapter có phiên bản, không duy trì một bộ chấm thứ hai.

**Tech Stack:** TypeScript 5.8, React 19, Cloudflare Workers, D1, Zod 4, Vitest, Testing Library, Cypress, Wrangler.

## Global Constraints

- Không sửa trực tiếp trên working tree đang có thay đổi không liên quan. Khi bắt đầu triển khai phải tạo worktree/branch riêng, ví dụ `fix/canonical-quiz-scoring-v2`.
- Không dùng `git reset --hard`, `git clean`, không ghi đè thay đổi của task khác.
- Worker là nguồn điểm chính thức. Không tin `score`, `correctCount`, `isCorrect` hoặc `validationDetails` do client gửi.
- Sau rollout chỉ tồn tại một hàm chấm câu hỏi và một hàm chấm toàn bài dùng trong production. Bộ legacy chỉ được cách ly tạm thời trong shadow/rollback, không được thêm logic mới và phải xóa ở PR hậu rollout.
- Không thay đổi công thức điểm hiện tại: mỗi câu có trọng số bằng nhau, điểm thang 10, làm tròn một chữ số. Trường `points` chưa được đưa vào phạm vi này.
- Không tự động sửa hoặc ghi đè kết quả lịch sử. Chỉ tạo báo cáo chênh lệch; việc cập nhật lịch sử là bước riêng có phê duyệt.
- Không để câu hỏi không hỗ trợ bị âm thầm tính sai. Đề chứa câu không thể tự chấm phải bị chặn khi xuất bản hoặc API trả lỗi có mã rõ ràng.
- Không lộ đáp án đúng trong DTO dành cho học sinh hoặc response `/api/validate` dành cho role học sinh.
- Dữ liệu mới dùng `answerSchemaVersion = 2`; dữ liệu cũ không có version được đọc bằng adapter legacy.
- Tất cả lỗi đã tái hiện phải có regression test thất bại trước khi sửa: dropdown key, matching `l-N/r-N`, ordering object, multiple-select label/content.
- Mọi task tác động route API phải chạy `gitNexus.api_impact` trên index mới trước khi sửa. GitNexus hiện đang cũ; không được xem báo cáo index cũ là bằng chứng đầy đủ.

---

## Canonical Contracts

### Public answer payloads produced by renderers

```ts
export type QuizAnswer =
  | { type: 'MCQ' | 'IMAGE_QUESTION'; optionId: string }
  | { type: 'MULTIPLE_SELECT'; optionIds: string[] }
  | { type: 'SHORT_ANSWER' | 'RIDDLE'; value: string }
  | { type: 'SHORT_ANSWER_INLINE'; values: Record<string, string> }
  | { type: 'TRUE_FALSE'; values: Record<string, boolean> }
  | { type: 'MATCHING'; pairs: Record<string, string> }
  | { type: 'DROPDOWN' | 'DRAG_DROP'; values: Record<string, string> }
  | { type: 'ORDERING'; ranks: Record<string, number> }
  | { type: 'UNDERLINE'; indexes: number[] }
  | { type: 'CATEGORIZATION'; categoriesByItemId: Record<string, string> }
  | { type: 'WORD_SCRAMBLE'; letterIndexes: number[] }
  | { type: 'ERROR_CORRECTION'; wrongWord: string; correctWord: string };
```

`GEOMETRY` không được tự chấm trong V2 nếu chưa có `answerMode` và `correctAnswer` rõ ràng. Đề mới chứa `GEOMETRY` phải bị chặn xuất bản với mã `QUESTION_NOT_AUTO_GRADABLE`. Đề cũ phải được audit trước rollout; không âm thầm cho 0 điểm.

### Internal grading result

```ts
export type GradingStatus = 'correct' | 'wrong' | 'skipped' | 'invalid';

export interface QuestionGradingResult {
  questionId: string;
  type: string;
  status: GradingStatus;
  isCorrect: boolean;
  normalizedStudentAnswer: unknown;
  issueCode?: string;
}

export interface QuizGradingResult {
  engineVersion: '2.0.0';
  answerSchemaVersion: 2;
  score: number;
  correctCount: number;
  totalQuestions: number;
  details: QuestionGradingResult[];
  issues: Array<{ questionId: string; code: string; message: string }>;
}
```

### Canonical identity rules

- MCQ/IMAGE/MULTIPLE_SELECT: `option-0`, `option-1`, ...; adapter chấp nhận legacy `A`, `A.`, index số hoặc nội dung phương án.
- TRUE_FALSE: dùng `item.id`; nếu thiếu thì `item-0`, `item-1`, ...
- MATCHING: dùng `left-0`, `right-0`, ...; adapter chấp nhận `l-0/r-0`, nội dung→nội dung và DTO cũ.
- DROPDOWN/DRAG_DROP: source of truth là `blanks[index].id`; nếu thiếu thì `blank-0`, `blank-1`, ... Renderer ánh xạ placeholder theo thứ tự xuất hiện sang ID này, không tự biến `[blank_0]` thành `0`.
- ORDERING: dùng `item-0`, `item-1`, ... làm key của `ranks`; adapter chấp nhận object key số và array thứ tự cũ.
- CATEGORIZATION: dùng `item.id` và `category.id`; thiếu ID là dữ liệu không hợp lệ, không tự so sánh bằng nội dung.

---

## File Map

### Create

- `src/domain/quiz-scoring/types.ts`
- `src/domain/quiz-scoring/questionIdentity.ts`
- `src/domain/quiz-scoring/legacyAnswerAdapters.ts`
- `src/domain/quiz-scoring/normalizeQuestion.ts`
- `src/domain/quiz-scoring/normalizeAnswer.ts`
- `src/domain/quiz-scoring/gradeQuestion.ts`
- `src/domain/quiz-scoring/gradeQuiz.ts`
- `src/domain/quiz-scoring/answerCompleteness.ts`
- `src/domain/quiz-scoring/index.ts`
- `workers/src/services/quizGradingService.ts`
- `workers/src/services/legacyQuizGrader.ts` (tạm thời cho shadow/rollback, xóa sau rollout)
- `workers/migrations/0058_canonical_quiz_scoring_v2.sql`
- `workers/scripts/audit-scoring-contracts.cjs`
- `workers/scripts/report-result-regrading.cjs`
- `tests/quizScoringContract.test.ts`
- `tests/quizScoringLegacyCompatibility.test.ts`
- `tests/quizScoringSecurity.worker.test.ts`
- `tests/resultSubmissionAuthoritativeScoring.worker.test.ts`
- `tests/liveExamScoringParity.test.ts`
- `tests/QuestionRendererAnswerContract.test.tsx`
- `cypress/e2e/question-scoring-matrix.cy.ts`
- `docs/architecture/quiz-scoring-contract.md`

### Modify

- `src/features/quiz-player/utils/quizScoring.ts`
- `src/utils/question/scoring.util.ts`
- `src/utils/statisticsUtils.ts`
- `src/features/quiz-player/hooks/useQuizPlayer.ts`
- `src/components/LiveExam/LiveExamQuiz.tsx`
- `src/features/quiz-player/components/QuestionRenderer/index.tsx`
- `src/features/quiz-player/components/QuestionRenderer/atoms/InteractiveMathText.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/MCQRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/MultipleSelectRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/MatchingRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/FillInTheBlankRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/OrderingRenderer.tsx`
- renderer của TRUE_FALSE, UNDERLINE, CATEGORIZATION, WORD_SCRAMBLE, RIDDLE, ERROR_CORRECTION khi cần đổi payload
- `src/features/manual-quiz-workspace/validation/questionValidators.ts`
- `src/domain/quiz/quizSerializer.ts`
- `stores/quizStore.ts`
- `workers/src/utils/helpers.ts`
- `workers/src/routes/results.ts`
- `workers/src/routes/quizzes.ts`
- `workers/src/services/liveExamQuestionMapper.ts`
- `workers/src/services/liveExam/scoringService.ts`
- `workers/src/services/liveExam/submissionService.ts`
- `workers/src/services/liveExamAnalyticsService.ts`
- `workers/schema.sql`
- `workers/src/types.ts`
- `package.json`

---

## Phase 0 — Isolation and Baseline

### Task 1: Tạo môi trường triển khai cô lập và đóng băng baseline

**Files:** Không sửa production code.

- [ ] Chạy `git status --short`, lưu lại danh sách thay đổi hiện có. Hiện đã biết có thay đổi `.gitignore` và file plan icon; không đưa chúng vào branch scoring.
- [ ] Tạo worktree/branch riêng bằng skill `using-git-worktrees` từ đúng HEAD đã được xác nhận.
- [ ] Cập nhật GitNexus index cho worktree mới trước khi dùng `api_impact`.
- [ ] Chạy baseline:

```bash
npm run typecheck
npm run typecheck:workers
npx vitest run tests/scoring.test.ts tests/liveExamNumericAnswerScoring.test.ts
npm run build
```

- [ ] Ghi lại test/build fail có sẵn; không sửa nợ kỹ thuật ngoài scoring trong cùng branch.
- [ ] Commit: không commit nếu chưa có thay đổi.

**Exit criteria:** Worktree sạch, baseline có log, root đúng `C:\quizpro`, branch riêng đúng mục đích.

---

## Phase 1 — Contract First and Failing Tests

### Task 2: Viết tài liệu hợp đồng và bảng golden cases cho toàn bộ loại câu hỏi

**Files:**
- Create: `docs/architecture/quiz-scoring-contract.md`
- Create: `tests/quizScoringContract.test.ts`

- [ ] Tài liệu phải mô tả chính xác question shape, answer payload, canonical identity, skipped rule và legacy inputs cho từng loại.
- [ ] Tạo table-driven fixtures tối thiểu gồm: đúng, sai, bỏ qua, lệch kiểu string/number, khoảng trắng, ID legacy.
- [ ] Bắt buộc có bốn test tái hiện đã xác nhận:

```ts
it('grades dropdown when UI placeholder key differs from stored blank id');
it('grades matching answers sent as l-N/r-N ids');
it('grades ordering answers sent as rank object');
it('maps multiple-select option labels to stored option content');
```

- [ ] Bổ sung test cho MCQ đáp án lưu dạng nhãn và nội dung; matching có nội dung trùng phải dựa trên ID; dropdown có hai blank; drag-drop có đáp án trùng; ordering thiếu/trùng rank; true/false thiếu một item; categorization thiếu item; word scramble có ký tự trùng.
- [ ] Chạy test và xác nhận RED vì module V2 chưa tồn tại:

```bash
npx vitest run tests/quizScoringContract.test.ts
```

Expected: FAIL do import/module hoặc behavior chưa tồn tại, không phải lỗi syntax.

- [ ] Commit:

```bash
git add docs/architecture/quiz-scoring-contract.md tests/quizScoringContract.test.ts
git commit -m "test: define canonical quiz scoring contract"
```

---

### Task 3: Viết regression test cho dữ liệu cũ trước khi tạo adapter

**Files:**
- Create: `tests/quizScoringLegacyCompatibility.test.ts`

- [ ] Test các input cũ hiện đang tồn tại:
  - MCQ: `A`, `A. nội dung`, nội dung phương án, số dạng chuỗi.
  - MULTIPLE_SELECT: array nhãn, array nội dung, JSON string, pipe string.
  - MATCHING: content map, `l-0/r-0`, `left-0/right-0`, metadata `selectedLeft`, `__shuffledIds`.
  - DROPDOWN: key `0`, `1`, key raw placeholder, `blank.id`.
  - DRAG_DROP: object theo placeholder index và array cũ.
  - ORDERING: correctOrder array, answer array, rank object numeric keys, rank object item IDs.
  - Result answer nested `{ selectedAnswer, isCorrect, questionSnapshot }`.
- [ ] Test phải chỉ chấp nhận legacy khi có thể ánh xạ không mơ hồ. Nội dung trùng dẫn đến mapping mơ hồ phải trả `invalid`, không đoán.
- [ ] Chạy và xác nhận RED.
- [ ] Commit test riêng.

---

## Phase 2 — One Pure Scoring Engine

### Task 4: Tạo types, identity helpers và question normalization

**Files:**
- Create: `src/domain/quiz-scoring/types.ts`
- Create: `src/domain/quiz-scoring/questionIdentity.ts`
- Create: `src/domain/quiz-scoring/normalizeQuestion.ts`
- Test: `tests/quizScoringContract.test.ts`

**Produces:**

```ts
export function getOptionId(index: number): string;
export function getMatchingLeftId(index: number): string;
export function getMatchingRightId(index: number): string;
export function getBlankId(question: unknown, index: number): string;
export function normalizeQuestionForGrading(question: unknown): NormalizedQuestionResult;
```

- [ ] Viết từng test identity trước; chạy RED; triển khai tối thiểu; chạy GREEN.
- [ ] `normalizeQuestionForGrading` không đọc React state, DOM, D1 hay environment.
- [ ] Dữ liệu thiếu/mơ hồ trả issue code rõ ràng, ví dụ `DUPLICATE_OPTION_CONTENT`, `DUPLICATE_MATCHING_CONTENT`, `MISSING_BLANK_ID`, `UNSUPPORTED_QUESTION_TYPE`.
- [ ] Không dùng `any` trong public interface của module.
- [ ] Chạy:

```bash
npx vitest run tests/quizScoringContract.test.ts
npm run typecheck
npm run typecheck:workers
```

- [ ] Commit: `feat: add canonical grading question model`.

---

### Task 5: Tạo legacy answer adapters và answer normalization

**Files:**
- Create: `src/domain/quiz-scoring/legacyAnswerAdapters.ts`
- Create: `src/domain/quiz-scoring/normalizeAnswer.ts`
- Test: `tests/quizScoringLegacyCompatibility.test.ts`

**Produces:**

```ts
export function unwrapStoredResultAnswer(value: unknown): unknown;
export function normalizeAnswerForQuestion(
  question: NormalizedGradableQuestion,
  answer: unknown,
): NormalizedAnswerResult;
```

- [ ] Adapter chỉ làm chuyển đổi shape; không tự quyết định đúng/sai.
- [ ] Khi mapping bằng nội dung, chỉ chấp nhận nếu nội dung sau normalize là duy nhất.
- [ ] Bỏ metadata UI `selectedLeft`, `__shuffledIds`; không tính metadata là câu đã trả lời.
- [ ] Dropdown/drag-drop ưu tiên `blank.id`, sau đó raw token, cuối cùng occurrence index khi mapping một-một rõ ràng.
- [ ] Ordering chuyển mọi legacy shape về `Record<itemId, rank>` và kiểm tra rank nguyên, trong khoảng, không trùng.
- [ ] Multiple-select loại trùng, sort theo option index và từ chối lựa chọn không tồn tại.
- [ ] Chạy test legacy tới GREEN.
- [ ] Commit: `feat: normalize legacy quiz answers`.

---

### Task 6: Tạo `gradeQuestion`, `gradeQuiz` và completeness dùng chung

**Files:**
- Create: `src/domain/quiz-scoring/gradeQuestion.ts`
- Create: `src/domain/quiz-scoring/gradeQuiz.ts`
- Create: `src/domain/quiz-scoring/answerCompleteness.ts`
- Create: `src/domain/quiz-scoring/index.ts`
- Test: contract + legacy tests

**Produces:**

```ts
export function gradeQuestion(question: unknown, answer: unknown): QuestionGradingResult;
export function gradeQuiz(quiz: QuizLike, answers: Record<string, unknown>): QuizGradingResult;
export function isQuestionAnswered(question: unknown, answer: unknown): boolean;
```

- [ ] `gradeQuestion` là nơi duy nhất chứa switch theo question type.
- [ ] `gradeQuiz` gọi `gradeQuestion`, không tái hiện logic từng loại.
- [ ] `skipped` luôn `isCorrect: false` nhưng không đồng nghĩa `invalid`.
- [ ] Nếu question normalization trả issue, `gradeQuiz.issues` phải chứa issue và caller phía server phải chặn lưu điểm.
- [ ] Giữ công thức `(correctCount / totalQuestions) * 10`, `toFixed(1)` tương đương behavior hiện tại.
- [ ] Thêm test mọi type đủ/thiếu đáp án cho `isQuestionAnswered`.
- [ ] Chạy full focused test và typecheck.
- [ ] Commit: `feat: add single canonical quiz grading engine`.

**Checkpoint A:** Không tiếp tục nếu contract tests và legacy tests chưa xanh hoàn toàn.

---

## Phase 3 — Renderer and Authoring Contracts

### Task 7: Sửa blank resolver cho Dropdown, Drag-drop và Short Answer Inline

**Files:**
- Modify: `InteractiveMathText.tsx`
- Modify: `FillInTheBlankRenderer.tsx`
- Create/Modify: `tests/QuestionRendererAnswerContract.test.tsx`

- [ ] Viết test render text `[blank_0]`, `[1]`, `[answer_name]` với `blanks[].id` khác token.
- [ ] Tách parser hiển thị khỏi identity: parser trả occurrence index + raw token; renderer resolve occurrence sang `blanks[index].id`.
- [ ] Không dùng `String(sequential++)` làm answer key khi `blanks` đã có ID.
- [ ] Nếu số placeholder khác số blank, renderer hiển thị cảnh báo dữ liệu không hợp lệ và không cho nộp; không tự bỏ qua blank dư.
- [ ] Với DTO drag-drop đã ẩn đáp án, renderer nhận `blanks: [{ id }]` và `choices: string[]`; không nhận `correctAnswer`, nhưng key ô trống vẫn ổn định.
- [ ] Chạy component test, contract test và visual math regression liên quan.
- [ ] Commit: `fix: preserve canonical blank ids in quiz answers`.

---

### Task 8: Chuẩn hóa payload của MCQ, Multiple Select, Matching và Ordering

**Files:**
- Modify renderer tương ứng
- Modify `QuestionRendererAnswerContract.test.tsx`

- [ ] MCQ/IMAGE gửi `{ type, optionId: 'option-N' }`; selected state vẫn hỗ trợ answer legacy khi resume draft.
- [ ] MULTIPLE_SELECT gửi sorted unique `optionIds`.
- [ ] MATCHING gửi `{ type: 'MATCHING', pairs: { 'left-N': 'right-M' } }`; shuffle chỉ thay thứ tự hiển thị, không đổi ID.
- [ ] Khi cột phải đã được nối, lựa chọn nối lại phải thay cặp cũ thay vì để một right ID thuộc nhiều left ID.
- [ ] ORDERING dùng stable item IDs trong `ranks`; validation UI phát hiện rank trùng hoặc thiếu.
- [ ] Regression test phải chứng minh shuffle/rerender không đổi selected answer.
- [ ] Commit: `fix: emit canonical answers for structured question types`.

---

### Task 9: Hoàn thiện renderer và completeness cho tất cả loại còn lại

**Files:**
- Modify `QuestionRenderer/index.tsx`
- Create renderer nếu chưa có cho `WORD_SCRAMBLE`, `RIDDLE`, `ERROR_CORRECTION`
- Modify `useQuizPlayer.ts`, `LiveExamQuiz.tsx`
- Test component contract

- [ ] Không để type hợp lệ rơi về `MCQRenderer` mặc định. Unknown type hiển thị `UnsupportedQuestionRenderer` và chặn nộp.
- [ ] `WORD_SCRAMBLE` phát answer indices, không phát chuỗi ghép nếu ký tự trùng.
- [ ] `RIDDLE` phát text value.
- [ ] SHORT_ANSWER có `correctAnswers`/placeholder được route sang renderer inline và phát `SHORT_ANSWER_INLINE`; short answer đơn vẫn dùng input text.
- [ ] `ERROR_CORRECTION` phát object hai trường.
- [ ] `CATEGORIZATION`, TRUE_FALSE, UNDERLINE dùng đúng canonical key.
- [ ] Xóa hai bản `isQuestionAnswered`; import từ `src/domain/quiz-scoring` cho quiz thường và live exam.
- [ ] GEOMETRY hiển thị cảnh báo không tự chấm trong legacy viewer; không xuất hiện trong picker đề mới và validator chặn publish.
- [ ] Commit: `fix: complete question renderer answer coverage`.

---

### Task 10: Siết validation và serialization khi tạo/chỉnh sửa đề

**Files:**
- Modify `questionValidators.ts`
- Modify `quizSerializer.ts`
- Modify `stores/quizStore.ts`
- Modify worker save mapping/routes
- Add tests to `manualQuizValidation.test.ts` and save/round-trip tests

- [ ] Dropdown/drag-drop: số placeholder bằng số blanks; IDs không rỗng, không trùng; correct answer thuộc options/pool.
- [ ] Với DRAG_DROP schema V2, chuẩn hóa `blanks` thành object `{ id, correctAnswer }[]`; adapter vẫn đọc `string[]` legacy. Student DTO chỉ trả `{ id }[]` và pool `choices` đã shuffle.
- [ ] Matching: identity dựa trên index/ID ổn định, vì vậy V2 cho phép nội dung trùng. Chỉ các result legacy dạng content-map bị đánh dấu không thể ánh xạ nếu nội dung trùng; không đoán.
- [ ] MCQ/multiple-select: chuẩn hóa correct answer về option IDs trước khi lưu dữ liệu version 2.
- [ ] Ordering: correctOrder chứa đủ mỗi item đúng một lần.
- [ ] New questions save `answer_schema_version = 2`; duplicate/version copy giữ version.
- [ ] `sanitizeQuestionForStudent` giữ ID/options cần để làm bài nhưng loại toàn bộ correct fields.
- [ ] Viết round-trip test: editor model → D1 row → student DTO → renderer answer → grader.
- [ ] Commit: `feat: enforce grading contracts at quiz authoring boundary`.

**Checkpoint B:** Tạo một quiz fixture có đủ mọi type hỗ trợ, save/load lại và contract tests vẫn xanh.

---

## Phase 4 — Server-Authoritative Scoring

### Task 11: Tạo `quizGradingService` phía Worker

**Files:**
- Create `workers/src/services/quizGradingService.ts`
- Modify imports trong Worker
- Tests worker service

**Produces:**

```ts
export async function loadQuizForGrading(db: D1Database, quizId: string): Promise<QuizLike>;
export async function gradeQuizSubmission(
  db: D1Database,
  quizId: string,
  rawAnswers: Record<string, unknown>,
): Promise<QuizGradingResult>;
export function buildStoredAnswerSnapshots(...): Record<string, StoredAnswerDetail>;
```

- [ ] Loader phải dùng một mapper chuẩn, không có mapper khác cho `/api/validate` và live exam.
- [ ] Stored snapshot do Worker tạo từ DB, không nhận `questionSnapshot` từ client.
- [ ] Snapshot lưu trong result chỉ chứa nội dung an toàn cần xem lại và `isCorrect`; không nhúng correct answer. Correct answer chỉ được resolve ở review endpoint sau khi kiểm tra role và chính sách xem đáp án của assignment/quiz.
- [ ] Student validation response không chứa `correctAnswer`; teacher response chỉ chứa khi quyền đã được kiểm tra.
- [ ] Issues làm API trả 422 với code `QUIZ_GRADING_CONTRACT_INVALID`, không lưu điểm 0 giả.
- [ ] Commit: `feat: add authoritative worker grading service`.

---

### Task 12: Thay `/api/validate` bằng shared service, giữ response backward compatible

**Files:**
- Modify `workers/src/utils/helpers.ts`
- Modify `workers/src/routes/results.ts`
- Modify `quizValidationService.ts`
- Create/modify security tests

- [ ] Trước sửa chạy `gitNexus.api_impact` cho route trên index mới.
- [ ] `handleValidateAnswers` cũ trở thành thin wrapper hoặc bị xóa sau khi toàn bộ caller chuyển sang `gradeQuizSubmission`.
- [ ] Response vẫn giữ `status`, `score`, `correctCount`, `total`, `details`; bổ sung additive `engineVersion` và `answerSchemaVersion`.
- [ ] Student details chỉ có `questionId`, `status`, `isCorrect`; không có correct answer hoặc normalized correct data.
- [ ] Test role student/teacher, quiz không tồn tại, malformed answer, invalid question contract.
- [ ] Commit: `refactor: route answer validation through canonical grader`.

---

### Task 13: Làm `POST /api/results` tự chấm và bỏ tin điểm client

**Dependency bắt buộc:** Task 16/ migration `0058_canonical_quiz_scoring_v2.sql` phải được áp dụng trước khi code INSERT/UPDATE bắt đầu ghi `grading_version`.

**Files:**
- Modify `workers/src/routes/results.ts`
- Modify client submit flow/store
- Create `resultSubmissionAuthoritativeScoring.worker.test.ts`

- [ ] Test RED gửi `score: 10`, `correctCount: 99`, nested `isCorrect: true` nhưng raw answer sai; server phải lưu điểm đúng theo DB.
- [ ] Server extract raw answer từ payload V2; với client cũ unwrap `selectedAnswer` nhưng bỏ `isCorrect` và snapshot client.
- [ ] Server gọi `gradeQuizSubmission` trong cùng request trước INSERT.
- [ ] INSERT dùng score/count/total/details do server tạo, lưu `grading_version = '2.0.0'`.
- [ ] API response trả authoritative result gồm `resultId`, `score`, `correctCount`, `totalQuestions`, `gradingVersion`.
- [ ] `useQuizPlayer` bỏ `clientOverrideTypes`, bỏ merge `clientIsCorrect || serverIsCorrect`, và dùng result server trả về.
- [ ] Không gọi validate rồi lại tin kết quả client. Có thể giữ validate cho UX, nhưng POST results vẫn phải chấm độc lập.
- [ ] Parent notification dùng metrics server.
- [ ] Commit: `security: make result scoring server authoritative`.

---

### Task 14: Chuyển thi trực tiếp và analytics sang cùng engine/service

**Files:**
- Modify live exam loader/mapper/scoring/submission/analytics
- Create `tests/liveExamScoringParity.test.ts`

- [ ] `submissionService`, auto close và analytics đều gọi cùng `gradeQuiz` hoặc `gradeQuizSubmission`; không copy logic.
- [ ] Live exam question mapper tạo cùng normalized question identity như quiz thường.
- [ ] Test cùng quiz + answers cho kết quả bằng nhau giữa `/api/validate`, `/api/results` và live exam.
- [ ] Test idempotent replay không đổi score/grading version.
- [ ] Commit: `refactor: unify live exam and quiz scoring`.

**Checkpoint C:** API thường và live exam cho cùng score/details trên golden fixtures.

---

## Phase 5 — Remove Duplicate Graders from Read Paths

### Task 15: Biến các scorer frontend cũ thành compatibility facade rồi loại bỏ logic trùng

**Files:**
- Modify `quizScoring.ts`
- Modify `scoring.util.ts`
- Modify `statisticsUtils.ts`
- Modify result table/detail/review consumers

- [ ] `calculateStudentScore` chỉ gọi `gradeQuiz`; không còn switch riêng.
- [ ] `checkAnswer` chỉ gọi `gradeQuestion` và map result về interface cũ trong giai đoạn chuyển tiếp.
- [ ] `calculateIsCorrectFallback` chỉ gọi facade shared; không chứa nhánh từng type.
- [ ] Màn hình giáo viên ưu tiên `isCorrect` do server lưu. Chỉ fallback shared engine cho result legacy chưa có boolean.
- [ ] Thêm test cùng một stored result hiển thị cùng correct count ở bảng, chi tiết học sinh và question review.
- [ ] Đánh dấu facade deprecated; chỉ xóa sau khi search toàn repo không còn consumer legacy.
- [ ] Commit: `refactor: remove duplicate frontend grading logic`.

---

## Phase 6 — Database Versioning and Legacy Audit

> **Execution note:** Task 16 phải được triển khai và xác minh trước Task 13. Nó nằm trong phase riêng để dễ review DB, nhưng là dependency hạ tầng của server-authoritative persistence.

### Task 16: Thêm migration versioning không phá dữ liệu

**Files:**
- Create D1 migration
- Modify schema/types/insert/select mappings

Migration chỉ ADD COLUMN:

```sql
ALTER TABLE questions ADD COLUMN answer_schema_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE results ADD COLUMN grading_version TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE live_exam_participants ADD COLUMN grading_version TEXT;
```

- [ ] Không rewrite `correct_answer`, `items`, `blanks` trong migration này.
- [ ] New writes dùng version 2; old rows giữ version 1.
- [ ] Safe migration script chạy local/staging, kiểm tra column tồn tại và rollback strategy là không đọc column mới nếu flag tắt.
- [ ] Commit: `db: add quiz scoring schema versions`.

---

### Task 17: Viết audit dữ liệu câu hỏi production ở chế độ read-only

**Files:**
- Create `workers/scripts/audit-scoring-contracts.cjs`
- Add package script `audit:scoring-contracts`

- [ ] Script thống kê theo type/version và phát hiện: blank mismatch, duplicate IDs/content, invalid correct option, malformed JSON, ordering permutation sai, geometry/unknown type.
- [ ] Mặc định chỉ đọc và xuất JSON + Markdown; muốn sửa phải là script khác có flag rõ ràng.
- [ ] Không in thông tin cá nhân học sinh.
- [ ] Chạy local và staging; production chỉ chạy sau backup D1.
- [ ] Exit code khác 0 nếu có `blocker`, nhưng report vẫn được ghi.
- [ ] Commit: `chore: add read-only scoring contract audit`.

---

### Task 18: Báo cáo regrade kết quả lịch sử, không tự cập nhật

**Files:**
- Create `workers/scripts/report-result-regrading.cjs`

- [ ] Với mỗi result có raw answers và quiz còn tồn tại, chấm bằng V2 và so sánh score/count hiện tại.
- [ ] Xuất tổng số ảnh hưởng, theo quiz/type, mức chênh điểm; không ghi DB.
- [ ] Kết quả không thể regrade do quiz đã xóa/snapshot thiếu được ghi `UNREGRADABLE`, không đoán.
- [ ] Việc update lịch sử nếu cần phải là plan/approval riêng, backup trước, idempotent và audit log.
- [ ] Commit: `chore: add historical result regrade report`.

---

## Phase 7 — Full Verification and Rollout

### Task 19: Xây ma trận E2E cho mọi dạng câu hỏi hỗ trợ

**Files:**
- Create `cypress/e2e/question-scoring-matrix.cy.ts`
- Add API/component fixtures as needed

- [ ] Tạo quiz fixture có mọi type auto-gradable; mỗi type có một câu đúng và một biến thể sai.
- [ ] Chạy ít nhất hai đường: quiz thường/assignment và live exam.
- [ ] Sau submit kiểm tra UI kết quả, API response, row DB/test double và màn hình giáo viên cùng score/count.
- [ ] Bắt buộc xác nhận dropdown `[blank_0]`, matching shuffled, multiple select content-based legacy, ordering rank object.
- [ ] Không dùng production data.
- [ ] Commit: `test: add end-to-end scoring matrix`.

---

### Task 20: Quality gate đầy đủ

Run theo thứ tự:

```bash
npm run lint
npm run typecheck
npm run typecheck:strict
npm run typecheck:workers
npx vitest run tests/quizScoringContract.test.ts tests/quizScoringLegacyCompatibility.test.ts tests/quizScoringSecurity.worker.test.ts tests/resultSubmissionAuthoritativeScoring.worker.test.ts tests/liveExamScoringParity.test.ts tests/QuestionRendererAnswerContract.test.tsx
npm run test:ci:all
npm run build
npm run security:check
```

Sau đó browser test:

```bash
npm run cypress:run -- --spec cypress/e2e/question-scoring-matrix.cy.ts
```

- [ ] Không warning mới liên quan scoring.
- [ ] Search repo xác nhận switch chấm theo question type chỉ còn trong `gradeQuestion.ts`.
- [ ] `gitNexus.detect_changes` và code review không có consumer route bị bỏ sót.
- [ ] Commit chỉ khi có điều chỉnh từ quality gate: `test: verify canonical quiz scoring rollout`.

---

### Task 21: Rollout có shadow comparison và rollback rõ ràng

Dùng control plane hiện có từ migration `0054_feature_rollout_control_plane.sql` với feature key `canonical_quiz_scoring_v2`; environment kill switch chỉ là lớp khẩn cấp cuối cùng.

```ts
type ScoringMode = 'legacy' | 'shadow' | 'canonical';
```

- [ ] Di chuyển logic chấm cũ nguyên trạng vào `legacyQuizGrader.ts`; file này chỉ được gọi trong `legacy`/`shadow`, không nhận feature mới.
- [ ] Staging dùng `shadow`: chạy V2 và legacy, không thay score; log chênh lệch theo code/type, không log PII/answer text.
- [ ] Chạy toàn bộ fixture và audit staging. Chỉ chuyển canonical khi mọi chênh lệch đã được giải thích; các chênh lệch do bug legacy là expected và có regression test.
- [ ] Production rollout đầu tiên cho quiz `answer_schema_version = 2` hoặc allowlist quiz kiểm thử nội bộ.
- [ ] Theo dõi tỷ lệ `invalid`, lỗi 422, chênh score, submit failure và live exam failure.
- [ ] Mở rộng 10% → 50% → 100% theo quiz/cohort, không theo random request của cùng một bài thi.
- [ ] Rollback bằng `SCORING_MODE=legacy` chỉ là biện pháp khẩn cấp; dữ liệu version 2 vẫn phải được adapter legacy đọc hoặc rollout không được bật.
- [ ] Sau tối thiểu một chu kỳ ổn định, bỏ legacy mode trong PR riêng; không xóa cùng PR triển khai V2.

---

## Risk Register

| Risk | Mức | Biện pháp bắt buộc |
|---|---|---|
| Sửa từng type nhưng bỏ sót một luồng chấm | Rất cao | Một pure engine; repo search và parity tests |
| Client giả mạo `isCorrect/score` | Rất cao | POST results tự chấm và tự tạo snapshot |
| Dữ liệu cũ nhiều shape | Rất cao | Versioned legacy adapters + golden fixtures + audit |
| Dropdown placeholder/blank ID lệch | Cao | Resolve theo `blanks[index].id`, validation count/ID |
| Matching shuffle đổi identity | Cao | Stable left/right IDs tách khỏi display order |
| Nội dung option/pair trùng | Cao | Không mapping bằng content khi mơ hồ; validator chặn dữ liệu mới |
| Kết quả lịch sử đổi ngoài ý muốn | Cao | Report-only, không auto update |
| Geometry bị tính sai | Cao | Chặn auto-grade/publish, không tính 0 âm thầm |
| Lộ đáp án qua DTO/API | Cao | Security tests cho student role |
| Rollout giữa ca thi trực tiếp | Cao | Cohort theo quiz/session; không đổi engine giữa một session |
| GitNexus index cũ | Trung bình | Re-index trước impact report, kết hợp search/test thực tế |
| Branch hiện có thay đổi khác | Trung bình | Worktree riêng, commit path cụ thể |

---

## Definition of Done

- Cùng một quiz/answers cho cùng `score`, `correctCount`, `details` ở quiz thường, assignment, live exam, analytics và teacher review.
- Dropdown và matching đã tái hiện được lỗi cũ bằng test, rồi test xanh sau sửa.
- Multiple-select và ordering có test cho đúng shape UI thực tế.
- `POST /api/results` không thể bị thay đổi điểm bằng cách gửi score/isCorrect giả.
- Không còn production switch chấm điểm trùng ngoài `gradeQuestion.ts`.
- Mọi type trong picker hoặc được chấm đúng, hoặc bị chặn rõ ràng trước publish.
- Student DTO và validation response không lộ đáp án đúng.
- Dữ liệu legacy được audit; dữ liệu mơ hồ không bị đoán.
- Không tự sửa kết quả lịch sử.
- Lint, frontend/worker typecheck, full Vitest, build, security gate và E2E scoring matrix đều PASS.
- Có feature mode/rollback và rollout không đổi engine giữa một ca thi.

## Recommended Execution Order

Thứ tự an toàn: Tasks 1–6 → Task 16 (migration) → Tasks 11–14 (Worker hiểu cả legacy và V2, điểm server-authoritative) → Tasks 7–10 (chuyển renderer/authoring sang payload V2) → Task 15 → Tasks 17–18 → Tasks 19–21. Không bật payload V2 ở frontend trước khi Worker canonical đã được deploy và xác nhận đọc được cả hai schema. Tasks 7–10 có thể chia hai agent sau khi contract đã merge; mọi thay đổi renderer phải review chung trước Checkpoint B.
