# Ngưỡng cảnh báo vận hành TôHiệuQuiz

Mỗi cảnh báo dùng metric có cardinality thấp. Không dùng request ID, username, email hoặc URL query làm label. Request ID chỉ dùng để điều tra sau khi cảnh báo đã kích hoạt.

## API 5xx

- Threshold: tỷ lệ 5xx trên route family vượt 1% trong 5 phút và có ít nhất 20 request.
- Owner: Backend/Worker on-call.
- Cooldown: 15 phút.
- Runbook: lọc `worker_request_completed` theo `status >= 500`, route template và release; đối chiếu `worker_request_failed` bằng request ID; rollback release nếu lỗi tăng ngay sau deploy.

## Login failures

- Threshold: lỗi 401/403 ở `/api/login`, `/api/student-login` hoặc `/api/parent/login` cao gấp 3 baseline trong 10 phút.
- Owner: Security owner.
- Cooldown: 30 phút.
- Runbook: kiểm tra release, cookie policy, JWT mode và origin guard; không log credential hoặc username; chuyển auth mode theo rollback runbook nếu là regression.

## Rate limit 429

- Threshold: phản hồi 429 vượt 5% trên một route family trong 10 phút.
- Owner: Backend/abuse owner.
- Cooldown: 30 phút.
- Runbook: phân biệt traffic hợp lệ và abuse bằng route family, method và edge metadata; không nới limit trước khi xác nhận nguyên nhân.

## Queue/DLQ

- Threshold: DLQ có message mới hoặc backlog queue không giảm trong 10 phút.
- Owner: Certificate/queue owner.
- Cooldown: 15 phút.
- Runbook: dừng retry hàng loạt, kiểm tra consumer release và R2; replay theo batch ID đã audit, không đưa payload thô vào ticket.

## Certificate failures

- Threshold: tỷ lệ batch/certificate `failed` hoặc `partial` vượt 2% trong 15 phút.
- Owner: Certificate owner.
- Cooldown: 30 phút.
- Runbook: kiểm tra queue, R2 và renderer; lấy request ID/batch ID giả lập khi chia sẻ; dùng retry idempotent sau khi dependency khỏe.

## AI failures and cost

- Threshold: lỗi AI vượt 5% trong 10 phút hoặc chi phí/ngày vượt 80% ngân sách cảnh báo.
- Owner: AI/platform owner.
- Cooldown: 60 phút.
- Runbook: kiểm tra provider, quota, timeout và release; tắt rollout AI nếu lỗi hoặc chi phí tiếp tục tăng; không log prompt, câu hỏi, đáp án hoặc token.

## Web Vitals

- LCP: cảnh báo khi p75 vượt 2.5 giây trong 30 phút.
- INP: cảnh báo khi p75 vượt 200 ms trong 30 phút.
- CLS: cảnh báo khi p75 vượt 0.1 trong 30 phút.
- Owner: Frontend performance owner.
- Cooldown: 60 phút.
- Runbook: so sánh route pathname và release; kiểm tra bundle report, long task và layout shift; không thu thập selector chứa dữ liệu người dùng.

## API latency

- Core read: cảnh báo khi p95 vượt 500 ms trong 15 phút.
- Heavy analytics: cảnh báo khi p95 vượt 1.5 giây trong 15 phút.
- Owner: Backend/Worker on-call.
- Cooldown: 30 phút.
- Runbook: lọc theo route template, kiểm tra D1 query/index và dependency timeout; không ghi SQL hoặc bind values vào log.
