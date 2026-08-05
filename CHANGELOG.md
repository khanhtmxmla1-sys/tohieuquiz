# Changelog — TôHiệuQuiz

Tất cả thay đổi đáng chú ý của sản phẩm được ghi lại tại đây.

## [Unreleased]

### Changed

- Đồng bộ logo chính thức của Trường Tiểu học Tô Hiệu trên trang đăng nhập, dashboard giáo viên và học sinh, các trang công khai, footer và Cổng phụ huynh; favicon sản phẩm vẫn được giữ làm ảnh dự phòng.

## [1.0.0] — 2026-07-30

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
- Test fixtures production `test.gv1`, `test.hs1`, `test.hs2`, `Lớp Test 1` và linked artifacts đã được xóa bằng transactional `D1.batch()` sau bookmark, dry-run, review và smoke 15/15.

### Security

- Session D1, revoke/logout-all, security events retention, WebAuthn challenge single-use và role/ownership abuse coverage.
- Production auth compatibility removal được phát hành với owner risk override được ghi rõ; không tuyên bố sai rằng các cửa sổ quan sát rút ngắn đã đủ thời lượng.
