# Certificate Per-Item Queue Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay kiến trúc cấp chứng nhận từ “một Queue message render cả batch” sang “mỗi chứng nhận là một công việc độc lập”, có lease riêng, tự phục hồi theo phút và không còn để batch treo vô thời hạn ở trạng thái `processing`.

**Architecture:** API vẫn tạo một `certificate_batch` như hiện tại, nhưng Queue message ban đầu chỉ làm nhiệm vụ phân phối. Consumer sau đó tạo các message `render_certificate`, mỗi message chỉ render đúng một chứng nhận. Mỗi dòng `certificates` có lease và thời điểm enqueue riêng; render dùng compare-and-swap và token để chống ghi đè từ Worker cũ. Cron mỗi phút sẽ phát hiện item `pending` bị mất message hoặc `processing` bị stale, tự enqueue lại, đồng thời chuyển item vượt giới hạn retry sang `failed` để batch luôn đạt trạng thái kết thúc thay vì treo vô hạn.

**Tech Stack:** TypeScript, Cloudflare Workers, Cloudflare Queues, D1, R2, Resvg/WASM, Vitest.

## Global Constraints

- Không reset/xóa các chứng nhận đã `sent`; ảnh PNG đã phát hành là bất biến.
- Mỗi invocation render tối đa **1 chứng nhận**.
- Hỗ trợ message Queue cũ dạng `{ batchId }` trong thời gian rollout để không làm mất message tồn tại trước deploy.
- Mọi ghi kết quả render phải được fence bằng `processing_token`.
- Một item `processing` quá **2 phút** được coi là stale.
- Một item `pending` đã enqueue quá **2 phút** nhưng chưa được claim có thể được enqueue lại.
- Mỗi chứng nhận được claim render tối đa **5 lần**; vượt ngưỡng phải chuyển `failed`, không được để `processing` vĩnh viễn.
- Cron phục hồi dùng lịch `* * * * *` đã có; không tạo thêm cron mới.
- Không đưa tên học sinh hoặc dữ liệu cá nhân vào log vận hành.
- Tất cả thao tác production mutation chỉ thực hiện sau khi code đã merge, CI pass và có phê duyệt riêng.

---

## Root-cause evidence đã xác nhận

Batch production `batch-582d7ae9-1394-435d-a2c6-3c0e1d500821` tạo 18 chứng nhận. Lần chạy đầu hoàn thành 5 chứng nhận rồi Worker dừng mà không ghi `error_message`. Sau lease 10 phút, lần claim thứ hai chuyển 13 item còn lại sang `processing` nhưng không có item nào hoàn thành. Đây là cùng lớp lỗi với incident cũ 3/21: hard termination có thể bỏ qua `catch`, trong khi trạng thái batch/item đã được chuyển sang `processing`.

Bản sửa trước đã giảm `CERTIFICATE_RENDER_CONCURRENCY` từ 4 xuống 1 nhưng vẫn render toàn bộ batch trong một invocation. Vì vậy một invocation bị terminate vẫn có thể làm nhiều item mắc chung trong trạng thái `processing`.

---

## File map dự kiến

- Create: `workers/migrations/0082_certificate_item_queue_recovery.sql`
- Create: `workers/src/services/certificateQueueMessages.ts`
- Create: `workers/src/services/certificateRecoveryService.ts`
- Create: `workers/src/services/certificateBatchState.ts`
- Modify: `workers/schema.sql`
- Modify: `workers/src/types.ts`
- Modify: `workers/src/routes/certificates/batchPersistence.ts`
- Modify: `workers/src/routes/certificates/retryBatchHandler.ts`
- Modify: `workers/src/queues/certificateQueue.ts`
- Modify: `workers/src/services/certificateBatchProcessor.ts`
- Modify: `workers/src/services/operationsService.ts`
- Modify: `workers/src/index.ts`
- Modify: `workers/wrangler.certificate-consumer.toml`
- Modify: `tests/certificateQueue.worker.test.ts`
- Modify: `tests/certificateBatchProcessor.worker.test.ts`
- Modify: `tests/certificates.worker.test.ts`
- Modify: `tests/operationsService.test.ts`
- Modify: `tests/systemTimeCronContract.test.ts`
- Modify as needed for SQLite test schema: `tests/helpers/sqliteD1.ts`

