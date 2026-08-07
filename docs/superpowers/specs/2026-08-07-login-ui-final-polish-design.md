# Login UI Final Polish Design

## Goal
Tinh chỉnh vòng cuối trang đăng nhập TôHiệuQuiz dựa trên ảnh localhost đã duyệt, giữ nguyên toàn bộ logic xác thực và chỉ cải thiện nhịp thị giác, mức độ ưu tiên form và trải nghiệm responsive.

## Scope
- Ẩn banner trạng thái "Chế độ giảm chuyển động đang bật" trên màn hình đăng nhập công khai; chế độ giảm chuyển động vẫn hoạt động bình thường.
- Giảm độ áp đảo của hero khoảng 5–8% trên desktop, giữ hierarchy navy + primary blue.
- Giảm khoảng cách thị giác giữa hero và form để hai vùng liên kết hơn.
- Thu gọn ba feature cards, giảm icon nhẹ và rút ngắn mô tả thẻ thứ ba.
- Thu gọn product preview "Tổng quan học tập" khoảng 8–10%, giảm shadow/viền và mật độ dọc.
- Làm segmented control trong login card phẳng hơn; giữ input/button hiện tại vì đã đạt yêu cầu.
- Giảm thêm độ nổi của decorative yellow radial gradient.
- Giữ form xuất hiện trước hero trên tablet/mobile.

## Non-goals
- Không thay đổi API, auth flow, passkey, remember-login, password reset hoặc notification logic.
- Không thay đổi branding, logo, font hệ thống hoặc route.
- Không thêm dependency mới.
- Không commit, push hoặc deploy.

## Visual decisions
- Page background: `#F7F9FC`.
- Primary blue: `#2563EB`; deep navy: `#1E3A8A`; accent yellow chỉ dùng điểm nhỏ.
- Hero desktop giảm max heading size từ 3.8rem xuống khoảng 3.55rem; mobile vẫn giữ khả năng đọc tốt.
- Desktop layout giữ 2 cột nhưng giảm gap từ 56px xuống khoảng 40–48px và cân tỷ lệ gần 56/44.
- Feature cards dùng icon khoảng 40px, text ngắn, shadow tối thiểu.
- Product preview giảm padding, chart height và shadow; chỉ đóng vai trò minh họa sản phẩm.
- Segmented control active state dùng border xanh nhạt + shadow rất nhẹ hoặc không shadow.

## Reduced motion banner behavior
- Banner reduced-experience tiếp tục hiển thị ở các màn hình ứng dụng sau đăng nhập và các bối cảnh khác hiện tại.
- Chỉ ẩn khi người dùng đang ở public root login (`/`) và chưa có teacher hoặc student session.
- Không vô hiệu hóa `prefers-reduced-motion`; animation classes vẫn tôn trọng `motion-reduce` như hiện tại.

## Responsive acceptance criteria
- 390×844: form nằm trước hero, không overflow ngang, form rộng theo viewport.
- 768×1024: form nằm trước hero, hero không đẩy form xuống khỏi vùng đầu trang.
- 1024×768 và 1440×900: hai cột cân bằng, form gần trung tâm hơn, hero không lấn át CTA.
- Touch target tối thiểu 44px; focus styles và ARIA hiện có được giữ nguyên.

## Test strategy
- Thêm regression test cho việc reduced-experience banner không xuất hiện trên public login nhưng vẫn xuất hiện khi không ở login context.
- Cập nhật presentation test để khóa copy feature card và các class/layout intent quan trọng thay vì pixel-perfect snapshot.
- Chạy focused Vitest, ESLint, TypeScript typecheck và frontend build.
- Chạy browser verification ở 390, 768, 1024 và 1440; kiểm tra overflow, thứ tự form/hero và banner.
