# Bỏ lời giải khỏi quy trình AI tạo đề Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại bỏ hoàn toàn việc AI tạo trường `explanation` trong luồng tạo đề, sửa đề, duyệt đề và tạo lại câu hỏi; đồng thời ẩn lời giải trong kết quả chi tiết phía giáo viên mà vẫn giữ tương thích với đề cũ và chức năng tạo lời giải thủ công.

**Architecture:** Giữ `explanation` là trường tùy chọn ở domain và cơ sở dữ liệu để dữ liệu cũ, nhập Word/Excel, ngân hàng câu hỏi và AI Tutor tiếp tục hoạt động. Thay đổi chỉ áp dụng tại biên AI: prompt không yêu cầu lời giải, schema chấp nhận câu không có lời giải, normalizer loại bỏ lời giải nếu nhà cung cấp vẫn tự trả về, audit/repair không xem thiếu lời giải là lỗi. Giao diện kết quả giáo viên dùng lại `QuestionReview` nhưng truyền `showExplanation={false}`; các màn hình khác vẫn có thể hiển thị lời giải khi chủ động yêu cầu.

**Tech Stack:** TypeScript, React 19, Vite, Vitest, Testing Library, Zod, Cloudflare Workers/D1, Cypress.

## Global Constraints

- Không tạo migration D1 và không xóa cột `questions.explanation`.
- Không xóa `explanation?: string` khỏi domain `Question`, schema lưu đề, import Word/Excel hoặc ngân hàng câu hỏi.
- Không xóa nút **“AI tạo lời giải”** trong trình soạn đề thủ công.
- Không thay đổi AI Tutor, `ExplanationModal`, Dr Owl hoặc nội dung luyện tập theo yêu cầu.
- Mọi prompt của luồng `QUIZ_CREATE`, `REPAIR`, `REVIEW` và `QUESTION_REGENERATE` phải cấm tạo trường JSON `explanation`.
- Nếu nhà cung cấp AI vẫn trả `explanation`, hệ thống phải loại bỏ trường này trước audit, review, domain mapping và lưu đề.
- Đề cũ có `explanation` vẫn phải đọc, chỉnh sửa, nhập, lưu và hiển thị ở các bề mặt được phép.
- Trang kết quả chi tiết học sinh phía giáo viên không được hiển thị lời giải, kể cả dữ liệu cũ có trường `explanation`.
- Không thay đổi API route hoặc payload phục vụ học sinh; cơ chế loại đáp án bí mật và lời giải khỏi payload học sinh vẫn giữ nguyên.
- Thực hiện TDD: mỗi thay đổi hành vi phải có test thất bại trước khi sửa production code.

---

## File Map

### Hợp đồng và schema AI

- `src/services/ai/schemas/quizGenerationSchema.ts`: làm `explanation` tùy chọn cho V2.
- `src/services/ai/question-contracts/questionContract.shared.ts`: làm `explanation` tùy chọn cho toàn bộ contract V3.
- `src/services/ai/question-contracts/questionContract.types.ts`: đổi `GeneratedQuestionCommonV3.explanation` thành optional.
- `src/services/ai/question-contracts/choiceQuestionContracts.ts`: bỏ `explanation` khỏi contract prompt và fixture chuẩn của MCQ, TRUE_FALSE, MULTIPLE_SELECT.
- `src/services/ai/question-contracts/completionQuestionContracts.ts`: bỏ `explanation` khỏi SHORT_ANSWER, DRAG_DROP, DROPDOWN.
- `src/services/ai/question-contracts/interactionQuestionContracts.ts`: bỏ `explanation` khỏi MATCHING, ORDERING, CATEGORIZATION.
- `src/services/ai/question-contracts/languageQuestionContracts.ts`: bỏ `explanation` khỏi UNDERLINE, WORD_SCRAMBLE, RIDDLE.
- `src/services/ai/question-contracts/imageQuestionContract.ts`: bỏ `explanation` khỏi IMAGE_QUESTION.

### Prompt và vòng đời AI

- `src/config/constants.ts`: xóa yêu cầu lời giải trong `SYSTEM_INSTRUCTION` và `REVIEWER_INSTRUCTION`.
- `src/services/ai/prompts/quizPromptBuilder.ts`: xóa prompt “mini bài giảng”, sửa intent EXAM/PRACTICE và JSON examples.
- `src/services/ai/prompts/slotPromptBuilder.ts`: đổi output contract V3 thành không tạo `explanation`.
- `src/services/ai/prompts/reviewerPromptBuilder.ts`: cấm reviewer V3 thêm `explanation`.
- `src/services/ai/prompts/questionRegenerationPrompt.ts`: không đưa lời giải cũ vào prompt tạo lại câu hỏi.
- `src/features/quiz-generator/hooks/useQuizGeneration.ts`: bỏ fallback `explanation` khi tạo projection cho regeneration.
- `src/services/ai/quizRepair.ts`: repair V2/V3 không yêu cầu lời giải.

### Chuẩn hóa, audit và mapping

- `src/services/ai/utils/jsonRepair.ts`: xóa `explanation` khỏi từng câu AI V2 trước schema/audit.
- `src/services/ai/schemas/generatedQuizV3Normalizer.ts`: xóa `explanation` khỏi từng câu AI V3 trước schema/audit.
- `src/services/ai/quizAudit.ts`: xóa mã lỗi và kiểm tra `MISSING_EXPLANATION` ở V2/V3.
- `src/services/ai/quizDomainAdapter.ts`: phòng thủ lần cuối, không map `explanation` từ V3 sang domain.

### Giao diện giáo viên

- `src/components/teacher/ResultsView/student-detail/components/QuestionDetailPanel.tsx`: truyền `showExplanation={false}`.

### Test

