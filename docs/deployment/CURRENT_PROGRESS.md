# TôHiệuQuiz — Trạng thái triển khai hiện tại

**Cập nhật:** 30/07/2026
**Nguồn hiện hành:** `task.md`, `implementation_plan.md` và hồ sơ trong `docs/operations/releases/`.

## Tóm tắt

- Tasks 1–38 của modernization plan đã hoàn tất và nằm trên `main`.
- Task 10 đã loại bỏ Bearer/legacy compatibility path trên production; Worker smoke hậu deploy đạt 15/15.
- Task 38 ở trạng thái **RELEASED**: private bookmark, reviewed cleanup, D1/R2 hậu kiểm, production smoke 15/15 và final release evidence đã hoàn tất.
- Modernization release được phát hành bằng tag/GitHub Release `v1.0.0`; lịch theo dõi dài hạn nằm tại `docs/operations/maintenance-calendar.md`.

## Source và deployment baseline

- Reviewed operational source trước final evidence: `cb6b41b39201d188bc12ad38c53fd84be5406b01`.
- API Worker: `tohieuquiz-api`.
- Worker version hiện nhận 100% traffic: `96705980-78e2-4b5b-89f2-883a989dfec7`.
- Worker rollback version đã review: `2003f752-22fd-4503-a05f-6c377ebfc08a`.
- Vercel deployment cho source `cb6b41b39201d188bc12ad38c53fd84be5406b01`: `4mpKdAvtL4dnBh2kfPbeFmQ4adi2`, trạng thái success; final evidence merge được Vercel kiểm tra lại trước khi tag.
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
- Task 38 đã capture bookmark production ngay trước cleanup; full value lưu ngoài repository, chỉ SHA-256 `f697567421542d29407f8d1176140fb69a6bb80359cd5da9fd9d2f62b490a5d1` được ghi trong evidence.

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

## Production cleanup evidence

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

Cleanup production được áp dụng lúc `2026-07-30T10:42:06.634Z` bằng request `task38-686977b3-12a7-4a5e-a356-c081f13cb458`: 72 statements, 65 changes, đúng một audit `PRODUCTION_TEST_DATA_CLEANED`. Target teacher/students/class còn 0; `smoke.student` và `thienkhanh` nằm trong `Lớp Smoke Production`; hai PNG test private R2 không còn; dry-run sau đó trả `up-to-date`.

## Smoke hậu cleanup

Production smoke run `30535769458` trên `main@cb6b41b` đạt trạng thái `ready`, 15/15 checks:

- frontend canonical/apex/parent;
- API health và CORS;
- hostile origin;
- unauthenticated guards cho admin/teacher/student/parent;
- cookie-authenticated read path cho admin/teacher/student/parent;
- public browser shell.

Run hoàn tất từ `2026-07-30T10:43:59.968Z` đến `2026-07-30T10:44:28.675Z`. Health/guard/role reads và public browser shell đều pass. Mười probe health trả 200, mười guard không đăng nhập trả 401, không quan sát 5xx; health TTFB trung bình khoảng 209 ms và guard khoảng 145 ms.

## Release v1.0.0

- [x] Capture private production Time Travel bookmark.
- [x] Merge cleanup prep và D1.batch hotfix với CI/Security/Release Readiness/Vercel xanh.
- [x] Chạy production cleanup từ commit đã merge.
- [x] Xác minh D1, audit, R2 và protected accounts.
- [x] Chạy production smoke 15/15.
- [x] Cập nhật release record thành `RELEASED`.
- [x] Merge final evidence và phát hành tag/GitHub Release `v1.0.0` từ merge commit chứa hồ sơ cuối.

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
