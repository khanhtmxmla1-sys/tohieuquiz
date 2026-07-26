import type { QuestionSkillMetadataFields } from '../shared/skillTaxonomy';

/**
 * Domain Types
 * 
 * Core business types for the Quiz application.
 */

export interface QuestionMetadata extends QuestionSkillMetadataFields {
    tags?: string[] | string;
    /** Version of the server-owned math normalization applied to this question. */
    mathFormatVersion?: number;
    /** Điểm dành cho câu hỏi trong đề do giáo viên soạn. */
    points?: number;
    /** Lời giải/hướng dẫn, chỉ hiển thị theo policy sau khi học sinh nộp bài. */
    explanation?: string;
    imageAlt?: string;
}

export enum QuestionType {
    MCQ = 'MCQ',
    TRUE_FALSE = 'TRUE_FALSE',
    SHORT_ANSWER = 'SHORT_ANSWER',
    MATCHING = 'MATCHING',
    MULTIPLE_SELECT = 'MULTIPLE_SELECT',
    DRAG_DROP = 'DRAG_DROP',
    ORDERING = 'ORDERING', // Sắp xếp thứ tự câu trong đoạn văn
    IMAGE_QUESTION = 'IMAGE_QUESTION', // Câu hỏi có hình vẽ bắt buộc
    DROPDOWN = 'DROPDOWN', // Câu hỏi điền dropdown
    UNDERLINE = 'UNDERLINE', // Câu hỏi gạch chân từ/cụm từ
    CATEGORIZATION = 'CATEGORIZATION', // Kéo thả phân loại vào nhóm
    WORD_SCRAMBLE = 'WORD_SCRAMBLE', // Sắp xếp chữ cái thành từ
    RIDDLE = 'RIDDLE', // Giải câu đố
    ERROR_CORRECTION = 'ERROR_CORRECTION', // Tìm từ sai và sửa lại
    GEOMETRY = 'GEOMETRY', // Câu hỏi hình học (SVG/Canvas)
}

export interface MCQQuestion {
    id: string;
    type: QuestionType.MCQ;
    question: string;
    options: string[]; // [A, B, C, D]
    correctAnswer: string; // "A", "B", "C", or "D"
    image?: string; // URL or Base64
    explanation?: string; // Detailed guide on how to solve
    difficulty?: 1 | 2 | 3; // Mức độ khó: 1 = Dễ, 2 = Trung bình, 3 = Khó
}

export interface MultipleSelectQuestion {
    id: string;
    type: QuestionType.MULTIPLE_SELECT;
    question: string;
    options: string[];
    correctAnswers: string[]; // ["A", "C"]
    image?: string;
    explanation?: string;
    difficulty?: 1 | 2 | 3;
}

export interface TrueFalseItem {
    id: string;
    statement: string;
    isCorrect: boolean; // True if statement is correct (Đ), False if incorrect (S)
}

export interface TrueFalseQuestion {
    id: string;
    type: QuestionType.TRUE_FALSE;
    mainQuestion: string; // e.g., "Về nước:"
    items: TrueFalseItem[];
    image?: string;
    explanation?: string;
    difficulty?: 1 | 2 | 3;
}

export interface ShortAnswerQuestion {
    id: string;
    type: QuestionType.SHORT_ANSWER;
    question: string;
    correctAnswer: string; // Short string
    image?: string;
    explanation?: string;
    difficulty?: 1 | 2 | 3;
}

export interface MatchingPair {
    left: string;
    right: string;
    image?: string;
}

export interface MatchingQuestion {
    id: string;
    type: QuestionType.MATCHING;
    question: string; // "Nối cột A với cột B"
    pairs: MatchingPair[];
    image?: string;
    explanation?: string;
    difficulty?: 1 | 2 | 3;
}

export interface DragDropQuestion {
    id: string;
    type: QuestionType.DRAG_DROP;
    question: string; // Instruction
    text: string; // Text with blanks, e.g. "The sky is [blue]."
    blanks: string[]; // ["blue"]
    distractors: string[]; // ["red", "green"]
    image?: string;
    explanation?: string;
    difficulty?: 1 | 2 | 3;
}

// Image Library Item for teacher uploads
export interface ImageLibraryItem {
    id: string;
    name: string; // File name or description
    data: string; // Base64 data or URL
    topic?: string; // Optional topic tag
    createdAt: string;
}

