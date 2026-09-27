# Server-side Quiz Generation Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển luồng tạo đề AI từ mô hình “frontend tự ghép prompt/ruler rồi gọi `/api/ai/chat` nhiều lần” sang một API nghiệp vụ duy nhất ở Worker: server tự xây blueprint, ghép Ruler TôHiệuQuiz, chọn nguồn AI, gọi provider, retry lỗi tạm thời, validate/repair/review và trả đề hoàn chỉnh cho frontend.

**Architecture:** Frontend chỉ gửi cấu hình đề và nội dung đầu vào. Cloudflare Worker trở thành “bộ não tạo đề”: xác thực tài khoản → canonicalize yêu cầu → xây Blueprint V3 → Rule Engine → provider transport → deterministic validation → targeted repair → optional review → trả JSON đề. Gemini cá nhân, DeepSeek cá nhân và AI TôHiệuQuiz dùng cùng một Rule Engine; chỉ khác lớp transport/provider. `/api/ai/chat` vẫn giữ cho các workflow AI khác và làm fallback trong giai đoạn rollout, không xóa ngay.

**Tech Stack:** React 19, TypeScript, Cloudflare Workers, D1, Zod, Vitest, Cypress, Web Crypto, fetch.

**Plan basis:** `origin/main` tại SHA `f9d927c` (2026-09-26). Local `main` đang chậm hơn và có thay đổi ngoài phạm vi; khi thực hiện phải tạo worktree mới từ `origin/main`, không code trực tiếp trên local main.

## Global Constraints

- Một lần bấm **Ra đề** trên frontend phải tạo **một request nghiệp vụ cấp cao** tới `POST /api/ai/quiz/generate`.
- Frontend không gửi `model`, không gửi prompt đã ghép, không gửi plaintext API key.
- Server quyết định model theo source/provider và version của orchestrator.
- Cùng một `Rule Engine + Blueprint V3 + Validator` áp dụng cho `system`, `gemini-personal`, `deepseek-personal`.
- API key cá nhân tiếp tục được lấy từ kho mã hóa hiện tại; không đưa plaintext key về browser.
- `/api/ai/chat` không bị xóa trong PR đầu tiên vì Tutor/Homework/RAG và các workflow khác còn dùng.
- Không log API key, Authorization header, plaintext credential, toàn bộ prompt, nội dung đề đầy đủ hoặc response đầy đủ.
- Log/telemetry chỉ dùng metadata allowlist: `actionId`, source, provider, stage, attempt, errorCode, upstreamStatus, phase, durationMs, promptVersion, blueprintVersion, slotCount.
- Retry chỉ áp dụng cho lỗi tạm thời: network, HTTP 502, 503, 504. Không retry 400/401/402/403/404/409/429.
- Retry tối đa 3 attempt/stage, backoff `500ms -> 1500ms`; không nhân đôi quota/action reservation.
- Tổng timeout của request orchestration: 240 giây. Generate tối đa 120 giây; Repair tối đa 60 giây; Review tối đa 45 giây; mỗi retry phải nằm trong ngân sách stage còn lại.
- Request phải idempotent theo `actionId + username`; double-click/replay không được tạo hai upstream generation độc lập.
- Personal BYOK V1 vẫn text-only. Input ảnh/file raw không được gửi tới Gemini/DeepSeek cá nhân trong scope này.
- Tạo đề từ OCR text được phép nếu client đã có text; raw PDF/image migration là phase riêng.
- Feature flag mới `server_quiz_generation_v1` mặc định tắt; rollout canary trước, rollback bằng cách tắt flag.
- Không sửa migration đã deploy. Migration mới dự kiến là `0085_server_quiz_generation.sql`; khi thực hiện phải kiểm tra lại số migration mới nhất.
- Bắt buộc workflow dự án: plan → isolated worktree → GitNexus impact → TDD RED/GREEN → review/verify → user approval → commit → push/PR → CI/review → merge → production smoke → cleanup.

---

## 1. Kiến trúc đích

