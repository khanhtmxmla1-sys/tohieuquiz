import type { Question } from '../../../types';
import { QuestionType } from '../../../types';

export type QuestionTypeGroupId = 'popular' | 'interactive' | 'language' | 'image';

export interface QuestionTypeDescriptor {
    type: QuestionType;
    label: string;
    shortLabel: string;
    description: string;
    example: string;
    group: QuestionTypeGroupId;
    color: string;
}

const QUESTION_TYPE_DESCRIPTORS: QuestionTypeDescriptor[] = [
    {
        type: QuestionType.MCQ,
        label: 'Trắc nghiệm một đáp án',
        shortLabel: 'Trắc nghiệm',
        description: 'Học sinh chọn một đáp án đúng.',
        example: 'Ví dụ: 1 + 1 bằng bao nhiêu?',
        group: 'popular',
        color: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
    },
    {
        type: QuestionType.TRUE_FALSE,
        label: 'Đúng hoặc Sai',
        shortLabel: 'Đúng/Sai',
        description: 'Đánh giá nhiều mệnh đề bằng nút Đúng hoặc Sai.',
        example: 'Ví dụ: “Trái Đất quay quanh Mặt Trời” — Đúng.',
        group: 'popular',
        color: 'bg-green-100 text-green-700 hover:bg-green-200',
    },
    {
        type: QuestionType.SHORT_ANSWER,
        label: 'Điền đáp án ngắn',
        shortLabel: 'Điền đáp án',
        description: 'Học sinh nhập một từ, số hoặc cụm từ ngắn.',
        example: 'Ví dụ: Thủ đô Việt Nam là _____.',
        group: 'popular',
        color: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
    },
    {
        type: QuestionType.MATCHING,
        label: 'Nối hai cột',
        shortLabel: 'Nối cột',
        description: 'Ghép từng nội dung ở cột trái với cột phải.',
        example: 'Ví dụ: 2 × 3 → 6.',
        group: 'popular',
        color: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
    },
    {
        type: QuestionType.MULTIPLE_SELECT,
        label: 'Chọn nhiều đáp án',
        shortLabel: 'Chọn nhiều',
        description: 'Cho phép học sinh chọn từ hai đáp án đúng trở lên.',
        example: 'Ví dụ: Chọn các số chẵn trong danh sách.',
        group: 'interactive',
        color: 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200',
    },
    {
        type: QuestionType.DRAG_DROP,
        label: 'Kéo thả điền khuyết',
        shortLabel: 'Kéo thả',
        description: 'Kéo từ hoặc số vào đúng vị trí còn trống.',
        example: 'Ví dụ: Bầu trời có màu [xanh].',
        group: 'interactive',
        color: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200',
    },
    {
        type: QuestionType.DROPDOWN,
        label: 'Chọn từ danh sách',
        shortLabel: 'Danh sách chọn',
        description: 'Mỗi ô trống có một danh sách phương án để chọn.',
        example: 'Ví dụ: Thủ đô Việt Nam là [Hà Nội].',
        group: 'interactive',
        color: 'bg-sky-100 text-sky-700 hover:bg-sky-200',
    },
    {
        type: QuestionType.ORDERING,
        label: 'Sắp xếp thứ tự',
        shortLabel: 'Sắp xếp',
        description: 'Sắp xếp câu, bước hoặc sự kiện theo thứ tự đúng.',
        example: 'Ví dụ: Sắp xếp các bước giải bài toán.',
        group: 'interactive',
        color: 'bg-teal-100 text-teal-700 hover:bg-teal-200',
    },
    {
        type: QuestionType.CATEGORIZATION,
        label: 'Phân loại vào nhóm',
        shortLabel: 'Phân loại',
        description: 'Kéo từng mục vào nhóm tương ứng.',
        example: 'Ví dụ: Phân loại số chẵn và số lẻ.',
        group: 'interactive',
        color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
    },
    {
        type: QuestionType.UNDERLINE,
        label: 'Gạch chân từ đúng',
        shortLabel: 'Gạch chân',
        description: 'Học sinh chọn và gạch chân từ hoặc cụm từ.',
        example: 'Ví dụ: Gạch chân danh từ trong câu.',
        group: 'language',
        color: 'bg-amber-100 text-amber-800 hover:bg-amber-200',
    },
    {
        type: QuestionType.WORD_SCRAMBLE,
        label: 'Ghép chữ thành từ',
        shortLabel: 'Ghép chữ',
        description: 'Sắp xếp các chữ cái để tạo thành từ đúng.',
        example: 'Ví dụ: H – O – A → HOA.',
        group: 'language',
        color: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
    },
    {
        type: QuestionType.ERROR_CORRECTION,
        label: 'Tìm và sửa lỗi sai',
        shortLabel: 'Sửa lỗi',
        description: 'Tìm từ viết sai rồi nhập lại từ đúng.',
        example: 'Ví dụ: “ngoãn” → “ngoan”.',
        group: 'language',
        color: 'bg-rose-100 text-rose-700 hover:bg-rose-200',
    },
    {
        type: QuestionType.RIDDLE,
        label: 'Giải câu đố',
        shortLabel: 'Câu đố',
        description: 'Tạo câu đố bằng lời và một đáp án ngắn.',
        example: 'Ví dụ: Giữ nguyên là một loài hoa…',
        group: 'language',
        color: 'bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-200',
    },
    {
        type: QuestionType.IMAGE_QUESTION,
        label: 'Câu hỏi dựa vào hình',
        shortLabel: 'Dựa vào hình',
        description: 'Dùng một ảnh chính và các phương án trả lời.',
        example: 'Ví dụ: Quan sát hình rồi chọn hình vuông.',
        group: 'image',
        color: 'bg-violet-100 text-violet-700 hover:bg-violet-200',
    },
];

const GROUP_COPY: Record<QuestionTypeGroupId, { label: string; description: string }> = {
    popular: {
        label: 'Phổ biến',
        description: 'Các dạng giáo viên dùng thường xuyên nhất.',
    },
    interactive: {
        label: 'Tương tác',
        description: 'Kéo thả, sắp xếp và phân loại.',
    },
    language: {
        label: 'Ngôn ngữ',
        description: 'Các dạng phù hợp Tiếng Việt và Tiếng Anh.',
    },
    image: {
        label: 'Hình ảnh',
        description: 'Câu hỏi cần ảnh minh họa làm dữ kiện chính.',
    },
};

export const QUESTION_TYPE_GROUPS = (
    ['popular', 'interactive', 'language', 'image'] as QuestionTypeGroupId[]
).map((id) => ({
    id,
    ...GROUP_COPY[id],
    items: QUESTION_TYPE_DESCRIPTORS.filter((item) => item.group === id),
}));

export const QUICK_ADD_TYPES = QUESTION_TYPE_DESCRIPTORS
    .filter((item) => item.group === 'popular')
    .map((item) => ({
        type: item.type,
        label: item.shortLabel,
        description: item.description,
        example: item.example,
        color: item.color,
    }));

export const QUESTION_TYPE_OPTIONS = QUESTION_TYPE_DESCRIPTORS.map((item) => [
    item.type,
    item.label,
] as const);

export const getQuestionTypeDescriptor = (type: QuestionType): QuestionTypeDescriptor | undefined =>
    QUESTION_TYPE_DESCRIPTORS.find((item) => item.type === type);

