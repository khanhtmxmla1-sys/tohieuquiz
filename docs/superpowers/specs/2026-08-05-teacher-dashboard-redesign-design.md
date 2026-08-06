# TôHiệuQuiz — Thiết kế lại giao diện quản lý giáo viên

## 1. Mục tiêu

Thiết kế lại khu vực quản lý giáo viên theo hướng hiện đại, thân thiện với môi trường tiểu học, bám sát mockup đã duyệt và sử dụng bộ illustration/icon riêng đã tạo. Triển khai theo từng giai đoạn, bắt đầu từ trang **Tổng quan giáo viên**, sau khi duyệt mới mở rộng sang các màn hình còn lại.

## 2. Phạm vi giai đoạn 1

Giai đoạn 1 chỉ tập trung vào trang **Tổng quan giáo viên** và các thành phần khung dùng chung có liên quan trực tiếp:

- Sidebar giáo viên.
- Header trên cùng.
- Banner chào mừng.
- Khu vực việc cần chú ý.
- Các thẻ thống kê.
- Hai thẻ tạo đề bằng AI và soạn đề thủ công.
- Nhóm thao tác nhanh.
- Biểu đồ phân bố điểm.
- Hoạt động gần đây.
- Đề kiểm tra gần đây.
- Lớp học của tôi.
- Học sinh nổi bật và bảng xếp hạng.
- Trạng thái loading, empty, error và quyền truy cập.

Không thay đổi logic nghiệp vụ ngoài những điều chỉnh nhỏ cần thiết để cấp dữ liệu cho giao diện mới.

## 3. Ngôn ngữ thiết kế

- Light mode, nền chính `#F8FAFC`.
- Card trắng, viền `#E2E8F0`, bóng đổ nhẹ.
- Màu chính: xanh dương `#2563EB` và xanh trời `#0EA5E9`.
- Màu bổ trợ: vàng `#FACC15`, xanh lá `#10B981`, cam `#F97316`, tím nhạt.
- Font chính: Be Vietnam Pro.
- Card bo góc 14–16px; nút và input 10–12px.
- Illustration và icon đồng bộ phong cách pastel 3D/vector mềm, không dùng ảnh ngẫu nhiên từ nguồn ngoài.
- Tất cả icon thao tác phải có fallback Lucide khi asset chưa tải được.

## 4. Cấu trúc giao diện

### 4.1 Sidebar

Nhóm chức năng:

- Tổng quan.
- Tạo đề bằng AI.
- Soạn đề thủ công.
- Quản lý đề.
- Thi trực tiếp.
- Giao bài.
- Bài tập tự luận.
- Kết quả học tập.
- Lớp học.
- Tiệm tạp hóa khi feature flag bật.
- Cấp chứng nhận.
- Mẫu chứng nhận với tài khoản phù hợp.
- Cài đặt cá nhân.
- Nhóm quản trị chỉ hiển thị với Admin.

Sidebar desktop cố định; tablet thu gọn dạng icon rail; mobile chuyển thành drawer.

### 4.2 Header

- Breadcrumb.
- Ô tìm kiếm toàn cục trong phạm vi giáo viên.
- Ngày hiện tại.
- Chuông thông báo có badge.
- Avatar và menu tài khoản.

### 4.3 Banner chào mừng

- Lời chào theo tên giáo viên.
- Thông điệp ngắn.
- Bộ chọn lớp hiện hành.
- Illustration giáo viên và học sinh riêng.
- Không đưa số liệu quan trọng vào illustration.

### 4.4 Việc cần chú ý

Hiển thị tối đa ba nhóm ưu tiên:

- Bài chưa chấm.
- Học sinh chưa hoàn thành.
- Học sinh chưa tham gia hoặc dữ liệu bất thường.

Mỗi mục có icon, tiêu đề, mô tả ngắn và số lượng. Có liên kết đến màn hình xử lý tương ứng.

### 4.5 Thống kê nhanh

Năm chỉ số:

- Lớp học.
- Bài kiểm tra.
- Bài đã giao.
- Học sinh.
- Tỷ lệ hoàn thành.

Mỗi thẻ có số liệu chính, thay đổi so với kỳ trước và trạng thái khi chưa đủ dữ liệu.

### 4.6 Tạo nội dung

Hai thẻ lớn:

- Tạo đề bằng AI với robot mascot.
- Soạn đề thủ công với illustration sổ và bút.

Mỗi thẻ có CTA rõ ràng, không chứa quá hai hành động.

### 4.7 Thao tác nhanh

Sáu mục:

- Giao bài.
- Thi trực tiếp.
- Xem kết quả.
- Quản lý lớp.
- Cấp chứng nhận.
- Quản lý đề.

Sử dụng icon asset riêng; giữ cùng kích thước khung và vùng bấm tối thiểu 44px.

