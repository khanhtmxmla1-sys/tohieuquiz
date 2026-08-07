# JSON Question Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `executing-plans` or equivalent inline execution with TDD. Commit steps are intentionally omitted because TôHiệuQuiz requires explicit user permission before commit/push/deploy.

**Goal:** Thêm tab `Dán JSON` vào `QuestionImportDrawer`, parse JSON AI-friendly thành `QuestionImportResult`, cho phép preview/rà soát/import/undo bằng pipeline hiện tại.

**Architecture:** Tạo một parser thuần mới `jsonQuestionImporter.ts` tách biệt với CSV/XLSX/DOCX. Parser chỉ nhận string JSON, dùng `JSON.parse`, chuẩn hóa alias/type/answer và trả về cùng contract `QuestionImportResult`. `QuestionImportDrawer` chỉ chịu trách nhiệm chọn nguồn dữ liệu, quản lý state UI và truyền kết quả vào `QuestionImportReview`; không có backend hoặc database path mới.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Zustand, Tailwind utilities, Lucide (đã có trong project).

## Global Constraints

- Không thay đổi Worker/API, D1, migration hoặc schema database.
- Không thêm dependency mới.
- Không dùng `eval`, `Function` hoặc thực thi bất kỳ nội dung JSON nào.
- Giữ nguyên khả năng nhập CSV/XLSX/DOCX hiện tại.
- Luôn preview trước khi `addQuestions`.
- Không commit, push hoặc deploy trong lượt này.

---

## File map

- Create: `src/features/manual-quiz-workspace/import/jsonQuestionImporter.ts` — parse, normalize, validate JSON và export JSON mẫu.
- Modify: `src/features/manual-quiz-workspace/components/QuestionImportDrawer.tsx` — tab UI, textarea, copy sample, parse JSON, summary.
- Modify: `tests/questionImporters.test.ts` — unit tests cho JSON parser.
- Modify: `tests/QuestionImportDrawer.test.tsx` — interaction test cho tab JSON, invalid JSON và import/undo.
- Create: `docs/superpowers/specs/2026-08-07-json-question-import-design.md` — design contract.
- Create: `docs/superpowers/plans/2026-08-07-json-question-import.md` — kế hoạch này.

---

### Task 1: Khóa contract parser JSON bằng test đỏ

**Files:**
- Modify: `tests/questionImporters.test.ts`
- Create later: `src/features/manual-quiz-workspace/import/jsonQuestionImporter.ts`

**Interfaces:**
- Produces expected API: `parseQuestionJsonText(rawText: string): QuestionImportResult`.
- Produces expected constant: `QUESTION_JSON_EXAMPLE: string`.

- [ ] **Step 1: Add failing tests for top-level array and `{questions}` wrapper**

Test MCQ input:

```ts
const result = parseQuestionJsonText(JSON.stringify([
  {
    type: 'multiple_choice',
    question: '2 + 3 bằng bao nhiêu?',
    options: ['4', '5', '6', '7'],
    answer: '5',
  },
]));

expect(result.accepted[0].question).toEqual(expect.objectContaining({
  type: QuestionType.MCQ,
  correctAnswer: 'B',
}));
```

Test wrapper input with `SHORT_ANSWER`.

- [ ] **Step 2: Add failing tests for TRUE_FALSE, MATCHING and MULTIPLE_SELECT**

Validate normalized internal shapes:

```ts
expect(trueFalse.question).toEqual(expect.objectContaining({
  type: QuestionType.TRUE_FALSE,
  mainQuestion: 'Đánh dấu đúng hoặc sai',
}));
expect(matching.question).toEqual(expect.objectContaining({
  type: QuestionType.MATCHING,
  pairs: [{ left: '1 + 1', right: '2' }],
}));
```

- [ ] **Step 3: Add failing tests for invalid syntax and invalid top-level**

```ts
expect(() => parseQuestionJsonText('{bad json')).toThrow(/JSON không hợp lệ/i);
expect(() => parseQuestionJsonText(JSON.stringify({ foo: [] }))).toThrow(/questions/i);
```

- [ ] **Step 4: Run focused importer test and confirm RED**

Run:

```bash
npx vitest run tests/questionImporters.test.ts --maxWorkers=2
```

