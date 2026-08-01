# Audit và triển khai Trình soạn đề dùng chung

Ngày: 2026-08-01  
Nhánh: `feat/unified-exam-editor`  
Worktree: `C:\quizpro\.worktrees\unified-exam-editor`

## Mục tiêu

Mọi thao tác **Chỉnh sửa đề** phải mở cùng một Trình soạn đề, không phụ thuộc đề được tạo thủ công, bằng AI, nhập file, sao chép hay lấy từ ngân hàng câu hỏi.

## Hiện trạng trước thay đổi

- Hệ thống đã có `ManualQuizWorkspacePage`, đủ khả năng làm editor dùng chung.
- Nút sửa trong `ManageTab` chuyển đề sang `CreateTab`, là màn hình tạo/AI legacy.
- Route editor dùng tên `/teacher/quizzes/manual/...`.
- API cập nhật đề xóa toàn bộ câu hỏi và bản ghi đề rồi chèn lại.
- Không có khóa khi đề đã có bài nộp hoặc đang được dùng trong ca thi trực tiếp.
- Không có revision chống ghi đè và không có quan hệ phiên bản đề.
- Link tiếp tục bản nháp từ Action Center vẫn trỏ vào route legacy.

## Kiến trúc sau thay đổi

### Route chuẩn

- Tạo mới: `/teacher/quizzes/new`
- Chỉnh sửa: `/teacher/quizzes/:quizId/edit`
- Route `/teacher/quizzes/manual/...` chỉ còn redirect tương thích ngược, giữ nguyên query và navigation state.

### Editor dùng chung

`ManualQuizWorkspacePage` tiếp tục được tái sử dụng làm Trình soạn đề chung vì đã có:

- Danh sách và sắp xếp câu hỏi.
- Trình sửa câu hỏi.
- Xem trước học sinh.
- Validation trước xuất bản.
- Import câu hỏi và ngân hàng câu hỏi.
- Lưu nháp cục bộ/máy chủ và xử lý xung đột.

Nguồn tạo đề chỉ còn là metadata hiển thị, không quyết định editor.

### Contract editor

`GET /api/quizzes/:quizId/editor` trả về trong một response:

- Metadata đề.
- Toàn bộ câu hỏi.
- Quyền và trạng thái chỉnh sửa.
- Số bài nộp.
- Số ca thi trực tiếp đang hoạt động.
- Số lần giao bài đang mở.

Frontend dùng trực tiếp payload này nên link edit hoạt động ngay cả khi cache danh sách đề rỗng hoặc cũ.

### Quy tắc an toàn

- Chưa có bài nộp và không có ca thi trực tiếp: cho sửa cấu trúc.
- Đã giao nhưng chưa có bài nộp: cho sửa, yêu cầu xác nhận trước khi lưu.
- Có bài nộp: chỉ đọc, buộc tạo phiên bản mới.
- Có ca thi trực tiếp: chỉ đọc, buộc tạo phiên bản mới.
- Chế độ chỉ đọc không autosave, không nhận phím tắt chỉnh sửa và không khôi phục bản nháp cục bộ/remote cũ.
- Backend là lớp quyết định cuối cùng; frontend chỉ phản ánh trạng thái.

### Versioning

`POST /api/quizzes/:quizId/versions`:

- Sao chép metadata và câu hỏi.
- Không sao chép bài làm, kết quả hoặc lịch giao bài.
- Gắn `parent_quiz_id` vào đề gốc của chuỗi phiên bản.
- Tăng `version_number`.
- Đặt `revision = 1`.
- Tạo bản mới ở trạng thái chỉnh sửa độc lập.

### Optimistic locking

Mỗi đề có `revision`. Client gửi revision hiện tại khi lưu. Backend trả `409 QUIZ_REVISION_CONFLICT` nếu dữ liệu trên máy chủ đã mới hơn.

## Migration

