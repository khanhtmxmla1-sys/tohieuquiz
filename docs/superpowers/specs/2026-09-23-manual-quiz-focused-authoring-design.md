# Soạn đề thủ công — tổng quan câu hỏi và chế độ sửa tập trung

**Trạng thái:** Bản thiết kế chờ giáo viên duyệt

**Ngày:** 2026-09-23

**Phạm vi:** Trình soạn đề thủ công của giáo viên, khi tạo đề mới hoặc sửa đề hiện có

## 1. Vấn đề và quyết định

Ở màn hiện tại, danh sách câu hỏi rộng 280 px và khung xem trước rộng 380 px cùng hiện bên cạnh trình sửa. Vùng còn lại có thể quá chật để đọc và chỉnh câu dài, đáp án, hình ảnh hoặc công thức. Danh sách bên trái cũng luôn dành chỗ cho các nút thao tác của từng câu.

Giáo viên muốn xem toàn đề rõ ràng, chọn một câu rồi mới vào sửa trong không gian rộng. Giải pháp được chọn là hai chế độ trong cùng trình soạn: **Tổng quan câu hỏi** và **Sửa một câu**. Đây là thay đổi về bố cục và điều hướng; quy trình tạo đề, các dạng câu hỏi, nhập câu, thiết lập đề, lưu bản nháp và xuất bản vẫn dùng hệ thống hiện có.

Đã cân nhắc hai cách khác:

- Chỉ thu gọn hai cột hiện có: thay đổi nhỏ nhưng danh sách và vùng sửa vẫn tranh diện tích khi giáo viên cần chuyển câu thường xuyên.
- Mở trình sửa trong cửa sổ phủ màn hình: rộng hơn nhưng khó định vị trong toàn đề, nhất là khi cần chuyển qua nhiều câu.

## 2. Mục tiêu và giới hạn

### Mục tiêu

1. Giáo viên đọc được tổng quan đề và tìm câu cần sửa mà không phải mở từng câu.
2. Khi sửa, nội dung câu hỏi là trọng tâm; vùng nhập có chiều rộng hữu dụng trên desktop và chiếm màn hình trên thiết bị nhỏ.
3. Chuyển câu, xem trước hoặc quay về danh sách không làm mất nội dung đang gõ.
4. Tình trạng lưu và lỗi của từng câu dễ hiểu, dùng lại quy tắc kiểm tra xuất bản hiện có.

### Không thuộc phiên bản đầu

- Không tạo trình soạn đề thứ hai hoặc thay API, D1 schema, định dạng câu hỏi.
- Không thay cách chấm điểm, hiển thị bài làm của học sinh hoặc màn soạn bằng AI.
- Không thêm thao tác chỉnh nhiều câu cùng lúc trong vùng sửa.
- Không có chế độ chia đôi vùng sửa và xem trước trong phiên bản đầu. Xem trước mở thành tab riêng để bảo toàn chiều rộng vùng sửa.

## 3. Luồng sử dụng

### 3.1 Tạo đề mới

Đề chưa có câu mở trạng thái trống với hành động thêm câu. Khi giáo viên chọn loại câu hỏi, hệ thống tạo câu và vào ngay chế độ Sửa một câu. Không bắt giáo viên quay qua màn tổng quan chỉ để mở câu vừa tạo.

### 3.2 Đề đã có câu

Mở đề vào Tổng quan câu hỏi. Chọn Sửa trên một hàng để vào chế độ tập trung. Bấm Xong, Về danh sách hoặc chọn Câu trước/Câu sau để tiếp tục. Khi quay lại tổng quan, giữ bộ lọc, từ khóa và vị trí cuộn gần câu vừa sửa. Từ kết quả kiểm tra xuất bản, hành động Sửa câu lỗi mở đúng câu đó trong chế độ tập trung.

Thêm một câu bằng nút thêm nhanh mở thẳng câu mới. Nhập nhiều câu từ tệp hoặc kho câu hỏi đưa về tổng quan và làm nổi bật các câu mới, để giáo viên rà trước khi sửa.

## 4. Tổng quan câu hỏi

Màn tổng quan dùng toàn bộ chiều rộng dưới thanh tiêu đề đề. Phần đầu hiển thị số câu, tổng điểm, số câu cần sửa và thao tác thêm câu. Thanh tìm kiếm tìm theo số câu hoặc nội dung như hiện tại; bộ lọc tối thiểu là Tất cả / Cần sửa / Theo dạng câu.

