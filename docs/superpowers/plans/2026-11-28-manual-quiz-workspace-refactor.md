# Kế hoạch refactor Manual Quiz Workspace

## Mục tiêu và nguyên tắc

Tại baseline đã kiểm tra, `src/features/manual-quiz-workspace/ManualQuizWorkspacePage.tsx` có 720 dòng và đang điều phối bootstrap route/auth, quyền chỉnh sửa, tải quiz, phục hồi draft local/remote, navigation, focus editor, preview, publish, versioning và bảy drawer/dialog. Mục tiêu là tách trách nhiệm để dễ kiểm thử và bảo trì nhưng giữ nguyên behavior, UI, API, draft schema, telemetry, auth và Worker contract.

Đợt này gồm ba phase, mỗi phase là một PR/branch độc lập để rollback riêng:

1. Bootstrap quyền truy cập, hydrate quiz và tạo version.
2. Remote/local draft recovery và initialization.
3. Navigation, guard, focus editor, preview và publish boundary.

Mỗi phase bắt đầu từ `origin/main` mới nhất sau khi phase trước merge. Không gộp cả ba phase vào một PR.

Baseline đã kiểm tra là `origin/main` tại `1e0451bfc706697cb647ae4a8cb4f1190e5faffa`. Worktree lập plan là `C:\Users\Administrator\.codex\worktrees\plan-manual-quiz-workspace-refactor\quizpro`, branch `codex/plan-manual-quiz-workspace-refactor`. Local `C:\quizpro` đang dirty phải được giữ nguyên.

Các hook hiện có tiếp tục được giữ nguyên ở bước đầu: `useManualQuizAutosave`, `useManualQuizPublish`, `useWorkspaceKeyboardShortcuts`, `useQuestionEditSession`, `useDraftConflictResolution`. Store chính là `useManualQuizWorkspaceStore`; service là `getQuizEditorPayload`, `createQuizVersion`, `getRemoteManualQuizDraft`; draft repository là `manualQuizDraftRepository`.

## Behavior invariants

- Giữ ý nghĩa và giá trị của `quizId`, `draftId`, `ownerUsername`, `revision`, `schemaVersion`, `selectedQuestionId`, `targetPoints`.
- Đề mới dùng seed; đề sửa dùng quiz từ editor payload. Việc initialize lặp, nếu có, phải được characterization trên page gốc; không hứa thêm một StrictMode guarantee trong refactor này.
- Readonly chỉ đến từ `editability.mode`; client không tự mở rộng quyền.
- Characterize response access/draft cũ sau khi đổi route hoặc user trên page gốc; không tự thêm reset hoặc cross-user guard mới trong refactor. Khoảng trống behavior thật là scope sửa lỗi riêng.
- `requestedDraftId` remote được ưu tiên; remote error vẫn hiện lỗi và fallback đúng behavior hiện tại.
- Local draft chỉ mở recovery dialog khi mới hơn `workspaceStartedAt`; discard xóa đúng draft.
- Navigation, preview, settings, validation và header back giữ số lần gọi guard hiện tại; các thao tác chuyển view thường có một guard, còn `requestPublish` phải giữ cả guard lúc click và guard thứ hai trong confirmation của published warning nếu page gốc đang làm vậy.
- Flush lỗi giữ nguyên view/selection và nội dung đang gõ.
- Lazy focus không cướp focus người dùng; readonly chỉ preview, không publish.
- Publish vẫn flush, chờ timeout 0/store update như hiện tại, snapshot đúng envelope và gửi một request.
- Version creation vẫn reset workspace sau success, navigate `replace: true`, refresh catalog best effort.
- Không đổi endpoint, request/response, auth, draft schema, telemetry event, Worker, D1, migration, secret, config hoặc flag.

## Phase 1 — access, hydrate và version

### Phạm vi

Tách access payload và version action; chưa tách draft recovery, navigation hay focus.

Tạo `src/features/manual-quiz-workspace/hooks/useManualQuizEditorAccess.ts`:

```ts
interface UseManualQuizEditorAccessOptions {
  quizId?: string;
  username: string | null;
  onEditorAccessErrorChange: (message: string) => void;
}
interface ManualQuizEditorAccess {
  editability: QuizEditorEditability | null;
  editorAccessStatus: 'loading' | 'loaded' | 'error';
}
```

