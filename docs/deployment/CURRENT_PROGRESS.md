# TôHiệuQuiz — Checkpoint triển khai

Cập nhật: **26/07/2026 (phiên 3)**

Tài liệu này là điểm tiếp tục công việc cho phiên sau. Không lưu token, OTP, secret, URL OAuth hoặc mã khôi phục trong file này.

## Phạm vi và repository

- Workspace local: `C:\quizpro`.
- Repository GitHub private: `khanhtmxmla1-sys/tohieuquiz`.
- Nhánh: `main`.
- Hệ thống cũ iTongQuiz phải tiếp tục được giữ tách biệt và không được sửa nếu chưa có yêu cầu rõ ràng.

## Chất lượng mã nguồn (đã xác minh phiên 2)

- `npx tsc --noEmit`: 0 lỗi.
- `npx tsc -p workers/tsconfig.json --noEmit`: 0 lỗi.
- `npm run test:run`: **268 file test / 1283 test pass**, 0 fail (~194s) — chạy với **tất cả cờ tính năng bật**.
- `npm run security:scan`: pass (1627 file được kiểm tra).
- Cypress: 25 test stubbed + 2 test Blueprint V3 + 9 component test — tất cả pass.
- Không còn `TODO`/`FIXME` trong `src/` hoặc `workers/src/`.
- GitNexus đã reindex: 12.261 node, 27.056 edge, 815 cluster, 300 flow.

### Việc đã làm trong phiên 2 (ngoài phần Vercel bên dưới)

- Sửa nợ kỹ thuật `GameCanvas`: thay `loseLife()` hack bằng `endGame()` — hack cũ khiến người chơi
  không bao giờ thấy màn hình tổng kết sau khi trả lời hết câu hỏi. Thêm `tests/gameStore.test.ts`.
- Sửa `tests/manualQuizTelemetry.test.ts`: hai test "defaults off" đang đọc môi trường sẵn có
  (`vi.unstubAllEnvs()`) nên fail với bất kỳ ai bật cờ trong `.env.local`. Đổi sang `vi.stubEnv(..., undefined)`.
- Thêm `.github/workflows/ci.yml` (typecheck / test / build / e2e), chặn `.invalid` lọt vào bundle.
- Thêm 4 rollback migration còn thiếu (`0015`, `0016`, `0040`, `0042`) và `tests/d1RollbackCoverage.test.ts`.
- Thêm `docs/testing/e2e.md` — ba nhóm spec E2E và ma trận cờ. **Quan trọng:**
  `ai-quiz-generation-v2.cy.ts` chỉ pass khi `VITE_FEATURE_AI_BLUEPRINT_V3=false`.
- `cypress/e2e/quiz.cy.ts` bị quarantine (`describe.skip`) — assert thương hiệu cũ đã không còn trong mã.
- Đồng bộ `README.md`, `AGENTS.md`, `docs/architecture/system_overview.md`,
  `docs/deployment/NEW_SYSTEM_SETUP.md`, `DEPLOYMENT_CHECKLIST.md` với hiện trạng production.

### Ba lỗi chỉ CI mới phát hiện (lần chạy CI đầu tiên)

Máy dev chạy Node 24 trên Windows, runner chạy Node 22 trên Ubuntu — khác biệt này lộ ra 3 vấn đề:

1. `tests/cookieAuthClients.test.ts` — `expect(...).toBeInstanceOf(Blob)` fail trên CI vì Blob do
   fetch mock trả về và Blob của test realm là hai constructor khác nhau trên Node 22. Đã đổi sang
   kiểm tra brand `Object.prototype.toString.call(...) === '[object Blob]'`.
2. Bước chặn `.invalid` trong job `build` báo nhầm: pattern `\.invalid` khớp cả
   `cacheService.invalidate(...)` có trong bundle. Đã siết thành `[a-z0-9-]+\.invalid([^a-zA-Z0-9_]|$)`
   và kiểm chứng hai chiều — sạch trên bundle thật, vẫn bắt được chuỗi `tohieuquiz.invalid` giả lập.
