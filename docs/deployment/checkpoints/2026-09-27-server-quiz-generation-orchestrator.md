# Checkpoint — Server-side Quiz Generation Orchestrator

**Ngày:** 27/09/2026
**Trạng thái:** PAUSED SAFELY — REVIEW EXISTING WORKTREE CHANGES BEFORE ANY FURTHER EDIT
**Worktree:** `C:/quizpro/.worktrees/server-quiz-generation-orchestrator`
**Branch:** `feat/server-quiz-generation-orchestrator`
**Base / HEAD:** `f9d927c` = `origin/main`
**Plan:** `docs/superpowers/plans/2026-09-26-server-side-quiz-generation-orchestrator.md`

---

## 1. Mục tiêu đang thực hiện

Chuyển luồng tạo đề AI từ:

```text
Frontend tự build Blueprint/Prompt/Ruler
→ /api/ai/chat
→ AI provider
→ frontend tiếp tục REVIEW/REPAIR
```

sang:

```text
Frontend
→ POST /api/ai/quiz/generate
→ Worker build Blueprint V3
→ Server Rule Engine / Ruler TôHiệuQuiz
→ provider transport
→ retry transient errors
→ validate / repair / review
→ trả đề hoàn chỉnh
```

Ba nguồn AI dùng chung Rule Engine:

```text
system
gemini-personal
deepseek-personal
```

Frontend không được gửi `model`, `messages`, plaintext API key hoặc prompt đã ghép.

---

## 2. Quy tắc an toàn đã chốt

- Không code trực tiếp trên root `C:/quizpro`.
- Chỉ làm trong worktree nêu trên.
- Không commit/push khi chưa qua review + verification + user approval gate.
- Không sửa `buildPromptV3` trong giai đoạn đầu.
- Tạo Server Rule Engine song song, kiểm tra parity với luồng cũ.
- Retry chỉ dành cho lỗi transient: network / 502 / 503 / 504.
- Không retry 400 / 401 / 402 / 403 / 404 / 409 / 429.
- Không log API key, Authorization, plaintext credential, full prompt hay full AI response.
- Một thao tác tạo đề = một `actionId` / một lượt quota website dù bên trong có retry/repair/review.

---

## 3. Baseline đã xác nhận

Sau khi xử lý dependency trong worktree:

```text
npm run test:run -- tests/aiCredentialProviders.worker.test.ts
→ PASS: 12/12 tests

npm run typecheck:workers
→ PASS
```

GitNexus đã index đúng worktree tại commit `f9d927c`.

### Impact analysis

`buildGeneratorSystemPrompt`
- Risk: LOW
- Impacted symbols: 9

`buildPromptV3`
- Risk: HIGH
- Direct: 2
- Total impacted: 10
- Ảnh hưởng tới:
  - `quizPromptBuilder.ts`
  - `geminiService.ts`
  - `useQuizGeneration.ts`
  - `useQuizCreator.ts`
  - nhiều tests tạo đề V3/BYOK

**Quyết định:** không chỉnh sửa `buildPromptV3` ở Task 1.

---

## 4. Phát hiện quan trọng — phải giữ nguyên khi resume

Khi chuẩn bị bắt đầu Task 1, worktree đã xuất hiện một nhóm thay đổi lớn **có trước thao tác hiện tại**. Không được coi các thay đổi này là do phiên hiện tại tạo ra và không được ghi đè/xóa trước khi review nguồn gốc.

### Tracked modified files hiện có

```text
tests/apiAuthorizationMatrix.test.ts
tests/d1MigrationLayout.test.ts
tests/freshD1Bootstrap.test.ts
tests/operationsRoutes.worker.test.ts
tests/operationsService.test.ts
tests/workerRouter.worker.test.ts
workers/scripts/bootstrap_d1_migration_registry.sql
workers/src/index.ts
workers/src/router/createWorkerFetch.ts
workers/src/security/apiAuthorizationPolicy.ts
workers/src/services/operationsService.ts
workers/src/services/teacherAiQuotaLedger.ts
```

Current tracked diff stat:

```text
12 files changed
202 insertions(+)
9 deletions(-)
```

### Untracked files hiện có

```text
docs/superpowers/plans/2026-09-26-server-side-quiz-generation-orchestrator.md
shared/quiz-generation.contract.ts
tests/quizGenerationBlueprint.worker.test.ts
tests/quizGenerationContract.test.ts
tests/quizGenerationOrchestrator.worker.test.ts
tests/quizGenerationProviderTransport.worker.test.ts
tests/quizGenerationQualityPipeline.worker.test.ts
tests/quizGenerationRetry.worker.test.ts
tests/quizGenerationRoute.worker.test.ts
tests/quizGenerationRules.worker.test.ts
workers/migrations/0085_server_quiz_generation.sql
workers/src/routes/quizGeneration.ts
workers/src/services/quizGeneration/
```