Migration: `workers/migrations/0057_unified_quiz_editor_versioning.sql`

Các cột mới trên `quizzes`:

- `source_type`
- `parent_quiz_id`
- `version_number`
- `revision`
- `updated_at`

Rollback: `workers/migrations/rollback/0057_unified_quiz_editor_versioning.rollback.sql`

Không chạy migration production trước khi:

1. Sao lưu D1.
2. Chạy dry-run/safe migration.
3. Xác minh schema local hoặc staging.
4. Deploy Worker trước frontend hoặc trong cùng cửa sổ rollout có kiểm soát.

## Các commit triển khai

1. `37291e8 feat: route quiz edits to unified editor`
2. `1696e97 feat: protect quiz edits with versioning`
3. `a6d69d2 feat: enforce unified quiz editor access`

## Các luồng đã được hợp nhất

- Sửa đề từ danh sách Quản lý đề.
- Tạo đề thủ công mới.
- Tiếp tục bản nháp từ Action Center.
- Đề có metadata nguồn AI/import/sao chép/ngân hàng câu hỏi khi mở lại để sửa.
- Bookmark route legacy.

Các màn hình tạo bằng AI hoặc nhập dữ liệu vẫn có thể giữ trải nghiệm tạo riêng. Sau khi đề đã được lưu, mọi lần chỉnh sửa tiếp theo đều đi vào Trình soạn đề chung.

## Test bắt buộc đã bổ sung

- Điều hướng mọi thao tác sửa sang route chuẩn.
- Redirect legacy giữ `draftId`.
- API editor trả metadata và trạng thái chỉnh sửa.
- Khóa đề có bài nộp.
- Khóa đề có ca thi trực tiếp.
- Chống ghi đè revision cũ.
- Tạo phiên bản mới không sao chép kết quả/lịch giao.
- UI chỉ đọc vô hiệu hóa chỉnh sửa.
- UI bỏ qua bản nháp cục bộ khi đề đã khóa.
- Tạo phiên bản vẫn điều hướng thành công nếu refresh catalog thất bại.
- Nhãn nguồn AI và số phiên bản.

## Rollout đề xuất

1. Áp dụng migration ở môi trường staging/local.
2. Deploy Worker có contract mới.
3. Deploy frontend bật editor chung.
4. Smoke test các trạng thái: đề mới, đề đã giao, đề có bài nộp, ca thi trực tiếp.
5. Theo dõi lỗi `409`, lỗi editor payload và thời gian tải endpoint.
6. Giữ redirect legacy trong ít nhất một chu kỳ phát hành.
7. Chỉ xóa state/component edit legacy sau khi telemetry không còn lưu lượng route cũ.

## Kết quả xác minh

- Toàn bộ 4/4 Vitest shard đã qua.
- Nhóm test chuyên biệt cho route, editor, draft recovery, access lock, versioning và Action Center đã qua.
- `npm run lint` đã qua với `--max-warnings=0`.
- `npm run typecheck` đã qua.
- `npm run typecheck:strict` đã qua.
- `npm run typecheck:workers` đã qua.
- `npm run build` đã tạo production bundle thành công.
- Migration `0057` đã được áp dụng thành công trên một bản D1 local cô lập dựng từ schema trước thay đổi.
- Bản ghi cũ được backfill đúng: `source_type = manual`, `version_number = 1`, `revision = 1`, `updated_at = created_at`.
- Heuristic diff review không phát hiện lỗi mức P1, P2 hoặc P3.

## Phạm vi chưa triển khai trong đợt này

- So sánh trực quan hai phiên bản đề.
- Khôi phục một revision lịch sử.
- Chỉnh sửa cộng tác thời gian thực.
- Audit log chi tiết đến từng trường/câu hỏi.
- Xóa hoàn toàn các prop/state edit legacy trong `CreateTab`; hiện chúng được giữ để giảm rủi ro tương thích, nhưng không còn được nút sửa đề sử dụng.
