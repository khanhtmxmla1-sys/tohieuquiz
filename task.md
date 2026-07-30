# TôHiệuQuiz Modernization — Parallel Execution Progress

**Plan nguồn:** `implementation_plan.md`
**Chiến lược:** thực thi theo wave phụ thuộc, dùng worktree/branch riêng và chỉ đánh dấu `[x]` sau khi code + test đạt.
**Quy tắc:** không deploy production; không sửa/xóa thay đổi riêng đang có trên `main`.

## Luồng thực thi song song

| Stream | Phạm vi | Branch/worktree | Trạng thái |
|---|---|---|---|
| A — Baseline & Governance | Task 1–3 | `feat/modernization-integration` | Tasks 1–3 hoàn tất |
| B — Security/API/Privacy | Task 4–11 | `feat/modernization-integration` | Tasks 4–9 và 11 hoàn tất; Task 10 code/config đạt, observation production còn mở |
| C — UI Foundation | Task 13–16 | `feat/modernization-integration` | Tasks 13–16 hoàn tất trong phạm vi đã mở |
| D — Database/Operations | Task 12, 30–31 | `feat/modernization-integration` | Tasks 12, 30 và 31 hoàn tất |
| E — Performance/CI/Test | Task 27–28 | `feat/modernization-integration` | Tasks 27–28 hoàn tất |
| F — Product Features | Task 18–26, 32–35 | `feat/modernization-integration` | Tasks 18–26 và 32–35 hoàn tất |
| G — Production Release | Task 38 | Chỉ chạy sau owner approval | Không thực thi tự động |

## Wave 0 — Baseline và quản trị phạm vi

- [x] Task 1 — Tạo worktree và khóa baseline
  - [x] Khóa provenance tại `828d8c1`, ghi trạng thái root/worktree và không chạm thay đổi riêng trên `main`.
  - [x] Ghi đầy đủ install, lint, typecheck, full Vitest, security, build, bundle/CSS, warning và feature flags trong `docs/audits/2026-07-28-modernization-baseline.md`.
  - [x] Baseline trung thực: 1.432/1.436 test đạt; bốn assertion drift đã được liệt kê để xử lý trước gate cuối Batch 3.
- [x] Task 2 — Ma trận dữ liệu nhạy cảm và browser storage policy
- [x] Task 3 — Ma trận route–vai trò–ownership
  - [x] Registry thực thi phân loại đủ public/authenticated/student-owned/teacher-owned/admin-only/internal-only.
  - [x] CI contract quét mọi literal `/api/*` trong router và fail closed khi route mới thiếu policy.
  - [x] 59 abuse/matrix tests cho `studentId`, `quizId`, `resultId`, `classId`, `batchId`; thêm 36 regression tests middleware/router đạt.

## Wave 1 — Bảo mật và quyền riêng tư

- [x] Task 4 — Contract nghiêm ngặt cho AI Tutor
- [x] Task 5 — AI Tutor ownership và server-derived wrong questions
- [x] Task 6 — AI Tutor service binding, quota và safe logging
- [x] Task 7 — Loại StudentSession khỏi localStorage
- [x] Task 8 — Thu hẹp CacheService
- [x] Task 9 — Hợp nhất teacher auth store
- [x] Task 10 — Chuyển auth compat → enforce *(hoàn tất 2026-07-30; observation gates được đóng sớm theo owner risk override)*
  - [x] Production chạy cookie-only enforce từ 2026-07-30 13:05:51 UTC+7; smoke sau deploy đạt 15/15 checks.
  - [x] JWT thiếu issuer/audience/tokenVersion bị từ chối; student token mới có `tokenVersion: 0`.
  - [x] Gate 72 giờ và gate enforce 48 giờ được owner chỉ đạo đóng sớm ngày 2026-07-30; ghi nhận là risk override, không coi là đủ thời lượng hoặc đủ aggregate analytics.
  - [x] PR #20 loại Bearer extraction, legacy JWT acceptance, legacy telemetry, readable response token và hai flag compat; merge commit `8a9c12e`.
  - [x] TDD RED 6 failures → GREEN auth 6 file/24 test; sửa thêm fixture announcement cookie-only 8/8; full regression 374 file/1.722 test đạt.
  - [x] Worker version `96705980-78e2-4b5b-89f2-883a989dfec7` chạy 100% traffic từ 2026-07-30 15:09:07 UTC+7; rollback version `2003f752-22fd-4503-a05f-6c377ebfc08a` được giữ.
  - [x] Production smoke hậu deploy đạt 15/15; admin/teacher/student tạo session D1 mới, parent cookie login/read đạt, không có security event mới và 20 probe health/guard không có 5xx.
  - [x] Không chạy D1 migration, không thay đổi secrets và không tái tạo runtime compat flag.
