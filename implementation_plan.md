# TôHiệuQuiz Security, UI/UX, Feature and Performance Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng TôHiệuQuiz thành nền tảng giáo dục an toàn, nhất quán, dễ dùng, quan sát được và vận hành ổn định mà không làm gián đoạn các luồng dạy–học hiện có.

**Architecture:** Chia chương trình thành các wave độc lập: baseline, bảo mật/quyền riêng tư, nền tảng UI, cải tiến nghiệp vụ, hiệu năng/observability, trung tâm vận hành và rollout. Mỗi task phải có test, tiêu chí nghiệm thu, rollback và commit riêng.

**Tech Stack:** React 19, TypeScript, Vite, Zustand, React Router, Tailwind CSS, Vitest, Cypress, Cloudflare Workers, D1, R2, Queues, Vercel, GitHub Actions và Zod.

## Global Constraints

- Workspace chính: `C:\quizpro`; không sửa hệ thống iTongQuiz cũ.
- Node.js tối thiểu `22.22.0`.
- Không lưu secret, JWT, mật khẩu, dữ liệu học sinh hoặc export production trong Git, log, ảnh chụp hay biến `VITE_*`.
- Cookie phiên tiếp tục là `HttpOnly; Secure; SameSite=Lax`; frontend không lưu JWT.
- Bucket `tohieuquiz-certificates` phải tiếp tục private.
- Mọi endpoint mới phải xác thực, phân quyền và kiểm tra ownership tại Worker.
- Mọi input ngoài hệ thống và output AI phải được xác thực bằng schema.
- Mọi migration D1 phải có rollback, bootstrap test và rollback coverage.
- UI phải đạt keyboard navigation, focus visible, WCAG AA và responsive tại 320/768/1024/1440px.
- Không deploy production trong từng task; rollout chỉ diễn ra sau release gate.
- Working tree chính đang có thay đổi không thuộc kế hoạch (`AGENTS.md`, `CLAUDE.md`, `.agent/`); triển khai bằng worktree riêng.

---

## Baseline đã có — không xây lại

- API route fail-closed, CORS allowlist, Origin Guard.
- JWT cookie HttpOnly, `token_version`, buộc đổi mật khẩu lần đầu.
- D1 rate limiting và cron dọn dữ liệu hết hạn.
- Audit log và generic internal error có request ID.
- CI typecheck/test/build/E2E; security scan và dependency audit root.
- Unified Notifications, Live Exam state machine, Parent Portal, Gift Shop, phiếu kết quả và chứng nhận Queue → R2.
- Scroll restoration đã có.
- Build hiện pass nhưng còn các chunk lớn cần tối ưu.

## Thứ tự triển khai

| Wave | Phạm vi | Task | Điều kiện hoàn thành |
|---|---|---:|---|
| 0 | Baseline và quản trị phạm vi | 1–3 | Worktree sạch, baseline report, ma trận dữ liệu/quyền |
| 1 | Bảo mật và quyền riêng tư | 4–12 | AI Tutor cứng hóa, storage tối thiểu, auth enforce, restore rehearsal |
| 2 | Nền tảng UI/UX | 13–19 | Design system, modal accessible, URL routes, offline states |
| 3 | Cải tiến tính năng | 20–26 | Các luồng giáo viên–học sinh–phụ huynh nâng cấp và test đầy đủ |
| 4 | Hiệu năng và quan sát | 27–30 | Bundle budget, lazy loading, pagination, RUM/alerting |
| 5 | Vận hành và rollout | 31–35 | Operations/Security Center, passkey, runtime flags |
| 6 | Release production | 36–38 | Branch protection, smoke, staged rollout và cleanup |

---

# WAVE 0 — BASELINE VÀ QUẢN TRỊ PHẠM VI

## Task 1: Tạo worktree và khóa baseline

**Priority:** P0
**Effort:** 0.5 ngày
**Dependencies:** Không

**Files:**
- Create: `docs/audits/2026-07-28-modernization-baseline.md`
- Worktree: `.worktrees/security-ui-modernization-20260728/` (không commit thư mục worktree)

- [x] Dùng worktree tích hợp cô lập `C:\quizpro\.worktrees\modernization-integration` trên nhánh `feat/modernization-integration`; ghi rõ sai khác có chủ đích so với tên worktree dự kiến.
- [x] Ghi commit SHA nguồn và `git status --short` của root chính/worktree.
- [x] Chạy baseline:

```bash
npm ci
npm ci --prefix workers
npx tsc --noEmit
npx tsc -p workers/tsconfig.json --noEmit
npm run test:run
npm run security:check
npm run build
```

- [x] Ghi số test, thời gian build, mọi chunk >100 KB, CSS tổng, warning và trạng thái feature flags.
- [x] Không thay đổi các file đang sửa dở ở working tree chính.

**Acceptance:** Báo cáo tái lập được, không chứa secret và worktree sạch.

**Commit:** `docs: capture modernization baseline`

## Task 2: Ma trận dữ liệu nhạy cảm và chính sách browser storage

**Priority:** P0
**Effort:** 1 ngày
**Dependencies:** Task 1

**Files:**
- Create: `docs/security/data-classification.md`
- Create: `src/security/storagePolicy.ts`
- Test: `tests/storagePolicy.test.ts`

**Interfaces:**

```ts
export type DataClassification = 'public' | 'display' | 'personal' | 'sensitive' | 'credential';
export type BrowserPersistence = 'memory' | 'session' | 'local-safe' | 'forbidden';

export interface StoragePolicyEntry {
  keyPattern: RegExp;
  classification: DataClassification;
  persistence: BrowserPersistence;
  clearOnLogout: boolean;
  maximumTtlMs?: number;
}

export function classifyStorageKey(key: string): StoragePolicyEntry;
```

- [ ] Phân loại hồ sơ, kết quả, lớp, quiz, gamification, AI, telemetry và preference.
- [ ] JWT/password/token = `credential + forbidden`.
- [ ] Hồ sơ học sinh/kết quả/danh sách lớp = `personal + memory/session`.
- [ ] Chỉ preference không nhạy cảm được `local-safe`.
- [ ] Test bắt buộc mọi `StorageKeys` có policy.

**Acceptance:** Không có storage key chưa phân loại.

**Commit:** `docs(security): define browser data policy`

## Task 3: Ma trận route–vai trò–ownership

**Priority:** P0
**Effort:** 1–2 ngày
**Dependencies:** Task 1

**Files:**
- Create: `docs/security/api-authorization-matrix.md`
- Create: `tests/apiAuthorizationMatrix.test.ts`
- Modify: `workers/src/middleware/auth.ts`

- [x] Phân loại từng route: public, authenticated, student-owned, teacher-owned, admin-only, internal-only.
- [x] Test phát hiện literal route trong `workers/src/router/createWorkerFetch.ts` nhưng thiếu policy.
- [x] Thêm abuse-test contract cho IDOR/BOLA bằng cách đổi `studentId`, `quizId`, `resultId`, `classId`, `batchId` và chạy trực tiếp các suite ownership liên quan.
- [x] Giữ fail-closed cho route chưa phân loại.

**Acceptance:** Mọi route dispatch có policy và route mới thiếu policy làm CI đỏ.

**Commit:** `test(security): enforce API authorization matrix`

---

# WAVE 1 — BẢO MẬT VÀ QUYỀN RIÊNG TƯ

## Task 4: Contract nghiêm ngặt cho AI Tutor

**Priority:** P0
**Effort:** 1 ngày
**Dependencies:** Task 3

**Files:**
- Create: `shared/ai-tutor.contract.ts`
- Modify: `workers/src/routes/aiTutor.ts`
- Modify: service frontend gọi AI Tutor tương ứng.
- Test: `tests/aiTutorContract.test.ts`

```ts
export const AiTutorDiagnoseRequestSchema = z.object({
  resultId: z.string().min(1).max(128),
});

export const AiTutorPracticeQuestionSchema = z.object({
  id: z.string().min(1).max(128),
  question: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(160)).length(4),
  correctAnswer: z.string().min(1).max(160),
}).refine(v => v.options.includes(v.correctAnswer));
```

