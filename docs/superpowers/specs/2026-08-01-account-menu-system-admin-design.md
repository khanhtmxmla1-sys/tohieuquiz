# Thiết kế chuyển Cài đặt cá nhân và Quản trị hệ thống lên menu tài khoản

**Ngày:** 2026-08-01  
**Dự án:** TôHiệuQuiz  
**Phạm vi:** Dashboard giáo viên

## 1. Bối cảnh

Hiện tại sidebar của Dashboard giáo viên đang chứa hai nhóm không thuộc luồng nghiệp vụ chính:

- `Tài khoản` → `Cài đặt cá nhân`
- `Quản trị hệ thống` → các chức năng quản trị dành cho admin

Trong khi đó, góc trên bên phải đã có `TeacherAccountMenu`, hiển thị tên tài khoản, vai trò và nút đăng xuất. Việc tách các chức năng liên quan đến tài khoản và quản trị ra khỏi menu tài khoản khiến sidebar dài hơn, đồng thời làm lẫn điều hướng nghiệp vụ với điều hướng cấp tài khoản/hệ thống.

## 2. Mục tiêu

- Chuyển `Cài đặt cá nhân` lên menu tài khoản góc trên bên phải.
- Chuyển toàn bộ nhóm `Quản trị hệ thống` lên cùng menu tài khoản.
- Giữ sidebar tập trung vào các nghiệp vụ giáo viên.
- Chỉ hiển thị chức năng quản trị cho tài khoản admin.
- Giữ nguyên tab, route và màn hình chức năng hiện có; chỉ thay đổi vị trí điều hướng.

## 3. Ngoài phạm vi

- Không triển khai sidebar thu gọn/mở rộng trong thay đổi này.
- Không đổi cấu trúc các màn hình quản trị bên trong.
- Không đổi hệ thống phân quyền hiện tại.
- Không đổi route hoặc tên tab nội bộ.
- Không thiết kế lại toàn bộ header.
- Không xóa nút tắt Quản lý thông báo đang có trên header trong phạm vi thay đổi này.

## 4. Phương án được duyệt

Sử dụng menu tài khoản dạng dropdown với hai cấp:

1. `Cài đặt cá nhân` là mục trực tiếp, hiển thị cho mọi tài khoản.
2. `Quản trị hệ thống` là nhóm có thể mở rộng, chỉ hiển thị khi `isAdmin === true`.

Cấu trúc mặc định:

```text
┌────────────────────────────────┐
│ Avatar  Tên hiển thị           │
│         Vai trò                │
│         Tên đăng nhập / email  │
├────────────────────────────────┤
│ ⚙  Cài đặt cá nhân             │
│                                │
│ 🛡  Quản trị hệ thống       ›   │  chỉ admin
├────────────────────────────────┤
│ ↪  Đăng xuất                   │
└────────────────────────────────┘
```

Khi mở nhóm quản trị:

```text
┌────────────────────────────────┐
│ Avatar  Tên hiển thị           │
│         Vai trò                │
├────────────────────────────────┤
│ ⚙  Cài đặt cá nhân             │
│                                │
│ 🛡  Quản trị hệ thống       ⌄   │
│    📢 Quản lý thông báo         │
│    👥 Quản lý giáo viên         │
│    ∑  Kiểm tra lỗi công thức    │
│    ⚙  Trạng thái hệ thống       │
├────────────────────────────────┤
│ ↪  Đăng xuất                   │
└────────────────────────────────┘
```

## 5. Nhãn hiển thị

| Tab hiện có | Nhãn trong menu mới |
|---|---|
| `personal-settings` | Cài đặt cá nhân |
| `announcements` | Quản lý thông báo |
| `teachers` | Quản lý giáo viên |
| `math-audit` | Kiểm tra lỗi công thức |
| `operations` | Trạng thái hệ thống |

Tên tab và component nội bộ không thay đổi. Việc đổi nhãn chỉ áp dụng tại menu tài khoản để thân thiện và thống nhất tiếng Việt.

