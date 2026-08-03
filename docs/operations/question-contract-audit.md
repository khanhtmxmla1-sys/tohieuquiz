# Audit hợp đồng đáp án câu hỏi

Công cụ `scripts/audit-question-contracts.mjs` kiểm tra dữ liệu câu hỏi cũ bằng đúng mapper của Worker và bộ chuẩn hóa chấm điểm dùng trong production. Công cụ chỉ đọc dữ liệu và xuất báo cáo JSON; không tự sửa câu hỏi.

## Chạy với file JSON đã xuất

```bash
node scripts/audit-question-contracts.mjs \
  --input .tmp/questions-export.json \
  --output .tmp/question-contract-audit.json
```

File đầu vào có thể là một mảng hàng từ bảng `questions` hoặc object có trường `rows`. Báo cáo gồm tổng số câu đã kiểm tra, số câu hợp lệ, số câu không hợp lệ, số lượng theo mã lỗi và danh sách chi tiết.

## Chạy read-only với D1 từ xa

```bash
node scripts/audit-question-contracts.mjs \
  --remote \
  --database tohieuquiz-db \
  --config workers/wrangler.toml \
  --output .tmp/question-contract-audit.json
```

Remote mode chỉ thực hiện truy vấn `SELECT`. Không chạy remote trong quá trình phát triển hoặc CI thông thường. Trước khi chạy cần đăng nhập Wrangler đúng tài khoản Cloudflare và xác nhận database đích.

## Cấu trúc một phát hiện

```json
{
  "quizId": "quiz-123",
  "questionId": "question-12",
  "questionType": "SHORT_ANSWER",
  "issueCode": "MISSING_CORRECT_ANSWER",
  "severity": "ERROR",
  "suggestedAction": "Bổ sung đáp án đúng trước khi xuất bản lại câu hỏi."
}
```

## Quy trình xử lý

1. Chạy audit và lưu file báo cáo theo thời điểm.
2. Lọc các lỗi `ERROR` theo `quizId` và `questionId`.
3. Mở đề bằng giao diện sửa thủ công và bổ sung dữ liệu còn thiếu.
4. Xuất bản lại sau khi validation không còn lỗi chặn.
5. Chạy lại audit để xác nhận.

Không tự suy đoán hoặc tự sinh đáp án đúng từ nội dung câu hỏi. Mọi thay đổi production phải được giáo viên hoặc quản trị viên kiểm tra trước.