Các file này trông giống một phần implementation của chính plan, nhưng **chưa được xác minh ai/phiên nào tạo ra và chưa được review đầy đủ**.

---

## 5. Sự cố đã xử lý

Có một lần thao tác tạo test vô tình nhắm vào root `C:/quizpro` thay vì worktree.

Hai file tạo nhầm:

```text
C:/quizpro/tests/quizGenerationContract.test.ts
C:/quizpro/tests/quizGenerationRules.worker.test.ts
```

đã được xóa lại ngay.

Không xóa hay sửa bất kỳ thay đổi root nào khác.

Root `C:/quizpro` vẫn có các thay đổi/tài liệu khác từ trước và **không được dùng để implement task này**.

---

## 6. Không được làm khi resume

Không:

- reset worktree;
- `git clean`;
- restore hàng loạt;
- overwrite các file đang modified/untracked;
- commit/push các thay đổi chưa review;
- sửa migration hoặc deploy production;
- sửa `buildPromptV3`;
- chạy cleanup destructively để “làm sạch trạng thái”.

---

## 7. Việc phải làm đầu tiên khi resume

### Step A — Read-only audit

Chạy:

```bash
git status --short --branch
git diff --stat
git diff -- workers/src/services/teacherAiQuotaLedger.ts
git diff -- workers/src/router/createWorkerFetch.ts
git diff -- workers/src/security/apiAuthorizationPolicy.ts
git diff -- workers/src/services/operationsService.ts
```

Đọc toàn bộ các file untracked mới trong:

```text
shared/quiz-generation.contract.ts
workers/src/routes/quizGeneration.ts
workers/src/services/quizGeneration/
workers/migrations/0085_server_quiz_generation.sql
tests/quizGeneration*.test.ts
```

Mục tiêu: xác định phần implementation hiện hữu đã hoàn thành tới đâu và có bám plan không.

### Step B — Compare against plan

Đối chiếu từng phần với:

```text
docs/superpowers/plans/2026-09-26-server-side-quiz-generation-orchestrator.md
```

Đánh dấu:

```text
DONE
PARTIAL
MISSING
UNEXPECTED
```

Không sửa gì trong bước này.

### Step C — GitNexus impact

Trước khi sửa bất kỳ existing symbol nào:
- chạy `gitnexus impact <symbol> --repo tohieuquiz --branch feat/server-quiz-generation-orchestrator --direction upstream --depth 3 --include-tests`.
- HIGH/CRITICAL => báo người dùng trước khi sửa.

### Step D — Tests hiện trạng

Sau read-only review, chạy tối thiểu:

```bash
npm run test:run --   tests/quizGenerationContract.test.ts   tests/quizGenerationRules.worker.test.ts   tests/quizGenerationBlueprint.worker.test.ts   tests/quizGenerationRetry.worker.test.ts   tests/quizGenerationProviderTransport.worker.test.ts   tests/quizGenerationQualityPipeline.worker.test.ts   tests/quizGenerationOrchestrator.worker.test.ts   tests/quizGenerationRoute.worker.test.ts

npm run typecheck:workers
```

Nếu test đỏ, ghi lại chính xác lỗi trước khi sửa.

---

## 8. Hướng tiếp tục đã được user duyệt

Người dùng đã yêu cầu:

> “làm từ từ nhưng chắc cho tôi”

và trước đó đã duyệt phương án:

> Task 1 làm song song, không sửa `buildPromptV3`.

Do đó khi resume:

1. Review trước.
2. Không đoán nguồn gốc code có sẵn.
3. Không xóa code đang có.
4. Chỉ sửa sau khi xác định chính xác gap.
5. TDD cho mỗi behavior change.
6. Mỗi checkpoint phải giữ worktree build/test được.
7. Chưa commit/push cho đến khi user duyệt final scope.

---

## 9. Git state tại checkpoint

```text
Branch:
feat/server-quiz-generation-orchestrator

HEAD:
f9d927c Merge pull request #173 from khanhtmxmla1-sys/codex/teacher-ai-account-settings

Tracking:
origin/main

Commit/push của task:
NONE

Production mutation:
NONE
```

---

## 10. Câu lệnh mở đầu cho chat mới

