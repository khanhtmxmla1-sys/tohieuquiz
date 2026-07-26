# TôHiệuQuiz — Tổng quan kiến trúc

## Thành phần chính

- React + TypeScript + Vite cung cấp giao diện web.
- Zustand quản lý state phía client.
- Cloudflare Worker xử lý API, xác thực và nghiệp vụ.
- Cloudflare D1 lưu dữ liệu quan hệ.
- Cloudflare R2 lưu ảnh phiếu kết quả và chứng nhận.
- Cloudflare Queues xử lý render chứng nhận bất đồng bộ.

## Các mô-đun quan trọng

### Quiz player

`src/features/quiz-player/` điều phối quá trình làm bài, timer, trạng thái trả lời và chấm điểm phía client. Worker kiểm tra và lưu kết quả cuối cùng.

### Teacher dashboard

Giáo viên tạo và quản lý đề, giao bài, lớp học, kết quả, thi trực tiếp, thông báo và chứng nhận.

### Student dashboard

Học sinh xem bài được giao, luyện tập, kết quả, thành tích, bảng xếp hạng và thi trực tiếp.

### Parent portal

Phụ huynh kích hoạt liên kết, đăng nhập bằng mã/PIN và xem báo cáo học tập thuộc phạm vi được cấp.

### Certificate pipeline

API tạo batch và gửi queue. Consumer render ảnh, ghi R2, cập nhật D1 và phát thông báo. API Worker và consumer dùng cùng D1/R2 nhưng là hai Worker độc lập.

## Ranh giới bảo mật

- Worker là nguồn xác nhận quyền truy cập cuối cùng.
- Production CORS được cấu hình bằng `ALLOWED_ORIGINS`.
- JWT issuer/audience sử dụng namespace `tohieuquiz-*`.
- Browser storage sử dụng tiền tố `tohieuquiz_`.
- Secret chỉ nằm trong secret store của Cloudflare hoặc dịch vụ tương ứng.

## Môi trường

Production chạy trên tài nguyên thuộc tài khoản TôHiệuQuiz: Worker `tohieuquiz-api` tại `api.thtohieu.com`, D1 `tohieuquiz-db`, R2 `tohieuquiz-og-images` (public qua `assets.thtohieu.com`) và `tohieuquiz-certificates` (private), Queue `tohieuquiz-certificate-generation` kèm DLQ. Frontend chạy trên Vercel, tự động deploy từ nhánh `main`.

Các cờ tính năng (`VITE_FEATURE_*`) đang tắt trên production và được bật dần theo `docs/ROADMAP.md`. Trạng thái hạ tầng chi tiết: `docs/deployment/CURRENT_PROGRESS.md`.
