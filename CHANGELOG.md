# Changelog — TôHiệuQuiz

Tất cả thay đổi đáng chú ý của sản phẩm được ghi lại tại đây.

## [Unreleased]

### Operations

- Chuẩn bị Task 38 với cleanup script production mặc định dry-run, xác nhận kép, transaction D1, hậu kiểm và dọn R2 idempotent.
- Thêm lịch bảo trì tuần/tháng/quý và hồ sơ xác minh release `v1.0.0`.
- Việc xóa production, smoke hậu cleanup và tag release chỉ được ghi hoàn tất sau khi có bằng chứng thực tế.

## [1.0.0] — Pending verification

### Added

- Ma trận dữ liệu nhạy cảm, chính sách browser storage và authorization registry fail-closed.
- AI Tutor contract/ownership/quota, AI question quality gate và private service binding.
- Design system, accessible primitives/dialogs, request-ID error UX và offline/reduced-bandwidth states.
- URL-first navigation, Teacher Action Center, Live Exam reconnect/autosave/control audit và Results Intervention Center.
- Parent Portal recovery/preferences/digest, Gift Shop governance và notification dedupe/quiet hours.
- Pagination/virtualization/indexes, Web Vitals/API telemetry, Operations Center, Security Center, staff passkeys và runtime feature rollout control plane.
- D1 encrypted tablewise backup, Time Travel/restore rehearsal, branch protection, release-readiness gate và production-smoke automation.

### Changed

- Browser authentication chuyển hoàn toàn sang HttpOnly cookie; Bearer/legacy JWT compatibility path đã bị loại bỏ.
- D1 migrations, rollback contracts, dependency audits, secret-history scan, CSP/CORS and performance budgets chạy fail-closed trong CI.
- Các thư viện DOCX/PDF/worksheet/chart được lazy-load theo hành động hoặc route.
- Production Worker, Vercel và smoke workflow sử dụng commit đã review cùng điểm rollback rõ ràng.

### Removed

- Student profile/session persistence khỏi `localStorage` và cache bền vững cho dữ liệu cá nhân.
- Duplicate teacher auth store, readable auth token trong response, legacy JWT claims và browser Bearer extraction.
- Test fixtures production được Task 38 phê duyệt sau khi backup, dry-run, review và smoke hoàn tất.

### Security

- Session D1, revoke/logout-all, security events retention, WebAuthn challenge single-use và role/ownership abuse coverage.
- Production auth compatibility removal được phát hành với owner risk override được ghi rõ; không tuyên bố sai rằng các cửa sổ quan sát rút ngắn đã đủ thời lượng.
