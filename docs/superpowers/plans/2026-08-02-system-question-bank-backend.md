# TôHiệuQuiz System Question Bank Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng schema D1, hợp đồng dữ liệu và API an toàn cho ngân hàng câu hỏi SYSTEM/PERSONAL, giữ nguyên route legacy trong suốt giai đoạn chuyển đổi.

**Architecture:** Tạo bảng `question_bank_items` và `question_bank_audit` thay vì thay đổi trực tiếp `test_bank`. Route `/api/test-bank` dùng service/repository mới, trong khi `GET /teacher/:teacherId` và payload POST cũ được adapter sang mô hình mới. Feature flag `system_question_bank_v1` mặc định tắt; bảng legacy không bị xóa.

**Tech Stack:** Cloudflare Workers, D1/SQLite, TypeScript, Web Crypto SHA-256, Vitest.

## Global Constraints

- Không xóa hoặc đổi schema bảng `test_bank` trong đợt đầu.
- Chỉ admin được tạo, sửa, phát hành, lưu trữ và bulk import câu SYSTEM.
- Giáo viên chỉ đọc SYSTEM/PUBLISHED và PERSONAL của chính mình.
- `pageSize` mặc định 30, tối thiểu 1, tối đa 100.
- Bulk import tối đa 100 câu/request và trả kết quả từng dòng.
- Search tối đa 120 ký tự; escape `%`, `_` và `\\` trước `LIKE ... ESCAPE '\\'`.
- Không đưa ID, tags, metadata hoặc timestamp vào `content_hash`.
- DELETE SYSTEM là soft archive; DELETE PERSONAL giữ tương thích legacy.
- Feature flag `system_question_bank_v1` mặc định `enabled = 0`.

---

## File Map

**Create**
- `workers/migrations/0060_system_question_bank.sql`
- `workers/rollbacks/0060_drop_system_question_bank.sql`
- `shared/question-bank.contract.ts`
- `workers/src/services/questionBankContent.ts`
- `workers/src/services/questionBankRepository.ts`
- `workers/src/services/questionBankService.ts`
- `tests/questionBankMigration.worker.test.ts`
- `tests/questionBankContent.worker.test.ts`
- `tests/questionBankRoutesV2.worker.test.ts`
- `tests/questionBankBulk.worker.test.ts`

**Modify**
- `workers/schema.sql`
- `workers/src/routes/testBank.ts`
- `workers/src/security/apiAuthorizationPolicy.ts`
- `tests/testBankRoutes.worker.test.ts`
- `tests/testBankService.test.ts`
- `tests/d1MigrationLayout.test.ts`
- `tests/freshD1Bootstrap.test.ts`

### Task 1: D1 schema, indexes, legacy backfill and rollout flag

**Interfaces:**
- Produces tables `question_bank_items`, `question_bank_audit` and flag `system_question_bank_v1`.
- Preserves `test_bank` unchanged.

- [x] **Step 1: Write failing migration tests**

Add assertions to `tests/questionBankMigration.worker.test.ts`:

```ts
expect(sql).toContain('CREATE TABLE IF NOT EXISTS question_bank_items');
expect(sql).toContain("CHECK (scope IN ('SYSTEM', 'PERSONAL'))");
expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_question_bank_unique_content');
expect(sql).toContain("'system_question_bank_v1'");
expect(sql).toContain('INSERT OR IGNORE INTO question_bank_items');
expect(sql).not.toContain('DROP TABLE test_bank');
```

- [x] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/questionBankMigration.worker.test.ts`
Expected: FAIL because migration `0060_system_question_bank.sql` does not exist.

- [x] **Step 3: Create migration**

Create `workers/migrations/0060_system_question_bank.sql` with the approved schema, indexes and audit table. Backfill legacy rows with:

```sql
INSERT OR IGNORE INTO question_bank_items (
  id, scope, owner_id, status, question_data, question_text, question_type,
  difficulty, explanation, grade, subject, semester, topic_code, lesson_code,
  source, tags, content_hash, created_by, updated_by, created_at, updated_at
)
SELECT
  id, 'PERSONAL', teacher_id, 'PUBLISHED', question_data,
  COALESCE(json_extract(question_data, '$.question'), json_extract(question_data, '$.mainQuestion'), ''),
  COALESCE(json_extract(question_data, '$.type'), ''),
  json_extract(question_data, '$.difficulty'),
  COALESCE(json_extract(question_data, '$.explanation'), ''),
  NULL, COALESCE(json_extract(question_data, '$.subject'), ''), NULL, '', '',
  'LEGACY', COALESCE(tags, '[]'), 'legacy:' || id,
  teacher_id, teacher_id, COALESCE(created_at, datetime('now')), COALESCE(created_at, datetime('now'))
