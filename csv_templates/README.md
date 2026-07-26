# Hướng dẫn Import CSV vào Google Sheets

## 📋 Danh sách các file CSV

| File | Mô tả | Số cột | GID (Sheet ID) |
|------|-------|--------|----------------|
| `Teachers.csv` | Thông tin giáo viên | 5 | `1020504406` |
| `Quizzes.csv` | Thông tin đề thi | 8 | `130202697` |
| `Questions.csv` | Câu hỏi của đề thi | 13 | `306226482` |
| `Results.csv` | Kết quả làm bài | 7 | `766571865` |

## 🔗 Link truy cập trực tiếp

| Sheet | Link |
|-------|------|
| **Teachers** | [Mở sheet](https://docs.google.com/spreadsheets/d/1mrqbJ3Xzj4CBF_B2vyI7-ANLaVPAfWCe_TdmCd9_gx4/edit#gid=1020504406) |
| **Quizzes** | [Mở sheet](https://docs.google.com/spreadsheets/d/1mrqbJ3Xzj4CBF_B2vyI7-ANLaVPAfWCe_TdmCd9_gx4/edit#gid=130202697) |
| **Questions** | [Mở sheet](https://docs.google.com/spreadsheets/d/1mrqbJ3Xzj4CBF_B2vyI7-ANLaVPAfWCe_TdmCd9_gx4/edit#gid=306226482) |
| **Results** | [Mở sheet](https://docs.google.com/spreadsheets/d/1mrqbJ3Xzj4CBF_B2vyI7-ANLaVPAfWCe_TdmCd9_gx4/edit#gid=766571865) |

---

## 📌 Cấu trúc từng Sheet

### 1. Teachers (Giáo viên)
| Cột | Mô tả |
|-----|-------|
| `id` | ID giáo viên (unique) |
| `name` | Họ và tên |
| `email` | Email đăng nhập |
| `password` | Mật khẩu |
| `createdAt` | Ngày tạo (ISO 8601) |

---

### 2. Quizzes (Đề thi)
| Cột | Mô tả |
|-----|-------|
| `id` | ID đề thi (unique) |
| `title` | Tiêu đề đề thi |
| `classLevel` | Lớp (1-5) |
| `category` | Danh mục: `vioedu`, `trang-nguyen`, `on-tap` |
| `timeLimit` | Thời gian làm bài (phút) |
| `createdAt` | Ngày tạo (ISO 8601) |
| `accessCode` | Mã truy cập (nếu có) |
| `requireCode` | Yêu cầu mã: `TRUE` hoặc `FALSE` |

---

### 3. Questions (Câu hỏi)
| Cột | Mô tả | Ghi chú |
|-----|-------|---------|
| `id` | ID câu hỏi (unique) | |
| `quizId` | ID đề thi liên kết | Foreign key tới Quizzes |
| `type` | Loại câu hỏi | `MCQ`, `TRUE_FALSE`, `MATCHING`, `MULTIPLE_SELECT`, `DRAG_DROP`, `UNDERLINE` |
| `question` | Nội dung câu hỏi | Đối với TRUE_FALSE là mainQuestion |
| `options` | Các đáp án (MCQ/MULTIPLE_SELECT) | Phân cách bằng `\|` |
| `correctAnswer` | Đáp án đúng | MCQ: giá trị đúng, MULTIPLE_SELECT: JSON array |
| `items` | Dữ liệu bổ sung | TRUE_FALSE: JSON array statements, MATCHING: JSON array pairs |
| `text` | Văn bản (DRAG_DROP) | Câu có chỗ trống `___` |
| `blanks` | Đáp án cho chỗ trống | JSON object |
| `distractors` | Từ nhiễu (DRAG_DROP) | JSON array |
| `sentence` | Câu văn gốc (UNDERLINE) | Câu văn để học sinh gạch chân |
| `words` | Các từ/cụm từ (UNDERLINE) | JSON array tách từ sentence |
| `correctWordIndexes` | Index từ cần gạch chân | JSON array, 0-indexed |

#### Chi tiết các loại câu hỏi:

**MCQ (Trắc nghiệm 1 đáp án):**
- `options`: `A|B|C|D` (phân cách bằng `|`)
- `correctAnswer`: Giá trị đúng, ví dụ: `A`

**TRUE_FALSE (Đúng/Sai):**
- `question`: Câu hỏi chính (mainQuestion)
- `items`: JSON array, ví dụ:
  ```json
  [{"statement":"15 + 25 = 40","isCorrect":true},{"statement":"20 - 5 = 10","isCorrect":false}]
  ```

**MATCHING (Nối):**
- `items`: JSON array các cặp, ví dụ:
  ```json
  [{"left":"5 x 4","right":"20"},{"left":"6 x 3","right":"18"}]
  ```

**MULTIPLE_SELECT (Chọn nhiều đáp án):**
- `options`: `A|B|C|D` (phân cách bằng `|`)
- `correctAnswer`: JSON array, ví dụ: `["A","C","D"]`

**DRAG_DROP (Kéo thả điền từ):**
- `text`: Câu văn có chỗ trống, ví dụ: `Hôm nay trời rất ___ và ___.`
- `blanks`: JSON object, ví dụ: `{"blank_0":"đẹp","blank_1":"nắng"}`
- `distractors`: JSON array từ nhiễu, ví dụ: `["xấu","mưa","lạnh"]`

**UNDERLINE (Gạch chân từ/cụm từ):**
- `question`: Yêu cầu, ví dụ: `Gạch chân động từ trong câu sau:`
- `sentence`: Câu văn gốc, ví dụ: `Mặt trời ngả nắng đằng tây`
- `words`: JSON array các từ tách ra từ sentence, ví dụ: `["Mặt trời","ngả","nắng","đằng tây"]`
- `correctWordIndexes`: JSON array index các từ cần gạch chân (0-indexed), ví dụ: `[1]` (gạch chân "ngả")
  
  **Ví dụ UNDERLINE:**
  | Câu | sentence | words | correctWordIndexes |
  |-----|----------|-------|-------------------|
  | Gạch chân động từ | Mặt trời ngả nắng đằng tây | ["Mặt trời","ngả","nắng","đằng tây"] | [1] |
  | Gạch chân danh từ | Con mèo đang ngủ trên ghế | ["Con mèo","đang","ngủ","trên","ghế"] | [0,4] |

---

### 4. Results (Kết quả)
| Cột | Mô tả |
|-----|-------|
| `Student Name` | Tên học sinh |
| `Class` | Lớp |
| `Quiz Title` | Tiêu đề đề thi |
| `Score` | Điểm số |
| `correctCount` | Số câu đúng |
| `Total Questions` | Tổng số câu hỏi |
| `Submitted At` | Thời gian nộp bài (ISO 8601) |

---

## 🚀 Hướng dẫn Import

1. **Mở Google Sheets** của bạn
2. **Tạo các sheet mới** với tên:
   - `Teachers`
   - `Quizzes`
   - `Questions`
   - `Results`
3. **Import từng file CSV:**
   - Vào **File > Import**
   - Chọn **Upload** và upload file CSV tương ứng
   - Chọn import location: **Insert new sheet(s)** hoặc **Replace current sheet**
   - **Separator type**: Comma
4. **Đổi tên sheet** nếu cần thiết để khớp với tên trong GAS script

---

## ⚠️ Lưu ý quan trọng

1. **Encoding**: Đảm bảo file CSV sử dụng **UTF-8** để hiển thị đúng tiếng Việt
2. **JSON trong CSV**: Các trường như `items`, `blanks`, `distractors` chứa JSON - cần đảm bảo escape đúng dấu ngoặc kép
3. **ID unique**: Mỗi `id` phải là duy nhất trong sheet của nó
4. **Foreign Key**: `quizId` trong Questions phải tồn tại trong Quizzes

---

## 📝 Ví dụ dữ liệu mẫu

Các file CSV đã được tạo với dữ liệu mẫu để bạn tham khảo cấu trúc.