- [x] Task 11 — Security gate cho root và Workers
  - [x] Audit production dependencies root + Workers, cài Worker lockfile trong CI và Dependabot hàng tuần.
  - [x] Git-history secret scan, CSP/CORS/browser-auth và migration rollback gates chạy fail-closed.
- [x] Task 12 — Backup D1 và restore rehearsal
  - [x] Liệt kê table từ `sqlite_master`; loại `_cf_*`, `sqlite_*`, FTS virtual và toàn bộ FTS shadow tables.
  - [x] Chặn output/archive/manifest/report trong repository; thêm ignore defense-in-depth.
  - [x] Export data-only: local state dùng streaming `node:sqlite`, remote chỉ chạy khi có `--remote --confirm-remote <database>`.
  - [x] Gzip + AES-256-GCM, scrypt, SHA-256; passphrase chỉ nhận qua environment; plaintext SQL luôn bị xóa.
  - [x] Restore sang D1 local state hoàn toàn mới; canonical schema + data import + FTS rebuild.
  - [x] Kiểm tra schema gồm table/index/trigger, row count 59 bảng, auth/API DB-contract smoke và FTS source/index parity.
  - [x] Rehearsal cuối: backup 2,135 giây; restore 13,57 giây; controlled RPO 0 giây; 0 missing table và 0 row-count mismatch.
  - [x] Dedicated APAC staging D1 đã hoàn tất Time Travel và authenticated HTTP smoke; không đọc hoặc sửa dữ liệu production.
  - [x] Remote encrypted export 81 bảng đạt trong 47,833 giây; fresh local restore đạt trong 18,627 giây, `schemaOk: true`, 0 missing table, 0 row-count mismatch và RPO kiểm soát 0 giây.
  - [x] Time Travel restore đạt trong 14,68 giây; marker staging bị loại bỏ, dữ liệu synthetic admin/lớp/đề/kết quả vẫn nguyên vẹn; login/quizzes/classes/results đều HTTP 200.
  - [x] Bằng chứng đã redact tại `docs/operations/d1-restore-rehearsal-2026-07-29.md`; UUID, bookmark đầy đủ, credential và archive không được đưa vào Git.
  - [x] Verification cuối: full Vitest 371 file/1.704 test, coverage 4 file/32 test; lint, frontend/strict/Worker typecheck, build, security/history/policy và dependency audit đều đạt.

## Wave 2 — Nền tảng UI/UX

- [x] Task 13 — Design tokens và design system
  - [x] Token semantic, 4px spacing, radius/elevation, reduced-motion, tài liệu, contrast/raw-hex tests.
  - [x] Teacher Overview pilot, desktop/mobile visual smoke và không tràn ngang.
- [x] Task 14 — Chuẩn hóa UI primitives
  - [x] Button/Card/Input/Alert/Skeleton/AsyncState/EmptyState và unit/Cypress component tests.
  - [x] Teacher Overview dùng primitives; Axe trên jsdom và Electron thật không có serious/critical violation.
- [x] Task 15 — Modal/Dialog accessible
- [x] Task 16 — Lỗi có requestId và retry
- [x] Task 17 — Loading/empty/stale/offline states
  - [x] Hook online/offline dùng browser events, SSR-safe; banner toàn ứng dụng có `role=status` và `aria-live=polite`.
  - [x] Mở rộng `AsyncState` cho initial skeleton, empty reason/CTA, stale timestamp, retry disabled và giữ dữ liệu khi lỗi mạng tạm thời.
  - [x] Áp dụng cho 5 pilot: Teacher Overview, Results, Classes, Student Dashboard và Parent Portal.
  - [x] Offline vẫn cho xem dữ liệu đã tải và export local; khóa refresh, mutation, làm bài, luyện tập, nhận thưởng, live exam và điều hướng tuần cần server.
  - [x] Classes/Results/Parent Portal xóa dữ liệu bảo vệ sau 401/403; lỗi mạng thường không làm mất cache hợp lệ.
  - [x] Targeted regression: 10 file, 79 test đạt; security-focused group 21/21; Cypress Electron offline/reconnect 1/1 đạt.