Tạo độc lập `src/features/manual-quiz-workspace/hooks/useManualQuizWorkspaceVersionAction.ts`. Hook nhận `quizId`, title snapshot, `guardTransition`, `navigate`, `loadQuizzes` và callback lỗi chung do page sở hữu; hook chỉ sở hữu `isCreatingVersion` và `createVersion()`. `editorAccessError` vẫn là state hiển thị chung của page: access hook và version action báo lỗi qua callback/setter cùng một owner, không tạo state lỗi thứ hai hoặc làm mất lỗi access khi version action chạy. Page gọi access trước, tạo guard facade ổn định, rồi truyền facade vào version action. Access hook không import version hook; version hook không import navigation/access hook; không tạo singleton lifecycle hoặc global reset mới.

Access hook phải giữ cleanup và response behavior của page gốc, normalize questions bằng helper hiện tại, merge `useQuizStore` theo cùng quy tắc và giữ nguyên readonly/error state. Nếu characterization chứng minh page gốc có stale response gap thì không tự sửa trong refactor. Version action gọi `createQuizVersion`, reset store sau success, navigate replace, refresh catalog best effort, báo lỗi qua callback chung và reset `isCreatingVersion` trong `finally`. State này không được gọi là mutex mới: repeated calls/double click phải được đo theo behavior gốc, không tự hứa thêm concurrency guarantee. Catalog refresh lỗi không làm version đã tạo thất bại.

### Files

Mới:

- `src/features/manual-quiz-workspace/hooks/useManualQuizEditorAccess.ts`
- `src/features/manual-quiz-workspace/hooks/useManualQuizWorkspaceVersionAction.ts`
- `tests/ManualQuizWorkspaceAccessLifecycle.test.tsx` (characterization page gốc trước khi tách, sau đó giữ làm parity)
- `tests/ManualQuizWorkspaceVersionLifecycle.test.tsx`
- `docs/superpowers/plans/2026-11-28-manual-quiz-workspace-refactor.md` (plan traceability; documentation-only)

Sửa:

- `src/features/manual-quiz-workspace/ManualQuizWorkspacePage.tsx`

Giữ nguyên autosave, publish, conflict resolver, store implementation và service contracts.

Nếu phải sửa test/Cypress hiện có, chỉ được sửa access/route test và các lifecycle test mới trong phase này; file ngoài danh sách cần approval bổ sung.

### Tests/acceptance

Mount page gốc trước khi hook tồn tại để ghi nhận access/version lifecycle: success/normalize, readonly, rejection/network error, response sau đổi route/user, shared error display, version success/reset/navigation, catalog refresh failure, retry sau reject và repeated calls. Sau extraction chạy lại cùng parity tests; không biến observed behavior thành guarantee mới. Behavior bug thật phải dừng phase và lập RED→GREEN/approval riêng.

## Phase 2 — draft recovery và initialization

### Phạm vi

Tạo `src/features/manual-quiz-workspace/hooks/useManualQuizWorkspaceRecovery.ts` để sở hữu `pendingRecovery`, remote status/error, recovery checked, `continueRecoveredDraft()` và `discardRecoveredDraft()`. Hook nhận username, quizId, availableQuiz, seed, `workspaceStartedAt`, `requestedDraftId`, `isReadOnly`, `editorAccessStatus`, envelope/status và actions hydrate/initialize.

Giữ đúng precedence:

1. Chờ access khi edit route.
2. Có `requestedDraftId` thì tải remote bằng `AbortController`.
3. Readonly không hydrate draft editable.
4. Remote error hiện lỗi và fallback an toàn.
5. Chưa có envelope thì tìm local draft cùng user/quiz.
6. Chỉ mở dialog nếu local `updatedAt` mới hơn entry.
7. Continue hydrate đúng metadata; discard xóa đúng draft rồi initialize quiz/seed.
8. Không có draft thì initialize quiz hoặc seed theo đúng behavior page gốc; repeated initialization phải được characterization, không thêm guarantee mới.

Các effect giữ cleanup, dependency và guard của page gốc; characterization ghi nhận abort, unmount, route/user change và repeated initialization trước khi tách. Không tự thêm identity check, reset hoặc cross-user guard mới. Không đưa store object gây effect lặp vào dependency; nếu cần đổi dependency phải có parity evidence.

