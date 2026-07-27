# Checklist phát hành theo giai đoạn

Checklist này dùng cho mọi lần phát hành TôHiệuQuiz có thay đổi frontend, Cloudflare Worker, feature flag hoặc D1. Người điều phối phải dừng ngay khi gặp bất kỳ điều kiện **STOP** nào; không được tiếp tục chỉ vì phần lớn kiểm tra đang xanh.

Tài liệu liên quan:

- [Quan sát hệ thống](./observability.md)
- [Xử lý sự cố](./incident-runbook.md)
- [Rollback](./rollback.md)

## 1. Hồ sơ phát hành

- [ ] Người điều phối: `________________`
- [ ] Người phê duyệt kỹ thuật: `________________`
- [ ] Nhánh/PR: `________________`
- [ ] Commit dự kiến phát hành: `________________`
- [ ] Commit frontend trước phát hành: `________________`
- [ ] Version/Deployment ID Worker trước phát hành: `________________`
- [ ] Migration D1 liên quan: `không có / ____________________`
- [ ] Feature flag thay đổi: `không có / ____________________`
- [ ] Cửa sổ phát hành bắt đầu: `________________`
- [ ] Kênh liên lạc sự cố: `________________`
- [ ] Link log, dashboard và artifact kiểm thử: `________________`

## 2. Preflight bắt buộc

### 2.1 Chất lượng mã nguồn

- [ ] Nhánh phát hành đã cập nhật đúng base và không có file ngoài phạm vi.
- [ ] `npm ci` và `npm ci --prefix workers` hoàn tất từ lockfile.
- [ ] `npm run verify` xanh hoàn toàn.
- [ ] Workflow **Release readiness (no deployment)** xanh trên đúng commit.
- [ ] Release gate trả `status: ready` với rollout flag dự kiến:

```powershell
$env:VITE_FEATURE_GIFT_SHOP_V2='false'
$env:VITE_FEATURE_AI_QUIZ_V2='false'
$env:VITE_FEATURE_AI_BLUEPRINT_V3='false'
$env:VITE_FEATURE_PARENT_PORTAL_V1='false'
$env:VITE_GIFT_SHOP_MODE='api'
npm run release:readiness -- --base=origin/main
```

- [ ] Không có migration phá hủy chưa được phê duyệt và chưa có kế hoạch khôi phục dữ liệu.
- [ ] Bundle JavaScript không vượt ngưỡng release gate.
- [ ] Production smoke gần nhất xanh 4/4.

### 2.2 Khả năng quan sát và rollback

- [ ] Endpoint health, CORS và `x-request-id` đang hoạt động trước phát hành.
- [ ] Có thể tra cứu các event `worker_request_completed`, `worker_request_failed` và `client_error_reported`.
- [ ] Không có sự cố SEV-1/SEV-2 đang mở liên quan auth, dữ liệu hoặc API.
- [ ] Đã ghi commit/version cần rollback cho frontend và Worker.
- [ ] Đã xác định feature flag nào có thể tắt mà không cần deploy lại.
- [ ] Nếu có D1 migration: đã xác nhận phương án forward-fix, Time Travel/backup và người có quyền thực hiện.

**STOP:** Không phát hành khi thiếu bằng chứng cho bất kỳ mục bắt buộc nào ở trên.

## 3. Phát hành theo giai đoạn

Nếu nền tảng không hỗ trợ chia phần trăm traffic trực tiếp, dùng tài khoản nội bộ, cohort được kiểm soát hoặc feature flag để tạo phạm vi tương đương. Không bật đồng thời nhiều tính năng rủi ro cao.

### Giai đoạn A — Nội bộ/canary

Phạm vi: tài khoản nội bộ hoặc cohort nhỏ nhất có thể kiểm soát.

- [ ] Phát hành frontend hoặc Worker theo thứ tự đã ghi trong kế hoạch.
- [ ] Chạy production smoke chỉ đọc:

```bash
npm run cypress:run:production-smoke -- --site https://www.thtohieu.com --api https://api.thtohieu.com --parent https://phuhuynh.thtohieu.com
```

- [ ] Kiểm tra đăng nhập giáo viên, học sinh và trang phụ huynh bằng tài khoản thử nghiệm được phép.
- [ ] Kiểm tra một luồng đọc và một luồng ghi an toàn của tính năng thay đổi.
- [ ] Quan sát tối thiểu **10 phút**; kéo dài đến **15 phút** với thay đổi auth, Worker hoặc dữ liệu.
- [ ] Ghi tỷ lệ 5xx, client error, latency và request ID mẫu.

Chỉ chuyển giai đoạn khi toàn bộ tín hiệu ổn định và không có điều kiện STOP.

### Giai đoạn B — Khoảng 25% người dùng/cohort

