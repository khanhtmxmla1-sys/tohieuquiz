# Kế hoạch triển khai bộ icon TôHiệuQuiz

**Mục tiêu:** Chuẩn hóa 12 icon thương hiệu và áp dụng sáu icon vào khu “Thao tác nhanh” của Dashboard giáo viên mà không thay đổi nghiệp vụ.

**Kiến trúc:** Asset nằm trong `public/icons/tohieuquiz/`. Component `TohieuIcon` là điểm truy cập duy nhất tới asset và xuất kiểu `TohieuIconName`. `OverviewTab` chỉ cấu hình tên icon; `QuickActionGrid` chịu trách nhiệm trình bày.

**Công nghệ:** React 19, TypeScript, Vite, Tailwind CSS, Vitest và Testing Library.

## Ràng buộc

- Mỗi icon là một file WebP 192 × 192 px, nền trong suốt.
- Không thêm dependency mới.
- Quick Action dùng icon 48 px; thao tác nhỏ tiếp tục dùng Lucide.
- Icon cạnh nhãn chữ là decorative: `alt=""`, `aria-hidden="true"`.
- Không sửa Sidebar, API, điều hướng hoặc dữ liệu.
- Thực hiện trên worktree và nhánh riêng.

## Giai đoạn 1 — Chuẩn hóa asset

**Tệp tạo:**

- `public/icons/tohieuquiz/overview.webp`
- `public/icons/tohieuquiz/quiz-create.webp`
- `public/icons/tohieuquiz/quiz-management.webp`
- `public/icons/tohieuquiz/assignment.webp`
- `public/icons/tohieuquiz/classroom.webp`
- `public/icons/tohieuquiz/live-exam.webp`
- `public/icons/tohieuquiz/learning-results.webp`
- `public/icons/tohieuquiz/certificate.webp`
- `public/icons/tohieuquiz/parent-portal.webp`
- `public/icons/tohieuquiz/notification.webp`
- `public/icons/tohieuquiz/gift-shop.webp`
- `public/icons/tohieuquiz/settings.webp`

Các bước:

1. Chuyển từng icon thành WebP vuông, giữ alpha.
2. Đặt tên file theo danh mục chuẩn.
3. Xác minh đủ 12 file, cùng kích thước 192 × 192 và có kênh sRGBA.
4. Commit asset riêng để dễ review và hoàn nguyên.

## Giai đoạn 2 — Component icon dùng chung

**Tệp:**

- Tạo `src/components/icons/TohieuIcon.tsx`
- Tạo `tests/TohieuIcon.test.tsx`

Các bước:

1. Viết test cho ánh xạ `quiz-create` tới `/icons/tohieuquiz/quiz-create.webp`.
2. Kiểm tra mặc định 48 × 48, `decoding="async"`, `draggable="false"`.
3. Kiểm tra chế độ decorative và alt có ý nghĩa.
4. Tạo `TOHIEU_ICON_SOURCES` đủ 12 tên.
5. Xuất kiểu `TohieuIconName` từ các khóa của bản đồ.
6. Chạy test và commit component.

## Giai đoạn 3 — Tích hợp Dashboard giáo viên

**Tệp:**

- Sửa `src/components/TeacherDashboard/OverviewTab.tsx`
- Sửa `src/components/TeacherDashboard/overview/QuickActionGrid.tsx`
- Tạo `tests/QuickActionGridBrandIcons.test.tsx`

Ánh xạ:

- Tạo đề mới → `quiz-create`
- Giao bài → `assignment`
- Thi trực tiếp → `live-exam`
- Xem kết quả → `learning-results`
- Quản lý lớp → `classroom`
- Cấp chứng nhận → `certificate`

Các bước:

1. Viết test xác nhận sáu URL ảnh và hành vi điều hướng.
2. Đổi `DashboardQuickAction.icon` từ React element sang `TohieuIconName`.
3. Xóa `iconClassName` khỏi quick action vì màu đã nằm trong asset.
4. Render `<TohieuIcon name={action.icon} size={48} decorative />`.
5. Giữ nguyên button semantic, focus ring, responsive grid và nội dung.
6. Chạy test component, Dashboard và axe.

## Giai đoạn 4 — Kiểm tra chất lượng

Chạy lần lượt:

```bash
npm run lint
npm run typecheck
npx vitest run tests/TohieuIcon.test.tsx tests/QuickActionGridBrandIcons.test.tsx tests/TeacherOverview.test.tsx tests/teacherOverviewAxe.test.tsx
npm run build
```

Kiểm tra bổ sung:

- `git diff --check main`
- Security scan trên các file thay đổi.
- Review toàn bộ diff so với `main`.
- Hoàn nguyên các file sinh tự động như `public/sitemap.xml`.
- Ghi rõ các lỗi nền đã tồn tại trên `main`, không quy chúng cho thay đổi icon.

## Giai đoạn 5 — Hoàn tất nhánh

1. Commit phần tích hợp và tài liệu đã chuẩn hóa.
2. Xác minh working tree sạch.
3. Ghi lại commit cuối và kết quả kiểm tra.
4. Giữ thay đổi trên nhánh `feat/tohieuquiz-icon-system` cho đến khi được merge.

## Trạng thái thực hiện

- [x] Tạo worktree và nhánh riêng.
- [x] Chuẩn hóa đủ 12 asset WebP.
- [x] Tạo `TohieuIcon` và unit test.
- [x] Tích hợp sáu icon vào Quick Action.
- [x] Test liên quan và axe đạt yêu cầu.
- [x] Lint, typecheck và production build đạt yêu cầu.
- [ ] Commit phần triển khai cuối và xác minh nhánh sạch.
