# TôHiệuQuiz System Question Bank Design

**Date:** 2026-08-02
**Status:** Approved for implementation
**Owner:** TôHiệuQuiz
**Scope:** Ngân hàng câu hỏi dùng chung toàn hệ thống, giữ tương thích với kho cá nhân hiện có

## 1. Mục tiêu

Xây dựng một ngân hàng câu hỏi dùng chung để quản trị viên có thể nhập, kiểm duyệt và phát hành câu hỏi cho toàn bộ giáo viên. Giáo viên được tìm kiếm, xem và đưa câu hỏi hệ thống vào đề; đồng thời vẫn tiếp tục quản lý kho câu hỏi cá nhân như hiện nay.

Đợt dữ liệu đầu tiên sẽ là bộ câu hỏi Toán lớp 5 học kì 1 theo 6 chủ đề và 35 bài mà người dùng đã cung cấp. Nội dung được biên soạn mới theo yêu cầu kiến thức, không sao chép nguyên văn bài tập trong sách giáo khoa.

## 2. Nguyên tắc thiết kế

- Không thay đổi hành vi hiện có của kho cá nhân nếu người dùng không chọn phạm vi mới.
- Không dùng chung trường `teacher_id` để đại diện cho dữ liệu hệ thống.
- Quyền hệ thống được kiểm tra tại Worker, không chỉ ẩn nút trên giao diện.
- Câu hỏi hệ thống chỉ được giáo viên đọc; chỉ quản trị viên được tạo, sửa, phát hành hoặc lưu trữ.
- Tìm kiếm và lọc dựa trên các cột đã chuẩn hóa, không phụ thuộc việc quét JSON cho mọi truy vấn.
- Mọi thao tác nhập hàng loạt phải có kiểm tra hợp lệ, chống trùng và báo cáo từng dòng.
- Xóa câu hỏi hệ thống là lưu trữ mềm để không làm hỏng đề đã sử dụng câu hỏi trước đó.

## 3. Phạm vi chức năng

### 3.1. Kho hệ thống

Quản trị viên có thể:

- Tạo một câu hỏi hệ thống.
- Nhập hàng loạt từ JSON hoặc dữ liệu đã được tạo bởi script nội bộ.
- Lưu câu hỏi ở trạng thái nháp.
- Phát hành câu hỏi cho giáo viên.
- Sửa metadata hoặc nội dung câu hỏi.
- Lưu trữ câu hỏi không còn sử dụng.
- Xem báo cáo số câu được chấp nhận, bị trùng hoặc bị lỗi khi nhập.

Giáo viên có thể:

- Duyệt câu hỏi đã phát hành.
- Tìm kiếm theo nội dung.
- Lọc theo lớp, môn, học kì, chủ đề, bài, loại câu hỏi và độ khó.
- Xem đáp án và lời giải trong giao diện soạn đề.
- Thêm câu hỏi trực tiếp vào đề đang soạn.
- Sao chép một câu hỏi hệ thống sang kho cá nhân để chỉnh sửa riêng.

### 3.2. Kho cá nhân

Kho cá nhân tiếp tục hỗ trợ hành vi hiện tại:

- Giáo viên chỉ đọc và thay đổi câu hỏi thuộc tài khoản của mình.
- Quản trị viên có thể hỗ trợ quản lý khi cần.
- API cũ `GET /api/test-bank/teacher/:teacherId` vẫn hoạt động.
- `POST /api/test-bank` không truyền `scope` vẫn tạo câu hỏi cá nhân.

## 4. Kiến trúc dữ liệu

### 4.1. Bảng mới `question_bank_items`

Không mở rộng trực tiếp bảng `test_bank`. Tạo bảng mới để tách rõ mô hình dữ liệu, quyền sở hữu và khả năng rollback.

```sql
CREATE TABLE question_bank_items (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('SYSTEM', 'PERSONAL')),
  owner_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),

  question_data TEXT NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 3),
  explanation TEXT NOT NULL DEFAULT '',

  grade INTEGER,
  subject TEXT NOT NULL DEFAULT '',
  semester INTEGER,
  topic_code TEXT NOT NULL DEFAULT '',
  lesson_code TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'MANUAL',
  tags TEXT NOT NULL DEFAULT '[]',

  content_hash TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT,
  archived_at TEXT
);
```

