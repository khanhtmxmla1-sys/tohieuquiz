# TôHiệuQuiz — Manual Quiz Rich Text Editor & Compact Attachment Spec

**Status:** Proposed — awaiting implementation approval  
**Date:** 2026-08-08  
**Primary surface:** `/teacher/quizzes/new` — Soạn đề thủ công  
**Target user:** Giáo viên

## 1. Problem statement

Phần soạn đề thủ công hiện ưu tiên một `textarea` có hỗ trợ công thức toán, trong khi giáo viên còn thiếu các thao tác trình bày cơ bản như in đậm, in nghiêng, gạch chân, căn lề, danh sách và tô nhấn. Đồng thời, khối **“Ảnh đính kèm (tùy chọn)”** đang chiếm quá nhiều chiều cao dù ảnh chỉ là nội dung phụ ở phần lớn câu hỏi, làm khu vực nhập câu hỏi bị nhỏ và buộc giáo viên cuộn nhiều hơn.

Mục tiêu là biến vùng **Nội dung câu hỏi** thành một trình soạn thảo giàu định dạng nhưng nhẹ, phù hợp giáo viên, đồng thời thu gọn ảnh đính kèm để ưu tiên không gian cho nội dung câu hỏi.

## 2. Product principle

> Giáo viên chỉ cần tập trung vào nội dung; TôHiệuQuiz chịu trách nhiệm giữ trình bày rõ, nhất quán và responsive.

Không xây dựng một bản sao Microsoft Word. Không cho phép định dạng tự do theo pixel. Không lưu HTML tùy ý.

## 3. Current repository evidence

### Current question editor

`src/features/quiz-editor/components/QuestionEditorModal/QuestionEditorForm.tsx`

- `SharedHeaderEditor` dùng `MathTextarea` cho `Nội dung câu hỏi`.
- Nội dung hiện có `rows={4}` và `resize-y`.
- `Độ khó` và `Ảnh đính kèm` nằm cùng một flex row.

### Current attachment

`src/features/manual-quiz-workspace/components/MediaDropzone.tsx`

- Empty dropzone có `min-h-32`.
- URL action hiển thị khi chưa có ảnh.
- `Mô tả ảnh` hiện xuất hiện cả khi chưa có ảnh vì caller truyền `onAltTextChange`.
- Preview ảnh dùng `w-full max-h-56`.
- Component cũng được dùng bởi `ImageQuestionEditor`, nơi ảnh là nội dung chính, nên không được thu nhỏ toàn cục.

### Current math integration

`src/features/quiz-editor/components/QuestionEditorModal/editors/shared.tsx` và `src/features/manual-quiz-workspace/math-composer/useMathComposer.tsx`

- `MathTextarea` đăng ký một `HTMLInputElement | HTMLTextAreaElement` với Math Composer.
- Công thức được chèn theo native selection offsets.
- Rich editor mới phải có adapter riêng nhưng vẫn giữ tương thích các input/textarea còn lại.

### Current rendering

`src/components/common/MathSpan.tsx`

- Đã dùng `whiteSpace: pre-line`, vì vậy newline trong plain-text hiện được render.
- `SafeFormattedText` có allowlist nhỏ (`u`, `b`, `i`, `em`, `strong`) và không dùng raw HTML.

`src/features/quiz-player/components/QuestionRenderer/index.tsx`

- Prompt học sinh hiện dùng `SmartText` từ plain string.
- Ảnh đính kèm hiện là media tách rời dưới prompt.

### Current persistence

- `questions.question` trong D1 là `TEXT` và được dùng rộng bởi quiz API, grading, analytics, AI context, live exam, practice và search.
- Vì vậy **không thay `question` thành JSON**.

## 4. Recommended architecture

### 4.1 Dual representation

Giữ hai biểu diễn song song:

1. `question`: plain-text canonical fallback.
   - Giữ TeX delimiters hiện có.
   - Dùng cho search, grading, AI, analytics và mọi surface legacy.
2. `questionRichText` / D1 `question_rich_text`: structured JSON cho presentation.
   - Chỉ dùng khi có định dạng giàu.
   - Versioned + validated + allowlisted.

Rich editor luôn sinh lại `question` từ structured document khi người dùng chỉnh sửa, để không có drift giữa hai biểu diễn.

### 4.2 Rich document v1

Envelope đề xuất:

```ts
interface QuestionRichTextEnvelopeV1 {
  schemaVersion: 1;
  doc: RichTextDocNode;
}
```

MVP allowlist:

**Nodes**
- `doc`
- `paragraph`
- `text`
- `hardBreak`
- `bulletList`
- `orderedList`
- `listItem`

**Paragraph attributes**
- `textAlign`: `left | center | right`

**Marks**
- `bold`
- `italic`
- `underline`
- `strike`
- `textStyle` với `color` chỉ trong palette hệ thống
- `highlight` chỉ trong palette hệ thống

**Không cho phép trong v1**
- arbitrary HTML
- `style` tùy ý
- font family
- font size tự do
- link
- table
- justify
- inline image node
- iframe/embed
- code block
- custom CSS

Giới hạn đề xuất: tối đa **64 KiB JSON UTF-8/câu hỏi**.

## 5. Rich editor UX

### 5.1 Toolbar

Toolbar tập trung, không Word-like:

`Undo | Redo | B | I | U | S | Màu chữ | Tô nền | Trái | Giữa | Phải | Bullet | Numbered | Công thức | Xóa định dạng`

Ảnh ở MVP vẫn là attachment riêng, không nhúng inline vào rich-text document.

### 5.2 Keyboard behavior

- `Enter` → paragraph mới.
- `Shift + Enter` → hard line break trong paragraph hiện tại.
- `Ctrl/Cmd + B` → bold.
- `Ctrl/Cmd + I` → italic.
- `Ctrl/Cmd + U` → underline.
- `Ctrl/Cmd + Z` → undo.
- `Ctrl/Cmd + Shift + Z` hoặc `Ctrl/Cmd + Y` → redo theo platform/library.
- `Ctrl + Enter` **không dùng trong MVP** để tránh xung đột shortcut hiện có.

### 5.3 Lists

- Enter ở list item → tạo item tiếp theo.
- Enter ở item trống → thoát list.
- Plain fallback phải giữ nội dung từng item theo dòng, không làm mất chữ.

### 5.4 Math

- Math tiếp tục là TeX text bên trong text nodes, ví dụ `$x^2$`, `$$...$$`, `\(...\)`, `\[...\]`.
- Không tạo custom math node trong MVP.
- Math Composer hiện tại phải chèn template vào selection của rich editor.
- Sau khi chèn công thức, focus quay lại editor.
- Enter sau công thức block/text phải tạo paragraph mới bình thường.
- Math validation hiện có vẫn chạy trên plain fallback.

### 5.5 Paste

Khi paste từ Word, Google Docs, ChatGPT hoặc web:

- Giữ text, paragraph, hard-break, bold/italic/underline/strike, supported list nếu có thể.
- Loại bỏ font family, arbitrary sizes, margin/padding, unknown nodes, script/event handlers, iframe và unsupported styles.
- Màu ngoài palette được reset về mặc định thay vì lưu raw CSS.
- Không dùng `dangerouslySetInnerHTML` để render persisted rich content.

## 6. Compact attachment UX

### 6.1 Default state — collapsed

Khi chưa có ảnh, chỉ hiển thị một hàng khoảng 44–52px:

```text
Ảnh đính kèm (tùy chọn)                         [+ Thêm ảnh]
```

Không render dropzone lớn, URL field, mô tả ảnh hoặc helper text thường trực.

### 6.2 Expanded upload state

Khi bấm `+ Thêm ảnh`:

- mở panel khoảng 90–120px tùy nội dung;
- có action chọn/kéo thả/dán ảnh;
- có action `Dùng URL ảnh` nhưng URL input chỉ xuất hiện sau khi chọn action;
- upload progress/error/retry tiếp tục dùng logic hiện tại;
- helper note chỉ hiển thị trong expanded state.

### 6.3 Uploaded state

Sau upload:

- thumbnail khoảng `64 × 64px`;
- filename hoặc label ngắn;
- field `Mô tả ảnh`;
- action `Thay ảnh`, `Xóa`;
- không dùng preview full-width `max-h-56` trong optional attachment.

### 6.4 Required/core image questions

`IMAGE_QUESTION` tiếp tục dùng full `MediaDropzone` hiện tại hoặc một full variant tương đương. Compact behavior chỉ áp dụng cho **ảnh đính kèm tùy chọn** trong Shared Header.

## 7. Space allocation

Target desktop:

- Question rich editor: min-height khoảng 220–260px trong manual workspace.
- Attachment collapsed: ~48px.
- Attachment expanded empty: <= 120px nếu không có error/progress.
- Attachment uploaded summary: khoảng 88–120px.

Mục đích là đưa `Độ khó` và `Các đáp án` lên gần hơn, giảm cuộn dọc nhưng vẫn cho editor đủ không gian.

