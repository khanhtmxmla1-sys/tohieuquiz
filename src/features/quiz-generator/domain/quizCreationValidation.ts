import { QuestionType } from '../../../types';
import type { DifficultyLevels, QuizMode } from './quizCreation.types';
import { validateQuizBlueprint, type QuestionTypeAllocation, type QuizIntent } from './quizBlueprint';

export interface QuizGenerationValidationInput {
    mode: QuizMode;
    uploadedFile: File | null;
    topic: string;
    classLevel: string;
    selectedTypes: Record<string, boolean>;
    typeAllocations?: QuestionTypeAllocation[];
    intent?: QuizIntent;
    difficultyLevels: DifficultyLevels;
}

export interface QuizGenerationValidationResult {
    error: string | null;
    enabledTypes: QuestionType[];
    questionCount: number;
}

export const getEnabledQuestionTypes = (
    selectedTypes: Record<string, boolean>,
): QuestionType[] => Object.entries(selectedTypes)
    .filter(([, enabled]) => enabled)
    .map(([type]) => type as QuestionType);

export const validateQuizGenerationInput = (
    input: QuizGenerationValidationInput,
): QuizGenerationValidationResult => {
    const enabledTypes = getEnabledQuestionTypes(input.selectedTypes);
    const questionCount = input.difficultyLevels.level1
        + input.difficultyLevels.level2
        + input.difficultyLevels.level3;

    if (input.mode === 'pdf' && !input.uploadedFile) {
        return { error: 'Vui lòng tải lên file PDF hoặc ảnh', enabledTypes, questionCount };
    }
    if (input.mode !== 'pdf' && !input.topic.trim()) {
        return { error: 'Vui lòng nhập chủ đề bài học', enabledTypes, questionCount };
    }
    if (!input.classLevel || !input.classLevel.trim()) {
        return { error: 'Vui lòng chọn Khối lớp cho đề thi', enabledTypes, questionCount };
    }
    if (enabledTypes.length === 0) {
        return { error: 'Vui lòng chọn ít nhất một dạng câu hỏi', enabledTypes, questionCount };
    }
    if (questionCount === 0) {
        return { error: 'Tổng số câu hỏi phải lớn hơn 0', enabledTypes, questionCount };
    }
    if (input.typeAllocations) {
        const blueprintErrors = validateQuizBlueprint({
            intent: input.intent ?? (input.mode === 'exam' ? 'EXAM' : 'PRACTICE'),
            sourceMode: input.mode === 'pdf' ? 'DOCUMENT' : 'TOPIC',
            totalQuestions: questionCount,
            typeAllocations: input.typeAllocations,
            difficultyLevels: input.difficultyLevels,
        });
        if (blueprintErrors.length > 0) {
            return { error: blueprintErrors[0], enabledTypes, questionCount };
        }
    }

    return { error: null, enabledTypes, questionCount };
};