---

### Task 1: Khóa regression cho lỗi “Worker chết giữa batch”

**Files:**
- Modify: `tests/certificateQueue.worker.test.ts`
- Modify: `tests/certificateBatchProcessor.worker.test.ts`

**Interfaces:**
- Consumes: Queue consumer hiện tại và processor hiện tại.
- Produces: các test RED mô tả kiến trúc mới trước khi sửa implementation.

- [ ] **Step 1: Thêm test chứng minh một message render không được chứa nhiều hơn một certificate**

Test phải tạo batch có ít nhất 3 item và xác nhận handler `render_certificate` chỉ truyền đúng một item vào renderer.

Message chuẩn mới:

```ts
{ kind: 'render_certificate', batchId: 'batch-1', certificateId: 'cert-1' }
```

Expected trước khi sửa: FAIL vì consumer hiện chỉ hiểu `{ batchId }` và gọi `processBatch` với toàn bộ item.

- [ ] **Step 2: Thêm test hard-interruption recovery**

Mô phỏng trạng thái:

```text
batch: processing
cert-1..5: sent
cert-6: processing, processing_started_at cũ hơn 2 phút
cert-7..18: pending
```

Sau một lượt recovery + queue delivery:
- `cert-1..5` giữ nguyên `sent`.
- `cert-6` được phép reclaim.
- từng message render chỉ claim một certificate.
- không có câu lệnh nào reset `sent` về `pending`.

- [ ] **Step 3: Thêm test duplicate delivery**

Hai message cùng `certificateId` chạy gần đồng thời. Chỉ một message được claim bằng CAS; message còn lại không render lần hai và không thay R2 key.

- [ ] **Step 4: Thêm test hard-failure vượt ngưỡng**

Item có `attempt_count = 5`, lease stale. Recovery phải đưa item về `failed`, batch về `partial` hoặc `failed`; tuyệt đối không để `processing`.

- [ ] **Step 5: Chạy RED**

Run:

```bash
npm test -- tests/certificateQueue.worker.test.ts tests/certificateBatchProcessor.worker.test.ts
```

Expected: các test mới FAIL đúng do message contract/per-item lease chưa tồn tại.

- [ ] **Step 6: Commit test RED**

```bash
git add tests/certificateQueue.worker.test.ts tests/certificateBatchProcessor.worker.test.ts
git commit -m "test: cover per-certificate queue recovery"
```

---

### Task 2: Thêm lease và enqueue state ở cấp certificate

**Files:**
- Create: `workers/migrations/0082_certificate_item_queue_recovery.sql`
- Modify: `workers/schema.sql`
- Modify: `workers/src/services/operationsService.ts`
- Test: `tests/operationsService.test.ts`

**Interfaces:**
- Produces các cột:
  - `certificates.processing_started_at: TEXT | NULL`
  - `certificates.processing_token: TEXT | NULL`
  - `certificates.enqueued_at: TEXT | NULL`

- [ ] **Step 1: Viết migration**

```sql
ALTER TABLE certificates ADD COLUMN processing_started_at TEXT;
ALTER TABLE certificates ADD COLUMN processing_token TEXT;
ALTER TABLE certificates ADD COLUMN enqueued_at TEXT;

CREATE INDEX IF NOT EXISTS idx_certs_queue_recovery
  ON certificates(status, processing_started_at, enqueued_at, updated_at);
```

- [ ] **Step 2: Đồng bộ `workers/schema.sql`**

Trong `certificates`, thêm ba cột ngay sau `attempt_count`:

```sql
  processing_started_at TEXT,
  processing_token TEXT,
  enqueued_at TEXT,
```

và thêm index giống migration.

- [ ] **Step 3: Cập nhật expected migration**

```ts
export const EXPECTED_LATEST_MIGRATION = '0082_certificate_item_queue_recovery.sql';
```

- [ ] **Step 4: Đổi health probe sang kiểm tra item-level stale**

Probe phải đếm `certificates`, không chỉ `certificate_batches`:

```sql
SELECT
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
  SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing_count,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
  SUM(CASE
        WHEN status = 'processing'
         AND processing_started_at IS NOT NULL
         AND processing_started_at < ?
        THEN 1 ELSE 0
      END) AS stale_processing_count
FROM certificates
WHERE issued_at >= datetime('now', '-7 days')
```

- [ ] **Step 5: Test + migration dry-run**

Run:

```bash
npm test -- tests/operationsService.test.ts
npm run typecheck:workers
node workers/scripts/apply-d1-migrations-safe.cjs
```

Expected: PASS; dry-run nhận migration 0082 và không ghi production.

- [ ] **Step 6: Commit**

```bash
git add workers/migrations/0082_certificate_item_queue_recovery.sql workers/schema.sql workers/src/services/operationsService.ts tests/operationsService.test.ts
git commit -m "feat: add per-certificate queue lease state"
```

---

### Task 3: Chuẩn hóa Queue message và giữ tương thích message cũ

**Files:**
- Create: `workers/src/services/certificateQueueMessages.ts`
- Modify: `workers/src/types.ts`
- Modify: `workers/src/routes/certificates/batchPersistence.ts`
- Modify: `workers/src/routes/certificates/retryBatchHandler.ts`
- Test: `tests/certificates.worker.test.ts`

**Interfaces:**

```ts
export type CertificateQueueMessage =
  | { kind: 'dispatch_batch'; batchId: string }
  | { kind: 'render_certificate'; batchId: string; certificateId: string };

export function normalizeCertificateQueueMessage(
  body: unknown,
): CertificateQueueMessage | null;
```

Legacy input:

```ts
{ batchId: 'batch-1' }
```

phải normalize thành:

```ts
{ kind: 'dispatch_batch', batchId: 'batch-1' }
```

- [ ] **Step 1: Tạo message module**

Module phải validate chuỗi không rỗng, không throw với payload lạ, và trả `null` cho message invalid.

- [ ] **Step 2: Cập nhật Env binding type**

```ts
CERTIFICATE_QUEUE: Queue<CertificateQueueMessage>;
```

- [ ] **Step 3: Đổi batch creation sang dispatch message**

```ts
await env.CERTIFICATE_QUEUE.send({
  kind: 'dispatch_batch',
  batchId,
});
```

Nếu send thất bại sau khi D1 đã persist, không xóa batch. Ghi `error_message = 'CERTIFICATE_DISPATCH_ENQUEUE_FAILED'` và để recovery cron cứu batch ở task 6.

- [ ] **Step 4: Đổi retry endpoint**

Khi retry batch:
- batch: `status='pending'`, `processing_started_at=NULL`, `error_message=NULL`.
- item `failed`: `status='pending'`, `attempt_count=0`, `processing_started_at=NULL`, `processing_token=NULL`, `enqueued_at=NULL`, `error_message=NULL`.
- enqueue `dispatch_batch`.

- [ ] **Step 5: Test idempotency**

Tạo cùng `request_id` hai lần vẫn chỉ một batch; dispatch duplicate không tạo certificate row mới.

- [ ] **Step 6: Run tests**

```bash
npm test -- tests/certificates.worker.test.ts
npm run typecheck:workers
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add workers/src/services/certificateQueueMessages.ts workers/src/types.ts workers/src/routes/certificates/batchPersistence.ts workers/src/routes/certificates/retryBatchHandler.ts tests/certificates.worker.test.ts
git commit -m "refactor: add certificate queue message contract"
```

---

### Task 4: Tách batch state khỏi renderer và làm notification idempotent

**Files:**
- Create: `workers/src/services/certificateBatchState.ts`
- Modify: `workers/src/services/certificateBatchProcessor.ts`
- Test: `tests/certificateBatchProcessor.worker.test.ts`

**Interfaces:**

```ts
export async function reconcileCertificateBatch(
  env: Env,
  batchId: string,
): Promise<'pending' | 'processing' | 'sent' | 'partial' | 'failed'>;

export async function processCertificate(
  env: Env,
  input: {
    batchId: string;
    certificateId: string;
    processingToken: string;
  },
): Promise<'sent' | 'failed'>;
```