- `tests/quizGenerationSchema.test.ts`
- `tests/quizGenerationSchemaV3.test.ts`
- `tests/aiQuestionContractRegistry.integration.test.ts`
- `tests/quizPromptBuilder.test.ts`
- `tests/quizPromptBuilderV3.test.ts`
- `tests/quizAudit.test.ts`
- `tests/quizSlotAudit.test.ts`
- `tests/quizRepair.test.ts`
- `tests/quizSlotRepair.test.ts`
- `tests/questionRegenerationPrompt.test.ts`
- `tests/questionSchemaCoverage.test.ts`
- `tests/quizGenerationPipeline.test.ts`
- `tests/quizGenerationPipelineV3.test.ts`
- `tests/helpers/aiBlueprintV3Fixtures.ts`
- Create: `tests/aiGeneratedExplanationPolicy.test.ts`
- Create: `tests/TeacherQuestionDetailPanel.test.tsx`
- Regression only, không sửa hành vi: `tests/BulkQuestionActions.test.tsx`, `tests/QuestionReview.test.tsx`, `tests/questionImporters.test.ts`, `tests/quizRoutes.authoringFields.worker.test.ts`.

---

### Task 1: Làm lời giải thành metadata tùy chọn trong contract AI

**Files:**
- Modify: `src/services/ai/schemas/quizGenerationSchema.ts:8-20`
- Modify: `src/services/ai/question-contracts/questionContract.shared.ts:3-18`
- Modify: `src/services/ai/question-contracts/questionContract.types.ts:34-40`
- Modify: `tests/quizGenerationSchema.test.ts:1-128`
- Modify: `tests/quizGenerationSchemaV3.test.ts:1-58`
- Test: `tests/aiQuestionContractRegistry.integration.test.ts`

**Interfaces:**
- Consumes: `GeneratedQuizSchema`, `GeneratedQuizV3Schema`, `CommonGeneratedQuestionFields` hiện tại.
- Produces: `GeneratedQuestion.explanation?: string` và `GeneratedQuestionV3.explanation?: string`; dữ liệu có hoặc không có lời giải đều parse được.

- [ ] **Step 1: Viết test V2 thất bại khi câu hợp lệ không có lời giải**

Trong `tests/quizGenerationSchema.test.ts`, đổi helper chung thành:

```ts
const common = {
  difficultyLevel: 2,
};
```

Thêm test tương thích ngược:

```ts
it('accepts legacy explanations when they are still present', () => {
  const parsed = parseGeneratedQuiz({
    title: 'Đề cũ',
    questions: [{
      type: 'MCQ',
      question: '1 + 1 = ?',
      options: ['1', '2'],
      correctAnswer: 'B',
      difficultyLevel: 1,
      explanation: 'Một cộng một bằng hai.',
    }],
  });

  expect(parsed.questions[0].explanation).toBe('Một cộng một bằng hai.');
});
```

- [ ] **Step 2: Viết test V3 thất bại khi cả 13 dạng không có lời giải**

Trong `tests/quizGenerationSchemaV3.test.ts`, thêm helper:

```ts
const omitExplanation = (value: Record<string, unknown>): Record<string, unknown> => {
  const copy = { ...value };
  delete copy.explanation;
  return copy;
};
```

Sửa `makeAllTypeQuiz`:

```ts
const makeAllTypeQuiz = () => ({
  promptVersion: 'ai-blueprint-v3' as const,
  blueprintVersion: 3 as const,
  title: 'Đề 13 dạng',
  questions: AI_SELECTABLE_QUESTION_TYPES.map((type, index) => ({
    ...omitExplanation(getAiQuestionContract(type).validFixture as Record<string, unknown>),
    slotId: `slot-${index + 1}`,
    type,
    difficulty: ((index % 3) + 1) as 1 | 2 | 3,
  })),
});
```

Thêm test legacy:

```ts
it('still accepts an optional legacy explanation', () => {
  const quiz = makeAllTypeQuiz();
  quiz.questions[0] = {
    ...quiz.questions[0],
    explanation: 'Lời giải cũ vẫn hợp lệ.',
  };

  expect(parseGeneratedQuizV3(quiz).questions[0].explanation).toBe('Lời giải cũ vẫn hợp lệ.');
});
```

- [ ] **Step 3: Chạy test để xác nhận RED**

Run:

```bash
npx vitest run tests/quizGenerationSchema.test.ts tests/quizGenerationSchemaV3.test.ts
```

Expected: FAIL với lỗi Zod chỉ ra `questions.0.explanation` là bắt buộc.

- [ ] **Step 4: Sửa schema V2 tối thiểu**

Trong `src/services/ai/schemas/quizGenerationSchema.ts`:

```ts
const ExplanationText = NonEmptyText.max(6000);

const CommonMetadataFields = {
  id: z.string().trim().min(1).max(160).optional(),
  explanation: ExplanationText.optional(),
  difficultyLevel: DifficultyLevel,
};
```

Không xóa `ExplanationText`; trường này vẫn cần validate dữ liệu cũ khi có mặt.

- [ ] **Step 5: Sửa schema và type V3 tối thiểu**

Trong `src/services/ai/question-contracts/questionContract.shared.ts`:

```ts
export const CommonGeneratedQuestionFields = {
  slotId: z.string().trim().regex(/^slot-\d+$/),
  difficulty: DifficultySchema,
  explanation: ExplanationText.optional(),
  subject: z.enum(['math', 'vietnamese']).optional(),
  skillCode: z.string().trim().min(1).max(160).optional(),
  subskillCode: z.string().trim().min(1).max(160).optional(),
};
```

Trong `src/services/ai/question-contracts/questionContract.types.ts`:

```ts
export interface GeneratedQuestionCommonV3 {
  slotId: string;
  difficulty: BlueprintDifficulty;
  explanation?: string;
  subject?: SupportedSkillSubject;
  skillCode?: string;
  subskillCode?: string;
}
```

- [ ] **Step 6: Chạy test để xác nhận GREEN**

Run:

```bash
npx vitest run tests/quizGenerationSchema.test.ts tests/quizGenerationSchemaV3.test.ts tests/aiQuestionContractRegistry.integration.test.ts
```

Expected: PASS; cả dữ liệu không có lời giải và dữ liệu legacy có lời giải đều hợp lệ.

