-- Hoàn nguyên 0043_create_rate_limits.sql.
--
-- CẢNH BÁO: sau khi chạy script này, mọi endpoint đăng nhập sẽ trả 503 vì chúng dùng
-- `failureMode: 'closed'`. Chỉ chạy khi đồng thời hoàn nguyên mã nguồn về bản không dùng bảng này.
-- Dữ liệu bị mất chỉ là bộ đếm tạm trong cửa sổ 15 phút, không phải dữ liệu nghiệp vụ.
DROP TABLE IF EXISTS rate_limits;