- [ ] Thay request `quizId + wrongQuestionIds` bằng `resultId`.
- [ ] Không trả trường `raw` trong lỗi parse/validation.
- [ ] Chuẩn hóa error codes và giới hạn chuỗi/output.
- [ ] Sửa prompt thống nhất 2–3 câu thực hành.

**Acceptance:** Output AI luôn qua Zod trước khi trả browser.

**Commit:** `refactor(ai-tutor): add strict contracts`

## Task 5: Ownership và server-derived wrong questions cho AI Tutor

**Priority:** P0
**Effort:** 1–2 ngày
**Dependencies:** Task 4

**Files:**
- Create: `workers/src/services/aiTutorAuthorization.ts`
- Create: `workers/src/services/aiTutorContextService.ts`
- Modify: `workers/src/routes/aiTutor.ts`
- Test: `tests/aiTutorAuthorization.worker.test.ts`

- [ ] Học sinh chỉ dùng kết quả của chính mình.
- [ ] Giáo viên chỉ dùng kết quả thuộc quiz/lớp mình quản lý; admin theo quyền toàn trường.
- [ ] Server tự suy ra câu sai từ result/answers đã lưu.
- [ ] Giảm dữ liệu prompt; không gửi tên, username, lớp nếu không cần.
- [ ] Trả 404 chung cho resource không tồn tại/không thuộc quyền.

**Acceptance:** Student A và Teacher A không truy cập dữ liệu ngoài ownership.

**Commit:** `fix(ai-tutor): enforce result ownership`

## Task 6: Service binding, quota và log an toàn cho AI Tutor

**Priority:** P0
**Effort:** 2 ngày
**Dependencies:** Tasks 4–5

**Files:**
- Create: `workers/src/services/aiTutorQuota.ts`
- Modify: `workers/src/routes/aiTutor.ts`, `workers/src/types.ts`, `workers/wrangler.toml`
- Create: `workers/migrations/0044_create_ai_tutor_usage.sql`
- Create: `workers/rollbacks/0044_drop_ai_tutor_usage.sql`
- Test: `tests/aiTutorQuota.worker.test.ts`, `tests/aiTutorLogging.worker.test.ts`

- [ ] Gọi AI qua `env.AI_GATEWAY.fetch(...)`.
- [ ] Quota mặc định: học sinh 5/ngày, giáo viên 30/ngày, admin 100/ngày.
- [ ] Reservation idempotent theo request/user/result.
- [ ] Release quota khi upstream lỗi.
- [ ] Log chỉ requestId, role, workflow, model, status, latency; không prompt/output/PII.
- [ ] Rate limit riêng theo account và IP.

**Acceptance:** AI Tutor có quota, idempotency và không lộ nội dung học sinh.

**Commit:** `feat(ai-tutor): add quota and private gateway`

## Task 7: Loại StudentSession khỏi localStorage

**Priority:** P0
**Effort:** 1–2 ngày
**Dependencies:** Task 2

**Files:**
- Modify: `src/stores/useClassroomStore.ts`
- Modify: `src/constants/storageKeys.ts`
- Modify: `src/stores/useGamificationStore.ts`
- Create: `src/security/clearUserBrowserData.ts`
- Test: `tests/studentSessionStorage.test.ts`, `tests/browserDataCleanup.test.ts`

- [ ] Giữ session trong Zustand memory; reload gọi profile endpoint bằng cookie.
- [ ] Chỉ có thể lưu cờ không định danh để thử restore.
- [ ] Coins/pet từ localStorage không là nguồn sự thật.
- [ ] Logout/account switch xóa toàn bộ dữ liệu user-scoped.
- [ ] Thêm chức năng “Xóa dữ liệu trên thiết bị này”.

**Acceptance:** Sau logout không còn tên/lớp/avatar/coins/results/assignments trong browser storage.

**Commit:** `fix(privacy): stop persisting student profiles`

## Task 8: Thu hẹp CacheService

**Priority:** P0
**Effort:** 1 ngày
**Dependencies:** Tasks 2, 7

**Files:**
- Modify: `src/services/CacheService.ts` và callers.
- Test: `tests/cacheStoragePolicy.test.ts`

- [ ] Mặc định cache = memory.
- [ ] Public quizzes có thể session; results/teachers/students/parent data chỉ memory.
- [ ] Namespace cache theo account/session.
- [ ] Invalidate toàn bộ namespace khi logout hoặc 401/403.

**Acceptance:** Test fail khi dữ liệu personal được ghi localStorage.

**Commit:** `refactor(cache): enforce persistence policy`

## Task 9: Hợp nhất hai teacher auth store

**Priority:** P0
**Effort:** 2–3 ngày
**Dependencies:** Task 2

**Files:**
- Keep/rewrite: `src/stores/authStore.ts`
- Delete after migration: `src/stores/useAuthStore.ts`
- Modify: mọi import và login/dashboard shell.
- Test: `tests/authStore.test.ts`, `cypress/e2e/auth-session.cy.ts`

```ts
interface AuthState {
  status: 'idle' | 'restoring' | 'authenticated' | 'anonymous';
  session: TeacherSession | null;
  login(credentials: LoginCredentials): Promise<void>;
  restoreSession(): Promise<void>;
  logout(): Promise<void>;
}
```

- [ ] Server profile/session endpoint là nguồn sự thật.
- [ ] localStorage không quyết định authenticated/admin state.
- [ ] Logout luôn clear client state kể cả request server lỗi.
- [ ] Xóa store cũ khi toàn repo không còn import.

**Acceptance:** Sửa localStorage không mở được dashboard admin.

**Commit:** `refactor(auth): consolidate teacher session store`

## Task 10: Chuyển auth compat → enforce

**Priority:** P0
**Effort:** 2 ngày + 7–14 ngày quan sát
**Dependencies:** Tasks 7–9

**Files:**
- Modify: `workers/src/utils/jwt.ts`, `workers/src/middleware/jwtAuth.ts`, `workers/src/utils/authSession.ts`, `workers/wrangler.toml`
- Test: `tests/cookieAuthClients.test.ts`, `tests/legacyJwtMigration.worker.test.ts`
- Create: `docs/deployment/auth-cookie-enforcement.md`

- [x] Ghi metric legacy Bearer/JWT usage mà không log token hoặc username.
- [ ] Điều kiện chuyển: 0 request legacy hợp lệ trong 72 giờ production liên tục; cần bằng chứng log thực tế.
- [x] Đổi checked-in `AUTH_MIGRATION_MODE="enforce"` bằng commit config riêng; chưa deploy production.
- [ ] Sau 48 giờ enforce production ổn định, xóa legacy/browser Bearer fallback bằng commit riêng.
- [x] Rollback auth-validation duy nhất: đổi env về `compat`; cookie transport vẫn giữ nguyên.

**Acceptance:** JWT thiếu issuer/audience/tokenVersion bị từ chối; UI vẫn login/refresh/logout bằng cookie.

**Commit:** `security(auth): enforce registered JWT claims`

## Task 11: Security gate cho root và Workers

**Priority:** P0
**Effort:** 1 ngày
**Dependencies:** Task 1

**Files:**
- Modify: `scripts/dependency-audit-report.mjs`, `package.json`, `.github/workflows/security.yml`, `.github/workflows/ci.yml`
- Test: `tests/securityWorkflowConfig.test.ts`

- [ ] Audit production dependencies ở root và `workers/`.
- [ ] CI cài worker lockfile bằng `npm ci --prefix workers --ignore-scripts`.
- [ ] Quét secret cả Git history nhưng không in giá trị.
- [ ] Gate CSP/CORS/browser JWT/migration rollback.
- [ ] Cấu hình Dependabot root + workers hàng tuần.

**Acceptance:** Vulnerability production ở một trong hai lockfile làm workflow fail.

**Commit:** `ci(security): audit frontend and workers`

## Task 12: Backup D1 và restore rehearsal

**Priority:** P0
**Effort:** 2–3 ngày
**Dependencies:** Task 1

**Files:**
- Create: `workers/scripts/list-backup-tables.cjs`
- Create: `workers/scripts/export-d1-tablewise.cjs`
- Create: `workers/scripts/verify-d1-restore.cjs`
- Create: `docs/operations/d1-backup-restore.md`
- Test: `tests/d1BackupScripts.test.ts`