- [ ] **Step 7: Typecheck phạm vi toàn dự án**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS. Nếu có lỗi `question.explanation` có thể là `undefined`, chỉ sửa các điểm thuộc pipeline AI; không thay domain hoặc DB thành required.

- [ ] **Step 8: Commit Task 1**

```powershell
git add src/services/ai/schemas/quizGenerationSchema.ts src/services/ai/question-contracts/questionContract.shared.ts src/services/ai/question-contracts/questionContract.types.ts tests/quizGenerationSchema.test.ts tests/quizGenerationSchemaV3.test.ts
git commit -m "refactor(ai): make generated explanations optional"
```

---

### Task 2: Loại bỏ lời giải khỏi toàn bộ prompt tạo, sửa và duyệt đề

**Files:**
- Modify: `src/config/constants.ts:28-327`
- Modify: `src/services/ai/prompts/quizPromptBuilder.ts:8-205`
- Modify: `src/services/ai/prompts/slotPromptBuilder.ts:80-110`
- Modify: `src/services/ai/prompts/reviewerPromptBuilder.ts:4-35`
- Modify: `src/services/ai/question-contracts/choiceQuestionContracts.ts:85-156`
- Modify: `src/services/ai/question-contracts/completionQuestionContracts.ts:59-156`
- Modify: `src/services/ai/question-contracts/interactionQuestionContracts.ts:95-172`
- Modify: `src/services/ai/question-contracts/languageQuestionContracts.ts:91-167`
- Modify: `src/services/ai/question-contracts/imageQuestionContract.ts:39-69`
- Modify: `tests/quizPromptBuilder.test.ts`
- Modify: `tests/quizPromptBuilderV3.test.ts`
- Modify: `tests/aiQuestionContractRegistry.integration.test.ts`

**Interfaces:**
- Consumes: optional `explanation` từ Task 1.
- Produces: prompt V2/V3, reviewer và contract JSON examples không yêu cầu `explanation`; có policy rõ ràng cấm sinh trường này.

- [ ] **Step 1: Viết test prompt V2 thất bại**

Trong `tests/quizPromptBuilder.test.ts`, thay test EXAM/PRACTICE bằng các assertion sau:

```ts
it('does not request explanations for exam generation', () => {
  const prompt = buildPrompt('Phân số', '4', '', makeOptions('EXAM'));

  expect(prompt).toContain('[INTENT: EXAM]');
  expect(prompt).toContain('Không tạo trường "explanation"');
  expect(prompt).not.toContain('[EXPLANATION GENERATOR RULE]');
  expect(prompt).not.toContain('"explanation":"..."');
});

it('does not request explanations for practice generation', () => {
  const prompt = buildPrompt('Phân số', '4', '', makeOptions('PRACTICE'));

  expect(prompt).toContain('[INTENT: PRACTICE]');
  expect(prompt).toContain('Không tạo trường "explanation"');
  expect(prompt).not.toContain('Lời giải phải hướng dẫn từng bước');
  expect(prompt).not.toContain('"explanation":"..."');
});
```

Trong test dropdown/categorization, thêm:

```ts
expect(prompt).not.toContain('"explanation":"Giải thích đầy đủ."');
```

- [ ] **Step 2: Viết test prompt V3 và contract registry thất bại**

Trong `tests/quizPromptBuilderV3.test.ts`, thêm:

```ts
it('forbids explanation output in V3 prompts', () => {
  const prompt = buildPromptV3(makeInput(makeBlueprintV3Fixture()));

  expect(prompt).toContain('Không tạo trường explanation');
  expect(prompt).not.toContain('"explanation":"..."');
});
```

Trong vòng lặp của `tests/aiQuestionContractRegistry.integration.test.ts`:

```ts
const promptFragment = contract.promptFragment({
  classLevel: '4',
  intent: 'PRACTICE',
  sourceMode: 'TOPIC',
  hasImageLibrary: true,
});
expect(promptFragment).toContain(`[CONTRACT: ${type}]`);
expect(promptFragment).not.toContain('"explanation"');
```

- [ ] **Step 3: Chạy test để xác nhận RED**

Run:

```bash
npx vitest run tests/quizPromptBuilder.test.ts tests/quizPromptBuilderV3.test.ts tests/aiQuestionContractRegistry.integration.test.ts
```

Expected: FAIL vì prompt hiện chứa `[EXPLANATION GENERATOR RULE]`, JSON field `explanation` và lời nhắc bắt buộc tạo lời giải.

- [ ] **Step 4: Sửa `quizPromptBuilder.ts`**

Xóa toàn bộ hằng `PEDAGOGICAL_EXPLANATION_PROMPT`.

Đổi intent thành:

```ts
const INTENT_PROMPTS = {
  EXAM: `
    [INTENT: EXAM]
    - Câu hỏi ngắn gọn, trung lập. Không đưa gợi ý trong nội dung câu hỏi.
    - Không lặp cùng một kỹ năng bằng cách đổi số đơn giản.
    - Phương án nhiễu phải hợp lý nhưng chỉ có đúng số đáp án theo schema.`,
  PRACTICE: `
    [INTENT: PRACTICE]
    - Sắp xếp từ kiến thức cốt lõi đến vận dụng.
    - Câu dẫn rõ ràng, thân thiện và không gây áp lực.
    - Phương án nhiễu phản ánh lỗi sai phổ biến nhưng không đánh đố.`,
} as const;
```

Thêm một block dùng cho mọi V2 prompt:

```ts
const NO_EXPLANATION_OUTPUT_PROMPT = `
    [OUTPUT SIZE POLICY]
    - Không tạo trường "explanation" trong bất kỳ câu hỏi nào.
    - Chỉ trả dữ liệu cần thiết để hiển thị câu hỏi, chấm điểm và phân loại độ khó.
`;
```

Trong prompt trả về, dùng:

```ts
${SCIENTIFIC_GROUNDING_PROMPT}
${NO_EXPLANATION_OUTPUT_PROMPT}
${intentSection}
```