Trên desktop, mỗi câu là một hàng dễ quét; trên điện thoại, hàng chuyển thành thẻ dọc. Mỗi câu thể hiện theo thứ tự ổn định:

1. Số câu và trích đoạn nội dung tối đa hai dòng; câu rỗng ghi rõ Chưa có nội dung.
2. Dạng câu, điểm và trạng thái kiểm tra: Sẵn sàng, Cần sửa hoặc Cảnh báo.
3. Hành động chính Sửa. Nhân bản, di chuyển và xóa nằm trong menu phụ hoặc chỉ hiện khi hàng được chọn, để tránh lặp bốn nút trên mọi hàng.

Trạng thái câu lấy từ bộ kiểm tra nội dung câu hiện có, không tạo quy tắc xuất bản mới. Hiển thị tên lỗi ngắn và cho phép mở thẳng vị trí liên quan trong trình sửa. Thứ tự câu và thao tác kéo thả/bàn phím hiện có được giữ; bộ lọc không làm thay đổi số thứ tự thật. Các thao tác chọn nhiều câu và hoàn tác xóa vẫn dùng được ở tổng quan.

### 4.1 Bố cục tổng quan

    Thanh tiêu đề đề: Tên đề · trạng thái lưu             Thiết lập · Kiểm tra và xuất bản
    Tổng quan câu hỏi        32 câu · 9/10 điểm · 3 câu cần sửa        + Thêm câu
    Tìm câu hỏi...           [Tất cả | Cần sửa]             [Dạng câu]
    07  Tính diện tích hình...      Trắc nghiệm · 1 điểm     Cần sửa    [Sửa] [⋯]
    08  Cho biểu thức sau...        Đúng/Sai · 1 điểm       Sẵn sàng   [Sửa] [⋯]

Danh sách chiếm vùng nội dung chính, không còn cột 280 px. Ở màn rộng, các hàng có cột thẳng hàng để quét nhanh; trích đoạn dài giới hạn hai dòng và vẫn đọc được đầy đủ qua nút Sửa, không dựa vào tooltip. Nút Sửa là hành động nổi bật duy nhất trên mỗi hàng. Menu phụ chứa Nhân bản, Di chuyển, Xóa; menu có nhãn rõ, không chỉ có biểu tượng. Khi đang kéo thả hoặc chọn nhiều, hành động tương ứng hiện rõ nhưng không làm thay đổi nội dung câu.

## 5. Sửa một câu

Khi vào Sửa một câu, ẩn danh sách và khung xem trước thường trực. Vùng soạn chiếm toàn bộ chiều rộng màn làm việc; form căn giữa với chiều rộng tối đa khoảng 1120 px, thay cho giới hạn 896 px hiện tại. Các khối công thức, ảnh, đáp án và bảng lựa chọn co theo vùng form; văn bản dài vẫn có khoảng đọc hợp lý.

Thanh điều hướng gọn ở đầu vùng sửa gồm Về danh sách, Câu N / tổng số, Câu trước, Câu sau và Xem trước. Thanh hành động ở cuối vùng nhìn thấy khi cuộn gồm trạng thái lưu, Lưu câu hỏi, Lưu và câu sau và Xong. Các nút không hợp lệ ở câu đầu/cuối được vô hiệu hóa rõ ràng; ở câu cuối, Xong là hành động chính. Giữ các chức năng sửa hiện có như điểm câu, công thức toán, nhân bản và xóa; hành động ít dùng có thể gộp vào menu phụ.

Xem trước là một chế độ/tab trong cùng màn sửa, không chiếm 380 px thường trực. Nó hiển thị bản câu đang chỉnh, kể cả thay đổi mới chưa đồng bộ lên máy chủ, rồi trả về đúng câu và vị trí soạn khi đóng. Bản xem trước phải dùng renderer học sinh hiện có; không tự tạo renderer khác.

### 5.1 Bố cục sửa tập trung

    Thanh tiêu đề đề: Tên đề · trạng thái lưu             Thiết lập · Kiểm tra và xuất bản
    ← Tổng quan        Câu 7 / 32             [Câu trước] [Câu sau] [Xem trước]
    ┌──────────────────── vùng soạn tối đa khoảng 1120 px ────────────────────┐
    │ Dạng câu · Điểm câu                     Công thức toán · Nhân bản · ⋯    │
    │ Nội dung câu hỏi: vùng nhập rộng, dễ đọc                                │
    │ Các đáp án / trường riêng của dạng câu                                  │
    └─────────────────────────────────────────────────────────────────────────┘
    Trạng thái: Đang sửa / Đã lưu trên thiết bị / Đã đồng bộ
                           [Lưu câu hỏi] [Lưu và câu sau] [Xong]

