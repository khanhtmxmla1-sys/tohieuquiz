# Thiết kế mở rộng responsive cho Bảng vàng học sinh

**Ngày:** 2026-10-01
**Phạm vi:** Popup Bảng vàng trong `StudentFloatingSidebar`
**Mục tiêu:** Khôi phục khả năng đọc và so sánh thứ hạng trên desktop, đồng thời giữ trải nghiệm chạm tốt trên mobile, không thay đổi API hoặc dữ liệu bảng vàng.

## 1. Bối cảnh và nguyên nhân

Commit `32d2e58` chuyển Bảng vàng từ modal lớn ở giữa sang popup neo góc phải với `max-w-[22rem]` (352px). Kích thước này quá hẹp cho ba tab, thẻ Top 3 và tên học sinh tiếng Việt:

- Tiêu đề có thể xuống hai dòng dù màn hình desktop còn nhiều chỗ trống.
- Tab `Toàn trường` bị khuất và xuất hiện thanh cuộn ngang.
- Ba thẻ podium bị ép hẹp, tên và thông tin xu bị cắt mạnh.
- Popup giống bảng phụ nhỏ thay vì một bảng xếp hạng cần so sánh trực quan.

API, dữ liệu và logic xếp hạng đang hoạt động đúng. Thay đổi chỉ thuộc layout responsive của frontend.

## 2. Các hướng đã cân nhắc

### A. Modal lớn ở giữa + mobile sheet — **chọn**

- Desktop rộng 720–800px, cao tối đa khoảng 82% viewport.
- Tablet dùng modal giữa với chiều rộng co giãn.
- Mobile chuyển thành sheet gần toàn màn hình, chừa mép nhỏ và chỉ cuộn phần nội dung.

Ưu điểm: tận dụng không gian desktop, Top 3 rõ ràng, không làm mobile bị thu nhỏ theo desktop. Đây là phương án người dùng đã duyệt qua mockup.

### B. Drawer rộng bên phải

Rộng 480–560px và cao gần toàn màn hình. Giữ được cảm giác bảng phụ nhưng podium vẫn dễ chật trên laptop nhỏ và tạo bố cục lệch khi danh sách dài.

### C. Toàn màn hình ở mọi thiết bị

Dễ mở rộng nhất nhưng quá nặng cho thao tác xem nhanh và che toàn bộ ngữ cảnh dashboard trên desktop.

## 3. Thiết kế được chọn

### 3.1. Overlay và vị trí

- Overlay luôn căn giữa theo cả hai trục từ breakpoint tablet/desktop.
- Mobile căn sheet về đáy nhưng chừa 8px quanh viewport để giữ cảm giác lớp phủ và nhìn thấy bo góc.
- Backdrop, animation mở/đóng, Escape, click backdrop, khóa cuộn body và focus trap giữ nguyên.
- Không neo modal bên cạnh nút mascot; nút mascot chỉ là trigger.

### 3.2. Kích thước responsive

| Viewport | Kích thước mục tiêu | Hành vi |
|---|---|---|
| `< 640px` | `width: calc(100vw - 16px)`; `max-height: calc(100dvh - 16px)` | Sheet gần toàn màn hình, căn đáy, bo góc 24px |
| `640–1023px` | `width: min(calc(100vw - 32px), 42rem)`; `max-height: 85dvh` | Modal giữa, giữ khoảng thở 16px |
| `>= 1024px` | `width: min(calc(100vw - 48px), 48rem)`; `max-height: 82dvh` | Modal giữa 768px; không vượt viewport |

Chiều rộng không được quay lại mức cố định 352px trên desktop. Chiều cao dùng `dvh` để tránh lỗi thanh địa chỉ mobile làm che phần cuối.

### 3.3. Cấu trúc cuộn

Modal là flex column gồm ba vùng:

1. Header: không cuộn.
2. Tab list: không cuộn và luôn nhìn thấy.
3. Leaderboard panel: `min-height: 0`, `flex: 1`, `overflow-y: auto`.

Safe-area bottom được áp vào panel cuộn. Footer “Cập nhật lúc…” nằm cuối nội dung, không đè danh sách.

### 3.4. Header

- Giữ mascot, tiêu đề, mô tả kỳ xếp hạng và nút đóng.
- Desktop dùng tiêu đề một dòng ở chiều rộng mục tiêu.
- Mobile cho phép mô tả xuống dòng nhưng không ép tiêu đề thành cột hẹp.
- Nút đóng tối thiểu 44×44px.

### 3.5. Tab list

- Ba tab luôn chia đều một hàng; bỏ `overflow-x-auto` và không xuất hiện thanh cuộn ngang.
- Mỗi tab có vùng chạm tối thiểu 44px.
- Nhãn giữ nguyên: `Tuần này`, `Lớp của em`, `Toàn trường`.
- Ở viewport hẹp nhất, font có thể dùng 12px nhưng không rút gọn nội dung nhãn.
- Trạng thái active, focus ring, `role="tab"` và `aria-selected` giữ nguyên.

### 3.6. Vị trí hiện tại và Top 3