Quy ước:

- `scope = SYSTEM`: `owner_id = ''`.
- `scope = PERSONAL`: `owner_id` là username giáo viên.
- `status = PUBLISHED` mới xuất hiện trong kho hệ thống của giáo viên.
- `question_data` giữ toàn bộ cấu trúc `Question` hiện tại để tương thích renderer.
- `question_text`, `question_type`, `difficulty` và metadata được lưu riêng để lọc nhanh.

### 4.2. Chỉ mục

```sql
CREATE UNIQUE INDEX idx_question_bank_unique_content
  ON question_bank_items(scope, owner_id, content_hash);

CREATE INDEX idx_question_bank_browse
  ON question_bank_items(scope, status, grade, subject, semester, topic_code, lesson_code);

CREATE INDEX idx_question_bank_owner
  ON question_bank_items(owner_id, status, updated_at DESC);

CREATE INDEX idx_question_bank_type_difficulty
  ON question_bank_items(question_type, difficulty);
```

### 4.3. Bảng audit

```sql
CREATE TABLE question_bank_audit (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Audit ghi các thao tác `CREATE`, `UPDATE`, `PUBLISH`, `ARCHIVE`, `RESTORE`, `BULK_IMPORT` đối với dữ liệu hệ thống.

### 4.4. Dữ liệu cũ

Migration sao chép dữ liệu từ `test_bank` sang bảng mới:

- `scope = PERSONAL`.
- `owner_id = teacher_id`.
- `status = PUBLISHED` để không làm biến mất câu hỏi cá nhân hiện có.
- `content_hash = 'legacy:' || id` trong migration SQL; khi câu hỏi được cập nhật lần đầu, Worker tính lại hash chuẩn.

Bảng `test_bank` được giữ trong ít nhất một chu kỳ phát hành để rollback. API mới đọc bảng mới sau khi migration hoàn tất.

## 5. Chuẩn metadata

### 5.1. Giá trị cho bộ Toán lớp 5

- `grade`: `5`
- `subject`: `MATH`
- `semester`: `1`
- `topic_code`: `M5-S1-T01` đến `M5-S1-T06`
- `lesson_code`: `M5-S1-L01` đến `M5-S1-L35`
- `source`: `CURATED_ORIGINAL`

Tags hiển thị bằng tiếng Việt, ví dụ:

```json
["Toán", "Lớp 5", "Học kì 1", "Chủ đề 1", "Bài 6", "Cộng trừ phân số"]
```

### 5.2. Content hash

Worker tạo SHA-256 từ JSON chuẩn hóa gồm:

- Loại câu hỏi.
- Nội dung câu hỏi đã trim và chuẩn hóa khoảng trắng.
- Các lựa chọn theo đúng thứ tự.
- Đáp án đúng.
- Các trường cấu trúc đặc thù của từng loại câu hỏi.

Không đưa `id`, metadata phân loại, timestamps hoặc tags vào hash. Nhờ vậy một câu hỏi giống nhau không thể được nhập lặp trong cùng phạm vi, nhưng vẫn có thể tồn tại một bản hệ thống và một bản cá nhân.

## 6. Hợp đồng API

### 6.1. Danh sách câu hỏi

```http
GET /api/test-bank?scope=SYSTEM&page=1&pageSize=30&grade=5&subject=MATH&semester=1&topicCode=M5-S1-T01&lessonCode=M5-S1-L06&difficulty=2&type=MCQ&search=phân%20số
```

Phạm vi:

- `SYSTEM`: giáo viên và quản trị viên đọc câu đã phát hành; quản trị viên có thể yêu cầu thêm trạng thái.
- `PERSONAL`: người dùng chỉ đọc dữ liệu của mình, trừ quản trị viên có tham số `ownerId`.
- `ALL`: hợp nhất hệ thống đã phát hành và kho cá nhân của người đang đăng nhập.

Response:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 30,
    "totalItems": 0,
    "totalPages": 0
  },
  "appliedFilters": {
    "scope": "SYSTEM",
    "grade": 5,
    "subject": "MATH"
  }
}
```

