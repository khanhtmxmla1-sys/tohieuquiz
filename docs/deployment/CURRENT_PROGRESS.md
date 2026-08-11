# TôHiệuQuiz — Trạng thái triển khai hiện tại

**Cập nhật:** 11/08/2026
**Nguồn hiện hành:** `docs/operations/releases/2026-08-11-announcement-feature-rollout-production.md`, `docs/operations/releases/2026-08-09-question-presentation-integrity-production.md`, `docs/operations/releases/2026-08-08-manual-quiz-rich-text-production.md` và hồ sơ trong `docs/operations/releases/`.

## Tóm tắt

- Modernization release `v1.0.0` và Tasks 1–38 là baseline lịch sử đã hoàn tất.
- Announcement Management & Feature Rollout UX đã phát hành qua PR #106, merge `ead956616b2e44098ac4df0d0ffbc5b8bf78519e` ngày 11/08/2026.
- Worker `tohieuquiz-api` cho PR #106 được deploy trước frontend ở version `c744f751-3ba0-40b5-ac7e-401e7c019e23`; rollback reviewed giữ tại `96ee5fce-2187-482c-a1f8-eb66be403a49`.
- Vercel Production cho merge `ead9566` hoàn tất thành công; production smoke sau deploy GitHub run `31503033979` và Worker pre-merge smoke run `31502835275` đều `success`.
- Main CI `31502976649`, Security `31502976662` và Release Readiness `31502976562` đều hoàn tất `success` trên release này.
- PR #106 không thêm D1 migration. Feature Rollout admin dùng batch endpoint nguyên tử có `expectedVersion`; single-field PATCH vẫn giữ để tương thích ngược và cho staged-rollout CLI hiện hành.
- Manual Quiz Rich Text Editor + Compact Attachment đã phát hành ngày 08/08/2026 từ merge `d519fb70c09a4927a8e09cf18244f5cb82e4a374`.
- Question Presentation Integrity & Historical Review Rendering đã merge qua PR #92 tại `406973f6794d1111d6cd84360b3d9e3c5c21c730` và Worker production được rollout 0% → 10% → 50% → 100% ngày 09/08/2026.

## Source và deployment baseline

- Repository `origin/main` tại release audit: `ead956616b2e44098ac4df0d0ffbc5b8bf78519e`.
- Announcement/Feature Rollout PR #106 merge: `ead956616b2e44098ac4df0d0ffbc5b8bf78519e`.
- API Worker: `tohieuquiz-api`.
- Worker version production của release này: `c744f751-3ba0-40b5-ac7e-401e7c019e23`.
- Worker rollback version reviewed được giữ: `96ee5fce-2187-482c-a1f8-eb66be403a49`.
- Vercel GitHub deployment ID cho `ead9566`: `5852660659`, trạng thái `Production / success`.
- PR #106 không có D1 migration; Release Readiness xác nhận migration/rollback contract đạt.
- Source migration set hiện có tới `0066_student_reward_ledger.sql`; audit D1 remote ngày 11/08/2026 trả `No migrations to apply!`. PR #106 không thay đổi schema.
- Branch protection `main`: PR bắt buộc, required checks, CODEOWNERS review và approval; PR #106 đã đi qua các gate này.

## Announcement & Feature Rollout production baseline

- Admin announcement UI nằm ở khu vực quản trị thông báo; Feature Rollout đã tách sang route admin riêng `/teacher/feature-rollout`.
- Announcement authoring UI chỉ cung cấp ba kênh production được hỗ trợ: `CRITICAL_STRIP`, `TICKER`, `BANNER`.
- Publish/schedule được validate lại ở Worker; không dựa vào frontend để bảo đảm nội dung, channel, CTA và schedule hợp lệ.
- Lifecycle hỗ trợ publish/schedule, cancel, end và archive; archived/expired không bị biến thành draft khi mở lại.
- Feature Rollout UI dùng `PATCH /api/system-settings/feature-flags/:key/batch` cho một thay đổi logic, có `expectedVersion`, reason và audit before/after nguyên tử.
- Endpoint single-field PATCH vẫn được giữ cho backward compatibility và staged-rollout CLI.
- Manual rollback từ Feature Rollout UI dùng `POST /api/system-settings/feature-flags/:key/rollback` với audit reason.

