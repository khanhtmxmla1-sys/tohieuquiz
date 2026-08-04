# System Hanoi Time Zone Design

## Goal

Chuẩn hóa toàn bộ TôHiệuQuiz theo múi giờ `Asia/Ho_Chi_Minh` (UTC+7) cho mọi thời gian người dùng nhìn thấy, nhập vào và mọi quy tắc ngày nghiệp vụ; dữ liệu lưu trữ và giao tiếp API tiếp tục dùng UTC ISO-8601.

## Decisions

1. `Asia/Ho_Chi_Minh` là múi giờ nghiệp vụ duy nhất của hệ thống.
2. D1, Worker logs, payload API và các mốc tuyệt đối vẫn lưu dưới dạng UTC (`toISOString()`).
3. Mọi `datetime-local` được hiểu là giờ Hà Nội và chuyển sang UTC trước khi gửi API.
4. Mọi timestamp từ API được định dạng bằng utility tập trung có `timeZone: 'Asia/Ho_Chi_Minh'`; không phụ thuộc múi giờ máy người dùng hoặc máy chủ.
5. Các khóa ngày như điểm danh, quota AI, leaderboard tuần và nhắc hạn dùng ngày Hà Nội, không dùng local timezone của runtime và không dùng tên `Bangkok`.
6. Cron Cloudflare vẫn khai báo UTC. Tài liệu phải ghi rõ giờ UTC và giờ Hà Nội tương ứng.
7. Không migration dữ liệu chỉ để đổi múi giờ. Timestamp lịch sử không bị cộng thêm 7 giờ trong database.

## Architecture

### Shared contract

Tạo `shared/time-zone.contract.ts` chứa:

- `SYSTEM_TIME_ZONE = 'Asia/Ho_Chi_Minh'`
- `SYSTEM_LOCALE = 'vi-VN'`
- `SYSTEM_UTC_OFFSET = '+07:00'`
- `SYSTEM_UTC_OFFSET_MINUTES = 420`

Frontend và Worker cùng import contract này để tránh chuỗi múi giờ rải rác.

### Frontend utility

Mở rộng `src/utils/dateTime.ts` thành API chuẩn:

- `formatSystemDate`
- `formatSystemTime`
- `formatSystemDateTime`
- `formatSystemDateLong`
- `toSystemDateTimeLocal`
- `systemDateTimeLocalToIso`
- `getSystemDateKey`
- `getSystemWeekKey`

Các hàm trả fallback rõ ràng khi timestamp không hợp lệ. `toVietnamDateTimeLocal` và `vietnamDateTimeLocalToIso` được giữ alias tạm thời để không phá consumer hiện có, nhưng code mới dùng tên `System`.

### Worker utility

Tạo `workers/src/utils/systemTime.ts` dùng cùng contract:

- định dạng thông báo bằng giờ Hà Nội;
- tạo `YYYY-MM-DD` và ISO week key dựa trên ngày Hà Nội;
- giữ `now.toISOString()` cho timestamp lưu trữ;
- cung cấp helper chuyển local datetime sang UTC khi boundary Worker cần xác minh.

### Frontend migration

Thay toàn bộ lời gọi ngày giờ trực tiếp:

- `Date.prototype.toLocaleDateString`
- `toLocaleTimeString`
- `toLocaleString`
- `Intl.DateTimeFormat` tự tạo

bằng utility tập trung. Các lời gọi `toLocaleString` cho số tiền/xu không thay đổi.

Tất cả form `datetime-local` phải:

- hiển thị giá trị qua `toSystemDateTimeLocal`;
- chuyển sang ISO qua `systemDateTimeLocalToIso` trước API;
- ghi nhãn “Giờ Hà Nội (GMT+7)” ở các form có lịch/hạn quan trọng.

### Worker migration

Chuẩn hóa:

- điểm danh và streak;
- quota AI theo ngày;
- leaderboard tuần;
- nhắc hạn phụ huynh;
- nội dung thông báo hạn nộp;
- chứng nhận và ngày xuất;
- bất kỳ logic ngày nào đang dùng `Asia/Bangkok`, `getFullYear()` hoặc `toLocaleString` không chỉ rõ timezone.

### Cron

Không đổi biểu thức cron chỉ vì đổi hiển thị. Mỗi cron được rà soát theo mục đích nghiệp vụ và tài liệu hóa bảng quy đổi UTC ↔ Hà Nội. Nếu cron đang được thiết kế theo giờ Hà Nội nhưng biểu thức sai, sửa biểu thức và thêm test hợp đồng.

## Error handling

- Timestamp không hợp lệ không được render `Invalid Date`.
- Form local datetime không hợp lệ bị chặn trước khi gọi API.
- API tiếp tục nhận ISO UTC; Worker không âm thầm đoán timezone từ chuỗi không có offset ngoài các endpoint được định nghĩa là local-Hanoi input.
- Không tự sửa timestamp lịch sử thiếu timezone; các trường hợp legacy được xử lý theo contract hiện có và ghi test riêng nếu phát hiện.

## Testing

1. Unit test chạy dưới nhiều `TZ` khác nhau và luôn cho cùng kết quả Hà Nội.
2. Test mốc qua nửa đêm UTC, ví dụ `2026-08-04T18:00:00Z` phải là ngày `05/08/2026` tại Hà Nội.
3. Test `datetime-local` round-trip GMT+7 ↔ UTC.
4. Test ngày điểm danh/quota/tuần ở biên 17:00 UTC.
5. Test component tiêu biểu cho dashboard, Live Exam, homework, notification và report.
6. Static guard test cấm date formatting trực tiếp trong `src/` và `workers/src/`, ngoại trừ utility thời gian và định dạng số.
7. Full lint, typecheck, Worker typecheck, Vitest, Cypress smoke và build.

## Rollout

- Không có D1 migration.
- Frontend và Worker phải deploy cùng một release vì frontend sẽ gửi/hiển thị theo contract mới.
- Worker được upload 0%, smoke bằng version override, sau đó promote 100%; giữ version trước làm rollback.
- Sau deploy kiểm tra ít nhất: lịch thi, hạn bài tập, thông báo, kết quả, quota AI và điểm danh quanh mốc ngày Hà Nội.
