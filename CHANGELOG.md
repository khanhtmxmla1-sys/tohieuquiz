# Changelog — TôHiệuQuiz

Tất cả thay đổi đáng chú ý của sản phẩm được ghi lại tại đây.

## [Unreleased]

### Added

- Khởi tạo codebase độc lập TôHiệuQuiz với lịch sử Git mới.
- Cấu hình placeholder an toàn cho Cloudflare, Vercel, domain, email và AI.
- Namespace riêng cho JWT, local storage, Worker, D1, R2 và Queue.
- Bộ tài liệu thiết lập hệ thống mới và checklist triển khai.

### Changed

- Đổi nhận diện hiển thị và định danh kỹ thuật sang TôHiệuQuiz.
- CORS production chuyển sang allowlist qua `ALLOWED_ORIGINS`.
- Cloudinary không còn dùng tài khoản/preset mặc định; phải cấu hình riêng.
- Sitemap không tự gọi API khi chưa khai báo URL.

### Removed

- Dữ liệu cục bộ, cache, log, artifact, cấu hình deployment và tài liệu lịch sử của hệ thống nguồn.
- Account ID, database ID, domain, token, bucket và queue của hệ thống nguồn.
- Script cài đặt dịch vụ bên thứ ba gắn với máy hoặc tài khoản cũ.