### Files

Mới:

- `src/features/manual-quiz-workspace/hooks/useManualQuizWorkspaceRecovery.ts`
- `tests/ManualQuizWorkspaceRecoveryLifecycle.test.tsx` (characterization page gốc trước khi tách, sau đó giữ làm parity)
- `docs/superpowers/plans/2026-11-28-manual-quiz-workspace-refactor.md` (plan traceability; documentation-only)

Sửa: `ManualQuizWorkspacePage.tsx`. Giữ nguyên `manualQuizDraftRepository`, `manualQuizDraftService`, autosave và conflict resolver.

Nếu phải sửa test/Cypress hiện có, chỉ được sửa các file recovery/route/conflict đã nêu trong phase này; mọi file ngoài danh sách cần approval bổ sung.

### Tests/acceptance

Mount page gốc để characterize remote success đủ revision/metadata, abort/unmount/route change, remote error, readonly, local newer/older, continue/discard và đổi username/quiz. Chỉ giữ assertion về StrictMode hoặc cross-user nếu page gốc thực sự đã có behavior đó; không thêm reset/guard để đạt expectation mới. Reuse `ManualQuizDraftRecovery`, `ManualQuizWorkspaceConflictNavigation`, `ManualQuizWorkspaceRoute`; chỉ thêm assertion gap.

## Phase 3 — navigation, guard, focus, preview, publish

### Phạm vi

Tạo `src/features/manual-quiz-workspace/hooks/useManualQuizWorkspaceNavigation.ts`; chỉ tạo `useManualQuizEditorFocus.ts` nếu review thấy navigation hook quá lớn. Hook có thể sở hữu `workspaceView`, `previewQuestion`, `lastEditedQuestionId` và `pendingEditorFocus` cùng callbacks liên quan. `questionEditorRef` vẫn stable ref do page sở hữu; `guardTransition` vẫn do page sở hữu; autosave/publish vẫn do hook hiện có sở hữu. Hook nhận editor ref, envelope/store actions, `isReadOnly`, selected question, guard callback, navigate, publish controller và editability; trả callbacks cho open/edit/add, overview/edit/preview/back, move/finish, pending focus/ready và request publish.

Hook navigation không gọi access/version hook. Guard facade do page sở hữu và truyền xuống như callback ổn định. Thứ tự hook là access → version → autosave/publish → recovery → navigation; không có chu kỳ import hay lifecycle dùng chung.

Giữ synchronous flush trước mọi navigation; không thêm hoặc bỏ guard so với page gốc. `requestPublish` phải giữ guard lúc click và guard thứ hai trong confirmation của published warning. Flush failure chặn chuyển; preview lấy `getPreviewQuestion()` mới nhất; `serverResolutionVersion` vẫn đồng bộ accepted-server preview; lazy ready chỉ focus khi selection còn đúng và user chưa đổi focus; Escape/Save vẫn qua keyboard hook; readonly không publish; publish timeout 0 và số request hiện tại; back không reset/mất draft.

### Files

Mới:

- `src/features/manual-quiz-workspace/hooks/useManualQuizWorkspaceNavigation.ts`
- `tests/ManualQuizWorkspaceNavigationParity.test.tsx` (characterization page gốc trước khi tách, sau đó giữ làm parity)
- `src/features/manual-quiz-workspace/hooks/useManualQuizEditorFocus.ts` chỉ khi được duyệt trong review.
- `docs/superpowers/plans/2026-11-28-manual-quiz-workspace-refactor.md` (plan traceability; documentation-only)

Sửa: `ManualQuizWorkspacePage.tsx`. Giữ nguyên `QuestionEditorPane`, `QuestionNavigator`, `StudentPreviewPane`, `WorkspaceHeader`, `useWorkspaceKeyboardShortcuts` nếu không có regression bắt buộc.

Nếu phải sửa test/Cypress hiện có, chỉ được sửa các file focus/navigation/accessibility/publish/responsive đã nêu trong phase này và `cypress/e2e/manual-quiz-workspace.cy.ts`; file ngoài danh sách cần approval bổ sung.

### Tests/acceptance

