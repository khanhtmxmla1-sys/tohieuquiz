# Hồ sơ hoàn thiện Trạng Nguyên Nhí 2026–2027

**Ngày kiểm kê:** 12/09/2026

**Slug:** `trang-nguyen-nhi-2026-2027`

**Nguồn đối chiếu công khai:** `GET /api/public/competitions/trang-nguyen-nhi-2026-2027`

Tài liệu này phân biệt dữ liệu đã kiểm chứng với quyết định nghiệp vụ chưa được Ban tổ chức chốt. Không dùng các giá trị đề xuất trong tài liệu để tự động thay đổi production.

## Trạng thái đã kiểm chứng

- Trang chiến dịch đang hoạt động (`ONGOING`) và truy cập công khai được.
- Năm học: 2026–2027; múi giờ canonical: `Asia/Ho_Chi_Minh`.
- Có sáu vòng. Tại thời điểm kiểm kê, vòng 1 và vòng 2 đang mở.
- Có một bài đã công bố: “Hướng dẫn tham gia Trạng Nguyên Nhí 2026-2027”, loại `ANNOUNCEMENT`.
- Chưa có bài công khai loại `RULES` hoặc `SCHEDULE` trong projection hiện tại.
- Bảng vàng chưa khả dụng (`goldenBoardAvailable: false`).
- Mã nguồn đã hỗ trợ quản lý/công bố/lưu trữ bài viết, preflight vòng thi, thi cấp trường, đối soát kết quả, luật giải, bảng vàng, export và chứng nhận.

## Lịch hiện đang công khai

Tất cả thời gian dưới đây đã đổi sang giờ Việt Nam (UTC+7).

| Mốc | Mở | Đóng | Nhận xét cần xử lý |
| --- | --- | --- | --- |
| Chiến dịch | 25/08/2026 23:59 | 01/05/2027 23:59 | Cần xác định rõ giai đoạn 01–04/2027 |
| Vòng 1 | 24/08/2026 07:59 | 01/12/2026 23:59 | Mở trước chiến dịch khoảng 2 ngày |
| Vòng 2 | 10/09/2026 16:02 | 31/12/2026 16:02 | Giờ phút lẻ, cần xác nhận có chủ đích |
| Vòng 3 | 25/09/2026 16:12 | 31/12/2026 16:13 | Giờ phút lẻ |
| Vòng 4 | 10/10/2026 16:13 | 31/12/2026 16:13 | Giờ phút lẻ |
| Vòng 5 | 25/10/2026 16:14 | 31/12/2026 16:14 | Giờ phút lẻ |
| Vòng 6 | 09/11/2026 16:14 | 31/12/2026 16:15 | Giờ phút lẻ |

Không chỉnh lịch khi đang có vòng mở nếu chưa đánh giá học sinh đã tham gia, thông báo thay đổi và phương án bảo toàn lượt thi.

## Các quyết định Ban tổ chức cần chốt

| Mức | Quyết định | Thông tin cần cung cấp | Kết quả sau khi chốt |
| --- | --- | --- | --- |
| P0 | Phạm vi dự thi | Khối/lớp/trường nào được tham gia | Kiểm tra audience và thông báo công khai |
| P0 | Luật sáu vòng | Số lượt, điểm đạt, điều kiện mở vòng tiếp theo | Đối chiếu cấu hình từng vòng và đề thi |
| P0 | Lịch chính thức | Giữ lịch hiện tại hay dùng các giờ tròn | Cập nhật lịch có audit và thông báo trước |
| P0 | Điều kiện thi cấp trường | Cần qua 6/6 hay 5/6 vòng; có ngoại lệ hay không | Cấu hình eligibility và bài thể lệ |
| P0 | Xử lý sự cố | Mất mạng, mất lượt, gián đoạn, thi lại, phúc khảo | Runbook hỗ trợ và thông báo cho học sinh |
| P1 | Cơ cấu giải | Theo khối hay toàn cuộc thi; số lượng và cách xử lý đồng điểm | Tạo/activate phiên bản luật giải |
| P1 | Giai đoạn 01–04/2027 | Ôn luyện, thi cấp trường, đối soát, phúc khảo, trao giải | Hoàn thiện lịch tổng thể |
| P1 | Đầu mối hỗ trợ | Người/nhóm tiếp nhận và thời hạn phản hồi | Bổ sung bài hướng dẫn và FAQ |