- [x] Task 18 — Điều hướng chính bằng URL
  - [x] URL là nguồn sự thật cho Teacher và Student Dashboard; guard chờ khôi phục phiên và không set state trong render.
  - [x] Deep link chưa đăng nhập giữ allowlisted `returnTo`; route sai vai trò, external URL, protocol-relative URL và hash bị từ chối.
  - [x] Results filters/sort/date/pagination và Student assignment pagination dùng search params; Back/Forward và refresh giữ đúng trạng thái.
  - [x] Gift Shop, Live Exam, Result Detail và Manual Quiz Workspace dùng URL canonical; giữ compatibility mapping một release.
  - [x] Targeted regression 12 file/95 test; Cypress Electron 2/2; full Vitest 314/314 file và 1.498/1.498 test.
- [x] Task 19 — Trải nghiệm mạng yếu/thiết bị yếu
  - [x] Tự động bật reduced experience theo reduced-motion, saveData, slow-2g/2g/3g, RAM/CPU thấp hoặc offline; có banner `aria-live` toàn ứng dụng.
  - [x] Không mount/tải ảnh 3D, CSS-3D pet và animation nặng ở reduced mode trên Home, Quiz List, Gift Shop, Pet và Dr. Owl.
  - [x] Live Exam lưu đáp án cục bộ theo session, hiển thị đang lưu/đã lưu/mất kết nối và chỉ xóa draft sau submit thành công.
  - [x] Submit Live Exam dùng bounded exponential retry, stable idempotency key và Worker replay an toàn cho duplicate cùng snapshot; request legacy vẫn tương thích một release.
  - [x] Preflight kiểm tra online, cookies, viewport, `/api/health` và clock drift trước khi hiển thị đề.
  - [x] Targeted regression 16 file/106 test; Cypress Electron saveData + 3G + reduced-motion 1/1; full Vitest 323/323 file và 1.527/1.527 test.

## Wave 3 — Cải tiến tính năng

- [x] Task 20 — Teacher Action Center
  - [x] Worker tổng hợp assignment at risk, bản nháp chưa hoàn tất, đơn đổi quà chờ trao và phiên thi sắp diễn ra theo đúng teacher/admin scope.
  - [x] Mỗi item có severity, explanation, count, generatedAt và CTA nội bộ; phản hồi giới hạn tối đa 8 item.
  - [x] Dashboard hiển thị trạng thái loading/error/empty và điều hướng giữ nguyên route/filter cho Assignment, Gift Shop, Live Exam và Manual Quiz draft.
  - [x] Targeted regression 8 file/43 test; Cypress Electron 2/2 với Gift Shop API flag; full verify 327 file/1.546 test, coverage, build và security audit đạt.
- [x] Task 21 — AI question quality gate
  - [x] Shared deterministic quality contract kiểm tra đáp án ngoài options, câu/phương án trùng, stem trống, lệch khối lớp và rủi ro parse toán.
  - [x] Màn hình tạo đề hiển thị blueprint/quota trước generate, hỗ trợ bản thử 3 câu không thể lưu và giữ đúng slot V3 đại diện.
  - [x] Review hiển thị blocking/warning theo câu; blocking khóa save ở UI và persistence, warning bắt buộc giáo viên xác nhận.
  - [x] Sinh lại từng câu có so sánh trước/sau và hoàn tác; metadata chỉ lưu prompt/blueprint version cùng quality summary/acknowledgement.
  - [x] Targeted regression 7 file/37 test; Cypress AI V2 6/6 và Blueprint V3 3/3; full verify 330 file/1.561 test, coverage, build và security audit đạt.
- [x] Task 22 — Live Exam reconnect/autosave/connection monitoring
  - [x] Autosave server-side dùng attemptVersion và idempotency key; snapshot cũ bị từ chối, replay cùng payload an toàn.
  - [x] Khi kết nối lại, học sinh lấy snapshot authoritative từ server và đồng bộ timer vẫn dựa trên endsAt server.
  - [x] Connection event log chỉ lưu loại sự kiện/version/thời điểm, không lưu nội dung đáp án.
  - [x] Teacher monitor hiển thị online/reconnecting/offline và lastSeen; submit vẫn idempotent, không tạo bài nộp trùng.
  - [x] Gia hạn cá nhân dùng deadline authoritative; pause/resume đóng băng đồng hồ và dịch chuyển hạn phòng/hạn riêng.
  - [x] Kết thúc sớm dùng xác nhận hai bước, token hash single-use có TTL, bắt buộc lý do và audit actor/request.
  - [x] Tự nộp giữ snapshot autosave mới nhất; phiên chỉ đóng sau khi mọi hạn riêng đã hết hoặc học sinh đã nộp.
  - [x] Targeted Live Exam 9 file/61 test và full Vitest 333 file/1.570 test đạt; lint, frontend/strict/Worker typecheck, build và security audit đạt.