Giới hạn `pageSize` từ 1 đến 100. Mặc định 30.

### 6.2. Chi tiết

```http
GET /api/test-bank/:id
```

Chỉ trả câu hỏi khi người dùng có quyền đọc theo `scope`, `owner_id` và `status`.

### 6.3. Tạo câu hỏi

```http
POST /api/test-bank
```

Payload mới:

```json
{
  "scope": "SYSTEM",
  "status": "DRAFT",
  "questionData": {},
  "metadata": {
    "grade": 5,
    "subject": "MATH",
    "semester": 1,
    "topicCode": "M5-S1-T01",
    "lessonCode": "M5-S1-L01",
    "source": "CURATED_ORIGINAL",
    "tags": []
  }
}
```

Tương thích ngược:

- Payload cũ có `question_data`, `teacher_id`, `tags` và không có `scope` được chuẩn hóa thành câu hỏi `PERSONAL`.
- Giáo viên không được tự đặt `owner_id` thành người khác.
- Chỉ admin được tạo `SYSTEM`.

### 6.4. Cập nhật

```http
PATCH /api/test-bank/:id
```

- Giáo viên chỉ cập nhật câu `PERSONAL` của chính mình.
- Admin cập nhật câu `SYSTEM` hoặc hỗ trợ dữ liệu cá nhân.
- Patch chỉ thay đổi trường được gửi.
- Cập nhật nội dung phải tính lại `content_hash` và kiểm tra trùng.

### 6.5. Xóa hoặc lưu trữ

```http
DELETE /api/test-bank/:id
```

- `SYSTEM`: chuyển sang `ARCHIVED`, không xóa vật lý.
- `PERSONAL`: giữ hành vi xóa hiện tại trong giai đoạn tương thích.
- Gọi lại với bản đã lưu trữ hoặc đã xóa trả thành công để thao tác có tính idempotent.

### 6.6. Nhập hàng loạt

```http
POST /api/test-bank/bulk
```

Chỉ admin. Tối đa 100 câu mỗi request.

Response:

```json
{
  "summary": {
    "received": 100,
    "created": 94,
    "duplicates": 4,
    "invalid": 2
  },
  "results": [
    {
      "index": 0,
      "status": "CREATED",
      "id": "qb_..."
    }
  ]
}
```

Mỗi câu được validate độc lập. Request không rollback toàn bộ chỉ vì một câu lỗi. Các câu hợp lệ được ghi bằng D1 batch theo lô nhỏ.

### 6.7. Sao chép sang kho cá nhân

```http
POST /api/test-bank/:id/copy-to-personal
```

- Chỉ áp dụng với câu `SYSTEM` đã phát hành.
- Tạo ID mới và `scope = PERSONAL`.
- Giữ nội dung, metadata và ghi thêm tag `Sao chép từ kho hệ thống`.
- Nếu bản giống hệt đã có trong kho cá nhân, trả `409 DUPLICATE_QUESTION` cùng ID hiện có.

### 6.8. Mã lỗi

- `VALIDATION_ERROR` — 400 hoặc 422.
- `FORBIDDEN` — 403.
- `QUESTION_NOT_FOUND` — 404.
- `DUPLICATE_QUESTION` — 409.
- `IMPORT_LIMIT_EXCEEDED` — 413.
- `INTERNAL_ERROR` — 500, không lộ chi tiết SQL.

API cũ tiếp tục giữ response `{ items }` tại route legacy để không phá frontend hiện tại.

## 7. Phân quyền

| Hành động | Giáo viên | Admin |
|---|---:|---:|
| Đọc SYSTEM/PUBLISHED | Có | Có |
| Đọc SYSTEM/DRAFT hoặc ARCHIVED | Không | Có |
| Tạo SYSTEM | Không | Có |
| Sửa/phát hành/lưu trữ SYSTEM | Không | Có |
| Đọc PERSONAL của mình | Có | Có |
| Đọc PERSONAL người khác | Không | Có khi chỉ định owner |
| Tạo/sửa/xóa PERSONAL của mình | Có | Có |
| Bulk import SYSTEM | Không | Có |
| Sao chép SYSTEM sang PERSONAL | Có | Có |

