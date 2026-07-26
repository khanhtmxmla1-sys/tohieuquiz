# Thiết lập hệ thống TôHiệuQuiz mới

> **Trạng thái 26/07/2026:** phần lớn tài liệu này đã được thực hiện xong. Xem
> `docs/deployment/CURRENT_PROGRESS.md` để biết chính xác cái gì đã xong và cái gì còn lại.
> Giữ tài liệu này làm quy trình tham chiếu cho lần thiết lập tiếp theo (ví dụ môi trường staging).

Tài liệu này dùng cho lần triển khai đầu tiên của hệ thống độc lập. Không sao chép `.env`, token, resource ID hoặc dữ liệu từ hệ thống nguồn.

## Thông tin chủ sở hữu cần chốt

| Hạng mục | Giá trị cần chuẩn bị |
|---|---|
| Domain chính | `thtohieu.com` — đã chốt, DNS trên Cloudflare |
| GitHub repository | `khanhtmxmla1-sys/tohieuquiz` (private) — đã tạo |
| Vercel project | `vh-s-projects3/tohieuquiz` — đã tạo, Git integration hoạt động |
| Cloudflare account | Đã tạo — Worker, D1, R2, Queue đều đã deploy |
| Tên pháp lý/chủ sở hữu | Chưa điền |
| Email quản trị | Chưa điền |
| Email hỗ trợ | Chưa điền |
| Nhà cung cấp email | Chưa cấu hình |
| Nhà cung cấp AI/proxy | Chưa có dịch vụ thật tại `ai.thtohieu.com` |
| Monitoring | Chưa cấu hình |

Không lưu mật khẩu, OTP, recovery code hoặc API key trong bảng này.

## Tài nguyên Cloudflare

Tạo mới và ghi ID trong password manager/tài liệu nội bộ không commit:

- D1: `tohieuquiz-db`
- API Worker: `tohieuquiz-api`
- Certificate Worker: `tohieuquiz-certificate-consumer`
- R2: `tohieuquiz-og-images`
- R2: `tohieuquiz-certificates`
- Queue: `tohieuquiz-certificate-generation`
- DLQ: `tohieuquiz-certificate-generation-dlq`

Sau khi tạo, thay UUID placeholder trong:

- `workers/wrangler.toml`
- `workers/wrangler.certificate-consumer.toml`

## Domain đề xuất

- `www.<domain>`: trang web/ứng dụng chính.
- `api.<domain>`: Worker API và phiếu kết quả công khai.
- `phuhuynh.<domain>`: portal phụ huynh.
- `assets.<domain>`: public R2 assets.

Cập nhật các vị trí:

- `.env.example` và biến môi trường Vercel thực tế.
- Hai file Wrangler.
- `vercel.json`, `public/_headers`.
- `index.html`, `public/robots.txt`, sitemap.
- `workers/src/routes/phieu/constants.ts`.

## Khởi tạo database rỗng

1. Tạo D1 mới.
2. Điền D1 ID vào cấu hình.
3. Chạy toàn bộ migration theo thứ tự.
4. Xác minh schema bằng script audit.
5. Tạo duy nhất tài khoản quản trị ban đầu bằng quy trình được phê duyệt:
   `node workers/scripts/bootstrap-first-admin.mjs <username> "<họ tên>"` sinh SQL kèm mật khẩu
   tạm dùng một lần; chạy SQL bằng `wrangler d1 execute ... --config wrangler.toml`, rồi đăng nhập
   để đổi mật khẩu (tài khoản có `must_change_password = 1` nên mọi route khác bị chặn 403 đến khi
   đổi xong). Không tạo admin bằng hash sinh từ công cụ khác — encoding phải khớp
   `workers/src/utils/password.ts`.
6. Chỉ seed dữ liệu tổng hợp nếu cần demo.

Không export/import bảng từ database cũ.

## Secret mới

Tạo ngẫu nhiên và cấp qua secret store:

- `JWT_SECRET`
- `CLIPROXY_TOKEN`
- Email API key
- Webhook secrets
- Cloudinary credentials nếu sử dụng

Mọi secret của TôHiệuQuiz phải khác hoàn toàn hệ thống nguồn.

## Cổng kiểm tra trước khi mở production

- Không còn chuỗi `.invalid` trong bundle production.
- Không còn UUID `00000000-0000-0000-0000-000000000000` trong config deploy.
- Security scan, production dependency audit, typecheck, test và build đều đạt.
- CORS chỉ cho phép domain mới.
- JWT issuer/audience là `tohieuquiz-*`.
- Browser storage dùng namespace `tohieuquiz_*`.
- D1 mới không có dữ liệu người dùng cũ.