- [ ] **Step 1: Chuyển aggregate/finalization sang `certificateBatchState.ts`**

Count:

```sql
SELECT
  COUNT(*) AS total_count,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
  SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing_count,
  SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent_count,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count
FROM certificates
WHERE batch_id = ?
```

Rules:
- active > 0 => batch `processing`.
- active = 0, sent = total => `sent`.
- active = 0, sent > 0, failed > 0 => `partial`.
- active = 0, sent = 0 => `failed`.

Chỉ gọi `finalizeCertificateBatch` khi SQL terminal transition thực sự đổi một row.

- [ ] **Step 2: Làm teacher/student notification có khóa ổn định**

Teacher completion notification dùng ID ổn định:

```ts
id: `ntf-certificate-batch-${batchId}`
```

Student certificate notification dùng:

```ts
id: `ntf-certificate-${certificate.certificate_id}`
```

Như vậy recovery/finalize chạy lại không tạo notification trùng.

Parent notification đã có unique index `(student_id, source_type, source_id)`; giữ `source_type='certificate'` + `source_id=certificateId`.

- [ ] **Step 3: Refactor renderer thành `processCertificate`**

Mỗi call:
1. load batch/template + đúng một certificate;
2. load background;
3. render PNG;
4. R2 key chứa token;
5. publish bằng fenced update.

Fenced update bắt buộc:

```sql
UPDATE certificates
SET image_url = ?, png_r2_key = ?, status = 'sent', sent_at = ?,
    processing_started_at = NULL, processing_token = NULL,
    error_message = NULL, updated_at = ?
WHERE id = ? AND batch_id = ?
  AND status = 'processing'
  AND processing_token = ?
```

Nếu `changes = 0`, renderer cũ đã mất lease; không được coi là thành công và không được ghi đè row mới.

- [ ] **Step 4: Không còn vòng lặp render nhiều học sinh**

Xóa `runWithConcurrency` khỏi certificate path. Không còn `CERTIFICATE_RENDER_CONCURRENCY`, vì một invocation chỉ có một item.

- [ ] **Step 5: Test**

Các test bắt buộc:
- render một item;
- stale token không được publish;
- sent row không bị render lại;
- batch 5 sent + 13 active vẫn `processing`;
- batch 18 sent chuyển `sent` một lần;
- partial retry không tạo notification trùng.

Run:

```bash
npm test -- tests/certificateBatchProcessor.worker.test.ts
npm run typecheck:workers
```

- [ ] **Step 6: Commit**

```bash
git add workers/src/services/certificateBatchState.ts workers/src/services/certificateBatchProcessor.ts tests/certificateBatchProcessor.worker.test.ts
git commit -m "refactor: render one certificate per worker job"
```

---

### Task 5: Viết lại Queue consumer thành dispatcher + per-item renderer

**Files:**
- Modify: `workers/src/queues/certificateQueue.ts`
- Modify: `workers/wrangler.certificate-consumer.toml`
- Test: `tests/certificateQueue.worker.test.ts`

**Interfaces:**
- `dispatch_batch`: chỉ enqueue item work, không render.
- `render_certificate`: claim + render đúng một item.

Constants:

```ts
const CERTIFICATE_LEASE_MS = 2 * 60 * 1000;
const CERTIFICATE_ENQUEUE_STALE_MS = 2 * 60 * 1000;
const MAX_CERTIFICATE_RENDER_ATTEMPTS = 5;
const DISPATCH_PAGE_SIZE = 25;
```

- [ ] **Step 1: Dispatcher chỉ lấy tối đa 25 item**

Eligible:

```sql
SELECT id
FROM certificates
WHERE batch_id = ?
  AND status = 'pending'
  AND (
    enqueued_at IS NULL
    OR enqueued_at < ?
  )
ORDER BY issued_at, id
LIMIT 25
```

Trước mỗi send, update `enqueued_at=now`. Nếu send throw, clear `enqueued_at` cho đúng item để recovery có thể cứu ngay.

Nếu đủ 25 row, enqueue thêm một `dispatch_batch` để fan-out phần tiếp theo.

- [ ] **Step 2: Render handler claim bằng CAS**