Mount page gốc để characterize overview/edit/preview round trip, previous/next bounds, flush failure, add-question focus, validation issue focus, lazy no-focus-steal, Escape ordering, readonly preview, published confirm với hai guard hiện tại, one publish request với title/time/question/points, `serverResolutionVersion` accepted-server preview, Enter/Shift+Enter rich text, MCQ/punctuation và viewport 320/768/1024/1440 không overflow. Chạy cùng parity sau extraction.

Reuse các suite hiện có: LazyFocus (8 cases), Accessibility (9), ConflictNavigation (2), Publish (7), Route (6), Responsive/Layout và Cypress `manual-quiz-workspace.cy.ts`; không nhân bản characterization đã đủ.

## GitNexus, TDD và verification

Plan hiện tại là docs-only: GitNexus impact, detect_changes, TDD và tests là N/A vì chưa có executable edit, chưa commit. Trước mỗi implementation phase, refresh GitNexus nếu stale; chạy `impact` upstream cho page, effect/callback và exported hook sẽ sửa; dùng `context`/`query` kiểm callers/callees. HIGH/CRITICAL phải dừng và báo user, không tự hạ risk. Sau sửa chạy `detect_changes({scope: "compare", base_ref: "main"})`, kiểm symbols/flows đúng scope và xử lý P1/P2.

Đây là refactor behavior-preserving: chạy characterization GREEN trước tách, không tạo RED nhân tạo. RED→GREEN chỉ cho regression thật và cần approval riêng.

Sau từng phase chạy focused Vitest bằng lệnh nền `npx vitest run tests/ManualQuizWorkspaceAccess.test.tsx tests/ManualQuizDraftRecovery.test.tsx tests/ManualQuizWorkspaceConflictNavigation.test.tsx tests/ManualQuizWorkspaceLazyFocus.test.tsx tests/ManualQuizWorkspaceAccessibility.test.tsx tests/ManualQuizWorkspaceRoute.test.tsx tests/useManualQuizAutosave.test.tsx tests/useManualQuizPublish.test.tsx` cộng với test phase mới tương ứng (`ManualQuizWorkspaceAccessLifecycle`, `ManualQuizWorkspaceVersionLifecycle`, `ManualQuizWorkspaceRecoveryLifecycle` hoặc `ManualQuizWorkspaceNavigationParity`). Chạy Cypress bằng `npx cypress run --e2e --spec cypress/e2e/manual-quiz-workspace.cy.ts`, rồi `npm run lint`, `npm run typecheck`, `npm run typecheck:strict`, `npm run typecheck:workers`, `npm run build`, `npm run perf:budget`, security scan/history/policies theo CI, `npm run verify` và `npm run cypress:run:stubbed`. Ghi đúng exit/log nếu verify gặp fixture Windows; không gọi PASS khi exit khác 0. Kiểm `git diff --check`, không thêm `.only/.skip`, review diff và detect trước commit.

Browser fixture phải chặn write ngoài allowlist, không dùng assignment thật. Production smoke chỉ read-only/public hoặc fixture reviewed; không gửi answer/result, không migration và không deploy Worker.

## Delivery và rollback

Mỗi phase: inspect và finalize phase plan → user duyệt implementation plan → tạo worktree/branch từ main mới nhất → refresh GitNexus/impact và dừng nếu HIGH/CRITICAL → characterization page gốc → tách nhỏ nhất → focused/full verification → review/detect → trình exact files/risk/evidence → final commit-scope approval riêng → commit/push/PR → CI/Security/Release readiness/code-owner approval đúng HEAD → guarded merge → frontend SHA + smoke → cleanup riêng phase. Không reset/clean/fast-forward `C:\quizpro` dirty main.

Rollback là revert PR/merge commit của phase; không reset branch dùng chung. Không có D1 migration, Worker deploy, secret, config hay feature flag.

## Checklist delivery và nhắc mục 3 sau khi hoàn tất mục 1

- [x] Phase 1 đã merge và frontend production smoke đạt.
- [x] Phase 2 đã merge và frontend production smoke đạt.
- [ ] Phase 3 đã merge và frontend production smoke đạt.
- [ ] CI, Security, Release readiness và code-owner review đã xanh trên từng HEAD.
- [ ] Sau phase 3 đã cleanup đúng worktree/branch, giữ nguyên dirty main.