Mọi kiểm tra dùng dữ liệu từ JWT/session đã xác thực. Không tin `teacher_id`, `owner_id`, `created_by` hoặc `updated_by` từ request của giáo viên.

## 8. Giao diện

### 8.1. Trình duyệt ngân hàng câu hỏi

Trong modal/drawer ngân hàng câu hỏi hiện tại, thêm hai tab:

- **Kho hệ thống**
- **Kho của tôi**

Mặc định mở `Kho hệ thống` khi hệ thống đã có dữ liệu; nếu kho hệ thống trống, giữ tab cá nhân để tránh màn hình rỗng.

Bộ lọc:

- Từ khóa.
- Lớp.
- Môn.
- Học kì.
- Chủ đề.
- Bài.
- Loại câu hỏi.
- Độ khó.

Mỗi thẻ câu hỏi hiển thị:

- Nội dung rút gọn.
- Loại câu hỏi.
- Lớp, môn, chủ đề, bài.
- Độ khó.
- Nguồn `Hệ thống` hoặc `Cá nhân`.
- Nút `Thêm vào đề`.
- Nút `Sao chép về kho của tôi` đối với câu hệ thống.

### 8.2. Quản trị kho hệ thống

Bổ sung màn hình quản trị với:

- Thống kê tổng số nháp, đã phát hành, đã lưu trữ.
- Bảng câu hỏi có bộ lọc.
- Tạo/sửa câu hỏi bằng editor hiện có.
- Nhập hàng loạt.
- Màn hình review trước khi ghi D1.
- Báo cáo lỗi và trùng theo từng dòng.
- Phát hành hoặc lưu trữ nhiều câu.

Đợt đầu không xây workflow nhiều người duyệt. Admin vừa tạo vừa phát hành để giữ phạm vi gọn.

## 9. Bộ câu hỏi Toán lớp 5

### 9.1. Quy mô ban đầu

Tạo 350 câu:

- 35 bài.
- 10 câu mỗi bài.
- 6 chủ đề.

Cơ cấu mặc định mỗi bài:

- 4 câu `MCQ`.
- 2 câu `SHORT_ANSWER`.
- 1 câu `TRUE_FALSE`.
- 1 câu tương tác phù hợp như `MATCHING`, `MULTIPLE_SELECT`, `DRAG_DROP` hoặc `CATEGORIZATION`.
- 2 câu vận dụng hoặc bài toán có lời văn.

Độ khó mỗi bài:

- 4 câu mức 1.
- 4 câu mức 2.
- 2 câu mức 3.

Cơ cấu có thể điều chỉnh ở bài hình học để dùng `GEOMETRY` hoặc `IMAGE_QUESTION` sau khi có asset được kiểm duyệt.

### 9.2. Quy tắc chất lượng

Mỗi câu phải:

- Có đúng một đáp án chuẩn theo contract của loại câu hỏi.
- Có lời giải ngắn, rõ ràng, phù hợp học sinh lớp 5.
- Không chứa dữ kiện mâu thuẫn hoặc thiếu đơn vị.
- Không sử dụng số liệu gây kết quả thập phân ngoài phạm vi bài đang học nếu không có chủ đích.
- Không phụ thuộc hình ảnh nếu chưa cung cấp asset.
- Không sao chép nguyên văn câu hỏi từ sách.
- Có `topic_code`, `lesson_code`, độ khó và tags đầy đủ.

### 9.3. Pipeline tạo và nhập

1. File curriculum chứa 6 chủ đề và 35 bài.
2. Script tạo skeleton 10 slot cho mỗi bài.
3. Nội dung câu hỏi được tạo và lưu thành JSON versioned.
4. Validator kiểm tra schema, đáp án, độ khó, metadata và hash.
5. Báo cáo review chia theo bài.
6. Admin duyệt file.
7. Script gọi bulk API hoặc tạo SQL nhập theo lô.
8. Chạy truy vấn xác nhận số lượng theo chủ đề và bài.

Dữ liệu nguồn được commit vào repo để có thể audit và tái tạo.

