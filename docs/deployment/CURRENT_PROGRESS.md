# TôHiệuQuiz — Trạng thái triển khai hiện tại

**Cập nhật:** 30/07/2026
**Nguồn hiện hành:** `task.md`, `implementation_plan.md` và hồ sơ trong `docs/operations/releases/`.

## Tóm tắt

- Tasks 1–37 của modernization plan đã hoàn tất và nằm trên `main`.
- Task 10 đã loại bỏ Bearer/legacy compatibility path trên production; Worker smoke hậu deploy đạt 15/15.
- Task 38 đang ở trạng thái **PREPARED**: script cleanup, test, dry-run, runbook, maintenance calendar và release record đã được chuẩn bị; chưa chạy thao tác xóa production tại checkpoint này.
- Mọi thao tác production của Task 38 phải theo thứ tự: Time Travel bookmark → merge PR prep → cleanup write → production smoke → final evidence/tag.

## Source và deployment baseline

- Git baseline trước Task 38: `ed2503d12954dcfbecf7a03c416b9419eeea032d`.
- API Worker: `tohieuquiz-api`.
- Worker version hiện nhận 100% traffic: `96705980-78e2-4b5b-89f2-883a989dfec7`.
- Worker rollback version đã review: `2003f752-22fd-4503-a05f-6c377ebfc08a`.
- Vercel production source baseline: `ed2503d12954dcfbecf7a03c416b9419eeea032d`.
- Latest source migration: `0054_feature_rollout_control_plane.sql`.
- Branch protection `main`: PR bắt buộc, 1 approval, CODEOWNERS, dismiss stale approvals, conversation resolution, strict required checks, enforce admins; cấm force-push và branch deletion.

## Cloudflare resources

- D1: `tohieuquiz-db`, APAC.
- R2 public assets: `tohieuquiz-og-images`.
- R2 private certificates: `tohieuquiz-certificates`; bucket phải tiếp tục private.
- Queue: `tohieuquiz-certificate-generation`.
- DLQ: `tohieuquiz-certificate-generation-dlq`.
- API domain: `api.thtohieu.com`.
- Public asset domain: `assets.thtohieu.com`.
- AI gateway route: `ai.thtohieu.com/v1`.
- Secrets `JWT_SECRET` và `CLIPROXY_TOKEN` tồn tại theo tên; giá trị không được đọc, ghi vào tài liệu hoặc đưa vào biến `VITE_*`.

## Frontend production

- Canonical domain: `https://www.thtohieu.com`.
- Apex domain: `https://thtohieu.com`.
- Parent domain: `https://phuhuynh.thtohieu.com`.
- Vercel project: `vh-s-projects3/tohieuquiz`.
- Git integration và custom-domain deployment đã hoạt động.
- CSP, HSTS, frame/content-type protections, robots, sitemap và API rewrite đã được production smoke kiểm tra.

## Backup và phục hồi

- D1 Time Travel là rollback chính cho production operations.
- Tablewise encrypted backup dùng gzip + AES-256-GCM, scrypt và SHA-256; passphrase chỉ qua environment.
- FTS virtual/shadow tables không được export trực tiếp; chỉ số được rebuild từ canonical `rag_chunks`.
- Remote staging Time Travel, encrypted export, isolated restore, schema/row-count/FTS verification và authenticated HTTP smoke đã hoàn tất ngày 29/07/2026.
- Task 38 phải capture một bookmark production mới ngay trước cleanup và lưu full value ngoài repository.

## Task 38 cleanup scope

Approved deletion targets:

- `test.gv1`;
- `test.hs1`;
- `test.hs2`;
- `Lớp Test 1`;
- quiz/assignment/result/live-exam/report/certificate/notification artifacts liên kết rõ ràng;
- hai PNG chứng nhận test trong private R2.

Protected records:

- `tongminhkhanh`, `admin`, `viethong`, `smoke.admin`;
- `smoke.teacher`, `smoke.student` và parent smoke link;
- `thienkhanh`, vì không nằm trong danh sách được phép xóa.

`smoke.student` và `thienkhanh` sẽ được chuyển sang lớp deterministic `Lớp Smoke Production`, do `smoke.teacher` quản lý, trước khi lớp cũ bị xóa. Nếu có thêm class occupant ngoài allowlist, script dừng fail-closed.

## Production dry-run evidence

Dry-run read-only đã đạt:

- quiz: 1;
- assignments: 2;
- results: 4;
- certificate batch/certificates: 1/2;
- live-exam session: 1;
- result report/batches: 1/2;
- notifications/parent notifications: 6/6;
- planned R2 deletion: 2 private certificate PNG objects.

Cleanup script:

- mặc định dry-run;
- yêu cầu `--confirm-remote tohieuquiz-db`;
- write yêu cầu thêm bare `--write` và `--confirm-cleanup task38-test-fixtures`;
- dùng một D1 transaction, row counts, post-verification và một audit record deterministic;
- giữ nguyên audit/security history;
- có test transaction chạy lại idempotent.

Runbook: `docs/operations/production-test-data-cleanup.md`.

## Smoke baseline

Production smoke gần nhất trước Task 38 đạt trạng thái `ready`, 15/15 checks:

- frontend canonical/apex/parent;
- API health và CORS;
- hostile origin;
- unauthenticated guards cho admin/teacher/student/parent;
- cookie-authenticated read path cho admin/teacher/student/parent;
- public browser shell.

Sau cleanup phải chạy lại cùng workflow và chỉ đóng Task 38 nếu 15/15 tiếp tục đạt.

## Hạng mục còn lại để phát hành v1.0.0

- [ ] Capture private production Time Travel bookmark.
- [ ] Merge cleanup prep PR với CI/Security/Release Readiness/Vercel xanh.
- [ ] Chạy production cleanup từ commit đã merge.
- [ ] Xác minh D1, audit, R2 và protected accounts.
- [ ] Chạy production smoke 15/15.
- [ ] Cập nhật release record thành `RELEASED`.
- [ ] Merge final evidence và tạo tag `v1.0.0`.

## Tích hợp không chặn modernization release

- Email provider chưa bật; Parent Portal email path tiếp tục fail-closed cho tới khi SPF/DKIM/DMARC và provider được cấu hình.
- Feature audiences có thể tiếp tục disabled/staged theo quyết định sản phẩm thông qua runtime rollout control plane.
- Dependabot major upgrades được review riêng, không merge hàng loạt trong Task 38.
- Project Vercel cũ có thể xóa sau để tránh nhầm lẫn nhưng không phải blocker.

## Nguyên tắc tiếp tục

- Không đưa secret, password, token, hash, full Time Travel bookmark hoặc dữ liệu phụ huynh vào Git/CI/chat.
- Không làm public bucket chứng nhận.
- Không xóa owner-created data ngoài danh sách đã phê duyệt.
- Sau mỗi production mutation phải chạy health, CORS, auth guard, role smoke và kiểm tra security events.