```text
Teacher UI
   |
   | POST /api/ai/quiz/generate
   | { actionId, source?, topic, classLevel, content, settings }
   v
QuizGenerationRoute
   |
   +--> Auth + rate limit + request schema
   |
   +--> QuizRequestCanonicalizer
   |      -> canonical source
   |      -> canonical blueprint V3
   |      -> canonical capability checks
   |
   +--> QuizRuleEngine
   |      -> system ruler
   |      -> primary-school ruler
   |      -> intent / learner profile
   |      -> question-type rulers
   |      -> difficulty / diagram / output schema
   |
   +--> QuizGenerationOrchestrator
          |
          +--> reserve action once
          |
          +--> GENERATE
          |      -> AiProviderTransport
          |      -> retry transient 502/503/504/network
          |
          +--> deterministic parse + audit
          |
          +--> REPAIR only when repairable issues exist
          |
          +--> REVIEW once, best-effort
          |
          +--> final deterministic audit
          |
          +--> succeed/fail action + safe diagnostics
          |
          v
      GeneratedQuizV3 JSON
          |
          v
Teacher UI maps final payload to current domain/UI
```

### Provider layer

```text
                    +--> AI TôHiệuQuiz gateway
Rule Engine --> Orchestrator --> Gemini personal credential
                    +--> DeepSeek personal credential
```

Ruler không thay đổi theo provider. Provider chỉ thay transport/model/capability.

---

## 2. File structure đích

### Create

- `shared/quiz-generation.contract.ts`
  - HTTP DTO, enum/source, error codes, response contract.
- `workers/src/routes/quizGeneration.ts`
  - Route `POST /api/ai/quiz/generate`.
- `workers/src/services/quizGeneration/request.ts`
  - Zod schema + canonicalization.
- `workers/src/services/quizGeneration/blueprint.ts`
  - Server canonical Blueprint V3 builder.
- `workers/src/services/quizGeneration/rules/systemRule.ts`
- `workers/src/services/quizGeneration/rules/quizRuleEngine.ts`
- `workers/src/services/quizGeneration/rules/questionTypeRules.ts`
  - Ruler server-owned.
- `workers/src/services/quizGeneration/providerTransport.ts`
  - Common source/provider dispatch interface.
- `workers/src/services/quizGeneration/retryPolicy.ts`
  - Retry 502/503/504/network.
- `workers/src/services/quizGeneration/qualityPipeline.ts`
  - Parse/audit/repair/review orchestration.
- `workers/src/services/quizGeneration/orchestrator.ts`
  - Top-level workflow.
- `src/services/ai/serverQuizGenerationClient.ts`
  - Thin browser client.
- `workers/migrations/0085_server_quiz_generation.sql`
  - Flag + bounded diagnostics columns.
- Tests:
  - `tests/quizGenerationContract.test.ts`
  - `tests/quizGenerationRules.worker.test.ts`
  - `tests/quizGenerationBlueprint.worker.test.ts`
  - `tests/quizGenerationRetry.worker.test.ts`
  - `tests/quizGenerationProviderTransport.worker.test.ts`
  - `tests/quizGenerationQualityPipeline.worker.test.ts`
  - `tests/quizGenerationOrchestrator.worker.test.ts`
  - `tests/quizGenerationRoute.worker.test.ts`
  - `tests/serverQuizGenerationClient.test.ts`
  - `cypress/e2e/server-quiz-generation.cy.ts`

### Modify

- `workers/src/router/createWorkerFetch.ts`
- `workers/src/security/apiAuthorizationPolicy.ts`
- `workers/src/types.ts` only if new binding/type is actually required.
- `workers/src/services/teacherAiQuotaLedger.ts`
- `workers/src/services/aiCredentials/dispatch.ts`
- `workers/src/services/aiCredentials/service.ts`
- `src/features/quiz-generator/hooks/useQuizGeneration.ts`
- `src/features/quiz-generator/domain/buildQuizGenerationRequest.ts`
- `src/services/geminiService.ts` during compatibility phase, then reduce quiz-generation responsibility.
- Existing prompt/blueprint/audit/repair files only after impact analysis:
  - `src/services/ai/prompts/systemPromptBuilder.ts`
  - `src/services/ai/prompts/quizPromptBuilder.ts`
  - `src/services/ai/prompts/slotPromptBuilder.ts`
  - `src/services/ai/quizAudit.ts`
  - `src/services/ai/quizRepair.ts`
  - `src/features/quiz-generator/domain/quizBlueprint.ts`

