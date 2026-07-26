# TôHiệuQuiz — Kế hoạch hoàn thiện dự án (ROADMAP)

> Cập nhật: 2026-07-26. Định hướng đã chốt: **hoàn thiện & ổn định tính năng trước, deploy production sau**.
> Trạng thái nền tảng tại thời điểm lập kế hoạch: typecheck sạch (frontend + workers), 266 file test / 1272 test pass, security scan pass, không còn TODO/FIXME trong `src/` và `workers/src/`.

## Tổng quan lộ trình

| Giai đoạn | Nội dung | Kết quả bàn giao |
|---|---|---|
| 0 | Dọn dẹp repo & nền tảng làm việc | Repo sạch, index code mới |
| 1 | Hoàn thiện 5 tính năng đang tắt cờ | Từng tính năng "sẵn sàng bật" |
| 2 | Đồng bộ tài liệu với thực tế | Docs phản ánh đúng hệ thống |
| 3 | CI/CD tự động | Mọi push đều được kiểm tra |
| 4 | Hạ tầng Cloudflare/Vercel & deploy | Hệ thống chạy trên production |
| 5 | Kiểm thử production & rollout cờ | Tính năng mở dần, có giám sát |

---

## Giai đoạn 0 — Dọn dẹp repo (0.5 ngày)

- [x] `.vercel/` đã được `.gitignore` bỏ qua và **không** nằm trong Git tracking (đã xác minh bằng `git ls-files .vercel`); entry trùng lặp trong `.gitignore` đã gộp lại còn một dòng.
- [ ] Chạy lại index GitNexus (index hiện tại chứa code cũ không còn tồn tại):
  ```bash
  node .gitnexus/run.cjs analyze
  ```
- [ ] Xử lý nợ kỹ thuật duy nhất còn ghi trong code: `src/components/Game/GameCanvas.tsx:118` — thay `loseLife()` hack bằng action `endGame()` tường minh trong game store + test kèm theo.

## Giai đoạn 1 — Hoàn thiện tính năng (trọng tâm)

Nguyên tắc chung cho mỗi tính năng: **bật cờ ở môi trường dev → chạy test liên quan → chạy E2E Cypress → sửa lỗi phát sinh → đánh dấu "sẵn sàng bật production"**. Không bật cờ production trong giai đoạn này.

### 1.1. AI Quiz Generation V2 — `VITE_FEATURE_AI_QUIZ_V2`

Hiện trạng: code + test đầy đủ (`quizGenerationPipeline`, `quizPromptBuilder`, contract tests), mặc định tắt.

- [ ] Bật `VITE_FEATURE_AI_QUIZ_V2=true` trong `.env.local`, kiểm tra toàn bộ luồng tạo đề AI trên dev (`useCreateQuizLogic`).
- [ ] Xác nhận cấu hình AI proxy hoạt động: `CLIPROXY_API` (`https://ai.thtohieu.com/v1`) + secret `CLIPROXY_TOKEN` — cần môi trường thật hoặc mock để smoke test.
- [ ] Kiểm tra hạn mức AI giáo viên (`teacherAiQuotaService`, migration `0012_add_teacher_ai_daily_usage`).
- [ ] Chạy E2E: `cypress/e2e/ai-quiz-generation-v2.cy.ts`.
- [ ] Nghiệm thu: tạo đề AI đủ các loại câu hỏi, lỗi provider được xử lý êm (retry/repair đã có test).

### 1.2. AI Blueprint V3 — `VITE_FEATURE_AI_BLUEPRINT_V3` (phụ thuộc 1.1)

Hiện trạng: chỉ chạy khi V2 bật (`aiBlueprintV3Enabled = aiQuizV2Enabled && isAiBlueprintV3Enabled()`), có fixture 13 loại câu hỏi.

- [ ] Bật cờ trên dev cùng V2, kiểm tra blueprint từng câu hỏi.
- [ ] Chạy E2E: `cypress/e2e/ai-question-blueprint-v3.cy.ts` (fixture `ai-blueprint-v3-13-types.json`).
- [ ] Kiểm tra normalizer + schema V3 (`generatedQuizV3Normalizer`, `quizGenerationSchemaV3`).
- [ ] Nghiệm thu: 13 loại câu hỏi sinh đúng, mapping `mapGeneratedQuizV3ToDomain` không mất dữ liệu.

### 1.3. Parent Portal V1 — `VITE_FEATURE_PARENT_PORTAL_V1`