## 8. Responsive and accessibility

Breakpoints kiểm tra bắt buộc: 320, 768, 1024, 1440px.

- Toolbar được wrap/overflow có kiểm soát, không làm horizontal overflow toàn trang.
- Mọi toolbar button là `<button type="button">` với accessible name.
- Toggle format dùng `aria-pressed` khi phù hợp.
- Attachment expander có `aria-expanded` + `aria-controls`.
- Upload region vẫn hỗ trợ keyboard, drag/drop và paste.
- Focus sau upload/insert formula không bị mất.
- Rich editor có accessible label `Nội dung câu hỏi`.

## 9. Legacy compatibility

Một câu hỏi chỉ có plain string:

```text
Dòng 1
Dòng 2
```

khi mở editor phải được chuyển thành rich document v1 mà không làm mất newline hoặc TeX.

Nếu `questionRichText` bị thiếu, invalid hoặc version chưa hỗ trợ:

- renderer fallback về `question`;
- editor fallback về document tạo từ `question`;
- không làm quiz không thể mở.

## 10. Security constraints

- Persisted rich JSON phải được validate cả frontend utility và Worker trước khi lưu.
- Unknown node/mark/attribute bị reject hoặc normalize về allowlist.
- Không render persisted HTML qua `dangerouslySetInnerHTML`.
- Không cho URL/image node trong rich doc v1.
- Không cho style arbitrary.
- Server giới hạn byte size.
- `question` plain fallback vẫn đi qua math normalization/validation hiện tại.

## 11. MVP scope

### Included

- Compact optional attachment.
- Larger main question editor area.
- Enter paragraph / Shift+Enter hard break.
- Undo/redo.
- Bold/italic/underline/strikethrough.
- Left/center/right.
- Bullet/numbered list.
- Fixed text-color palette.
- Fixed highlight palette.
- Clear formatting.
- Existing math composer integration.
- Structured rich JSON v1 + plain fallback.
- Manual teacher preview + primary student quiz player rich rendering.
- Legacy fallback.
- Paste sanitization via editor schema.

### Explicitly deferred

- Rich text for answer choices.
- Rich text for explanations.
- Rich text for type-specific passage fields (`DragDrop.text`, `Dropdown.text`, `ErrorCorrection.passage`, etc.).
- Inline images inside rich text.
- Tables.
- Links.
- Arbitrary font/size/style.
- Rich rendering in every analytics/report table; these keep plain fallback in MVP.

## 12. Acceptance criteria

1. **Enter:** `Dòng 1` + Enter + `Dòng 2` survives save, draft reload, publish/reload and student render.
2. **Shift+Enter:** produces a hard break without an extra paragraph gap.
3. **Formatting:** bold/italic/underline/strike persists through save/reload.
4. **Alignment:** left/center/right persists and renders in teacher preview + student player.
5. **Lists:** bullet/numbered lists persist; Enter behavior matches modern editor expectations.
6. **Math:** existing Math Composer inserts TeX at the rich-editor selection; valid TeX survives; invalid math remains blocked by current validation.
7. **Legacy:** old questions without rich JSON remain editable and render correctly.
8. **Security:** unsupported/raw HTML cannot execute and is not persisted as arbitrary DOM markup.
9. **Attachment:** when empty, optional image section is collapsed by default and no large dropzone occupies the form.
10. **Attachment upload:** upload, paste, drag/drop, URL, progress, retry, alt sanitization, replace and delete continue working.
11. **IMAGE_QUESTION:** full image editing is not compacted accidentally.
12. **Responsive:** no document-level horizontal overflow at 320/768/1024/1440.
13. **Performance:** editor dependency does not break bundle budget; if it does, rich editor is lazy-loaded on authoring routes.

## 13. Rollout strategy

1. Land compact attachment first; it is independently shippable and requires no schema change.
2. Land rich-text contract + editor behind compatible optional fields.
3. Add D1 column and server validation.
4. Enable rich editor on manual question prompt only.
5. Verify preview/player parity.
6. Production D1 migration and production deploy require a separate explicit approval after tests/review.

## 14. Decision summary

- **Yes:** focused rich-text editor for the main manual question prompt.
- **Yes:** structured JSON plus plain-text fallback.
- **Yes:** compact/collapsible optional image attachment.
- **Yes:** keep math as TeX text in v1 and adapt existing Math Composer.
- **No:** Word clone.
- **No:** arbitrary HTML/CSS.
- **No:** replacing the existing `question` text column with JSON.
- **No:** inline rich-text images in MVP.