- [ ] Mở rộng một feature flag hoặc cohort; không thay đổi thêm cấu hình khác trong cửa sổ quan sát.
- [ ] Chạy lại health, CORS, asset và smoke test.
- [ ] Quan sát tối thiểu **15 phút**; với thay đổi auth/dữ liệu, quan sát **30 phút**.
- [ ] So sánh 5xx, latency và client error với baseline trước phát hành.
- [ ] Xác nhận không có khiếu nại đăng nhập, mất dữ liệu hoặc kết quả sai.

### Giai đoạn C — 100%

- [ ] Chỉ mở 100% sau khi người điều phối và người phê duyệt cùng ký xác nhận.
- [ ] Chạy lại production smoke 4/4.
- [ ] Quan sát tích cực tối thiểu **30 phút** sau khi mở toàn bộ.
- [ ] Với migration, auth hoặc thay đổi luồng nộp bài: duy trì giám sát tăng cường **60 phút**.
- [ ] Không xóa rollback artifact hoặc tắt dashboard trong cửa sổ này.

## 4. Điều kiện STOP bắt buộc

Dừng mở rộng ngay và chuyển sang mục 5 khi có một trong các tín hiệu sau:

- Production smoke thất bại dù chỉ một bước.
- `/api/health` hoặc CORS không đạt hai lần liên tiếp trong vòng 2 phút.
- Tỷ lệ 5xx vượt **1% trong 5 phút** hoặc cao hơn **2 lần baseline**.
- Cùng một client error mới lặp lại ít nhất **5 lần trong 5 phút**.
- Bất kỳ regression nào về đăng nhập, refresh session, phân quyền hoặc logout.
- Bất kỳ dấu hiệu mất, trùng, ghi sai hoặc không đọc được dữ liệu.
- Response lỗi không có `x-request-id`, hoặc hơn **5%** mẫu response không có request ID.
- Latency tăng gấp đôi baseline trong 10 phút và ảnh hưởng luồng chính.
- Không thể xác định phiên bản hiện tại hoặc không thể thực hiện rollback đã chuẩn bị.

Khi STOP:

1. Không mở rộng thêm cohort hoặc flag.
2. Ghi timestamp, request ID, commit/deployment ID và ảnh chụp dashboard.
3. Phân loại SEV theo [incident runbook](./incident-runbook.md).
4. Chọn hành động trong ma trận rollback dưới đây.

## 5. Ma trận quyết định rollback

| Phạm vi lỗi | Hành động đầu tiên | Khi nào rollback | Lưu ý dữ liệu |
|---|---|---|---|
| Frontend/UI/asset | Tắt feature flag nếu có; giữ Worker hiện tại | Smoke/JS error/auth UI hỏng hoặc asset cũ không tải | Rollback về deployment frontend trước phát hành; chạy lại smoke |
| Cloudflare Worker/API | Dừng mở rộng frontend; rollback Worker version | 5xx, CORS, auth, request routing hoặc response shape lỗi | Xác nhận frontend tương thích với Worker cũ trước rollback |
| Feature flag | Tắt đúng flag gây lỗi | Lỗi chỉ xuất hiện khi flag bật | Không đổi nhiều flag cùng lúc; lưu giá trị trước/sau |
| D1 migration | Dừng mọi mutation liên quan; ưu tiên forward-fix | Chỉ rollback schema khi đã chứng minh an toàn | Không chạy `DROP` hoặc rollback phá hủy theo phản xạ; dùng Time Travel/backup theo [rollback runbook](./rollback.md) |
| Không xác định | Giảm phạm vi về canary; rollback lớp thay đổi gần nhất | Không cô lập được nguyên nhân trong 10 phút với SEV-1/2 | Bảo toàn log và request ID trước mọi thay đổi tiếp theo |

Sau rollback:

- [ ] Health/CORS đạt.
- [ ] Production smoke đạt 4/4.
- [ ] Tỷ lệ 5xx và client error trở về baseline.
- [ ] Auth/session và dữ liệu được kiểm tra lại.
- [ ] Incident timeline ghi đủ commit, deployment ID, flag và request ID.

## 6. Đóng phát hành

- [ ] Không còn điều kiện STOP trong toàn bộ cửa sổ quan sát.
- [ ] Dashboard/log không có event lỗi mới có tính hệ thống.
- [ ] Các feature flag ở đúng trạng thái mong muốn và đã được ghi lại.
- [ ] Kết quả smoke, release-readiness và `npm run verify` được đính kèm vào PR/release record.
- [ ] Người điều phối ký: `________________  thời gian: ____________`
- [ ] Người phê duyệt kỹ thuật ký: `________________  thời gian: ____________`
- [ ] Việc theo dõi sau phát hành được bàn giao cho: `________________`

Nếu có rollback hoặc SEV-1/2, không đánh dấu phát hành hoàn tất cho đến khi incident review và hành động phòng ngừa đã được tạo.