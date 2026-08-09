# ADR-001: Giữ dual representation cho Question Presentation v1

## Status
Accepted — implemented by PR #92 and released to production on 2026-08-09

## Date
2026-08-08

## Implementation evidence

- PR #92 merged as `406973f6794d1111d6cd84360b3d9e3c5c21c730` on 2026-08-09.
- Worker version `0b91dd72-ff0e-40c1-8a1f-57f138bc5eca` was promoted through staged rollout to 100% traffic.
- Production smoke run `31295886040` completed successfully.
- No new D1 migration was added by PR #92; the release uses the existing `0064_add_question_rich_text.sql` column.
- Remote D1 migration audit on 2026-08-09 reported no pending migrations.

## Context

TôHiệuQuiz đã phát hành Rich Text Editor cho prompt chính của câu hỏi thủ công. Production hiện có hai biểu diễn song song:

- `question`: plain text + TeX delimiters, tiếp tục phục vụ grading, search, AI, analytics và các luồng legacy.
- `question_rich_text`: JSON versioned/allowlisted phục vụ authoring và presentation.

Migration production `0064_add_question_rich_text.sql` đã được áp dụng; frontend/Worker của merge `d519fb7` đã được phát hành và production smoke đã hoàn tất theo release evidence do chủ dự án cung cấp.

Một design trước đó đề xuất chuyển sớm sang `question_schema_version + content_json + answer_key_json + explanation_json` cùng Question Contract v2 toàn diện. Sau khi có implementation thực tế, cách chuyển đổi lớn này không còn là bước kế tiếp cần thiết.

## Decision

1. **Question Presentation v1 là production baseline chính thức.**
2. `question` tiếp tục là semantic/plain compatibility representation trong giai đoạn hiện tại.
3. `question_rich_text` là presentation overlay có version và allowlist; Tiptap chỉ là editor adapter, không phải domain contract.
4. Khi có `questionRichText` hợp lệ, Worker phải validate rich riêng, derive plain `question`, loại `questionRichText`/`question_rich_text` khỏi semantic clone, rồi mới chạy recursive math/scoring normalization. Client plain chỉ là compatibility echo, không phải nguồn truth thứ hai.
5. Drift telemetry phải so sánh các plain projection sau **math normalization hiện hành** để không báo sai khác giả do canonicalization TeX/newline.
6. TeX tiếp tục nằm trong text node ở Presentation v1 và được render qua `MathSpan`; chưa tạo math node riêng. Shared rich renderer phải segment math trên toàn inline stream của paragraph/list paragraph để delimiter không bị phá khi Tiptap marks chia công thức thành nhiều text node.
7. Không đổi scoring engine hoặc Answer Schema chỉ vì thay đổi presentation.
8. Không bulk-backfill toàn bộ câu hỏi cũ. Câu không có rich JSON tiếp tục fallback về `question`.
9. Result `questionSnapshot` là dữ liệu lịch sử authoritative. Snapshot có rich thì dùng rich của snapshot; snapshot cũ không có rich thì fallback plain snapshot và không được mượn `questionRichText` hiện tại của quiz.
10. D1 có trần 2.000.000 bytes cho string/BLOB/table row. Rich result snapshots chỉ được giữ khi final serialized authoritative `results.answers` candidate có rich không vượt `1_500_000` UTF-8 bytes. Vượt ngưỡng phải degrade toàn bộ snapshot presentation của result đó về plain lịch sử; Phase 1 không áp hard cap mới lên legacy/plain-only answers và submission không được thất bại chỉ vì phần rich bổ sung quá lớn.
11. Renderer được hợp nhất dần theo surface; không viết một renderer formatting/math độc lập mới cho review/result.
12. Question Contract v2 đầy đủ, answer-key split và persistence mới chỉ được xem xét sau khi renderer/presentation v1 đã phủ đủ surface và có nhu cầu thực tế.

## Why

### Giảm blast radius

`question` hiện được dùng rộng trong grading, AI, search, analytics, practice, live exam và các luồng cũ. Giữ plain representation giúp tránh một migration xuyên toàn hệ thống chỉ để giải quyết presentation.

### Rollback thực tế

Nếu rich authoring gặp lỗi, hệ thống có thể tắt editor/write path trong khi vẫn giữ khả năng đọc `question_rich_text` đã lưu. Legacy `question` vẫn còn cho degraded fallback và scoring.

### Không khóa domain vào Tiptap

`QuestionRichTextEnvelopeV1` được validate trong shared contract; persisted data không được hiểu là raw Tiptap document tùy ý. Editor framework có thể thay đổi sau này nếu adapter giữ contract.

### Tránh overengineering

Hiện tại math trong text node + `MathSpan` đã giải quyết use case production. Math node riêng, `content_json`, `answer_key_json` và Question Contract v2 chỉ nên được thêm khi có requirement không thể giải quyết an toàn bằng Presentation v1.

## Consequences

### Positive

- Không cần migration D1 mới cho giai đoạn hardening/renderer consolidation.
- Legacy data tiếp tục hoạt động.
- Có thể mở rộng rich presentation theo từng vertical slice.
- Scoring không bị trộn với presentation refactor.
- Rollback và staged rollout đơn giản hơn.

### Cost

- Có hai representation nên phải chống drift.
- Result snapshot tạo trước khi rich presentation được lưu server-side sẽ không thể tự phục hồi formatting lịch sử; chúng phải fallback plain.
- Một số field type-specific vẫn là string cho tới khi được nâng cấp riêng.
- System Prompt vẫn cần compatibility với JSON hiện tại trong thời gian chuyển tiếp.

## Implementation status and future follow-up

Completed in PR #92 / production release 2026-08-09:

1. Type `questionRichText` như presentation metadata chính thức trên `Question`/`QuestionSnapshot`.
2. Server-owned dual-representation consistency guard + math-normalized comparison trên semantic clone không chứa presentation JSON.
3. Harden `QuestionRichTextRenderer` để delimited math không vỡ khi formatting marks chia nội dung thành nhiều rich text node.
4. Thêm `question_rich_text` vào authoritative grading SELECT để snapshot kết quả mới giữ presentation an toàn, với final answers-with-rich budget 1.500.000 bytes và plain fallback khi vượt ngưỡng.
5. Khóa historical snapshot precedence trong teacher/student review model.
6. Renderer consolidation cho teacher review và student result review.
7. Giữ các destructive-edit/delete dependency guards cho quiz đã có result hoặc dependency hoạt động.

Deferred and requires a new explicit plan/approval:

8. Mở rộng rich content sang explanation/options/type-specific content.
9. Question Contract v2 đầy đủ phải có ADR/spec riêng nếu được kích hoạt.

## Alternatives considered

### Thay `question` bằng JSON ngay
Rejected: blast radius quá lớn và không cần thiết cho requirement hiện tại.

### Thêm ngay `content_json + answer_key_json + explanation_json`
Deferred: có giá trị dài hạn nhưng chưa đủ benefit để trả chi phí migration/API/scoring boundary lúc này.

### Tiếp tục chỉ dùng plain string
Rejected: không giữ được rich formatting đã phát hành.
