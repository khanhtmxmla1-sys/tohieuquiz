# TôHiệuQuiz — Trạng thái triển khai hiện tại

**Cập nhật:** 09/08/2026
**Nguồn hiện hành:** `docs/operations/releases/2026-08-08-manual-quiz-rich-text-production.md`, `docs/operations/releases/2026-08-09-question-presentation-integrity-production.md` và hồ sơ trong `docs/operations/releases/`.

## Tóm tắt

- Modernization release `v1.0.0` và Tasks 1–38 là baseline lịch sử đã hoàn tất.
- Manual Quiz Rich Text Editor + Compact Attachment đã phát hành ngày 08/08/2026 từ merge `d519fb70c09a4927a8e09cf18244f5cb82e4a374`.
- Question Presentation Integrity & Historical Review Rendering đã merge qua PR #92 tại `406973f6794d1111d6cd84360b3d9e3c5c21c730` và Worker production được rollout 0% → 10% → 50% → 100% ngày 09/08/2026.
- Repository `origin/main` tại audit cleanup là `f17cf402f236ac14f8bb0dd4cfa568c8af8504d0`, đã tiến thêm sau PR #92. Đây là **repository source hiện tại**, không đồng nghĩa Worker đang chạy source đó.
- Worker production hiện nhận 100% traffic ở version `0b91dd72-ff0e-40c1-8a1f-57f138bc5eca`, deployment `79cbc693-b59c-48b1-b444-5438ddce58fc`, với deployment annotation xác nhận release basis `main 406973f`.
- D1 migration `0064_add_question_rich_text.sql` đã áp dụng; audit remote ngày 09/08/2026 trả `No migrations to apply!`.
- Production smoke GitHub run `31295886040` cho rollout PR #92 hoàn tất với conclusion `success`.

## Source và deployment baseline

- Repository `origin/main` tại audit: `f17cf402f236ac14f8bb0dd4cfa568c8af8504d0`.
- Question Presentation PR #92 merge: `406973f6794d1111d6cd84360b3d9e3c5c21c730`.
- API Worker: `tohieuquiz-api`.
- Worker deployment hiện tại: `79cbc693-b59c-48b1-b444-5438ddce58fc`.
- Worker version hiện nhận 100% traffic: `0b91dd72-ff0e-40c1-8a1f-57f138bc5eca`.
- Worker source/release basis theo deployment annotation: `406973f`.
- Worker rollback version được giữ: `5d137d5f-9e60-4b98-a003-7bbbd1057d17`.
- Frontend deployment ID/source hiện tại không được tái-audit trong cleanup này; không suy luận trạng thái Vercel chỉ từ Git history.
- Latest applied source migration: `0064_add_question_rich_text.sql`; remote registry audit ngày 09/08/2026 không có migration pending.
- Branch protection `main`: PR bắt buộc và required checks; repository hygiene không bypass protection.

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
- Git integration/custom-domain deployment đã hoạt động theo release evidence trước đó.
- Cleanup 09/08 không thực hiện Vercel mutation và không tuyên bố latest `origin/main` đã được deploy frontend nếu không có deployment audit riêng.

## Backup và rollback

- D1 Time Travel tiếp tục là recovery mechanism chính cho production operations.
- Không drop `question_rich_text` trong normal application rollback.
- Worker rollback cho release PR #92 giữ version reviewed `5d137d5f-9e60-4b98-a003-7bbbd1057d17`.
- Production migration/data mutation/deploy luôn là gate riêng; repository cleanup không thực hiện các thao tác này.

## Historical evidence

- Modernization/Task 38 và production test-data cleanup: xem các hồ sơ release/runbook trong `docs/operations/`.
- Manual Rich Text release 08/08: `docs/operations/releases/2026-08-08-manual-quiz-rich-text-production.md`.
- Question Presentation Integrity release 09/08: `docs/operations/releases/2026-08-09-question-presentation-integrity-production.md`.

## Nguyên tắc tiếp tục

- Không đưa secret, password, token, full recovery bookmark hoặc dữ liệu người dùng vào Git/CI/chat.
- Không làm public bucket chứng nhận.
- Không xóa owner-created data ngoài phạm vi đã được phê duyệt.
- Sau mỗi production mutation phải chạy health/CORS/auth/role smoke và kiểm tra observability phù hợp.
- Phase 2 rich-field expansion và full Question Contract v2 đều cần spec/plan + approval riêng.
