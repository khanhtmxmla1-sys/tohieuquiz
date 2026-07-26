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