## Bộ nội dung cần công bố

### 1. Bài `RULES` — Thể lệ Trạng Nguyên Nhí 2026–2027

Bài chỉ được công bố sau khi điền đủ các mục:

1. Mục tiêu và đơn vị tổ chức.
2. Đối tượng, phạm vi lớp/khối và điều kiện tài khoản.
3. Nội dung hoặc môn thi theo từng khối.
4. Lịch sáu vòng và lịch thi cấp trường.
5. Thời lượng, số lượt và điểm đạt từng vòng.
6. Điều kiện đủ tư cách thi cấp trường.
7. Cách xếp hạng: điểm, số câu đúng và thời gian.
8. Quy định thiết bị, trung thực và giám sát.
9. Quy trình báo sự cố, thi lại và phúc khảo.
10. Cơ cấu giải, bảng vàng và chứng nhận.

### 2. Bài `SCHEDULE` — Lịch thi chính thức

Nên trình bày thời gian theo `dd/mm/yyyy HH:mm`, ghi rõ “giờ Việt Nam”, kèm trạng thái từng vòng và thời điểm cập nhật gần nhất. Nếu lịch thay đổi, giữ thông báo thay đổi riêng thay vì âm thầm sửa bài cũ.

### 3. Bài `GUIDE` — Hướng dẫn và hỗ trợ

Bổ sung vào nội dung hiện có:

- kiểm tra đúng tài khoản, lớp và khối trước khi vào thi;
- không tải lại hoặc đổi thiết bị khi đang nộp bài;
- thông tin cần gửi khi báo lỗi: họ tên, lớp, vòng thi, thời điểm và ảnh lỗi;
- đầu mối tiếp nhận và thời hạn phản hồi;
- lưu ý không đăng mật khẩu, mã truy cập hay dữ liệu cá nhân lên kênh công khai.

### 4. Bài `AWARD` — Cơ cấu giải

Chỉ công bố sau khi có phiên bản luật giải được duyệt. Nội dung bài phải khớp hoàn toàn với cấu hình backend; không nhập người thắng bằng tay để thay thế kết quả xếp hạng.

## Checklist kỹ thuật trước mỗi vòng

- [ ] Audience đúng phạm vi và snapshot đã khóa theo quy trình.
- [ ] Mỗi khối có đúng quiz mapping và snapshot đề thi.
- [ ] Số lượt, điểm đạt, giờ mở/đóng và prerequisite đã được hai người kiểm tra.
- [ ] Preflight trả `READY` cho tài khoản thử hợp lệ và lý do thân thiện cho các trường hợp bị chặn.
- [ ] Thử trên staging: đăng nhập → đọc quy chế → preflight → làm bài → nộp → tải lại.
- [ ] Kiểm tra hết giờ, gửi lặp, mất mạng và khôi phục phiên.
- [ ] Không dùng tài khoản học sinh thật để tạo attempt thử trên production.
- [ ] Có thông báo mở vòng và đầu mối hỗ trợ trước giờ thi.

## Điều kiện hoàn thành mốc vận hành

Mốc vận hành chỉ đạt khi bài `RULES` và `SCHEDULE` đã công bố, sáu vòng có đề/mapping/snapshot hợp lệ, audience và quy tắc đủ điều kiện được xác minh, staging rehearsal đạt, và production smoke chỉ đọc không phát sinh attempt.

Mốc tổng kết chỉ đạt sau khi vòng thi thực sự kết thúc, dữ liệu được đối soát, eligibility được chốt, luật giải được kích hoạt, kết quả được công bố, bảng vàng hiển thị đúng và chứng nhận/export được kiểm tra.