FROM test_bank;
```

Insert the runtime flag with owner `assessment-platform`, audience `teacher`, percentage `100`, enabled `0`.

- [x] **Step 4: Add rollback migration**

`workers/rollbacks/0060_drop_system_question_bank.sql` may remove only the new flag, audit table, item table and their indexes. It must not touch `test_bank`.

- [x] **Step 5: Mirror schema in `workers/schema.sql`**

Copy the canonical table/index definitions and feature flag seed into the bootstrap schema.

- [x] **Step 6: Run migration tests**

Run: `npm test -- tests/questionBankMigration.worker.test.ts tests/d1MigrationLayout.test.ts tests/freshD1Bootstrap.test.ts`
Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add workers/migrations/0060_system_question_bank.sql workers/rollbacks/0060_drop_system_question_bank.sql workers/schema.sql workers/scripts/bootstrap_d1_migration_registry.sql tests/questionBankMigration.worker.test.ts tests/d1MigrationLayout.test.ts tests/d1RollbackCoverage.test.ts tests/freshD1Bootstrap.test.ts
git commit -m "feat(question-bank): add shared bank D1 schema"
```

### Task 2: Shared API contract and canonical content hashing

**Interfaces:**
- Produces `QuestionBankScope`, `QuestionBankStatus`, `QuestionBankItem`, `QuestionBankListParams`, `BulkImportResult`.
- Produces `canonicalizeQuestionData(question: unknown): string` and `hashQuestionData(question: unknown): Promise<string>`.

- [x] **Step 1: Write failing contract/hash tests**

In `tests/questionBankContent.worker.test.ts`, test that IDs, tags and metadata do not change the hash, while option order and correct answer do:

```ts
await expect(hashQuestionData({ ...base, id: 'a', tags: ['x'] }))
  .resolves.toBe(await hashQuestionData({ ...base, id: 'b', tags: ['y'] }));
expect(await hashQuestionData({ ...base, options: ['4', '3'] }))
  .not.toBe(await hashQuestionData(base));
```

- [x] **Step 2: Run test and verify failure**

Run: `npm test -- tests/questionBankContent.worker.test.ts`
Expected: FAIL because helper is missing.

- [x] **Step 3: Create `shared/question-bank.contract.ts`**

Define additive camelCase API types. Keep `questionData: Question` and include normalized metadata fields:

```ts
export type QuestionBankScope = 'SYSTEM' | 'PERSONAL';
export type QuestionBankStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export interface QuestionBankMetadata {
  grade: number | null;
  subject: string;
  semester: number | null;
  topicCode: string;
  lessonCode: string;
  source: string;
  tags: string[];
}
```

- [x] **Step 4: Create canonicalizer and SHA-256 helper**

`questionBankContent.ts` must recursively sort object keys, preserve array order, normalize whitespace in strings, and omit:

```ts
const HASH_OMITTED_KEYS = new Set([
  'id', 'tags', 'grade', 'subject', 'semester', 'topicCode', 'lessonCode',
  'source', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy',
]);
```

Use `crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))` and return lowercase hex.

- [x] **Step 5: Run tests**

Run: `npm test -- tests/questionBankContent.worker.test.ts`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add shared/question-bank.contract.ts workers/src/services/questionBankContent.ts tests/questionBankContent.worker.test.ts
git commit -m "feat(question-bank): define contracts and content hashing"
```

### Task 3: Repository with safe filters and pagination

**Interfaces:**
- Produces `listQuestionBankItems(db, actor, params)`.
- Produces `getQuestionBankItem(db, actor, id)`.
- Produces `insertQuestionBankItem`, `patchQuestionBankItem`, `archiveQuestionBankItem`, `deletePersonalQuestionBankItem`.

- [x] **Step 1: Write failing repository route tests**

Cover SYSTEM/PUBLISHED visibility, admin status filters, personal owner isolation, ALL union, total count and escaped search.

- [x] **Step 2: Run and verify failure**

Run: `npm test -- tests/questionBankRoutesV2.worker.test.ts`
Expected: FAIL because V2 list behavior is absent.

- [x] **Step 3: Implement parameter parsing**

Normalize:

```ts
const page = Math.max(1, Number(searchParams.get('page') || 1));
const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || 30)));
const search = (searchParams.get('search') || '').trim().slice(0, 120);
```

Reject unsupported `scope`, invalid grade/semester/difficulty and teacher requests for another `ownerId`.

- [x] **Step 4: Implement prepared SQL builder**

Build WHERE fragments only from allowlisted columns. Search must bind `%${escaped}%` against `question_text`; never interpolate user values into SQL.

- [x] **Step 5: Map rows safely**

Parse `question_data` and `tags` per row. Invalid legacy JSON is skipped and logged with item ID; it must not fail the full list response.

- [x] **Step 6: Run tests**

Run: `npm test -- tests/questionBankRoutesV2.worker.test.ts`
Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add workers/src/services/questionBankRepository.ts tests/questionBankRoutesV2.worker.test.ts
git commit -m "feat(question-bank): add filtered paginated repository"
```

### Task 4: Create, update, publish, archive and legacy adapters

**Interfaces:**
- Consumes repository and hashing helpers.
- Produces service methods `createItem`, `patchItem`, `deleteItem`, `copySystemItemToPersonal`.