Mục 1 chỉ hoàn tất khi tất cả checklist trên đạt. Không gộp `useQuizGeneration` vào đợt này.

Ngay sau khi checklist hoàn tất, phải nhắc user mời lập một plan độc lập cho mục 3: `workers/src/services/interventionService.ts`. Phase đầu của mục 3 chỉ tách pure intervention suggestion/readiness model: readiness helpers, four-week trend, evidence và recommendation ranking. Giữ nguyên D1 queries, authorization, group/note persistence, assignment idempotency và Worker contract. Chưa gán risk chính thức LOW/MEDIUM cho mục 3 trước khi refresh GitNexus/impact; phải characterization từ các test intervention trước sửa. Việc implementation, commit/PR, deploy và approval của mục 3 vẫn là scope riêng. Không trộn mục 3 với `useQuizGeneration` hoặc persistence.

## Giới hạn

Trạng thái khi lập plan ban đầu là planning-only. User đã duyệt triển khai sau đó; xem mục Tiến độ đợt 1 cho bằng chứng và trạng thái mới nhất. Implementation cần user duyệt plan trước khi code; final commit-scope approval là gate riêng sau verification. GitNexus chưa refresh trên baseline mới nên blast radius chính thức chỉ có ở pre-change. Nếu verify local gặp dependency-audit fixture lỗi Windows, phải ghi đúng bằng chứng. Không xóa artifact/dependency task khác. Nếu phát hiện behavior bug, lập scope RED→GREEN riêng.

## Tiến độ đợt 1 (snapshot trước commit)

- User đã duyệt triển khai plan; chưa duyệt commit/push của đợt 1.
- Worktree triển khai riêng: `C:\Users\Administrator\.codex\worktrees\refactor-manual-quiz-access-version\quizpro`; branch `codex/refactor-manual-quiz-access-version`; baseline `1e0451bfc706697cb647ae4a8cb4f1190e5faffa`.
- npm ci root/Worker đã hoàn tất theo lockfile. Không dùng junction; không sửa dependency/lockfile.
- GitNexus index mới: 27.588 nodes, 55.960 edges, 300 flows. Exact UID page LOW/0 direct; handleCreateVersion LOW/1 direct (page); lazy entry LOW/3 upstream (AppRoutes/MainApp/App), 0 flow được đánh dấu. Full-text search không khả dụng; kết quả graph phải bổ sung bằng đọc mã và diff.
- Baseline regression: 10 file/48 test PASS, exit 0. Chưa tách mã nguồn; đang viết characterization trên page gốc.
- Cypress baseline lần đầu exit 20 do khởi động Vite trực tiếp bỏ qua predev chuẩn bị MathJax. Đã giữ log, chuyển sang npm run dev; asset MathJax trả 200. Lượt đúng môi trường đang chạy, chưa coi là PASS trước exit cuối.
- Bằng chứng và progress: `C:\Users\Administrator\.codex\artifacts\manual-quiz-access-version-1e0451b`.
- Characterization cuối: 2 file/14 test PASS trên source gốc, bao gồm ưu tiên title envelope khác catalog và fallback title rỗng tự nhiên. Lượt đầu 13 PASS/1 lỗi giả định test đã được giữ riêng; chỉ chỉnh test, không đổi nghiệp vụ.
- Baseline browser đúng môi trường đã hoàn tất: 20/20 PASS, exit 0, không skip/pending. Đã dừng dev server trước các lượt index tiếp theo.
- Đã cho phép worker tách đúng page + 2 hook của phase 1; test và scope khác giữ nguyên.
- Source cuối: chỉ tách access và version action; diff page 18 dòng thêm/62 dòng bỏ. AST parity: 23 handler còn lại, các effect ngoài access và JSX đều khớp baseline.
- Focused sau tách: 12 suite/62 test PASS, exit 0 (log worker đã đọc và lưu ngoài worktree). Root đã hủy lượt focused trùng sau khi xác minh log worker; không dùng lượt bị hủy làm bằng chứng PASS.
- Review độc lập: không còn P1/P2. Effect access đăng ký sớm hơn autosave nhưng response đi qua Promise, không có synchronous store mutation lúc bắt đầu request; giữ contract và side effects hiện tại. UI busy được test; không thêm guarantee gọi programmatic đồng thời.
- Index incremental từng gán nhầm symbol SEO vào diff page. Đã đối chiếu SEO không đổi và dựng lại index force: 27.642 nodes, 56.048 edges, 300 flows; detect compare chỉ page, LOW/0 flow. Hai hook mới đều LOW/1 direct caller. FTS vẫn không khả dụng; staged detect đủ scope thực hiện sau approval, trước commit.
- Lint và typecheck frontend/strict/Worker đã PASS trong npm run verify; full unit đang chạy. Audit production root/Worker đều 0; audit toàn cây khi npm ci có 36 finding root và 4 high Worker thuộc scope dependency chưa sửa, không tuyên bố toàn cây sạch.
- Full verify gốc exit 1 ở shard 3: hai ca clean/findings của dependencyAuditReport.test.ts nhận exit 2 thay vì 0/1. File test và script audit không đổi so baseline. Không coi npm run verify gốc là PASS; chưa chốt nguyên nhân runner context.
- Shard 1: 181 file/1.060 test PASS; shard 2: 180/1.013 PASS; shard 3: 179 file/1.109 PASS và 2 fail audit fixture; shard 4 chạy trực tiếp: 180/1.103 PASS. Cùng audit fixture chạy trực tiếp Node/Vitest đạt 28/28; tổng 4.287 test khác nhau/721 file đã PASS qua các lượt (không cộng trùng 26 ca audit).
- Coverage gate hiện có PASS (schemas/utils: statement 88,32%, branch 62,12%, function 94,73%, line 89,38%). Build PASS 32,16 giây; performance PASS, initial JS gzip 169.254 byte, CSS 48.322 byte, không đổi ngưỡng. Security scan/history/policies và enforce production audits root/Worker đều PASS.
- Browser focused cuối và toàn bộ script stubbed đang chạy trên source cuối, official npm run dev/predev; API proxy chỉ local, chưa production write/deploy.
- Browser focused cuối: 20/20 PASS, exit 0. Toàn bộ script stubbed: 13 spec/78 ca PASS, exit 0, 6 phút 7 giây, không fail/skip/pending. Đã dừng dev server của task sau kiểm thử.
- Phạm vi cuối đúng 6 file của phase 1. Không có P1/P2 sau review độc lập; source ngoài phạm vi không đổi. Báo cáo và manifest được lưu ngoài worktree để duyệt cuối; chưa stage/commit/push/PR. Approval triển khai plan được giữ nguyên; gate phạm vi cuối trước commit là riêng theo AGENTS.md mục 6.