Có thể dùng nguyên câu sau:

```text
Đọc checkpoint:
C:/quizpro/.worktrees/server-quiz-generation-orchestrator/docs/deployment/checkpoints/2026-09-27-server-quiz-generation-orchestrator.md

Tiếp tục task server-side quiz generation orchestrator theo đúng checkpoint.
Chỉ review read-only trước, không reset/clean/overwrite.
Sau đó báo tôi trạng thái DONE/PARTIAL/MISSING/UNEXPECTED trước khi sửa code.
```

---

## 11. Resume delta — 27/09/2026

Read-only audit đã hoàn tất; không reset, clean, restore hàng loạt hoặc overwrite thay đổi có sẵn. Trạng thái hiện tại: branch/worktree đúng, 34 mục thay đổi chưa staged, chưa commit/push/deploy.

### Đã triển khai hoặc harden trong phiên resume

- Contract: giới hạn UTF-8 bytes, chặn DOCUMENT_TEXT rỗng và chặn IMAGE_QUESTION cho nguồn personal.
- Orchestrator: kiểm tra capability trước credential/upstream; quota/diagnostics cho terminal provider failure.
- Quality pipeline: AbortError không bị nuốt; tối đa một schema/JSON repair pass; final audit vẫn bắt buộc.
- Retry: sleeper hỗ trợ abort và lint đã sạch.
- Frontend: thin client POST /api/ai/quiz/generate, build/runtime feature flag; chỉ full create + V3 đi theo server path, legacy path vẫn giữ khi flag off/trial/regenerate.
- Không sửa `buildPromptV3`.
- Architecture review: deterministic import chain không dùng browser API trực tiếp; Worker `wrangler deploy --dry-run` PASS (4609.71 KiB upload / 1480.66 KiB gzip). Coupling với frontend type barrel vẫn là follow-up trước production, chưa tạo bản copy lớn để tránh lệch parity.

### Verification hiện tại

- Focused gate: 15 test files, 179 tests — PASS.
- `npm run typecheck` — PASS.
- `npm run typecheck:workers` — PASS.
- `npm run lint` — PASS.
- `npm run build` — PASS.
- `npm run security:check` — PASS: security/history/policy/dependency gates.
- `git diff --check` — PASS; chỉ còn cảnh báo line-ending LF→CRLF của Git.
- GitNexus `detect-changes --scope unstaged`: 15 files, 19 symbols, 0 affected processes, risk LOW.
- GitNexus `impact buildPromptV3`: HIGH; symbol không bị chỉnh sửa.
- Cypress `server-quiz-generation.cy.ts`: 7/7 PASS; matrix gồm system source, Gemini personal, DeepSeek personal, 503, 401, 429 và double-click. Personal source không gửi API key lên browser/server request body; double-click chỉ tạo một request đang pending.
- `npm run lint` và `npm run typecheck` sau khi mở rộng Cypress matrix — PASS.
- Final read-only diff review: status vẫn gồm đúng nhóm thay đổi đã ghi nhận trong checkpoint; không có file phát sinh ngoài phạm vi; `git diff --check` PASS.

### Còn PARTIAL/MISSING

- Cypress matrix đã bao phủ system, Gemini personal, DeepSeek personal, 503, 401, 429 và double-click — 7/7 PASS; chưa có E2E riêng để chứng minh repair/review internals (đã có focused worker quality tests cho phần này).
- Full Vitest đã thử 6 lần nhưng plugin runner đều trả HTTP 502 trước khi có kết quả; chưa coi đây là test failure.
- Hook regression test đã có: feature-on full V3 gọi server client đúng một lần và không gọi legacy generate — PASS.
- Quality pipeline đã qua boundary review; còn coupling với frontend type barrel cần tách riêng trước production nếu muốn loại bỏ hoàn toàn.
- Chưa có canary/rollout/production smoke; không được thực hiện trong checkpoint này.
- Chưa commit, chưa push, chưa deploy.

### Thứ tự resume tiếp theo

1. Chạy lại full Vitest khi plugin runner ổn định.
2. Tách server-safe contract/helper khỏi frontend barrel trong một bước riêng nếu architecture review cuối yêu cầu.
3. Đã review diff read-only; chỉ sau user approval mới stage/commit/push.

---

## 12. Checkpoint snapshot — 27/09/2026

### Trạng thái lưu an toàn