## 10. Xử lý lỗi và tính nhất quán

- JSON lỗi trong dữ liệu cũ không làm hỏng toàn bộ danh sách; item lỗi được ghi log và bỏ qua với cảnh báo quản trị.
- Bulk import trả kết quả từng câu.
- D1 batch tối đa theo lô an toàn, không tạo một transaction quá lớn.
- Cập nhật sử dụng `updated_at` và có thể bổ sung optimistic concurrency sau; đợt đầu chưa cần version column vì chỉ admin quản lý SYSTEM.
- Câu hệ thống đã được thêm vào quiz được sao chép thành snapshot của quiz; việc chỉnh câu gốc không tự thay đổi đề đã phát hành.
- Search escape ký tự `%`, `_` và giới hạn độ dài từ khóa để tránh truy vấn tốn tài nguyên.

## 11. Kiểm thử

### Migration

- Tạo bảng và index trên D1 mới.
- Chạy migration lặp lại không phá dữ liệu.
- Sao chép dữ liệu legacy đúng owner và nội dung.

### Worker

- Ma trận phân quyền SYSTEM/PERSONAL.
- Legacy GET và POST vẫn hoạt động.
- Giáo viên không thể tạo hoặc sửa SYSTEM.
- Giáo viên không thể đọc PERSONAL người khác.
- Lọc và phân trang trả đúng tổng số.
- Hash chống trùng trong từng phạm vi.
- Copy-to-personal tạo bản độc lập.
- Bulk import xử lý created/duplicate/invalid.
- Archive SYSTEM không xóa vật lý.

### Frontend

- Hai tab tải đúng dữ liệu.
- Bộ lọc sinh đúng query string.
- Câu SYSTEM không hiện thao tác sửa/xóa cho giáo viên.
- Thêm câu vào đề giữ nguyên contract Question.
- Sao chép về kho cá nhân cập nhật danh sách.
- Empty, loading và error state rõ ràng.

### Dữ liệu Toán lớp 5

- Chính xác 350 câu.
- Mỗi lesson code có 10 câu.
- Mỗi câu qua schema validator.
- Không có content hash trùng trong SYSTEM.
- Đáp án và lời giải được kiểm tra bằng test dữ liệu.

## 12. Triển khai

### Giai đoạn 1 — Hạ tầng

- Migration D1.
- API mới và compatibility adapter.
- Test Worker.

### Giai đoạn 2 — Giao diện

- Tab kho hệ thống/kho cá nhân.
- Bộ lọc và phân trang.
- Admin management/import review.

### Giai đoạn 3 — Dữ liệu

- Tạo và kiểm định 350 câu Toán lớp 5.
- Import vào trạng thái `DRAFT`.
- Kiểm tra số lượng, metadata và sample rendering.
- Chuyển sang `PUBLISHED` theo từng chủ đề.

### Rollback

- Giữ bảng `test_bank` trong giai đoạn chuyển đổi.
- Feature flag `system_question_bank_v1` điều khiển UI mới.
- Khi tắt flag, frontend dùng route legacy.
- Migration không xóa dữ liệu cũ.

## 13. Tiêu chí hoàn thành

- Giáo viên xem được câu SYSTEM đã phát hành nhưng không sửa được.
- Giáo viên tiếp tục quản lý kho cá nhân không bị mất dữ liệu.
- Admin nhập được tối đa 100 câu/lần với báo cáo chi tiết.
- Hệ thống ngăn câu trùng trong cùng phạm vi.
- Bộ lọc lớp–môn–học kì–chủ đề–bài hoạt động ở D1.
- 350 câu Toán lớp 5 được lưu đủ 35 bài, mỗi bài 10 câu.
- Tất cả test mới và quality gate của dự án vượt qua trước deploy.

## 14. Ngoài phạm vi đợt đầu

- Marketplace chia sẻ câu hỏi giữa giáo viên.
- Workflow duyệt nhiều cấp.
- Đánh giá sao hoặc bình luận câu hỏi.
- Tự động cập nhật đề đã phát hành khi câu nguồn thay đổi.
- Full-text search bằng dịch vụ ngoài D1.
- Sinh hình minh họa tự động cho câu hình học.