- [ ] Loại FTS virtual/shadow tables khỏi export.
- [ ] Script từ chối ghi dump trong repo.
- [ ] Mã hóa/nén ở storage an toàn ngoài repo.
- [ ] Diễn tập Time Travel vào DB staging riêng.
- [ ] Verify schema, row counts, login/API smoke và rebuild FTS.
- [ ] Ghi RPO/RTO thực tế.

**Acceptance:** Restore staging hoàn chỉnh vượt smoke test, không có dump trong Git/artifact công khai.

**Commit:** `ops(d1): add backup and restore rehearsal`

---

# WAVE 2 — NỀN TẢNG UI/UX

## Task 13: Design tokens và tài liệu design system

**Priority:** P1
**Effort:** 2 ngày

**Files:**
- Create: `src/styles/design-tokens.css`
- Modify: `styles.css`
- Create: `docs/design/design-system.md`
- Test: `tests/designTokens.test.ts`

- [ ] Chốt semantic colors, typography, spacing 4px, radius và shadow hierarchy.
- [ ] Áp dụng token cho primitive mới, chưa rewrite toàn UI.
- [ ] Test contrast và cấm hex mới trong `src/components/common`.

**Acceptance:** Token được import toàn app mà không phá layout.

**Commit:** `feat(ui): establish design tokens`

## Task 14: Chuẩn hóa UI primitives

**Priority:** P1
**Effort:** 3–4 ngày
**Dependencies:** Task 13

**Files:**
- Modify: `src/components/common/Button.tsx`, `Card.tsx`
- Create: `Input.tsx`, `Alert.tsx`, `Skeleton.tsx`, `AsyncState.tsx`, `EmptyState.tsx`
- Test: `tests/commonPrimitives.test.tsx`, `cypress/component/common-primitives.cy.tsx`

- [ ] Button hit area ≥44px, focus rõ, loading có `aria-busy`.
- [ ] Input luôn có label/description/error IDs.
- [ ] Alert không truyền trạng thái chỉ bằng màu.
- [ ] AsyncState gom loading/error/empty/retry.
- [ ] Pilot ở Teacher Overview trước.

**Acceptance:** Axe không có violation nghiêm trọng.

**Commit:** `feat(ui): standardize common primitives`

## Task 15: Modal/Dialog accessible

**Priority:** P1
**Effort:** 2–3 ngày
**Dependencies:** Tasks 13–14

**Files:**
- Rewrite: `src/components/common/Modal.tsx`
- Create: `useFocusTrap.ts`, `useBodyScrollLock.ts`
- Test: `tests/ModalAccessibility.test.tsx`, `cypress/component/modal-accessibility.cy.tsx`

- [ ] Portal, `role=dialog`, `aria-modal`, labelled/described IDs.
- [ ] Focus trap, Escape, focus return, backdrop policy.
- [ ] Body scroll lock có scrollbar compensation.
- [ ] Close button có `aria-label="Đóng"`.
- [ ] Giữ mobile sheet/fullscreen contract.

**Acceptance:** Keyboard-only mở–dùng–đóng modal, không focus/scroll nền.

**Commit:** `feat(a11y): rebuild modal foundation`

## Task 16: Lỗi chuẩn hóa có requestId và retry

**Priority:** P1
**Effort:** 2 ngày
**Dependencies:** Task 14

**Files:**
- Modify: `src/services/api/errors.ts`, `apiClient.ts`, `src/components/common/ErrorBoundary.tsx`
- Create: `src/components/common/SupportError.tsx`
- Test: `tests/apiErrorPresentation.test.tsx`

- [ ] Chuẩn hóa `AppError {code,message,requestId,retryable,status}`.
- [ ] 401/403/429/5xx có hành động đúng, không retry vô hạn.
- [ ] Cho copy requestId, không copy payload/query nhạy cảm.
- [ ] Không hiển thị stack/raw error ở production.

**Acceptance:** Mọi lỗi API chính có mã hỗ trợ và retry hợp lý.

**Commit:** `feat(ux): present errors with request IDs`

## Task 17: Loading, empty, stale và offline states

**Priority:** P1
**Effort:** 2–3 ngày
**Dependencies:** Tasks 14, 16

**Files:**
- Create: `src/hooks/useOnlineStatus.ts`, `src/components/common/OfflineBanner.tsx`
- Modify: Teacher Overview, Results, Classes, Student Dashboard, Parent Portal.
- Test: `tests/AsyncStates.test.tsx`, `cypress/e2e/offline-states.cy.ts`

- [ ] Skeleton giảm CLS.
- [ ] Empty state có lý do và CTA.
- [ ] Có stale timestamp nhưng không dùng stale data sau 401/403.
- [ ] Offline chặn thao tác cần server nhưng giữ draft hợp lệ.
- [ ] `aria-live` cho trạng thái quan trọng.

**Acceptance:** Năm màn hình pilot không còn blank screen.

**Commit:** `feat(ux): standardize async and offline states`

## Task 18: Chuyển điều hướng chính sang URL

**Priority:** P1
**Effort:** 5–8 ngày
**Dependencies:** Task 9, Tasks 14–17

**Files:**
- Modify: `src/app/AppRoutes.tsx`, `RootView.tsx`, `routeTypes.ts`, `lazyViews.ts`
- Modify: legacy navigation state trong quiz store và dashboard shells.
- Test: `tests/routeGuards.test.tsx`, `cypress/e2e/url-navigation.cy.ts`

**Target routes:**

```text
/teacher/overview
/teacher/quizzes
/teacher/assignments
/teacher/results
/teacher/classes
/teacher/live-exams
/teacher/gift-shop
/student/dashboard
/student/assignments
/student/practice
/student/shop
/student/live-exam/:sessionId
```

- [x] Guard theo session store, không set state trong render.
- [x] Filters/pagination dùng search params.
- [x] Deep link chưa login dùng allowlisted `returnTo`.
- [x] Giữ redirect tương thích một release rồi xóa `quizStore.view` đã migrate.

**Acceptance:** Refresh/deep link/back/forward không làm mất màn hình hoặc filter.

**Commits:** teacher routes, student routes, remove legacy navigation.

## Task 19: Trải nghiệm thiết bị yếu và mạng chập chờn

**Priority:** P1
**Effort:** 3 ngày
**Dependencies:** Tasks 17–18

**Files:**
- Create: `src/config/deviceCapabilities.ts`, `src/hooks/useReducedExperience.ts`
- Modify: animation/gamification và quiz autosave UI.
- Test: `tests/reducedExperience.test.tsx`, `cypress/e2e/low-bandwidth.cy.ts`

- [x] Tôn trọng reduced-motion/saveData.
- [x] Không tải confetti/3D ở reduced mode.
- [x] Hiển thị đã lưu/đang đồng bộ/mất kết nối.
- [x] Retry bounded exponential backoff + idempotency key.
- [x] Preflight Live Exam: API health, clock drift, cookies, viewport, online.

**Acceptance:** Slow 3G/offline không làm freeze, mất answer hoặc submit trùng.

**Commit:** `feat(resilience): add low-bandwidth experience`

---

# WAVE 3 — CẢI TIẾN TÍNH NĂNG HIỆN CÓ

## Task 20: Dashboard “Việc cần chú ý hôm nay”

**Priority:** P1
**Effort:** 4–5 ngày
**Dependencies:** Tasks 14, 16, 18

**Files:**
- Create: `shared/teacher-action-center.contract.ts`
- Create: `workers/src/routes/actionCenter.ts`, `workers/src/services/actionCenterService.ts`
- Create: `src/components/TeacherDashboard/overview/ActionCenterPanel.tsx`
- Test: `tests/actionCenterService.test.ts`, `cypress/e2e/teacher-action-center.cy.ts`

- [x] Bắt đầu với: assignment at risk, draft unpublished, gift order pending, live exam upcoming.
- [x] Mỗi item có severity, explanation, count, generatedAt và internal CTA.
- [x] Chỉ dữ liệu thuộc teacher/admin scope.
- [x] Tối đa 8 item có thể hành động.