## Tiến độ đợt 2 (snapshot trước commit)

- User đã duyệt triển khai toàn bộ plan và yêu cầu tiếp tục sau CI; không hỏi lại approval triển khai khi scope không đổi. Gate duyệt phạm vi cuối trước commit/push của đợt 2 vẫn riêng.
- Đợt 1 đã bàn giao: PR #215, approved HEAD bc382472af24c1d54659355e73b9c1a9732b0ea3; merge 460c5cc6673a66cb286c2f8925e86aea91719633. CI, Security, cả 5 Release readiness gate, production SHA/static assets 200, public smoke10/auth14/public browser3 PASS. Worktree/branch đợt1 đã dọn; dirty main giữ nguyên. Không deploy Worker/migration.
- Đợt 2 dùng worktree `C:\Users\Administrator\.codex\worktrees\refactor-manual-quiz-workspace-recovery\quizpro`, branch `codex/refactor-manual-quiz-workspace-recovery`, baseline `460c5cc6673a66cb286c2f8925e86aea91719633`.
- Phạm vi dự kiến đúng 4 file: page, hook useManualQuizWorkspaceRecovery.ts mới, ManualQuizWorkspaceRecoveryLifecycle.test.tsx mới, và plan này. Không sửa hook access/version/autosave/publish hoặc store/service implementation.
- npm ci root/Worker hoàn tất theo lockfile. Baseline regression 12 suite/62 test PASS, exit 0. Baseline browser trên cùng merged SHA được xác minh bởi Release readiness đợt1: workspace20/fullstubbed78 PASS.
- GitNexus fresh: 27.642 nodes/56.048 edges/300 flows. Exact UID page, continueRecoveredDraft, discardRecoveredDraft đều LOW/0 static direct caller/0 affected flow. Hai prop callback trong DraftRecoveryDialog được đọc trực tiếp vì graph không biểu diễn đầy đủ binding JSX. FTS không khả dụng; bổ sung actual diff/AST/manual review.
- Đã cho worker viết characterization trên page gốc; chưa cho tách hook trước khi baseline mới GREEN. Bằng chứng đợt2 nằm tại `C:\Users\Administrator\.codex\artifacts\manual-quiz-recovery-460c5cc`.
- Characterization mới: 1 file/12 ca PASS trên page gốc, exit 0; lint test PASS. Root phát hiện và sửa gap test readonly thiếu draftId; baseline mới có query đúng. Hành vi gốc readonly + requestedDraftId: không GET draft, không prompt local, envelope vẫn null do guard requestedDraftId/status; phải giữ nguyên, không gộp sửa UX vào refactor. Readonly không query vẫn được init từ quiz theo các test cũ.
- Lượt fixture đầu có một expectation timestamp sai (entry trước draft nên draft thực tế mới hơn); chỉ sửa fixture, log được giữ riêng. Không sửa source để ép test PASS.
- Root đã cho phép worker tách đúng page + hook recovery; các test còn lại và source ngoài scope giữ nguyên. Verification toàn dự án do root chạy sau source freeze để tránh trùng.
- Source đợt2 đã freeze: chỉ page + hook recovery. Root/independent reviewer không còn P1/P2; moved remote/local effect và continue/discard body khớp baseline sau parameterization workspaceStartedAt; 21 handler/6 effect còn lại và JSX giữ nguyên.
- Focused sau tách: 13 suite/74 test PASS, exit0. Final force index 27.666 nodes/56.085 edges/300 flows; hook mới LOW/1 direct caller/0 flow. Compare tracked page+plan: LOW/0 flow; staged fullscope sau approval trước commit.
- Lint và typecheck frontend/strict/Worker đã qua trong npm run verify; full unit đang chạy trên snapshot source cuối. Chưa stage/commit/push đợt2.
- Verification cuối: npm run verify gốc exit1 ở hai ca CLI audit fixture không đổi của shard3; không gọi lượt này PASS. Shard1 181file/1.060test PASS; shard2 181/1.018 PASS; shard3 179file/1.116test PASS và 2 fail; shard4 direct 180/1.103 PASS. Audit fixture direct Node/Vitest28/28 PASS, bổ sung đúng2ca thiếu, tổng 4.299 test khác nhau/722file đã PASS qua các lượt.
- Coverage gate hiện có PASS7suite/56test (schemas/utils: statement88,32%, branch62,12%, function94,73%, line89,38%). Build36,17s PASS; performance PASS initialJSgzip169.259byte/CSS48.322byte, ngưỡng giữ nguyên. Securityscan/history/policies và enforced productionaudits root/Worker0 PASS; development findings khi npm ci không nằm trong scope sửa.
- Browser focused cuối20/20 PASS trên official npm run dev/predev; toàn bộ13spec stubbed đang chạy. Source hash giữ nguyên từ snapshot đã kiểm thử; chưa stage/commit/push.
- Browser cuối: focused20/20 PASS exit0; fullstubbed13spec/78ca PASS exit0 trong6phút40giây, không fail/skip/pending. Đã yêu cầu dừng dev server riêng sau kiểm thử. Final scope4file, chưa stage/commit/push; chờ gate duyệt phạm vi cuối theo AGENTS.md mục6.

