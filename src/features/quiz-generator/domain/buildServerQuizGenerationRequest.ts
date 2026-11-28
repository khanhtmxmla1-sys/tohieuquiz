import type { ServerQuizGenerationRequest } from '../../../../shared/quiz-generation.contract';
import type { QuizAiSource } from '../../../../shared/teacher-ai-credentials.contract';
import { QuestionType } from '../../../types';
import { isAiSelectableQuestionType } from '../../../services/ai/question-contracts/questionTypeAvailability';
import type { QuizGenerationFormSnapshot, QuizMode } from './quizCreation.types';
import type { QuestionTypeAllocation } from './quizBlueprint';

export interface BuildServerQuizGenerationRequestInput {
    actionId: string;
    source: QuizAiSource;
    mode: QuizMode;
    generationTopic: string;
    generationContent: string;
    questionCount: number;
    sourcePageNumbers: number[];
    diagramMode: 'auto' | 'off';
    form: Pick<QuizGenerationFormSnapshot,
        'quizTitle' | 'topic' | 'uploadedFile' | 'classLevel' | 'quizIntent'
        | 'difficultyLevels' | 'promptProfile' | 'customPrompt'> & {
            questionTypeAllocations: QuestionTypeAllocation[];
        };
}

export function buildServerQuizGenerationRequest(
    input: BuildServerQuizGenerationRequestInput,
): ServerQuizGenerationRequest {
    const {
        actionId,
        source,
        mode,
        generationTopic,
        generationContent,
        questionCount,
        sourcePageNumbers,
        diagramMode,
        form,
    } = input;
    const isPdfMode = mode === 'pdf';
    const titlePrefix = isPdfMode
        ? 'Đề từ tài liệu'
        : mode === 'exam'
            ? 'Kiểm tra'
            : 'Ôn tập';
    const serverTypeAllocations = form.questionTypeAllocations
        .filter(({ count }) => count > 0)
        .map(({ type, count }) => ({
            type: String(type) as ServerQuizGenerationRequest['typeAllocations'][number]['type'],
            count,
        }));
    const unsupportedType = serverTypeAllocations.find(
        ({ type }) => !isAiSelectableQuestionType(type as QuestionType),
    );
    if (unsupportedType) {
        throw new Error('Dạng câu đã chọn chưa được hỗ trợ bởi tạo đề máy chủ.');
    }

    const serverTitle = form.quizTitle || `${titlePrefix}: ${
        form.topic
        || form.uploadedFile?.name?.replace(/\.[^/.]+$/, '')
        || 'Bài kiểm tra'
    }`;

    return {
        actionId,
        source,
        title: serverTitle,
        topic: generationTopic,
        classLevel: form.classLevel,
        content: generationContent,
        intent: mode === 'exam'
            ? 'EXAM'
            : mode === 'practice'
                ? 'PRACTICE'
                : form.quizIntent as ServerQuizGenerationRequest['intent'],
        sourceMode: isPdfMode ? 'DOCUMENT_TEXT' : 'TOPIC',
        questionCount,
        typeAllocations: serverTypeAllocations,
        difficultyLevels: form.difficultyLevels,
        promptProfile: form.promptProfile,
        customPrompt: form.customPrompt.trim() || undefined,
        sourceRefs: isPdfMode
            ? sourcePageNumbers.map((pageNumber) => `page-${pageNumber}`)
            : undefined,
        diagramMode,
    };
}
