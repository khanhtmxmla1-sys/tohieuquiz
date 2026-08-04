# Quiz Reliability Wave B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm cho màn hình làm bài của học sinh không mất dữ liệu khi tải lại, autosave Live Exam không xung đột, câu nối/sắp xếp không tạo đáp án bất hợp lệ, mã truy cập được xác minh ở Worker, và giao diện mobile/trợ năng dùng được bằng bàn phím.

**Architecture:** Tách logic bền vững thành các module thuần dữ liệu có thể kiểm thử: `quizAttemptDraft` cho bài thường, `liveExamAutosaveQueue` cho snapshot tuần tự, và helper canonical cho nối cặp/sắp xếp. Frontend dùng deadline tuyệt đối `expiresAt`, Worker là biên xác minh mã truy cập, còn UI dùng một navigator responsive và một dialog có quản lý focus.

**Tech Stack:** React 19, TypeScript 5.8, Zustand, Vite 6, Vitest 4, Testing Library, Cypress 15, Cloudflare Workers, D1, Zod.

## Global Constraints

- Không thay đổi công thức chấm điểm hiện tại.
- Không ghi nguyên văn đáp án học sinh, mã truy cập hoặc token vào log/telemetry.
- Không thêm dependency mới nếu stack hiện tại đã đáp ứng.
- Mỗi thay đổi hành vi phải có test thất bại trước khi sửa và test đạt sau khi sửa.
- Mỗi pha phải có commit riêng, giữ branch có thể build/test ở mọi checkpoint.
- Live Exam tiếp tục tuân theo ADR-0001: HTTP polling; không thêm WebSocket/SSE.
- Live Exam tiếp tục tuân theo ADR-0002: cùng thứ tự câu hỏi cho mọi học sinh.
- Không deploy production trong kế hoạch này.

---

## File Map

### Create

- `src/features/quiz-player/quizAttemptDraft.ts` — contract lưu/đọc/xóa phiên bài thường.
- `src/features/quiz-player/hooks/useQuizDeadline.ts` — tính thời gian còn lại từ deadline tuyệt đối.
- `src/features/live-exam/liveExamAutosaveQueue.ts` — hàng đợi snapshot tuần tự và coalescing.
- `src/features/quiz-player/components/MobileQuizNavigator.tsx` — bottom sheet điều hướng câu trên mobile.
- `src/services/quizAccessService.ts` — client xác minh mã truy cập.
- `tests/quizAttemptDraft.test.ts`
- `tests/useQuizPlayerResume.test.tsx`
- `tests/useQuizDeadline.test.tsx`
- `tests/liveExamAutosaveQueue.test.ts`
- `tests/LiveExamQuiz.autosaveQueue.test.tsx`
- `tests/QuizMatchingValidity.test.tsx`
- `tests/QuizOrderingValidity.test.tsx`
- `tests/quizAccessVerification.worker.test.ts`
- `tests/quizAccessService.test.ts`
- `tests/MobileQuizNavigator.test.tsx`
- `tests/SubmitConfirmModal.accessibility.test.tsx`
- `cypress/e2e/student-quiz-reliability.cy.ts`

### Modify

- `src/features/quiz-player/hooks/useQuizPlayer.ts`
- `src/components/StudentView.tsx`
- `src/components/LiveExam/LiveExamQuiz.tsx`
- `src/features/quiz-player/components/QuizPagination.tsx`
- `src/features/quiz-player/components/QuizNavigation.tsx`
- `src/components/student/SubmitConfirmModal.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/MatchingRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/OrderingRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/ShortAnswerRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/MathRenderer.tsx`
- `src/features/quiz-player/components/QuestionRenderer/renderers/GeometryRenderer.tsx`
- `src/domain/quiz-progress/getQuestionProgress.ts`
- `src/services/quizService.ts` or current quiz API client selected after impact analysis.
- `workers/src/routes/quizzes.ts`
- Worker router registration file selected after route impact analysis.

---

## Task 1: Persist and restore standard quiz attempts

**Files:**
- Create: `src/features/quiz-player/quizAttemptDraft.ts`
- Create: `tests/quizAttemptDraft.test.ts`
- Modify: `src/features/quiz-player/hooks/useQuizPlayer.ts`
- Create: `tests/useQuizPlayerResume.test.tsx`

**Interfaces:**

