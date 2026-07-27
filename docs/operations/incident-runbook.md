# Incident runbook

## Khi nào mở incident

Mở incident khi có một trong các dấu hiệu:

- production smoke thất bại sau deploy;
- health endpoint không trả 200;
- lỗi 5xx tăng liên tục trong 5 phút;
- người dùng không thể đăng nhập, làm bài, nộp bài hoặc xem kết quả;
- queue chứng nhận không tiến triển hoặc tạo dữ liệu trùng;
- phát hiện nguy cơ rò rỉ token, PIN hoặc dữ liệu học sinh.

## Mức độ

- **SEV-1:** mất toàn bộ dịch vụ, lỗi bảo mật hoặc nguy cơ sai/mất dữ liệu. Dừng rollout và rollback ngay.
- **SEV-2:** một luồng chính bị hỏng cho nhiều người dùng nhưng hệ thống còn hoạt động. Dừng rollout, điều tra tối đa 15 phút rồi quyết định rollback.
- **SEV-3:** suy giảm nhỏ, có workaround và không ảnh hưởng dữ liệu. Tạo issue, không mở rộng rollout.

## 10 phút đầu

1. Ghi thời điểm bắt đầu, release SHA, frontend deployment ID và Worker version.
2. Dừng mọi rollout hoặc migration tiếp theo.
3. Chạy production smoke để xác định phạm vi frontend/API/parent portal.
4. Kiểm tra `/api/health` trực tiếp và qua rewrite `/api/health`.
5. Lấy một `x-request-id` từ request lỗi và truy vết log.
6. So sánh error rate/status/duration với thời điểm trước deployment.
7. Kiểm tra feature flags vừa thay đổi; tắt flag rủi ro trước khi redeploy nếu có thể.
8. Chọn khôi phục nhanh nhất: tắt flag, rollback frontend, rollback Worker hoặc rollback cả hai.

## Chẩn đoán theo triệu chứng

### Frontend trắng trang hoặc lỗi chunk

- Tìm `stale_chunk_error` và `react_error_boundary` theo release.
- Kiểm tra `index.html` không bị cache lâu và asset hashed còn tồn tại.
- Chạy lại smoke phần trang công khai/asset.
- Rollback frontend nếu lỗi gắn rõ với deployment mới.

### API 5xx

- Tìm `worker_request_failed` theo request ID.
- Đối chiếu route, method, errorName và deployment Worker.
- Không yêu cầu người dùng gửi token/cookie để debug.
- Rollback Worker nếu lỗi xuất hiện sau deploy và ảnh hưởng route chính.

### Login hoặc CORS hỏng

- Kiểm tra `ALLOWED_ORIGINS`, environment và origin thực tế.
- Chạy smoke direct health với Origin chính thức.
- Không mở wildcard CORS để chữa cháy.

### Database/migration

- Dừng write-heavy rollout.
- Kiểm tra migration đã áp dụng và khả năng tương thích ngược.
- Không chạy migration đảo ngược khi chưa xác nhận dữ liệu có thể phục hồi.
- Ưu tiên deploy code tương thích với schema hiện tại.

## Điều kiện rollback bắt buộc

Rollback ngay khi:

- smoke fail hai lần liên tiếp sau deploy;
- health fail quá 2 phút;
- lỗi 5xx vượt 1% trong 5 phút hoặc tăng gấp ba baseline;
- có sai lệch dữ liệu, lộ thông tin hoặc auth bypass;
- không xác định nguyên nhân SEV-1 trong 10 phút;
- không xác định nguyên nhân SEV-2 trong 15 phút.

## Sau khi ổn định

- Chạy lại smoke và xác nhận health/CORS/asset.
- Theo dõi tối thiểu 30 phút với SEV-1/2.
- Ghi timeline, request IDs đã khử dữ liệu, nguyên nhân và hành động phòng ngừa.
- Thêm test tái hiện trước khi triển khai lại bản sửa.
