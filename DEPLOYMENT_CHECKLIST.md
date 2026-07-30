# TôHiệuQuiz — Deployment Checklist

Trạng thái cập nhật: **29/07/2026**. Bằng chứng chi tiết cho từng mục đã tick nằm trong
`docs/deployment/CURRENT_PROGRESS.md`.

Không deploy khi cấu hình còn chứa domain `.invalid` hoặc D1 ID toàn số 0.
CI đã có bước chặn tự động: job `build` trong `.github/workflows/ci.yml` fail nếu chuỗi
`.invalid` xuất hiện trong bundle production.

## 1. Tài khoản và quyền sở hữu

- [x] GitHub repository mới đã tạo — `khanhtmxmla1-sys/tohieuquiz` (private).
- [x] Cloudflare account mới đã tạo.
- [x] Vercel account/team mới đã tạo — `vh-s-projects3`.
- [x] Tên miền `thtohieu.com` thuộc quyền sở hữu của dự án.
- [ ] Email quản trị doanh nghiệp đã bật 2FA.
- [ ] Cloudflare/Vercel/GitHub đều đã bật 2FA.
- [ ] Mã khôi phục được lưu trong password manager.

## 2. Cloudflare resources

- [x] Worker `tohieuquiz-api` — đã deploy tại `api.thtohieu.com`.
- [x] D1 `tohieuquiz-db` — schema và migration registry đã bootstrap.
- [x] R2 `tohieuquiz-og-images`.
- [x] R2 `tohieuquiz-certificates` (private).
- [x] Queue `tohieuquiz-certificate-generation`.
- [x] Dead-letter queue `tohieuquiz-certificate-generation-dlq`.
- [x] Consumer Worker `tohieuquiz-certificate-consumer` — đã deploy.
- [x] Thay placeholder ID/URL trong hai file Wrangler.
- [x] Cấp `JWT_SECRET` mới.
- [ ] `CLIPROXY_TOKEN` hiện là giá trị tạm — phải thay khi có dịch vụ AI thật.
- [x] Chạy migration trên database mới, không import dữ liệu cũ.
- [ ] Xác nhận 3 cron trigger chạy đúng chu kỳ.

## 3. Domain và CORS

- [x] Chốt domain web, API, phụ huynh và asset.
- [x] Không còn `.invalid` trong mã và biến môi trường.
- [x] Khai báo `ALLOWED_ORIGINS` chính xác — đã kiểm chứng bằng test `productionDomainConfig`.
- [x] Cấu hình DNS và SSL — `www`, `phuhuynh`, `api`, `assets` đều phục vụ HTTPS.
- [x] Cập nhật canonical, Open Graph, robots và sitemap.

## 4. Vercel/frontend

- [x] Liên kết repository mới — Git integration đã xác nhận bằng deploy tự động từ `main`.
- [x] Production branch là `main`.
- [x] Điền `VITE_WORKERS_API_URL` (để trống, dùng rewrite `/api`) và các feature flag.
- [ ] Phát hành upload media qua Worker xác thực + R2 (`media/` trên `assets.thtohieu.com`); mã và release gates đã hoàn tất, còn deploy Worker + frontend.
- [ ] Kiểm tra preview deployment không gọi API của hệ thống nguồn.

## 5. Email, AI và monitoring

- [ ] Email sender mới đã xác minh SPF, DKIM và DMARC.
- [ ] AI key/proxy và ngân sách cảnh báo thuộc dự án mới.
- [ ] Monitoring/logging thuộc tài khoản mới.
- [x] Không có webhook hoặc callback URL cũ — security scan pass trên 1616 file.

## 6. Bảo vệ nhánh và release-readiness

- [x] Workflow `release-readiness.yml` chạy trên pull request và `main`, không chứa lệnh deploy.
- [x] Gate bao phủ typecheck frontend/Worker, Vitest, coverage, build, performance budget, security/dependency audit, migration contract và Cypress V2/V3.
- [x] Mỗi run sinh artifact JSON có trạng thái `ready` hoặc `blocked`.
- [x] CODEOWNERS bao phủ workflow, security, JWT, migration và Wrangler.
- [ ] Áp dụng desired state trong `.github/branch-protection.yml` lên GitHub và lưu bằng chứng remote; file trong repo không tự thay đổi cài đặt GitHub. Hiện GitHub API trả HTTP 403 do repository private trên gói chưa hỗ trợ branch protection.
- [ ] Xác minh PR lỗi, stale approval, direct push và force push đều bị chặn theo `docs/operations/branch-protection.md`.

## 7. Kiểm tra trước deploy

```bash
npm ci
cd workers && npm ci && cd ..
npm run security:check
npx tsc --noEmit
npx tsc -p workers/tsconfig.json --noEmit
npm run test:run
npm run build
```

Kiểm thử đầu-cuối chạy riêng vì phụ thuộc cờ tính năng — xem `docs/testing/e2e.md`:

```bash
npm run dev                      # terminal khác
npm run cypress:run:stubbed
npm run cypress:run:blueprint-v3 # với VITE_FEATURE_AI_BLUEPRINT_V3=true
npm run cypress:run:component
```

- [x] Toàn bộ quality gate ở trên đều pass (typecheck, 1283 unit test, security scan, build).
- [x] Cypress: 25 test stubbed + 2 test Blueprint V3 + 9 component test đều pass.
- [ ] Đăng nhập đủ vai trò trên production (chờ tài khoản quản trị đầu tiên).
- [ ] Tạo đề, giao bài, làm bài và chấm điểm.
- [ ] Thi trực tiếp.
- [ ] Phiếu kết quả và liên kết phụ huynh.
- [ ] Chứng nhận và queue consumer.
- [ ] Email xác minh/quên mật khẩu.
- [ ] Backup và phục hồi thử nghiệm.

## 8. Sau deploy

- [x] `/api/health` trả 200 — cả trực tiếp lẫn qua rewrite frontend.
- [x] Frontend production trả 200 trên cả ba domain.
- [x] API bảo vệ trả 401 khi thiếu phiên — đã kiểm tra 5 endpoint.
- [ ] Smoke test thủ công trên desktop và mobile.
- [ ] Theo dõi log và chi phí ít nhất 30 phút sau mỗi lần bật cờ tính năng.

## 9. Rollout cờ tính năng

Thứ tự và điều kiện xem `docs/ROADMAP.md` giai đoạn 5. Tất cả cờ hiện đang `false`
trên production.

- [ ] Unified Notifications (cờ server `unified_notifications_v1`).
- [ ] Gift Shop V2.
- [ ] AI Quiz V2.
- [ ] AI Blueprint V3.
- [ ] Parent Portal V1.
