# Teacher Dashboard Stitch A273 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Áp dụng ngôn ngữ thiết kế của Stitch screen `a273e2e8dafa428dbf235dbc2d90f69a` vào trang Tổng quan giáo viên mà không thay đổi API, dữ liệu thật, phân quyền hoặc route hiện có.

**Architecture:** Giữ `OverviewTab` làm container dữ liệu và giữ nguyên các service/store hiện có. Chỉ tái bố cục các component hiển thị trong `overview/` và tinh chỉnh shell giáo viên; `ActionCenterPanel` tiếp tục dùng `/api/teacher/action-center`, KPI tiếp tục dùng dữ liệu summary thật, các CTA tiếp tục gọi tab/route hiện tại.

**Tech Stack:** React, TypeScript, Vite, Tailwind utility classes, Vitest, Testing Library, Cypress.

## Global Constraints

- Nguồn tham chiếu giao diện: Stitch project `2383908236951854851`, screen `a273e2e8dafa428dbf235dbc2d90f69a`.
- Không hard-code các số liệu demo `12`, `48`, `126`, `426`, `92%` từ Stitch.
- Không thêm menu giả như “Học liệu” hoặc “Ngân hàng câu hỏi” khi chưa có route/tab tương ứng trong shell giáo viên.
- Không thay đổi Worker, D1, migrations, API contract hoặc feature flags.
- Giữ font Be Vietnam Pro, nền `#F8FAFC`, card trắng, viền `#E2E8F0`, bo góc 14–16px, WCAG AA và vùng bấm tối thiểu 44px.
- Giữ loading, empty, error, offline, quyền và reduced-motion hiện có.
- Không commit, push hoặc deploy trong phạm vi kế hoạch này.

---

### Task 1: Khóa hành vi bằng kiểm thử giao diện

**Files:**
- Modify: `tests/TeacherOverview.test.tsx`
- Modify: `cypress/e2e/teacher-dashboard-responsive-redesign.cy.ts`

**Interfaces:**
- Consumes: `OverviewTab`, shell giáo viên và fixture API hiện có.
- Produces: kiểm thử bảo vệ dữ liệu thật, thứ tự khối và composition mới.

- [x] **Step 1:** Bổ sung assertion cho breadcrumb `Trang chủ / Dashboard giáo viên`.
- [x] **Step 2:** Bổ sung assertion hero dùng surface sáng theo Stitch, không còn phụ thuộc gradient xanh đậm.
- [x] **Step 3:** Bổ sung assertion hero và Action Center nằm trong cùng vùng composition đầu trang trên desktop.
- [x] **Step 4:** Bổ sung assertion quick action dùng lưới sáu cột ở desktop nhưng vẫn giữ đúng sáu nút và tab đích.
- [x] **Step 5:** Chạy `npm run test:run -- tests/TeacherOverview.test.tsx` và xác nhận test mới thất bại trước khi sửa giao diện.

### Task 2: Tái bố cục Overview theo Stitch nhưng giữ dữ liệu thật

**Files:**
- Modify: `src/components/TeacherDashboard/OverviewTab.tsx`

**Interfaces:**
- Consumes: dữ liệu auth, quiz store, result summary và callbacks hiện có.
- Produces: composition `breadcrumb → hero + action center → KPI → tạo đề → thao tác nhanh → dữ liệu học tập`.

- [x] **Step 1:** Thêm breadcrumb semantic ở đầu nội dung.
- [x] **Step 2:** Đặt `DashboardHero` và `ActionCenterPanel` trong grid desktop `minmax(0,1fr) / 320–360px`, tự xếp một cột trên tablet/mobile.
- [x] **Step 3:** Giữ nguyên dữ liệu KPI thật và toàn bộ callbacks.
- [x] **Step 4:** Giữ `PerformancePanel`, `RecentSubmissionsPanel`, `RecentQuizzesPanel` dưới fold để không làm mất chức năng hiện có.
- [x] **Step 5:** Chạy lại test tập trung.

### Task 3: Áp dụng visual language Stitch cho các khối đầu trang

**Files:**
- Modify: `src/components/TeacherDashboard/overview/DashboardHero.tsx`
- Modify: `src/components/TeacherDashboard/overview/ActionCenterPanel.tsx`
- Modify: `src/components/TeacherDashboard/overview/DashboardKpiGrid.tsx`
- Modify: `src/components/TeacherDashboard/overview/QuickActionGrid.tsx`
- Modify: `src/components/TeacherDashboard/quiz-creation/QuizCreationActions.tsx`
- Modify: `styles/tokens.css`

**Interfaces:**
- Consumes: props và contracts hiện có; không đổi signatures.
- Produces: card sáng, illustration bên phải, KPI icon lớn, creation cards cân đối và quick actions sáu cột.

- [x] **Step 1:** Chuyển hero sang surface sáng, chữ slate, badge mềm và illustration bên phải; giữ copy theo admin/teacher thật.
- [x] **Step 2:** Chuyển Action Center sang card compact phù hợp cột phải, vẫn hiển thị count, CTA, refresh, loading/error/empty và xóa draft khi có.
- [x] **Step 3:** Tăng độ nổi bật KPI bằng icon 64–80px trên desktop, giảm đúng breakpoint trên màn nhỏ; không thêm trend giả.
- [x] **Step 4:** Chỉnh creation cards theo layout Stitch, giữ CTA AI/manual và asset nội bộ.
- [x] **Step 5:** Chuyển quick actions thành `2 / 3 / 6` cột theo breakpoint và giữ target 44px.
- [x] **Step 6:** Bổ sung token shadow/surface cần thiết, không tạo màu tùy tiện ngoài hệ thống.
- [x] **Step 7:** Chạy test tập trung.

### Task 4: Đồng bộ shell giáo viên với bản thiết kế

**Files:**
- Modify: `src/components/TeacherDashboard/Sidebar.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardHeader.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardLayout.tsx`

**Interfaces:**
- Consumes: tab, quyền admin, notification feature flag và account menu hiện có.
- Produces: sidebar trắng/sạch hơn, header nhẹ và vùng content có spacing gần Stitch.

- [x] **Step 1:** Giữ nguyên nhóm menu và quyền nhưng đổi surface, divider, active state và spacing theo Stitch.
- [x] **Step 2:** Tinh chỉnh header search/account spacing; không thêm help action giả.
- [x] **Step 3:** Điều chỉnh padding main desktop và giữ bottom navigation mobile.
- [x] **Step 4:** Chạy test shell/responsive hiện có.

### Task 5: Verification và review

**Files:**
- Review: toàn bộ diff.

**Interfaces:**
- Produces: bằng chứng kỹ thuật trước khi báo hoàn tất.

- [x] **Step 1:** Chạy `npm run test:run -- tests/TeacherOverview.test.tsx`.
- [x] **Step 2:** Chạy `npm run typecheck`.
- [x] **Step 3:** Chạy `npm run lint`.
- [x] **Step 4:** Chạy `npm run build:frontend` hoặc build được project phát hiện.
- [x] **Step 5:** Chạy Cypress responsive dashboard nếu môi trường browser khả dụng.
- [x] **Step 6:** Chạy `gitNexus.detect_changes` và review diff.
- [x] **Step 7:** Báo rõ test nào pass/fail; không commit/push/deploy.