Do not move/delete those files in Task 1. Giữ chúng làm reference + parity oracle cho đến khi route mới qua canary.

---

## 3. HTTP contract

### Request

```ts
export type QuizAiSource =
  | 'system'
  | 'gemini-personal'
  | 'deepseek-personal';

export interface ServerQuizGenerationRequest {
  actionId: string;
  source?: QuizAiSource; // omitted => server resolves account default
  title: string;
  topic: string;
  classLevel: string;
  content?: string;
  intent: 'EXAM' | 'PRACTICE';
  sourceMode: 'TOPIC' | 'DOCUMENT_TEXT';
  questionCount: number; // 1..40
  typeAllocations: Array<{
    type: string;
    count: number;
  }>;
  difficultyLevels: {
    level1: number;
    level2: number;
    level3: number;
  };
  promptProfile: {
    useThongTu27: boolean;
    learnerMode: 'default' | 'gifted' | 'remedial';
  };
  customPrompt?: string;
  subject?: string;
  skillCode?: string;
  subskillCode?: string;
  sourceRefs?: string[];
  diagramMode?: 'off' | 'auto';
}
```

Strict validation:
- Unknown fields rejected.
- `title/topic/classLevel` trimmed, bounded.
- `content` maximum 256 KiB UTF-8.
- `customPrompt` maximum 4 KiB UTF-8.
- Total type allocations = questionCount.
- Total difficulty = questionCount.
- Personal source rejects raw images/file payloads and unsupported image-generation requirements.
- Client-supplied `model`, `messages`, `prompt`, `apiKey`, `providerEndpoint` are not accepted fields.

### Success

```ts
export interface ServerQuizGenerationResponse {
  status: 'success';
  actionId: string;
  source: QuizAiSource;
  promptVersion: 'ai-blueprint-v3';
  blueprintVersion: 3;
  orchestratorVersion: 'server-quiz-v1';
  quiz: GeneratedQuizV3;
}
```

### Public error codes

```ts
export type ServerQuizGenerationErrorCode =
  | 'QUIZ_REQUEST_INVALID'
  | 'QUIZ_SOURCE_UNAVAILABLE'
  | 'QUIZ_CAPABILITY_UNSUPPORTED'
  | 'AI_DAILY_LIMIT_REACHED'
  | 'AI_ACTION_CONFLICT'
  | 'AI_KEY_MISSING'
  | 'AI_KEY_INVALID'
  | 'AI_PROVIDER_ACCOUNT_REQUIRED'
  | 'AI_PROVIDER_QUOTA'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_PROVIDER_TIMEOUT'
  | 'AI_PROVIDER_RESPONSE_INVALID'
  | 'QUIZ_GENERATION_INVALID'
  | 'QUIZ_GENERATION_TIMEOUT'
  | 'QUIZ_POLICY_UNAVAILABLE';
```

---

## Task 1: Shared contract + server Rule Engine parity

**Files**
- Create `shared/quiz-generation.contract.ts`
- Create `workers/src/services/quizGeneration/rules/systemRule.ts`
- Create `workers/src/services/quizGeneration/rules/questionTypeRules.ts`
- Create `workers/src/services/quizGeneration/rules/quizRuleEngine.ts`
- Test `tests/quizGenerationContract.test.ts`
- Test `tests/quizGenerationRules.worker.test.ts`

**Interfaces**

```ts
export function buildServerQuizRules(input: {
  topic: string;
  classLevel: string;
  title: string;
  content: string;
  blueprint: QuizBlueprintV3Dto;
  promptProfile: PromptProfileDto;
  customPrompt?: string;
  diagramMode: 'off' | 'auto';
}): {
  system: string;
  user: string;
};
```