Hiện trạng: khối lượng code lớn nhất trong 4 tính năng (routes, auth PIN, dashboard, history, notifications, SEO, security tests đầy đủ; migration `0037_add_parent_portal_complete`).

- [ ] Bật cờ trên dev, đi hết luồng: giáo viên tạo liên kết phụ huynh → phụ huynh kích hoạt (`/activate`) → đăng nhập mã/PIN → xem báo cáo/lịch sử/thông báo.
- [ ] Chạy E2E: `cypress/e2e/parent-portal.cy.ts`.
- [ ] Rà soát bảo mật: rate-limit đăng nhập phụ huynh, phạm vi dữ liệu được cấp (đã có `parentPortalSecurity.worker.test.ts` — chạy lại và đọc kỹ).
- [ ] Quyết định subdomain `phuhuynh.thtohieu.com`: xác nhận routing/CORS đã khớp (`ALLOWED_ORIGINS` đã chứa domain này).
- [ ] Nghiệm thu: phụ huynh chỉ thấy đúng học sinh được liên kết; link hết hạn/thu hồi hoạt động đúng.

### 1.4. Gift Shop V2 — `VITE_FEATURE_GIFT_SHOP_V2` + `VITE_GIFT_SHOP_MODE=api`

Hiện trạng: store, service, routes, contract tests sẵn; migration `0005_add_gift_shop`; dữ liệu mẫu `data/ShopItems.csv`, `data/UserPets.csv`.

- [ ] Bật cờ trên dev với `VITE_GIFT_SHOP_MODE=api`, kiểm tra mua/đổi thưởng, số dư điểm.
- [ ] Kiểm tra chống gian lận điểm thưởng (`gamificationSecurity.worker.test.ts`, `resultRewardClaim.worker.test.ts`).
- [ ] Seed danh mục shop cho môi trường mới (ShopItems).
- [ ] Nghiệm thu: giao dịch idempotent, không âm điểm, UI học sinh hiển thị đúng.

### 1.5. Unified Notifications — cờ server `unified_notifications_v1`

Hiện trạng: khác 4 cờ trên, đây là **setting phía server** (bảng `system_settings`, bật qua API `systemSettings` bởi admin); migration `0042_unified_notifications`; frontend đọc qua `systemSettingsService`.

- [ ] Trên dev: bật `unifiedNotificationsEnabled` qua trang quản trị hệ thống, kiểm tra NotificationCenter hợp nhất thông báo (announcement + hệ thống + phụ huynh).
- [ ] Chạy E2E: `cypress/e2e/unified-notifications.cy.ts`.
- [ ] Kiểm tra migration dữ liệu thông báo cũ (`unifiedNotificationsMigration.worker.test.ts`).
- [ ] Nghiệm thu: tắt cờ vẫn dùng được layout cũ (đã có test fallback).

### 1.6. Chốt giai đoạn 1

- [ ] Chạy toàn bộ: `npx tsc --noEmit`, `npx tsc -p workers/tsconfig.json --noEmit`, `npm run test:run`, `npm run security:check`, `npm run build` — tất cả pass với các cờ bật ở dev.
- [ ] Chạy đủ 9 suite Cypress E2E + component tests (`npm run cypress:run`).
- [ ] Ghi kết quả nghiệm thu từng tính năng vào CHANGELOG.md (mục Unreleased).

## Giai đoạn 2 — Đồng bộ tài liệu (0.5–1 ngày)

Tài liệu hiện mô tả trạng thái "placeholder `.invalid`" trong khi config đã trỏ về `thtohieu.com` và D1 ID thật.

- [ ] `docs/deployment/NEW_SYSTEM_SETUP.md`: điền bảng chủ sở hữu (domain `thtohieu.com`, GitHub `khanhtmxmla1-sys/tohieuquiz`, Vercel project `tohieuquiz`…); cập nhật trạng thái từng tài nguyên Cloudflare (đã tạo / chưa tạo).
- [ ] `README.md`, `CONTEXT.md`, `docs/architecture/system_overview.md`: bỏ đoạn "domain chưa chốt / placeholder `.invalid`", thay bằng trạng thái thật.
- [ ] `AGENTS.md`: cập nhật mục issue tracker (remote GitHub đã cấu hình).
- [ ] `DEPLOYMENT_CHECKLIST.md`: tick các mục đã hoàn thành, giữ lại các mục chưa làm cho giai đoạn 4.
- [ ] Kiểm tra test `productionDomainConfig.test.ts` vẫn pass sau khi sửa docs.