## Question Presentation production baseline

- `question` tiếp tục là plain/semantic compatibility representation cho grading, search, AI, analytics và legacy paths.
- `question_rich_text` là versioned/allowlisted presentation data.
- Khi rich hợp lệ tồn tại, Worker derive plain prompt server-side trước math/scoring normalization.
- Historical result snapshot là presentation authority; snapshot cũ không có rich không được mượn rich hiện tại của quiz.
- Rich result snapshots chỉ được giữ khi final serialized `results.answers` candidate có rich không vượt 1.500.000 UTF-8 bytes; vượt budget thì degrade về historical plain mà không chặn submission.
- Teacher/student historical review dùng shared `QuestionRichTextRenderer` khi snapshot/current model thực sự có rich presentation.
- Quiz deletion được guard khi còn submissions, active live exam hoặc open assignment phụ thuộc.

## Cloudflare resources

- D1: `tohieuquiz-db`, APAC.
- R2 public assets: `tohieuquiz-og-images`.
- R2 private certificates: `tohieuquiz-certificates`; bucket phải tiếp tục private.
- Queue: `tohieuquiz-certificate-generation`.
- DLQ: `tohieuquiz-certificate-generation-dlq`.
- API domain: `api.thtohieu.com`.
- Public asset domain: `assets.thtohieu.com`.
- AI gateway route: `ai.thtohieu.com/v1`.
- Secret values không được đọc hoặc ghi vào tài liệu/repository.

## Frontend production

- Canonical domain: `https://www.thtohieu.com`.
- Apex domain: `https://thtohieu.com`.
- Parent domain: `https://phuhuynh.thtohieu.com`.
- Vercel Production đã deploy merge `ead9566` thành công qua Git integration, GitHub deployment ID `5852660659`.
- Production smoke tự động theo deployment status cho đúng merge SHA là run `31503033979`, conclusion `success`.

## Backup và rollback

- D1 Time Travel tiếp tục là recovery mechanism chính cho production operations.
- PR #106 không có migration, vì vậy rollback ứng dụng không cần rollback schema.
- Worker rollback hiện được ghi nhận cho release PR #106 là `96ee5fce-2187-482c-a1f8-eb66be403a49`.
- Feature Rollout có endpoint rollback audit theo từng key; ưu tiên rollback cấu hình khi lỗi nằm ở rollout config thay vì redeploy Worker không cần thiết.
- Không drop `question_rich_text` trong normal application rollback của các release rich-text trước đó.
- Production migration/data mutation/deploy luôn là gate riêng.

## Historical evidence

- Announcement Management & Feature Rollout release 11/08: `docs/operations/releases/2026-08-11-announcement-feature-rollout-production.md`.
- Modernization/Task 38 và production test-data cleanup: xem các hồ sơ release/runbook trong `docs/operations/`.
- Manual Rich Text release 08/08: `docs/operations/releases/2026-08-08-manual-quiz-rich-text-production.md`.
- Question Presentation Integrity release 09/08: `docs/operations/releases/2026-08-09-question-presentation-integrity-production.md`.

## Nguyên tắc tiếp tục

- Không đưa secret, password, token, full recovery bookmark hoặc dữ liệu người dùng vào Git/CI/chat.
- Không làm public bucket chứng nhận.
- Không xóa owner-created data ngoài phạm vi đã được phê duyệt.
- Sau mỗi production mutation phải chạy health/CORS/auth/role smoke và kiểm tra observability phù hợp.
- Rollout cấu hình phải giữ audit reason; không fallback UI batch edit thành nhiều mutation rời khi batch endpoint lỗi.
- Phase 2 rich-field expansion và full Question Contract v2 đều cần spec/plan + approval riêng.
