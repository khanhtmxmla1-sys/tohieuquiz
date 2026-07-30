# TôHiệuQuiz — Kế hoạch hoàn thiện dự án (ROADMAP)

> Cập nhật: **30/07/2026**. Tasks 1–37 đã hoàn tất trên `main`; Task 38 đang ở bước release-prep và chưa thực hiện cleanup production.
> Trạng thái hạ tầng chi tiết: `docs/deployment/CURRENT_PROGRESS.md`. Quy ước kiểm thử E2E: `docs/testing/e2e.md`.

## Tình trạng các giai đoạn

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| 0 | Dọn dẹp repo & nền tảng làm việc | ✅ Xong |
| 1 | Nghiệm thu 5 tính năng đang tắt cờ | ✅ Xong (kiểm thử tự động) |
| 2 | Đồng bộ tài liệu với thực tế | ✅ Xong |
| 3 | CI/CD tự động | ✅ Xong, branch protection đã bắt buộc |
| 4 | Hạ tầng Cloudflare/Vercel & deploy | ✅ Xong; email provider là tích hợp tùy chọn đang fail-closed |
| 5 | Kiểm thử production & rollout cờ | ✅ Nền tảng rollout/smoke hoàn tất; audience từng tính năng là quyết định sản phẩm |
| 6 | Modernization release closeout | 🔄 Task 38 prep đạt; chờ backup, cleanup và smoke hậu cleanup |

Quality gate hiện tại (đo ngày 26/07/2026, với tất cả cờ bật ở local):

- `npx tsc --noEmit` và `npx tsc -p workers/tsconfig.json --noEmit`: 0 lỗi.
- `npm run test:run`: **268 file / 1283 test pass**, 0 fail.
- `npm run security:scan`: pass (1627 file).
- Cypress: **25 test stubbed + 2 test Blueprint V3 + 9 component test** đều pass.

---

## Giai đoạn 0 — Dọn dẹp repo ✅

- [x] `.vercel/` được `.gitignore` bỏ qua và không nằm trong Git tracking; entry trùng lặp đã gộp.
- [x] Chạy lại index GitNexus — 12.261 node, 27.056 edge, 815 cluster, 300 flow. `AGENTS.md` và `CLAUDE.md` đã đồng bộ số liệu mới.
- [x] Sửa nợ kỹ thuật ở `src/components/Game/GameCanvas.tsx`: thay `loseLife()` hack bằng `endGame()` tường minh.
  Hack cũ ăn mất một mạng rồi `resetGame()` về menu, nên người chơi **không bao giờ thấy màn hình tổng kết** sau khi trả lời hết câu hỏi. Đã bổ sung `tests/gameStore.test.ts` (6 test) khoá hành vi này.

## Giai đoạn 1 — Nghiệm thu tính năng ✅

Đã bật toàn bộ cờ ở `.env.local` và chạy thật, không chỉ đọc code.

| Tính năng | Cờ | Kết quả |
|---|---|---|
| AI Quiz V2 | `VITE_FEATURE_AI_QUIZ_V2` | ✅ 5/5 E2E pass (**yêu cầu Blueprint V3 tắt**) |
| AI Blueprint V3 | `VITE_FEATURE_AI_BLUEPRINT_V3` | ✅ 2/2 E2E pass |
| Parent Portal V1 | `VITE_FEATURE_PARENT_PORTAL_V1` | ✅ 2/2 E2E pass |
| Gift Shop V2 | `VITE_FEATURE_GIFT_SHOP_V2` | ✅ 3/3 E2E pass (`gift-shop.cy.ts`, bổ sung sau giai đoạn này) |
| Unified Notifications | setting server `unified_notifications_v1` | ✅ 4/4 E2E pass |

### Ba phát hiện trong giai đoạn này

1. **Xung đột cờ AI V2 ↔ V3.** `ai-quiz-generation-v2.cy.ts` fail 3/5 khi bật V3, pass 5/5 khi tắt. Nguyên nhân: V3 thay thế pipeline V2 (`OCR → GENERATE → REPAIR → REVIEW`), nên stage `REPAIR` không chạy và nút "Lưu đề" không xuất hiện. Đây là hành vi đúng, không phải lỗi — mỗi spec khoá một phía của cờ. CI vì thế chạy E2E **hai lượt**.
2. **Test đơn vị phụ thuộc môi trường.** `tests/manualQuizTelemetry.test.ts` dùng `vi.unstubAllEnvs()` rồi assert cờ mặc định `false` — thực chất đang đọc môi trường sẵn có, nên fail với bất kỳ lập trình viên nào bật cờ trong `.env.local`. Đã sửa thành `vi.stubEnv(..., undefined)` để test đúng nghĩa "biến chưa được đặt".
3. **Ba spec E2E không chạy được trong môi trường stub:**
   - `student-dashboard-responsive.cy.ts`, `student-practice-library.cy.ts` — đăng nhập thật, cần `--env studentUsername=...,studentPassword=...` trên môi trường đã deploy.
   - `quiz.cy.ts` — **kế thừa từ hệ thống nguồn, đã lỗi thời**: assert thương hiệu cũ ("TRƯỜNG TIỂU HỌC IT ÔNG") và link "Dành cho Giáo viên" không còn tồn tại trong `src/`. Đã `describe.skip` kèm giải thích trong file.

