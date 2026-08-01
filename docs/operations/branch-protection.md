# Branch protection cho `main`

Tài liệu này mô tả desired state trên GitHub. File trong repository không tự thay đổi cài đặt từ xa; chủ sở hữu repository phải áp dụng và lưu bằng chứng trong release record.

## Trạng thái remote

- Kiểm tra read-only ngày 29/07/2026 nhận HTTP 403: branch protection cho repository private yêu cầu GitHub Pro hoặc repository public.
- Không chuyển repository sang public và không thay đổi gói tài khoản trong task này.
- Sau khi điều kiện gói được đáp ứng, áp desired state và chạy lại toàn bộ mục Xác minh bên dưới.

## Quy tắc bắt buộc

- Chỉ merge qua pull request; không direct push vào `main`.
- Tối thiểu một approval từ người có quyền review.
- Dismiss stale approvals khi có commit mới.
- Require review từ CODEOWNERS cho các đường dẫn nhạy cảm.
- Require conversation resolution trước merge.
- Require branch up to date trước merge.
- Chặn force push và chặn xóa branch.
- Không cho administrator bypass trong quy trình phát hành thông thường.

## Required status checks

Tên check phải khớp chính xác với workflow:

- `ESLint`
- `Type check (frontend + workers)`
- `Vitest shard 1/2`
- `Vitest shard 2/2`
- `Production build`
- `Cypress — stubbed specs (Blueprint V3 off)`
- `Cypress — Blueprint V3 spec (Blueprint V3 on)`
- `security`

`Coverage threshold` và `Release readiness / Release ready` chỉ chạy sau khi merge vào `main`, vì vậy không đặt làm required check của pull request. Không dùng `paths-ignore` cho sự kiện `pull_request` của các workflow có required checks; nếu cả workflow bị bỏ qua theo đường dẫn, GitHub có thể giữ check ở trạng thái chờ.

## Xác minh

1. Mở một pull request thử với một test cố ý thất bại: merge phải bị khóa.
2. Push commit mới sau approval: approval cũ phải bị dismiss.
3. Thử direct push và force push bằng tài khoản không có bypass: cả hai phải bị từ chối.
4. Sửa file thuộc `workers/src/security/`: CODEOWNER review phải trở thành bắt buộc.
5. Chụp hoặc xuất cấu hình ruleset và ghi URL/bằng chứng vào hồ sơ phát hành.

## Rollback

Không tắt toàn bộ protection để xử lý sự cố. Dùng pull request rollback đã được review và chạy đủ required checks. Emergency bypass chỉ dùng theo quy trình break-glass, phải ghi actor, lý do, commit và thời gian; sau đó khôi phục ruleset ngay.
