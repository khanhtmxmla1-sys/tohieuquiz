export const MANUAL_QUIZ_DRAFT_SCHEMA_VERSION = 1 as const;
export const MAX_MANUAL_QUIZ_DRAFT_BYTES = 1_000_000;
export const MAX_MANUAL_QUIZ_DRAFT_QUESTIONS = 300;

export interface ManualQuizDraftQuizPayload {
    id: string;
    title: string;
    classLevel: string;
    timeLimit: number;
    questions: unknown[];
    createdAt: string;
    [key: string]: unknown;
}

export interface ManualQuizDraftPayload {
    schemaVersion: typeof MANUAL_QUIZ_DRAFT_SCHEMA_VERSION;
    draftId: string;
    quizId?: string;
    ownerUsername: string;
    revision: number;
    quiz: ManualQuizDraftQuizPayload;
    selectedQuestionId: string | null;
    targetPoints: number;
    updatedAt: string;
}

export interface PutManualQuizDraftRequest {
    expectedRevision: number;
    draft: ManualQuizDraftPayload;
}

export interface ManualQuizDraftRecord {
    id: string;
    ownerUsername: string;
    quizId?: string;
    revision: number;
    draft: ManualQuizDraftPayload;
    createdAt: string;
    updatedAt: string;
    expiresAt?: string;
}

export interface ManualQuizDraftConflictPayload {
    status: 'error';
    code: 'DRAFT_CONFLICT';
    message: string;
    current: ManualQuizDraftRecord | null;
}

export interface ManualQuizDraftValidationError {
    code: 'INVALID_DRAFT';
    message: string;
}

export type ParseManualQuizDraftRequestResult =
    | { ok: true; value: PutManualQuizDraftRequest }
    | { ok: false; error: ManualQuizDraftValidationError };

const ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);

const isFinitePositive = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

export const utf8ByteLength = (value: string): number => new TextEncoder().encode(value).byteLength;

export const isValidManualQuizDraftId = (value: unknown): value is string =>
    typeof value === 'string' && ID_PATTERN.test(value);

export const parsePutManualQuizDraftRequest = (
    input: unknown,
    pathDraftId: string,
): ParseManualQuizDraftRequestResult => {
    const invalid = (message: string): ParseManualQuizDraftRequestResult => ({
        ok: false,
        error: { code: 'INVALID_DRAFT', message },
    });

    if (!isPlainObject(input)) return invalid('Dữ liệu bản nháp không hợp lệ.');
    if (!Number.isInteger(input.expectedRevision) || Number(input.expectedRevision) < 0) {
        return invalid('Revision dự kiến phải là số nguyên không âm.');
    }
    if (!isPlainObject(input.draft)) return invalid('Thiếu nội dung bản nháp.');

    const draft = input.draft;
    if (draft.schemaVersion !== MANUAL_QUIZ_DRAFT_SCHEMA_VERSION) {
        return invalid('Phiên bản cấu trúc bản nháp chưa được hỗ trợ.');
    }
    if (!isValidManualQuizDraftId(draft.draftId) || draft.draftId !== pathDraftId) {
        return invalid('Mã bản nháp không khớp với đường dẫn.');
    }
    if (typeof draft.ownerUsername !== 'string' || draft.ownerUsername.length > 128) {
        return invalid('Chủ sở hữu bản nháp không hợp lệ.');
    }
    if (!Number.isInteger(draft.revision) || Number(draft.revision) < 0) {
        return invalid('Revision bản nháp không hợp lệ.');
    }
    if (!isPlainObject(draft.quiz)) return invalid('Thiếu dữ liệu đề kiểm tra.');
    if (!isValidManualQuizDraftId(draft.quiz.id)) return invalid('Mã đề kiểm tra không hợp lệ.');
    if (typeof draft.quiz.title !== 'string' || draft.quiz.title.length > 500) {
        return invalid('Tên đề kiểm tra không hợp lệ.');
    }
    if (typeof draft.quiz.classLevel !== 'string' || draft.quiz.classLevel.length > 64) {
        return invalid('Khối lớp không hợp lệ.');
    }
    if (!isFinitePositive(draft.quiz.timeLimit) || draft.quiz.timeLimit > 1440) {
        return invalid('Thời gian làm bài không hợp lệ.');
    }
    if (!Array.isArray(draft.quiz.questions) || draft.quiz.questions.length > MAX_MANUAL_QUIZ_DRAFT_QUESTIONS) {
        return invalid(`Bản nháp chỉ hỗ trợ tối đa ${MAX_MANUAL_QUIZ_DRAFT_QUESTIONS} câu hỏi.`);
    }
    if (typeof draft.quiz.createdAt !== 'string' || Number.isNaN(Date.parse(draft.quiz.createdAt))) {
        return invalid('Thời gian tạo đề kiểm tra không hợp lệ.');
    }
    if (draft.selectedQuestionId !== null && typeof draft.selectedQuestionId !== 'string') {
        return invalid('Câu hỏi đang chọn không hợp lệ.');
    }
    if (!isFinitePositive(draft.targetPoints) || draft.targetPoints > 10_000) {
        return invalid('Tổng điểm mục tiêu không hợp lệ.');
    }
    if (typeof draft.updatedAt !== 'string' || Number.isNaN(Date.parse(draft.updatedAt))) {
        return invalid('Thời gian cập nhật bản nháp không hợp lệ.');
    }
    if (draft.quizId !== undefined && !isValidManualQuizDraftId(draft.quizId)) {
        return invalid('Mã đề đã lưu không hợp lệ.');
    }

    return {
        ok: true,
        value: input as unknown as PutManualQuizDraftRequest,
    };
};
