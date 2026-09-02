# Checkpoint — Competition Public Portal staging

**Ngày:** 31/08/2026
**Branch:** `feat/competition-v1`
**Candidate SHA:** `b81263219a7a45db5505cfa7b328ce4814703a7c` (`feat: complete competition portal staging support`)
**Trạng thái:** `STAGING BASELINE PASS → PR CONFLICT RESOLUTION → CHỜ DELTA STAGING VERIFICATION`

## Đã hoàn thành

- Staging Worker/D1/R2/Queue cô lập, không dùng production resource.
- Candidate staging ban đầu đã xác nhận tới `0079_competition_public_portal.sql`.
- Fixture disposable có 6 vòng, public page/article, Student đủ điều kiện, ordinary preflight READY và School Exam preflight READY.
- Smoke read-only: open `7/7 PASS`; finalized `7/7 PASS`.
- Golden Board correction/republish: publication/ranking `1/1 → 2/2`.
- Ordinary attempt vẫn `0`; không gọi `/api/live-exam/join`.
- Cả 5 staging portal gates đã được rollback về `disabled`.
- Temporary staging config, fixture scripts và profile đã được xóa.

## Verification

- Focused release/content/staging tests: `43/43`.
- Competition/School Exam regression: `90/90`.
- Lint, typecheck, strict typecheck, Worker typecheck, build và `security:check`: pass.
- Evidence chi tiết: `docs/operations/releases/2026-08-31-competition-public-portal-staging.md`.

## Chưa thực hiện

- Chưa push, mở PR, merge hoặc deploy production.
- Full repository Vitest còn 5 lỗi nền ngoài diff candidate; không được xem là globally green.
- Vercel Preview legacy UI chưa test trực tiếp vì rewrite `/api/**` hiện trỏ production.
- Candidate tích hợp đổi Portal sang `0080_competition_public_portal.sql` để nhường `0079` cho runtime rollout từ `main`; phải kiểm tra lại isolated staging migration/health/smoke trước merge.

## Điểm tiếp tục

1. Hoàn tất verification cho conflict-resolution candidate, sau đó commit/push cập nhật PR #139 khi được duyệt.
2. Chạy delta staging verification qua `0080_competition_public_portal.sql`, giữ toàn bộ rollout gates disabled.
3. Dừng ở merge + production migration/deploy approval gate.
