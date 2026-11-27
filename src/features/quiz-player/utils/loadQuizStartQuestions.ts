import type { Question, StudentSession } from '../../../types';
import { adaptStudentQuizQuestion, fetchQuizPlayQuestions } from '../../../services/quizAccessService';
import { startAssignmentAttempt } from '../../../services/classroomService';

interface LoadQuizStartQuestionsProps {
    quizId: string;
    isPractice?: boolean;
    questions: Question[];
    assignmentId?: string;
    accessGrant?: string;
    session: Pick<StudentSession, 'studentId'> | null;
}

export const loadQuizStartQuestions = async ({
    quizId,
    isPractice,
    questions,
    assignmentId,
    accessGrant,
    session,
}: LoadQuizStartQuestionsProps): Promise<Question[]> => {
    const loadedQuestions = isPractice
        ? questions
        : (() => {
            return fetchQuizPlayQuestions(quizId, {
                assignmentId,
                accessGrant,
            }).then((playPayload) => (
                Array.isArray(playPayload.questions)
                    ? playPayload.questions.map((question) => adaptStudentQuizQuestion(question))
                    : []
            ));
        })();
    const resolvedQuestions = await loadedQuestions;
    if (resolvedQuestions.length === 0) {
        throw new Error('Không tải được câu hỏi của bài làm.');
    }

    if (assignmentId) {
        const studentId = session?.studentId;
        if (!studentId) {
            throw new Error('Phiên học sinh không hợp lệ. Em hãy đăng nhập lại.');
        }
        await startAssignmentAttempt(assignmentId, String(studentId));
    }

    return resolvedQuestions;
};
