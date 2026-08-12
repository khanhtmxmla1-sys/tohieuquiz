# Thiết kế tối ưu UI câu hỏi phân loại cho học sinh

**Ngày:** 2026-08-12  
**Phạm vi:** Quiz Player – `QuestionType.CATEGORIZATION`  
**Mục tiêu:** Làm giao diện phân loại gọn, dễ đọc và dễ thao tác trên màn hình nhỏ mà không thay đổi contract dữ liệu/chấm điểm.

## 1. Bối cảnh và vấn đề

Renderer hiện tại đặt nội dung mục và toàn bộ nút nhóm cạnh nhau từ breakpoint `sm`. Với tên nhóm dài, vùng nội dung bị co quá mức khiến tiếng Việt xuống dòng gần như từng từ, làm card rất cao và khó đọc. Đồng thời các ô nhóm lớn phía trên chiếm nhiều chiều cao khi chưa có mục nào được phân loại.

Điểm gây lỗi tập trung ở `src/features/quiz-player/components/QuestionRenderer/renderers/DragDropRenderer.tsx`; contract câu hỏi, answer state và scoring không cần thay đổi.

## 2. Các hướng đã cân nhắc

### A. Chỉ sửa breakpoint/wrapping

Giữ nguyên cấu trúc hiện tại, đổi breakpoint sang lớn hơn và buộc nội dung chiếm toàn hàng ở mobile.

- Ưu: thay đổi nhỏ, ít rủi ro.
- Nhược: vẫn giữ các drop-zone lớn phía trên; sau khi chọn câu bị chuyển khỏi danh sách, học sinh phải nhìn qua hai khu vực để theo dõi tiến độ.

### B. Card + chip lựa chọn, lựa chọn xong card tự thu gọn — **chọn**

Mỗi mục là một card toàn chiều ngang. Nội dung luôn nằm trên, lựa chọn nhóm nằm bên dưới dưới dạng chip. Khi đã chọn, card vẫn ở nguyên vị trí nhưng chỉ hiển thị badge nhóm đã chọn và nút “Đổi”. Phần drop-zone lớn phía trên được thay bằng tóm tắt nhóm + tiến độ.

- Ưu: đọc tốt trên điện thoại, giảm chiều cao, không làm học sinh mất vị trí, thao tác chạm rõ ràng.
- Nhược: cần thay đổi markup renderer và thêm test tương tác.

### C. Drawer/modal chọn nhóm

Mỗi card chỉ có nút “Chọn nhóm”; bấm mở bottom-sheet/modal.

- Ưu: cực gọn.
- Nhược: tăng số thao tác, nặng UX cho bài tiểu học có ít nhóm; không cần thiết cho phạm vi hiện tại.

## 3. Thiết kế được chọn

### 3.1. Header tiến độ

Thay khối danh sách chưa phân loại bằng header gọn:

- Tiêu đề: `Phân loại các mục`.
- Tiến độ: `Đã làm X/Y`.
- Nếu hoàn thành toàn bộ: hiển thị trạng thái hoàn thành rõ ràng.

### 3.2. Danh sách nhóm

Hiển thị tên các nhóm dưới dạng chip chỉ dẫn nhỏ ở đầu renderer. Đây là legend, không phải drop-zone lớn. Tên dài được wrap tự nhiên, không ép theo cột hẹp.

### 3.3. Card từng mục

Mỗi item luôn tồn tại trong danh sách theo thứ tự gốc:

- Dòng nội dung chiếm 100% chiều ngang.
- Khi chưa chọn: hiển thị các chip/nút nhóm phía dưới, `flex-wrap`, vùng chạm tối thiểu 44px.
- Khi đã chọn: chỉ hiển thị badge `✓ <Tên nhóm>` và nút `Đổi`/`Chọn lại`; bấm `Đổi` đưa card về trạng thái hiển thị toàn bộ lựa chọn.
- Không thay đổi cấu trúc answer hiện tại: `Record<itemId, categoryId>`.

### 3.4. Responsive

- Mobile/tablet hẹp: nội dung trên, lựa chọn dưới; không có layout ngang gây co chữ.
- Desktop: vẫn dùng card; các chip có thể nằm trên cùng hàng bên dưới nội dung nếu đủ chỗ.
- Không dùng drag-and-drop thực sự vì renderer hiện tại vốn là click-to-assign; thay đổi này tập trung vào tính rõ ràng và khả năng chạm.

### 3.5. Trạng thái và accessibility

- Button có `type="button"` và focus ring hiện hữu.
- Nút nhóm đã chọn có trạng thái trực quan và `aria-pressed` hoặc nhãn truy cập tương đương.
- Nút đổi phải rõ nghĩa, không yêu cầu học sinh nhớ hướng dẫn “nhấn vào mục đã phân loại để trả lại danh sách”.
- Không phụ thuộc chỉ vào màu để thể hiện đã chọn; dùng dấu `✓` + text.

## 4. Data flow

1. Renderer đọc `answers[question.id]` như hiện tại.
2. `handleAssign(itemId, categoryId)` tiếp tục clone map và gọi `onAnswerChange`.
3. UI suy ra `assignedCategory` cho từng item từ map.
4. State cục bộ chỉ dùng nếu cần mở lại lựa chọn cho item đã chọn; state này không tham gia scoring/persistence.
5. Không thay Worker, serializer, schema, review contract hoặc scoring.

## 5. Kiểm thử

### Unit/component tests

Thêm test tập trung cho `DragDropRenderer`:

- Render nội dung dài mà không đặt text và group controls trong layout ngang ở mobile-oriented markup.
- Hiển thị `Đã làm 0/N` ban đầu.
- Click một nhóm gọi `onAnswerChange` đúng map và hiển thị trạng thái đã chọn.
- Item đã chọn vẫn ở đúng danh sách, không biến mất khỏi vị trí.
- Click `Đổi` cho phép chọn nhóm khác; lựa chọn mới thay thế giá trị cũ.
- Hoàn thành tất cả hiển thị `Đã làm N/N`/trạng thái hoàn thành.

### Browser test

Kiểm tra thực tế ở viewport khoảng 360–390px:

- Không còn chữ bị ép thành cột hẹp/từng từ.
- Không overflow ngang.
- Chip wrap hợp lý.
- Card sau khi chọn thấp hơn trạng thái chưa chọn.
- Desktop vẫn cân đối.

## 6. Ngoài phạm vi

- Không thay đổi loại câu hỏi hoặc schema JSON.
- Không thay đổi scoring/correct answer.
- Không thay editor/preview giáo viên trừ khi test phát hiện dùng chung renderer này.
- Không thêm drag-and-drop gesture mới.
- Không refactor renderer khác.

## 7. Tiêu chí hoàn thành

- Ở viewport mobile, mọi câu dài đọc bình thường theo dòng; không bị co còn vài ký tự mỗi dòng.
- Toàn bộ lựa chọn nhóm thao tác được bằng touch/keyboard.
- Sau khi chọn, item không nhảy sang khu vực khác; tiến độ cập nhật ngay.
- Không regress answer payload và scoring contract.
- Test tập trung, typecheck và build liên quan đều qua.