## Giai đoạn 3 — CI/CD (1 ngày)

Hiện chỉ có `.github/workflows/security.yml`.

- [ ] Thêm workflow `ci.yml` chạy trên mọi push/PR vào `main`:
  1. `npm ci` (root + workers)
  2. `npx tsc --noEmit` và `npx tsc -p workers/tsconfig.json --noEmit`
  3. `npm run test:run`
  4. `npm run security:check`
  5. `npm run build`
- [ ] Thêm job Cypress E2E (có thể chạy nightly hoặc trên PR gắn label để tiết kiệm thời gian).
- [ ] Bật branch protection cho `main`: bắt buộc CI xanh trước khi merge.
- [ ] Bổ sung rollback script cho các migration quan trọng còn thiếu (hiện 42 migration nhưng chỉ 5 rollback) — tối thiểu cho: `0042_unified_notifications`, `0040_scope_results_to_assignments`, `0015_add_game_loop_tables`, `0016_add_live_exam_tables`.

## Giai đoạn 4 — Hạ tầng & deploy production (1–2 ngày)

Làm theo `DEPLOYMENT_CHECKLIST.md` + `docs/deployment/NEW_SYSTEM_SETUP.md`. Các mục cần xác nhận/hoàn tất:

> **Trạng thái thực tế 26/07/2026:** phần lớn giai đoạn 4 ĐÃ XONG. Xem `docs/deployment/CURRENT_PROGRESS.md` để biết chi tiết và blocker còn lại.

### Cloudflare — ĐÃ XONG
- [x] D1 `tohieuquiz-db` đã tạo (APAC), schema + migration registry đã bootstrap đầy đủ.
- [x] R2: `tohieuquiz-og-images` (public), `tohieuquiz-certificates` (private).
- [x] Queue `tohieuquiz-certificate-generation` + DLQ `…-dlq` (1 producer, 1 consumer).
- [x] Deploy 2 worker: `tohieuquiz-api` và `tohieuquiz-certificate-consumer`.
- [x] `JWT_SECRET` đã tạo mới trong Worker Secrets.
- [ ] `CLIPROXY_TOKEN` hiện là **giá trị tạm** — phải thay khi có dịch vụ AI thật tại `ai.thtohieu.com`.
- [x] Custom domain `api.thtohieu.com` đã gắn vào worker; `/api/health` trả `status=ok`.
- [ ] Xác nhận 3 cron triggers thực sự chạy đúng chu kỳ.

### DNS / Domain — ĐÃ XONG phần cơ bản
- [x] `A @ 76.76.21.21`, `CNAME www`, `CNAME phuhuynh` → Vercel.
- [x] `assets.thtohieu.com` trỏ R2 public access, SSL active.
- [ ] TXT `_vercel` challenge (chỉ cần nếu Vercel yêu cầu xác minh khi chuyển project).

### Vercel / Frontend — ĐÃ XONG, còn 1 blocker domain
- [x] Đã xóa `.vercel` cũ; tạo và link project mới `vh-s-projects3/tohieuquiz` trong account `khanhtmxmla1-sys`.
- [x] Git integration tới repo private `khanhtmxmla1-sys/tohieuquiz`.
- [x] Đặt 6 biến Production (4 feature flag `false`, `VITE_GIFT_SHOP_MODE=api`, `SITEMAP_SITE_URL`).
- [x] Deploy Production thành công: `https://tohieuquiz-nu.vercel.app` — 200, CSP, HSTS, robots, sitemap, `/api/health` qua rewrite đều đạt.
- [x] 3 custom domain (`thtohieu.com`, `www`, `phuhuynh`) đã gán vào project mới và alias đúng vào deployment production; không cần TXT challenge.
- [x] Xác nhận Git integration: push lên `main` tự sinh deployment Production (25s, Ready).
- [x] Smoke test đầy đủ trên domain thật: 200, CSP, HSTS, robots, sitemap, `/api/health` qua rewrite và trực tiếp, auth guard trả 401 đúng.
- [ ] Xóa project Vercel cũ ở account cũ (dọn dẹp, không gấp).
- [ ] Đặt biến môi trường production: `VITE_WORKERS_API_URL` (để trống nếu dùng rewrite `/api`), các cờ tính năng **để `false` khi golive** (bật dần ở giai đoạn 5), cấu hình Cloudinary nếu dùng, `SITEMAP_SITE_URL`.
- [ ] Deploy và xác nhận rewrite `/api/*` → `api.thtohieu.com` hoạt động.