Bỏ `explanation` khỏi JSON examples của `MCQ`, `DROPDOWN`, `CATEGORIZATION` và mọi mô tả type khác đang có field này.

- [ ] **Step 5: Sửa `SYSTEM_INSTRUCTION` và `REVIEWER_INSTRUCTION`**

Trong `src/config/constants.ts`:

1. Xóa mọi dòng `"explanation": ...` trong JSON examples.
2. Thay rule số 7 bằng:

```text
7. OUTPUT SIZE: Không tạo trường "explanation" trong câu hỏi. Chỉ trả nội dung câu hỏi, dữ liệu tương tác, đáp án đúng và metadata cần thiết.
```

3. Trong `REVIEWER_INSTRUCTION`, thay câu sửa toán:

```text
- TỰ MÌNH GIẢI LẠI 100% các phép toán có trong đề. Nếu AI Generator tính sai kết quả, BẮT BUỘC phải sửa lại đáp án đúng và các phương án liên quan.
```

4. Thay đoạn kết bằng:

```text
- GIỮ NGUYÊN cấu trúc schema JSON (title, questions). Số lượng câu hỏi không đổi, chỉ SỬA chất lượng bên trong.
- KHÔNG thêm trường `explanation` hoặc lời giải vào bất kỳ câu hỏi nào.
```

- [ ] **Step 6: Sửa output contract V3 và reviewer V3**

Trong `src/services/ai/prompts/slotPromptBuilder.ts`:

```ts
'Mỗi câu phải echo đúng slotId, type, difficulty và đúng schema của contract.',
'Không tạo trường explanation trong bất kỳ câu hỏi nào.',
```

Trong `src/services/ai/prompts/reviewerPromptBuilder.ts`, thêm vào system prompt:

```ts
'Không được thêm trường explanation hoặc lời giải vào câu hỏi.',
```

- [ ] **Step 7: Bỏ `explanation` khỏi 13 contract prompt và fixture chuẩn**

Dùng các JSON contract chính xác sau:

```text
MCQ: {"slotId":"slot-1","type":"MCQ","difficulty":2,"question":"...","options":["...","...","...","..."],"correctAnswer":"A"}
TRUE_FALSE: {"slotId":"slot-1","type":"TRUE_FALSE","difficulty":2,"mainQuestion":"...","items":[{"statement":"...","isCorrect":true},{"statement":"...","isCorrect":false}]}
MULTIPLE_SELECT: {"slotId":"slot-1","type":"MULTIPLE_SELECT","difficulty":2,"question":"Chọn tất cả...","options":["...","...","...","..."],"correctAnswers":["A","C"]}
SHORT_ANSWER: {"slotId":"slot-1","type":"SHORT_ANSWER","difficulty":2,"question":"...","correctAnswer":"..."}
DRAG_DROP: {"slotId":"slot-1","type":"DRAG_DROP","difficulty":2,"question":"...","text":"... [1] ...","blanks":["..."],"distractors":["..."]}
DROPDOWN: {"slotId":"slot-1","type":"DROPDOWN","difficulty":2,"question":"...","text":"... [1] ...","blanks":[{"id":"1","options":["...","..."],"correctAnswer":"..."}]}
MATCHING: {"slotId":"slot-1","type":"MATCHING","difficulty":2,"question":"...","pairs":[{"left":"...","right":"..."},{"left":"...","right":"..."},{"left":"...","right":"..."}]}
ORDERING: {"slotId":"slot-1","type":"ORDERING","difficulty":2,"question":"...","items":["...","...","..."],"correctOrder":[1,0,2]}
CATEGORIZATION: {"slotId":"slot-1","type":"CATEGORIZATION","difficulty":2,"question":"...","categories":[{"id":"a","name":"..."},{"id":"b","name":"..."}],"items":[{"id":"i1","content":"...","categoryId":"a"}]}
UNDERLINE: {"slotId":"slot-1","type":"UNDERLINE","difficulty":2,"question":"...","sentence":"...","targetWords":["..."]}
WORD_SCRAMBLE: {"slotId":"slot-1","type":"WORD_SCRAMBLE","difficulty":2,"question":"...","letters":["h","o","a"],"correctWord":"hoa"}
RIDDLE: {"slotId":"slot-1","type":"RIDDLE","difficulty":2,"question":"...","riddleLines":["...","..."],"correctAnswer":"...","answerType":"original","answerLabel":"..."}
IMAGE_QUESTION: {"slotId":"slot-1","type":"IMAGE_QUESTION","difficulty":2,"question":"...","image":"image-id","imageAlt":"...","options":["...","...","...","..."],"correctAnswer":"A"}
```

Xóa thuộc tính `explanation` khỏi `validFixture` của cả 13 contract. Không sửa các semantic validator khác.

- [ ] **Step 8: Chạy test để xác nhận GREEN**

Run:

```bash
npx vitest run tests/quizPromptBuilder.test.ts tests/quizPromptBuilderV3.test.ts tests/aiQuestionContractRegistry.integration.test.ts tests/quizGenerationSchemaV3.test.ts
```

Expected: PASS; không contract hoặc prompt nào còn JSON field `explanation`.

- [ ] **Step 9: Commit Task 2**

```powershell
git add src/config/constants.ts src/services/ai/prompts/quizPromptBuilder.ts src/services/ai/prompts/slotPromptBuilder.ts src/services/ai/prompts/reviewerPromptBuilder.ts src/services/ai/question-contracts/choiceQuestionContracts.ts src/services/ai/question-contracts/completionQuestionContracts.ts src/services/ai/question-contracts/interactionQuestionContracts.ts src/services/ai/question-contracts/languageQuestionContracts.ts src/services/ai/question-contracts/imageQuestionContract.ts tests/quizPromptBuilder.test.ts tests/quizPromptBuilderV3.test.ts tests/aiQuestionContractRegistry.integration.test.ts
git commit -m "perf(ai): stop requesting generated explanations"
```

---

### Task 3: Cưỡng chế đầu ra không có lời giải và bỏ lỗi audit liên quan

