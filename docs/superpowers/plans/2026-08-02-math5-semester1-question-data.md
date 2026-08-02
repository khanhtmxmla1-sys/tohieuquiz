# Toán Lớp 5 Học Kì 1 Question Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biên soạn, kiểm định, version hóa và nhập 350 câu hỏi Toán lớp 5 học kì 1, đủ 35 bài và 10 câu mỗi bài.

**Architecture:** Curriculum là nguồn chuẩn duy nhất. Dữ liệu câu hỏi được chia thành 6 file theo chủ đề, kiểm tra bằng validator dùng chính `Question` schema và content hash của backend, sau đó nhập DRAFT theo lô tối đa 100 và publish từng chủ đề sau smoke test.

**Tech Stack:** TypeScript/Node.js, JSON, Vitest, Cloudflare D1/Workers API.

## Global Constraints

- Chính xác 350 câu, 35 lesson code, mỗi lesson 10 câu.
- Mỗi bài mặc định: 4 MCQ, 2 SHORT_ANSWER, 1 TRUE_FALSE, 1 dạng tương tác, 2 câu vận dụng.
- Mỗi bài: 4 câu difficulty 1, 4 câu difficulty 2, 2 câu difficulty 3.
- Mỗi câu có đáp án chuẩn, metadata đầy đủ và không phụ thuộc hình ảnh trong V1; dữ liệu curated không lưu `explanation` theo contract hiện tại.
- Không sao chép nguyên văn câu hỏi sách giáo khoa.
- Không có content hash trùng trong SYSTEM.
- Import ban đầu ở trạng thái DRAFT; publish từng chủ đề, không publish toàn bộ một lần.

---

## File Map

**Create**
- `data/question-bank/math5-semester1/curriculum.json`
- `data/question-bank/math5-semester1/topic-01.json`
- `data/question-bank/math5-semester1/topic-02.json`
- `data/question-bank/math5-semester1/topic-03.json`
- `data/question-bank/math5-semester1/topic-04.json`
- `data/question-bank/math5-semester1/topic-05.json`
- `data/question-bank/math5-semester1/topic-06.json`
- `data/question-bank/math5-semester1/manifest.json`
- `scripts/question-bank/math5-types.ts`
- `scripts/question-bank/generate-math5-skeleton.ts`
- `scripts/question-bank/generate-math5-dataset.ts`
- `scripts/question-bank/validate-math5-dataset.ts`
- `scripts/question-bank/build-math5-review-report.ts`
- `scripts/question-bank/import-math5-drafts.ts`
- `scripts/question-bank/publish-math5-topic.ts`
- `tests/math5QuestionBankCurriculum.test.ts`
- `tests/math5QuestionBankDataset.test.ts`
- `tests/math5QuestionBankOperations.test.ts`
- `tests/math5QuestionBankArithmeticAudit.test.ts`
- `reports/question-bank/math5-semester1-review.md`
- `tsconfig.question-bank.json`

**Modify**
- `package.json`
- `.gitignore` only if generated private report artifacts require exclusion; committed source JSON must remain tracked.

### Task 1: Curriculum source of truth

- [x] **Step 1: Write failing curriculum tests**

Assert 6 topics, 35 unique lessons, sequential lesson codes and exact titles/pages supplied by the user.

```ts
expect(curriculum.topics).toHaveLength(6);
expect(curriculum.topics.flatMap((topic) => topic.lessons)).toHaveLength(35);
expect(new Set(lessonCodes).size).toBe(35);
expect(lessonCodes[0]).toBe('M5-S1-L01');
expect(lessonCodes[34]).toBe('M5-S1-L35');
```

- [x] **Step 2: Create curriculum JSON**

Each topic has `code`, `title`, `order`; each lesson has `code`, `number`, `title`, `page`, `keywords` and allowed interaction types.

- [x] **Step 3: Run tests**

