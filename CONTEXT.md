# TôHiệuQuiz — Domain Context

## Khái niệm cốt lõi

- **Quiz:** Bộ câu hỏi có thể tái sử dụng cho luyện tập, giao bài hoặc thi trực tiếp.
- **Assignment:** Quiz được giáo viên giao cho lớp hoặc học sinh với thời hạn và số lượt làm.
- **Live Exam Session:** Ca thi đồng bộ; học sinh tham gia cùng thời điểm và chỉ xem kết quả khi phiên kết thúc.
- **Result Report:** Phiếu kết quả và nhận xét có thể chia sẻ an toàn cho học sinh hoặc phụ huynh.
- **Certificate:** Chứng nhận được sinh từ mẫu và xử lý bất đồng bộ qua queue.
- **Weekly Quest:** Nhiệm vụ định kỳ thuộc hệ thống gamification.

## Trạng thái thi trực tiếp

1. `scheduled` — đã tạo nhưng chưa mở.
2. `waiting` — phòng chờ đang nhận học sinh.
3. `active` — bài thi đang diễn ra.
4. `scoring` — hệ thống đang chấm và tổng hợp.
5. `closed` — phiên kết thúc, kết quả được công bố.

## Nguyên tắc nghiệp vụ

- Bài giao có thể cho phép làm lại theo `maxAttempts`.
- Thi trực tiếp là một lượt làm đồng bộ và không công bố điểm sớm.
- Khi hết giờ, câu trả lời hiện có được tự động nộp.
- Phân quyền được kiểm tra tại Worker, không chỉ tại giao diện.
- Dữ liệu học sinh không được gửi tới AI khi không cần thiết.

## Mô-đun kỹ thuật

- Frontend: React + TypeScript + Vite.
- State: Zustand.
- Backend: Cloudflare Workers.
- Database: Cloudflare D1.
- Storage: Cloudflare R2.
- Background jobs: Cloudflare Queues.
- Authentication: JWT và cookie/session transport.
- Live synchronization: HTTP polling theo ADR-0001.

## Namespace hệ thống

- Package: `tohieuquiz`.
- Worker API: `tohieuquiz-api`.
- Database: `tohieuquiz-db`.
- Browser storage/session keys: tiền tố `tohieuquiz_`.
- JWT issuer: `tohieuquiz-api`.

Tên miền production chính thức là `thtohieu.com`. Sơ đồ hostname hiện tại:

- `www.thtohieu.com`: frontend chính.
- `api.thtohieu.com`: Cloudflare API Worker.
- `phuhuynh.thtohieu.com`: portal phụ huynh.
- `assets.thtohieu.com`: public R2 assets.
- `ai.thtohieu.com`: dành cho dịch vụ AI/proxy, hiện chưa cấu hình dịch vụ thật.

Checkpoint triển khai mới nhất được lưu tại `docs/deployment/CURRENT_PROGRESS.md`.