- [x] **Step 1: Extend route tests with authorization matrix**

Test teacher cannot create/patch SYSTEM, cannot set another owner, admin can create DRAFT and publish, SYSTEM DELETE archives, PERSONAL DELETE removes, and repeated delete is successful.

- [x] **Step 2: Run tests and verify failure**

Run: `npm test -- tests/questionBankRoutesV2.worker.test.ts tests/testBankRoutes.worker.test.ts`
Expected: FAIL on new cases while legacy cases remain passing.

- [x] **Step 3: Implement `questionBankService.ts`**

Validate question data with `validateQuestion` from `schemas/quiz.schema.ts`, derive `questionText`, `questionType`, `difficulty`, `explanation`, compute hash, and translate D1 unique constraint errors to `DUPLICATE_QUESTION`.

- [x] **Step 4: Rewrite `handleTestBankRoutes` as a thin dispatcher**

Route order must be:

```ts
GET /teacher/:teacherId          // legacy response { items }
POST /bulk
POST /:id/copy-to-personal
GET /:id
PATCH /:id
DELETE /:id
GET /
POST /
```

Legacy POST payload without `scope` maps to PERSONAL and uses actor as owner for non-admin users.

- [x] **Step 5: Add structured error mapping**

Return `{ error: { code, message, details? } }` for new routes while preserving legacy response shape for legacy GET/POST. Do not expose SQL text.

- [x] **Step 6: Update authorization policy**

Keep `/api/test-bank` as authenticated teacher/admin and document that row-level ownership/status is enforced in the route/service.

- [x] **Step 7: Run tests**

Run: `npm test -- tests/questionBankRoutesV2.worker.test.ts tests/testBankRoutes.worker.test.ts tests/apiAuthorizationMatrix.test.ts`
Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add workers/src/services/questionBankService.ts workers/src/routes/testBank.ts workers/src/security/apiAuthorizationPolicy.ts tests/questionBankRoutesV2.worker.test.ts tests/testBankRoutes.worker.test.ts
git commit -m "feat(question-bank): add scoped CRUD and compatibility routes"
```

### Task 5: Bulk import, copy-to-personal and audit

**Interfaces:**
- `bulkImportSystemItems(actor, items)` accepts 1–100 entries.
- Every SYSTEM mutation writes one audit record.

- [x] **Step 1: Write failing bulk tests**

Test mixed CREATED/DUPLICATE/INVALID rows, >100 returns 413, teacher returns 403, and valid rows survive invalid neighbors.

- [x] **Step 2: Run and verify failure**

Run: `npm test -- tests/questionBankBulk.worker.test.ts`
Expected: FAIL.

- [x] **Step 3: Implement independent validation**

Each result is:

```ts
type BulkItemResult =
  | { index: number; status: 'CREATED'; id: string }
  | { index: number; status: 'DUPLICATE'; existingId: string }
  | { index: number; status: 'INVALID'; errors: string[] };
```

Execute D1 batches in chunks of 25 prepared statements.

- [x] **Step 4: Implement audit records**

Store before/after snapshots only for SYSTEM mutations. Audit failures must abort the matching mutation so the system never changes content without an audit trail.

- [x] **Step 5: Implement copy-to-personal**

Require SYSTEM/PUBLISHED, create a new ID, preserve metadata, append tag `Sao chép từ kho hệ thống`, and return 409 with `existingId` on duplicate.

- [x] **Step 6: Run tests**

Run: `npm test -- tests/questionBankBulk.worker.test.ts tests/questionBankRoutesV2.worker.test.ts`
Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add workers/src/services/questionBankService.ts workers/src/routes/testBank.ts tests/questionBankBulk.worker.test.ts tests/questionBankRoutesV2.worker.test.ts
git commit -m "feat(question-bank): add bulk import copy and audit"
```

### Task 6: Backend verification and safe migration rehearsal

- [x] **Step 1: Run focused backend tests**

```bash
npm test -- tests/questionBankMigration.worker.test.ts tests/questionBankContent.worker.test.ts tests/questionBankRoutesV2.worker.test.ts tests/questionBankBulk.worker.test.ts tests/testBankRoutes.worker.test.ts tests/testBankService.test.ts
```

Expected: all PASS.

- [x] **Step 2: Run Worker typecheck**

Run: `npm run typecheck:workers`
Expected: exit 0.

- [x] **Step 3: Apply migration locally twice**

```bash
cd workers
npx wrangler d1 migrations apply tohieuquiz-db --local
npx wrangler d1 migrations apply tohieuquiz-db --local
```

Expected: second run reports no pending migration and preserves data.

- [x] **Step 4: Query local invariants**

Verify tables, indexes, legacy backfill count and disabled feature flag.

- [x] **Step 5: Run security scan**

Run: `npm run security:scan`
Expected: no new findings.

- [x] **Step 6: Commit verification notes**

Record commands and results in `docs/testing/system-question-bank-backend-verification.md` and commit.