```ts
export interface QuizAttemptDraft {
  version: 1;
  quizId: string;
  studentName: string;
  studentClass: string;
  answers: Record<string, unknown>;
  questionOrder: string[];
  currentPage: number;
  startedAt: string;
  expiresAt: string | null;
}

export function loadQuizAttemptDraft(quizId: string): QuizAttemptDraft | null;
export function saveQuizAttemptDraft(draft: QuizAttemptDraft): void;
export function clearQuizAttemptDraft(quizId: string): void;
```

- [ ] Write tests that reject malformed/expired/wrong-quiz drafts and preserve answers, order, page and deadline.
- [ ] Run `npx vitest run tests/quizAttemptDraft.test.ts` and verify RED.
- [ ] Implement storage key `tohieuquiz_quiz_attempt_v1:<quizId>` using `sessionStorage`, defensive JSON parsing and schema guards.
- [ ] Run the draft tests and verify GREEN.
- [ ] Write hook tests that remount `useQuizPlayer`, restore `step='quiz'`, keep question order/page/answers, and do not auto-start a fresh timed attempt for a logged-in learner.
- [ ] Run `npx vitest run tests/useQuizPlayerResume.test.tsx` and verify RED.
- [ ] Integrate draft load/save/clear into `useQuizPlayer`; clear only after successful submit or confirmed exit.
- [ ] Run focused player tests, typecheck and lint.
- [ ] Commit: `fix(quiz): restore standard attempts after reload`.

## Task 2: Use an absolute quiz deadline

**Files:**
- Create: `src/features/quiz-player/hooks/useQuizDeadline.ts`
- Create: `tests/useQuizDeadline.test.tsx`
- Modify: `src/features/quiz-player/hooks/useQuizPlayer.ts`

**Interfaces:**

```ts
export function createQuizDeadline(timeLimitMinutes: number, nowMs?: number): string | null;
export function remainingSeconds(expiresAt: string | null, nowMs?: number): number;
export function useQuizDeadline(expiresAt: string | null): number;
```

- [ ] Write fake-timer tests proving background delays and remounts recompute from `expiresAt` rather than decrement count.
- [ ] Verify RED.
- [ ] Implement deadline helpers with `Date.now()` as reference and a display interval only for rerendering.
- [ ] Replace local decrement timer in `useQuizPlayer`; persist `expiresAt` in draft.
- [ ] Verify focused tests and commit: `fix(quiz): preserve timed deadline across reloads`.

## Task 3: Serialize Live Exam autosave

**Files:**
- Create: `src/features/live-exam/liveExamAutosaveQueue.ts`
- Create: `tests/liveExamAutosaveQueue.test.ts`
- Modify: `src/components/LiveExam/LiveExamQuiz.tsx`
- Create: `tests/LiveExamQuiz.autosaveQueue.test.tsx`
- Modify: `tests/LiveExamQuiz.resilience.test.tsx`

**Interfaces:**

```ts
export type LiveExamSyncState = 'local-saved' | 'syncing' | 'synced' | 'offline' | 'sync-error';

export interface LiveExamAutosaveQueue {
  enqueue(answers: StudentAnswers): void;
  setOnline(isOnline: boolean): void;
  dispose(): void;
}
```

- [ ] Write queue tests proving one request in flight, coalescing to newest answers, monotonically increasing versions, and retry after 409 using server version.
- [ ] Verify RED.
- [ ] Implement queue with one promise chain and a single pending snapshot.
- [ ] Write component test reproducing two quick edits; expect versions 1 then 2, never duplicate.
- [ ] Verify RED, integrate queue in `LiveExamQuiz`, and keep local session draft independent of server sync.
- [ ] Change copy to distinguish local save from server sync.
- [ ] Verify tests and commit: `fix(live-exam): serialize answer autosaves`.

## Task 4: Prevent invalid matching and ordering answers

**Files:**
- Modify: `src/features/quiz-player/hooks/useQuizPlayer.ts`
- Modify: `src/components/LiveExam/LiveExamQuiz.tsx`
- Modify: `src/features/quiz-player/components/QuestionRenderer/renderers/MatchingRenderer.tsx`
- Modify: `src/features/quiz-player/components/QuestionRenderer/renderers/OrderingRenderer.tsx`
- Modify: `src/domain/quiz-progress/getQuestionProgress.ts`
- Create: `tests/QuizMatchingValidity.test.tsx`
- Create: `tests/QuizOrderingValidity.test.tsx`
- Modify: `tests/quizProgress.test.ts`