## Tiến độ đợt 3 (snapshot trước commit)

- Đợt 2 đã merge PR #216 tại dc7b71d1ee1d028dcc7b5986b46453a0a5220aa5 sau owner approve đúng HEAD6b995f5; CI/Security/Release readiness5gate trên main PASS. Production8125064662 success, www entry có đúng fullSHA; workspace chunk/MathJax200. Read-only smoke46112317968 success; rollout writes skipped, không Worker/migration.
- User đã duyệt triển khai toàn bộ plan; gate commit-scope đợt3 vẫn riêng. Worktree codex/refactor-manual-quiz-workspace-navigation từ dc7b71d, exactscope4file: page, navigation hook mới, navigation parity test mới, plan.
- Giữ workspaceView/setWorkspaceView tại page vì closeActiveSurface/keyboard hook đứng trước recovery và phụ thuộc view. Navigation hook được gọi tại vị trí focusQuestionEditor gốc sau recovery, sở hữu previewQuestion/lastEditedQuestionId/pendingEditorFocusRef và callbacks/effects liên quan. Không tạo useManualQuizEditorFocus riêng, không đổi JSX hay thứ tự đăng ký effect/keyboard. questionEditorRef, guardTransition/runGuarded và publishAfterGuard ở page.
- npm ci root/Worker theo đúng lockfile, exit0, không junction/dependency changes. Index fresh27.670nodes/56.085edges/300flows; FTS unavailable. Impact page và12symbol dự kiến tách đều LOW, max4directcallers focusQuestionEditor, 0affectedflows. Bổ sung đọc thủ công JSX/callback wiring và source parity.
- Baseline13suite/74test PASS trên page gốc, exit0. Worker đang bổ sung characterization gap trước extraction; chưa sửa production. Bằng chứng tại C:/Users/Administrator/.codex/artifacts/manual-quiz-navigation-dc7b71d.
- Characterization cuối trên page gốc8/8PASS + targetedlintPASS, đã rootreview và siết guard/selection/headerpreview/publishconfirmation assertions; initialtestAPI/assumptionfailures giữlog riêng. Fixturetyped đầyđủ QuizEditorEditability. Root đã cho worker tách đúngpage+hook navigation; test/plan ngoài scope worker được giữ nguyên.
- Source cuối: 11callback bodies sau parameterization, 10handler ngoài scope, 4nav effect/2page effect và toàn bộ JSX khớp baseline. Dependency arrays chỉ thêm parentReactsetters ổn định và parameterize warning property. Root + review độc lập không còn P1/P2. Focused14suite/82testPASS exit0.
- Finalforceindex27.691nodes/56.094edges/300flows; hook mớiLOW/1directcaller(page)/0affectedflow. Comparetrackedpage+plan2file/6symbolLOW/0flow; newfiles đã indexed/impact riêng, stagedfullscope sauapproval trướccommit. FTS unavailable, đã bổ sung actualdiff/JSXreview.
- Lint và typecheckfrontend/strict/WorkerPASS. Verifygốc exit1 ở2auditCLI fixture không đổi trong shard3: shard1 181file/1.066testPASS; shard2 181/1.015PASS; shard3 180file/1.121testPASS +2fail. AuditdirectNode/Vitest28/28PASS; audit script/test khớp baseline. Không suppress, không sửa audit ngoài scope, chưa chốt nguyên nhân runnercontext. Shard4 đang chạy bổ sung.
- Shard4direct180file/1.103testPASS exit0; tổng4.307test khácnhau/723file đã PASS qua các lượt, chỉ bổ sung2ca audit thiếu, không cộng trùng26ca audit. Lượtverifygốc vẫn exit1.
- Coveragegate hiệncó7suite/56testPASS (schemas/utils statement88,32%, branch62,12%, function94,73%, line89,38%). Build28,94sPASS; performancePASS initialJSgzip169.249byte/CSS48.322byte, ngưỡng giữ nguyên. Securityscan/history/policies và enforcedproductionaudits root/Worker0PASS.
- Browser đầu19/20, mobile320 gặp ReactcommitRoot "Cannot commit the same tree as before" qua $Cypress.pause; đây là runtimeexception, không phải assertionoverflow. Đã giữlog/ảnh. So sánh coldoriginalpage20/20PASS, rồi khôi phụcsource đợt3 byte-for-byte và xác minh3functionalhash khớp snapshot; coldcurrent20/20PASS. Không đổi dependency/test/exceptionhandler/retry để ép xanh; chưa xác định nguyên nhân, không kết luận refactor hoặc Cypress là nguyên nhân. Fullstubbed13spec đang chạy.
- Browser cuối: focused20/20PASS exit0; fullstubbed13spec/78caPASS exit0 trong6phút40giây, không fail/skip/pending; workspace20/20 và mobile320 cũng PASS trong fullrun. FirstReactexception vẫn giữlog/ảnh, chưa xác định nguyên nhân. Source3functionalhash khớp snapshot đã verify, Cypress/config/dependency không đổi. Đã dừng devserver riêng; finalscope4file, chưa stage/commit/push, chờ gate duyệt cuối mục6.