- [ ] Create worktree from latest `origin/main`; refresh GitNexus.
- [ ] Run GitNexus impact before touching existing prompt builders; if HIGH/CRITICAL, stop and report before edits.
- [ ] RED: contract tests reject client fields `model`, `messages`, `apiKey`, unknown fields and invalid totals.
- [ ] RED: golden parity tests compare server rule output semantics against current `ai-blueprint-v3` prompt for representative cases: Math grade 3 MCQ, Vietnamese grade 5 mixed types, EXAM/PRACTICE, Thông tư 27, gifted/remedial, diagram off/auto.
- [ ] GREEN: implement server rule modules by porting existing authoritative rules without changing pedagogical behavior.
- [ ] Verify no provider-specific model/API key text is embedded in ruler.
- [ ] Run:
  `npm run test:run -- tests/quizGenerationContract.test.ts tests/quizGenerationRules.worker.test.ts`
- [ ] Run worker typecheck.

**Acceptance**
- Server can build the same canonical V3 instructions without browser-generated prompt.
- Ruler source of truth for the new endpoint is server code.

---

## Task 2: Canonical Blueprint V3 on server

**Files**
- Create `workers/src/services/quizGeneration/request.ts`
- Create `workers/src/services/quizGeneration/blueprint.ts`
- Test `tests/quizGenerationBlueprint.worker.test.ts`

**Interfaces**

```ts
export function canonicalizeQuizGenerationRequest(
  raw: unknown,
): ServerQuizGenerationRequest;

export function buildServerBlueprint(
  request: ServerQuizGenerationRequest,
): QuizBlueprintV3Dto;
```

- [ ] Impact-analyze current `buildBalancedTypeAllocations`, `buildQuestionBlueprintSlots`, `validateQuizBlueprintV3`.
- [ ] RED: exact allocations and difficulty totals generate deterministic slot sequence.
- [ ] RED: invalid count, duplicated type, unsupported AI question type, missing class/topic, invalid diagram policy fail before provider call.
- [ ] RED: client cannot forge slotId/ordinal because request does not accept slots.
- [ ] GREEN: port deterministic blueprint construction to Worker.
- [ ] Parity-check representative frontend V3 blueprint vs server V3 blueprint.
- [ ] Run focused test + worker typecheck.

**Acceptance**
- Browser sends user choices; server builds canonical slots.
- Provider never receives a client-forged blueprint.

---

## Task 3: Provider transport + bounded retry

**Files**
- Create `workers/src/services/quizGeneration/providerTransport.ts`
- Create `workers/src/services/quizGeneration/retryPolicy.ts`
- Modify `workers/src/services/aiCredentials/dispatch.ts`
- Test `tests/quizGenerationRetry.worker.test.ts`
- Test `tests/quizGenerationProviderTransport.worker.test.ts`

**Interfaces**

```ts
export interface QuizAiStageInput {
  actionId: string;
  source: QuizAiSource;
  stage: 'GENERATE' | 'REPAIR' | 'REVIEW';
  systemPrompt: string;
  userPrompt: string;
  responseFormat: { type: 'json_object' };
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
}

export interface QuizAiStageResult {
  text: string;
  provider: 'system-gateway' | 'gemini' | 'deepseek';
  model: string;
  attempts: number;
  lastTransientError?: {
    code: string;
    phase?: string;
    upstreamStatus?: number;
  };
}

export async function executeQuizAiStage(
  env: Env,
  owner: { username: string; role: 'teacher' | 'admin' },
  input: QuizAiStageInput,
): Promise<QuizAiStageResult>;
```

Retry policy:

```ts
const RETRY_DELAYS_MS = [500, 1500] as const;
const RETRYABLE_STATUSES = new Set([502, 503, 504]);
```

- [ ] Impact-analyze `dispatchPersonalAi`, `resolvePersonalAiCredential`, system gateway section of `handleAiProxy`.
- [ ] RED: 503 then success => exactly 2 attempts and returns success.
- [ ] RED: network error + 503 + success => exactly 3 attempts.
- [ ] RED: 401/403/429 => exactly 1 attempt.
- [ ] RED: caller abort => no retry.
- [ ] RED: credential/key is never included in thrown public error or structured diagnostics.
- [ ] GREEN: implement generic retry wrapper with injected sleeper in unit tests.
- [ ] GREEN: personal sources reuse encrypted credential resolver and existing provider dispatch.
- [ ] GREEN: system source uses current server gateway behavior; do not expose gateway token.
- [ ] Persist safe attempt metadata through orchestrator, not raw provider body.
- [ ] Run focused tests.