## 6. Quy tắc hiển thị theo vai trò

### Giáo viên thường

Hiển thị:

- Thông tin tài khoản
- Cài đặt cá nhân
- Đăng xuất

Không render nhóm `Quản trị hệ thống` và không để khoảng trống thay thế.

### Quản trị viên

Hiển thị:

- Thông tin tài khoản
- Cài đặt cá nhân
- Nhóm Quản trị hệ thống
- Đăng xuất

Quyền truy cập backend và guard hiện có vẫn là lớp bảo vệ chính. Việc ẩn menu chỉ là điều chỉnh giao diện, không thay thế kiểm soát phân quyền.

## 7. Hành vi tương tác

- Bấm vùng tên/avatar để mở hoặc đóng menu tài khoản.
- Bấm `Cài đặt cá nhân` chuyển sang tab `personal-settings` và đóng dropdown.
- Bấm `Quản trị hệ thống` chỉ mở hoặc đóng danh sách con, không điều hướng.
- Bấm một mục quản trị chuyển sang tab tương ứng và đóng dropdown.
- Bấm `Đăng xuất` dùng luồng đăng xuất hiện tại.
- Bấm ra ngoài dropdown hoặc nhấn `Escape` đóng menu.
- Khi một tab trong nhóm quản trị đang active, nhóm quản trị mặc định mở khi menu tài khoản được mở.
- Không mở submenu bằng hover; chỉ mở bằng click để hoạt động nhất quán trên desktop và thiết bị cảm ứng.

## 8. Trạng thái active

- `Cài đặt cá nhân` có nền xanh nhạt và icon/chữ xanh khi `activeTab === 'personal-settings'`.
- `Quản trị hệ thống` có trạng thái nhấn nhẹ khi một trong các tab con đang active.
- Mục quản trị con đang active có nền xanh nhạt, font semibold và `aria-current="page"`.
- `Đăng xuất` không dùng màu đỏ nổi bật liên tục; chỉ chuyển đỏ rõ hơn khi hover hoặc focus.

## 9. Phong cách giao diện

- Chiều rộng dropdown: `300px` trên desktop.
- Trên màn hình hẹp: giới hạn bằng `max-width: calc(100vw - 16px)`.
- Bo góc: `14px`.
- Nền: trắng.
- Viền: xám xanh nhạt đồng bộ header hiện tại.
- Bóng: ambient shadow nhẹ, không phát sáng.
- Item cao tối thiểu: `44px`.
- Icon: `18px`.
- Hover item: nền xanh rất nhạt.
- Khoảng cách giữa phần tài khoản, điều hướng và đăng xuất được phân tách bằng border mảnh.

## 10. Icon đề xuất

- Cài đặt cá nhân: `Settings`
- Quản trị hệ thống: `ShieldCog`
- Quản lý thông báo: `Megaphone`
- Quản lý giáo viên: `Users`
- Kiểm tra lỗi công thức: `ScanSearch`
- Trạng thái hệ thống: `ServerCog`
- Đăng xuất: `LogOut`
- Mở/đóng nhóm: `ChevronRight`, xoay 90 độ khi mở

Icon `X` hiện dùng cho Đăng xuất sẽ được thay bằng `LogOut` vì đúng ngữ nghĩa hơn.

## 11. Thay đổi ở cấp component

### `TeacherAccountMenu.tsx`

- Nhận thêm `activeTab` và callback chuyên dụng `onNavigate(tab)`.
- Thay cấu trúc `details/summary` hiện tại bằng trigger và panel được điều khiển bằng state để quản lý chính xác focus, click ngoài và phím `Escape`.
- Render mục `Cài đặt cá nhân`.
- Render nhóm quản trị theo `isAdmin`.
- Quản lý riêng trạng thái mở/đóng dropdown tài khoản và submenu quản trị.
- Đóng dropdown sau khi điều hướng.
- Khi đóng bằng `Escape`, trả focus về trigger tài khoản.

### `TeacherDashboardHeader.tsx`