```sql
UPDATE certificates
SET status = 'processing',
    attempt_count = attempt_count + 1,
    processing_started_at = ?,
    processing_token = ?,
    error_message = NULL,
    updated_at = ?
WHERE id = ?
  AND batch_id = ?
  AND attempt_count < 5
  AND (
    status = 'pending'
    OR (
      status = 'processing'
      AND processing_started_at IS NOT NULL
      AND processing_started_at < ?
    )
  )
```

Nếu không claim được:
- row `sent` hoặc `failed`: ack duplicate.
- row `processing` còn lease: ack duplicate; owner hiện tại hoặc Cloudflare redelivery của owner sẽ chịu trách nhiệm.
- row không tồn tại: ack + log ID kỹ thuật, không log tên học sinh.

- [ ] **Step 3: Success path**

Sau `processCertificate`:
- gọi `reconcileCertificateBatch`;
- ack message.

- [ ] **Step 4: Caught failure path**

Nếu attempt hiện tại < 5:

```sql
UPDATE certificates
SET status='pending',
    processing_started_at=NULL,
    processing_token=NULL,
    enqueued_at=NULL,
    error_message=?,
    updated_at=?
WHERE id=? AND processing_token=?
```

sau đó `queueMessage.retry({ delaySeconds })`.

Nếu attempt >= 5:
- fenced update sang `failed`;
- reconcile batch;
- ack. Không để row quay lại `processing`.

- [ ] **Step 5: Hard termination path**

Không thể catch hard termination, nên correctness dựa trên:
- lease 2 phút;
- Cloudflare redelivery;
- cron recovery task 6;
- attempt_count item-level;
- fenced R2/D1 publish.

- [ ] **Step 6: Queue config**

Giữ `max_batch_size = 5` vì đó là số Queue message, nhưng tăng:

```toml
max_retries = 5
retry_delay = 30
```

Không tăng render concurrency trong code.

- [ ] **Step 7: GREEN tests**

```bash
npm test -- tests/certificateQueue.worker.test.ts tests/certificateBatchProcessor.worker.test.ts
npm run typecheck:workers
```

Expected: PASS tất cả regression, bao gồm duplicate delivery, stale reclaim, max-attempt failure.

- [ ] **Step 8: Commit**

```bash
git add workers/src/queues/certificateQueue.ts workers/wrangler.certificate-consumer.toml tests/certificateQueue.worker.test.ts
git commit -m "fix: isolate certificate rendering per queue message"
```

---

### Task 6: Thêm self-healing mỗi phút để không còn batch treo

**Files:**
- Create: `workers/src/services/certificateRecoveryService.ts`
- Modify: `workers/src/index.ts`
- Modify: `tests/systemTimeCronContract.test.ts`
- Add/modify focused recovery test file as appropriate.

**Interfaces:**

```ts
export async function recoverStaleCertificateWork(
  env: Env,
  now: Date = new Date(),
): Promise<{
  requeued: number;
  failed: number;
  reconciledBatches: number;
}>;
```

- [ ] **Step 1: Recovery query**

Mỗi phút, lấy tối đa 50 item:
- `pending` có `enqueued_at IS NULL` hoặc enqueue quá 2 phút;
- `processing` lease quá 2 phút;
- chỉ dữ liệu gần đây, ví dụ `issued_at >= datetime('now', '-7 days')`.

Không render trong cron.

- [ ] **Step 2: Item dưới ngưỡng retry**

Gửi:

```ts
{
  kind: 'render_certificate',
  batchId: row.batch_id,
  certificateId: row.id,
}
```

Không reset `sent`.

- [ ] **Step 3: Item đã đạt 5 attempts**

Atomic update item stale sang `failed`, clear lease/token, giữ `error_message='CERTIFICATE_RENDER_ATTEMPTS_EXHAUSTED'`, sau đó reconcile batch.

- [ ] **Step 4: Gắn recovery vào cron mỗi phút hiện tại**

Trong branch `SYSTEM_CRON.LIVE_EXAM_SWEEP`, chạy recovery trong `try/catch` riêng:

```ts
try {
  const certificateRecovery = await recoverStaleCertificateWork(env, new Date());
  if (certificateRecovery.requeued > 0 || certificateRecovery.failed > 0) {
    console.log('[Cron] Certificate recovery', certificateRecovery);
  }
} catch (error) {
  console.error('[Cron] Certificate recovery failed', error);
}
```

Lỗi certificate recovery không được làm hỏng live-exam sweep.

- [ ] **Step 5: Test self-healing**

Case bắt buộc:
- message bị mất sau persist => cron requeue;
- Worker chết sau claim => cron requeue stale item;
- 5 hard failures => item failed, batch terminal;
- sent row không bao giờ được cron enqueue.

- [ ] **Step 6: Run**

```bash
npm test -- tests/systemTimeCronContract.test.ts tests/certificateQueue.worker.test.ts
npm run typecheck:workers
```

- [ ] **Step 7: Commit**

```bash
git add workers/src/services/certificateRecoveryService.ts workers/src/index.ts tests/systemTimeCronContract.test.ts tests/certificateQueue.worker.test.ts
git commit -m "feat: self-heal stale certificate work"
```

---

### Task 7: Observability và UI consistency

**Files:**
- Modify: `workers/src/services/operationsService.ts`
- Modify: `src/features/certificates/useBatches.ts` only if required by test
- Modify: `src/features/certificates/TeacherCertificatesPage.tsx` only if required by status behavior
- Test: `tests/operationsService.test.ts`
- Test: `tests/certificateFrontend.test.tsx`

**Interfaces:**
- Existing API response remains backward compatible.
- Progress vẫn là `sent_certificates / total_certificates`.

- [ ] **Step 1: Operations metrics**

Expose item-level metrics:
- pending7d
- processing7d
- failed7d
- staleProcessing
- exhaustedAttempts nếu có thể tính không tốn query đáng kể.

- [ ] **Step 2: Frontend polling**

Giữ polling khi batch `pending|processing`; reset backoff khi số `sent_certificates` tăng để người dùng thấy tiến độ mới nhanh hơn. Không poll dưới 3 giây.

- [ ] **Step 3: Terminal error UX**

Batch `partial|failed` phải hiện nút retry như hiện tại. Không hiển thị batch `processing` vô hạn; backend recovery bảo đảm nó sẽ tiến hoặc terminal.

- [ ] **Step 4: Test**

```bash
npm test -- tests/operationsService.test.ts tests/certificateFrontend.test.tsx
npm run typecheck
npm run typecheck:workers
```

- [ ] **Step 5: Commit**

```bash
git add workers/src/services/operationsService.ts src/features/certificates/useBatches.ts src/features/certificates/TeacherCertificatesPage.tsx tests/operationsService.test.ts tests/certificateFrontend.test.tsx
git commit -m "feat: expose certificate recovery progress"
```

Nếu frontend không cần thay đổi để pass contract, không sửa hai file frontend.

---

### Task 8: Full verification và review trước deploy

**Files:** không thêm code ngoài sửa lỗi phát hiện bởi verification.

- [ ] **Step 1: Focused certificate suite**

