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
| D — Database/Operations | Task 12, 30–31 | `feat/modernization-integration` | Task 12 local implementation/rehearsal đạt; remote staging Time Travel còn mở |
| E — Performance/CI/Test | Task 27–28 | `feat/modernization-integration` | Tasks 27–28 hoàn tất |
| F — Product Features | Task 18–26, 32–35 | Chỉ mở sau khi dependency merge | Bị chặn bởi dependency |
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
- [ ] Task 10 — Chuyển auth compat → enforce *(local implementation complete; production observation pending)*
  - [x] Checked-in config dùng `enforce` + cookie-only; Bearer bị từ chối trong enforce.
  - [x] JWT thiếu issuer/audience/tokenVersion bị từ chối; student token mới có `tokenVersion: 0`.
  - [x] Compat ghi structured metric không chứa token/username; rollback được giới hạn về `AUTH_MIGRATION_MODE=compat`.
  - [x] 22 cookie/JWT migration tests, Workers typecheck và targeted lint đạt.
  - [x] Full regression sau khi đồng bộ fixture cookie-only: 309/309 file và 1.459/1.459 test đạt.
  - [ ] Xác nhận 0 legacy request hợp lệ trong 72 giờ production liên tục.
  - [ ] Sau 48 giờ enforce ổn định, xóa code path Bearer/legacy claims bằng commit riêng.
- [x] Task 11 — Security gate cho root và Workers
  - [x] Audit production dependencies root + Workers, cài Worker lockfile trong CI và Dependabot hàng tuần.
  - [x] Git-history secret scan, CSP/CORS/browser-auth và migration rollback gates chạy fail-closed.
- [ ] Task 12 — Backup D1 và restore rehearsal *(local-isolated complete; remote staging evidence pending)*
  - [x] Liệt kê table từ `sqlite_master`; loại `_cf_*`, `sqlite_*`, FTS virtual và toàn bộ FTS shadow tables.
  - [x] Chặn output/archive/manifest/report trong repository; thêm ignore defense-in-depth.
  - [x] Export data-only: local state dùng streaming `node:sqlite`, remote chỉ chạy khi có `--remote --confirm-remote <database>`.
  - [x] Gzip + AES-256-GCM, scrypt, SHA-256; passphrase chỉ nhận qua environment; plaintext SQL luôn bị xóa.
  - [x] Restore sang D1 local state hoàn toàn mới; canonical schema + data import + FTS rebuild.
  - [x] Kiểm tra schema gồm table/index/trigger, row count 59 bảng, auth/API DB-contract smoke và FTS source/index parity.
  - [x] Rehearsal cuối: backup 2,135 giây; restore 13,57 giây; controlled RPO 0 giây; 0 missing table và 0 row-count mismatch.
  - [ ] Tạo database staging remote riêng, chạy D1 Time Travel và authenticated HTTP smoke bằng owner-approved cloud operation.

## Wave 2 — Nền tảng UI/UX

- [x] Task 13 — Design tokens và design system
  - [x] Token semantic, 4px spacing, radius/elevation, reduced-motion, tài liệu, contrast/raw-hex tests.
  - [x] Teacher Overview pilot, desktop/mobile visual smoke và không tràn ngang.
- [x] Task 14 — Chuẩn hóa UI primitives
  - [x] Button/Card/Input/Alert/Skeleton/AsyncState/EmptyState và unit/Cypress component tests.
  - [x] Teacher Overview dùng primitives; Axe trên jsdom và Electron thật không có serious/critical violation.
- [x] Task 15 — Modal/Dialog accessible
- [x] Task 16 — Lỗi có requestId và retry
- [ ] Task 17 — Loading/empty/stale/offline states
- [ ] Task 18 — Điều hướng chính bằng URL
- [ ] Task 19 — Trải nghiệm mạng yếu/thiết bị yếu

## Wave 3 — Cải tiến tính năng

- [ ] Task 20 — Teacher Action Center
- [ ] Task 21 — AI question quality gate
- [ ] Task 22 — Live Exam reconnect/autosave/connection monitoring
- [ ] Task 23 — Results Intervention Center
- [ ] Task 24 — Parent digest/preferences/account recovery
- [ ] Task 25 — Gift Shop governance
- [ ] Task 26 — Notification preference/dedupe/quiet hours

## Wave 4 — Hiệu năng và observability

- [x] Task 27 — Bundle analyzer và performance budget CI
- [x] Task 28 — Lazy-load DOCX/PDF/worksheet/chart
- [ ] Task 29 — Pagination, virtualization và indexes
- [ ] Task 30 — Web Vitals, API latency và alerting

## Wave 5 — Vận hành và bảo mật nâng cao

- [ ] Task 31 — Operations Center backend
- [ ] Task 32 — Operations Center UI
- [ ] Task 33 — Security Center/session management
- [ ] Task 34 — Passkey/WebAuthn cho staff
- [ ] Task 35 — Runtime feature rollout control plane

## Wave 6 — Release

- [ ] Task 36 — Branch protection và release-readiness gate
- [ ] Task 37 — Production smoke và staged rollout automation
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
