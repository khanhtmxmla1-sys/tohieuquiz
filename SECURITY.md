# TôHiệuQuiz Security Policy

**Cập nhật:** 2026-07-26

## Mô hình xác thực

- Giáo viên, quản trị viên, học sinh và phụ huynh sử dụng phiên JWT đã ký.
- Worker xác minh token và vai trò trước khi truy cập dữ liệu.
- Không hỗ trợ shared browser API token hoặc `X-API-Token`.
- Mật khẩu được lưu bằng PBKDF2 có salt.
- Thay `JWT_SECRET` sẽ vô hiệu hóa toàn bộ phiên hiện có.

## Quản lý secret

Secret production tối thiểu:

- `JWT_SECRET`
- `CLIPROXY_TOKEN`

Cấp secret bằng terminal tin cậy trong thư mục `workers/`:

```bash
npx wrangler secret put JWT_SECRET --config wrangler.toml
npx wrangler secret put CLIPROXY_TOKEN --config wrangler.toml
```

Không đặt credential trong:

- Biến bắt đầu bằng `VITE_`.
- Mã nguồn, test, tài liệu, CSV hoặc migration.
- GitHub issue, log build, ảnh chụp hoặc nội dung chat.
- `localStorage` hay nơi JavaScript phía trình duyệt có thể đọc.

## Dữ liệu nhạy cảm

- Repository mới không chứa dữ liệu, tài khoản hoặc export production từ hệ thống nguồn.
- Test fixture phải sử dụng danh tính giả.
- Không commit file `.env`, `.dev.vars`, database local, private key hoặc export D1.
- Dữ liệu học sinh gửi tới AI phải được giảm thiểu và không chứa thông tin nhận dạng khi không cần thiết.

## Kiểm tra bắt buộc

```bash
npm run security:scan
npm run audit:dependencies:production
npx tsc --noEmit
npx tsc -p workers/tsconfig.json --noEmit
npm run test:run
npm run build
```

## Sự cố secret hoặc dữ liệu

1. Thu hồi và tạo lại credential ngay lập tức.
2. Vô hiệu hóa phiên liên quan.
3. Gỡ dữ liệu khỏi cây Git hiện tại.
4. Làm sạch lịch sử Git nếu nội dung đã được commit/push.
5. Kiểm tra lại từ một clone sạch trước khi deploy.

Không báo cáo công khai token, mật khẩu, dữ liệu học sinh hoặc chi tiết khai thác chưa được xử lý.
