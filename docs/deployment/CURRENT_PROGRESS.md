# TôHiệuQuiz — Checkpoint triển khai

Cập nhật: **26/07/2026**

Tài liệu này là điểm tiếp tục công việc cho phiên sau. Không lưu token, OTP, secret, URL OAuth hoặc mã khôi phục trong file này.

## Phạm vi và repository

- Workspace local: `C:\quizpro`.
- Repository GitHub private: `khanhtmxmla1-sys/tohieuquiz`.
- Nhánh: `main`.
- Commit khởi tạo đã push: `1eacc9921888e673a9179796484313d38e7986ef`.
- Hệ thống cũ iTongQuiz phải tiếp tục được giữ tách biệt và không được sửa nếu chưa có yêu cầu rõ ràng.

## Cloudflare đã hoàn tất

- Domain chính: `thtohieu.com`.
- D1: `tohieuquiz-db`, APAC, schema và migration registry đã bootstrap đầy đủ.
- Dữ liệu người dùng/nghiệp vụ trong D1 vẫn rỗng; chỉ có seed hệ thống không nhạy cảm.
- R2 public assets: `tohieuquiz-og-images`.
- R2 private certificates: `tohieuquiz-certificates`.
- Public R2 custom domain: `assets.thtohieu.com`, SSL active.
- Queue: `tohieuquiz-certificate-generation`.
- DLQ: `tohieuquiz-certificate-generation-dlq`.
- API Worker: `tohieuquiz-api`, đã deploy tại `api.thtohieu.com`.
- Certificate consumer: `tohieuquiz-certificate-consumer`, đã deploy.
- Queue chính đã có 1 producer và 1 consumer.
- `JWT_SECRET` đã được tạo mới và lưu trong Cloudflare Worker Secrets.
- `CLIPROXY_TOKEN` hiện là giá trị ngẫu nhiên tạm để cho phép deploy; AI chưa hoạt động vì `ai.thtohieu.com` chưa có dịch vụ thật. Phải thay token này khi cấu hình AI/proxy chính thức.

Smoke test Cloudflare đã đạt:

- `GET https://api.thtohieu.com/api/health` trả `status=ok`.
- CORS cho `https://www.thtohieu.com` đúng và cho phép credentials.
- Endpoint cần xác thực trả `401` khi không có phiên đăng nhập.
- Certificate assets: 10 font và 5 background đã upload, tải ngược và khớp SHA-256.

## DNS Cloudflare hiện tại

Các record public đã quan sát được:

```text
A      @           76.76.21.21
CNAME  www         cname.vercel-dns-0.com
CNAME  phuhuynh    cname.vercel-dns-0.com
```

TXT `_vercel` chưa được xác nhận public ở lần kiểm tra cuối. Không tái sử dụng challenge TXT cũ sau khi chuyển sang Vercel account/project khác; phải lấy challenge mới từ project đúng.

## GitHub đã hoàn tất

- GitHub CLI active account: `khanhtmxmla1-sys`.
- Repository `tohieuquiz` là private.
- Quyền CLI có `repo` và `workflow`.
- Local `main` theo dõi `origin/main`.

## Trạng thái Vercel cần lưu ý

### Tài khoản CLI

- Vercel CLI vừa đăng nhập thành công với account: `khanhtmxmla1-sys`.
- Trước đó CLI dùng account cũ `bskhanh01-5922` và đã tạo một project/deployment ở account cũ.

### Liên kết local hiện có

- Thư mục `.vercel` đang bị `.gitignore` bỏ qua.
- File `.vercel/project.json` có thể vẫn trỏ tới project được tạo dưới account/team Vercel cũ.
- Không được tiếp tục deploy dựa trên liên kết này trước khi xác minh và relink sang account `khanhtmxmla1-sys`.

### Deployment cũ

- Một frontend production đã từng deploy thành công tại `tohieuquiz.vercel.app` dưới account/team Vercel cũ.
- Build, CSP, HSTS, robots và sitemap đều đạt ở deployment đó.
- Không xem deployment cũ là production cuối cùng cho đến khi project được tạo/relink trong account Vercel đúng.

### Custom domains cũ

Ba domain đã từng được thêm vào project Vercel cũ nhưng ở trạng thái chưa xác minh:

- `thtohieu.com`
- `www.thtohieu.com`
- `phuhuynh.thtohieu.com`

Các TXT challenge cũ không nên dùng lại sau khi tạo project trong account đúng.

## Việc cần làm ngay ở phiên tiếp theo

1. Xác minh tài khoản:

```powershell
vercel whoami --no-color
```

Kết quả phải là `khanhtmxmla1-sys`.

2. Gỡ liên kết Vercel local cũ, chỉ xóa thư mục `.vercel` trong `C:\quizpro`:

```powershell
Remove-Item .vercel -Recurse -Force
```

3. Kiểm tra danh sách project trong account đúng:

```powershell
vercel projects ls --no-color
```

4. Tạo hoặc liên kết project private `tohieuquiz` dưới account/team đúng:

```powershell
vercel link --yes --project tohieuquiz
```

5. Kết nối repository private:

```powershell
vercel git connect https://github.com/khanhtmxmla1-sys/tohieuquiz.git --no-color
```

6. Cấu hình lại các biến Production tối thiểu:

```text
VITE_FEATURE_GIFT_SHOP_V2=false
VITE_FEATURE_AI_QUIZ_V2=false
VITE_FEATURE_AI_BLUEPRINT_V3=false
VITE_FEATURE_PARENT_PORTAL_V1=false
VITE_GIFT_SHOP_MODE=api
SITEMAP_SITE_URL=https://www.thtohieu.com
```

Không đặt secret trong biến `VITE_*`.

7. Deploy Production từ project đúng và xác minh `200`, CSP, HSTS, robots, sitemap.

8. Thêm lại ba custom domain vào project đúng. Lấy TXT `_vercel` challenge mới từ Vercel và cập nhật Cloudflare DNS.

9. Chỉ sau khi Vercel báo `verified=true`, chạy smoke test:

- `https://thtohieu.com`
- `https://www.thtohieu.com`
- `https://phuhuynh.thtohieu.com`
- `/api/health` qua frontend rewrite và trực tiếp tại `api.thtohieu.com`.

10. Xác nhận Git integration bằng một commit tài liệu nhỏ hoặc redeploy từ commit hiện tại; kiểm tra Vercel tự tạo deployment từ nhánh `main`.

## Chưa thực hiện hoặc cần quyết định sau

- Chưa cấu hình dịch vụ AI thật tại `ai.thtohieu.com`.
- Chưa thay `CLIPROXY_TOKEN` tạm bằng token thật.
- Chưa tạo tài khoản quản trị đầu tiên trong D1.
- Chưa cấu hình email provider, monitoring hoặc Cloudinary production.
- Chưa bật các feature flag đang để `false`.

## Nguyên tắc tiếp tục

- Không thay đổi hệ thống iTongQuiz cũ.
- Không đưa secret vào Git/Vercel `VITE_*`/tài liệu.
- Không làm public bucket chứng nhận.
- `tohieuquiz-certificates` phải tiếp tục là private.
- Sau mỗi thay đổi production: chạy health, CORS, auth guard và frontend smoke test.