- Thẻ “Vị trí của em” giữ bố cục ngang; tên và số xu có `min-width: 0`, thứ hạng/gap không bị co.
- Top 3 tiếp tục là lưới ba cột ở mọi viewport đã hỗ trợ.
- Desktop tăng khoảng cách và diện tích card để hiện tên, xu, lớp rõ hơn.
- Mobile giảm padding/avatar có kiểm soát, cho phép tên tối đa hai dòng hoặc ellipsis ổn định; không để mỗi từ rơi xuống một dòng riêng.
- Vị trí #1 vẫn cao hơn #2/#3 và có điểm nhấn vàng; không thay đổi thứ tự podium hiện tại.

### 3.7. Danh sách Top 10

- Danh sách dùng toàn bộ chiều rộng panel.
- Vùng avatar, hạng và xu không co; tên học sinh nhận phần không gian còn lại.
- Mobile giữ mỗi hàng tối thiểu 48px; desktop có thể giữ padding hiện tại.
- Không thay đổi dữ liệu, thứ hạng đồng hạng hoặc định dạng xu.

## 4. Breakpoint và hành vi chi tiết

### Mobile 320–639px

- Sheet gần toàn màn hình, căn đáy, chừa 8px.
- Header và tab cố định; panel nội dung cuộn.
- Không overflow ngang ở 320, 360, 390 và 430px.
- Nút đóng, tab và nút retry đạt tối thiểu 44px.

### Tablet 640–1023px

- Modal căn giữa, tối đa 672px.
- Top 3 có đủ khoảng trống để hiển thị tên và xu.
- Giữ khoảng cách 16px với mép viewport.

### Desktop từ 1024px

- Modal căn giữa, tối đa 768px và 82dvh.
- Dashboard vẫn nhìn thấy phía sau backdrop nhưng không cạnh tranh với nội dung bảng vàng.
- Không gắn popup vào góc phải hoặc chừa khoảng trống lớn vô ích bên trái.

## 5. Accessibility và chuyển động

- Giữ `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap và phục hồi focus về trigger.
- Giữ đóng bằng Escape, nút X và backdrop.
- Tôn trọng `prefers-reduced-motion`; không thêm chuyển động parallax hoặc spring mạnh.
- Không dùng màu sắc làm tín hiệu duy nhất cho tab active hoặc hạng hiện tại.
- Nội dung bị rút gọn trực quan vẫn cần tên đầy đủ qua accessible name hoặc thuộc tính phù hợp.

## 6. Data flow và trạng thái

- Không thay `getStudentLeaderboard`, query tab, cache hoặc payload API.
- Thay tab tiếp tục gọi đúng `{ scope, period }` hiện tại.
- Loading, error/retry, empty state và success state dùng chung vùng panel cuộn.
- Không thêm state layout JavaScript; breakpoint được giải quyết bằng CSS/Tailwind để tránh lệch giữa resize và render.

## 7. Kiểm thử

### Unit/component

- Dialog vẫn mở/đóng, trap focus, Escape và phục hồi body scroll đúng.
- Có contract class/layout ngăn quay lại `max-w-[22rem]` trên desktop.
- Tab list không dùng overflow ngang và ba tab vẫn tồn tại/hoạt động.
- Loading, error/retry, empty và success state không regress.

### Cypress responsive

Kiểm tra component ở các viewport đại diện:

- 320×568: modal nằm trong viewport, không overflow ngang, controls ≥44px.
- 390×844: header/tab nhìn thấy, panel cuộn và hàng cuối không bị che.
- 768×1024: modal căn giữa, không neo góc phải.
- 1366×768 và 1536×864: modal khoảng 720–768px, Top 3 đọc rõ và nội dung cuộn trong chiều cao giới hạn.

### Regression/build

- Chạy focused Vitest cho `StudentFloatingSidebar` và `studentGoldLeaderboardUi`.
- Chạy Cypress component spec Bảng vàng.
- Chạy lint, typecheck, frontend build và performance budget liên quan.
- Production smoke bằng tài khoản học sinh cho cả ba tab sau deploy.

## 8. Ngoài phạm vi

- Không thay API Worker, schema D1 hoặc thuật toán xếp hạng.
- Không đổi mascot/nút trigger ngoài việc giữ nguyên vị trí hiện tại.
- Không thêm bộ lọc, tìm kiếm, phân trang hoặc animation mới.
- Không refactor các hệ thống gamification khác.

## 9. Tiêu chí hoàn thành

- Desktop không còn popup 352px; modal căn giữa và rộng 720–768px khi viewport cho phép.
- Mobile dùng sheet gần toàn màn hình, không phải phiên bản desktop bị thu nhỏ.
- Không có scrollbar ngang ở modal hoặc tab list tại các viewport kiểm thử.
- Top 3, vị trí hiện tại và Top 10 đọc được mà không làm mất hạng/xu.
- Header/tab luôn nhìn thấy trong khi danh sách cuộn.
- Tất cả hành vi accessibility hiện có tiếp tục hoạt động.
- Focused tests, Cypress responsive, lint, typecheck, build và production smoke đều đạt.