## Giai đoạn 2 — Đồng bộ tài liệu ✅

- [x] `README.md` — thay mục "placeholder `.invalid`" bằng bảng hạ tầng production thật, thêm lệnh chạy E2E.
- [x] `docs/architecture/system_overview.md` — mô tả tài nguyên Cloudflare/Vercel thật.
- [x] `AGENTS.md` — issue tracker đã có remote; ghi chú bẫy `GITHUB_TOKEN` hỏng.
- [x] `docs/deployment/NEW_SYSTEM_SETUP.md` — điền bảng chủ sở hữu, thêm banner trạng thái.
- [x] `DEPLOYMENT_CHECKLIST.md` — tick các mục đã xong kèm bằng chứng, thêm mục 8 (rollout cờ).
- [x] `docs/testing/e2e.md` — **mới**, phân loại 3 nhóm spec và ma trận cờ.
- [x] `CONTEXT.md` — đã đúng từ phiên trước, không cần sửa.
- [x] `tests/productionDomainConfig.test.ts` vẫn pass sau khi sửa tài liệu.

## Giai đoạn 3 — CI/CD ✅

- [x] `.github/workflows/ci.yml` — 4 job: `typecheck` (frontend + workers), `test` (vitest), `build` (kèm bước chặn `.invalid` lọt vào bundle), `e2e` (Cypress 2 lượt theo cờ). YAML đã được parse kiểm chứng.
- [x] Job E2E loại trừ đúng 3 spec không chạy được trong CI, có ghi lý do ngay trong workflow.
- [x] Script mới: `cypress:run:stubbed`, `cypress:run:blueprint-v3`, `cypress:run:component`.
- [x] Bổ sung 4 rollback migration còn thiếu: `0015`, `0016`, `0040`, `0042`.
- [x] `tests/d1RollbackCoverage.test.ts` — **mới**, ép mọi migration rủi ro cao phải có rollback, chặn rollback mồ côi, và kiểm tra thứ tự DROP an toàn với khoá ngoại.
- [x] Branch protection `main` đã được reconcile và xác minh: PR + approval + CODEOWNERS + strict checks + conversation resolution; cấm force-push/deletion.

## Giai đoạn 4 — Hạ tầng & deploy ✅ (còn 1 hạng mục)

Chi tiết và bằng chứng: `docs/deployment/CURRENT_PROGRESS.md`.

Đã xong: D1, R2 (public + private), Queue + DLQ, API/certificate/AI gateway Workers,
`JWT_SECRET`, `api.thtohieu.com`, `ai.thtohieu.com/v1`, DNS/SSL cho các hostname production,
Vercel project + Git integration + biến môi trường, custom domains và smoke test đầy đủ.

Còn lại:

- [x] Dịch vụ AI thật tại `ai.thtohieu.com/v1`, Bearer token mới và `CLIPROXY_TOKEN` production — xong 27/07/2026.
- [ ] Email provider (SPF/DKIM/DMARC), monitoring, Cloudinary production.
- [x] Tài khoản quản trị đầu tiên trong D1 — xong 26/07/2026 (phiên 3).

## Giai đoạn 5 — Rollout production 🔄

**Điều kiện tiên quyết đã xong (26/07/2026, phiên 3):** tài khoản quản trị đầu tiên `admin` đã
tồn tại trong D1 production, cùng bộ tài khoản kiểm thử `test.gv1` / `test.hs1` / `test.hs2` và
lớp "Lớp Test 1". Mật khẩu **không** lưu trong repo — xem `docs/deployment/CURRENT_PROGRESS.md`.

### Lỗi chặn phát hiện khi tạo tài khoản: đăng nhập production trả 503

`/api/login`, `/api/student-login` và đăng nhập phụ huynh chạy rate limiter với
`failureMode: 'closed'` (`workers/src/index.ts`), nhưng bảng `rate_limits` **chưa bao giờ được tạo
trên D1 mới**: nó chỉ có trong `data/migrations/007_create_notifications.sql` của hệ thống cũ và
trong `ensureRateLimitTable()` — hàm không được gọi ở bất kỳ đâu. Hệ quả: **mọi lượt đăng nhập của
mọi vai trò đều trả 503**, không riêng tài khoản mới. Smoke test các phiên trước không bắt được vì
chỉ kiểm tra endpoint chưa đăng nhập trả `401`.

