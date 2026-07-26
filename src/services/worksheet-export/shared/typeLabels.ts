import type { QuestionType } from '../../../types';

const TYPE_LABELS: Record<string, string> = {
    MCQ: 'Trắc nghiệm',
    TRUE_FALSE: 'Đúng/Sai',
    SHORT_ANSWER: 'Tự luận',
    MATCHING: 'Nối cột',
    MULTIPLE_SELECT: 'Chọn nhiều',
    DRAG_DROP: 'Điền khuyết',
    ORDERING: 'Sắp xếp',
    CATEGORIZATION: 'Phân loại',
    WORD_SCRAMBLE: 'Ghép chữ',
    UNDERLINE: 'Gạch chân',
    ERROR_CORRECTION: 'Sửa lỗi',
    RIDDLE: 'Câu đố',
    IMAGE_QUESTION: 'Hình ảnh',
    DROPDOWN: 'Điền dropdown',
};

export function getWorksheetTypeLabel(type: QuestionType): string {
    return TYPE_LABELS[type] || type;
}