**Acceptance**
- Intermittent Gemini 503 no longer immediately fails the user on first transient error.
- Same transport interface serves all three sources.

---

## Task 4: Server quality pipeline (parse → audit → repair → review)

**Files**
- Create `workers/src/services/quizGeneration/qualityPipeline.ts`
- Test `tests/quizGenerationQualityPipeline.worker.test.ts`
- Extract/copy only server-safe deterministic helpers required from current frontend modules after impact analysis.

**Interfaces**

```ts
export async function runServerQuizQualityPipeline(input: {
  env: Env;
  owner: { username: string; role: 'teacher' | 'admin' };
  actionId: string;
  source: QuizAiSource;
  blueprint: QuizBlueprintV3Dto;
  draftText: string;
  rules: { system: string; user: string };
  signal?: AbortSignal;
}): Promise<GeneratedQuizV3>;
```

Rules:
- Parse strict JSON V3.
- Deterministic audit first.
- Non-repairable issue => fail; do not ask AI to “guess”.
- Repair only affected slots.
- Maximum 1 repair pass.
- Review maximum 1 pass and best-effort.
- Reviewed result is accepted only if deterministic audit returns zero issues.
- Final deterministic audit is mandatory.

- [ ] RED: valid draft returns without repair.
- [ ] RED: repairable slot error calls REPAIR once and merges only requested slots.
- [ ] RED: non-repairable error never calls REPAIR.
- [ ] RED: reviewer invalid output is ignored if validated draft is already good.
- [ ] RED: reviewer cannot change slotId/type/difficulty.
- [ ] GREEN: port current V3 deterministic behavior from frontend to server.
- [ ] Verify the server pipeline does not expose chain-of-thought or raw provider diagnostics.
- [ ] Run focused tests.

**Acceptance**
- Browser no longer owns review/repair policy for the new endpoint.
- Final response has already passed server deterministic audit.

---

## Task 5: Orchestrator, idempotency, quota and diagnostics

**Files**
- Create `workers/src/services/quizGeneration/orchestrator.ts`
- Modify `workers/src/services/teacherAiQuotaLedger.ts`
- Create `workers/migrations/0085_server_quiz_generation.sql`
- Test `tests/quizGenerationOrchestrator.worker.test.ts`
- Extend `tests/teacherAiQuotaLedger.worker.test.ts`

**Migration 0085**

Add feature flag:
- `server_quiz_generation_v1`, enabled=0, teacher audience, percentage=0.

Add bounded diagnostics to `ai_generation_actions`:
- `orchestrator_version TEXT`
- `provider_attempts INTEGER NOT NULL DEFAULT 0`
- `last_provider_error_code TEXT`
- `last_provider_status INTEGER`
- `last_provider_phase TEXT`

No prompt/body/key columns.

**Interface**

```ts
export async function generateQuizOnServer(input: {
  env: Env;
  owner: { username: string; role: 'teacher' | 'admin' };
  request: ServerQuizGenerationRequest;
  signal?: AbortSignal;
}): Promise<ServerQuizGenerationResponse>;
```

- [ ] RED: same `actionId + username` replay during active run returns conflict, not second upstream call.
- [ ] RED: action owned by another account cannot be reused.
- [ ] RED: quota is reserved once for whole top-level generation; internal REPAIR/REVIEW do not consume a second daily action.
- [ ] RED: failed transient attempts do not create extra action rows.
- [ ] RED: successful retry stores `provider_attempts > 1` and safe last transient metadata.
- [ ] GREEN: orchestrator performs request → blueprint → ruler → reserve → generate → quality → succeed/fail.
- [ ] Use global 240s AbortController deadline and stage budgets.
- [ ] Never silently switch source/provider on failure.
- [ ] Run migration tests locally and focused ledger/orchestrator tests.

**Acceptance**
- One UI action maps to one server action identity.
- Retry/repair/review remain internal and do not double-charge website quota.