Expected: fail because `jsonQuestionImporter` does not exist yet.

---

### Task 2: Implement pure JSON importer

**Files:**
- Create: `src/features/manual-quiz-workspace/import/jsonQuestionImporter.ts`
- Test: `tests/questionImporters.test.ts`

**Interfaces:**

```ts
export const QUESTION_JSON_EXAMPLE: string;
export const parseQuestionJsonText = (rawText: string): QuestionImportResult;
```

- [ ] **Step 1: Define top-level extraction and safe primitive helpers**

Use only `JSON.parse` and plain type guards:

```ts
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const extractQuestions = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.questions)) return value.questions;
  throw new Error('JSON phải là một mảng câu hỏi hoặc object có trường "questions".');
};
```

- [ ] **Step 2: Normalize type aliases**

Map aliases to `QuestionType.MCQ`, `TRUE_FALSE`, `SHORT_ANSWER`, `MATCHING`, `MULTIPLE_SELECT`. Unknown type uses existing import philosophy: infer MCQ when >=2 options, otherwise SHORT_ANSWER, and add review issue.

- [ ] **Step 3: Normalize options and MCQ answer**

Accept:

```ts
['4', '5']
[{ id: 'A', text: '4' }, { id: 'B', text: '5' }]
```

Normalize answer letters directly, otherwise match answer text to the option string and convert index to `A`, `B`, `C`, `D`, ... . Invalid answer remains as text and marks `needsReview`.

- [ ] **Step 4: Build each supported internal question shape**

MCQ:

```ts
{ id, type: QuestionType.MCQ, question, options, correctAnswer, difficulty, points, explanation }
```

TRUE_FALSE:

```ts
{
  id,
  type: QuestionType.TRUE_FALSE,
  mainQuestion,
  items: [{ id, statement, isCorrect }],
  difficulty,
  points,
  explanation,
}
```

SHORT_ANSWER:

```ts
{ id, type: QuestionType.SHORT_ANSWER, question, correctAnswer, difficulty, points, explanation }
```

MATCHING:

```ts
{ id, type: QuestionType.MATCHING, question, pairs, difficulty, points, explanation }
```

MULTIPLE_SELECT:

```ts
{ id, type: QuestionType.MULTIPLE_SELECT, question, options, correctAnswers, difficulty, points, explanation }
```

- [ ] **Step 5: Classify each candidate**

Use `QuestionImportCandidate` with:

```ts
sourceRow: index + 1,
sourceLabel: `Câu JSON ${index + 1}`,
```

Rules:
- Missing question text => rejected.
- Inferred type => needsReview unless already rejected.
- Missing/invalid answer => needsReview.
- MCQ/MULTIPLE_SELECT <2 options => needsReview.
- TRUE_FALSE without valid items => needsReview.
- MATCHING without valid pairs => needsReview.

- [ ] **Step 6: Run focused importer tests and confirm GREEN**

```bash
npx vitest run tests/questionImporters.test.ts --maxWorkers=2
```

---

### Task 3: Lock JSON drawer UX with failing interaction tests

**Files:**
- Modify: `tests/QuestionImportDrawer.test.tsx`
- Modify later: `src/features/manual-quiz-workspace/components/QuestionImportDrawer.tsx`

**Interfaces:**
- Existing props remain unchanged: `{ open: boolean; onClose: () => void }`.
- Existing CSV test remains unchanged.

- [ ] **Step 1: Add test for tab selection and valid JSON preview/import/undo**

Flow:

```ts
fireEvent.click(screen.getByRole('tab', { name: 'Dán JSON' }));
fireEvent.change(screen.getByLabelText('Dữ liệu JSON'), { target: { value: json } });
fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra JSON' }));
expect(await screen.findByText('2 + 3 bằng bao nhiêu?')).toBeInTheDocument();
fireEvent.click(screen.getByRole('button', { name: 'Nhập 1 câu đã chọn' }));
expect(storeQuestions()).toHaveLength(1);
fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác nhập câu hỏi' }));
expect(storeQuestions()).toHaveLength(0);
```

- [ ] **Step 2: Add test for invalid JSON**

Verify `role="alert"` contains `JSON không hợp lệ` and store remains unchanged.

- [ ] **Step 3: Run drawer test and confirm RED**

