# Thiết kế bộ icon thương hiệu TôHiệuQuiz

## Mục tiêu

Đưa bộ 12 icon riêng của TôHiệuQuiz vào dự án theo cách có kiểm soát, làm giao diện có bản sắc giáo dục rõ ràng hơn mà không thay thế các icon thao tác nhỏ đang dùng tốt từ Lucide.

## Phạm vi lần triển khai này

- Chuẩn hóa 12 icon thành 12 file WebP riêng, khung 256 × 256 px, nền trong suốt.
- Lưu tại `public/icons/tohieuquiz/`.
- Tạo component dùng chung `TohieuIcon` với danh sách tên icon được kiểm soát bằng TypeScript.
- Áp dụng thử nghiệm tại sáu thẻ “Thao tác nhanh” trên Dashboard giáo viên.
- Không thay icon trong Sidebar, nút sửa/xóa/tìm kiếm, trạng thái, cảnh báo hoặc form.
- Không thay đổi nghiệp vụ, điều hướng hoặc dữ liệu.

## Bộ icon

1. `overview` — Tổng quan
2. `quiz-create` — Tạo đề
3. `quiz-management` — Quản lý đề
4. `assignment` — Giao bài
5. `classroom` — Lớp học
6. `live-exam` — Thi trực tiếp
7. `learning-results` — Kết quả học tập
8. `certificate` — Chứng nhận
9. `parent-portal` — Phụ huynh
10. `notification` — Thông báo
11. `gift-shop` — Tiệm tạp hóa
12. `settings` — Cài đặt

## Quy tắc sử dụng

- Icon module lớn: 40–72 px; Dashboard thử nghiệm dùng 48 px.
- Icon là hình trang trí khi đã có nhãn chữ, vì vậy phải dùng `alt=""` và `aria-hidden="true"`.
- Không dùng icon ảnh ở kích thước 16–24 px; các vị trí này tiếp tục dùng Lucide.
- Mọi đường dẫn asset phải đi qua `TohieuIcon`, không viết rải rác trong component khác.
- Không thêm dependency ảnh mới.

## Kiến trúc

`TohieuIcon.tsx` sở hữu map tên icon → đường dẫn asset và render thẻ `img` có kích thước xác định. `DashboardQuickAction` chỉ lưu tên icon thương hiệu. `QuickActionGrid` render icon qua component này và giữ nguyên hành vi button, focus ring, responsive grid và nhãn chữ hiện tại.

## Trải nghiệm hình ảnh

- Bỏ màu icon Lucide khỏi sáu thẻ thử nghiệm.
- Duy trì nền thẻ sáng, viền nhẹ và hover hiện có.
- Khung icon dùng nền trung tính rất nhẹ để hình ảnh nổi rõ nhưng không tạo thêm hiệu ứng gradient/glow giả.
- Icon không được làm tăng chiều cao thẻ quá mức trên mobile.

## Kiểm thử

- Unit test map đường dẫn, kích thước và accessibility của `TohieuIcon`.
- Cập nhật test Dashboard để xác nhận sáu icon thương hiệu được render và các button vẫn điều hướng đúng.
- Chạy test liên quan, typecheck, lint và build.
- Kiểm tra axe hiện có cho Dashboard giáo viên.

## Tiêu chí hoàn thành

- Có đúng 12 file asset riêng.
- Sáu thẻ thao tác nhanh hiển thị icon riêng, không còn dùng Lucide cho phần minh họa module.
- Không có lỗi TypeScript, lint, test hoặc build mới.
- Không thay đổi Sidebar và các icon thao tác nhỏ.
