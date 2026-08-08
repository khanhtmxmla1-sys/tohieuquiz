# Current Plan — Manual Quiz Rich Text Editor

**Source spec:** `docs/design/manual-quiz-rich-text-editor-spec.md`
**Detailed implementation plan:** `docs/superpowers/plans/2026-08-08-manual-quiz-rich-text-editor.md`
**Status:** IMPLEMENTED + VERIFIED. Production migration/deploy remains separately gated.
**Main integration:** Protected `main` requires CODEOWNERS approval and required CI; direct pushes are not used.

## Goal

1. Thu gọn `Ảnh đính kèm (tùy chọn)` để mặc định chỉ còn một hàng và chỉ mở upload UI khi giáo viên cần.
2. Mở rộng không gian `Nội dung câu hỏi`.
3. Thay prompt textarea bằng focused rich-text editor hỗ trợ Enter/Shift+Enter, formatting, alignment, lists, colors/highlight, undo/redo và Math Composer hiện có.
4. Lưu rich formatting bằng structured JSON version 1 trong `question_rich_text`, đồng thời giữ plain `question` để tương thích grading/search/AI/legacy.
5. Render cùng dữ liệu ở teacher preview + student player, fallback an toàn cho câu hỏi cũ.

## Execution order

### Slice A — UI compact attachment
- Task 1: Test collapsed/expanded behavior.
- Task 2: Implement `CompactMediaAttachment` only for optional attachment.
- Task 3: Reclaim editor space + responsive browser check.

### Slice B — Rich text
- Task 4: Shared rich-text contract + converters.
- Task 5: Tiptap foundation.
- Task 6: Toolbar + paste constraints.
- Task 7: Math Composer adapter.
- Task 8: Frontend draft mapping.
- Task 9: D1 migration 0064 + schema/registry.
- Task 10: Worker persistence/validation.
- Task 11: Wire rich editor to SharedHeader.
- Task 12: Safe teacher/student rich renderer.
- Task 13: Practice/live-exam read paths.

### Slice C — Verification
- Task 14: Manual workspace Cypress coverage.
- Task 15: lint/typecheck/tests/build/perf/security/browser/GitNexus/review/full verify.

## Approval boundaries

Plan approval authorizes implementation and only the Tiptap packages listed in the detailed plan. It does **not** authorize production D1 migration or production deploy; those require a separate explicit approval after verification.