**Acceptance:** CTA dẫn đúng route/filter; không lộ lớp khác.

**Commit:** `feat(teacher): add action center`

## Task 21: Quality gate cho tạo đề AI

**Priority:** P1
**Effort:** 5–7 ngày
**Dependencies:** Task 6 và UI primitives

**Files:**
- Create: `shared/ai-question-quality.contract.ts`, `workers/src/services/aiQuestionQuality.ts`
- Modify: AI generation/review/save flow.
- Create: `QuestionQualityReview.tsx`
- Test: `tests/aiQuestionQuality.test.ts` và AI Cypress specs.

- [x] Deterministic checks: answer ngoài options, duplicate question/options, empty stem, grade mismatch, math parse risk.
- [x] Preview blueprint/quota trước generate.
- [x] “Tạo thử 3 câu”, regenerate từng câu, diff và undo.
- [x] Blocking issue không được publish; warning cần acknowledge.
- [x] Lưu prompt/blueprint version và quality summary, không chain-of-thought.

**Acceptance:** Không publish được MCQ có đáp án không thuộc options.

**Commit:** `feat(ai): add question quality gate`

## Task 22: Live Exam reconnect, autosave và connection monitoring

**Priority:** P1
**Effort:** 6–8 ngày
**Dependencies:** Task 19

**Files:**
- Migration/rollback: live exam connection events.
- Create: `workers/src/services/liveExam/connectionEventService.ts`
- Modify: activity/submit/timing routes, `LiveExamQuiz.tsx`, `ActiveExamMonitor.tsx`
- Test: `tests/liveExamReconnect.worker.test.ts`, `cypress/e2e/live-exam-reconnect.cy.ts`

- [ ] Autosave delta có attemptVersion/idempotency.
- [ ] Reconnect lấy authoritative answers/timer từ server.
- [ ] Event log không chứa answer content.
- [ ] Teacher thấy online/reconnecting/offline/lastSeen.
- [ ] Gia hạn cá nhân, pause room, end early hai bước + audit.

**Acceptance:** Mất mạng 60 giây rồi quay lại không mất đáp án hoặc tạo submission trùng.

**Commit:** `feat(live-exam): add reconnect monitoring`

## Task 23: Results Intervention Center

**Priority:** P1
**Effort:** 5–7 ngày
**Dependencies:** Task 20, URL routes

**Files:**
- Create: `shared/intervention.contract.ts`, service/routes/migration.
- Create: `src/components/teacher/ResultsView/InterventionPanel.tsx`
- Test: `tests/interventionService.test.ts`, `cypress/e2e/results-intervention.cy.ts`

- [ ] Nhóm skill weakness có minimum sample/confidence.
- [ ] First-vs-latest attempt và xu hướng 4 tuần.
- [ ] Copy dùng “Cần hỗ trợ ở…”, không gắn nhãn tiêu cực công khai.
- [ ] Teacher tạo group, private note và smart assignment.
- [ ] Audit note/group/assignment.

**Acceptance:** Từ nhóm yếu → tạo assignment trong tối đa 3 bước; note chỉ giáo viên thấy.

**Commit:** `feat(results): add intervention groups`

## Task 24: Parent Portal digest, preferences và account recovery

**Priority:** P1
**Effort:** 6–8 ngày

**Files:**
- Migration/rollback cho preferences, digest runs, verification/reset tokens.
- Create: digest service, preference/recovery routes, email provider adapter.
- Create frontend pages.
- Test: `tests/parentDigestService.test.ts`, `cypress/e2e/parent-preferences.cy.ts`

- [ ] Provider sau interface; secret không vào frontend.
- [ ] Token hash ở DB, single-use, TTL 30 phút/24 giờ tùy loại.
- [ ] Digest: hoàn thành, cần hỗ trợ, gợi ý tại nhà; tối thiểu hóa PII.
- [ ] Preferences theo loại, quiet hours, weekly opt-in.
- [ ] SPF/DKIM/DMARC là rollout gate.

**Acceptance:** Token replay bị từ chối và email payload không chứa dữ liệu thừa.

**Commit:** `feat(parent): add digest and account recovery`

## Task 25: Gift Shop governance

**Priority:** P1
**Effort:** 4–5 ngày

**Files:**
- Migration/rollback cho stock, weekly limit, class scope, cancellation reason.
- Modify gift shop Worker/frontend routes/components.
- Test: `tests/giftShopGovernance.worker.test.ts`, existing E2E.

- [ ] Catalog theo school/class/grade.
- [ ] Weekly limit và stock/coins update atomic.
- [ ] State machine pending/approved/delivered/cancelled; transition sai = 409.
- [ ] Hủy có reason; refund idempotent; audit actor.
- [ ] Low-stock vào Action Center; cho đóng shop theo lớp/trường.

**Acceptance:** Concurrent purchase không âm stock/coins; cancel lặp không refund hai lần.

**Commit:** `feat(gift-shop): add governance controls`

## Task 26: Notification preferences, dedupe và quiet hours

**Priority:** P1
**Effort:** 4–5 ngày

**Files:**
- Modify: `shared/notifications.contract.ts`, notification schema/service/routes/UI.
- Test: `tests/notificationPreference.test.ts`, existing E2E.

- [x] Severity critical/action_required/informational.
- [x] Dedupe key theo recipient/type/resource/window.
- [x] Quiet hours chỉ trì hoãn informational; critical không bị tắt vĩnh viễn.
- [x] Read state authoritative ở server.
- [x] Notification expiry và allowlisted internal links.
- [x] Aggregate sent/read/click metrics theo quyền.

**Acceptance:** Một event không tạo notification trùng; preferences được tôn trọng.

**Commit:** `feat(notifications): add preference-aware dedupe`

---

# WAVE 4 — HIỆU NĂNG VÀ OBSERVABILITY

## Task 27: Bundle analyzer và performance budget CI

**Priority:** P1
**Effort:** 1–2 ngày

**Files:**
- Modify: `vite.config.ts`, `.github/workflows/ci.yml`, `package.json`
- Create: `scripts/analyze-bundle.mjs`, `config/performance-budget.json`
- Test: `tests/performanceBudget.test.ts`

```json
{
  "initialJsGzipBytes": 204800,
  "cssGzipBytes": 51200,
  "lazyChunkGzipBytes": 135000,
  "singleChunkMinifiedBytes": 500000
}
```

- [ ] Sinh machine-readable bundle report.
- [ ] CI fail khi vượt budget; allowlist phải có lý do và expiry.
- [ ] Báo top contributors/route owner.
- [ ] Không tăng warning limit để che lỗi.

**Acceptance:** Inject chunk giả lớn làm gate fail.

**Commit:** `ci(perf): enforce bundle budgets`

## Task 28: Tách DOCX/PDF/worksheet/chart chunks

**Priority:** P1
**Effort:** 3–5 ngày
**Dependencies:** Task 27

**Files:**
- Modify DOCX importer, `WorksheetExportModal.tsx`, PDF export, analytics routes, `lazyViews.ts`, `vite.config.ts`.
- Test: `tests/heavyFeatureLazyLoading.test.tsx` và import/export E2E.

- [ ] Word/Excel libs chỉ tải sau khi chọn import.
- [ ] jsPDF/html2canvas/dom-to-image chỉ tải khi export.
- [ ] Recharts chỉ tải analytics tab.
- [ ] Điều tra Tooltip/shared chunk và tránh barrel import nặng.
- [ ] Preload khi hover/focus CTA, không preload home.

**Acceptance:** Không chunk >500 KB minified; initial route không tải document/chart code.

**Commit:** `perf(frontend): lazy-load heavy tooling`

## Task 29: Pagination, virtualization và indexes

**Priority:** P1
**Effort:** 4–6 ngày

**Files:**
- Modify results/students/teachers/orders/notifications endpoints và list UI.
- Migration/rollback cho index đã đo cần thiết.
- Test: `tests/paginationContracts.test.ts`
- Create: `scripts/benchmark-list-endpoints.mjs`

