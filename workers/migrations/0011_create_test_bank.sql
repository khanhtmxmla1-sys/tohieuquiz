-- Migration 0011: Tạo bảng test_bank để giáo viên lưu trữ câu hỏi cá nhân
CREATE TABLE IF NOT EXISTS test_bank (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    question_data TEXT NOT NULL, -- JSON string mô tả cấu trúc câu hỏi
    tags TEXT, -- JSON array các nhãn (ví dụ: ["Toán lớp 1", "Khó"])
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tạo Index để truy vấn nhanh theo từng giáo viên
CREATE INDEX IF NOT EXISTS idx_test_bank_teacher ON test_bank(teacher_id);
