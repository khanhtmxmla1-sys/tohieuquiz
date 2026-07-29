# Observability vận hành TôHiệuQuiz

## Mục tiêu

Hệ thống phải trả lời nhanh bốn câu hỏi khi có sự cố:

1. Request nào lỗi và người vận hành có thể theo dõi nó bằng mã nào?
2. Route, phương thức, status và thời gian xử lý của request là gì?
3. Lỗi bắt đầu từ frontend, Worker hay một dependency phía sau?
4. Release nào đang chạy khi lỗi xuất hiện?

## Luồng tín hiệu

### Frontend

`src/observability/webVitals.ts` lấy mẫu mặc định 10% phiên và chỉ gửi LCP, INP, CLS. Payload không chứa query string, selector DOM, user ID, email, câu hỏi hoặc đáp án. Ngưỡng mục tiêu là LCP p75 ≤2,5 giây, INP p75 ≤200 ms và CLS p75 ≤0,1.

`src/services/observability/clientErrorReporter.ts` chỉ tạo payload allowlist:

- `event`
- `name`
- `message`
- `route` không có query string
- `release`
- `requestId`
- `componentStack` đã giới hạn độ dài
- `time`

Ba event ổn định:

- `react_error_boundary`
- `stale_chunk_error`
- `unhandled_rejection`

Reporter chỉ gửi khi `VITE_CLIENT_ERROR_REPORT_URL` được cấu hình. Giá trị production dự kiến là `/api/client-errors`. `VITE_RELEASE` nên là SHA commit hoặc deployment ID.

### Cloudflare Worker

Mỗi response có header `x-request-id`. Worker phát JSON log với các event chính:

- `worker_request_completed`: `requestId`, `routeTemplate`, `method`, `status`, `durationMs`, `roleCategory`
- `worker_request_failed`: thêm `errorCode`, `context`, `errorName`
- `client_error_reported`: nối `requestId` phía server với `clientRequestId` từ frontend
- `client_web_vital`: `requestId`, `clientRequestId`, pathname, release, metric name/value/rating

Không log request body, cookie, Authorization, JWT, PIN, đáp án học sinh, SQL, stack trace hoặc state của Zustand.

Ngưỡng latency: core read p95 dưới 500 ms; analytics nặng p95 dưới 1,5 giây. Alert, owner, cooldown và runbook được định nghĩa trong `docs/operations/alert-thresholds.md`.

## Cách truy vết

1. Lấy `x-request-id` từ response, ảnh lỗi hoặc log frontend.
2. Tìm chính xác `requestId` trong Cloudflare Logs.
3. Kiểm tra `worker_request_completed` để biết route/status/duration.
4. Nếu status 500, tìm `worker_request_failed` cùng request ID.
5. Nếu event bắt đầu từ trình duyệt, tìm `client_error_reported` và đối chiếu `clientRequestId`, route, release.
6. So sánh thời điểm bắt đầu lỗi với deployment gần nhất.

Ví dụ truy vấn logic:

```text
requestId = "<request-id>"
event = "worker_request_failed"
event = "client_error_reported" AND release = "<release-sha>"
event = "worker_request_completed" AND status >= 500
```

## Kiểm tra sau triển khai

Chạy workflow **Production smoke** hoặc:

```bash
npm run cypress:run:production-smoke -- \
  --site https://www.thtohieu.com \
  --api https://api.thtohieu.com \
  --parent https://phuhuynh.thtohieu.com
```

Smoke chỉ dùng GET, không đăng nhập và không thay đổi dữ liệu. Kết quả cần đạt:

- trang công khai tải không có lỗi JavaScript;
- security headers tồn tại;
- asset hashed trả 200 và immutable cache;
- same-origin `/api/health` và Worker health đều khỏe;
- CORS phản chiếu đúng origin chính thức;
- trang login phụ huynh được phục vụ.

## Bảo vệ dữ liệu

- Chỉ thêm field mới bằng allowlist và test redaction.
- Không dùng user ID, email hoặc request ID làm metric label.
- Không sao chép log production có dữ liệu thật vào issue công khai.
- Khi cần chia sẻ, giữ event/status/route/release và thay request ID bằng giá trị giả.