**Files:**
- Create: `tests/aiGeneratedExplanationPolicy.test.ts`
- Modify: `src/services/ai/utils/jsonRepair.ts:150-181`
- Modify: `src/services/ai/schemas/generatedQuizV3Normalizer.ts:13-38`
- Modify: `src/services/ai/quizDomainAdapter.ts:8-54`
- Modify: `src/services/ai/quizAudit.ts:15-24, 150-170, 180-195, 300-315`
- Modify: `src/services/ai/quizRepair.ts:29-45, 88-120, 194-243`
- Modify: `src/services/ai/prompts/questionRegenerationPrompt.ts:5-43`
- Modify: `src/features/quiz-generator/hooks/useQuizGeneration.ts:398-410`
- Modify: `tests/quizAudit.test.ts`
- Modify: `tests/quizSlotAudit.test.ts`
- Modify: `tests/quizRepair.test.ts`
- Modify: `tests/quizSlotRepair.test.ts`
- Modify: `tests/questionRegenerationPrompt.test.ts`

**Interfaces:**
- Consumes: schema optional và prompt không tạo lời giải từ Tasks 1-2.
- Produces: mọi dữ liệu do AI trả về được strip `explanation` trước audit và mapping; audit/repair không còn `MISSING_EXPLANATION`.

- [ ] **Step 1: Tạo test policy thất bại**

Create `tests/aiGeneratedExplanationPolicy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import { validateAndFixQuiz } from '../src/services/ai/utils/jsonRepair';
import { normalizeGeneratedQuizV3Compatibility } from '../src/services/ai/schemas/generatedQuizV3Normalizer';
import { mapGeneratedQuizV3ToDomain } from '../src/services/ai/quizDomainAdapter';
import { getAiQuestionContract } from '../src/services/ai/question-contracts/questionContractRegistry';
import type { GeneratedQuestionV3 } from '../src/services/ai/question-contracts/questionContract.types';

const legacyExplanation = 'Lời giải do nhà cung cấp tự trả về.';

describe('AI generated explanation policy', () => {
  it('strips explanation from normalized V2 provider output', () => {
    const normalized = validateAndFixQuiz({
      title: 'Đề V2',
      questions: [{
        type: QuestionType.MCQ,
        question: '1 + 1 = ?',
        options: ['1', '2'],
        correctAnswer: 'B',
        difficultyLevel: 1,
        explanation: legacyExplanation,
      }],
    }) as { questions: Array<Record<string, unknown>> };

    expect(normalized.questions[0]).not.toHaveProperty('explanation');
  });

  it('strips explanation from normalized V3 provider output', () => {
    const normalized = normalizeGeneratedQuizV3Compatibility({
      promptVersion: 'ai-blueprint-v3',
      blueprintVersion: 3,
      title: 'Đề V3',
      questions: [{
        ...getAiQuestionContract(QuestionType.MCQ).validFixture,
        slotId: 'slot-1',
        type: QuestionType.MCQ,
        difficulty: 1,
        explanation: legacyExplanation,
      }],
    }, {
      allowV2DifficultyAlias: true,
      expectedPromptVersion: 'ai-blueprint-v3',
    }) as { questions: Array<Record<string, unknown>> };

    expect(normalized.questions[0]).not.toHaveProperty('explanation');
  });

  it('does not leak explanation through V3 domain mapping', () => {
    const question = {
      ...getAiQuestionContract(QuestionType.MCQ).validFixture,
      slotId: 'slot-1',
      type: QuestionType.MCQ,
      difficulty: 1,
      explanation: legacyExplanation,
    } as GeneratedQuestionV3;

    const mapped = mapGeneratedQuizV3ToDomain({
      promptVersion: 'ai-blueprint-v3',
      blueprintVersion: 3,
      title: 'Đề V3',
      questions: [question],
    });

    expect(mapped.questions[0]).not.toHaveProperty('explanation');
  });
});
```

- [ ] **Step 2: Viết test audit và repair thất bại**

Trong `tests/quizAudit.test.ts`, bỏ `explanation` khỏi `makeMcq` và thêm:

```ts
it('does not report missing explanations', () => {
  const quiz = parseGeneratedQuiz({
    title: 'Đề không lời giải',
    questions: [makeMcq('Câu hợp lệ không có lời giải')],
  });

  expect(auditGeneratedQuiz(quiz, blueprintFor(1)).map((issue) => issue.code))
    .not.toContain('MISSING_EXPLANATION');
});
```

Trong `tests/quizSlotAudit.test.ts`, thêm:

```ts
it('accepts valid slots without explanations', () => {
  const quiz = {
    ...validQuiz,
    questions: validQuiz.questions.map((question) => {
      const copy = { ...question } as Record<string, unknown>;
      delete copy.explanation;
      return copy;
    }),
  } as GeneratedQuizV3;

  expect(auditGeneratedQuizV3(quiz, blueprint)).toEqual([]);
});
```

Trong `tests/quizRepair.test.ts`:

```ts
expect(prompt).toContain('Không tạo trường explanation');
expect(prompt).not.toContain('mỗi câu phải có explanation');
```

Trong `tests/quizSlotRepair.test.ts`:

```ts
expect(prompt).toContain('Không tạo trường explanation');
expect(prompt).not.toContain('"explanation"');
```

- [ ] **Step 3: Viết test regeneration thất bại**

Giữ một `currentQuestion` legacy có `explanation`, sau đó thêm vào `tests/questionRegenerationPrompt.test.ts`:

```ts
it('does not include the old explanation in regeneration prompts', () => {
  const prompt = buildQuestionRegenerationPrompt({
    slot,
    currentQuestion,
    otherQuestionSummaries: [],
  });

  expect(prompt).toContain('Không tạo trường explanation');
  expect(prompt).not.toContain('Lời giải hiện tại.');
  expect(prompt).not.toContain('"explanation"');
});
```

- [ ] **Step 4: Chạy test để xác nhận RED**

Run:

```powershell
npx vitest run tests/aiGeneratedExplanationPolicy.test.ts tests/quizAudit.test.ts tests/quizSlotAudit.test.ts tests/quizRepair.test.ts tests/quizSlotRepair.test.ts tests/questionRegenerationPrompt.test.ts
```

Expected: FAIL vì normalizer còn giữ lời giải, audit còn tạo `MISSING_EXPLANATION`, repair/regeneration prompt còn chứa lời giải.

- [ ] **Step 5: Strip lời giải trong normalizer V2**

Trong `src/services/ai/utils/jsonRepair.ts`, thay phần map câu hỏi bằng:

```ts
q.questions = (q.questions as Record<string, unknown>[]).map((item) => {
  const normalized = fixQuestionLatex(item);
  delete normalized.explanation;
  return normalized;
});
```

Đây là biên AI V2; không áp dụng cho import hoặc dữ liệu đọc từ D1.

- [ ] **Step 6: Strip lời giải trong normalizer V3**

Trong `src/services/ai/schemas/generatedQuizV3Normalizer.ts`:

```ts
const nextQuestion = { ...question };
delete nextQuestion.explanation;

if (options.allowV2DifficultyAlias
  && nextQuestion.difficulty === undefined
  && nextQuestion.difficultyLevel !== undefined) {
  nextQuestion.difficulty = nextQuestion.difficultyLevel;
}
```

- [ ] **Step 7: Phòng thủ tại domain adapter**

Trong `src/services/ai/quizDomainAdapter.ts`, sau khi tạo `record`:

```ts
const record = { ...payload } as Record<string, unknown>;
delete record.explanation;
```

Mục đích là ngăn leakage nếu một caller bỏ qua normalizer và gọi adapter trực tiếp.

- [ ] **Step 8: Xóa `MISSING_EXPLANATION` khỏi audit V2/V3**

Trong `src/services/ai/quizAudit.ts`:

1. Xóa `'MISSING_EXPLANATION'` khỏi `QuizAuditCode`.
2. Xóa vòng kiểm tra:

```ts
if (!question.explanation.trim()) { ... }
```

3. Xóa `'MISSING_EXPLANATION'` khỏi `QuizSlotAuditCode`.
4. Xóa vòng kiểm tra:

```ts
if (!question.explanation?.trim()) { ... }
```

Không thay đổi kiểm tra đáp án, schema, math, type, difficulty, skill hoặc duplicate.

- [ ] **Step 9: Sửa repair prompts**

Trong `buildQuizSchemaRepairPrompt`, thêm cuối phần yêu cầu:

```ts
'Không tạo trường explanation trong câu hỏi.',
```

Trong `buildQuizRepairPrompt`, thay dòng output bằng:

```text
JSON trả về phải có dạng {"title":"Phần sửa","questions":[...]} và mỗi câu phải có difficultyLevel.
Không tạo trường explanation trong câu hỏi.
```

Trong `buildQuizSlotRepairPrompt`, thêm trước dòng cuối:

```ts
'Không tạo trường explanation trong các slot sửa.',
```

- [ ] **Step 10: Sửa regeneration prompt và caller**

Trong `src/services/ai/prompts/questionRegenerationPrompt.ts`, tạo projection không có lời giải:

```ts
const currentQuestion = { ...input.currentQuestion } as Record<string, unknown>;
delete currentQuestion.explanation;
```

Dùng:

```ts
'[CÂU HIỆN TẠI]',
JSON.stringify(currentQuestion),
```

Thêm trước dòng trả JSON:

```ts
'Không tạo trường explanation trong câu mới.',
```

Trong `src/features/quiz-generator/hooks/useQuizGeneration.ts`, xóa hoàn toàn dòng:

```ts
explanation: question.explanation || 'Câu hiện tại chưa có lời giải.',
```

Projection còn lại:

```ts
currentQuestion: {
  ...(question as unknown as Record<string, unknown>),
  slotId: slot.slotId,
  type: slot.type,
  difficulty: slot.difficulty,
} as GeneratedQuestionV3,
```

- [ ] **Step 11: Chạy test để xác nhận GREEN**

Run:

```powershell
npx vitest run tests/aiGeneratedExplanationPolicy.test.ts tests/quizAudit.test.ts tests/quizSlotAudit.test.ts tests/quizRepair.test.ts tests/quizSlotRepair.test.ts tests/questionRegenerationPrompt.test.ts
```

Expected: PASS.

- [ ] **Step 12: Commit Task 3**

```powershell
git add src/services/ai/utils/jsonRepair.ts src/services/ai/schemas/generatedQuizV3Normalizer.ts src/services/ai/quizDomainAdapter.ts src/services/ai/quizAudit.ts src/services/ai/quizRepair.ts src/services/ai/prompts/questionRegenerationPrompt.ts src/features/quiz-generator/hooks/useQuizGeneration.ts tests/aiGeneratedExplanationPolicy.test.ts tests/quizAudit.test.ts tests/quizSlotAudit.test.ts tests/quizRepair.test.ts tests/quizSlotRepair.test.ts tests/questionRegenerationPrompt.test.ts
git commit -m "perf(ai): strip explanations from generated quiz output"
```

---

### Task 4: Ẩn lời giải trong kết quả chi tiết học sinh phía giáo viên

**Files:**
- Modify: `src/components/teacher/ResultsView/student-detail/components/QuestionDetailPanel.tsx:23-34`
- Create: `tests/TeacherQuestionDetailPanel.test.tsx`
- Regression: `tests/QuestionReview.test.tsx`

**Interfaces:**
- Consumes: `QuestionReviewProps.showExplanation?: boolean` hiện có.
- Produces: riêng `QuestionDetailPanel` luôn ẩn lời giải; `QuestionReview` vẫn hỗ trợ `showExplanation={true}` cho các bề mặt khác.

- [ ] **Step 1: Viết test UI thất bại**

Create `tests/TeacherQuestionDetailPanel.test.tsx`:

```tsx
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuestionDetailPanel } from '../src/components/teacher/ResultsView/student-detail/components/QuestionDetailPanel';
import type { DisplayQuestion } from '../src/components/teacher/ResultsView/student-detail/models/questionModel';

vi.mock('better-react-mathjax', () => ({
  MathJax: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  MathJaxContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const question = {
  id: 'q-1',
  index: 0,
  type: 'MCQ',
  question: '1 + 1 = ?',
  options: ['1', '2', '3', '4'],
  correctAnswer: 'B',
  selectedAnswer: 'A',
  isCorrect: false,
  explanation: 'Một cộng một bằng hai.',
} as DisplayQuestion;

describe('teacher student question detail', () => {
  it('hides legacy explanations from the teacher result detail', () => {
    render(
      <QuestionDetailPanel
        selectedQuestion={question}
        selectedQuestionIndex={0}
        filteredQuestionCount={1}
        displayQuestionCount={1}
        onQuestionSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('1 + 1 = ?')).toBeTruthy();
    expect(screen.getAllByText('Sai').length).toBeGreaterThan(0);
    expect(screen.queryByText('Một cộng một bằng hai.')).toBeNull();
    expect(document.querySelector('.explanation-section')).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận RED**

Run:

```bash
npx vitest run tests/TeacherQuestionDetailPanel.test.tsx
```

Expected: FAIL vì `QuestionDetailPanel` đang truyền `showExplanation={true}`.

- [ ] **Step 3: Sửa component tối thiểu**

Trong `QuestionDetailPanel.tsx`:

```tsx
<QuestionReview
  index={props.selectedQuestion.index}
  question={props.selectedQuestion}
  studentAnswer={props.selectedQuestion.selectedAnswer}
  status={props.selectedQuestion.isCorrect === true
    ? 'correct'
    : props.selectedQuestion.isCorrect === false
      ? 'wrong'
      : 'skipped'}
  showExplanation={false}
