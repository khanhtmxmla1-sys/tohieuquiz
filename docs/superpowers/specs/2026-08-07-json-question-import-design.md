# JSON Question Import Design

**Ngày:** 2026-08-07

## Mục tiêu

Thêm khả năng dán JSON trực tiếp vào drawer nhập câu hỏi của khu vực tạo đề thủ công/kho câu hỏi, giúp giáo viên đưa dữ liệu sinh từ ChatGPT hoặc công cụ AI vào TôHiệuQuiz mà không cần tạo CSV/XLSX trung gian.

## Phạm vi

- Giữ nguyên luồng nhập CSV, XLSX và DOCX hiện tại.
- Đổi drawer từ một nguồn nhập thành hai tab: `Tải tệp` và `Dán JSON`.
- JSON được parse và chuẩn hóa ở frontend, sau đó đi qua cùng `QuestionImportResult` và `QuestionImportReview` như file import.
- Người dùng luôn xem trước, rà soát và chọn câu trước khi nhập vào draft quiz.
- Giữ chức năng hoàn tác transaction nhập hiện tại.
- Không thay đổi Worker/API, D1, migration, quyền truy cập hoặc schema database.

## UX

### Header

- Tiêu đề: `Nhập câu hỏi`.
- Mô tả: `Tải CSV/XLSX/DOCX hoặc dán JSON để xem trước trước khi nhập.`

### Tab Tải tệp

Giữ toàn bộ hành vi hiện tại:

- Chọn `.csv`, `.xlsx`, `.docx`.
- Phân tích file.
- Hiển thị lỗi nếu file không hỗ trợ.
- Hiển thị `QuestionImportReview` khi parse thành công.

### Tab Dán JSON

Bao gồm:

- Textarea có label `Dữ liệu JSON`.
- Nút `Xóa`.
- Nút `Sao chép JSON mẫu`.
- Nút chính `Kiểm tra JSON`.
- Sau khi parse thành công, hiển thị tóm tắt số câu `sẵn sàng / cần rà soát / không thể nhập` và dùng lại `QuestionImportReview`.
- JSON lỗi cú pháp hoặc sai top-level phải hiển thị `role="alert"` với thông báo tiếng Việt dễ hiểu.
- Chuyển tab không được tự nhập dữ liệu.

## JSON được hỗ trợ

Hỗ trợ cả hai top-level:

```json
[
  {
    "type": "multiple_choice",
    "question": "2 + 3 bằng bao nhiêu?",
    "options": ["4", "5", "6", "7"],
    "answer": "5"
  }
]
```

và:

```json
{
  "questions": [
    {
      "type": "short_answer",
      "question": "Thủ đô Việt Nam là gì?",
      "answer": "Hà Nội"
    }
  ]
}
```

### Type aliases tối thiểu

- `multiple_choice`, `mcq` -> `QuestionType.MCQ`
- `true_false`, `truefalse` -> `QuestionType.TRUE_FALSE`
- `short_answer`, `shortanswer` -> `QuestionType.SHORT_ANSWER`
- `matching`, `match` -> `QuestionType.MATCHING`
- `multiple_select`, `multiselect` -> `QuestionType.MULTIPLE_SELECT`
- Giá trị enum nội bộ như `MCQ`, `TRUE_FALSE`, `SHORT_ANSWER`, `MATCHING`, `MULTIPLE_SELECT` cũng hợp lệ.

### Alias trường

- Nội dung: `question`, `questionText`, `text`, `mainQuestion`.
- Đáp án: `answer`, `correctAnswer`, `correctAnswers` tùy loại.
- Phương án MCQ: `options` có thể là mảng string hoặc mảng object `{ "id": "A", "text": "..." }`.
- Matching: `pairs: [{ "left": "...", "right": "..." }]`.
- True/False: `items: [{ "statement": "...", "answer": true }]`; chấp nhận `isCorrect` thay cho `answer`.

## Chuẩn hóa đáp án MCQ

Nếu `answer` là `A`, `B`, `C`, `D`, giữ nguyên khi phương án tồn tại.

Nếu `answer` là chính nội dung của phương án, ví dụ `"5"`, parser tìm phương án trùng khớp và đổi thành ký hiệu tương ứng, ví dụ `B`.

Nếu không tìm thấy đáp án hợp lệ, câu được đưa vào `needsReview` thay vì nhập âm thầm.

## Validation

- Không có nội dung câu hỏi -> `rejected`.
- Không nhận diện được type -> suy đoán `MCQ` nếu có >= 2 options, ngược lại `SHORT_ANSWER`; đánh dấu `needsReview`.
- MCQ/MULTIPLE_SELECT có dưới 2 options -> `needsReview`.
- Thiếu đáp án -> `needsReview`.
- TRUE_FALSE không có item hợp lệ -> `needsReview`.
- MATCHING không có cặp hợp lệ -> `needsReview`.
- Mỗi candidate có `sourceLabel` dạng `Câu JSON 1`, `Câu JSON 2`, ... để lỗi có vị trí rõ ràng.

## An toàn dữ liệu

- Dữ liệu JSON chỉ được xử lý cục bộ trong frontend ở bước parse/preview.
- Không gọi AI, không gửi JSON sang dịch vụ ngoài.
- Không dùng `eval`, `Function` hoặc thực thi code từ JSON; chỉ dùng `JSON.parse`.
- Render preview thông qua React text nodes và component hiện có.
- Không thêm dependency mới.

## Accessibility

- Tab dùng `role="tablist"`, `role="tab"`, `aria-selected`.
- Textarea có label/aria-label rõ ràng.
- Lỗi dùng `role="alert"`.
- Trạng thái sao chép mẫu dùng vùng `aria-live="polite"`.
- Nút chính có chiều cao tối thiểu 44px như UI hiện tại.

## Acceptance criteria

1. CSV/XLSX/DOCX hiện tại vẫn hoạt động và test cũ không regression.
2. Người dùng có thể chuyển sang `Dán JSON`, dán array hoặc `{questions: [...]}`, bấm `Kiểm tra JSON` và thấy preview.
3. JSON mẫu với MCQ có `answer` bằng nội dung phương án được normalize về A/B/C/D.
4. Hỗ trợ tối thiểu MCQ, TRUE_FALSE, SHORT_ANSWER, MATCHING và MULTIPLE_SELECT.
5. JSON sai cú pháp hiển thị lỗi và không thay đổi quiz.
6. Người dùng chỉ nhập khi bấm nút trong `QuestionImportReview`.
7. Hoàn tác vẫn xóa đúng các câu vừa nhập.
8. Không có thay đổi backend/database/dependency.
9. Focused tests, typecheck, lint và build liên quan phải qua trước khi báo hoàn thành.