**Behavior:**
- Selecting a right target already used removes its old pair before assigning it to the new left item.
- Matching progress counts unique right targets and cannot be complete with duplicates.
- Ordering inputs reject duplicate ranks with inline text and `aria-invalid`; progress remains partial.

- [ ] Write failing unit/component tests for all three behaviors.
- [ ] Run focused tests and verify RED.
- [ ] Implement minimal canonical helpers used by standard and Live Exam handlers.
- [ ] Verify GREEN, typecheck/lint and commit: `fix(quiz): prevent duplicate structured answers`.

## Task 5: Verify quiz access code at the Worker boundary

**Files:**
- Modify: `workers/src/routes/quizzes.ts`
- Modify: Worker router registration file identified by GitNexus.
- Create: `tests/quizAccessVerification.worker.test.ts`
- Create: `src/services/quizAccessService.ts`
- Create: `tests/quizAccessService.test.ts`
- Modify: `src/features/quiz-player/hooks/useQuizPlayer.ts`
- Modify: quiz DTO mapping in `workers/src/routes/quizzes.ts`

**Contract:**

```http
POST /api/quizzes/:quizId/access-verification
Content-Type: application/json

{ "accessCode": "ABC123" }

200 { "valid": true }
403 { "valid": false, "error": "INVALID_ACCESS_CODE" }
```

- [ ] Run `gitNexus.api_impact` and `gitNexus.impact` before changing route handlers; stop and report if HIGH/CRITICAL.
- [ ] Write Worker tests for valid code, invalid code, disabled-code quiz, malformed input, and no access-code leakage in student/list DTOs.
- [ ] Verify RED.
- [ ] Add Zod boundary validation, parameterized D1 query and generic invalid response; never log code.
- [ ] Add typed client service and replace browser comparison in `handleCodeVerify` with async API verification.
- [ ] Verify Worker/frontend tests, Worker typecheck and security checks.
- [ ] Commit: `fix(security): verify quiz access codes server-side`.

## Task 6: Add mobile question navigation and correct pagination copy

**Files:**
- Create: `src/features/quiz-player/components/MobileQuizNavigator.tsx`
- Create: `tests/MobileQuizNavigator.test.tsx`
- Modify: `src/components/StudentView.tsx`
- Modify: `src/components/LiveExam/LiveExamQuiz.tsx`
- Modify: `src/features/quiz-player/components/QuizPagination.tsx`

- [ ] Write tests for open/close, exact-question navigation, Escape, state legend and focus return.
- [ ] Verify RED.
- [ ] Implement a mobile-only button and bottom sheet reusing progress data and `changePage`.
- [ ] Rename visible controls to `Trang trước` / `Trang tiếp theo`, remove duplicate next-page action, preserve minimum 44px targets.
- [ ] Run tests at component level and Cypress viewport `390x844`.
- [ ] Commit: `feat(quiz): add mobile question navigator`.

## Task 7: Make submit dialog and answer inputs accessible

**Files:**
- Modify: `src/components/student/SubmitConfirmModal.tsx`
- Create: `tests/SubmitConfirmModal.accessibility.test.tsx`
- Modify: answer input renderers listed in File Map.
- Modify or create renderer accessibility tests.

- [ ] Write failing tests for dialog role/name/description, initial focus, Tab wrap, Escape close and focus restoration.
- [ ] Add labels for short answer, numerator, denominator, math result, geometry result and ordering rank inputs.
- [ ] Verify RED.
- [ ] Implement dialog focus management without a new dependency and stable input IDs/labels.
- [ ] Run accessibility tests, `axe-core` checks where existing harness supports them, and keyboard Cypress smoke.
- [ ] Commit: `fix(a11y): improve quiz dialogs and answer inputs`.

## Task 8: Final verification and review

- [ ] Run GitNexus `detect_changes(scope='compare', base_ref='main', worktree=...)` and inspect affected processes.
- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck` and `npm run typecheck:workers`.
- [ ] Run all focused Vitest files introduced/modified.
- [ ] Run `npm run test:ci:all`.
- [ ] Run Cypress reliability spec in Electron desktop and `390x844` mobile.
- [ ] Run `npm run build`.
- [ ] Run `npm run security:check`; document pre-existing dependency findings separately if enforcement allows them.
- [ ] Review `git diff main...HEAD` across correctness, architecture, security, accessibility and performance.
- [ ] Keep worktree clean and present merge/PR options; do not deploy.
