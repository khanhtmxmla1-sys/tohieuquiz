# TôHiệuQuiz — Checkpoint triển khai

Cập nhật: **26/07/2026 (phiên 2)**

Tài liệu này là điểm tiếp tục công việc cho phiên sau. Không lưu token, OTP, secret, URL OAuth hoặc mã khôi phục trong file này.

## Phạm vi và repository

- Workspace local: `C:\quizpro`.
- Repository GitHub private: `khanhtmxmla1-sys/tohieuquiz`.
- Nhánh: `main`.
- Hệ thống cũ iTongQuiz phải tiếp tục được giữ tách biệt và không được sửa nếu chưa có yêu cầu rõ ràng.

## Chất lượng mã nguồn (đã xác minh phiên 2)

- `npx tsc --noEmit`: 0 lỗi.
- `npx tsc -p workers/tsconfig.json --noEmit`: 0 lỗi.
- `npm run test:run`: **266 file test / 1272 test pass**, 0 fail (~306s).
- `npm run security:scan`: pass (1616 file được kiểm tra).
- Không còn `TODO`/`FIXME` trong `src/` hoặc `workers/src/`.

## Cloudflare đã hoàn tất

- Domain chính: `thtohieu.com`.
- D1: `tohieuquiz-db`, APAC, schema và migration registry đã bootstrap đầy đủ.
- Dữ liệu người dùng/nghiệp vụ trong D1 vẫn rỗng; chỉ có seed hệ thống không nhạy cảm.
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

## BLOCKER hiện tại — 3 custom domain vẫn thuộc project Vercel cũ

Đây là việc **cần người dùng thao tác thủ công**, CLI không xử lý được.

Bằng chứng đã thu thập:

- `vercel domains add <domain>` báo "Success! Domain added to project tohieuquiz", nhưng gọi lại lần hai trả về:
  `Error: Cannot add www.thtohieu.com since it's already assigned to another project. (400)`
- `vercel domains inspect thtohieu.com` trả `403 You don't have access to "thtohieu.com"` → domain vẫn nằm trong account/team Vercel cũ.
- `vercel inspect https://tohieuquiz-nu.vercel.app` cho thấy deployment production mới **chỉ có alias `*.vercel.app`**:
  - `tohieuquiz-nu.vercel.app`
  - `tohieuquiz-vh-s-projects3.vercel.app`
  - `tohieuquiz-khanhtmxmla1-sys-vh-s-projects3.vercel.app`
  → Không có `thtohieu.com`, `www.thtohieu.com`, `phuhuynh.thtohieu.com`.
- Ba domain vẫn trả `200` nhưng đang được **project Vercel cũ** phục vụ (DNS `A @ 76.76.21.21` và `CNAME` trỏ Vercel; Vercel định tuyến theo project đang sở hữu domain).
- `_vercel` TXT hiện **không tồn tại** trên DNS (`nslookup -type=TXT _vercel.thtohieu.com` → Non-existent domain).

### Việc người dùng cần làm (thủ công, trên Vercel Dashboard)

1. Đăng nhập Vercel bằng **account cũ** (trước đây là `bskhanh01-5922`, team `team_oB46Nsd5UwCuCeeq1wNcguK2`).
2. Mở project cũ → Settings → Domains → **Remove** cả ba domain:
   - `thtohieu.com`
   - `www.thtohieu.com`
   - `phuhuynh.thtohieu.com`
3. (Khuyến nghị) Xóa luôn project cũ để tránh nhầm lẫn về sau.
4. Quay lại account `khanhtmxmla1-sys` → project `vh-s-projects3/tohieuquiz` → Settings → Domains → thêm lại ba domain.
5. Nếu Vercel yêu cầu xác minh, copy **TXT `_vercel` challenge mới** từ giao diện project mới và tạo record tương ứng trên Cloudflare DNS. Không tái sử dụng challenge cũ.

### Sau khi domain đã thuộc project mới

Chạy lại bộ smoke test:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://thtohieu.com/
curl -s -o /dev/null -w "%{http_code}\n" https://www.thtohieu.com/
curl -s -o /dev/null -w "%{http_code}\n" https://phuhuynh.thtohieu.com/
curl -s https://www.thtohieu.com/api/health
curl -s https://api.thtohieu.com/api/health
```

Và xác nhận bằng `vercel inspect https://tohieuquiz-nu.vercel.app` — ba domain phải xuất hiện trong danh sách Aliases.

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

- Chưa giải phóng 3 custom domain khỏi project Vercel cũ (BLOCKER ở trên).
- Chưa cấu hình dịch vụ AI thật tại `ai.thtohieu.com`; chưa thay `CLIPROXY_TOKEN` tạm.
- Chưa tạo tài khoản quản trị đầu tiên trong D1.
- Chưa cấu hình email provider, monitoring hoặc Cloudinary production.
- Chưa có CI GitHub Actions cho typecheck/test/build (hiện chỉ có `security.yml`).
- Chưa bật các feature flag đang để `false` (xem `docs/ROADMAP.md`, giai đoạn 1 và 5).
- Chưa chạy bộ Cypress E2E lần nào (9 suite e2e + 5 component).

## Nguyên tắc tiếp tục

- Không thay đổi hệ thống iTongQuiz cũ.
- Không đưa secret vào Git / biến `VITE_*` / tài liệu.
- Không làm public bucket chứng nhận; `tohieuquiz-certificates` phải tiếp tục là private.
- Sau mỗi thay đổi production: chạy health, CORS, auth guard và frontend smoke test.
- Khi thêm biến môi trường Vercel qua CLI trên Windows, dùng `<nul set /p "=value" |` để tránh newline lọt vào giá trị.