Run: `npm test -- tests/math5QuestionBankCurriculum.test.ts`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add data/question-bank/math5-semester1/curriculum.json tests/math5QuestionBankCurriculum.test.ts
git commit -m "data(question-bank): add math 5 semester 1 curriculum"
```

### Task 2: Skeleton generator and dataset contract

**Interfaces:**
- Produces 10 deterministic slots per lesson.
- Produces `CuratedQuestionBankInput` compatible with bulk API.

- [x] **Step 1: Define types**

```ts
export interface CuratedQuestionBankInput {
  scope: 'SYSTEM';
  status: 'DRAFT';
  questionData: Question;
  metadata: {
    grade: 5;
    subject: 'MATH';
    semester: 1;
    topicCode: string;
    lessonCode: string;
    source: 'CURATED_ORIGINAL';
    tags: string[];
  };
}
```

- [x] **Step 2: Write failing skeleton tests**

For every lesson, assert 10 slots and difficulty/type distribution.

- [x] **Step 3: Implement generator**

Generate stable IDs like `m5-s1-l06-q01` and slot descriptors only; do not generate final educational content automatically.

- [x] **Step 4: Add npm scripts**

```json
"question-bank:math5:skeleton": "node --experimental-strip-types scripts/question-bank/generate-math5-skeleton.ts",
"question-bank:math5:generate": "node --experimental-strip-types scripts/question-bank/generate-math5-dataset.ts",
"question-bank:math5:validate": "node --experimental-strip-types scripts/question-bank/validate-math5-dataset.ts",
"question-bank:math5:report": "node --experimental-strip-types scripts/question-bank/build-math5-review-report.ts"
```

- [x] **Step 5: Run tests and commit**

Run: `npm test -- tests/math5QuestionBankDataset.test.ts`
Expected: skeleton tests PASS.

### Task 3: Author Topic 1 — Lessons 1–5, 50 questions

- [x] **Step 1: Fill `topic-01.json`**

Create 50 original questions covering natural numbers, operations, fractions, decimal fractions and operations with fractions.

- [x] **Step 2: Validate each lesson immediately**

Run: `npm run question-bank:math5:validate -- --topic M5-S1-T01`
Expected: `70 valid, 0 invalid, 0 duplicate`.

- [x] **Step 3: Review numeric correctness**

Use independent calculation checks for every arithmetic answer; ensure denominators, units and simplification are correct.

- [x] **Step 4: Commit**

```bash
git add data/question-bank/math5-semester1/topic-01.json
git commit -m "data(question-bank): author math 5 topic 1 questions"
```

### Task 4: Author Topics 2 and 3 — Lessons 6–16, 110 questions

- [x] **Step 1: Fill `topic-02.json` with 50 questions**

Cover unlike-denominator fractions, mixed numbers, geometry/measurement review and decimal concepts.

- [x] **Step 2: Fill `topic-03.json` with 40 questions**

Cover decimal comparison, decimal measurement notation, rounding, square kilometres, hectares and area units.

- [x] **Step 3: Validate**

Run: `npm run question-bank:math5:validate -- --topic M5-S1-T02 --topic M5-S1-T03`
Expected: `110 valid, 0 invalid, 0 duplicate`.

- [x] **Step 4: Commit each topic separately**

Use commits `data(question-bank): author math 5 topic 2 questions` and `... topic 3 ...`.

### Task 5: Author Topic 4 — Lessons 17–22, 60 questions

- [x] **Step 1: Fill `topic-04.json`**

Cover practical measurement, measurement review, decimal addition, subtraction, multiplication and division. Ensure division questions have exact or curriculum-appropriate decimal results.

- [x] **Step 2: Validate and independently recompute answers**

Run: `npm run question-bank:math5:validate -- --topic M5-S1-T04`
Expected: `60 valid, 0 invalid, 0 duplicate`.

- [x] **Step 3: Commit**

Commit message: `data(question-bank): author math 5 topic 4 questions`.

### Task 6: Author Topic 5 — Lessons 23–29, 70 questions

- [x] **Step 1: Fill `topic-05.json`**

Cover scaling decimals by powers of ten, decimal operation practice, triangles, trapezoids, circles, practical drawing/assembly and geometry review. V1 questions are text-only and do not set `IMAGE_QUESTION` or `GEOMETRY`.

- [x] **Step 2: Validate formulas and units**

Every area/circumference question states sufficient dimensions and uses π = 3,14 where required; the review report shows the canonical answer.

- [x] **Step 3: Run validator and commit**

Expected: `50 valid, 0 invalid, 0 duplicate`.

### Task 7: Author Topic 6 — Lessons 30–35, 60 questions

- [x] **Step 1: Fill `topic-06.json`**

Create balanced semester review across decimals, operations, shapes, perimeter/area, measurement and general review.

- [x] **Step 2: Detect cross-topic duplicates**

Run the validator against all six files, not only Topic 6.

- [x] **Step 3: Commit**

Commit message: `data(question-bank): author math 5 semester review questions`.

### Task 8: Dataset validator and review report

**Interfaces:**
- Validator exits non-zero on any count, schema, metadata, distribution, answer or duplicate error.
- Report groups content by topic and lesson for human review.

- [x] **Step 1: Write failing validator tests**

Fixtures must cover missing explanation, invalid answer, wrong difficulty distribution, duplicate hash, wrong lesson code and count 349/351.

- [x] **Step 2: Implement validation pipeline**

Use `validateQuestion`, curriculum lookup and `hashQuestionData`. Add type-specific checks such as MCQ answer A–D, SHORT_ANSWER non-empty, TRUE_FALSE item count and interaction contract validity.

- [x] **Step 3: Build manifest**

`manifest.json` records dataset version, generated timestamp, file list, counts, hash and validation command. Do not include secrets or production IDs.

- [x] **Step 4: Generate Markdown review report**

For every lesson show all questions with type, difficulty and canonical answer. Do not persist `explanation`; flag repeated wording even when hashes differ.

- [x] **Step 5: Run complete validation**

```bash
npm run question-bank:math5:validate
npm run question-bank:math5:report
npm test -- tests/math5QuestionBankCurriculum.test.ts tests/math5QuestionBankDataset.test.ts
```

Expected: exactly `350 valid, 0 invalid, 0 duplicate`; tests PASS.

### Task 9: Draft import script and production preflight

- [x] **Step 1: Write import script tests**

Mock API calls and assert batches `100,100,100,50`, stop on authentication errors, continue reporting row-level invalid/duplicate results, and never send PUBLISHED status.

- [x] **Step 2: Implement import script**

Require `TOHIEUQUIZ_API_BASE_URL` and an explicit authenticated mechanism approved by the project. Provide `--dry-run` as default and require `--execute` to write.

- [x] **Step 3: Add preflight query/report**

Before execution, call/list SYSTEM questions for the target lesson codes and abort if unexpected existing records are found unless `--allow-existing` is explicitly supplied.

- [x] **Step 4: Run dry-run**

Run: `npm run question-bank:math5:import -- --dry-run`
Expected: four batches, 350 prepared, zero network writes.

- [ ] **Step 5: Execute import only after backend/frontend deploy and admin approval**

Run with `--execute`; save the returned report to `reports/question-bank/math5-import-<timestamp>.json` and do not commit authentication material.

### Task 10: Verify DRAFT data and publish by topic

- [ ] **Step 1: Query invariants after import**

Verify 350 SYSTEM/DRAFT items, 10 per lesson, correct totals per topic (50, 50, 60, 60, 70, 60), and zero duplicate hashes.

- [ ] **Step 2: Render samples**

Open at least 2 questions per type and 2 lessons per topic in the real admin/teacher UI. Check math rendering and answers.

- [ ] **Step 3: Publish Topic 1 only**

Use `publish-math5-topic.ts --topic M5-S1-T01 --execute`; verify teacher visibility and no edit/delete controls.

- [ ] **Step 4: Publish remaining topics one at a time**

After each topic, run count queries and smoke tests. Stop immediately on rendering, permission or count mismatch.

- [ ] **Step 5: Final production verification**

Expected: 350 SYSTEM/PUBLISHED, 35 lessons × 10, feature flag enabled for intended cohort, legacy personal bank still readable.

- [ ] **Step 6: Record release evidence**

Update `reports/question-bank/math5-semester1-review.md` or a release evidence document with validation summary, import report path, publish timestamps and smoke-test results.