3. Hai lượt Cypress chạy trong **cùng một job** thì lượt hai fail: `cypress-io/github-action` để lại
   dev server của lượt một, port 3001 bị chiếm, Vite nhảy sang port khác còn Cypress vẫn gọi 3001 —
   tức là đang test server dựng bằng cờ sai. Đã tách thành hai job riêng.

## Tài khoản production (phiên 3)

Đã tạo tài khoản đầu tiên trong D1 production. **Mật khẩu không lưu ở đây** — đã giao trực tiếp
cho chủ sở hữu; nếu mất, dùng `/api/admin/teachers/reset-passwords` hoặc seed lại admin.

| Tài khoản | Vai trò | Cách tạo |
|---|---|---|
| `admin` | admin | INSERT trực tiếp vào `teachers` (hash PBKDF2-SHA256 100k vòng, đúng encoding `workers/src/utils/password.ts`), `must_change_password = 1`, đã đổi mật khẩu ở lần đăng nhập đầu |
| `test.gv1` | teacher | `POST /api/admin/teachers` bằng phiên admin |
| "Lớp Test 1" | lớp | `POST /api/classes` bằng phiên admin |
| `test.hs1`, `test.hs2` | student | `POST /api/students` bằng phiên giáo viên |

Ba tài khoản `test.*` và "Lớp Test 1" là **dữ liệu kiểm thử**, phải xoá trước khi khai trương.

### Lỗi chặn: production trả 503 cho mọi lượt đăng nhập

Phát hiện ngay khi đăng nhập admin lần đầu. `/api/login`, `/api/student-login` và đăng nhập phụ
huynh chạy rate limiter `failureMode: 'closed'` (`workers/src/index.ts`), nhưng bảng `rate_limits`
không tồn tại trên D1 mới — nó chỉ được khai báo trong `data/migrations/007_create_notifications.sql`
của hệ thống cũ và trong `ensureRateLimitTable()`, hàm không được gọi ở đâu cả. INSERT ném lỗi →
limiter "đóng" → 503. Không liên quan mật khẩu hay tài khoản.

Vì sao smoke test trước đó không bắt: chỉ kiểm tra endpoint chưa đăng nhập trả `401`, chưa từng
gọi `/api/login` thật lần nào.

Đã sửa cả ba đường để DB mới không lặp lại:

- `workers/schema.sql` — thêm `rate_limits` vào schema chuẩn.
- `workers/migrations/0043_create_rate_limits.sql` (+ rollback `0043_drop_rate_limits.sql`),
  đã áp dụng lên production: `npx wrangler d1 migrations apply tohieuquiz-db --remote --config wrangler.toml`.
- `workers/scripts/bootstrap_d1_migration_registry.sql` — đăng ký 0043.
- `tests/freshD1Bootstrap.test.ts` — chốt `schema.sql` bắt buộc có `rate_limits`.

**Bẫy khi chạy wrangler trong `workers/`:** phải truyền `--config wrangler.toml`, nếu không wrangler
bắt được `wrangler.jsonc` ở thư mục gốc và báo `Couldn't find a D1 DB with the name or binding`.

### Smoke test có phiên đăng nhập thật — 12/12 đạt

Đăng nhập cả ba vai trò; buộc đổi mật khẩu ở lần đăng nhập đầu hoạt động đúng; `/api/system-settings`
(GET công khai có chủ đích) đọc được `unified_notifications_v1 = false`, `degraded = false`;
`/api/admin/teachers`, `/api/classes`, `/api/students?classId=`, `/api/notifications`, `/api/results`
trả `200` với phiên hợp lệ; học sinh gọi `/api/admin/teachers` bị chặn `403`.

Lưu ý tài liệu: bảng smoke test cũ ghi `/api/system/settings` — đường dẫn đó không tồn tại (nên trả
`401` từ guard chung). Đường dẫn thật là `/api/system-settings`.

### Hai spec E2E live: đã chạy được, nhưng chặn bởi dữ liệu rỗng (1/13 đạt)

