-- Bảng đếm rate limit theo cửa sổ cố định, dùng bởi middleware/rateLimit.ts và utils/loginRateLimit.ts.
--
-- Vì sao migration này cần thiết: hai đường dẫn đăng nhập (`/api/login`, `/api/student-login`)
-- và đăng nhập phụ huynh chạy rate limit với `failureMode: 'closed'` (workers/src/index.ts).
-- Bảng này trước đây chỉ được khai báo trong `data/migrations/007_create_notifications.sql`
-- của hệ thống cũ và trong `ensureRateLimitTable()` (hàm không được gọi ở đâu), nên trên một D1
-- bootstrap mới bảng không tồn tại → mọi truy vấn INSERT ném lỗi → toàn bộ đăng nhập trả 503.
--
-- Hình dạng bảng phải khớp `ensureRateLimitTable()` để hai đường tạo bảng không lệch nhau.
-- Mọi truy cập đều theo khoá chính `key`, nên không thêm index phụ (tránh chi phí ghi mỗi lần đăng nhập).
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);