- [ ] Default page 25, max 100; stable cursor.
- [ ] Không endpoint quản trị trả toàn bộ rows vô hạn.
- [ ] Đo `EXPLAIN QUERY PLAN` trước/sau index.
- [ ] Virtualize DOM >100 items mà vẫn accessible.
- [ ] URL giữ filter/sort/page/cursor.

**Acceptance:** Dataset staging 10k rows đạt p95 mục tiêu <500ms cho core list reads.

**Commit:** `perf(data): paginate large collections`

## Task 30: Web Vitals, API latency và alerting

**Priority:** P0/P1
**Effort:** 3–5 ngày

**Files:**
- Create: `src/observability/webVitals.ts`, `workers/src/routes/clientTelemetry.ts`
- Modify Worker request wrapper/logging.
- Create: `docs/operations/observability.md`, `docs/operations/alert-thresholds.md`
- Test: telemetry redaction/sampling tests.

- [ ] LCP ≤2.5s p75, INP ≤200ms p75, CLS ≤0.1 p75.
- [ ] API core read p95 <500ms; heavy analytics <1.5s.
- [ ] Client sample ≤10%, không PII/full URL query/answers.
- [ ] Worker log: requestId, route template, method, status, duration, role category.
- [ ] Alert: 5xx, login failures, 429 spike, Queue/DLQ, certificates, AI errors/cost.
- [ ] Mỗi alert có owner, cooldown và runbook.

**Acceptance:** Từ UI error có thể truy ra requestId/Worker event mà không cần dữ liệu nhạy cảm.

**Commit:** `feat(observability): add privacy-safe telemetry`

---

# WAVE 5 — TRUNG TÂM VẬN HÀNH VÀ BẢO MẬT

## Task 31: Operations Center backend

**Priority:** P2
**Effort:** 4–6 ngày
**Dependencies:** Task 30

**Files:**
- Create: `shared/operations.contract.ts`, operations route/service.
- Modify: Worker index/auth matrix.
- Test: `tests/operationsRoutes.worker.test.ts`

- [ ] Snapshot API/D1/migration/Queue/DLQ/R2/AI/certificates/backup/flags.
- [ ] Admin-only; không trả secret/binding IDs/raw errors.
- [ ] Component status healthy/degraded/unavailable/unknown + checkedAt.
- [ ] Timeout từng dependency để endpoint tổng không treo.

**Acceptance:** Một dependency hỏng chỉ làm component degraded; endpoint vẫn hữu ích.

**Commit:** `feat(ops): expose operations snapshot`

## Task 32: Operations Center UI

**Priority:** P2
**Effort:** 3–5 ngày
**Dependencies:** Tasks 14–18, 31

**Files:**
- Create: `src/features/operations/OperationsCenterPage.tsx` và component con.
- Modify admin routes/sidebar.
- Test: `tests/OperationsCenterPage.test.tsx`, `cypress/e2e/operations-center.cy.ts`

- [ ] Admin-only route/menu.
- [ ] Health, last checked, runbook, refresh; chưa có destructive action ở phiên đầu.
- [ ] Charts lazy load.
- [ ] Copy requestId/release SHA, không raw logs.

**Acceptance:** Admin xác định trạng thái hệ thống trong một màn hình; teacher bị chặn.

**Commit:** `feat(admin): add operations center`

## Task 33: Security Center và session management

**Priority:** P2
**Effort:** 5–7 ngày
**Dependencies:** Task 10

**Files:**
- Migration/rollback cho auth sessions/security events.
- Create security routes/service/UI.
- Test: `tests/securityCenter.worker.test.ts`, `cypress/e2e/security-center.cy.ts`

- [ ] JWT có sessionId; DB lưu metadata tối thiểu.
- [ ] Xem/revoke một phiên/logout all.
- [ ] Events: password change/reset/session revoke/login threshold/passkey changes.
- [ ] Retention 90 ngày và purge cron.
- [ ] Không hiển thị full IP cho user thường.

**Acceptance:** Revoke làm request kế tiếp 401; logout all không revoke session tạo sau thao tác.

**Commit:** `feat(security): add session center`

## Task 34: Passkey/WebAuthn cho staff

**Priority:** P2
**Effort:** 7–10 ngày
**Dependencies:** Task 33

**Files:**
- Migration/rollback cho credentials/challenges.
- Create WebAuthn service/routes/UI.
- Create: `docs/security/passkey-threat-model.md`
- Test registration/auth/replay/wrong-origin fixtures.

- [ ] RP ID `thtohieu.com`; exact allowed origins.
- [ ] Challenge random, single-use, TTL 5 phút.
- [ ] Verify origin, rpIdHash, flags, signature counter.
- [ ] Passkey bổ sung password trước; recovery có audit.
- [ ] Dùng thư viện WebAuthn được review/pin, không tự viết crypto parser.

**Acceptance:** Replay, wrong origin/RP ID, reused challenge và cloned counter bị từ chối.

**Commit:** `feat(auth): add staff passkeys`

## Task 35: Runtime feature rollout control plane

**Priority:** P2
**Effort:** 6–8 ngày
**Dependencies:** Tasks 31–33

**Files:**
- Migration/rollback cho flags/rules/audit.
- Create: `workers/src/services/featureFlagService.ts`
- Modify: system settings route và frontend flag resolution.
- Create: `FeatureRolloutPanel.tsx`
- Test: `tests/featureFlagRules.test.ts`, `cypress/e2e/feature-rollout.cy.ts`

- [ ] Audience admin/teacher/student/parent/all; percentage, allow users/classes, start/end.
- [ ] Stable hash user+flag, không random mỗi request.
- [ ] PATCH riêng field, không ghi đè nhiều flags.
- [ ] UI preview audience/change summary/owner/reason/rollback.
- [ ] Audit before/after/actor/requestId.
- [ ] Stop conditions gắn 5xx/client errors/latency/support.

**Acceptance:** Bật 5% giáo viên hoặc một lớp và rollback runtime không cần redeploy cho flag đã migrate.

**Commit:** `feat(flags): add staged rollout rules`

---

# WAVE 6 — RELEASE VÀ PRODUCTION ROLLOUT

## Task 36: Branch protection và release-readiness gate

**Priority:** P0
**Effort:** 1 ngày code + GitHub settings

**Files:**
- Create/modify: `.github/workflows/release-readiness.yml`
- Create/modify: `scripts/release-readiness.mjs`
- Modify: `DEPLOYMENT_CHECKLIST.md`
- Test: `tests/releaseReadiness.test.ts`

- [ ] Gate: typecheck frontend/workers, tests, coverage, build, perf budget, security root/workers, migrations, Cypress V2/V3.
- [ ] Output machine-readable `ready|blocked`.
- [ ] Branch protection: PR required, checks required, stale approval dismissed, no force push/direct push.
- [ ] CODEOWNERS cho security-sensitive paths nếu quy trình hỗ trợ.

**Acceptance:** PR đỏ/direct push không merge vào main; gate không deploy.

**Commit:** `ci: add release readiness gate`

## Task 37: Production smoke và staged rollout

**Priority:** P0
**Effort:** 2–3 ngày
**Dependencies:** Tasks 30, 35, 36

**Files:**
- Create/modify: `.github/workflows/production-smoke.yml`, `scripts/run-production-smoke.mjs`
- Create: `docs/operations/staged-rollout.md`

- [ ] Smoke frontend domains, headers, API health, CORS, hostile origin, auth guard và one-read-path mỗi role.
- [ ] AI smoke khi rollout AI; Queue/certificate mutation chỉ staging/test namespace.
- [ ] Rollout: admin-only → 5% teachers → pilot class → 25% → 100%.
- [ ] Mỗi bước theo dõi 24–48 giờ.
- [ ] Stop: 5xx >1%, client errors >2x baseline, p95 +30%, data corruption hoặc auth anomaly.
- [ ] Failure artifacts phải redacted.

**Acceptance:** Workflow nhận URL input, không rò credential và rollback procedure rõ.

**Commit:** `ops: automate production smoke and rollout`

## Task 38: Cleanup production, release notes và maintenance calendar

**Priority:** P0
**Effort:** 1–2 ngày
**Dependencies:** Task 37 + owner approval