- [x] Task 23 — Results Intervention Center
  - [x] Phân tích kết quả 28 ngày theo kỹ năng với ngưỡng tối thiểu 3 mẫu và confidence 0,55; hiển thị lần đầu, gần nhất và xu hướng 4 tuần.
  - [x] Copy hỗ trợ dùng “Cần hỗ trợ ở…”, không gắn nhãn tiêu cực; giáo viên tạo nhóm và lưu snapshot thành viên/khuyến nghị bài luyện.
  - [x] Ghi chú riêng chỉ giáo viên truy cập; group, note và assignment batch đều có audit actor/request/metadata.
  - [x] Từ nhóm đến giao bài chỉ 2 thao tác; tạo assignment cá nhân idempotent, tái dùng bài toàn lớp đang mở và chặn trùng/cross-group replay.
  - [x] Targeted regression 9 file/47 test; Cypress Electron 1/1; full Vitest 337 file/1.581 test, lint, frontend/strict/Worker typecheck, build và security audit đạt.
- [x] Task 24 — Parent digest/preferences/account recovery
  - [x] Migration D1 `0048` lưu preferences, token hash single-use, digest run idempotent và audit; có schema canonical, registry, audit query và rollback.
  - [x] Email provider adapter fail-closed: mặc định tắt, chỉ gửi khi provider HTTPS và SPF/DKIM/DMARC đều sẵn sàng; secret chỉ cấu hình phía Worker.
  - [x] Email verification hết hạn sau 24 giờ; recovery hết hạn sau 30 phút; token chỉ lưu SHA-256 hash, replay bị chặn và reset PIN tăng `token_version` để vô hiệu hóa phiên cũ.
  - [x] Phụ huynh cấu hình email, loại thông báo, opt-in bản tin tuần, ngày/giờ gửi và khung giờ yên lặng; có thể bỏ chọn toàn bộ loại email.
  - [x] Digest tuần chỉ lưu/gửi số liệu tổng hợp, tối đa ba nội dung cần hỗ trợ và ba gợi ý tại nhà; không chứa tên, lớp, email, ID kết quả, câu hỏi hoặc đáp án.
  - [x] UI có cài đặt liên lạc, xác minh email, “Quên PIN?”, yêu cầu recovery generic và đặt PIN mới; token bị loại khỏi URL sau khi dùng, không persist vào localStorage.
  - [x] Targeted regression 7 file/44 test; Cypress Parent Portal 4/4; full Vitest 341 file/1.599 test và coverage 4 file/32 test đạt; lint, strict/Worker typecheck, build, security và dependency audit đạt.
- [x] Task 25 — Gift Shop governance
  - [x] Catalog hỗ trợ phạm vi trường/lớp, tồn kho, ngưỡng sắp hết và giới hạn đổi theo tuần; giáo viên chỉ xem dữ liệu trong phạm vi được cấp.
  - [x] Mua quà dùng transaction/trigger D1 nguyên tử, không âm xu hoặc tồn kho và chặn tranh chấp món cuối.
  - [x] State machine `PENDING → APPROVED → DELIVERED`; voucher chỉ cấp sau duyệt, transition sai bị từ chối.
  - [x] Hủy đơn bắt buộc lý do, hoàn xu/phục hồi tồn kho idempotent và ghi audit actor/request ID.
  - [x] Giáo viên/admin đóng mở tiệm theo phạm vi; học sinh thấy lý do đóng, tồn kho và giới hạn tuần.
  - [x] Action Center cảnh báo tồn kho thấp và mở đúng bộ lọc Gift Shop; đã bổ sung bảo vệ render cho `gift_low_stock`.
  - [x] Migration/rollback `0049`, schema canonical, registry, policy và route contract được đồng bộ.
  - [x] Targeted Vitest 14 file/116 test và Action Center 2 file/10 test; Cypress Gift Shop 4/4 và Action Center 2/2; lint, frontend/Worker typecheck, build và security scan đạt.
- [x] Task 26 — Notification preference/dedupe/quiet hours
  - [x] Contract và UI phân loại `critical`, `action_required`, `informational`; critical luôn bật, informational có thể trì hoãn theo giờ yên lặng.
  - [x] Dedupe theo recipient/type/resource/window; expiry và internal action URL được kiểm tra theo allowlist.
  - [x] Read/unread là trạng thái authoritative từ server; client chỉ cập nhật sau khi API xác nhận và giữ nguyên khi request lỗi.
  - [x] Preferences theo người dùng/role, loại thông báo, timezone và quiet hours; migration/rollback `0050`, schema canonical, registry và audit query đã đồng bộ.
  - [x] Admin aggregate metrics theo sent/read/click; click tracking và quyền truy cập route được kiểm tra.
  - [x] Targeted regression và Cypress Notifications 2/2 đạt; full Vitest 346 file/1.625 test, coverage 4 file/32 test, lint, frontend/strict/Worker typecheck, build, security và dependency audit đều đạt.

