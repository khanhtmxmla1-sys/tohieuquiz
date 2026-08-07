# JSON Question Import 13 Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development and incremental-implementation. Do not commit, push, migrate, or deploy without explicit user permission.

**Goal:** Mở rộng `parseQuestionJsonText` để nhận đủ 13 `question_type` canonical của Gem, hiện đúng đáp án trong preview và vẫn tương thích với JSON legacy hiện tại.

**Architecture:** Giữ importer là boundary parser thuần frontend: `JSON.parse` -> normalize external aliases -> build `ManualQuizQuestion` -> classify accepted/needsReview/rejected. Canonical `question_type` có semantic riêng, legacy `type` giữ semantic cũ; không thay đổi backend/database. Các placeholder `{{blankN}}`/`{{selectN}}` được đổi sang placeholder nội bộ trước khi tạo câu.

**Tech Stack:** TypeScript, React 19 existing domain types, Vitest.

## Global Constraints

- Worktree: `C:\quizpro\.worktrees\json-question-import` / branch `feat/json-question-import`.
- Không thay Worker/API, D1, migrations, database schema hoặc dependency.
- Không `eval`, `Function`, network fetch hoặc gọi AI từ importer.
- Giữ toàn bộ hành vi CSV/XLSX/DOCX và JSON legacy hiện tại.
- Một đề có thể chứa bất kỳ tập con nào trong 13 dạng; không bắt buộc đủ 13.
- `question_type` canonical được ưu tiên; `type` legacy vẫn hoạt động.
- `type: multiple_choice` legacy vẫn là MCQ; `question_type: MULTIPLE_CHOICE` canonical là MULTIPLE_SELECT.
- `WORD_ASSEMBLY` nhiều từ thành câu và `IMAGE_QUESTION` thiếu media thật phải `needsReview`, không âm thầm biến đổi sai.

---

### Task 1: Khóa canonical aliases cho 5 dạng hiện có

**Files:**
- Modify: `tests/questionImporters.test.ts`
- Modify later: `src/features/manual-quiz-workspace/import/jsonQuestionImporter.ts`

**Interfaces:**
- `parseQuestionJsonText(rawText: string): QuestionImportResult`

- [ ] Add failing test with `question_type`, difficulty labels and snake_case fields for `SINGLE_CHOICE`, `TRUE_FALSE`, `SHORT_ANSWER`, `MATCHING`, `MULTIPLE_CHOICE`.
- [ ] Assert all five candidates are `accepted`, no type-inference warning, answers are materialized in internal fields.
- [ ] Assert canonical `MULTIPLE_CHOICE` becomes `QuestionType.MULTIPLE_SELECT` while legacy `type: multiple_choice` remains `QuestionType.MCQ`.
- [ ] Run `npx vitest run tests/questionImporters.test.ts --maxWorkers=2` and verify RED for missing canonical support.
- [ ] Implement minimal alias/type/answer normalization in `jsonQuestionImporter.ts`.
- [ ] Re-run focused test and verify GREEN.

### Task 2: Thêm DRAG_DROP_FILL, ORDERING, DROPDOWN và UNDERLINE

**Files:**
- Modify: `tests/questionImporters.test.ts`
- Modify: `src/features/manual-quiz-workspace/import/jsonQuestionImporter.ts`

- [ ] Add failing canonical tests for four types.
- [ ] DRAG_DROP_FILL assertion: `content` `{{blank1}}` -> internal `[blank1]`, answers resolve `drag_items` IDs into `{id, correctAnswer}` blanks, distractors preserved.
- [ ] ORDERING assertion: object item IDs and `correct_order` IDs -> text array + zero-based `correctOrder`.
- [ ] DROPDOWN assertion: `{{select1}}` -> `[select1]`, dropdowns -> stable internal blanks.
- [ ] UNDERLINE assertion: selectable part IDs -> `words` and zero-based `correctWordIndexes`.
- [ ] Run focused test and verify RED.
- [ ] Implement minimal normalizers/build branches.
- [ ] Re-run focused test and verify GREEN.

### Task 3: Thêm IMAGE_QUESTION, CATEGORIZATION, WORD_ASSEMBLY và RIDDLE

**Files:**
- Modify: `tests/questionImporters.test.ts`
- Modify: `src/features/manual-quiz-workspace/import/jsonQuestionImporter.ts`

- [ ] Add failing tests for `IMAGE_QUESTION` with actual `image`/`image_url` accepted and description-only marked `needsReview`.
- [ ] Add CATEGORIZATION test converting `groups` + `items` + `answers` into `categories` + item `categoryId`.
- [x] Add WORD_ASSEMBLY character test mapping to `WORD_SCRAMBLE` and sentence-token test mapping to `ORDERING`.
- [ ] Add RIDDLE test mapping `riddle` + `accepted_answers` into `riddleLines` + `correctAnswer`/accepted pipe value and required domain metadata.
- [ ] Run focused test and verify RED.
- [ ] Implement minimal branches and clear review issues.
- [ ] Re-run focused test and verify GREEN.

### Task 4: Boundary conflicts, validation and JSON sample

**Files:**
- Modify: `tests/questionImporters.test.ts`
- Modify: `src/features/manual-quiz-workspace/import/jsonQuestionImporter.ts`
- Potentially modify: `tests/QuestionImportDrawer.test.tsx` only if the copied sample assertion changes.

- [ ] Test both `question_type` and `type`: same mapping accepted; conflicting mapping prefers canonical and marks review.
- [ ] Test broken references (matching IDs, drag IDs, ordering IDs, categorization group IDs) become `needsReview` with readable issue text.
- [ ] Update `QUESTION_JSON_EXAMPLE` to canonical Gem-friendly JSON while parser continues accepting wrapper and legacy examples.
- [ ] Run `npx vitest run tests/questionImporters.test.ts tests/QuestionImportDrawer.test.tsx tests/QuestionImportReview.test.tsx --maxWorkers=2`.

### Task 5: Static verification and runtime preview

**Files:** only fixes required by verification.

- [ ] Run `npm run typecheck`.
- [ ] Run targeted lint or `npm run lint` according to repository command availability.
- [ ] Run `npm run build`.
- [ ] Paste canonical mixed-type JSON through the local JSON drawer and verify valid supported questions appear as `sẵn sàng`, with answer fields populated.
- [ ] Verify a five-type-only JSON subset works without requiring the remaining eight types.
- [x] Verify description-only image surfaces `needsReview`, while sentence-style WORD_ASSEMBLY adapts safely to ORDERING.
- [ ] Run `git diff` review and GitNexus `detect_changes` for the worktree.
- [ ] Stop without commit/push/deploy and report evidence to the user.