**Files:**
- Modify: `CHANGELOG.md`, `docs/ROADMAP.md`, `docs/deployment/CURRENT_PROGRESS.md`
- Create: `docs/releases/v1.0.0-modernization-verification.md`
- Create: `docs/operations/maintenance-calendar.md`

- [ ] Backup/bookmark trước cleanup.
- [ ] Dry-run và xóa đúng `test.gv1`, `test.hs1`, `test.hs2`, `Lớp Test 1` cùng artifacts test; không xóa `tongminhkhanh` hoặc owner-created data chưa xác nhận.
- [ ] Cleanup script idempotent, có row counts/audit.
- [ ] Full smoke sau cleanup.
- [ ] Ghi release SHA, Worker/Vercel versions, migrations, flags, metrics và rollback points.
- [ ] Lịch: security hàng tuần, backup verify hàng tháng, restore rehearsal hàng quý, AI/R2 cost hàng tuần.

**Acceptance:** Production không còn dữ liệu test đã xác định và release record có đầy đủ bằng chứng.

**Commit:** `docs: finalize modernization release operations`

---

# Quality Gates

## Security/Auth

```bash
npm run security:scan
npm run audit:dependencies:production
npm run audit:dependencies:workers:production
npx tsc --noEmit
npx tsc -p workers/tsconfig.json --noEmit
npm run test:run
```

Bắt buộc có abuse tests cho missing auth, wrong role, cross-owner IDs, replay, rate limit và generic errors.

## UI

- Keyboard-only flow.
- Axe/component accessibility checks.
- Responsive 320/768/1024/1440.
- Loading/error/empty/offline.
- Reduced motion.
- Không console error/warning.

## D1

```bash
npm run test:run -- tests/d1RollbackCoverage.test.ts tests/freshD1Bootstrap.test.ts
npx tsc -p workers/tsconfig.json --noEmit
```

Mọi migration phải có rollback, bootstrap schema và migration registry đồng bộ.

## Performance

```bash
npm run build
npm run perf:budget
```

PR chạm bundle/render/query phải có số before/after.

## Release

```bash
npm run release:readiness
```

Không merge/deploy nếu status khác `ready`.

---

# Definition of Done

- AI Tutor dùng result ownership, server-derived context, strict output, quota và service binding.
- Không còn JWT/hồ sơ học sinh trong localStorage.
- Chỉ một teacher auth store; refresh dựa vào cookie/server.
- Auth production ở enforce và legacy path được gỡ sau quan sát.
- Security audit bao phủ root + Workers.
- D1 restore staging đã diễn tập và đo RPO/RTO.
- Design tokens/primitives/modal accessible được dùng ở màn hình chính.
- Data screens có loading/error/empty/offline và requestId.
- Teacher/student navigation có URL deep-link.
- Live Exam chịu disconnect/reload không mất đáp án.
- Dashboard có actionable work queue.
- AI generation có quality gate và teacher review.
- Results hỗ trợ intervention groups/private notes.
- Parent Portal có digest/preferences/recovery an toàn.
- Gift Shop có stock/limit/state/audit/refund idempotent.
- Notifications có dedupe/severity/quiet hours/server read state.
- Không chunk >500 KB minified; initial bundle nằm trong budget.
- Web Vitals/API alerts có owner/runbook.
- Operations Center, Security Center, passkeys và runtime rollout hoạt động.
- Branch protection/release gate/smoke production bắt buộc.
- Dữ liệu test được cleanup có backup và verification.

---

# Ma trận đề xuất → Task

| Đề xuất | Task |
|---|---:|
| Cứng hóa AI Tutor | 4–6 |
| Giảm localStorage PII/cache | 2, 7–8 |
| Hợp nhất auth store, cookie enforce | 9–10 |
| Audit Workers/branch protection | 11, 36 |
| Backup/restore D1 | 12 |
| Design system/modal/a11y | 13–17 |
| URL navigation/low-bandwidth | 18–19 |
| Teacher Action Center | 20 |
| AI quiz quality | 21 |
| Live Exam resilience | 22 |
| Results intervention | 23 |
| Parent Portal digest/recovery | 24 |
| Gift Shop governance | 25 |
| Notification preferences/dedupe | 26 |
| Bundle/pagination/performance | 27–29 |
| Monitoring/Web Vitals | 30 |
| Operations/Security Center | 31–34 |
| Dynamic rollout flags | 35 |
| Release/smoke/cleanup | 36–38 |

---

# Execution Handoff

1. Task 1–3 trong worktree sạch.
2. Có thể chạy song song Security (4–12) và UI Foundation (13–17).
3. Merge nền tảng rồi thực hiện routing/resilience (18–19).
4. Task 20–26 là các PR độc lập hoặc stacked PR nhỏ.
5. Task 27–30 đo trên code đã merge.
6. Task 31–35 chỉ rollout sau khi observability/auth enforce ổn định.
7. Task 36–38 là release program riêng, không trộn với feature work.

Mỗi PR phải có: task link, security/UX impact, test evidence, migration/rollback nếu có, before/after metric khi chạm performance và feature flag/rollback procedure khi đổi hành vi production.

---

# Parallel Execution File Matrix — 2026-07-28

## Privacy / Cache (Tasks 2, 7, 8)

**Create:** `src/security/storagePolicy.ts`, `src/security/clearUserBrowserData.ts`, `docs/security/data-classification.md`, `tests/storagePolicy.test.ts`, `tests/studentSessionStorage.test.ts`, `tests/browserDataCleanup.test.ts`, `tests/cacheStoragePolicy.test.ts`.

**Modify:** `src/constants/storageKeys.ts`, `src/stores/useClassroomStore.ts`, `src/stores/useGamificationStore.ts`, `src/services/CacheService.ts`, `tests/cookieSessionStores.test.ts`.

## UI Foundation (Tasks 13, 14, 15)

**Create:** `src/styles/design-tokens.css`, `docs/design/design-system.md`, `src/components/common/Input.tsx`, `Alert.tsx`, `Skeleton.tsx`, `EmptyState.tsx`, `AsyncState.tsx`, `useFocusTrap.ts`, `useBodyScrollLock.ts`, unit tests and Cypress component specs.

**Modify:** `styles/index.css`, `src/components/common/Button.tsx`, `Card.tsx`, `Modal.tsx`, `src/components/common/index.ts`.

## Performance / Security CI (Task 27 and code portion of Task 11)

**Create:** `config/performance-budget.json`, `scripts/analyze-bundle.mjs`, `tests/performanceBudget.test.ts`, `.github/dependabot.yml`, `tests/securityWorkflowConfig.test.ts`.

**Modify:** `package.json`, `scripts/dependency-audit-report.mjs`, `.github/workflows/security.yml`, `.github/workflows/ci.yml`.

## Parallel Execution Batch 2 — 2026-07-28

### Stream A — AI Tutor Security (Tasks 4–6)

**Create:** `shared/ai-tutor.contract.ts`, `workers/src/services/aiTutorAuthorization.ts`, `workers/src/services/aiTutorContextService.ts`, `workers/src/services/aiTutorQuota.ts`, `workers/migrations/0044_create_ai_tutor_usage.sql`, `workers/rollbacks/0044_drop_ai_tutor_usage.sql`, `tests/aiTutorContract.test.ts`, `tests/aiTutorAuthorization.worker.test.ts`, `tests/aiTutorQuota.worker.test.ts`, `tests/aiTutorLogging.worker.test.ts`.

**Modify:** `workers/src/routes/aiTutor.ts`, `src/services/aiTutorService.ts`, `src/components/student/ResultScreen/DrOwlModal.tsx`, `workers/scripts/bootstrap_d1_migration_registry.sql`, `tests/d1MigrationLayout.test.ts`, `tests/d1RollbackCoverage.test.ts`.

**Acceptance:** request chỉ nhận `resultId`; ownership fail-closed; câu sai suy ra từ server; output Zod; service binding; quota/idempotency; log không prompt/output/PII.

### Stream B — Auth and Security Gates (Tasks 9, 11)

**Create:** `tests/authStore.test.ts`, `cypress/e2e/auth-session.cy.ts`, `scripts/security-history-scan.mjs`, `scripts/security-policy-gates.mjs`.