- Truyền `activeTab` và callback `setActiveTab` vào `TeacherAccountMenu`.
- Giữ nguyên khu vực tìm kiếm và thông báo.
- Không thay đổi bố cục tổng thể của header.

### `Sidebar.tsx`

- Xóa nhóm `Tài khoản`.
- Xóa nhóm `Quản trị hệ thống`.
- Xóa các cấu hình, item và `GroupKey` chỉ phục vụ hai nhóm này.
- Giữ nguyên tất cả nhóm nghiệp vụ còn lại.
- Giữ nút Đăng xuất ở sidebar trong phạm vi thay đổi này để tránh làm thay đổi thói quen trên mobile; có thể đánh giá việc bỏ trùng ở một thay đổi riêng sau khi kiểm thử thực tế.

## 12. Khả năng truy cập

- Trigger tài khoản phải có tên truy cập rõ ràng.
- Nhóm quản trị dùng `aria-expanded` và `aria-controls`.
- Mục active dùng `aria-current="page"`.
- Có focus ring rõ ràng cho mọi nút.
- Menu có thể thao tác hoàn toàn bằng bàn phím.
- Phím `Escape` đóng menu và trả focus về trigger tài khoản.
- Không phụ thuộc màu sắc để thể hiện trạng thái active; kết hợp font-weight và nền.

## 13. Trường hợp biên

- Nếu tên tài khoản dài, dùng truncate và vẫn giữ tooltip/title hoặc nội dung đầy đủ trong vùng thông tin.
- Nếu không có email hoặc tên đăng nhập để hiển thị, không render dòng trống.
- Nếu một tài khoản bị thay đổi quyền trong phiên, menu phản ánh theo giá trị `isAdmin` hiện tại.
- Nếu đang ở tab quản trị nhưng quyền admin không còn, guard hiện tại xử lý quyền truy cập; menu không render nhóm quản trị.
- Dropdown neo theo mép phải của trigger, không vượt khỏi mép phải viewport; khi chiều cao không đủ, panel dùng `max-height` theo viewport và cuộn nội bộ.

## 14. Kiểm thử

### Unit/component tests

- Giáo viên thường nhìn thấy `Cài đặt cá nhân`, không nhìn thấy `Quản trị hệ thống`.
- Admin nhìn thấy và mở/đóng được nhóm quản trị.
- Mỗi mục điều hướng gọi đúng tab.
- Dropdown đóng sau khi điều hướng.
- Trạng thái active hiển thị đúng.
- Nút đăng xuất gọi callback hiện tại.
- Icon đăng xuất là `LogOut`, không còn là `X`.
- Sidebar không còn nhóm `Tài khoản` và `Quản trị hệ thống`.

### Accessibility tests

- `aria-expanded` thay đổi đúng.
- `aria-current` đặt đúng cho mục active.
- Có thể thao tác bằng `Tab`, `Enter`, `Space`, `Escape`.
- Không phát sinh lỗi axe mới trong header/menu tài khoản.

### Responsive tests

- Dropdown không tràn viewport ở màn hình hẹp.
- Menu vẫn sử dụng được khi header chỉ hiển thị avatar trên mobile.
- Các mục có vùng chạm tối thiểu 44px.

## 15. Tiêu chí chấp nhận

Thay đổi được xem là đạt khi:

1. Sidebar không còn hai nhóm `Tài khoản` và `Quản trị hệ thống`.
2. Menu tài khoản có mục `Cài đặt cá nhân` cho mọi người dùng.
3. Nhóm `Quản trị hệ thống` chỉ xuất hiện với admin.
4. Bốn chức năng quản trị điều hướng đúng tab hiện có.
5. Menu đóng đúng sau điều hướng, click ngoài và nhấn `Escape`.
6. Trạng thái active, focus và responsive hoạt động đúng.
7. Không thay đổi route, quyền backend hoặc nội dung các trang chức năng.
8. Các test liên quan đến sidebar, header và menu tài khoản đều vượt qua.
