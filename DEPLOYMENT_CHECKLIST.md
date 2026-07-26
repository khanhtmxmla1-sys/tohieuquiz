# TôHiệuQuiz — Deployment Checklist

Không deploy khi cấu hình vẫn chứa domain `.invalid` hoặc D1 ID toàn số 0.

## 1. Tài khoản và quyền sở hữu

- [ ] Email quản trị doanh nghiệp đã bật 2FA.
- [ ] GitHub organization/repository mới đã tạo.
- [ ] Cloudflare account mới đã tạo và bật 2FA.
- [ ] Vercel account/team mới đã tạo.
- [ ] Tên miền mới thuộc quyền sở hữu của dự án.
- [ ] Mã khôi phục được lưu trong password manager.

## 2. Cloudflare resources

- [ ] Worker `tohieuquiz-api`.
- [ ] D1 `tohieuquiz-db`.
- [ ] R2 `tohieuquiz-og-images`.
- [ ] R2 `tohieuquiz-certificates`.
- [ ] Queue `tohieuquiz-certificate-generation`.
- [ ] Dead-letter queue `tohieuquiz-certificate-generation-dlq`.
- [ ] Consumer Worker `tohieuquiz-certificate-consumer`.
- [ ] Thay placeholder ID/URL trong hai file Wrangler.
- [ ] Cấp `JWT_SECRET` và `CLIPROXY_TOKEN` mới.
- [ ] Chạy migration trên database mới, không import dữ liệu cũ.

## 3. Domain và CORS

- [ ] Chốt domain web, app, API, phụ huynh và asset.
- [ ] Thay toàn bộ `.invalid` trong mã và biến môi trường.
- [ ] Khai báo `ALLOWED_ORIGINS` chính xác.
- [ ] Cấu hình DNS và SSL.
- [ ] Cập nhật canonical, Open Graph, robots và sitemap.

## 4. Vercel/frontend

- [ ] Liên kết repository mới.
- [ ] Production branch là `main`.
- [ ] Điền `VITE_WORKERS_API_URL` và các feature flag.
- [ ] Cấu hình Cloudinary mới hoặc chuyển upload sang R2.
- [ ] Preview deployment không gọi API của hệ thống nguồn.

## 5. Email, AI và monitoring

- [ ] Email sender mới đã xác minh SPF, DKIM và DMARC.
- [ ] AI key/proxy và ngân sách cảnh báo thuộc dự án mới.
- [ ] Monitoring/logging thuộc tài khoản mới.
- [ ] Không có webhook hoặc callback URL cũ.

## 6. Kiểm tra trước deploy

```bash
npm ci
cd workers && npm ci && cd ..
npm run security:check
npx tsc --noEmit
npx tsc -p workers/tsconfig.json --noEmit
npm run test:run
npm run build
```

- [ ] Đăng nhập đủ vai trò.
- [ ] Tạo đề, giao bài, làm bài và chấm điểm.
- [ ] Thi trực tiếp.
- [ ] Phiếu kết quả và liên kết phụ huynh.
- [ ] Chứng nhận và queue consumer.
- [ ] Email xác minh/quên mật khẩu.
- [ ] Backup và phục hồi thử nghiệm.

## 7. Sau deploy

- [ ] `/api/health` trả 200.
- [ ] Frontend production trả 200.
- [ ] API bảo vệ trả 401 khi thiếu phiên.
- [ ] Smoke test trên desktop và mobile.
- [ ] Theo dõi log và chi phí ít nhất 30 phút.