**Modify/Delete:** rewrite `stores/authStore.ts`; migrate `ResultReportDeliveryWizard.tsx` và component test sang canonical store; delete `src/stores/useAuthStore.ts` và legacy `src/stores/authStore.ts` sau khi không còn import; update `tests/cookieSessionStores.test.ts`, `package.json`, `.github/workflows/security.yml`, `tests/securityWorkflowConfig.test.ts`.

**Acceptance:** localStorage không xác thực/admin; server profile là nguồn sự thật; logout luôn clear; history/CSP/CORS/browser-JWT/migration rollback gates chạy trong CI.

### Stream C — UI Pilot and Request-ID Errors (Tasks 13, 14, 16)

**Create:** `src/components/common/SupportError.tsx`, `tests/apiErrorPresentation.test.tsx`, `tests/teacherOverviewA11y.test.tsx`.

**Modify:** `src/services/api/errors.ts`, `src/services/api/apiClient.ts`, `src/components/common/ErrorBoundary.tsx`, `src/components/common/index.ts`, Teacher Overview và các component overview con, `tests/TeacherOverview.test.tsx`, common primitive Cypress spec.

**Acceptance:** Teacher Overview pilot dùng tokens/primitives; accessibility audit không có serious violation; lỗi chuẩn hóa có requestId/retryable và không lộ raw/stack/payload.

### Stream D — Heavy Tooling Lazy Loading (Task 28)

**Create:** `tests/lazyHeavyImports.test.ts`.

**Modify:** DOCX importer/drawer, PDF export services, worksheet PDF document, result image export, analytics/chart loading boundaries, `config/performance-budget.json` khi legacy exception không còn cần.

**Acceptance:** document/export/chart libraries không nằm initial route; preload chỉ hover/focus CTA; không chunk >500 KB minified; bundle budget đạt.

### Batch 2 Verification

- Targeted RED/GREEN unit and Worker tests per stream.
- Frontend and Workers typecheck, lint, migration/rollback tests.
- Cypress component/E2E related flows.
- Production build and bundle budget.
- Security scan, history scan, policy gates, root/Workers dependency audit.
- MCP diff review and `git diff --check`.

## Batch 7 Execution Record — 2026-07-28

### Task 19 — Low-bandwidth and weak-device resilience

- Added `deviceCapabilities`, `useReducedExperience`, global `ReducedExperienceBanner` and bounded retry primitives. Reduced experience activates for reduced-motion, Save-Data, slow-2g/2g/3g, low device memory, low CPU concurrency or offline state.
- Home dashboard, Quiz List, Gift Shop/Shop Modal, PetDisplay and Dr. Owl avoid mounting remote 3D images or CSS-3D content in reduced mode. CSS-3D pet code is lazy-loaded, visual interaction timers are disabled, and major modal transitions respect reduced-motion.
- Live Exam now restores and debounces answer drafts into session-scoped `sessionStorage`, announces saving/saved/offline/error states through an accessible status region, blocks submission while offline and clears the local draft only after an acknowledged server result.
- Live Exam submit uses a stable idempotency key per unchanged answer snapshot and bounded exponential retry for network, 408, 425, 429 and 5xx failures only. The Worker safely replays an already committed submission when the canonical answer snapshot matches, rejects changed replays with 409 and recovers update races without creating a duplicate. Missing keys remain accepted for one cached-client compatibility release; the new frontend always sends a validated key.
- Added a fail-closed Live Exam preflight for online state, cookies, minimum viewport, `/api/health` and maximum 30-second clock drift. Failed checks are visible and retryable before the quiz component mounts.
- TDD/targeted regression passed **16 files and 106 tests**. Cypress Electron passed **1/1** while simulating Save-Data, 3G, reduced-motion, 1 GB memory and two CPU cores; the student shell remained usable, no `/3D/` element mounted and Resource Timing recorded zero `/3D/` requests.
- Full Vitest passed: **323/323 files and 1,527/1,527 tests**, 504.56 seconds reported by Vitest and 507.15 seconds wrapper time.
- Full lint, frontend typecheck, strict typecheck, Workers typecheck, production build, performance budget, security/history/policy gates and root/Workers production audits passed with zero vulnerabilities. Build transformed 4,459 modules; initial JS gzip 184,160 B, CSS gzip 41,200 B, largest lazy gzip 125,537 B and largest minified chunk 404,881 B.
- MCP diff review returned PASS with no P1/P2/P3 findings. UTF-8 and suspicious-question-mark scans found no encoding regression. No push, merge, deployment, production migration, secret change, production database operation or cloud resource change was performed.

## Batch 6 Execution Record — 2026-07-28

### Task 18 — URL-first teacher and student navigation

- Added canonical teacher and student route mappings, session-aware `ProtectedRoute`, session bootstrap and allowlisted same-role `returnTo` handling. Protected routes wait for teacher/student session restoration before rendering or redirecting; `RootView` no longer mutates navigation state during render.
- Teacher Dashboard tabs, sidebar, mobile navigation, quick actions, result detail, Gift Shop and manual quiz workspace now use canonical URLs. Student dashboard sections, assignments, practice, achievements, reports, Gift Shop and live-exam sessions also use canonical routes.
- Results filters, sorting, date range and pagination are reconstructed from search params. Student assignment pagination uses `?page=`. Live Exam keeps only minimal joined-session metadata in `sessionStorage` so an eligible refresh can restore the route without persisting answers.
- Compatibility mapping remains for one release: legacy teacher tab and quiz-store view can select an initial canonical destination, while URL is the source of truth after navigation. No primary navigation path still calls `setView('teacher_dash')` or `setView('shop')`.
- TDD and targeted regression passed **12 files and 95 tests**. Cypress Electron passed **2/2** for restore-before-guard, deep-link query preservation, Results → Classes → Back restoration and anonymous `returnTo` redirect.
- Full Vitest passed: **314/314 files and 1,498/1,498 tests**, 491.10 seconds reported by Vitest and 493.97 seconds wrapper time.
- Full lint, frontend typecheck, strict typecheck, Workers typecheck, production build, bundle budget, security/history/policy gates and root/Workers production audits passed with zero vulnerabilities. Build transformed 4,452 modules; initial JS gzip 183,212 B, CSS gzip 41,200 B, largest lazy gzip 125,538 B and largest minified chunk 404,881 B.
- GitNexus classified the change as medium risk because it crosses dashboard shells and Results flows; targeted tests and the real-browser route gate cover those paths. MCP diff review returned no P1/P2/P3 findings, and UTF-8/mojibake scan returned zero findings.
- No push, merge, deployment, production migration, secret change, production database operation or cloud resource change was performed.

## Batch 5 Execution Record — 2026-07-28

### Task 17 — Standardized async, stale and offline states

- Added `src/hooks/useOnlineStatus.ts`, global `OfflineBanner`, `DataFreshnessNotice`, expanded `AsyncState`, `tests/AsyncStates.test.tsx` and `cypress/e2e/offline-states.cy.ts`.
- `AsyncState` distinguishes initial loading from refresh-with-data, supports purpose-specific empty states, keeps valid cached content visible during transient failures and announces stale/offline state through accessible status regions.
- Five pilot screens were integrated: Teacher Overview, Results, Classes, Student Dashboard and Parent Portal. Skeletons reserve layout space and use reduced-motion fallbacks; empty states explain the cause and provide an action when one is valid.
- Offline mode keeps downloaded data and local Results exports usable while disabling server-backed actions such as refresh, report delivery, row detail/delete, class mutation, quiz start/review, practice navigation, rewards, live exam, attendance and parent week navigation.
- Protected stale data is discarded after 401/403 in Classes, Results and Parent Portal. Class fetch and mutation paths share the same fail-closed behavior; transient network errors preserve previously authorized cached data.
- TDD evidence: the new async-state suite initially failed because the hook/banner/contracts did not exist, then passed 9/9. Related regression passed 10 files and 79 tests; a focused Classes/Results/security group passed 21/21.
- Cypress Electron passed 1/1 for offline announcement and reconnect removal. GitNexus classified the indexed UI change as medium risk because ResultsTab participates in four result-normalization execution flows; related regression tests covered those flows and MCP diff review returned no findings.
- Full Vitest passed: **311/311 files and 1,479/1,479 tests**, 416.49 seconds reported by Vitest and 418.52 seconds wrapper time.
- Full lint, frontend typecheck, strict typecheck, Workers typecheck, production build, bundle budget, security/history/policy gates and root/Workers production audits passed with zero vulnerabilities. No push, merge, deployment, production migration, secret change or cloud resource operation was performed.