Đã sửa ở ba nơi để DB mới không lặp lại lỗi:

- `workers/schema.sql` — thêm `rate_limits` (đường bootstrap DB mới).
- `workers/migrations/0043_create_rate_limits.sql` + `workers/rollbacks/0043_drop_rate_limits.sql`
  (đường DB đang chạy). Đã `wrangler d1 migrations apply --remote` lên production.
- `workers/scripts/bootstrap_d1_migration_registry.sql` — đăng ký 0043.

Chốt bằng test: `tests/freshD1Bootstrap.test.ts` giờ bắt buộc `schema.sql` có `rate_limits`.

### Smoke test thủ công còn lại
- [x] Đăng nhập đủ vai trò: quản trị, giáo viên, học sinh — 12/12 kiểm tra đạt trên production
      (đổi mật khẩu bắt buộc lần đầu, `/api/system-settings`, `/api/admin/teachers`, `/api/classes`,
      `/api/students`, `/api/notifications`, `/api/results`, và học sinh bị chặn 403 khỏi API admin).
- [x] Tạo đề thủ công → giao bài → học sinh làm → chấm & xem kết quả — 7/7 bước đạt trên production
      (đề `q-test-gd5-toan`, 3 câu MCQ, `show_on_home=FALSE`; giao cho "Lớp Test 1" tối đa 2 lượt;
      `test.hs1` nộp bài đúng 2/3 → **server tự tính 6.7 điểm, bỏ qua điểm 10 mà client gửi**;
      giáo viên xem được kết quả; 2 thông báo giao bài được ghi; lượt thứ 3 bị chặn 403).
- [x] Thi trực tiếp (đủ 5 trạng thái) — 11/12 kiểm tra đạt trên production: `scheduled` → `waiting`
      → `active` → `scoring` → `closed`, kèm 4 chốt chặn chuyển trạng thái sai (`start_exam` khi còn
      `scheduled`, học sinh vào khi chưa mở phòng chờ, `open_session` lần hai, `end_early` khi đã
      `closed` — tất cả trả `409`). **Lộ ra một lỗi chấm điểm nghiêm trọng, xem bên dưới.**

### Lỗi chấm điểm thi trực tiếp: mọi đáp án dạng số bị tính sai

Học sinh trả lời đúng 2/3 câu nhưng nhận `score = 0`, `correct_count = 0`.
`workers/src/services/liveExamQuestionMapper.ts` chạy `JSON.parse` lên **mọi** giá trị
`correct_answer`, nên đáp án `"56"` trở thành **số** `56`. `calculateStudentScore` chấm MCQ bằng
`answers[q.id] === correctAnswer`, tức `"56" === 56` → `false`. Với đề toán tiểu học thì gần như
toàn bộ câu hỏi có đáp án là số.

Chỉ ảnh hưởng thi trực tiếp: đường đề thường để client tự chuẩn hoá (`stores/quizStore.ts` gán
`correctAnswer = correct_answer`, không parse), nên chấm đúng.

Đã sửa: chỉ parse khi chuỗi thật sự là JSON mảng/đối tượng (các loại nhiều đáp án như
MULTIPLE_SELECT, ORDERING, UNDERLINE), còn lại giữ nguyên chuỗi. Chốt bằng
`tests/liveExamNumericAnswerScoring.test.ts` — đã xác nhận test đỏ đúng khi đưa lỗi trở lại.
Đã deploy và xác minh trên production: phiên thi mới cho `score = 6.7`, đúng 2/3.
- [x] Phiếu kết quả `/phieu/*` — 8/8 đạt trên production: từ kết quả quiz → tạo phiếu (server tự
      suy ra điểm 6.7 và xếp loại "Khá") → xuất bản batch → link công khai đọc được **không cần
      đăng nhập** và không lộ dữ liệu nội bộ → thu hồi link thì trả `404`.
- [x] Chứng nhận: batch → queue consumer → R2 → thông báo — đạt trên production: batch `pending`
      → consumer xử lý qua Queue → `sent` với 2 chứng nhận (một cho mỗi học sinh), ảnh tải về là
      **PNG thật 38.350 byte** từ bucket private, truy cập ẩn danh trả `401`. Gửi lại cùng
      `request_id` trả đúng batch cũ (idempotent).