Chạy `student-dashboard-responsive.cy.ts` + `student-practice-library.cy.ts` với `test.hs1` trên
`https://www.thtohieu.com`. Đăng nhập UI thật **thành công** (dashboard render, `/api/pets`,
`/api/assignments`, `/api/game-loop/*` đều 200) — nhưng 12/13 test fail vì cùng một lý do:
`[data-testid="subject-practice-grid"] button` không tồn tại. `buildPracticeCatalog()` chỉ đánh dấu
môn là `available` khi `questionCount > 0`, số này đến từ `GET /api/practice/topics` đọc hashtag
trong `questions.tags`. D1 chưa có câu hỏi nào → mọi môn nằm ở nhóm "Sắp có".

Tức là hai spec này cần **tài khoản học sinh + dữ liệu luyện tập**, không chỉ tài khoản. Đã ghi rõ
điều kiện này vào `docs/testing/e2e.md`.

Sau khi seed đề test, chạy lại: trang môn học `/student/practice/toan` render đúng ("Toán học ·
4 chuyên đề · 6 câu hỏi") và assert route chuẩn đã pass — nhưng vẫn đỏ vì **hai spec lỗi thời so với
UI**, không phải lỗi sản phẩm: nhãn nút điểm danh không còn khớp regex của spec, và alias DOM
`@firstSubject` rỗng sau khi điều hướng. Chi tiết trong `docs/testing/e2e.md`.

### Luồng dạy–học đã smoke test trọn vòng trên production

Đề `q-test-gd5-toan` (3 câu MCQ, tag `#toan`, `show_on_home=FALSE` nên không lên trang chủ) →
giao cho "Lớp Test 1" (tối đa 2 lượt) → `test.hs1` nộp bài đúng 2/3 → giáo viên xem kết quả →
lượt thứ 3 bị chặn `403`. Điểm đáng ghi nhận: client gửi `score: 10, correctCount: 3` nhưng server
tự tính lại từ `answers` thành **6.7 / 2 đúng 3** — `deriveResultMetricsFromAnswers()` không tin
client. Hai thông báo `assignment_created` được ghi đúng (một cho mỗi học sinh trong lớp).

Chính lần smoke test này lộ ra lỗi mojibake: thông báo `403` trả về nguyên văn
`Báº¡n Ä‘Ã£ háº¿t lÆ°á»£t lÃ m bÃ i táº­p nÃ y (2/2).` Đã sửa trong mã (commit riêng),
**cần redeploy Worker** để có hiệu lực trên production.

### Dữ liệu test hiện có trong production (cần xoá trước khi khai trương)

| Bản ghi | Ghi chú |
|---|---|
| `test.gv1`, `test.hs1`, `test.hs2`, "Lớp Test 1" | tài khoản và lớp kiểm thử |
| `q-test-gd5-toan` + 3 câu hỏi | ẩn khỏi trang chủ (`show_on_home=FALSE`) |
| `a-89e6d829` | bài được giao, 2 kết quả của `test.hs1` |
| `quiz-manual-f18226a6-…` | **do `admin` tạo lúc 12:06:23Z**, tiêu đề "Đề kiểm tra mới", 1 câu hỏi, `show_on_home=TRUE` → đang hiện trên trang chủ công khai. Không phải do script tạo; xác nhận lại trước khi xoá. |

## Cloudflare đã hoàn tất

- Domain chính: `thtohieu.com`.
- D1: `tohieuquiz-db`, APAC, schema và migration registry đã bootstrap đầy đủ.
- Dữ liệu nghiệp vụ (đề, kết quả, chứng nhận) trong D1 vẫn rỗng; ngoài seed hệ thống không nhạy cảm
  giờ có thêm 1 tài khoản admin và bộ tài khoản kiểm thử `test.*` (xem mục "Tài khoản production").
- R2 public assets: `tohieuquiz-og-images`.
- R2 private certificates: `tohieuquiz-certificates` (phải tiếp tục là private).
- Public R2 custom domain: `assets.thtohieu.com`, SSL active.
- Queue: `tohieuquiz-certificate-generation`; DLQ: `tohieuquiz-certificate-generation-dlq`.
- API Worker: `tohieuquiz-api`, đã deploy tại `api.thtohieu.com`.
- Certificate consumer: `tohieuquiz-certificate-consumer`, đã deploy.
- `JWT_SECRET` đã tạo mới và lưu trong Cloudflare Worker Secrets.
- `CLIPROXY_TOKEN` hiện là giá trị ngẫu nhiên tạm để cho phép deploy; AI chưa hoạt động vì `ai.thtohieu.com` chưa có dịch vụ thật. **Phải thay token này khi cấu hình AI/proxy chính thức.**

Smoke test Cloudflare đã đạt:

- `GET https://api.thtohieu.com/api/health` trả `status=ok`.
- CORS cho `https://www.thtohieu.com` đúng và cho phép credentials.
- Endpoint cần xác thực trả `401` khi không có phiên đăng nhập.
- Certificate assets: 10 font và 5 background đã upload, tải ngược và khớp SHA-256.

## Vercel — đã hoàn tất trong phiên 2

- Vercel CLI account active: `khanhtmxmla1-sys`; scope/team: `vh-s-projects3` ("vh's projects", plan hobby).
- Đã xóa thư mục `.vercel` cũ (trỏ tới team `team_oB46Nsd5UwCuCeeq1wNcguK2` của account cũ).
- Đã tạo và link project mới: `vh-s-projects3/tohieuquiz`, project id `prj_SbMfosKATLVZYg56XOYlRfmU6TAb`.
- Git integration: repository private `khanhtmxmla1-sys/tohieuquiz` đã được kết nối vào project mới.
- Framework preset nhận đúng: Vite; build command `npm run build` (chạy `cloudflare-build-router.mjs` → `build:frontend`).
- Đã đặt 6 biến Production (đã kiểm tra không có ký tự newline thừa):

```text
VITE_FEATURE_GIFT_SHOP_V2=false
VITE_FEATURE_AI_QUIZ_V2=false
VITE_FEATURE_AI_BLUEPRINT_V3=false
VITE_FEATURE_PARENT_PORTAL_V1=false
VITE_GIFT_SHOP_MODE=api
SITEMAP_SITE_URL=https://www.thtohieu.com
```

- Deploy Production thành công từ project đúng:
  - Deployment id: `dpl_ForDbuYnZsyE8ad355qY5FWJe3JX`, status Ready.
  - Alias production: `https://tohieuquiz-nu.vercel.app`.

Smoke test frontend production mới đã đạt:

| Kiểm tra | Kết quả |
|---|---|
| `GET /` | `200` |
| `Content-Security-Policy` | có, đúng allowlist `api/assets.thtohieu.com` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` |
| `X-Frame-Options` / `X-Content-Type-Options` | `DENY` / `nosniff` |
| `/robots.txt` | đúng, trỏ sitemap về `www.thtohieu.com` |
| `/sitemap.xml` | `200`, 6 URL |
| `/api/health` qua rewrite frontend | `200`, `{"status":"ok"}` |

## Custom domain — ĐÃ CHUYỂN XONG sang project mới

Ba domain đã được gán vào project `vh-s-projects3/tohieuquiz` bằng `vercel domains add`.
**Không cần** TXT `_vercel` challenge và **không cần** thao tác thủ công trên account Vercel cũ.

Lưu ý về cách kiểm tra: ngay sau `vercel domains add`, deployment production **đã tồn tại trước đó** vẫn chỉ có alias `*.vercel.app`. Domain chỉ được alias vào **deployment production kế tiếp**. Vì vậy phải deploy lại (hoặc push commit mới) rồi mới `vercel inspect` để xác nhận.

Trạng thái xác nhận trên deployment production hiện tại (`tohieuquiz-bmyf1gsly`, tạo tự động từ git push):

```text
Aliases
  https://thtohieu.com
  https://www.thtohieu.com
  https://phuhuynh.thtohieu.com
  https://tohieuquiz-nu.vercel.app
  https://tohieuquiz-vh-s-projects3.vercel.app
  https://tohieuquiz-git-main-vh-s-projects3.vercel.app
```

### Git integration — ĐÃ XÁC NHẬN

Push commit tài liệu lên `main` → Vercel tự tạo deployment Production mới (build 25s, status Ready) mà không cần chạy `vercel deploy`. Git integration hoạt động đúng.

### Smoke test production đầy đủ — TẤT CẢ ĐẠT

| Kiểm tra | Kết quả |
|---|---|
| `https://thtohieu.com/` | `200` |
| `https://www.thtohieu.com/` | `200` |
| `https://phuhuynh.thtohieu.com/` | `200` |
| `https://www.thtohieu.com/api/health` (qua rewrite) | `200` `{"status":"ok"}` |
| `https://api.thtohieu.com/api/health` (trực tiếp) | `200` `{"status":"ok"}` |
| CSP / HSTS / X-Frame-Options / X-Content-Type-Options trên domain thật | đầy đủ, đúng giá trị |
| `/sitemap.xml`, `/robots.txt` trên domain thật | `200` |
| Auth guard: `/api/results`, `/api/teachers`, `/api/classrooms`, `/api/notifications`, `/api/system/settings` | `401` (đúng) |
| `/api/quizzes` | `200` — **đúng thiết kế**, đây là danh mục đề công khai |

## DNS Cloudflare hiện tại

```text
A      @           76.76.21.21
CNAME  www         cname.vercel-dns-0.com
CNAME  phuhuynh    cname.vercel-dns-0.com
```

Các record này đã đúng cho Vercel và **không cần đổi** khi chuyển project — chỉ cần thêm TXT `_vercel` nếu Vercel yêu cầu xác minh.

## GitHub đã hoàn tất

- GitHub CLI có 2 account trong keyring: `khanhtmxmla1-sys` và `tongminhkhanh`.
- **Lưu ý:** biến môi trường `GITHUB_TOKEN` đang chứa token không hợp lệ và ghi đè keyring → `gh auth status` báo lỗi. Khi cần dùng `gh`, xóa biến này trong shell hiện tại:
  ```powershell
  Remove-Item Env:GITHUB_TOKEN
  ```
- Repository `tohieuquiz` là private; quyền CLI có `repo` và `workflow`.
- Local `main` theo dõi `origin/main`.

## Chưa thực hiện hoặc cần quyết định sau

- Nên xóa project Vercel cũ ở account cũ để tránh nhầm lẫn về sau (không còn là blocker).
- Chưa cấu hình dịch vụ AI thật tại `ai.thtohieu.com`; chưa thay `CLIPROXY_TOKEN` tạm.
- Chưa xoá dữ liệu kiểm thử `test.gv1` / `test.hs1` / `test.hs2` / "Lớp Test 1" khỏi production.
- Chưa bật cờ nào trong đợt rollout giai đoạn 5 (bước 1 là Unified Notifications, cờ server).
- Chưa cấu hình email provider, monitoring hoặc Cloudinary production.
- Chưa bật branch protection cho `main` trên GitHub (CI đã có, nhưng chưa bắt buộc).
- Chưa bật các feature flag đang để `false` trên production (xem `docs/ROADMAP.md`, giai đoạn 5).
- `cypress/e2e/quiz.cy.ts` đang skip — cần viết lại theo UI hiện tại.
- Hai spec `student-dashboard-responsive` và `student-practice-library` cần tài khoản học sinh thật
  để chạy trên môi trường đã deploy (xem `docs/testing/e2e.md`).

## Nguyên tắc tiếp tục

- Không thay đổi hệ thống iTongQuiz cũ.
- Không đưa secret vào Git / biến `VITE_*` / tài liệu.
- Không làm public bucket chứng nhận; `tohieuquiz-certificates` phải tiếp tục là private.
- Sau mỗi thay đổi production: chạy health, CORS, auth guard và frontend smoke test.
- Khi thêm biến môi trường Vercel qua CLI trên Windows, dùng `<nul set /p "=value" |` để tránh newline lọt vào giá trị.