## Batch 4 Execution Record — 2026-07-28

### Task 12 — Local D1 backup and restore rehearsal complete; remote staging pending

- Added `workers/scripts/list-backup-tables.cjs`, `export-d1-tablewise.cjs`, `verify-d1-restore.cjs`, `tests/d1BackupScripts.test.ts` and `docs/operations/d1-backup-restore.md`.
- Table discovery reads `sqlite_master`; regular data export excludes Cloudflare/SQLite system tables, the `rag_chunks_fts` virtual table and all five FTS shadow tables.
- Local isolated persistence is exported directly with streaming `node:sqlite` because Wrangler 4.111 does not support `d1 export --persist-to`. Remote export remains Wrangler-based and requires the explicit pair `--remote --confirm-remote <database>`.
- Backup output is rejected when it resolves inside the repository. The data-only SQL is gzip-compressed, encrypted with AES-256-GCM using an scrypt-derived key, SHA-256 recorded, and plaintext deleted. Passphrases are environment-only and rejected on the command line.
- Restore verification starts from a new isolated persistence directory, applies canonical `schema.sql`, imports regular table data, rebuilds FTS and verifies table/index/trigger fingerprint, all row counts, auth/API database contracts and FTS parity.
- Final rehearsal used linked sample records for teacher, class, student, quiz, question, result and RAG data. It verified 59 regular tables with zero missing tables and zero row-count mismatches; schema, snapshot, FTS and smoke checks all passed.
- Observed local rehearsal: backup **2.135 seconds**, restore **13.57 seconds**, controlled snapshot RPO **0 seconds**. The encrypted archive contained no plaintext SQL marker and the backup directory contained no `.sql` file. All rehearsal artifacts were removed from `%TEMP%` after evidence capture.
- TDD evidence: initial 6/6 failures because the scripts did not exist; final backup suite 10/10 passed. D1 backup/migration/rollback/fresh-bootstrap group passed 4 files and 23 tests.
- Full Vitest passed: **310/310 files and 1,469/1,469 tests**, 398.28 seconds reported by Vitest and 400.18 seconds wrapper time.
- Full lint, frontend typecheck, strict typecheck, Workers typecheck, security/history/policy gates, root/Workers dependency audits, production build and performance budget passed.
- Still open by design: create a separate remote staging D1 database, capture a Time Travel bookmark/restore, run authenticated HTTP smoke and record staging RPO/RTO. No remote D1, production database, secret, deployment or cloud resource was changed in this batch.

## Batch 3 Execution Record — 2026-07-28

### Final verification

- Full Vitest passed: **309/309 files and 1,459/1,459 tests**, 416.01 seconds reported by Vitest and 418.17 seconds wrapper time.
- ESLint, frontend typecheck and Workers typecheck passed.
- Security scan, reachable-history secret scan, CSP/CORS/browser-auth/migration policy gates and root/Workers production dependency audits passed with zero vulnerabilities.
- Production build passed after transforming 4,447 modules; every emitted chunk remained below the 500 KB minified budget.
- The four baseline assertion drifts were aligned. The fresh canonical D1 schema now includes the two AI Tutor quota tables introduced by migration `0044`, preventing new databases from missing those tables.
- The first enforce-mode full regression exposed seven stale Bearer fixtures in Smart Assignment and Weakness Profile. They were converted to current cookie JWT fixtures, their targeted 9/9 tests passed, and the full suite then passed.
- Batch 3 work was committed in separate recovery points. No push, merge, production deployment, production migration, secret change or production database operation was performed.
- Task 10 remains intentionally open until real production evidence proves zero accepted legacy traffic for 72 continuous hours and a later 48-hour enforce stability window supports deleting the compatibility path.

### Task 10 — Cookie enforcement implementation complete; production observation pending

- Checked-in Worker defaults now use `AUTH_MIGRATION_MODE="enforce"` and cookie transport; no deployment or secret change was performed.
- Enforce mode rejects Bearer transport and JWTs missing issuer, audience or `tokenVersion`; student login now issues `tokenVersion: 0`.
- Compat mode remains behind the explicit rollback flag and emits `auth_legacy_session_accepted` metadata without token, username, payload, body or query string.
- TDD evidence: the migration suite first failed 5 assertions for config, Bearer enforcement, student token version and telemetry, then all 5 files/22 tests passed.
- Workers typecheck and targeted lint passed. Runbook: `docs/deployment/auth-cookie-enforcement.md`.
- MCP review's console heuristic was accepted for the required structured migration metric; its exact schema is tested to exclude token and username values.
- Still open: 72-hour zero-legacy production evidence and the later 48-hour stable-window removal of the compat code path.

### Task 3 — Authorization matrix enforced

- Added the executable route registry in `workers/src/security/apiAuthorizationPolicy.ts` and kept `workers/src/middleware/auth.ts` fail-closed.
- Added `docs/security/api-authorization-matrix.md` covering route class, role boundary, ownership keys and enforcement owner.
- TDD evidence: the new matrix suite first failed 16/18 assertions before the registry existed, then passed 18/18.
- Authorization/IDOR verification: 6 files and 59 tests passed for matrix plus `studentId`, `quizId`, `resultId`, `classId` and `batchId` abuse coverage.
- Middleware/router regression verification: 3 files and 36 tests passed; Workers typecheck and targeted lint passed.

### Task 1 — Baseline locked

- Provenance locked at integration commit `828d8c1223aa3d448fed029feb114394fb502b1d`, with merge base `4b561e898f997cb1ae10a63a2f5a595e7e645cd8`.
- Root and integration-worktree status were captured without modifying the pre-existing root changes.
- Root/Workers install, lint, both typechecks, security gates and production build passed.
- Full Vitest baseline: 304/307 files and 1,432/1,436 tests passed; four stale assertions were recorded in the baseline report for alignment before the Batch 3 final gate.
- Build baseline: 4,447 modules, 36.36-second Vite build, 261,135 B CSS minified/41,649 B gzip and 12 JavaScript chunks over 100 KB minified; no chunk exceeded 500 KB.
- Report: `docs/audits/2026-07-28-modernization-baseline.md`.

## Batch 2 Execution Record — 2026-07-28

**Completed:** Tasks 4, 5, 6, 9, 11, 13, 14, 16 and 28.

**Verification evidence:**

- Vitest: 21 files, 81 tests passed.
- Cypress component: 2 specs, 3 tests passed; desktop/mobile layout screenshots and real-browser Axe audit passed with no serious/critical violations.
- Lint, frontend typecheck, Workers typecheck and production build passed.
- Bundle budget passed without allowlist: initial JS gzip 173,959 B; CSS gzip 41,649 B; largest lazy gzip 125,536 B; largest minified chunk 404,881 B.
- DOCX importer entry chunk reduced from approximately 504,897 B to 3,029 B; JSZip isolated to a 97,116 B lazy vendor chunk.
- Security scan checked 1,728 tracked/unignored files; Git-history scan, CSP/CORS/browser-auth/rollback policy gates and root/Workers production dependency audits passed with zero vulnerabilities.
- `git diff --check` passed and changed-file mojibake scan returned zero findings.
- MCP diff review returned no P1 finding; its single console heuristic was reviewed as the required structured metadata log and contains no prompt, provider output or PII.
- Playwright frontend smoke returned HTTP 200 with no JavaScript page error and no horizontal overflow.

**Environment limitation:** local Cloudflare Worker smoke could not start on Windows because `workerd` terminated at runtime with `std::terminate`; Worker route/unit tests and Workers typecheck passed. No production deployment or migration was performed.

## Explicitly blocked in this execution batch

Tasks requiring production observation, auth enforce observation window, D1 production restore rehearsal, branch-protection settings, staged rollout, passkey rollout, real email delivery or production data cleanup remain unchecked until their acceptance evidence exists.