```bash
npx vitest run tests/QuestionImportDrawer.test.tsx --maxWorkers=2
```

---

### Task 4: Implement two-source drawer UI

**Files:**
- Modify: `src/features/manual-quiz-workspace/components/QuestionImportDrawer.tsx`
- Test: `tests/QuestionImportDrawer.test.tsx`

**Interfaces:**
- Import `parseQuestionJsonText` and `QUESTION_JSON_EXAMPLE` from `../import/jsonQuestionImporter`.
- Keep `loadFile`, `importQuestions`, `undoImport` behavior compatible.

- [ ] **Step 1: Add source mode state**

```ts
type ImportSource = 'file' | 'json';
const [source, setSource] = useState<ImportSource>('file');
const [jsonText, setJsonText] = useState('');
const [copyStatus, setCopyStatus] = useState('');
```

Switching sources clears parse result/error but does not erase the undo transaction.

- [ ] **Step 2: Update header and add accessible tabs**

Use:

```tsx
<div role="tablist" aria-label="Nguồn nhập câu hỏi">
  <button role="tab" aria-selected={source === 'file'}>Tải tệp</button>
  <button role="tab" aria-selected={source === 'json'}>Dán JSON</button>
</div>
```

- [ ] **Step 3: Render file panel unchanged under `source === 'file'`**

Keep file input, preloading, extensions and existing error text.

- [ ] **Step 4: Render JSON panel**

Textarea + buttons:

```tsx
<textarea aria-label="Dữ liệu JSON" value={jsonText} onChange={...} />
<button type="button">Xóa</button>
<button type="button">Sao chép JSON mẫu</button>
<button type="button" disabled={!jsonText.trim()}>Kiểm tra JSON</button>
```

`Kiểm tra JSON` calls `parseQuestionJsonText` inside try/catch and writes either `result` or `error`.

Copy uses `navigator.clipboard?.writeText(QUESTION_JSON_EXAMPLE)`; if unavailable, surface a non-fatal readable status instead of throwing.

- [ ] **Step 5: Add JSON result summary**

When source is JSON and result exists:

```tsx
<span>{total} câu</span>
<span>{result.accepted.length} sẵn sàng</span>
<span>{result.needsReview.length} cần rà soát</span>
<span>{result.rejected.length} không thể nhập</span>
```

Then render the existing `QuestionImportReview` unchanged.

- [ ] **Step 6: Run drawer + review + lazy import tests**

```bash
npx vitest run tests/QuestionImportDrawer.test.tsx tests/QuestionImportReview.test.tsx tests/lazyHeavyImports.test.ts --maxWorkers=2
```

Expected: all pass.

---

### Task 5: Focused regression and static verification

**Files:** none unless fixes are required.

- [ ] **Step 1: Run focused feature suite**

```bash
npx vitest run tests/questionImporters.test.ts tests/QuestionImportDrawer.test.tsx tests/QuestionImportReview.test.tsx tests/lazyHeavyImports.test.ts --maxWorkers=2
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

- [ ] **Step 4: Run production build**

```bash
npm run build
```

Stop and fix any feature-caused failure before proceeding.

---

### Task 6: Browser verification

**Files:** none unless UI fixes are required.

- [ ] **Step 1: Start Vite dev server in the isolated worktree**.
- [ ] **Step 2: Open the manual quiz workspace with the existing browser test harness or Playwright MCP**.
- [ ] **Step 3: Verify desktop:** tabs, textarea, buttons, invalid error, preview and import fit without horizontal clipping.
- [ ] **Step 4: Verify mobile width (~390px):** drawer remains usable, tab buttons and action row wrap cleanly, textarea and review remain scrollable.
- [ ] **Step 5: Check console for new errors/warnings produced by this feature**.

---

### Task 7: Final impact and review

**Files:** all changed feature files.

- [ ] **Step 1: Run GitNexus `detect_changes` against the worktree** and confirm only manual quiz import flows are affected.
- [ ] **Step 2: Inspect `git diff` for unrelated edits, unsafe input handling, accessibility regressions and accidental backend changes**.
- [ ] **Step 3: Run primary review against every acceptance criterion in the design spec**.
- [ ] **Step 4: Stop without commit/push/deploy and report exact test/build/browser evidence to the user**.