Thanh trên cố định trong vùng làm việc để giáo viên luôn biết đang sửa câu nào; thanh hành động dưới bám cạnh dưới vùng làm việc nhưng không phủ nội dung. Nội dung cuộn độc lập giữa hai thanh. Khi mở Xem trước, thay vùng soạn bằng bản xem trước cùng chiều rộng, với nút Quay lại sửa; không mở thêm cột bên phải.

### 5.2 Thứ bậc thị giác và trạng thái

- Dùng tiếp phông Be Vietnam Pro, nền sáng ấm và màu xanh chủ đạo hiện có; đây là sắp xếp lại giao diện, không thay bộ nhận diện.
- Tên câu và nội dung là cấp thông tin chính. Dạng câu, điểm và số thứ tự là cấp phụ. Màu trạng thái chỉ hỗ trợ cho chữ Sẵn sàng, Cần sửa, Cảnh báo; không truyền nghĩa chỉ bằng màu.
- Mỗi màn có một hành động chính: Thêm câu trong tổng quan; Lưu và câu sau khi đang sửa. Xóa và các hành động hiếm dùng không cạnh tranh thị giác với hành động chính.
- Trạng thái lưu tách rõ nội dung đang sửa, đã lưu cục bộ, đang đồng bộ và lỗi. Thông báo thành công thoáng qua không che vùng soạn; lỗi lưu hiện gần thanh hành động cùng nút Thử lại.
- Hàng được chọn, hover, focus bàn phím và kéo thả có kiểu thể hiện riêng. Mục tiêu chạm tối thiểu 44 px; văn bản chính tối thiểu 14 px, nhãn và trạng thái quan trọng không bị cắt mất trên desktop.

## 6. Lưu nháp và chuyển câu an toàn

Hiện QuestionEditorPane giữ bản nháp câu trong state cục bộ và chỉ đưa nội dung vào workspace khi bấm Lưu câu hỏi. Chọn câu khác có thể làm component câu cũ rời màn hình trước khi phần đang gõ được lưu. Thiết kế mới phải loại bỏ đường mất dữ liệu này.

- Mọi thay đổi đánh dấu câu là Chưa lưu. Bản nháp đang soạn được đưa vào workspace envelope sau một khoảng chờ ngắn để cơ chế tự lưu cục bộ và từ xa hiện có tiếp quản. Cảnh báo rời trang cũng phải tính phần chỉnh sửa còn nằm trong form trước khi debounce hoàn tất.
- Mọi đường rời chế độ sửa, gồm Về danh sách, Câu trước/Câu sau, Xem trước, mở thiết lập và kiểm tra xuất bản, phải đồng bộ phần chỉnh sửa cuối cùng vào envelope trước khi chuyển. Không chỉ bảo vệ hai nút điều hướng mới.
- Lưu câu hỏi và Lưu và câu sau yêu cầu lưu cục bộ thành công trước khi báo Đã lưu hoặc chuyển câu. Đồng bộ từ xa có thể tiếp tục theo cơ chế hiện có; khi ngoại tuyến, hiển thị Đã lưu trên thiết bị.
- Nếu chuyển đổi bản nháp hoặc lưu cục bộ thất bại, ở lại câu hiện tại, giữ nguyên nội dung và đưa ra lỗi có thể thử lại. Không hiển thị Đã lưu khi chỉ mới thay đổi state của form.
- Khi có xung đột bản nháp từ xa, giữ cơ chế xử lý xung đột hiện tại và không âm thầm ghi đè bản đang soạn. Nếu rời trang khi còn thay đổi chưa được lưu cục bộ, dùng cảnh báo rời trang hiện có.

Việc lưu bản nháp không đồng nghĩa câu đã đạt điều kiện xuất bản; câu chưa hoàn chỉnh vẫn được lưu để sửa tiếp.

## 7. Responsive, bàn phím và khả năng tiếp cận

Ở desktop, Tổng quan và Sửa là hai chế độ toàn chiều rộng. Ở tablet và điện thoại, dùng cùng hai chế độ thay vì thu nhỏ bố cục ba cột. Xem trước mở thành màn/tab riêng. Thanh hành động không che trường nhập và tính đến vùng an toàn dưới cùng của điện thoại.