---

## Task 6: New API route and security boundary

**Files**
- Create `workers/src/routes/quizGeneration.ts`
- Modify `workers/src/router/createWorkerFetch.ts`
- Modify `workers/src/security/apiAuthorizationPolicy.ts`
- Test `tests/quizGenerationRoute.worker.test.ts`
- Extend `tests/apiAuthorizationMatrix.test.ts`
- Extend `tests/workerRouter.worker.test.ts`

Route:

```text
POST /api/ai/quiz/generate
```

- Teacher/admin authenticated owner only.
- Strict same-origin/session rules as current teacher AI routes.
- Request body max 300 KiB.
- `Cache-Control: no-store`.
- Rate limit top-level creation separately from `/api/ai/chat`.
- Source omitted => resolve `teacher_ai_preferences.default_source`.
- Personal source requires BYOK feature + saved key.
- New route requires `server_quiz_generation_v1` for rollout.

- [ ] RED anonymous/student/inactive account blocked before provider call.
- [ ] RED unknown fields/oversized body invalid.
- [ ] RED model/messages/apiKey injection rejected.
- [ ] RED route never returns raw provider body/headers.
- [ ] GREEN route maps domain errors to stable public codes.
- [ ] Register route before generic quiz/account branches.
- [ ] Run authorization/router/security tests.

**Acceptance**
- New route is a narrow business API, not an arbitrary chat proxy.

---

## Task 7: Frontend becomes thin client behind flag

**Files**
- Create `src/services/ai/serverQuizGenerationClient.ts`
- Modify `src/features/quiz-generator/hooks/useQuizGeneration.ts`
- Modify `src/features/quiz-generator/domain/buildQuizGenerationRequest.ts`
- Modify `src/services/geminiService.ts` only to retain compatibility fallback.
- Test `tests/serverQuizGenerationClient.test.ts`
- Extend relevant hook/workflow tests.

**Client interface**

```ts
export async function requestServerQuizGeneration(
  request: ServerQuizGenerationRequest,
  options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<ServerQuizGenerationResponse>;
```

Behavior:
- When feature flag off: existing flow unchanged.
- When flag on: UI sends one request to `/api/ai/quiz/generate`.
- No frontend prompt construction for the new path.
- No frontend REVIEW/REPAIR calls for the new path.
- Frontend may map final `GeneratedQuizV3` to display/domain model; it must not modify correctness decisions.

- [ ] RED: feature-on create invokes new endpoint once and never calls `/api/ai/chat` for GENERATE/REPAIR/REVIEW.
- [ ] RED: source/model selection is not serialized as model/messages.
- [ ] RED: cancel button aborts one top-level request.
- [ ] GREEN: use thin client.
- [ ] Keep user-facing progress text coarse: “Đang tạo đề” → “Đang kiểm tra và hoàn thiện” if server exposes safe progress later; do not add polling in V1.
- [ ] Run focused frontend tests.

**Acceptance**
- Frontend no longer orchestrates the AI quality chain when new flag is enabled.

---

## Task 8: E2E, canary rollout, rollback and cleanup

**Files**
- Create `cypress/e2e/server-quiz-generation.cy.ts`
- Update `docs/operations/teacher-ai-credentials.md`
- Add ADR for server-owned quiz generation if architecture review requires it.

### E2E

- [ ] System source: one top-level endpoint, valid quiz rendered.
- [ ] Gemini personal: one top-level endpoint; no plaintext key in request/localStorage/sessionStorage.
- [ ] DeepSeek personal: same contract.
- [ ] Gemini transient 503 mocked first attempt then success: UI succeeds without showing 503.
- [ ] 401 invalid key: no retry, clear credential message.
- [ ] 429 quota: no retry.
- [ ] Invalid generated JSON repaired server-side; browser does not call repair itself.
- [ ] Double-click same action does not create duplicate upstream generation.

### Verification gate

Run at minimum:

```bash
npm run test:run --   tests/quizGenerationContract.test.ts   tests/quizGenerationRules.worker.test.ts   tests/quizGenerationBlueprint.worker.test.ts   tests/quizGenerationRetry.worker.test.ts   tests/quizGenerationProviderTransport.worker.test.ts   tests/quizGenerationQualityPipeline.worker.test.ts   tests/quizGenerationOrchestrator.worker.test.ts   tests/quizGenerationRoute.worker.test.ts   tests/serverQuizGenerationClient.test.ts   tests/teacherAiQuotaLedger.worker.test.ts   tests/aiByokProxy.worker.test.ts   tests/aiCredentials.worker.test.ts   tests/apiAuthorizationMatrix.test.ts   tests/workerRouter.worker.test.ts

npm run typecheck
npm run typecheck:workers
npm run lint
npm run build
npm run security:check
npx cypress run --e2e --spec cypress/e2e/server-quiz-generation.cy.ts
```

Then GitNexus `detect_changes(scope=compare, base_ref=main)`.

### Rollout

1. Deploy Worker + migration 0085 with `server_quiz_generation_v1=0`.
2. Production read-only smoke: old quiz generation unchanged.
3. Enable flag only for one canary teacher account.
4. Test System source, Gemini personal, DeepSeek personal separately.
5. Inspect safe diagnostics:
   - success rate
   - retry count
   - provider error code/status/phase
   - action duplication
   - median/p95 duration
6. Keep canary at least through several real quiz generations before widening.
7. Widen by allowlist/percentage only after error rate is acceptable.
8. Do not remove old client path in same rollout.

### Rollback

Immediate rollback requires no code/database reverse migration:

```text
server_quiz_generation_v1 = OFF
```

Frontend returns to existing `generateQuiz -> /api/ai/chat` path. Migration columns remain additive and harmless. BYOK credential storage remains untouched.

---

## Task 9: Post-rollout cleanup after explicit approval

Do this only after the new orchestrator is stable in production.

- [ ] Remove quiz-generation prompt orchestration from `geminiService.ts`.
- [ ] Remove browser-only GENERATE/REPAIR/REVIEW calls that are no longer reachable.
- [ ] Remove duplicated legacy prompt builders only after proving no other workflow imports them.
- [ ] Keep `/api/ai/chat` for non-quiz workflows.
- [ ] Update architecture docs: server owns quiz rulers and quality pipeline.
- [ ] Run full CI/security/build/E2E again.
- [ ] Separate cleanup PR from first production rollout if blast radius is HIGH.

---

## 4. Explicit non-goals for V1

- Không chuyển AI Tutor, Homework, Help RAG sang endpoint mới.
- Không cho browser gửi model tùy ý.
- Không fallback Gemini cá nhân sang AI TôHiệuQuiz khi key/provider lỗi.
- Không retry 429 quota để tránh tăng chi phí ngoài ý muốn.
- Không đưa raw PDF/image vào BYOK personal V1.
- Không xây hàng đợi/background job trong V1; một request synchronous có deadline 240 giây. Nếu production cho thấy cần resumability/progress bền vững, thiết kế job/queue là phase 2 riêng.
- Không thay đổi chính sách quota ngày trong cùng PR.

---

## 5. Definition of Done

Tính năng chỉ được coi là hoàn thành khi:

1. Với flag bật, frontend tạo đề bằng đúng một call `POST /api/ai/quiz/generate`.
2. Request browser không chứa prompt hoàn chỉnh, messages, model hoặc API key.
3. Server tự tạo Blueprint V3 và Ruler.
4. System/Gemini/DeepSeek dùng cùng Ruler và quality pipeline.
5. Transient 503 của Gemini được retry có kiểm soát và không hiển thị lỗi nếu attempt sau thành công.
6. Invalid key/quota/account-required không bị retry.
7. Repair/review chạy server-side, tối đa theo giới hạn trong plan.
8. Action/quota không bị nhân đôi bởi retry hoặc internal stages.
9. Không có secret/prompt đầy đủ trong logs hoặc D1 diagnostics.
10. Có flag rollback tức thì về flow cũ.
11. Focused tests, lint, frontend typecheck, worker typecheck, build, security và Cypress đều xanh.
12. GitNexus detect_changes xác nhận blast radius đúng scope trước commit.
