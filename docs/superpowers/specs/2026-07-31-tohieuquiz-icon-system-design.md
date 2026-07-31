# Thiết kế bộ icon thương hiệu TôHiệuQuiz

## Mục tiêu

Đưa bộ icon riêng của TôHiệuQuiz vào dự án theo cách có kiểm soát, giúp giao diện có bản sắc giáo dục rõ ràng hơn nhưng vẫn giữ Lucide cho các thao tác nhỏ cần độ sắc nét cao.

## Phạm vi triển khai

- Chuẩn hóa 12 icon thành 12 file WebP riêng, khung 192 × 192 px, nền trong suốt.
- Lưu asset tại `public/icons/tohieuquiz/`.
- Tạo component dùng chung `TohieuIcon` với danh sách tên icon được kiểm soát bằng TypeScript.
- Áp dụng thử nghiệm tại sáu thẻ “Thao tác nhanh” trên Dashboard giáo viên.
- Không thay icon trong Sidebar, nút sửa/xóa/tìm kiếm, trạng thái, cảnh báo hoặc form.
- Không thay đổi nghiệp vụ, điều hướng, API hoặc dữ liệu.

## Danh mục icon

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

- Icon module lớn dùng ở kích thước 40–72 px; Dashboard thử nghiệm dùng 48 px.
- Khi đã có nhãn chữ bên cạnh, icon là hình trang trí và phải dùng `alt=""`, `aria-hidden="true"`.
- Không dùng icon ảnh ở kích thước 16–24 px; các vị trí này tiếp tục dùng Lucide.
- Mọi đường dẫn asset phải đi qua `TohieuIcon`, không viết rải rác trong các component khác.
- Không thêm dependency xử lý ảnh mới.

## Kiến trúc

`TohieuIcon.tsx` sở hữu bản đồ tên icon → đường dẫn asset và render thẻ `img` với kích thước xác định. `DashboardQuickAction` chỉ lưu tên icon thương hiệu. `QuickActionGrid` render icon qua component này và giữ nguyên hành vi button, focus ring, responsive grid và nhãn chữ hiện tại.

## Trải nghiệm hình ảnh

- Sáu thẻ thử nghiệm không còn dùng Lucide làm hình minh họa module.
- Giữ nền thẻ sáng, viền nhẹ và hover hiện có.
- Khung icon dùng nền pastel rất nhẹ để hình ảnh nổi rõ nhưng không thêm hiệu ứng glow giả.
- Icon không làm tăng chiều cao thẻ quá mức trên mobile.

## Kiểm thử

- Unit test ánh xạ đường dẫn, kích thước và accessibility của `TohieuIcon`.
- Test Dashboard xác nhận sáu icon thương hiệu được render và các button vẫn điều hướng đúng.
- Chạy test liên quan, axe, typecheck, lint và production build.
- Xác minh 12 file đều có kích thước 192 × 192 px và kênh alpha.

## Tiêu chí hoàn thành

- Có đúng 12 file asset riêng.
- Sáu thẻ thao tác nhanh hiển thị icon riêng.
- Không có lỗi TypeScript, lint, test liên quan hoặc build mới.
- Không thay đổi Sidebar và các icon thao tác nhỏ.