- Worktree: `C:/quizpro/.worktrees/server-quiz-generation-orchestrator`
- Branch: `feat/server-quiz-generation-orchestrator`
- HEAD/base: `f9d927c` = `origin/main`
- Có 34 mục thay đổi chưa staged; không có commit/push/deploy của task.
- Không sửa `buildPromptV3`.
- Không reset, clean, restore hàng loạt hoặc overwrite thay đổi hiện hữu.

### Verification đã xác nhận

- Focused Vitest: 15 files, 179 tests — PASS.
- Typecheck root/workers, lint, build và security gates — PASS.
- Worker `wrangler deploy --dry-run` — PASS.
- Cypress server quiz generation matrix — 7/7 PASS.
- GitNexus detect-changes — risk LOW; `buildPromptV3` impact HIGH nhưng symbol không bị chỉnh sửa.
- Final read-only diff review và `git diff --check` — PASS.

### Blocker còn lại

- Full Vitest đã thử 6 lần; plugin runner đều trả HTTP 502 trước khi có output.
- Đây là blocker hạ tầng, chưa được coi là test failure.
- Không có code change mới phát sinh từ các lần retry.

### Resume an toàn

1. Đọc checkpoint này trước khi tiếp tục.
2. Chỉ chạy lại full Vitest khi plugin runner có dấu hiệu ổn định.
3. Nếu muốn tách server-safe helper khỏi frontend type barrel, tạo bước review riêng trước production.
4. Chỉ stage/commit/push sau khi người dùng duyệt rõ; deploy vẫn chưa được thực hiện.

---

## 13. Kết quả thực thi verification/fix plan — 27/09/2026

### Môi trường và trạng thái

- Worktree/branch giữ nguyên: `C:/quizpro/.worktrees/server-quiz-generation-orchestrator`, `feat/server-quiz-generation-orchestrator`.
- HEAD/base vẫn là `f9d927c` / `origin/main`; không reset, clean hoặc overwrite thay đổi có sẵn.
- Máy kiểm tra dùng Node `v24.18.1`, npm `11.13.0`; CI khai báo Node `22.22.0`. Sai khác phiên bản đã được ghi nhận nhưng không tạo lỗi gate.
- Không có file staged; chưa commit, push, mở PR, chạy migration hoặc deploy.

### Lỗi thật tìm thấy và bản sửa tối thiểu

1. Full Vitest lần đầu phát hiện public contract của `useCreateQuizLogic` bị lộ cờ nội bộ `serverQuizGenerationEnabled`.
   - GitNexus upstream impact: LOW, 4 impacted / 3 direct, 0 process.
   - Fix: bỏ cờ khỏi returned public object, vẫn giữ cờ trong hook để truyền nội bộ vào `useQuizGeneration`.
   - Contract test sau fix: 5/5 PASS.
2. Final review phát hiện telemetry đếm thiếu số lần thử provider khi retry kết thúc bằng lỗi.
   - `QuizProviderStageError`: MEDIUM, 17 impacted / 10 direct, 0 process.
   - `retryTransientProviderOperation`: LOW, 3 impacted.
   - `diagnosticsFrom`: LOW, 4 impacted, liên quan một route process.
   - RED: retry test thiếu `attempts: 3`; orchestrator test nhận `provider_attempts = 2` thay vì `3`.
   - GREEN: error lưu terminal attempt count; diagnostics cộng cả failed direct stage attempt.
   - Focused gate sau fix: 3 files / 18 tests PASS.

### Verification mới trên final source

- Full Vitest: 4/4 shards PASS, tổng 681 files / 3,795 tests, exit 0.
  - shard 1: 171 files / 956 tests.
  - shard 2: 170 files / 893 tests.
  - shard 3: 170 files / 971 tests.
  - shard 4: 170 files / 975 tests.
- `npm run typecheck` — PASS.
- `npm run typecheck:workers` — PASS.
- `npm run typecheck:strict` — PASS.
- `npm run lint` — PASS.
- `npm run build` — PASS, 4,779 modules transformed.
- `npm run security:check` — PASS; source/history/policy scans và cả root/Worker production dependency audits đều sạch.
- Worker `npx wrangler deploy --dry-run --config wrangler.toml` — PASS; 4,609.75 KiB upload / 1,480.67 KiB gzip; dry-run thoát mà không deploy.
- `git diff --check` — PASS; chỉ có cảnh báo LF→CRLF, không có whitespace error.
- GitNexus compare với `origin/main`: 15 tracked files, 38 symbols, 0 affected processes, risk LOW.
- Toàn bộ file untracked được kiểm kê/review riêng vì GitNexus compare không tự bao phủ chúng.
- Scope nội dung đã review gồm 43 files: 15 tracked diffs và 28 files mới. `AGENTS.md`/`CLAUDE.md` vẫn có thể hiện `M` do GitNexus chạm line-ending/stat metadata, nhưng filtered hash trùng HEAD và `git diff --name-only` không chứa hai file này; chúng không thuộc scope commit.