// Ordering Question - Sắp xếp thứ tự các câu trong đoạn văn
export interface OrderingQuestion {
    id: string;
    type: QuestionType.ORDERING;
    question: string; // "Sắp xếp các câu sau thành đoạn văn hoàn chỉnh"
    items: string[]; // Các câu đã bị xáo trộn
    correctOrder: number[]; // Thứ tự đúng, ví dụ [2, 0, 3, 1] nghĩa là items[2] là câu 1, items[0] là câu 2...
    image?: string;
    explanation?: string;
    difficulty?: 1 | 2 | 3;
}

// Image Question - Câu hỏi trắc nghiệm có hình vẽ BẮT BUỘC
export interface ImageQuestion {
    id: string;
    type: QuestionType.IMAGE_QUESTION;
    question: string;
    image: string; // Base64 hoặc URL - BẮT BUỘC
    options: string[]; // [A, B, C, D]
    optionImages?: string[]; // URL hình ảnh cho từng đáp án
    correctAnswer: string; // "A", "B", "C", or "D"
    explanation?: string;
    difficulty?: 1 | 2 | 3;
}

// Dropdown blank item
export interface DropdownBlank {
    id: string;
    options: string[]; // Các lựa chọn trong dropdown
    correctAnswer: string; // Đáp án đúng
}

// Dropdown Question - Câu hỏi điền vào chỗ trống bằng dropdown
export interface DropdownQuestion {
    id: string;
    type: QuestionType.DROPDOWN;
    question: string;
    text: string;
    blanks: DropdownBlank[];
    image?: string;
    explanation?: string;
    difficulty?: 1 | 2 | 3;
}

// Underline Question - Câu hỏi gạch chân từ/cụm từ trong câu
export interface UnderlineQuestion {
    id: string;
    type: QuestionType.UNDERLINE;
    question: string;
    sentence: string;
    words: string[];
    correctWordIndexes: number[];
    image?: string;
    explanation?: string;
    difficulty?: 1 | 2 | 3;
}

// Category group for categorization question
export interface CategoryGroup {
    id: string;
    name: string; // Tên nhóm, ví dụ: "Câu thơ sử dụng biện pháp so sánh"
}

// Item cần phân loại
export interface CategorizationItem {
    id: string;
    content: string; // Nội dung item, ví dụ: "Bão giăng giằng mặt biển..."
    categoryId: string; // ID của category đúng (rỗng nếu không thuộc nhóm nào)
}

// Categorization Question - Kéo thả phân loại vào nhóm
export interface CategorizationQuestion {
    id: string;
    type: QuestionType.CATEGORIZATION;
    question: string;
    categories: CategoryGroup[];
    items: CategorizationItem[];
    instruction?: string;
    image?: string;
    explanation?: string;
    difficulty?: 1 | 2 | 3;
}

// Word Scramble Question - Sắp xếp chữ cái thành từ
export interface WordScrambleQuestion {
    id: string;
    type: QuestionType.WORD_SCRAMBLE;
    question: string;
    letters: string[];
    correctWord: string;
    hint?: string;
    image?: string;
    explanation?: string;
    difficulty?: 1 | 2 | 3;
}

// Riddle Question - Giải câu đố (Thêm/bớt dấu thanh)
export interface RiddleQuestion {
    id: string;
    type: QuestionType.RIDDLE;
    question: string;
    riddleLines: string[];
    correctAnswer: string;
    answerType: 'original' | 'transformed';
    answerLabel: string;
    hint?: string;
    image?: string;
    explanation?: string;
    difficulty?: 1 | 2 | 3;
}

// Error Correction Question - Tìm từ sai chính tả và sửa lại
export interface ErrorCorrectionQuestion {
    id: string;
    type: QuestionType.ERROR_CORRECTION;
    question: string;         // Đề bài
    passage: string;          // Đoạn văn/thơ chứa từ sai
    wrongWord: string;        // Từ viết sai
    correctWord: string;      // Từ đúng (sửa lại)
    explanation?: string;
    image?: string;
    difficulty?: 1 | 2 | 3;
}

// Geometry Question - Câu hỏi hình học
export interface GeometryQuestion {
    id: string;
    type: QuestionType.GEOMETRY;
    question: string;
    geometryData: any; // Using any for now to avoid circular or complex imports
    geometryType?: string;
    explanation?: string;
    image?: string;
    difficulty?: 1 | 2 | 3;
}

/**
 * Question Snapshot - Lưu thông tin câu hỏi tối giản trong kết quả
 * Dùng để xem chi tiết kết quả ngay cả khi quiz đã bị xóa
 */
