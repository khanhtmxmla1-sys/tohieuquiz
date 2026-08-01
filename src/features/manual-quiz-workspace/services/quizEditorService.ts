import { callApi } from '../../../services/apiAdapter';
import type { QuizEditorPayload, QuizVersionResult } from '../types/manualQuizWorkspace.types';

export const getQuizEditorPayload = (quizId: string): Promise<QuizEditorPayload> =>
    callApi<QuizEditorPayload>('get_quiz_editor', { quizId });

export const createQuizVersion = async (
    quizId: string,
    title?: string,
): Promise<QuizVersionResult> => {
    const response = await callApi<{ status: string; data: QuizVersionResult }>('create_quiz_version', {
        quizId,
        ...(title ? { title } : {}),
    });
    if (!response || response.status !== 'success' || !response.data?.id) {
        throw new Error('Không thể tạo phiên bản mới của đề.');
    }
    return response.data;
};