```bash
npm test --   tests/certificateQueue.worker.test.ts   tests/certificateBatchProcessor.worker.test.ts   tests/certificates.worker.test.ts   tests/certificateRenderer.worker.test.ts   tests/certificateR2Assets.contract.test.ts   tests/certificateFrontend.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Worker + frontend typecheck**

```bash
npm run typecheck
npm run typecheck:workers
```

Expected: PASS.

- [ ] **Step 3: Lint/build/security**

```bash
npm run lint
npm run build
npm run security:check
```

Expected: PASS.

- [ ] **Step 4: Migration safe dry-run**

```bash
npm run d1:migrations:safe
```

Expected: migration 0082 được nhận diện, không mutation.

- [ ] **Step 5: Consumer deploy dry-run**

Dùng Wrangler dry-run cho `workers/wrangler.certificate-consumer.toml`; xác nhận handler `queue`, D1 binding và R2 binding đúng.

- [ ] **Step 6: GitNexus impact/diff review**

Kiểm tra không làm thay đổi certificate access control, không đụng các module không liên quan, không reset sent row.

- [ ] **Step 7: Commit verification-only fixes nếu có**

Không gom unrelated changes.

---

### Task 9: Production rollout an toàn và cứu batch TUẦN 3

**Prerequisite:** PR merge + CI pass + phê duyệt production mutation riêng.

- [ ] **Step 1: Snapshot read-only**

Snapshot batch:

```text
batch-582d7ae9-1394-435d-a2c6-3c0e1d500821
```

Ghi count theo status, attempt_count, timestamps, R2 keys. Không xuất tên học sinh.

- [ ] **Step 2: Apply migration 0082**

Dùng migration safe wrapper. Verify `d1_migrations` latest là `0082_certificate_item_queue_recovery.sql`.

- [ ] **Step 3: Deploy API**

Cần API mới trước hoặc đồng thời với consumer để cron recovery và message producer hiểu contract mới.

- [ ] **Step 4: Deploy certificate consumer**

```bash
cd workers
npm run deploy:certificate-consumer
```

Record version mới và version rollback.

- [ ] **Step 5: Smoke bằng batch test nhỏ**

Tạo batch 2–3 học sinh:
- từng item chuyển pending -> processing -> sent;
- R2 image tải được;
- batch terminal;
- không notification duplicate.

- [ ] **Step 6: Recovery batch TUẦN 3**

Không reset 5 certificate đã `sent`.

13 item đang stale sẽ được recovery service/consumer reclaim theo item. Nếu schema mới cần bootstrap cột cho các row cũ, chỉ clear lease fields của 13 unfinished rows bằng predicate exact sau khi snapshot và approval; không chạm sent rows.

- [ ] **Step 7: Verify terminal state**

Expected:
- total vẫn 18;
- sent đạt 18 nếu tất cả render thành công, hoặc terminal `partial/failed` với lỗi cụ thể nếu một item thật sự poison;
- không có row `processing` stale;
- 5 certificate cũ giữ nguyên `sent_at` và `png_r2_key`;
- không có certificate duplicate cho cùng `batch_id, student_id`.

- [ ] **Step 8: Observe 24 giờ**

Operations Center không có `staleProcessing`; tạo thêm ít nhất một batch thực tế >15 học sinh để xác nhận kiến trúc per-item hoạt động ổn định.

---

## Acceptance Criteria

1. Một Worker hard-terminate chỉ có thể làm kẹt tối đa **1 certificate item**, không phải cả batch.
2. Item kẹt được tự phát hiện trong khoảng **2–3 phút** và tự enqueue lại.
3. Sau **5 lần claim không thành công**, item chuyển `failed`; batch đạt `partial/failed`, không treo `processing`.
4. `sent` certificate không bao giờ bị reset/re-render do recovery.
5. Duplicate Queue delivery không tạo duplicate PNG publication hoặc duplicate certificate row.
6. Stale Worker không thể overwrite kết quả mới vì mọi publish đều kiểm tra `processing_token`.
7. Message legacy `{ batchId }` vẫn hoạt động trong rollout.
8. Notification học sinh/phụ huynh/giáo viên không bị nhân đôi khi recovery/finalize chạy lại.
9. Operations Center phản ánh stale ở cấp certificate item.
10. Batch production “TUẦN 3” được phục hồi mà giữ nguyên 5 chứng nhận đã phát hành.

## Rollback

- Rollback consumer về version đã record trước rollout.
- Rollback API về release trước.
- Migration 0082 chỉ thêm nullable columns/index, không xóa dữ liệu nên không cần destructive rollback.
- Nếu consumer mới gặp lỗi, dừng replay mới; không reset `sent` rows.
- Giữ snapshot production trước recovery cho đến khi xác minh xong.

## Self-review

- Root cause được xử lý ở ranh giới công việc: render unit chuyển từ whole-batch sang one-certificate.
- Hard termination không phụ thuộc vào `catch` để tự hồi phục.
- Có bounded retry + terminal state nên không còn `processing` vô hạn.
- Có compatibility path cho Queue messages cũ.
- Có fencing ở D1 để ngăn stale worker ghi đè.
- Có cron recovery độc lập với Queue retry budget.
- Có rollout/recovery riêng, không trộn mutation production với code delivery.