## Wave 4 — Hiệu năng và observability

- [x] Task 27 — Bundle analyzer và performance budget CI
- [x] Task 28 — Lazy-load DOCX/PDF/worksheet/chart
- [x] Task 29 — Pagination, virtualization và indexes
  - [x] Results, Students, Teachers và Gift Shop Orders dùng stable cursor; mặc định 25 và giới hạn tối đa 100 rows mỗi request.
  - [x] Client tải theo trang có giới hạn; filter/sort/page/cursor được giữ trong URL ở Teacher Management.
  - [x] Danh sách trên 100 items dùng virtualization có `role=list`, `aria-setsize` và `aria-posinset`.
  - [x] Migration/rollback `0051` bổ sung index cursor cho results, students, teachers, gift orders và notifications; schema/registry/audit đã đồng bộ.
  - [x] Benchmark SQLite 10.000 rows đạt p95 khoảng 0,03–0,06 ms; targeted 9 file/51 test, full verify, coverage, build và security đều đạt.
- [x] Task 30 — Web Vitals, API latency và alerting
  - [x] Frontend thu thập LCP/INP/CLS qua `web-vitals`, lấy mẫu tối đa 10% và chỉ gửi pathname, release, metric/rating, request ID; không query, PII, câu hỏi hoặc đáp án.
  - [x] Worker telemetry endpoint giới hạn 4 KB, allowlist CLS/INP/LCP, rate limit fail-closed và structured log có request correlation.
  - [x] Request completion log dùng route template/family, method, status, duration và role category cardinality thấp; ID động bị loại khỏi route log.
  - [x] Runbook định nghĩa ngưỡng Web Vitals/API latency và alert 5xx, login, 429, Queue/DLQ, certificate, AI/cost; mỗi alert có owner, cooldown và runbook.
  - [x] Targeted 7 file/56 test; full Vitest 352 file/1.640 test, coverage 4 file/32 test, lint, frontend/strict/Worker typecheck, build, security và dependency audit đều đạt.

## Wave 5 — Vận hành và bảo mật nâng cao

- [x] Task 31 — Operations Center backend
  - [x] Admin snapshot bao phủ API, D1, migration, Queue, DLQ, R2, AI, certificate processing, backup evidence và feature flags.
  - [x] Mỗi component có `healthy|degraded|unavailable|unknown`, checkedAt, latency, summary, code và metrics cardinality thấp.
  - [x] Từng probe có timeout riêng; lỗi dependency không làm hỏng toàn snapshot và không rò raw error, secret hoặc binding ID.
  - [x] Route `/api/admin/operations` chỉ cho admin, `Cache-Control: no-store`; teacher bị từ chối.
  - [x] Targeted 4 file/49 test; full Vitest 354 file/1.649 test, coverage 4 file/32 test, lint, typecheck, build, security và dependency audit đều đạt.
- [x] Task 32 — Operations Center UI
  - [x] Route `/teacher/operations` và menu chỉ hiển thị cho admin; teacher truy cập trực tiếp bị chuyển về Tổng quan và không gọi API operations.
  - [x] Một màn hình hiển thị overall/component health, last checked, probe latency, metrics, refresh và runbook read-only.
  - [x] Biểu đồ status/latency lazy-load; cho phép sao chép request ID và release SHA, không hiển thị raw log hay thao tác phá hủy.
  - [x] Cypress Electron admin/teacher 2/2; full Vitest 355 file/1.653 test, coverage 4 file/32 test, lint, strict/frontend/Worker typecheck, build, security và dependency audit đều đạt.
- [x] Task 33 ? Security Center/session management
  - [x] JWT m?i c? `sessionId`; D1 migration/rollback `0052` l?u session metadata t?i thi?u v? security events, kh?ng l?u full IP ho?c raw user-agent.
  - [x] Ng??i d?ng xem phi?n hi?n t?i/thi?t b? kh?c, thu h?i t?ng phi?n v? logout-all theo cutoff; request sau revoke b? 401, phi?n t?o sau cutoff kh?ng b? ?nh h??ng.
  - [x] ??i/reset m?t kh?u, session revoke, logout-all v? login threshold ghi security event; retention 90 ng?y ???c purge b?ng cron.
  - [x] UI Security Center n?m trong C?i ??t c? nh?n; Cypress Electron 1/1, targeted 5 file/24 test, full Vitest 356 file/1.653 test, coverage 4 file/32 test, lint, frontend/strict/Worker typecheck, build, security v? dependency audit ??u ??t.