### Review kiến trúc, bảo mật và rollout

- Runtime dependency chain của quality pipeline không kéo DOM, storage, React hooks, browser initialization hoặc client credential. Giữ lại deterministic helpers hiện tại; coupling qua frontend type barrel chỉ còn là rủi ro maintainability, không chứng minh được runtime incompatibility.
- Không sửa `buildPromptV3`.
- Auth bị từ chối trước upstream; action/quota thuộc tài khoản; replay/concurrency, quota finalization, retry deadline/abort, repair/review limits và final audit đều có test bao phủ.
- Không tìm thấy logging mới của API key, Authorization/Bearer header, prompt hoặc full provider response.
- Migration `0085_server_quiz_generation.sql` chưa tồn tại trên `origin/main`, không có collision tại base hiện tại.
- Build/runtime feature flag vẫn mặc định off; migration seed để `enabled = 0`, percentage `0`.
- Cypress 7/7 từ checkpoint được giữ làm bằng chứng lịch sử, không rerun vì hai fix cuối không thay đổi browser flow. Matrix: system, Gemini personal, DeepSeek personal, 503, 401, 429, double-click. Đây là mocked E2E, không chứng minh generation với provider thật trên production.

### Trạng thái cổng giao hàng

- Plan → worktree → GitNexus → TDD → review/verify: DONE.
- User approval gate: PENDING.
- Commit → push/PR → CI/approval → merge → migration/deploy → production smoke → cleanup: CHƯA THỰC HIỆN.
- Blocker hiện tại duy nhất: cần người dùng duyệt chính xác scope commit đã review.

### Exact commit scope đề xuất (43 files)

Tracked (15):

```text
src/features/quiz-generator/hooks/useCreateQuizLogic.ts
src/features/quiz-generator/hooks/useQuizGeneration.ts
src/services/ai/endpointConfig.ts
tests/apiAuthorizationMatrix.test.ts
tests/d1MigrationLayout.test.ts
tests/freshD1Bootstrap.test.ts
tests/operationsRoutes.worker.test.ts
tests/operationsService.test.ts
tests/workerRouter.worker.test.ts
workers/scripts/bootstrap_d1_migration_registry.sql
workers/src/index.ts
workers/src/router/createWorkerFetch.ts
workers/src/security/apiAuthorizationPolicy.ts
workers/src/services/operationsService.ts
workers/src/services/teacherAiQuotaLedger.ts
```

New (28):

```text
cypress/e2e/server-quiz-generation.cy.ts
docs/deployment/checkpoints/2026-09-27-server-quiz-generation-orchestrator.md
docs/superpowers/plans/2026-09-26-server-side-quiz-generation-orchestrator.md
docs/superpowers/plans/2026-09-27-server-quiz-generation-verification-fix.md
shared/quiz-generation.contract.ts
src/features/quiz-generator/hooks/useServerQuizGenerationFeatureFlag.ts
src/services/ai/serverQuizGenerationClient.ts
tests/quizGenerationBlueprint.worker.test.ts
tests/quizGenerationContract.test.ts
tests/quizGenerationOrchestrator.worker.test.ts
tests/quizGenerationProviderTransport.worker.test.ts
tests/quizGenerationQualityPipeline.worker.test.ts
tests/quizGenerationRetry.worker.test.ts
tests/quizGenerationRoute.worker.test.ts
tests/quizGenerationRules.worker.test.ts
tests/serverQuizGenerationClient.test.ts
tests/useQuizGeneration.serverPath.test.ts
workers/migrations/0085_server_quiz_generation.sql
workers/src/routes/quizGeneration.ts
workers/src/services/quizGeneration/blueprint.ts
workers/src/services/quizGeneration/orchestrator.ts
workers/src/services/quizGeneration/providerTransport.ts
workers/src/services/quizGeneration/qualityPipeline.ts
workers/src/services/quizGeneration/request.ts
workers/src/services/quizGeneration/retryPolicy.ts
workers/src/services/quizGeneration/rules/questionTypeRules.ts
workers/src/services/quizGeneration/rules/quizRuleEngine.ts
workers/src/services/quizGeneration/rules/systemRule.ts
```

Excluded: `AGENTS.md`, `CLAUDE.md` (không có content diff; không stage/commit).