/>
```

Không xóa prop khỏi `QuestionReview`; các bề mặt khác vẫn cần khả năng hiển thị lời giải.

- [ ] **Step 4: Chạy test UI và regression**

Run:

```powershell
npx vitest run tests/TeacherQuestionDetailPanel.test.tsx tests/QuestionReview.test.tsx
```

Expected: PASS; test generic vẫn chứng minh `showExplanation={true}` hoạt động ở nơi khác.

- [ ] **Step 5: Commit Task 4**

```powershell
git add src/components/teacher/ResultsView/student-detail/components/QuestionDetailPanel.tsx tests/TeacherQuestionDetailPanel.test.tsx
git commit -m "fix(teacher): hide explanations in student result details"
```

---

### Task 5: Khóa regression end-to-end và tương thích dữ liệu cũ

**Files:**
- Modify: `tests/helpers/aiBlueprintV3Fixtures.ts:42-65`
- Modify: `tests/quizGenerationPipeline.test.ts`
- Modify: `tests/quizGenerationPipelineV3.test.ts`
- Modify: `tests/questionSchemaCoverage.test.ts`
- Verify unchanged: `tests/BulkQuestionActions.test.tsx`
- Verify unchanged: `tests/questionImporters.test.ts`
- Verify unchanged: `tests/quizRoutes.authoringFields.worker.test.ts`

**Interfaces:**
- Consumes: toàn bộ policy từ Tasks 1-4.
- Produces: bằng chứng tích hợp rằng AI mới không trả lời giải, trong khi manual authoring/import/storage legacy vẫn giữ được lời giải.

- [ ] **Step 1: Đổi fixture V3 chuẩn thành không có lời giải**

Trong `tests/helpers/aiBlueprintV3Fixtures.ts`, xóa dòng:

```ts
explanation: `Lời giải fixture hợp lệ cho slot ${slot.ordinal}.`,
```

Fixture V3 chuẩn phải đại diện cho output mới, không phải dữ liệu legacy.

- [ ] **Step 2: Bổ sung assertion pipeline V2**

Trong `tests/quizGenerationPipeline.test.ts`, có thể giữ `makeMcq` trả `explanation` để mô phỏng provider cũ hoặc model không tuân prompt. Trong test luồng thành công, thêm:

```ts
expect(result.questions.every((question) => !('explanation' in question))).toBe(true);
```

Đồng thời kiểm tra repair prompt:

```ts
const repairCalls = mocks.requestWorkerAiText.mock.calls.filter(
  (call) => call[1]?.action?.stage === 'REPAIR',
);
expect(repairCalls[0][0].messages[1].content).toContain('Không tạo trường explanation');
```

- [ ] **Step 3: Bổ sung assertion pipeline V3**

Trong `tests/quizGenerationPipelineV3.test.ts`, cho `quizWithOneWrongSlot` có một `explanation` legacy như hiện tại, rồi thêm vào test chính:

```ts
expect(result.questions.every((question) => !('explanation' in question))).toBe(true);
expect(repairCalls[0][0].messages[1].content).toContain('Không tạo trường explanation');
```

Trong test regeneration:

```ts
expect(result.questions[0]).not.toHaveProperty('explanation');
```

- [ ] **Step 4: Khóa domain adapter không leak lời giải**

Trong `tests/questionSchemaCoverage.test.ts`, thêm `explanation` legacy vào câu trước mapping:

```ts
const question = {
  ...getAiQuestionContract(type).validFixture,
  slotId: `slot-${index + 1}`,
  type,
  difficulty: ((index % 3) + 1) as 1 | 2 | 3,
  explanation: 'Lời giải legacy phải bị bỏ khỏi output AI mới.',
} as GeneratedQuestionV3;
```

Sau `validateQuestion`:

```ts
expect(domainQuestion).not.toHaveProperty('explanation');
```

- [ ] **Step 5: Chạy test tích hợp mới**

Run:

```powershell
npx vitest run tests/quizGenerationPipeline.test.ts tests/quizGenerationPipelineV3.test.ts tests/questionSchemaCoverage.test.ts
```

Expected: PASS.

- [ ] **Step 6: Chạy regression bảo vệ tính năng legacy/manual**

Run:

```powershell
npx vitest run tests/BulkQuestionActions.test.tsx tests/QuestionReview.test.tsx tests/questionImporters.test.ts tests/quizRoutes.authoringFields.worker.test.ts
```

Expected:

- `BulkQuestionActions`: nút “AI tạo lời giải” vẫn tạo preview và chỉ lưu sau xác nhận.
- `QuestionReview`: vẫn hiển thị lời giải khi caller truyền `showExplanation={true}`.
- `questionImporters`: Word/Excel vẫn nhập được lời giải.
- `quizRoutes.authoringFields.worker`: API/D1 vẫn lưu và đọc cột `explanation`, payload học sinh vẫn loại trường này.

- [ ] **Step 7: Commit Task 5**

```powershell
git add tests/helpers/aiBlueprintV3Fixtures.ts tests/quizGenerationPipeline.test.ts tests/quizGenerationPipelineV3.test.ts tests/questionSchemaCoverage.test.ts
git commit -m "test(ai): cover explanation-free generation workflows"
```

---

## Final Verification Gate

- [ ] **Step 1: Kiểm tra diff chỉ đúng phạm vi**

```bash
git status --short
git diff --check
git diff --stat HEAD~5..HEAD
```

Expected: không có file migration, worker route, AI Tutor, Dr Owl, manual workspace hoặc DB schema bị sửa ngoài phạm vi đã nêu.

- [ ] **Step 2: Chạy typecheck**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Chạy targeted AI and UI tests**

```powershell
npx vitest run tests/quizGenerationSchema.test.ts tests/quizGenerationSchemaV3.test.ts tests/aiQuestionContractRegistry.integration.test.ts tests/quizPromptBuilder.test.ts tests/quizPromptBuilderV3.test.ts tests/aiGeneratedExplanationPolicy.test.ts tests/quizAudit.test.ts tests/quizSlotAudit.test.ts tests/quizRepair.test.ts tests/quizSlotRepair.test.ts tests/questionRegenerationPrompt.test.ts tests/quizGenerationPipeline.test.ts tests/quizGenerationPipelineV3.test.ts tests/questionSchemaCoverage.test.ts tests/TeacherQuestionDetailPanel.test.tsx tests/QuestionReview.test.tsx tests/BulkQuestionActions.test.tsx tests/questionImporters.test.ts tests/quizRoutes.authoringFields.worker.test.ts
```

Expected: PASS.

- [ ] **Step 4: Chạy toàn bộ unit/integration suite**

```bash
npm run test:run
```

Expected: tất cả test files và tests PASS; không có snapshot hoặc fixture nào còn phụ thuộc `explanation` bắt buộc trong AI generation.

- [ ] **Step 5: Chạy Cypress AI V2 và Blueprint V3**

```bash
npx cypress run --e2e --spec "cypress/e2e/ai-quiz-generation-v2.cy.ts"
npx cypress run --e2e --spec "cypress/e2e/ai-question-blueprint-v3.cy.ts"
```

Expected: PASS. Fixtures cũ có `explanation` vẫn được chấp nhận, nhưng output mới không phụ thuộc trường này.

- [ ] **Step 6: Chạy security scan và production build**

```bash
npm run security:scan
npm run build
```

Expected: PASS. Nếu build cập nhật `public/sitemap.xml` mà route không đổi, restore file này trước commit/deploy.

- [ ] **Step 7: Browser smoke test local**

Start:

```bash
npm run dev -- --host 127.0.0.1
```

Kiểm tra bằng tài khoản giáo viên:

1. Tạo đề AI V2 và V3; xác nhận đề được tạo mà không có trường/lời giải trong editor payload.
2. Tạo lại một câu; xác nhận không xuất hiện lỗi “thiếu lời giải” và không phát sinh repair chỉ vì thiếu lời giải.
3. Mở kết quả chi tiết của học sinh; xác nhận thấy câu hỏi, đáp án học sinh, đáp án đúng, trạng thái và điều hướng nhưng không có khối “Giải thích”.
4. Mở trình soạn thủ công, chọn một câu và bấm “AI tạo lời giải”; xác nhận preview/chấp nhận vẫn hoạt động.
5. Mở một đề cũ có lời giải trong editor hoặc ngân hàng câu hỏi; xác nhận dữ liệu cũ không bị mất.

- [ ] **Step 8: Review trước merge/deploy**

```bash
git log --oneline -5
git status --short
```

Expected commit order:

```text
refactor(ai): make generated explanations optional
perf(ai): stop requesting generated explanations
perf(ai): strip explanations from generated quiz output
fix(teacher): hide explanations in student result details
test(ai): cover explanation-free generation workflows
```

Working tree phải sạch trước khi push/deploy.

---

## Rollback Strategy

Rollback theo thứ tự ngược:

```bash
git revert <commit-test>
git revert <commit-teacher-ui>
git revert <commit-strip-output>
git revert <commit-prompt>
git revert <commit-schema>
```

Không cần rollback migration vì kế hoạch không thay đổi D1 schema. Nếu chỉ UI có vấn đề, revert riêng commit `fix(teacher): hide explanations in student result details`. Nếu nhà cung cấp AI bắt đầu trả JSON lỗi sau khi giảm prompt, revert commit prompt nhưng giữ schema optional và output sanitizer để tránh lỗi production.

## Acceptance Criteria

- AI tạo đề V2 và V3 không được yêu cầu sinh `explanation`.
- Repair, reviewer và regeneration không được yêu cầu hoặc thêm `explanation`.
- Output AI cuối cùng không chứa `explanation`, kể cả provider tự trả trường này.
- Không có audit issue `MISSING_EXPLANATION`.
- Trang kết quả chi tiết học sinh phía giáo viên không hiển thị lời giải.
- Đề cũ, import, ngân hàng câu hỏi, D1 và tính năng “AI tạo lời giải” thủ công vẫn hoạt động.
- Không có migration hoặc thay đổi API route.
- Typecheck, targeted tests, full suite, Cypress, security scan và build đều PASS.