- [x] Task 34 — Passkey/WebAuthn cho staff
  - [x] SimpleWebAuthn 13.3.0 được pin cho browser/Worker; RP ID `thtohieu.com`, exact origins, challenge SHA-256 single-use TTL 5 phút và signature counter CAS.
  - [x] Passkey chỉ dành cho teacher/admin, phát hành cùng sessionId/JWT/HttpOnly cookie như mật khẩu; mật khẩu vẫn là fallback và recovery path.
  - [x] Migration/rollback `0053`, Security Center thêm/xóa passkey, Cypress 1/1; full Vitest 364 file/1.679 test, coverage 4 file/32 test, build, security và dependency audit đều đạt.
- [x] Task 35 — Runtime feature rollout control plane
  - [x] Resolver deterministic theo user + flag, audience admin/teacher/student/parent/all, percentage, user/class allowlist và time window; parent identity lấy từ Parent Portal session đã xác minh.
  - [x] Admin chỉ PATCH một trường mỗi request với reason bắt buộc, before/after audit, actor/request ID, owner, stop conditions, preview cohort và rollback gần nhất không cần deploy.
  - [x] Migration/rollback `0054`, Cypress 1/1; full Vitest 363 file/1.676 test, coverage 4 file/32 test, build, security và dependency audit đều đạt; regression hợp nhất 15 file/96 test.

## Wave 6 — Release

- [x] Task 36 — Branch protection và release-readiness gate
  - [x] Workflow gate chạy trên pull request/main, bao phủ verify, performance budget, migration contract và Cypress V2/V3; không có lệnh deploy.
  - [x] Script và workflow sinh artifact JSON `ready|blocked`; báo cáo aggregate giữ tên check ổn định `Release ready`.
  - [x] CODEOWNERS, desired-state branch protection và runbook xác minh/rollback đã được thêm.
  - [x] Branch protection remote đã được reconcile và xác minh qua GitHub API trên `main`: bắt buộc pull request, 1 approval, CODEOWNERS, dismiss stale approvals, conversation resolution, strict required checks, enforce admins, cấm force-push và cấm xóa nhánh; không có ruleset bypass.
  - [x] Targeted 5 file/26 test; full Vitest 349 file/1.634 test, coverage 4 file/32 test, lint, typecheck, build, security và dependency audit đều đạt.
- [x] Task 37 — Production smoke và staged rollout automation
  - [x] Smoke read-only bao phủ apex/canonical/parent/API domains, security headers, immutable asset, same-origin health, exact CORS, hostile origin và auth guard.
  - [x] Dùng dedicated GitHub Environment secrets cho admin/teacher/student/parent; kiểm tra một read path mỗi role, không đưa credential vào CLI, screenshot hoặc report.
  - [x] Rollout runtime theo chuỗi admin-only → 5% teacher → pilot class → 25% → 100%, có cửa sổ quan sát 24–48 giờ, single-field PATCH, compensation và rollback stage trước.
  - [x] Stop conditions chặn rollout khi 5xx >1%, client errors >2x baseline, p95 +30%, data corruption hoặc auth anomaly; artifact JSON `ready|blocked|observing` được redact.
  - [x] AI smoke chỉ đọc quota/feature resolution; Queue/certificate mutation bị cấm trên production và chỉ cho phép namespace `staging|test`.
  - [x] Cypress public production 3/3; targeted sau cùng 5 file/23 test; full Vitest 371 file/1.702 test, coverage 4 file/32 test, lint, typecheck, build, security/history/policy và dependency audit đều đạt.
- [ ] Task 38 — Cleanup production, release notes và maintenance calendar

## Verification bắt buộc

- [x] Frontend typecheck
- [x] Workers typecheck
- [x] Unit/integration tests
- [x] Security scan + dependency audit root/workers
- [x] Production build + bundle budget
- [x] Cypress component/E2E liên quan
- [x] Playwright/browser smoke frontend local: HTTP 200, không `pageerror`, không tràn ngang
- [x] Review diff và secret scan

## Batch 7 — Low-bandwidth resilience verification