Trên điện thoại, hàng tổng quan thành thẻ: số câu và trạng thái ở dòng đầu, trích đoạn ở giữa, Sửa ở cuối; các metadata khác xếp gọn trên một dòng. Thanh sửa chỉ giữ Về danh sách, Câu N/tổng và menu điều hướng; Lưu và câu sau/Xong ở thanh dưới. Không lặp lại ba tab Danh sách/Soạn/Xem trước hiện tại khi hai chế độ mới đã chỉ rõ vị trí.

Mọi hàng câu, nút Sửa, Câu trước/Câu sau, Xem trước và Xong dùng được bằng bàn phím, có tên truy cập rõ. Sau khi mở câu, focus vào tiêu đề hoặc trường nội dung đầu tiên; khi quay về tổng quan, focus về hàng vừa sửa. Phím tắt hiện có như lưu và chuyển câu phải đi qua cùng quy trình lưu an toàn; không chiếm phím tắt của rich-text editor.

Kiểm tra tối thiểu ở 320, 768, 1024, 1440 và 1920 px; không có cuộn ngang toàn trang. Tôn trọng chế độ giảm chuyển động hiện có.

## 8. Ranh giới kỹ thuật

Giữ một nguồn dữ liệu đề trong useManualQuizWorkspaceStore. Tách trách nhiệm thành điều phối chế độ màn hình, danh sách tổng quan, vùng sửa tập trung và vùng xem trước; không tạo store hay API lưu đề song song. QuestionEditorForm và renderer câu hỏi hiện có được tái sử dụng.

Trạng thái chế độ màn hình và vị trí cuộn là trạng thái giao diện. Nội dung câu tiếp tục nằm trong workspace envelope để autosave, versioning, validation và publish hiện có hoạt động. Khi đề ở chế độ chỉ đọc, tổng quan và xem trước vẫn đọc được; hành động trên hàng đổi từ Sửa thành Xem, còn nút chỉnh và các phím tắt thay đổi dữ liệu bị khóa theo quyền hiện hành.

## 9. Kiểm thử và tiêu chí chấp nhận

1. Tạo đề mới, thêm câu đầu tiên và vào thẳng màn sửa rộng.
2. Mở đề nhiều câu vào tổng quan; tìm/lọc, chọn câu, quay lại vẫn giữ vị trí và đúng số thứ tự.
3. Gõ sửa câu rồi chuyển câu hoặc xem trước ngay: nội dung không mất sau khi quay lại, tải lại trang và đồng bộ bản nháp.
4. Lưu cục bộ lỗi hoặc xung đột từ xa: không rời câu và không báo lưu thành công sai.
5. Xem trước phản ánh nội dung câu đang sửa, kể cả khi đồng bộ từ xa chưa xong.
6. Kiểm tra xuất bản chỉ đúng câu lỗi và mở đúng màn sửa; quy tắc xuất bản không đổi.
7. Tạo, nhập một/nhiều câu, nhân bản, xóa/hoàn tác, đổi thứ tự và chọn nhiều câu vẫn hoạt động.
8. Bàn phím, focus, màn hình nhỏ, chế độ giảm chuyển động và đề chỉ đọc hoạt động như mô tả.
9. Ảnh kiểm tra UI ở trạng thái đề trống, đề khoảng 30 câu, câu dài có công thức/ảnh, câu lỗi, đang lưu và lỗi lưu; đánh giá ở các kích thước nêu trên. Người kiểm thử đọc được số câu, trạng thái và hành động chính ngay mà không phải mở menu phụ.

Kiểm thử gồm unit cho chuyển trạng thái và flush bản nháp, integration cho autosave/validation/preview, E2E cho hành trình tạo đề và sửa nhiều câu. Chạy lại typecheck, lint, build, các bài kiểm tra manual quiz hiện có và kiểm tra giao diện trên các kích thước nêu trên. Không cần D1 migration; phát hành qua quy trình PR, CI và production smoke hiện hành.

## 10. Điều kiện hoàn tất

Giáo viên có thể rà toàn đề trong một màn rõ ràng, chọn câu rồi sửa trong không gian rộng. Chuyển câu không làm mất nội dung; trạng thái lưu có nghĩa chính xác. Tất cả đường tạo đề, nhập câu, kiểm tra và xuất bản hiện có vẫn hoạt động.