### Email / AI / Monitoring
- [ ] Email sender: xác minh SPF, DKIM, DMARC.
- [ ] AI proxy `ai.thtohieu.com` hoạt động, có ngân sách cảnh báo.
- [ ] Bật monitoring/log (Cloudflare analytics + cảnh báo lỗi worker).

### Khởi tạo dữ liệu
- [ ] Tạo tài khoản quản trị ban đầu theo quy trình phê duyệt (không import dữ liệu cũ).
- [ ] Seed dữ liệu mặc định: `workers/seeds/defaults.sql`, template chứng nhận (migration seed `0036`).

## Giai đoạn 5 — Kiểm thử production & rollout (1 tuần theo dõi)

### Smoke test sau deploy (theo checklist mục 6–7)
- [ ] `/api/health` trả 200; frontend trả 200; API bảo vệ trả 401 khi thiếu phiên.
- [ ] Đăng nhập đủ vai trò: giáo viên, học sinh, quản trị.
- [ ] Luồng lõi: tạo đề thủ công → giao bài → học sinh làm → chấm & xem kết quả.
- [ ] Thi trực tiếp (đủ 5 trạng thái: scheduled → waiting → active → scoring → closed).
- [ ] Phiếu kết quả `/phieu/*` công khai đúng phạm vi.
- [ ] Chứng nhận: tạo batch → queue consumer render → ảnh trên R2 → thông báo.
- [ ] Email xác minh / quên mật khẩu.
- [ ] Smoke test mobile (đã có suite `mobile-responsive.cy.ts` làm cơ sở).
- [ ] Backup D1 + thử phục hồi.
- [ ] Theo dõi log và chi phí tối thiểu 30 phút sau golive.

### Rollout cờ tính năng (mỗi bước cách nhau 2–3 ngày, có đường lui)
1. [ ] Bật **Unified Notifications** (cờ server — bật/tắt tức thời không cần redeploy, rủi ro thấp nhất).
2. [ ] Bật **Gift Shop V2**.
3. [ ] Bật **AI Quiz V2** (theo dõi chi phí AI + quota giáo viên).
4. [ ] Bật **AI Blueprint V3**.
5. [ ] Bật **Parent Portal V1** (kèm truyền thông tới phụ huynh; theo dõi rate-limit đăng nhập).

Mỗi lần bật: theo dõi lỗi 24–48h → nếu ổn mới bật cờ tiếp theo; nếu lỗi, tắt cờ (frontend flags cần redeploy Vercel với env mới — chỉ vài phút).

### Kết thúc
- [ ] Cập nhật CHANGELOG.md, tag release `v1.0.0`.
- [ ] Chuyển các mục theo dõi dài hạn (chi phí AI, dung lượng R2, backup định kỳ) thành lịch vận hành.

---

## Rủi ro chính & phương án

| Rủi ro | Ảnh hưởng | Phương án |
|---|---|---|
| AI proxy/token chưa sẵn sàng | Chặn 1.1, 1.2 | Làm Parent Portal & Gift Shop trước; mock provider cho dev |
| Migration D1 chưa chạy đủ trên DB mới | Lỗi runtime production | Audit bằng script trước deploy; có rollback script |
| Bật nhiều cờ cùng lúc gây lỗi chồng chéo | Khó truy vết | Rollout tuần tự theo thứ tự ở giai đoạn 5 |
| Chi phí AI vượt dự kiến | Ngân sách | Quota/ngày cho giáo viên đã có; đặt cảnh báo ngân sách proxy |
| E2E Cypress chưa từng chạy CI | Regression lọt lưới | Đưa vào CI nightly ngay giai đoạn 3 |

## Ước lượng tổng

- Giai đoạn 0: 0.5 ngày
- Giai đoạn 1: 3–5 ngày (tùy mức lỗi phát sinh khi bật cờ, Parent Portal chiếm phần lớn)
- Giai đoạn 2: 0.5–1 ngày
- Giai đoạn 3: 1 ngày
- Giai đoạn 4: 1–2 ngày (phụ thuộc DNS/email xác minh)
- Giai đoạn 5: ~1 tuần theo dõi rollout

**Tổng: ~2 tuần lịch, trong đó ~6–9 ngày làm việc tập trung.**
