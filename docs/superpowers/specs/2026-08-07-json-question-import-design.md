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

## Mở rộng contract: 13 dạng canonical cho Gem

Quy ước mới là **additive** và giữ tương thích ngược. Mỗi câu được parse độc lập; một đề có thể chứa bất kỳ tập con nào trong 13 dạng, không bắt buộc phải có đủ 13 dạng.

### Ưu tiên trường loại

- Canonical mới: `question_type` theo System Prompt của Gem.
- Legacy: `type` vẫn được hỗ trợ như hiện tại.
- Nếu có cả hai và cùng nghĩa: nhập bình thường.
- Nếu có cả hai nhưng mâu thuẫn: ưu tiên `question_type` và đưa câu vào `needsReview` với cảnh báo xung đột.
- Giữ nguyên nghĩa legacy `type: "multiple_choice"` -> `MCQ`; riêng canonical `question_type: "MULTIPLE_CHOICE"` -> `MULTIPLE_SELECT`.

### Ánh xạ 13 dạng canonical -> domain nội bộ

| Canonical `question_type` | `QuestionType` nội bộ |
| --- | --- |
| `SINGLE_CHOICE` | `MCQ` |
| `TRUE_FALSE` | `TRUE_FALSE` |
| `SHORT_ANSWER` | `SHORT_ANSWER` |
| `MATCHING` | `MATCHING` |
| `MULTIPLE_CHOICE` | `MULTIPLE_SELECT` |
| `DRAG_DROP_FILL` | `DRAG_DROP` |
| `ORDERING` | `ORDERING` |
| `IMAGE_QUESTION` | `IMAGE_QUESTION` |
| `DROPDOWN` | `DROPDOWN` |
| `UNDERLINE` | `UNDERLINE` |
| `CATEGORIZATION` | `CATEGORIZATION` |
| `WORD_ASSEMBLY` | `WORD_SCRAMBLE` khi ghép chữ thành từ; `ORDERING` khi ghép từ thành câu |
| `RIDDLE` | `RIDDLE` |

`WORD_ASSEMBLY` được adapter theo nội dung: nếu mọi `parts` là một ký tự thì dùng `WORD_SCRAMBLE`; nếu `parts` là các từ/cụm từ và `correct_order` hợp lệ thì dùng `ORDERING` để giữ đúng hành vi ghép thành câu.

### Alias field canonical

- Common: `question_type`, `difficulty`, `points`, `explanation`.
- Difficulty: `NHAN_BIET` -> 1, `THONG_HIEU` -> 2, `VAN_DUNG` -> 3; numeric 1/2/3 vẫn hợp lệ.
- SINGLE_CHOICE / IMAGE_QUESTION: `correct_answer`.
- MULTIPLE_CHOICE: `correct_answers`.
- SHORT_ANSWER / RIDDLE: `accepted_answers`; nhiều đáp án được bảo toàn bằng chuỗi phân cách `|` để scoring hiện tại đọc đủ biến thể.
- TRUE_FALSE: item `correct_answer` -> `isCorrect`.
- MATCHING: `left_items` + `right_items` + `matches` được materialize thành `pairs`.
- DRAG_DROP_FILL: `content`, `drag_items`, `answers`; `{{blankN}}` được đổi sang placeholder nội bộ `[blankN]`.
- ORDERING: object `items` + ID trong `correct_order` được đổi sang `items: string[]` + `correctOrder: number[]`.
- DROPDOWN: `content`, `dropdowns`; `{{selectN}}` được đổi sang `[selectN]`.
- UNDERLINE: `content`, `selectable_parts`, `correct_answers` được đổi sang `sentence`, `words`, `correctWordIndexes`.
- CATEGORIZATION: `groups`, `items`, `answers` được đổi sang `categories` và item `categoryId`.
- WORD_ASSEMBLY: `parts`, `correct_order`, `correct_text` được đổi sang `letters`, `correctWord` khi mọi part là một ký tự; nếu là các từ/cụm từ thì đổi sang `items` + `correctOrder` của ORDERING.
- RIDDLE: `riddle`, `accepted_answers`, `hint` được đổi sang domain RIDDLE hợp lệ.

### Hình ảnh

`IMAGE_QUESTION` chỉ được `accepted` khi có media thật qua `image`, `image_url` hoặc `imageUrl`. Nếu chỉ có `image_description`, parser giữ mô tả làm `imageAlt` nhưng đánh dấu `needsReview` vì editor yêu cầu ảnh thật trước khi xuất bản. Importer không tự fetch URL và không tạo URL giả.

### An toàn và validation

- Chỉ dùng `JSON.parse`; không `eval`, không thực thi nội dung JSON.
- Không gọi mạng hoặc AI trong parser.
- Câu hợp lệ theo contract canonical không được rơi vào suy đoán type.
- Câu thiếu trường bắt buộc hoặc tham chiếu ID sai phải `needsReview`/`rejected` với lý do cụ thể, không tự bịa đáp án.
- Tất cả JSON legacy đang được hỗ trợ phải tiếp tục hoạt động.

## Acceptance criteria

1. CSV/XLSX/DOCX hiện tại vẫn hoạt động và test cũ không regression.
2. Người dùng có thể chuyển sang `Dán JSON`, dán array hoặc `{questions: [...]}`, bấm `Kiểm tra JSON` và thấy preview.
3. JSON mẫu với MCQ có `answer` bằng nội dung phương án được normalize về A/B/C/D.
4. Hỗ trợ đủ 13 `question_type` canonical của Gem theo bảng ánh xạ ở trên; một đề chỉ dùng 5/8/10 dạng vẫn nhập bình thường.
5. JSON sai cú pháp hiển thị lỗi và không thay đổi quiz.
6. Người dùng chỉ nhập khi bấm nút trong `QuestionImportReview`.
7. Hoàn tác vẫn xóa đúng các câu vừa nhập.
8. Không có thay đổi backend/database/dependency.
9. Focused tests, typecheck, lint và build liên quan phải qua trước khi báo hoàn thành.
10. JSON legacy dùng `type`, camelCase answer fields và schema 5 dạng cũ không regression.
11. JSON canonical dùng `question_type` và snake_case field hợp lệ phải hiện đáp án trong preview, không bị `needsReview` chỉ vì khác naming convention.
12. `WORD_ASSEMBLY` phải hỗ trợ cả ghép chữ thành từ và ghép từ thành câu bằng adapter nội bộ phù hợp; `IMAGE_QUESTION` thiếu media thật phải được cảnh báo rõ thay vì nhập sai âm thầm.