### 4.8 Dữ liệu và hoạt động

- Biểu đồ phân bố điểm theo lớp và khoảng thời gian.
- Hoạt động gần đây.
- Đề kiểm tra gần đây.
- Lớp học của tôi.
- Top học sinh nổi bật.
- Bảng xếp hạng toàn trường nếu người dùng có quyền.

## 5. Asset

Tổ chức asset theo cấu trúc đề xuất:

```text
src/assets/teacher-dashboard/
  illustrations/
    teacher-welcome.png
    ai-quiz-robot.png
    manual-quiz.png
  icons/
    class.png
    test.png
    assignment.png
    live-test.png
    results.png
    certificate.png
    question-management.png
    students.png
  avatars/
  index.ts
```

Yêu cầu:

- PNG/WebP nền trong suốt.
- Có bản 1x và 2x khi cần.
- Tối ưu dung lượng trước khi commit.
- Tên file không dấu, kebab-case.
- Không nhúng asset dạng base64 trong component.

## 6. Kiến trúc component

Đề xuất tách thành các component độc lập:

- `TeacherDashboardPage`.
- `TeacherSidebar`.
- `TeacherTopbar`.
- `TeacherWelcomeBanner`.
- `TeacherAttentionPanel`.
- `TeacherMetricCard`.
- `TeacherCreationCard`.
- `TeacherQuickActionGrid`.
- `ScoreDistributionChart`.
- `RecentActivityList`.
- `RecentTestsCard`.
- `TeacherClassesCard`.
- `OutstandingStudentsCard`.

Không để toàn bộ trang trong một file lớn. Component hiển thị không gọi API trực tiếp; dữ liệu được lấy qua hook hoặc container của trang.

## 7. Dữ liệu

Tạo một lớp ánh xạ dữ liệu dashboard thống nhất:

- Chuẩn hóa giá trị thiếu thành `null` thay vì số giả.
- Tách dữ liệu tổng quan theo lớp đang chọn.
- Dữ liệu ưu tiên phải chứa route đích để điều hướng.
- Dữ liệu biểu đồ phải có thời gian và phạm vi rõ ràng.
- Không hard-code số liệu mockup trong production.

## 8. Trạng thái và lỗi

Mỗi khối dữ liệu có:

- Skeleton loading.
- Empty state có hướng dẫn hành động.
- Error state có nút thử lại.
- Trạng thái không đủ quyền.

Trang tổng thể không bị trắng khi một widget lỗi; từng widget phải có error boundary hoặc cơ chế cô lập lỗi phù hợp.

## 9. Responsive

- Desktop từ 1280px: bố cục đầy đủ.
- Tablet 768–1279px: sidebar icon rail, các vùng dữ liệu chuyển hai cột.
- Mobile dưới 768px: drawer menu, banner đơn cột, thẻ thống kê cuộn ngang hoặc lưới hai cột, bảng chuyển thành danh sách.

Không cho phép cuộn ngang toàn trang.

## 10. Accessibility

- WCAG AA cho nội dung chính.
- Focus ring rõ ràng.
- Nút và link có nhãn truy cập.
- Illustration dùng `alt` phù hợp hoặc `alt=""` nếu chỉ trang trí.
- Biểu đồ có phần mô tả dữ liệu dạng text hoặc bảng ẩn cho trình đọc màn hình.
- Hỗ trợ reduced motion.

## 11. Hiệu năng

- Lazy-load illustration dưới fold.
- Dùng WebP/AVIF khi pipeline hiện tại hỗ trợ.
- Không tải đồng thời toàn bộ asset của các màn hình chưa mở.
- Theo dõi bundle tăng thêm và tránh nhập asset qua barrel gây kéo cả thư mục.

## 12. Tiêu chí hoàn thành giai đoạn 1

- Giao diện khớp định hướng mockup đã duyệt.
- Tất cả chức năng hiện có vẫn hoạt động.
- Không hard-code dữ liệu demo.
- Desktop, tablet và mobile không vỡ bố cục.
- Loading, empty và error state có đầy đủ.
- Không có lỗi console nghiêm trọng.
- Kiểm thử luồng chính: chọn lớp, tạo đề AI, soạn đề thủ công, giao bài, xem kết quả, mở lớp học, mở chứng nhận.
- Được người dùng duyệt trước khi mở rộng sang giai đoạn 2.

## 13. Giai đoạn sau

Sau khi trang Tổng quan được duyệt:

1. Quản lý đề và chi tiết đề.
2. Giao bài và bài tập tự luận.
3. Kết quả học tập và chấm bài.
4. Lớp học và học sinh.
5. Chứng nhận.
6. Tiệm tạp hóa.
7. Đồng bộ toàn bộ shell giáo viên và responsive.