- [ ] Email xác minh / quên mật khẩu (sau khi có email provider).
- [x] Backup D1 + thử phục hồi đã hoàn tất bằng Time Travel và encrypted tablewise export trên staging. **Kế hoạch cũ không chạy được:** `wrangler d1 export` từ chối
      toàn bộ database với lỗi `cannot export databases with Virtual Tables (fts5)` — do
      `rag_chunks_fts` (migration 0007). Hai đường thay thế đã kiểm chứng:
  - **Time Travel là đường phục hồi chính** — `wrangler d1 time-travel info tohieuquiz-db` chạy được
    và trả về bookmark hiện tại; khôi phục bằng `time-travel restore --bookmark=...`. Không cần export.
  - Export theo bảng vẫn khả thi: chỉ `rag_chunks_fts` là VIRTUAL (5 bảng `rag_chunks_fts_*` còn lại
    là shadow table của nó), nên `--table` cho từng bảng thật là được. Chỉ số FTS là dữ liệu dẫn xuất,
    dựng lại từ `rag_chunks` bằng migration 0007 + `workers/scripts/rag-sync.cjs`.
    Remote encrypted export và isolated restore đã chạy trên staging; production Task 38 dùng bookmark riêng lưu ngoài repository ngay trước cleanup.

### Thứ tự bật cờ (mỗi bước cách nhau 2–3 ngày, theo dõi 24–48h)

1. [x] **Unified Notifications** — chủ sở hữu bật qua UI lúc `2026-07-26T14:10:54Z`
   (`unified_notifications_v1 = true`, audit log `SYSTEM_SETTINGS_UPDATED` bởi `admin`).
   Kiểm tra ngay sau đó: `/api/system-settings` trả `degraded = false`, `/api/notifications` trả
   `200` cho cả giáo viên và học sinh, `/api/announcements/current` `200`. Đang trong cửa sổ theo
   dõi 24–48h trước khi sang bước 2.
   **Bẫy:** `POST /api/system-settings` ghi **cả hai** cờ trong một request. Hai dòng cài đặt cùng
   `updated_at`, và seed đặt `ai_assistant_enabled = 'true'` nhưng giá trị hiện tại là `false` —
   nên việc bật thông báo có thể đã kéo theo tắt cờ AI. Lần đổi cờ sau phải đọc giá trị hiện tại
   rồi gửi lại đúng cả hai.
2. [ ] **Gift Shop V2** — `gift-shop.cy.ts` (3/3 pass) đã khoá luồng đổi quà → trao → hủy và hoàn xu
   trước khi bật; cờ frontend nên cần redeploy Vercel với `VITE_FEATURE_GIFT_SHOP_V2=true`.
3. [ ] **AI Quiz V2** — chỉ sau khi có AI proxy thật; theo dõi chi phí và quota giáo viên.
4. [ ] **AI Blueprint V3**.
5. [ ] **Parent Portal V1** — kèm truyền thông tới phụ huynh; theo dõi rate-limit đăng nhập.

Cờ frontend cần redeploy Vercel với env mới để bật/tắt (vài phút). Cờ server đổi tức thì.

### Kết thúc
- [ ] Cập nhật `CHANGELOG.md`, tag release `v1.0.0`.
- [x] Chuyển theo dõi dài hạn thành `docs/operations/maintenance-calendar.md`.

---

## Rủi ro còn lại

| Rủi ro | Ảnh hưởng | Phương án |
|---|---|---|
| Chưa có AI proxy thật | Chặn rollout AI V2/V3 | Bật Unified Notifications và Gift Shop trước |
| Dữ liệu test còn trong production | Lẫn với dữ liệu thật khi khai trương | Task 38 dry-run đã đạt; chỉ execute sau bookmark + PR review, giữ nguyên owner/smoke accounts |
| ~~Bảng `rate_limits` phình dần~~ | Đã xử lý | Cron `0 23 * * *` gọi `purgeExpiredRateLimits()`, xoá bản ghi cũ hơn 24h |
| `quiz.cy.ts` đang skip | Mất phủ luồng home/login | Viết lại theo UI hiện tại hoặc restub như `parent-portal.cy.ts` |
| ~~2 spec live đã lỗi thời so với UI~~ | Đã xử lý | Sửa xong, **13/13 pass** trên production; xem `docs/testing/e2e.md` |
| ~~Không reset cuộn khi đổi route~~ | Đã xử lý | `useScrollReset` (`src/app/useScrollReset.ts`): PUSH/REPLACE về đầu trang, POP khôi phục vị trí đã lưu. Spec e2e assert `scrollY === 0` thay cho workaround cũ |
| ~~Nút "quay lại" của giáo viên vẫn là PUSH~~ | Đã xử lý | `TeacherResultDetailPage.handleBack` dùng back thật khi `location.key !== 'default'`. `ManualQuizWorkspacePage.tsx:85` hoá ra **không** phải nút quay lại mà là điều hướng sau khi xuất bản (về tab Quản lý) — về đầu trang ở đó là đúng; nút quay lại thật của workspace (`WorkspaceHeader.tsx:39`) vốn đã là `navigate(-1)` |
| ~~Chưa bật branch protection~~ | Đã xử lý | `main` yêu cầu PR, approval, CODEOWNERS và strict required checks |