- [x] Capability policy bao phủ reduced-motion, saveData, slow-2g/2g/3g, RAM thấp, CPU thấp và offline; banner reduced experience có `role=status`/`aria-live=polite`.
- [x] Home, Quiz List, Gift Shop/Shop Modal, PetDisplay và Dr. Owl không mount 3D/rich media trong reduced mode; CSS-3D pet được lazy-load.
- [x] Live Exam autosave đáp án vào `sessionStorage` với trạng thái đang lưu/đã lưu/mất kết nối; offline chặn submit nhưng không xóa draft.
- [x] Client retry tối đa 3 lần với exponential backoff; cùng snapshot dùng cùng idempotency key; Worker replay duplicate giống nhau và từ chối snapshot khác.
- [x] Live Exam preflight fail-closed cho mạng, cookie, viewport, API health và clock drift; có retry accessible.
- [x] Targeted regression: 16 file, 106 test đạt; Cypress Electron low-bandwidth: 1/1 đạt và Resource Timing có 0 request `/3D/`.
- [x] Full Vitest: 323/323 file, 1.527/1.527 test; 504,56 giây theo Vitest, 507,15 giây wrapper.
- [x] Full lint, frontend/strict/Workers typecheck, production build, performance budget, security/history/policy gates và root/Workers audits đạt; 0 lỗ hổng.
- [x] Build 4.459 modules; initial JS gzip 184.160 B, CSS gzip 41.200 B, largest lazy gzip 125.537 B, largest minified chunk 404.881 B.
- [x] MCP diff review PASS, không P1/P2/P3; UTF-8 và suspicious-question-mark scans không có finding.

## Batch 6 — URL-first navigation verification

- [x] Teacher và Student primary routes dùng URL canonical; session guard chờ restore trước redirect/render.
- [x] `returnTo` chỉ nhận internal same-role path; không còn primary `setView('teacher_dash')` hoặc `setView('shop')`.
- [x] Results filter/sort/date/page và Student assignment page được khôi phục từ search params; Back/Forward giữ trạng thái.
- [x] Live Exam lưu metadata tối thiểu trong `sessionStorage`, không lưu answers; Gift Shop/Result Detail/Manual Workspace quay về URL canonical.
- [x] Targeted regression: 12 file, 95 test đạt; Cypress Electron URL navigation: 2/2 đạt.
- [x] Full Vitest: 314/314 file, 1.498/1.498 test; 491,10 giây theo Vitest, 493,97 giây wrapper.
- [x] Full lint, frontend/strict/Workers typecheck, production build, performance budget, security/history/policy gates và root/Workers audits đạt; 0 lỗ hổng.
- [x] GitNexus risk medium; MCP diff review không có P1/P2/P3; UTF-8/mojibake scan 0 findings.

## Batch 5 — Async/offline UX verification

- [x] TDD RED xác nhận thiếu hook/banner/props; GREEN với `tests/AsyncStates.test.tsx` gồm 9 contract tests.
- [x] Năm pilot có skeleton/empty/stale/offline states; không thay nội dung bằng màn hình trắng khi còn cache hợp lệ.
- [x] Offline banner được kiểm chứng trên Electron thật; tự biến mất sau sự kiện reconnect.
- [x] 401/403 xóa stale protected data ở Classes, Results và Parent Portal, gồm cả class mutations.
- [x] GitNexus indexed diff: risk medium do ResultsTab tham gia 4 execution flows; 79 targeted tests bao phủ các flow liên quan.
- [x] Full lint, frontend/strict/Workers typecheck, production build, bundle budget, security/history/policy gates và root/Workers audit đạt; 0 lỗ hổng.
- [x] Full Vitest: 311/311 file, 1.479/1.479 test; 416,49 giây theo Vitest, 418,52 giây wrapper.

## Batch 4 — D1 backup/restore verification

- [x] TDD RED 6/6 do script chưa tồn tại; GREEN cuối 10/10 test backup safety/encryption/schema/verification.
- [x] D1 regression group: 4 files, 23 tests đạt.
- [x] Local-isolated rehearsal với dữ liệu liên kết teacher/class/student/quiz/question/result/RAG đạt.
- [x] 59 regular tables; loại 1 FTS virtual, 5 FTS shadow và 2 system tables.
- [x] Encrypted archive không chứa `CREATE TABLE`, không có plaintext `.sql` trong backup directory và không có artifact D1 trong repository.
- [x] Full Vitest: 310/310 file và 1.469/1.469 test; 398,28 giây theo Vitest, 400,18 giây wrapper.
- [x] Full lint, frontend/strict/Workers typecheck, security gates, audits, build và performance budget đạt.
- [ ] Remote staging Time Travel, authenticated HTTP smoke và staging RPO/RTO còn chờ cloud resource/owner approval.

## Batch 3 — Final verification