export interface QuestionSnapshot {
    question: string;           // Nội dung câu hỏi
    type: QuestionType;         // Loại câu hỏi
    options?: string[];         // Các đáp án (nếu MCQ/IMAGE_QUESTION)
    correctAnswer?: string | string[];  // Đáp án đúng
    items?: any[];              // Items (TRUE_FALSE, MATCHING, etc.)
    mainQuestion?: string;      // Câu hỏi chính (TRUE_FALSE)
    subject?: QuestionMetadata['subject'];
    skillCode?: string;
    subskillCode?: string;
    tags?: QuestionMetadata['tags'];
}

/**
 * Answer Detail - Chi tiết câu trả lời của học sinh
 */
export interface AnswerDetail {
    selectedAnswer: any;        // Câu trả lời của học sinh
    isCorrect: boolean;         // Đúng hay sai
    timeSpent?: number;         // Thời gian làm (nếu có)
    questionSnapshot?: QuestionSnapshot;  // Snapshot câu hỏi (để xem khi quiz bị xóa)
}

export type Question = (
    MCQQuestion |
    TrueFalseQuestion |
    ShortAnswerQuestion |
    MatchingQuestion |
    MultipleSelectQuestion |
    DragDropQuestion |
    OrderingQuestion |
    ImageQuestion |
    DropdownQuestion |
    UnderlineQuestion |
    CategorizationQuestion |
    WordScrambleQuestion |
    RiddleQuestion |
    ErrorCorrectionQuestion |
    GeometryQuestion
) & QuestionMetadata;

export interface Quiz {
    id: string;
    title: string; // e.g., "Ôn tập Khoa học lớp 3: Không khí và Nước"
    topic?: string; // Subject/Topic name
    classLevel: string; // 1, 2, 3, 4, 5
    category?: string; // 'vioedu' | 'trang-nguyen' | 'on-tap'
    tags?: string[]; // User-defined tags for filtering/search
    detectedCategory?: string; // AI detected subject category (core 5 subjects)
    detectedLesson?: string; // AI detected lesson title
    suggestedTags?: string[]; // AI suggested hashtags
    examCode?: string; // Mã đề thi, VD: "Mã 01", "Vòng 1"
    timeLimit: number; // in minutes
    questions: Question[];
    createdAt: string;
    createdBy?: string; // Tên giáo viên tạo đề
    accessCode?: string; // 6-character code for quiz access
    requireCode?: boolean; // Whether to require code to start quiz
    showOnHome?: boolean; // Whether to show on HomePage library
    isPractice?: boolean; // Whether this quiz is in practice mode
    _assignmentData?: any; // Optional assignment metadata (avoid circular dependency)
}

export interface StudentResult {
    id: string; // UUID
    submissionId?: string; // Alias for id, used by phieu flow
    quizId: string;
    assignmentId?: string; // Exact assignment that authorized this attempt
    quizTitle?: string; // Optional quiz title from Google Sheets
    studentName: string;
    studentClass: string;
    score: number; // 0-10
    correctCount: number;
    totalQuestions: number;
    timeTaken: number; // in minutes
    submittedAt: string;
    answers: Record<string, any>; // Store student answers
    // Server-validated results for each question
    validationDetails?: {
        questionId: string;
        isCorrect: boolean;
        correctAnswer?: any;
    }[];
}

export interface Teacher {
    username: string;
    password: string; // Plain text for this simple app
    fullName: string;
    role?: 'admin' | 'teacher';
    class?: string; // Class this teacher is responsible for (e.g., "2a1")
}

/**
 * Quiz Generation Options
 */
export interface QuizGenerationOptions {
    topic: string;
    classLevel: string;
    content?: string;
    questionCount?: number;
    selectedTypes: Record<string, boolean>;
    difficulty?: {
        easy: number;
        medium: number;
        hard: number;
    };
    imageLibrary?: string[];
}

/**
 * AI Provider Types
 */
export type AIProviderType = 'gemini' | 'perplexity' | 'openai' | 'llm-mux';

/**
 * Quiz Creation Form State
 */
export interface QuizFormState {
    topic: string;
    classLevel: string;
    content: string;
    selectedTypes: Record<string, boolean>;
    questionCount: number;
    difficulty: {
        easy: number;
        medium: number;
        hard: number;
    };
    isGenerating: boolean;
    error: string | null;
}

/**
 * Results Filter State
 */
export interface ResultsFilterState {
    quizId?: string;
    classLevel?: string;
    dateFrom?: string;
    dateTo?: string;
    sortField: 'submittedAt' | 'score' | 'studentName';
    sortOrder: 'asc' | 'desc';
}

/**
 * App View State
 */
export type AppView = 'home' | 'student' | 'teacher_login' | 'teacher_dash' | 'student_portal';

/**
 * Pagination State
 */
export interface PaginationState {
    page: number;
    pageSize: number;
    totalItems: number;
}