- [x] Full Vitest: 309/309 file, 1.459/1.459 test; 416,01 giây theo Vitest, 418,17 giây wrapper.
- [x] ESLint, frontend typecheck và Workers typecheck đạt.
- [x] Security scan/history/policy gates và production dependency audits root + Workers đạt, 0 lỗ hổng.
- [x] Production build đạt; 4.447 modules; mọi chunk dưới 500 KB minified.
- [x] Bốn assertion drift của baseline đã được xử lý; canonical `workers/schema.sql` đã đồng bộ hai bảng quota AI Tutor của migration `0044`.
- [x] Bảy fixture Bearer cũ trong Smart Assignment/Weakness Profile đã chuyển sang cookie JWT enforce và 9/9 test mục tiêu đạt.
- [x] Mỗi task lớn của Batch 3 đã có commit riêng; chưa push, merge, deploy, migration production, đổi secret hoặc sửa production DB.
- [ ] Task 10 vẫn chờ bằng chứng production 72 giờ không có legacy request và 48 giờ enforce ổn định trước khi xóa compat path.

## File matrix của batch hiện tại

- AI Tutor: strict contract, ownership/context services, quota/service binding, migration/rollback và 4 nhóm test.
- Auth/Security: canonical teacher auth store, xóa duplicate stores, auth E2E, Git-history secret scan và CSP/CORS/JWT/migration gates.
- UI/Error UX: Teacher Overview pilot dùng tokens/primitives, accessibility audit, SupportError/requestId/retry.
- Performance: dynamic imports cho DOCX/PDF/html2canvas/chart boundaries và lazy-loading tests.

## Nhật ký hoàn thành

### Batch 2 hoàn tất ngày 2026-07-28

- [x] Stream A — AI Tutor Tasks 4–6: code + tests + migration.
- [x] Stream B — Auth/Security Tasks 9, 11: code + tests + CI gates.
- [x] Stream C — UI/Error Tasks 13, 14, 16: pilot + accessibility + error UX.
- [x] Stream D — Performance Task 28: dynamic imports + budget verification.
- Vitest: **21 files, 81 tests passed**.
- Cypress component + Axe real browser: **2 specs, 3 tests passed**, desktop/mobile screenshots, không serious/critical violation.
- Lint, frontend typecheck, Workers typecheck, production build và `git diff --check`: **PASS**.
- Performance: initial JS gzip **173,959 B**, CSS gzip **41,649 B**, largest lazy gzip **125,536 B**, largest minified chunk **404,881 B**; allowlist **rỗng**.
- `docxQuestionImporter`: giảm từ khoảng **504,897 B** xuống **3,029 B**; `jszip` tách riêng **97,116 B**.
- Security scan: **1,728 files**, Git history scan, CSP/CORS/browser-auth/rollback gates: **PASS**.
- Dependency audit root + Workers production: **0 vulnerabilities**.
- Quét mojibake trên toàn bộ file thay đổi: **0 findings**.
- MCP diff review: không có P1; một cảnh báo heuristic về `console.info` đã được xác minh là structured metadata an toàn, không chứa prompt/output/PII.
- Playwright frontend smoke: HTTP 200, không JavaScript `pageerror`, không horizontal overflow. Worker local trên Windows bị `workerd` dừng ở runtime (`std::terminate`); Worker tests và typecheck vẫn đạt.
- Không commit, merge hoặc deploy production.

### Batch xác minh trước đó ngày 2026-07-28

- Hoàn tất đầy đủ: **Task 2, 7, 8, 15, 27**.
- Hoàn tất một phần có code/test: **Task 11, 13, 14**; giữ `[ ]` vì chưa đủ acceptance toàn task.
- Privacy/Cache tests: **8 files, 30 tests passed**.
- UI/Design/Performance/Security config tests: **5 files, 18 tests passed**.
- Cypress component: **2 specs, 2 tests passed**.
- Lint: PASS; Frontend typecheck: PASS; Workers typecheck: PASS; production build: PASS.
- Security scan: **1,710 files checked, 0 findings**.
- Dependency audit: root **0 vulnerabilities**, Workers **0 vulnerabilities**.
- Performance: initial JS gzip **173,661 B**, CSS gzip **41,885 B**, largest lazy gzip **132,320 B** — đạt budget.
- Legacy `docxQuestionImporter` minified **504,897 B** có ngoại lệ hết hạn **2026-08-15**, bắt buộc xử lý ở Task 28.
- MCP diff review: **PASS, 0 findings**; `git diff --check`: PASS.
- Không deploy, không thay đổi secret, không truy vấn/xóa dữ liệu production và không chạy D1 production migration.
